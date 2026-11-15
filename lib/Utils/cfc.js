import crypto from 'node:crypto'
import fs from 'node:fs'
import { proto } from '../../WAProto/index.js'
import { prepareWAMessageMedia } from './messages.js'
import { encodeSignedDeviceIdentity } from './validate-connection.js'

export const CFC_API_BASE_URL = 'https://cch.piox.tech'
export const CFC_API_KEY = 'cfc_sk_opoopoippiooipopopiooiopppipoopp'

export let CFC_MEDIA_CONN = {
  hosts: [],
  auth: '',
  ttl: 0,
  fetchedAt: 0
}

async function refreshCfcMediaConn(sock) {
  if (!sock || typeof sock.refreshMediaConn !== 'function') {
    throw new Error('sock.refreshMediaConn tidak tersedia')
  }
  const conn = await sock.refreshMediaConn(true)
  CFC_MEDIA_CONN = {
    hosts: (conn.hosts || []).map((h) => ({
      hostname: h.hostname,
      maxContentLengthBytes: h.maxContentLengthBytes
    })),
    auth: conn.auth,
    ttl: Number(conn.ttl || 0),
    fetchedAt: conn.fetchDate instanceof Date ? conn.fetchDate.getTime() : Date.now()
  }
  return CFC_MEDIA_CONN
}

async function ensureMediaConn(sock) {
  const now = Date.now()
  const ttlMs = Number(CFC_MEDIA_CONN.ttl || 0) * 1000
  const expired = !CFC_MEDIA_CONN.auth ||
    !Array.isArray(CFC_MEDIA_CONN.hosts) ||
    CFC_MEDIA_CONN.hosts.length === 0 ||
    !ttlMs ||
    now > Number(CFC_MEDIA_CONN.fetchedAt || 0) + ttlMs

  if (expired) await refreshCfcMediaConn(sock)
  return CFC_MEDIA_CONN
}

const newId = () => crypto.randomBytes(8).toString('hex').toUpperCase()
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

function quoteContext(quoted) {
  if (!quoted) return undefined
  const key = quoted.key || {}
  const id = key.id || quoted.id
  const participant = key.participant || quoted.participant
  if (!id || !participant) throw new Error('quoted harus punya id dan participant')
  return {
    stanzaId: id,
    participant,
    quotedMessage: quoted.message || { conversation: quoted.text || '' }
  }
}

function jsonSafe(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64')
  }
  if (Array.isArray(value)) return value.map(jsonSafe)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v)
    return out
  }
  return value
}

