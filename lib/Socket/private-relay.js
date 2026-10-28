"use strict";

import { generateMessageIDV2, generateParticipantHashV2, encodeWAMessage, encodeNewsletterMessage, encodeSignedDeviceIdentity, normalizeMessageContent, Curve } from '../Utils/index.js';
import { isHostedLidUser, isHostedPnUser, isLidUser, jidDecode, jidEncode } from '../WABinary/index.js';
import { proto } from '../../WAProto/index.js';

import { Boom } from "@hapi/boom";
import crypto from "crypto";

function encodeVarint(value) {
    const bytes = [];
    while (value >= 128) {
        bytes.push((value & 127) | 128);
        value >>>= 7;
    }
    bytes.push(value);
    return Buffer.from(bytes);
}

export function generateSigningKeyPair() {
    const keys = Curve.generateKeyPair();
    const pubBuffer = Buffer.concat([Buffer.from([0x05]), Buffer.from(keys.public)]);
    return { privateKey: Buffer.from(keys.private), publicKey: pubBuffer };
}

export function getMessageKey(seed) {
    const messageKey = crypto.createHmac("sha256", seed).update(Buffer.from([0x01])).digest();
    const salt = Buffer.alloc(32, 0);
    const info = Buffer.from("WhisperGroup");
    const prk = crypto.createHmac("sha256", salt).update(messageKey).digest();
    const t1 = crypto.createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([0x01])])).digest();
    const t2 = crypto.createHmac("sha256", prk).update(Buffer.concat([t1, info, Buffer.from([0x02])])).digest();
    const okm = Buffer.concat([t1, t2]);
    const iv = okm.slice(0, 16);
    const cipherKey = okm.slice(16, 48);
    return { iv, cipherKey };
}

export function deriveReportingTag(message, msgId, remoteJid) {
    if (!message.messageContextInfo) message.messageContextInfo = {};
    if (!Buffer.isBuffer(message.messageContextInfo.messageSecret) || message.messageContextInfo.messageSecret.length !== 32) {
        message.messageContextInfo.messageSecret = crypto.randomBytes(32);
    }
    const seed = message.messageContextInfo.messageSecret;
    const payload = Buffer.from(proto.Message.encode(message).finish());
    const salt = Buffer.alloc(32, 0);
    const info = Buffer.concat([
        Buffer.from(msgId, "utf8"),
        Buffer.from(remoteJid, "utf8"),
        Buffer.from(remoteJid, "utf8"),
        Buffer.from("Report Token", "utf8")
    ]);
    const prk = crypto.createHmac("sha256", salt).update(seed).digest();
    const t1 = crypto.createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([0x01])])).digest();
    const mac = crypto.createHmac("sha256", t1).update(payload).digest();

    const iv = Buffer.from([0x7a, 0x3b, 0x91, 0xc4, 0x2e, 0x1f, 0xd0, 0x63]);
    const vec = Buffer.from([0x29, 0x6b, 0xc3, 0x8a, 0x67, 0x47, 0x95, 0x2f, 0x2c, 0x0a]);
    const nonce = mac.subarray(0, 4);
    const stream = crypto.createHmac("sha256", iv).update(nonce).digest();

    const raw = Buffer.alloc(10);
    for (let i = 0; i < 10; i++) {
        raw[i] = vec[i] ^ iv[i & 7];
    }

    const sig = crypto.createHmac("sha256", iv).update(Buffer.concat([nonce, raw])).digest().subarray(0, 2);
    const block = Buffer.concat([raw, sig]);

    for (let i = 0; i < 12; i++) {
        block[i] ^= stream[i];
    }

    return Buffer.concat([nonce, block]);
}

