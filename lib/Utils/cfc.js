import crypto from 'node:crypto'
import zlib from 'node:zlib'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { proto } from '../../WAProto/index.js'
import { prepareWAMessageMedia } from './messages.js'
import { MEDIA_PATH_MAP } from '../Defaults/index.js'
import { encodeSignedDeviceIdentity } from './validate-connection.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const newId = () => crypto.randomBytes(8).toString('hex').toUpperCase()
const sha256 = (b) => crypto.createHash('sha256').update(b).digest()
const NOOP_LOGGER = { debug(){}, info(){}, warn(){}, error(){}, trace(){} }

function assertString(value, name) {
  if (typeof value !== 'string' || !value) throw new Error(`${name} wajib diisi`)
}
function assertTimestamp(value) {
  if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
    throw new Error('timestamp wajib integer detik Unix')
  }
}

function computePhashV2(jids) {
  const canon = jids.map((jid) => {
    const at = jid.indexOf('@')
    if (at < 1) return jid
    const server = jid.slice(at + 1)
    const local = jid.slice(0, at)
    const colon = local.indexOf(':')
    let user = colon >= 0 ? local.slice(0, colon) : local
    let device = colon >= 0 ? local.slice(colon + 1) : '0'
    if (user.endsWith('.0')) user = user.slice(0, -2)
    if (!/^\d+$/.test(device)) device = '0'
    const srv = server === 'c.us' ? 's.whatsapp.net' : server
    return `${user}.0:${device}@${srv}`
  })
  canon.sort()
  const h = crypto.createHash('sha256')
  for (const s of canon) h.update(Buffer.from(s, 'utf8'))
  return '2:' + h.digest().subarray(0, 6).toString('base64')
}

function varint(n) {
  const out = []
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  out.push(n)
  return Buffer.from(out)
}
function field1(buf) {
  return Buffer.concat([Buffer.from([0x0a]), varint(buf.length), Buffer.from(buf)])
}

function encodeGroupHistory(messages) {
  const parts = []
  for (const m of messages) {
    parts.push(field1(Buffer.from(proto.WebMessageInfo.encode(m).finish())))
  }
  const serialized = Buffer.concat(parts)
  return { serialized, compressed: zlib.deflateSync(serialized) }
}

function encryptMedia(compressed) {
  const mediaKey = crypto.randomBytes(32)
  const expanded = Buffer.from(
    crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(0), Buffer.from('Group History'), 112)
  )
  const iv = expanded.subarray(0, 16)
  const cipherKey = expanded.subarray(16, 48)
  const macKey = expanded.subarray(48, 80)
  const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv)
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()])
  const mac = crypto
    .createHmac('sha256', macKey)
    .update(Buffer.concat([iv, ciphertext]))
    .digest()
    .subarray(0, 10)
  const encrypted = Buffer.concat([ciphertext, mac])
  return {
    mediaKey,
    encrypted,
    fileSha256: sha256(compressed),
    fileEncSha256: sha256(encrypted)
  }
}

function patchMediaPath() {
  if (MEDIA_PATH_MAP) {
    MEDIA_PATH_MAP['group-history'] = '/mms/group-history'
  }
}