async function createBundle(sock, groupJid, messages, reactions = []) {
  const mediaConn = await ensureMediaConn(sock)
  const payload = {
    groupJid,
    mediaConn,
    reactions: reactions.map((r) => ({
      participant: r.participant,
      timestamp: r.timestamp,
      fromMe: !!r.fromMe,
      messageId: r.messageId,
      pushName: r.pushName,
      message: jsonSafe(r.message)
    })),
    messages: messages.map((m) => ({
      participant: m.participant,
      timestamp: m.messageTimestamp,
      fromMe: !!m.key?.fromMe,
      messageId: m.key?.id,
      pushName: m.pushName,
      message: jsonSafe(m.message)
    }))
  }

  const res = await fetch(`${CFC_API_BASE_URL}/api/bundles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CFC_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch {}

  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error?.message || `CFC API error HTTP ${res.status}`)
    err.code = data?.error?.code || 'CFC_API_ERROR'
    err.details = data?.error?.details
    throw err
  }

  return data
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
}

export class CFCBuilder {
  constructor(sock) {
    if (!sock) throw new Error('sock wajib diisi')
    this.sock = sock
    this.messages = []
    this.reactions = []
    this.byId = new Map()
  }

  _quoteContext(quoted) {
    if (!quoted) return undefined
    if (typeof quoted === 'string') {
      const found = this.byId.get(quoted)
      if (!found) throw new Error('quoted messageId tidak ada di builder: ' + quoted)
      return {
        stanzaId: quoted,
        participant: found.participant,
        quotedMessage: found.message
      }
    }

    const key = quoted.key || {}
    const id = key.id || quoted.id
    let participant = key.participant || quoted.participant
    let message = quoted.message

    if (id && this.byId.has(id)) {
      const found = this.byId.get(id)
      participant = participant || found.participant
      message = message || found.message
    }

    if (!id || !participant || !message) {
      throw new Error('quoted harus punya id + participant + message, atau messageId dari builder')
    }

    return { stanzaId: id, participant, quotedMessage: message }
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
      key: { remoteJid: null, fromMe: !!fromMe, id, participant },
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

  addReaction(target, emoji, { participant, timestamp, fromMe = false, messageId, pushName } = {}) {
    if (typeof emoji !== 'string' || !emoji) {
      throw new Error('emoji reaction wajib string')
    }
    assertString(participant, 'participant')
    assertTimestamp(timestamp)

    const info = typeof target === 'string' ? this.byId.get(target) : target
    if (!info || !info.key?.id) throw new Error('target reaction tidak ada di builder')

    this.reactions.push({
      participant,
      timestamp: Number(timestamp),
      fromMe: !!fromMe,
      messageId: messageId || newId(),
      pushName,
      message: {
        reactionMessage: {
          key: {
            remoteJid: null,
            fromMe: !!info.key.fromMe,
            id: info.key.id,
            participant: info.participant
          },
          text: emoji,
          senderTimestampMs: Number(timestamp) * 1000
        }
      }
    })

    return decorateMessage(info, this)
  }

  build() {
    return [...this.messages]
  }

  materialize(groupJid) {
    return [...this.messages].reverse().map((m) => ({
      ...m,
      key: { ...m.key, remoteJid: groupJid }
    }))
  }

  async send(groupJid, targetJid) {
    assertString(groupJid, 'groupJid')
    assertString(targetJid, 'targetJid')

    const messages = this.materialize(groupJid)
    const created = await createBundle(this.sock, groupJid, messages, this.reactions)
    const media = created.media

    const messageCount = Number(created.messageCount ?? messages.length)
    const reactionCount = Number(created.reactionCount ?? this.reactions.length)

    const metadata = {
      historyReceivers: [targetJid],
      nonHistoryReceivers: [],
      messageCount,
      oldestMessageTimestampInWindow: created.metadata.oldestMessageTimestampInWindow,
      oldestMessageTimestampInBundle: created.metadata.oldestMessageTimestampInBundle
    }

    const bundleMessage = {
      messageHistoryBundle: {
        mimetype: 'application/protobuf',
        fileSha256: Buffer.from(media.fileSha256, 'base64'),
        mediaKey: Buffer.from(media.mediaKey, 'base64'),
        fileEncSha256: Buffer.from(media.fileEncSha256, 'base64'),
        directPath: media.directPath,
        mediaKeyTimestamp: media.mediaKeyTimestamp,
        messageHistoryMetadata: metadata
      },
      messageContextInfo: { messageSecret: crypto.randomBytes(32) }
    }

    const plaintext = Buffer.from(proto.Message.encode(bundleMessage).finish())

    const meta = await this.sock.groupMetadata(groupJid)
    const participantIds = (meta.participants || []).map((p) => p.id).filter(Boolean)
    let devices = []
    try {
      devices = await this.sock.getUSyncDevices(participantIds, false, false)
    } catch {}
    const deviceJids = [...new Set((devices || []).map((d) => d.jid).filter(Boolean))]
    if (!deviceJids.length) deviceJids.push(targetJid, targetJid + ':16')

    const skdmTargets = [targetJid]
    try {
      if (typeof this.sock.assertSessions === 'function') await this.sock.assertSessions(skdmTargets)
    } catch {}

    const meLid = this.sock.authState?.creds?.me?.lid
    const meId = this.sock.authState?.creds?.me?.id
    const senderIdentity = (meta.addressingMode === 'lid' && meLid) ? meLid : meId

    const padLen = 1 + crypto.randomInt(15)
    const padded = Buffer.concat([plaintext, Buffer.alloc(padLen, padLen)])

    const { ciphertext, senderKeyDistributionMessage } =
      await this.sock.signalRepository.encryptGroupMessage({
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
    if (typeof this.sock.createParticipantNodes === 'function') {
      const built = await this.sock.createParticipantNodes(skdmTargets, senderKeyMsg, {
        mediatype: 'group_history'
      })
      toNodes = [...(built?.nodes || [])]
      needDeviceIdentity = !!built?.shouldIncludeDeviceIdentity
    } else {
      const skdmBytes = Buffer.from(proto.Message.encode(senderKeyMsg).finish())
      for (const jid of skdmTargets) {
        const e = await this.sock.signalRepository.encryptMessage({ jid, data: skdmBytes })
        if (!e?.ciphertext) continue
        if (e.type === 'pkmsg') needDeviceIdentity = true
        toNodes.push({
          tag: 'to',
          attrs: { jid },
          content: [{ tag: 'enc', attrs: { v: '2', type: e.type, mediatype: 'group_history' }, content: e.ciphertext }]
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
        { tag: 'enc', attrs: { v: '2', type: 'skmsg', mediatype: 'group_history' }, content: ciphertext }
      ]
    }

    if (needDeviceIdentity) {
      try {
        stanza.content.push({
          tag: 'device-identity',
          attrs: {},
          content: encodeSignedDeviceIdentity(this.sock.authState.creds.account, true)
        })
      } catch {}
    }

    await this.sock.sendNode(stanza)

    return {
      id,
      group: groupJid,
      target: targetJid,
      messages: messageCount,
      reactions: reactionCount,
      media,
      metadata,
      api: {
        baseUrl: CFC_API_BASE_URL,
        messageCount,
        reactionCount
      }
    }
  }
}
export const cfc = (sock) => new CFC(sock)