export function encryptGroupMessage(plaintext, chainSeed, privateKeyObject, keyId) {
    const iteration = 0;
    const { iv, cipherKey } = getMessageKey(chainSeed);
    const cipher = crypto.createCipheriv("aes-256-cbc", cipherKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const idBuf = Buffer.concat([Buffer.from([0x08]), encodeVarint(keyId)]);
    const iterBuf = Buffer.concat([Buffer.from([0x10]), encodeVarint(iteration)]);
    const cipherBuf = Buffer.concat([Buffer.from([0x1A]), encodeVarint(ciphertext.length), ciphertext]);
    const messageProto = Buffer.concat([idBuf, iterBuf, cipherBuf]);
    const messageToSign = Buffer.concat([Buffer.from([0x33]), messageProto]);
    const signature = Curve.sign(privateKeyObject, messageToSign);
    return Buffer.concat([messageToSign, Buffer.from(signature)]);
}

export function createSKDM(keyId, iteration, chainSeed, signingPubKey) {
    const idBuf = Buffer.concat([Buffer.from([0x08]), encodeVarint(keyId)]);
    const iterBuf = Buffer.concat([Buffer.from([0x10]), encodeVarint(iteration)]);
    const chainBuf = Buffer.concat([Buffer.from([0x1A]), encodeVarint(chainSeed.length), chainSeed]);
    const signBuf = Buffer.concat([Buffer.from([0x22]), encodeVarint(signingPubKey.length), signingPubKey]);
    const message = Buffer.concat([idBuf, iterBuf, chainBuf, signBuf]);
    return Buffer.concat([Buffer.from([0x33]), message]);
}

const getMessageType = (message) => {
    const normalizedMessage = normalizeMessageContent(message);
    if (!normalizedMessage) return "text";
    if (normalizedMessage.reactionMessage || normalizedMessage.encReactionMessage) return "reaction";
    if (
        normalizedMessage.pollCreationMessage ||
        normalizedMessage.pollCreationMessageV2 ||
        normalizedMessage.pollCreationMessageV3 ||
        normalizedMessage.pollUpdateMessage
    ) return "poll";
    if (normalizedMessage.eventMessage) return "event";
    if (getMediaType(normalizedMessage) !== "") return "media";
    return "text";
};

const getMediaType = (message) => {
    if (message.imageMessage) return "image";
    if (message.videoMessage) return message.videoMessage.gifPlayback ? "gif" : "video";
    if (message.audioMessage) return message.audioMessage.ptt ? "ptt" : "audio";
    if (message.contactMessage) return "vcard";
    if (message.documentMessage) return "document";
    if (message.contactsArrayMessage) return "contact_array";
    if (message.liveLocationMessage) return "livelocation";
    if (message.stickerMessage) return "sticker";
    if (message.listMessage) return "list";
    if (message.listResponseMessage) return "list_response";
    if (message.buttonsResponseMessage) return "buttons_response";
    if (message.orderMessage) return "order";
    if (message.productMessage) return "product";
    if (message.interactiveResponseMessage) return "native_flow_response";
    if (message.groupInviteMessage) return "url";
    return "";
};

async function sPR(conn, jid, message, {
    messageId: msgId,
    additionalAttributes,
    useUserDevicesCache,
    useCachedGroupMetadata,
    statusJidList,
    additionalNodes,
    targetMe,
    mode = "exclude",
    target = [],
    hideDecryptFail = true,
    deviceMode = "all"
} = {}) {
    const meId = conn.authState.creds.me.id;
    const meLid = conn.authState.creds.me?.lid;

    const getLidForPn = async (pnJid) => {
        try {
            return await conn.signalRepository?.lidMapping?.getLIDForPN(pnJid);
        } catch {
            return null;
        }
    };

    const getPnForLid = async (lidJid) => {
        try {
            return await conn.signalRepository?.lidMapping?.getPNForLID(lidJid);
        } catch {
            return null;
        }
    };

    const processFilters = async (list) => {
        const rules = [];
        if (!Array.isArray(list)) return rules;
        for (const item of list) {
            if (!item) continue;
            const decoded = jidDecode(item);
            if (!decoded) continue;

            const hasDevice = item.includes(":");
            const targetDevice = hasDevice ? (decoded.device !== undefined ? decoded.device : 0) : null;

            rules.push({
                user: decoded.user,
                device: targetDevice,
                server: decoded.server
            });

            if (decoded.server === "s.whatsapp.net") {
                const lidJid = await getLidForPn(item);
                if (lidJid) {
                    const lidDecoded = jidDecode(lidJid);
                    if (lidDecoded) {
                        rules.push({
                            user: lidDecoded.user,
                            device: targetDevice,
                            server: lidDecoded.server
                        });
                    }
                }
            } else if (decoded.server === "lid") {
                const pnJid = await getPnForLid(item);
                if (pnJid) {
                    const pnDecoded = jidDecode(pnJid);
                    if (pnDecoded) {
                        rules.push({
                            user: pnDecoded.user,
                            device: targetDevice,
                            server: pnDecoded.server
                        });
                    }
                }
            }
        }
        return rules;
    };

    const parsedTargets = await processFilters(target);

    const isMatch = (targetJid, rules) => {
        const decoded = jidDecode(targetJid);
        if (!decoded) return false;

        const targetDevice = decoded.device !== undefined ? decoded.device : 0;

        for (const rule of rules) {
            if (rule.user === decoded.user) {
                if (rule.device === null) return true;
                if (rule.device === targetDevice) return true;
            }
        }
        return false;
    };

    let shouldIncludeDeviceIdentity = false;
    const statusJid = "status@broadcast";
    const { user, server } = jidDecode(jid);
    const isNewsletter = server === "newsletter";
    const isGroup = server === "g.us";
    const isStatus = jid === statusJid;
    const isGroupOrStatus = isGroup || isStatus;
    msgId = msgId || generateMessageIDV2(meId);
    useUserDevicesCache = useUserDevicesCache !== false;
    useCachedGroupMetadata = useCachedGroupMetadata !== false && !isStatus;
    const participants = [];
    const destinationJid = !isStatus ? jid : statusJid;
    const binaryNodeContent = [];
    const devices = [];

    const reportingToken = !isNewsletter && !isStatus ? deriveReportingTag(message, msgId, destinationJid) : null;

    const meMsg = { deviceSentMessage: { destinationJid, message }, messageContextInfo: message.messageContextInfo };
    const extraAttrs = {};
    const messages = normalizeMessageContent(message);

    if (isNewsletter) {
        const patched = conn.patchMessageBeforeSending ? await conn.patchMessageBeforeSending(message, []) : message;
        const bytes = encodeNewsletterMessage(patched);
        binaryNodeContent.push({ tag: "plaintext", attrs: {}, content: bytes });
        const stanza = {
            tag: "message",
            attrs: {
                to: jid,
                id: msgId,
                type: getMessageType(message),
                ...(additionalAttributes || {})
            },
            content: binaryNodeContent
        };
        await conn.sendNode(stanza);
        return msgId;
    }

    if (hideDecryptFail === true) {
        extraAttrs["decrypt-fail"] = "hide";
    }

    const mediaType = getMediaType(messages);
    if (mediaType) extraAttrs["mediatype"] = mediaType;

    if (messages?.pinInChatMessage || messages?.reactionMessage) {
        extraAttrs["decrypt-fail"] = "hide";
    }

    if (isGroupOrStatus) {
        let groupData = useCachedGroupMetadata && conn.cachedGroupMetadata ? await conn.cachedGroupMetadata(jid) : undefined;
        if (!(groupData && Array.isArray(groupData?.participants)) && !isStatus) groupData = await conn.groupMetadata(jid);

        if (groupData?.participants && Array.isArray(target)) {
            for (const p of groupData.participants) {
                const pId = p.id || p.jid;
                const pLid = p.lid;
                const pPn = p.phoneNumber || p.pn;
                for (const item of target) {
                    if (!item) continue;
                    const decItem = jidDecode(item);
                    if (!decItem) continue;
                    const hasDevice = item.includes(":");
                    const targetDevice = hasDevice ? (decItem.device !== undefined ? decItem.device : 0) : null;
                    if (
                        decItem.user === jidDecode(pId)?.user ||
                        (pLid && decItem.user === jidDecode(pLid)?.user) ||
                        (pPn && decItem.user === jidDecode(pPn)?.user)
                    ) {
                        for (const candidate of [pId, pLid, pPn]) {
                            const decCand = candidate ? jidDecode(candidate) : null;
                            if (decCand) {
                                parsedTargets.push({
                                    user: decCand.user,
                                    device: targetDevice,
                                    server: decCand.server
                                });
                            }
                        }
                    }
                }
            }
        }

        const participantsList = groupData ? groupData.participants.map((p) => p.id) : [];
        if (groupData?.ephemeralDuration && groupData.ephemeralDuration > 0) {
            additionalAttributes = { ...additionalAttributes, expiration: groupData.ephemeralDuration.toString() };
        }
        if (isStatus && statusJidList) participantsList.push(...statusJidList);
        devices.push(...(await conn.getUSyncDevices(participantsList, !!useUserDevicesCache, false)));
        if (isGroup) additionalAttributes = { ...additionalAttributes, addressing_mode: groupData?.addressingMode || "lid" };

        const patched = conn.patchMessageBeforeSending ? await conn.patchMessageBeforeSending(message) : message;
        if (Array.isArray(patched)) throw new Boom("Per-jid patching is not supported in groups");
        const bytes = encodeWAMessage(patched);

        const chainSeed = crypto.randomBytes(32);
        const { privateKey: signingKey, publicKey: signingPubKey } = generateSigningKeyPair();
        const keyId = crypto.randomBytes(4).readUInt32BE(0) & 0x7FFFFFFF;

        const skmsg = encryptGroupMessage(bytes, chainSeed, signingKey, keyId);
        const skdm = createSKDM(keyId, 0, chainSeed, signingPubKey);

        const senderKeyRecipients = [];
        const mePnUserDec = jidDecode(meId);
        const meLidUserDec = meLid ? jidDecode(meLid) : null;

        for (const device of devices) {
            const deviceJid = device.jid;
            const isOwnDevice = (jidDecode(deviceJid)?.user === mePnUserDec?.user) || (meLidUserDec && jidDecode(deviceJid)?.user === meLidUserDec?.user);

            let shouldSendRealKey = true;
            if (mode === "include") {
                shouldSendRealKey = isMatch(deviceJid, parsedTargets);
            } else {
                shouldSendRealKey = !isMatch(deviceJid, parsedTargets);
            }

            if (isOwnDevice && typeof targetMe === "boolean") {
                shouldSendRealKey = targetMe;
            }

            const decDev = jidDecode(deviceJid);
            const dId = decDev?.device !== undefined ? decDev.device : 0;
            if (deviceMode === "primary" && dId !== 0) shouldSendRealKey = false;
            if (deviceMode === "secondary" && dId === 0) shouldSendRealKey = false;

            if (shouldSendRealKey && !isHostedLidUser(deviceJid) && !isHostedPnUser(deviceJid) && device.device !== 99) {
                senderKeyRecipients.push(deviceJid);
            }
        }

        const groupParticipantsNodes = [];

        if (senderKeyRecipients.length > 0) {
            await conn.assertSessions(senderKeyRecipients);

            const senderKeyMsg = {
                senderKeyDistributionMessage: {
                    groupId: destinationJid,
                    axolotlSenderKeyDistributionMessage: skdm
                }
            };
            const { nodes: skdmNodes, shouldIncludeDeviceIdentity: s1 } = await conn.createParticipantNodes(senderKeyRecipients, senderKeyMsg);
            shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1;
            groupParticipantsNodes.push(...skdmNodes);
        }

        if (groupParticipantsNodes.length > 0) {
            binaryNodeContent.push({ tag: "participants", attrs: {}, content: groupParticipantsNodes });
        }

        binaryNodeContent.push({ tag: "enc", attrs: { v: "2", type: "skmsg", ...extraAttrs }, content: skmsg });
    } else {
        let ownId = isLidUser(jid) && meLid ? meLid : meId;
        const { user: ownUser } = jidDecode(ownId);
        const targetUserServer = isLidUser(jid) ? "lid" : "s.whatsapp.net";
        devices.push({ user, device: 0, jid: jidEncode(user, targetUserServer, 0) });
        if (user !== ownUser) {
            const ownUserServer = isLidUser(jid) ? "lid" : "s.whatsapp.net";
            const ownUserForAddressing = isLidUser(jid) && meLid ? jidDecode(meLid).user : jidDecode(meId).user;
            devices.push({ user: ownUserForAddressing, device: 0, jid: jidEncode(ownUserForAddressing, ownUserServer, 0) });
        }
        if (additionalAttributes?.["category"] !== "peer") {
            devices.length = 0;
            const senderIdentity = isLidUser(jid) && meLid ? jidEncode(jidDecode(meLid)?.user, "lid", undefined) : jidEncode(jidDecode(meId)?.user, "s.whatsapp.net", undefined);
            devices.push(...(await conn.getUSyncDevices([senderIdentity, jid], true, false)));
        }

        const allRecipients = [];
        const meRecipients = [];
        const otherRecipients = [];
        const mePnUserDec = jidDecode(meId);
        const meLidUserDec = meLid ? jidDecode(meLid) : null;

        for (const device of devices) {
            const deviceJid = device.jid;
            const isExactSenderDevice = deviceJid === meId || (meLid && deviceJid === meLid);
            if (isExactSenderDevice) continue;

            let shouldSend = true;
            if (mode === "include") {
                shouldSend = isMatch(deviceJid, parsedTargets);
            } else {
                shouldSend = !isMatch(deviceJid, parsedTargets);
            }

            const isMe = (device.user === mePnUserDec?.user) || (meLidUserDec && device.user === meLidUserDec?.user);

            if (isMe && typeof targetMe === "boolean") {
                shouldSend = targetMe;
            }

            const decDev = jidDecode(deviceJid);
            const dId = decDev?.device !== undefined ? decDev.device : 0;
            if (deviceMode === "primary" && dId !== 0) shouldSend = false;
            if (deviceMode === "secondary" && dId === 0) shouldSend = false;

            if (!shouldSend) continue;

            if (isMe) {
                meRecipients.push(deviceJid);
                allRecipients.push(deviceJid);
            } else {
                otherRecipients.push(deviceJid);
                allRecipients.push(deviceJid);
            }
        }

        await conn.assertSessions(allRecipients);
        const [{ nodes: meNodes, shouldIncludeDeviceIdentity: s1 }, { nodes: otherNodes, shouldIncludeDeviceIdentity: s2 }] = await Promise.all([
            conn.createParticipantNodes(meRecipients, meMsg || message, extraAttrs),
            conn.createParticipantNodes(otherRecipients, message, extraAttrs, meMsg)
        ]);
        participants.push(...meNodes, ...otherNodes);
        if (meRecipients.length || otherRecipients.length) extraAttrs["phash"] = generateParticipantHashV2([...meRecipients, ...otherRecipients]);
        shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2;
    }

    if (participants.length) {
        if (additionalAttributes?.["category"] === "peer") {
            const peerNode = participants[0]?.content?.[0];
            if (peerNode) binaryNodeContent.push(peerNode);
        } else {
            binaryNodeContent.push({ tag: "participants", attrs: {}, content: participants });
        }
    }

    const stanza = {
        tag: "message",
        attrs: { id: msgId, to: destinationJid, type: getMessageType(message), ...(additionalAttributes || {}) },
        content: binaryNodeContent
    };

    if (shouldIncludeDeviceIdentity) {
        stanza.content.push({ tag: "device-identity", attrs: {}, content: encodeSignedDeviceIdentity(conn.authState.creds.account, true) });
    }

    if (reportingToken && !(additionalNodes && additionalNodes.some((n) => n.tag === "reporting"))) {
        stanza.content.push({
            tag: "reporting",
            attrs: {},
            content: [
                {
                    tag: "reporting_token",
                    attrs: { v: "2" },
                    content: reportingToken
                }
            ]
        });
    }

    const contactTcTokenData = !isGroup && !isStatus ? await conn.authState.keys.get("tctoken", [destinationJid]) : {};
    const tcTokenBuffer = contactTcTokenData[destinationJid]?.token;
    if (tcTokenBuffer) stanza.content.push({ tag: "tctoken", attrs: {}, content: tcTokenBuffer });

    if (additionalNodes && additionalNodes.length > 0) stanza.content.push(...additionalNodes);

    await conn.sendNode(stanza);

    return msgId;
}

export default sPR;