async function sendBundle(sock, groupJid, messages, targetJid) {
  patchMediaPath()

  const { serialized, compressed } = encodeGroupHistory(messages)
  const enc = encryptMedia(compressed)

  const tmp = path.join(os.tmpdir(), 'cfc-' + crypto.randomBytes(6).toString('hex') + '.enc')
  fs.writeFileSync(tmp, enc.encrypted)
  let upload
  try {
    upload = await sock.waUploadToServer(tmp, {
      mediaType: 'group-history',
      fileEncSha256B64: enc.fileEncSha256.toString('base64'),
      timeoutMs: 60000
    })
  } finally {
    try { fs.unlinkSync(tmp) } catch {}
  }
  if (!upload?.directPath) throw new Error('upload group-history gagal: directPath kosong')

  const oldest = Math.min(...messages.map((m) => Number(m.messageTimestamp)))
  const metadata = {
    historyReceivers: [targetJid],
    nonHistoryReceivers: [],
    messageCount: messages.length,
    oldestMessageTimestampInWindow: oldest,
    oldestMessageTimestampInBundle: oldest
  }

  const bundle = {
    messageHistoryBundle: {
      mimetype: 'application/protobuf',
      fileSha256: enc.fileSha256,
      mediaKey: enc.mediaKey,
      fileEncSha256: enc.fileEncSha256,
      directPath: upload.directPath,
      mediaKeyTimestamp: Math.floor(Date.now() / 1000),
      messageHistoryMetadata: metadata
    },
    messageContextInfo: { messageSecret: crypto.randomBytes(32) }
  }
  const plaintext = Buffer.from(proto.Message.encode(bundle).finish())

  const meta = await sock.groupMetadata(groupJid)
  const participantIds = (meta.participants || []).map((p) => p.id).filter(Boolean)
  let devices = []
  try {
    devices = await sock.getUSyncDevices(participantIds, false, false)
  } catch (e) {
    console.log('[cfc] usync failed:', e?.message)
  }
  const deviceJids = [...new Set((devices || []).map((d) => d.jid).filter(Boolean))]
  if (!deviceJids.length) deviceJids.push(targetJid, targetJid + ':16')

  const skdmTargets = [targetJid]
  try {
    if (typeof sock.assertSessions === 'function') await sock.assertSessions(skdmTargets)
  } catch (e) {
    console.log('[cfc] assertSessions failed:', e?.message)
  }

  const meLid = sock.authState?.creds?.me?.lid
  const meId = sock.authState?.creds?.me?.id
  const senderIdentity = (meta.addressingMode === 'lid' && meLid) ? meLid : meId

  const padLen = 1 + crypto.randomInt(15)
  const padded = Buffer.concat([plaintext, Buffer.alloc(padLen, padLen)])

  const { ciphertext, senderKeyDistributionMessage } =
    await sock.signalRepository.encryptGroupMessage({
      group: groupJid,
      data: padded,
      meId: senderIdentity
    })

  const senderKeyMsg = {
    senderKeyDistributionMessage: {
      groupId: groupJid,
      axolotlSenderKeyDistributionMessage: senderKeyDistributionMessage
    }
  }

  let toNodes = []
  let needDeviceIdentity = false
  if (typeof sock.createParticipantNodes === 'function') {
    const built = await sock.createParticipantNodes(skdmTargets, senderKeyMsg, {
      mediatype: 'group_history'
    })
    toNodes = [...(built?.nodes || [])]
    needDeviceIdentity = !!built?.shouldIncludeDeviceIdentity
  } else {
    const skdmBytes = Buffer.from(proto.Message.encode(senderKeyMsg).finish())
    for (const jid of skdmTargets) {
      const e = await sock.signalRepository.encryptMessage({ jid, data: skdmBytes })
      if (!e?.ciphertext) continue
      if (e.type === 'pkmsg') needDeviceIdentity = true
      toNodes.push({
        tag: 'to',
        attrs: { jid },
        content: [{
          tag: 'enc',
          attrs: { v: '2', type: e.type, mediatype: 'group_history' },
          content: e.ciphertext
        }]
      })
    }
  }
  if (!toNodes.length) throw new Error('tidak ada device target yang bisa dienkripsi')

  const phash = computePhashV2(deviceJids)
  const id = '3EB0' + crypto.randomBytes(9).toString('hex').toUpperCase()

  const stanza = {
    tag: 'message',
    attrs: {
      id,
      to: groupJid,
      type: 'media',
      addressing_mode: meta.addressingMode || 'lid',
      phash
    },
    content: [
      { tag: 'participants', attrs: {}, content: toNodes },
      {
        tag: 'enc',
        attrs: { v: '2', type: 'skmsg', mediatype: 'group_history' },
        content: ciphertext
      }
    ]
  }

  if (needDeviceIdentity) {
    try {
      stanza.content.push({
        tag: 'device-identity',
        attrs: {},
        content: encodeSignedDeviceIdentity(sock.authState.creds.account, true)
      })
    } catch {}
  }

  await sock.sendNode(stanza)

  return {
    id,
    group: groupJid,
    target: targetJid,
    messages: messages.length,
    upload: upload.directPath,
    phash,
    serialized: serialized.length,
    compressed: compressed.length
  }
}


async function loadImageBuffer(source) {
  if (Buffer.isBuffer(source)) return source

  if (typeof source === 'string') {
    if (/^https?:\/\//i.test(source)) {
      const res = await fetch(source, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`fetch image gagal: HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    }
    return fs.readFileSync(source)
  }

  throw new Error('image source harus path, URL, Buffer, atau imageMessage object')
}

async function prepareImageMessage(sock, source) {
  if (source && typeof source === 'object' && !Buffer.isBuffer(source)) {
    if (source.directPath || source.url) return source
    throw new Error('imageMessage object harus punya directPath/url')
  }

  const buffer = await loadImageBuffer(source)
  const out = await prepareWAMessageMedia(
    { image: buffer },
    { upload: sock.waUploadToServer, logger: NOOP_LOGGER }
  )
  if (!out?.imageMessage) throw new Error('prepareWAMessageMedia gagal')
  return out.imageMessage
}

function decorateMessage(info, builder) {
  const methods = {
    addText: (...args) => builder.addText(...args),
    addImage: (...args) => builder.addImage(...args),
    addRaw: (...args) => builder.addRaw(...args),
    addReaction: (emoji, options) => builder.addReaction(info, emoji, options),
    send: (...args) => builder.send(...args)
  }
  for (const [key, fn] of Object.entries(methods)) {
    Object.defineProperty(info, key, {
      value: fn,
      enumerable: false,
      configurable: true
    })
  }
  Object.defineProperty(info, 'builder', {
    value: builder,
    enumerable: false,
    configurable: true
  })
  return info
}

export class CFC {
  constructor(sock) {
    if (!sock) throw new Error('sock wajib diisi')
    this.sock = sock
  }

  builder() {
    return new CFCBuilder(this.sock)
  }

  async send(groupJid, targetJid, messages) {
    return sendBundle(this.sock, groupJid, messages, targetJid)
  }
}

export class CFCBuilder {
  constructor(sock) {
    if (!sock) throw new Error('sock wajib diisi')
    this.sock = sock
    this.messages = []
    this.byId = new Map()
  }

  _quoteContext(quoted) {
    if (!quoted) return undefined

    if (typeof quoted === 'string') {
      const found = this.byId.get(quoted)
      if (!found) throw new Error('quoted messageId tidak ada di builder: ' + quoted)
      return {
        stanzaId: quoted,
        participant: found.key.participant,
        quotedMessage: found.message
      }
    }

    const key = quoted.key || {}
    const id = key.id || quoted.id
    let participant = key.participant || quoted.participant
    let message = quoted.message

    if (id && this.byId.has(id)) {
      const found = this.byId.get(id)
      participant = participant || found.key.participant
      message = message || found.message
    }

    if (!id || !participant || !message) {
      throw new Error('quoted harus punya id + participant + message, atau messageId dari builder')
    }

    return {
      stanzaId: id,
      participant,
      quotedMessage: message
    }
  }

  addRaw({ participant, timestamp, message, fromMe = false, messageId, pushName } = {}) {
    assertString(participant, 'participant')
    assertTimestamp(timestamp)
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new Error('message wajib object Proto.IMessage')
    }
    if ('fromMe' in message || 'participant' in message || 'messageTimestamp' in message) {
      throw new Error('fromMe/participant/messageTimestamp harus di luar message')
    }

    const id = messageId || newId()
    const info = {
      key: {
        remoteJid: null,
        fromMe: !!fromMe,
        id,
        participant
      },
      message,
      messageTimestamp: Number(timestamp),
      participant,
      pushName,
      status: 2
    }
    this.messages.push(info)
    this.byId.set(id, info)
    return decorateMessage(info, this)
  }

  addText(text, { participant, timestamp, fromMe = false, messageId, pushName, quoted = null } = {}) {
    if (typeof text !== 'string') throw new Error('text wajib string')
    const message = { extendedTextMessage: { text } }
    if (quoted) message.extendedTextMessage.contextInfo = this._quoteContext(quoted)
    return this.addRaw({ participant, timestamp, fromMe, messageId, pushName, message })
  }

  async addImage(source, { participant, timestamp, fromMe = false, messageId, pushName, caption, quoted = null } = {}) {
    const imageMessage = await prepareImageMessage(this.sock, source)
    const im = { ...imageMessage }
    if (typeof caption === 'string') im.caption = caption
    if (quoted) im.contextInfo = { ...(im.contextInfo || {}), ...this._quoteContext(quoted) }
    return this.addRaw({
      participant,
      timestamp,
      fromMe,
      messageId,
      pushName,
      message: { imageMessage: im }
    })
  }

  addReaction(target, emoji, { participant, timestamp, fromMe = false, messageId } = {}) {
    if (typeof emoji !== 'string' || !emoji) {
      throw new Error('emoji reaction wajib string')
    }
    assertString(participant, 'participant')
    assertTimestamp(timestamp)

    const info = typeof target === 'string' ? this.byId.get(target) : target
    if (!info) throw new Error('target reaction tidak ada di builder')

    const reaction = {
      key: {
        remoteJid: null,
        fromMe: !!fromMe,
        id: messageId || newId(),
        participant
      },
      text: emoji,
      senderTimestampMs: Number(timestamp) * 1000,
      unread: false
    }

    if (!Array.isArray(info.reactions)) info.reactions = []
    info.reactions.push(reaction)
    return decorateMessage(info, this)
  }

  build() {
    return [...this.messages]
  }

  materialize(groupJid) {
    return [...this.messages].reverse().map((m) => ({
      ...m,
      key: { ...m.key, remoteJid: groupJid },
      ...(Array.isArray(m.reactions)
        ? {
            reactions: m.reactions.map((reaction) => ({
              ...reaction,
              key: { ...(reaction.key || {}), remoteJid: groupJid }
            }))
          }
        : {})
    }))
  }

  async send(groupJid, targetJid) {
    assertString(groupJid, 'groupJid')
    assertString(targetJid, 'targetJid')
    return sendBundle(
      this.sock,
      groupJid,
      this.materialize(groupJid),
      targetJid
    )
  }
}

export const cfc = (sock) => new CFC(sock)
