<div align="center">
  <h1>LYNCXTEAMS</h1>
  <p><strong>WhatsApp Multi-Device Toolkit for Node.js</strong></p>
  <p>Socket runtime · Message composition · Interactive payloads · Channels · Communities · VoIP</p>
  <p>
    <img src="https://img.shields.io/badge/Package-%40lyncxteams%2Fbaileys-252A34?style=flat-square" alt="Package" />
    <img src="https://img.shields.io/badge/Runtime-Node.js%2020%2B-43853D?style=flat-square&logo=node.js&logoColor=white" alt="Node" />
    <img src="https://img.shields.io/badge/Modules-ESM-F7DF1E?style=flat-square&logo=javascript&logoColor=222" alt="ESM" />
    <img src="https://img.shields.io/badge/Protocol-Multi--Device-5965F2?style=flat-square" alt="Protocol" />
    <img src="https://img.shields.io/badge/License-MIT-268A68?style=flat-square" alt="License" />
  </p>
  <p><em>One connection layer. A broad set of WhatsApp Web building blocks.</em></p>
</div>

---

## About this package

`@lyncxteams/baileys` is an ESM-first WhatsApp Multi-Device library built around the Baileys ecosystem. It exposes the socket API, protocol utilities, generated WAProto types, interactive message builders, newsletter helpers, and VoIP modules from one package.

This repository is intended for developers who need direct control over a WhatsApp Web connection and want the message-building utilities available beside the socket implementation.

> This is an independent, unofficial project. It is not affiliated with, endorsed by, or supported by WhatsApp or Meta. WhatsApp may change its protocol without notice. Use a test account where possible and follow applicable terms and laws.

## Contents

- [Project profile](#project-profile)
- [Requirements and installation](#requirements-and-installation)
- [Connect a WhatsApp account](#connect-a-whatsapp-account)
- [Socket basics](#socket-basics)
- [Messages and media](#messages-and-media)
- [Interactive messages](#interactive-messages)
- [MessageBuilder and AIRich](#messagebuilder-and-airich)
- [Groups and communities](#groups-and-communities)
- [Newsletters and channel status](#newsletters-and-channel-status)
- [Privacy and account utilities](#privacy-and-account-utilities)
- [Scheduled messages](#scheduled-messages)
- [VoIP modules](#voip-modules)
- [Direct eval cookbook](#direct-eval-cookbook)
- [LID and JID notes](#lid-and-jid-notes)
- [Optional media dependencies](#optional-media-dependencies)
- [Troubleshooting](#troubleshooting)
- [Development notes](#development-notes)
- [Credits and license](#credits-and-license)

## Project profile

| Field | Value |
|---|---|
| Package | `@lyncxteams/baileys` |
| Package version in this source | `1.0.0` |
| Module format | ESM |
| Node.js | `>=20.0.0` |
| Main entry | `lib/index.js` |
| Type declarations | `lib/index.d.ts` |
| Repository | `LyncxTeams/baileys` |
| License declared by package | MIT |

The package name and organization are taken from the included `package.json`. The library retains upstream Baileys and third-party notices; see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md) when present in the distribution.

## Requirements and installation

- Node.js 20 or newer.
- npm, pnpm, or yarn.
- A WhatsApp account for pairing.
- A persistent writable directory for authentication state.

Install from the repository package:

```bash
npm install @lyncxteams/baileys
```

Or install the local source during development:

```bash
npm install
```

Use ESM imports:

```js
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from '@lyncxteams/baileys'
```

## Connect a WhatsApp account

The following is a minimal connection using multi-file authentication. Keep the session directory private; it contains credentials and Signal keys.

```js
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from '@lyncxteams/baileys'
import { Boom } from '@hapi/boom'

const { state, saveCreds } = await useMultiFileAuthState('./auth')

const sock = makeWASocket({
  auth: state,
  printQRInTerminal: true
})

sock.ev.on('creds.update', saveCreds)

sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
  if (connection === 'open') console.log('WhatsApp connected')
  if (connection === 'close') {
    const status = new Boom(lastDisconnect?.error)?.output?.statusCode
    if (status !== DisconnectReason.loggedOut) console.log('Reconnect the socket')
    else console.log('Session logged out; pair again')
  }
})
```

The code above demonstrates the lifecycle. In a production app, put reconnection in one controlled supervisor so multiple close events cannot create duplicate sockets. Do not delete a valid auth directory just to force a reconnect.

### Pairing code

For pairing-code login, use the socket method after the socket is initialized and the phone number is formatted as digits with country code, without `+`, spaces, or punctuation.

```js
const code = await sock.requestPairingCode('6281234567890')
console.log('Pairing code:', code)
```

Use QR login or pairing-code login according to the flow supported by your connection setup. Do not request both simultaneously for the same socket.

## Socket basics

The default export is `makeWASocket`. The package also exports protocol types and utilities from its public entry point.

```js
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  proto
} from '@lyncxteams/baileys'

console.log(Browsers.macOS('Desktop'))
console.log(jidNormalizedUser('6281234567890:4@s.whatsapp.net'))
```

Useful socket events:

| Event | Typical use |
|---|---|
| `connection.update` | Connection state, QR, reconnect handling |
| `creds.update` | Persist authentication credentials |
| `messages.upsert` | Receive new messages |
| `messages.update` | Delivery/read/status updates |
| `messages.delete` | Deleted-message notifications where available |
| `chats.upsert` | New or updated chats |
| `chats.update` | Chat metadata changes |
| `contacts.upsert` | Contact records |
| `contacts.update` | Contact name or metadata changes |
| `groups.upsert` | Group creation notifications |
| `groups.update` | Group metadata changes |
| `group-participants.update` | Participant changes |
| `presence.update` | Presence updates where available |
| `call` | Call events |

Example event listener:

```js
sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return
  for (const message of messages) {
    if (!message.message || message.key.fromMe) continue
    console.log(message.key.remoteJid, message.pushName)
  }
})
```

## Messages and media

### Send text

```js
const sent = await sock.sendMessage(jid, {
  text: 'Hello from LyncxTeams'
})
console.log(sent.key.id)
```

### Reply to a message

```js
await sock.sendMessage(jid, {
  text: 'This is a reply'
}, {
  quoted: message
})
```

### Mention users

```js
await sock.sendMessage(jid, {
  text: 'Hello @6281234567890',
  mentions: ['6281234567890@s.whatsapp.net']
})
```

### Send an image

```js
await sock.sendMessage(jid, {
  image: { url: './media/photo.jpg' },
  caption: 'Image caption'
})
```

### Send a video

```js
await sock.sendMessage(jid, {
  video: { url: './media/clip.mp4' },
  caption: 'Video caption'
})
```

### Send audio

```js
await sock.sendMessage(jid, {
  audio: { url: './media/audio.mp3' },
  mimetype: 'audio/mpeg',
  ptt: false
})
```

### Send a document

```js
await sock.sendMessage(jid, {
  document: { url: './files/guide.pdf' },
  mimetype: 'application/pdf',
  fileName: 'guide.pdf'
})
```

### Location and contact card

```js
await sock.sendMessage(jid, {
  location: {
    degreesLatitude: -6.2,
    degreesLongitude: 106.8,
    name: 'Jakarta'
  }
})

await sock.sendMessage(jid, {
  contacts: {
    displayName: 'Support',
    contacts: [{
      vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:Support\nTEL;type=CELL;type=VOICE;waid=6281234567890:+6281234567890\nEND:VCARD'
    }]
  }
})
```

### Reactions, edits, and deletes

```js
await sock.sendMessage(jid, {
  react: { text: '👍', key: message.key }
})

await sock.sendMessage(jid, {
  text: 'Updated text',
  edit: message.key
})

await sock.sendMessage(jid, {
  delete: message.key
})
```

### Forward a message

```js
import { forwardMessage } from '@lyncxteams/baileys'

await sock.sendMessage(jid, {
  forward: message,
  force: true
})
```

Forwarding behavior depends on the message type and client support. Do not treat a reconstructed message as proof of who originally sent it.

## Interactive messages

LyncxTeams exposes interactive message utilities through its integrated MessageBuilder. The exact UI rendered depends on the WhatsApp client version and server-side feature rollout.

### Import builders

```js
import {
  Button,
  ButtonV2,
  Carousel,
  AIRich,
  MessageBuilder,
  Toolkit
} from '@lyncxteams/baileys'
```

### Quick reply buttons

```js
const builder = new Button(sock)
  .setBody('Choose an action')
  .addButton('menu', 'Open menu')
  .addButton('help', 'Get help')

await builder.send(jid)
```

### URL and copy actions

```js
const builder = new Button(sock)
  .setBody('Useful links')
  .addUrl('Open website', 'https://example.com')
  .addCopy('Copy code', 'LYNCX-2026')

await builder.send(jid)
```

### ButtonV2

```js
const builder = new ButtonV2(sock)
  .setBody('Choose an option')
  .addButton('profile', 'My profile')
  .addButton('settings', 'Settings')

await builder.send(jid)
```

### Carousel

```js
const carousel = new Carousel(sock)
  .setBody('Featured items')
  .addCard({
    title: 'Documentation',
    body: 'Read the project guide',
    image: 'https://example.com/cover.jpg',
    buttons: [{
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: 'Open docs',
        url: 'https://example.com/docs'
      })
    }]
  })

await carousel.send(jid)
```

Builder method signatures can vary by builder class. Check the implementation under `lib/MessageBuilder/` when extending a builder or using a lower-level method.

## MessageBuilder and AIRich

`AIRich` creates structured rich-response payloads. It can combine text, sections, buttons, metadata, maps, tables, code blocks, media, and other supported primitives.

### Basic rich response

```js
const rich = new AIRich(sock)
  .setTitle('LyncxTeams')
  .setSubtitle('Interactive response')

rich.addText('A rich message can contain multiple content blocks.')
rich.addTip('Tip', 'Keep your socket session private.')

await rich.send(jid)
```

### Code and table

```js
const rich = new AIRich(sock).setTitle('Runtime details')

rich.addCode('js', "const status = 'connected'\nconsole.log(status)")
rich.addTable({
  headers: ['Property', 'Value'],
  rows: [
    ['Runtime', 'Node.js'],
    ['Module', 'ESM'],
    ['Protocol', 'Multi-Device']
  ]
})

await rich.send(jid)
```

### Map

```js
const rich = new AIRich(sock).setTitle('Places')

rich.addMap([
  { latitude: -6.2088, longitude: 106.8456, title: 'Point A', body: 'First location' },
  { latitude: -6.2150, longitude: 106.8500, title: 'Point B', body: 'Second location' }
])

await rich.send(jid)
```

Coordinates must be numeric. Map rendering depends on WhatsApp client support.

### Context info and quoted content

```js
const rich = new AIRich(sock)
  .setTitle('Context example')
  .setContextInfo({
    mentionedJid: ['6281234567890@s.whatsapp.net']
  })

rich.addText('This response carries context metadata.')
await rich.send(jid)
```

### Load and inspect an existing rich message

```js
const rich = AIRich.loadFrom(sock, incomingMessage)
console.log(rich.isSignaturePreserved)
console.log(rich.peek())
```

A signed Meta AI response can only retain its original proof when the signed payload is not modified. Editing its contents invalidates the preserved signature. A bot cannot mint a valid Meta signature for a response it created itself.

### MessageBuilder namespace

```js
import { MB } from '@lyncxteams/baileys'

const rich = new MB.AIRich(sock).setTitle('LyncxTeams')
rich.addText('Using the MessageBuilder namespace.')
await rich.send(jid)
```

The package entry point exposes `AIRich`, `Button`, `ButtonV2`, `Carousel`, `MessageBuilder`, and `Toolkit`, plus the integrated extras and Meta AI section helpers.

## Groups and communities

### Group metadata and participants

```js
const metadata = await sock.groupMetadata(groupJid)
console.log(metadata.subject, metadata.participants.length)

await sock.groupParticipantsUpdate(groupJid, [userJid], 'promote')
await sock.groupParticipantsUpdate(groupJid, [userJid], 'demote')
```

Use participant-management actions only when the connected account has the required group permissions.

### Group settings

```js
await sock.groupUpdateSubject(groupJid, 'Project Room')
await sock.groupUpdateDescription(groupJid, 'Project discussion')
await sock.groupSettingUpdate(groupJid, 'announcement')
await sock.groupSettingUpdate(groupJid, 'not_announcement')
await sock.groupToggleEphemeral(groupJid, 7 * 24 * 60 * 60)
```

### Join requests and invite links

```js
const pending = await sock.groupRequestParticipantsList(groupJid)
console.log(pending)

await sock.groupRequestParticipantsUpdate(groupJid, [userJid], 'approve')
const inviteCode = await sock.groupInviteCode(groupJid)
console.log(`https://chat.whatsapp.com/${inviteCode}`)
```

### Communities

```js
const community = await sock.communityCreate('Lyncx Community', 'Community description')
console.log(community)

const metadata = await sock.communityMetadata(community.id)
console.log(metadata)
```

Community operations and signatures are protocol-sensitive. Inspect `lib/Socket/communities.js` for the exact accepted arguments in the checked-out version.

## Newsletters and channel status

The socket type includes newsletter status helpers. A newsletter JID typically ends in `@newsletter`.

### Fetch channel information

```js
const info = await sock.newsletterMetadata('jid', newsletterJid)
console.log(info)
```

### Fetch status updates

```js
const statuses = await sock.getNewsletterStatusUpdates(newsletterJid)
console.log(statuses)
```

### Send a channel status

```js
const result = await sock.sendNewsletterStatus(newsletterJid, {
  text: 'Update from LyncxTeams'
})
console.log(result)
```

### React to a channel status

```js
await sock.sendNewsletterStatusReaction(newsletterJid, statusServerId, '❤️')
```

The available newsletter status methods include `sendNewsletterStatus`, `sendNewsletterStatusReaction`, `revokeNewsletterStatus`, `getNewsletterStatuses`, and `getNewsletterStatusUpdates`. Newsletter features may be restricted by account rollout and server-side support.

## Privacy and account utilities

### Privacy settings

```js
const privacy = await sock.fetchPrivacySettings(true)
console.log(privacy)

await sock.updateLastSeenPrivacy('contacts')
await sock.updateOnlinePrivacy('match_last_seen')
await sock.updateProfilePicturePrivacy('contacts')
await sock.updateStatusPrivacy('contacts')
await sock.updateReadReceiptsPrivacy('all')
await sock.updateGroupsAddPrivacy('contacts')
await sock.updateCallPrivacy('known')
await sock.updateDisableLinkPreviewsPrivacy(true)
```

Only use values accepted by the current WhatsApp protocol. The server may reject unsupported values.

### Block and unblock

```js
await sock.updateBlockStatus(userJid, 'block')
await sock.updateBlockStatus(userJid, 'unblock')
const blocklist = await sock.fetchBlocklist()
console.log(blocklist)
```

### About text

```js
await sock.updateProfileStatus('Available')
const status = await sock.fetchStatus(userJid)
console.log(status)
```

Method availability for newer text-status helpers depends on the exact source revision. Check the socket exports before calling a method copied from another fork.

### Disappearing messages

```js
await sock.updateDefaultDisappearingMode(7 * 24 * 60 * 60)
const durations = await sock.fetchDisappearingDuration(userJid)
console.log(durations)
```

### Contact and profile data

```js
const picture = await sock.profilePictureUrl(userJid, 'image')
console.log(picture)

const business = await sock.getBusinessProfile(userJid)
console.log(business)
```

## Scheduled messages

The source includes low-level helpers for constructing the scheduled-message payload. Scheduling is not a generic timer: WhatsApp controls the server-side reveal flow and enforces a supported time window.

```js
import {
  encodeScheduledMessage,
  decodeScheduledMessage,
  buildScheduledMsgMetaNode,
  buildUnscheduleProtocolMessage,
  isScheduledTimeValid
} from '@lyncxteams/baileys'

const scheduledAt = Math.floor(Date.now() / 1000) + 60 * 60
if (!isScheduledTimeValid(scheduledAt)) {
  throw new Error('Scheduled time is outside the supported window')
}

const payload = encodeScheduledMessage({
  conversation: 'A scheduled message'
})

const meta = buildScheduledMsgMetaNode({
  scheduledTimestampS: scheduledAt,
  revealKeyId: payload.revealKeyId,
  revealKey: payload.revealKey
})

await sock.relayMessage(jid, payload.message, {
  messageId: sock.generateMessageTag(),
  additionalNodes: [meta]
})
```

Keep `payload.revealKey` private. The helper API is low-level and should be tested against the current WhatsApp client rollout before production use.

## VoIP modules

The repository contains two separate VoIP implementations. They are not interchangeable.

### VoIP Core

```js
import {
  makeVoipClient,
  AudioFeeder,
  VideoFeeder,
  VIDEO_FORMAT_I420
} from '@lyncxteams/baileys'

const voip = await makeVoipClient(sock, {
  debug: false,
  logger: (...args) => console.log('[VoIP]', ...args)
})

await voip.connect()
voip.disconnect()
```

The VoIP client uses an already authenticated WhatsApp socket. It does not create its own WhatsApp session or pairing QR.

### VoIPJS manager

```js
import Voip from './lib/VoipJS/index.js'

const manager = new Voip(sock, {
  maxConcurrentCalls: 1,
  maxCallsPerHour: 3,
  maxCallsPerDay: 8,
  minIntervalMs: 300000,
  voipLogLevel: 'warn',
  allowedNumbers: []
})

await manager.listen()
manager.onIncoming(info => {
  console.log(info.callId, info.jid, info.isVideo)
})
```

VoIPJS uses its own call-manager API and media arguments. Review `lib/VoipJS/` and `VOIP_CALLING.md` before implementing call acceptance, media routing, or outbound calls.

## Direct eval cookbook

Kumpulan contoh untuk mencoba API yang memang tersedia di source `@lyncxteams/baileys` ini. Contoh ditulis untuk runtime eval bot WhatsApp, bukan file Node.js biasa.

### Variabel runtime

| Variabel | Keterangan |
|---|---|
| `conn` | Socket LyncxTeams yang sudah terhubung. |
| `m` | Pesan yang memanggil eval. |
| `m.chat` | JID chat asal perintah. |
| `m.sender` | JID pengirim perintah. |
| `m.key` | Key pesan pemanggil eval. |

Salin satu blok perintah. `=>` adalah prefix eval bot dan tidak perlu dihapus saat ditempel ke eval.

> [!IMPORTANT]
> Bagian ini hanya memuat method yang ditemukan pada source/type declaration fork LyncxTeams. Beberapa operasi butuh admin grup, izin akun, JID/ID valid, atau dukungan WhatsApp di perangkat tujuan. Keberadaan method tidak menjamin server WhatsApp menerima semua operasi pada setiap akun.

### 1. Pemeriksaan socket dan method

**Lihat objek akun bot:**

```js
=> conn.user
```

**Lihat JID akun bot:**

```js
=> conn.user?.id
```

**Lihat nama akun bot:**

```js
=> conn.user?.name
```

**Lihat status WebSocket:**

```js
=> ({ readyState: conn.ws?.readyState, user: conn.user?.id })
```

**Daftar method socket yang tersedia pada runtime:**

```js
=> Object.keys(conn).filter(k => typeof conn[k] === 'function').sort()
```

**Cek beberapa method sekaligus tanpa memanggilnya:**

```js
=> ['sendMessage','groupMetadata','newsletterMetadata','createCallLink','sendPrivateRelay','profilePictureUrl','onWhatsApp','fetchStatus','getBusinessProfile'].map(k => ({ method: k, available: typeof conn[k] === 'function' }))
```

### 2. Pesan dasar

**Kirim teks:**

```js
=> await conn.sendMessage(m.chat, { text: 'Hello from LyncxTeams' })
```

**Kirim teks dengan quote:**

```js
=> await conn.sendMessage(m.chat, { text: 'Ini balasan untuk pesan eval.' }, { quoted: m })
```

**Mention pengirim perintah:**

```js
=> await conn.sendMessage(m.chat, { text: `Halo @${m.sender.split('@')[0]}`, mentions: [m.sender] })
```

**Reaction pada pesan pemanggil:**

```js
=> await conn.sendMessage(m.chat, { react: { text: '⚡', key: m.key } })
```

**Hapus reaction bot dari pesan tersebut:**

```js
=> await conn.sendMessage(m.chat, { react: { text: '', key: m.key } })
```

**Edit pesan bot (ganti ID):**

```js
=> await conn.sendMessage(m.chat, { text: 'Pesan hasil edit', edit: { remoteJid: m.chat, fromMe: true, id: 'ID_PESAN_BOT' } })
```

**Kirim lokasi:**

```js
=> await conn.sendMessage(m.chat, { location: { degreesLatitude: -6.2, degreesLongitude: 106.816666, name: 'Jakarta' } })
```

**Kirim polling:**

```js
=> await conn.sendMessage(m.chat, { poll: { name: 'Pilih jawaban', values: ['A', 'B', 'C'], selectableCount: 1 } })
```

**Kirim kontak:**

```js
=> await conn.sendMessage(m.chat, { contacts: { displayName: 'LyncxTeams', contacts: [{ vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:LyncxTeams\nTEL;type=CELL;type=VOICE;waid=6281234567890:+6281234567890\nEND:VCARD' }] } })
```

**Kirim gambar dari URL:**

```js
=> await conn.sendMessage(m.chat, { image: { url: 'https://example.com/image.jpg' }, caption: 'LyncxTeams image' })
```

**Kirim video dari URL:**

```js
=> await conn.sendMessage(m.chat, { video: { url: 'https://example.com/video.mp4' }, caption: 'LyncxTeams video' })
```

**Kirim audio:**

```js
=> await conn.sendMessage(m.chat, { audio: { url: 'https://example.com/audio.mp3' }, mimetype: 'audio/mpeg' })
```

**Kirim voice note:**

```js
=> await conn.sendMessage(m.chat, { audio: { url: 'https://example.com/audio.ogg' }, mimetype: 'audio/ogg; codecs=opus', ptt: true })
```

**Kirim dokumen:**

```js
=> await conn.sendMessage(m.chat, { document: { url: 'https://example.com/file.pdf' }, mimetype: 'application/pdf', fileName: 'file.pdf' })
```

**Kirim stiker WebP:**

```js
=> await conn.sendMessage(m.chat, { sticker: { url: 'https://example.com/sticker.webp' } })
```

### 3. Membaca pesan dan tanda baca

**Lihat objek pesan:**

```js
=> m
```

**Lihat key pesan:**

```js
=> m.key
```

**Lihat tipe konten:**

```js
=> { const { getContentType } = await import('@lyncxteams/baileys'); return getContentType(m.message) }
```

**Ambil konten berdasarkan tipenya:**

```js
=> { const { getContentType } = await import('@lyncxteams/baileys'); const type = getContentType(m.message); return { type, content: m.message?.[type] } }
```

**Tandai pesan pemanggil sebagai sudah dibaca:**

```js
=> await conn.readMessages([m.key])
```

**Kirim presence sedang mengetik ke chat ini:**

```js
=> await conn.sendPresenceUpdate('composing', m.chat)
```

**Hentikan presence mengetik:**

```js
=> await conn.sendPresenceUpdate('paused', m.chat)
```

**Subscribe presence kontak:**

```js
=> await conn.presenceSubscribe(m.sender)
```

### 4. Kontak, nomor, username, dan profil

**Periksa nomor/JID di WhatsApp:**

```js
=> await conn.onWhatsApp('6281234567890')
```

**Periksa nomor pengirim:**

```js
=> await conn.onWhatsApp(m.sender)
```

**Cari akun berdasarkan username:**

```js
=> await conn.onWhatsAppUsername('username')
```

**Ambil username dari JID:**

```js
=> await conn.getUsernames(m.sender)
```

**Ambil foto profil pengirim:**

```js
=> await conn.profilePictureUrl(m.sender, 'image')
```

**Ambil foto profil bot:**

```js
=> await conn.profilePictureUrl(conn.user.id, 'image')
```

**Ambil status/About kontak:**

```js
=> await conn.fetchStatus(m.sender)
```

**Ambil profil bisnis kontak jika ada:**

```js
=> await conn.getBusinessProfile(m.sender)
```

**Cari pasangan PN/LID melalui helper socket:**

```js
=> await conn.findUserId(m.sender)
```

### 5. Grup

Contoh berikut menggunakan `m.chat`; jalankan di grup untuk operasi grup.

**Ambil metadata grup:**

```js
=> await conn.groupMetadata(m.chat)
```

**Ringkas informasi grup:**

```js
=> { const g = await conn.groupMetadata(m.chat); return { id: g.id, subject: g.subject, desc: g.desc, owner: g.owner, members: g.participants?.length } }
```

**Ambil semua grup yang diikuti bot:**

```js
=> await conn.groupFetchAllParticipating()
```

**Tampilkan nama semua grup:**

```js
=> Object.values(await conn.groupFetchAllParticipating()).map((g, i) => `${i + 1}. ${g.subject}`)
```

**Buat grup baru (gunakan nomor valid):**

```js
=> await conn.groupCreate('Grup LyncxTeams', ['6281234567890@s.whatsapp.net'])
```

**Tambah anggota:**

```js
=> await conn.groupParticipantsUpdate(m.chat, ['6281234567890@s.whatsapp.net'], 'add')
```

**Keluarkan anggota:**

```js
=> await conn.groupParticipantsUpdate(m.chat, ['6281234567890@s.whatsapp.net'], 'remove')
```

**Jadikan admin:**

```js
=> await conn.groupParticipantsUpdate(m.chat, ['6281234567890@s.whatsapp.net'], 'promote')
```

**Turunkan admin:**

```js
=> await conn.groupParticipantsUpdate(m.chat, ['6281234567890@s.whatsapp.net'], 'demote')
```

**Ubah nama grup:**

```js
=> await conn.groupUpdateSubject(m.chat, 'Nama Grup Baru')
```

**Ubah deskripsi grup:**

```js
=> await conn.groupUpdateDescription(m.chat, 'Deskripsi baru')
```

**Mode admin saja yang dapat mengirim pesan:**

```js
=> await conn.groupSettingUpdate(m.chat, 'announcement')
```

**Izinkan semua anggota mengirim pesan:**

```js
=> await conn.groupSettingUpdate(m.chat, 'not_announcement')
```

**Batasi pengeditan info grup:**

```js
=> await conn.groupSettingUpdate(m.chat, 'locked')
```

**Buka pengeditan info grup:**

```js
=> await conn.groupSettingUpdate(m.chat, 'unlocked')
```

**Ambil kode undangan grup:**

```js
=> await conn.groupInviteCode(m.chat)
```

**Cabut dan buat ulang kode undangan:**

```js
=> await conn.groupRevokeInvite(m.chat)
```

**Lihat info grup dari kode undangan:**

```js
=> await conn.groupGetInviteInfo('KODE_INVITE')
```

**Lihat antrean permintaan masuk:**

```js
=> await conn.groupRequestParticipantsList(m.chat)
```

**Setujui permintaan masuk:**

```js
=> await conn.groupRequestParticipantsUpdate(m.chat, ['6281234567890@s.whatsapp.net'], 'approve')
```

**Tolak permintaan masuk:**

```js
=> await conn.groupRequestParticipantsUpdate(m.chat, ['6281234567890@s.whatsapp.net'], 'reject')
```

**Aktifkan pesan sementara 7 hari:**

```js
=> await conn.groupToggleEphemeral(m.chat, 7 * 24 * 60 * 60)
```

**Matikan pesan sementara:**

```js
=> await conn.groupToggleEphemeral(m.chat, 0)
```

**Ubah siapa yang boleh menambahkan anggota:**

```js
=> await conn.groupMemberAddMode(m.chat, 'admin_add')
```

**Aktifkan persetujuan admin untuk permintaan bergabung:**

```js
=> await conn.groupJoinApprovalMode(m.chat, 'on')
```

**Keluar dari grup:**

```js
=> await conn.groupLeave(m.chat)
```

### 6. Komunitas

**Ambil metadata komunitas:**

```js
=> await conn.communityMetadata('ID_KOMUNITAS@g.us')
```

**Ambil grup yang terhubung ke komunitas:**

```js
=> await conn.communityFetchLinkedGroups('ID_KOMUNITAS@g.us')
```

**Ambil semua komunitas/grup yang diikuti:**

```js
=> await conn.communityFetchAllParticipating()
```

**Buat komunitas:**

```js
=> await conn.communityCreate('Komunitas LyncxTeams', 'Deskripsi komunitas')
```

**Ubah nama komunitas:**

```js
=> await conn.communityUpdateSubject('ID_KOMUNITAS@g.us', 'Nama Komunitas Baru')
```

**Ubah deskripsi komunitas:**

```js
=> await conn.communityUpdateDescription('ID_KOMUNITAS@g.us', 'Deskripsi baru')
```

**Hubungkan grup ke komunitas:**

```js
=> await conn.communityLinkGroup('ID_GRUP@g.us', 'ID_KOMUNITAS@g.us')
```

**Putuskan hubungan grup dari komunitas:**

```js
=> await conn.communityUnlinkGroup('ID_GRUP@g.us', 'ID_KOMUNITAS@g.us')
```

**Ambil kode undangan komunitas:**

```js
=> await conn.communityInviteCode('ID_KOMUNITAS@g.us')
```

### 7. Privasi dan pemblokiran

**Ambil pengaturan privasi akun:**

```js
=> await conn.fetchPrivacySettings(true)
```

**Ambil daftar blokir:**

```js
=> await conn.fetchBlocklist()
```

**Ambil durasi pesan sementara chat:**

```js
=> await conn.fetchDisappearingDuration(m.chat)
```

**Blokir kontak:**

```js
=> await conn.updateBlockStatus(m.sender, 'block')
```

**Buka blokir kontak:**

```js
=> await conn.updateBlockStatus(m.sender, 'unblock')
```

**Ubah nama profil bot:**

```js
=> await conn.updateProfileName('LyncxTeams')
```

**Ubah About/status teks bot:**

```js
=> await conn.updateProfileStatus('Powered by LyncxTeams')
```

**Hapus foto profil bot:**

```js
=> await conn.removeProfilePicture(conn.user.id)
```

**Privasi Last Seen:**

```js
=> await conn.updateLastSeenPrivacy('contacts')
```

**Privasi foto profil:**

```js
=> await conn.updateProfilePicturePrivacy('contacts')
```

**Privasi About:**

```js
=> await conn.updateStatusPrivacy('contacts')
```

**Privasi tanda dibaca:**

```js
=> await conn.updateReadReceiptsPrivacy('all')
```

**Privasi panggilan:**

```js
=> await conn.updateCallPrivacy('all')
```

**Privasi grup:**

```js
=> await conn.updateGroupsAddPrivacy('contacts')
```

**Pengaturan pesan sementara default:**

```js
=> await conn.updateDefaultDisappearingMode(7 * 24 * 60 * 60)
```

### 8. Newsletter / WhatsApp Channel

Gunakan JID channel yang valid, biasanya berakhiran `@newsletter`.

**Ambil metadata berdasarkan JID:**

```js
=> await conn.newsletterMetadata('jid', 'CHANNEL_JID')
```

**Ambil metadata berdasarkan kode undangan:**

```js
=> await conn.newsletterMetadata('invite', 'KODE_INVITE')
```

**Buat channel:**

```js
=> await conn.newsletterCreate('LyncxTeams Updates', 'Update dan informasi proyek')
```

**Ambil daftar channel yang diikuti:**

```js
=> await conn.newsletterSubscribed()
```

**Follow channel:**

```js
=> await conn.newsletterFollow('CHANNEL_JID')
```

**Unfollow channel:**

```js
=> await conn.newsletterUnfollow('CHANNEL_JID')
```

**Mute channel:**

```js
=> await conn.newsletterMute('CHANNEL_JID')
```

**Unmute channel:**

```js
=> await conn.newsletterUnmute('CHANNEL_JID')
```

**Ambil subscriber channel:**

```js
=> await conn.newsletterSubscribers('CHANNEL_JID')
```

**Ambil pesan channel:**

```js
=> await conn.newsletterFetchMessages('jid', 'CHANNEL_JID', 20)
```

**Beri reaction ke pesan channel:**

```js
=> await conn.newsletterReactMessage('CHANNEL_JID', 123, '❤️')
```

**Ubah nama channel:**

```js
=> await conn.newsletterUpdateName('CHANNEL_JID', 'Nama Channel Baru')
```

**Ubah deskripsi channel:**

```js
=> await conn.newsletterUpdateDescription('CHANNEL_JID', 'Deskripsi baru')
```

**Cabut gambar channel:**

```js
=> await conn.newsletterRemovePicture('CHANNEL_JID')
```

**Hitung admin channel:**

```js
=> await conn.newsletterAdminCount('CHANNEL_JID')
```

**Hapus channel:**

```js
=> await conn.newsletterDelete('CHANNEL_JID')
```

> [!WARNING]
> Contoh yang mengubah/menghapus channel, mengubah privasi, mengubah profil, memblokir kontak, atau mengubah grup akan melakukan tindakan nyata. Pastikan JID dan hak akses benar.

### 9. Label dan quick reply bisnis

**Tambah atau ubah kontak:**

```js
=> await conn.addOrEditContact(m.sender, { name: 'Kontak LyncxTeams' })
```

**Hapus kontak:**

```js
=> await conn.removeContact(m.sender)
```

**Tambah label ke chat:**

```js
=> await conn.addChatLabel(m.chat, 'LABEL_ID')
```

**Hapus label dari chat:**

```js
=> await conn.removeChatLabel(m.chat, 'LABEL_ID')
```

**Tambah label ke pesan:**

```js
=> await conn.addMessageLabel(m.chat, 'MESSAGE_ID', 'LABEL_ID')
```

**Hapus label dari pesan:**

```js
=> await conn.removeMessageLabel(m.chat, 'MESSAGE_ID', 'LABEL_ID')
```

**Bintangi pesan:**

```js
=> await conn.star(m.chat, [m.key], true)
```

**Hapus bintang pesan:**

```js
=> await conn.star(m.chat, [m.key], false)
```

**Tambah/ubah quick reply bisnis:**

```js
=> await conn.addOrEditQuickReply({ shortcut: 'halo', message: 'Halo, ada yang bisa dibantu?' })
```

### 10. Katalog bisnis

**Ambil katalog bisnis:**

```js
=> await conn.getCatalog({ jid: m.sender, limit: 10 })
```

**Ambil koleksi katalog:**

```js
=> await conn.getCollections(m.sender, 10)
```

**Ambil detail profil bisnis:**

```js
=> await conn.getBusinessProfile(m.sender)
```

### 11. MessageBuilder

Builder di bawah memang diekspor dari paket ini. Semua contoh memakai `MB` agar impor tetap singkat.

**Button quick reply:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const b = new MB.Button(conn).setTitle('LyncxTeams').setBody('Pilih menu').setFooter('Powered by LyncxTeams').addReply('Ping', 'ping').addReply('Menu', 'menu'); return await b.send(m.chat) }
```

**Button URL dan copy:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const b = new MB.Button(conn).setTitle('Useful links').setBody('Pilih tindakan').addUrl('Website', 'https://example.com').addCopy('Copy code', 'LYNCX-2026'); return await b.send(m.chat) }
```

**Button panggilan:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const b = new MB.Button(conn).setTitle('Contact').setBody('Hubungi kami').addCall('Call', '+6281234567890'); return await b.send(m.chat) }
```

**Button dengan header gambar:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const b = new MB.Button(conn).setImage('https://example.com/image.jpg').setTitle('LyncxTeams').setBody('Image header').addReply('Lanjut', 'next'); return await b.send(m.chat) }
```

**ButtonV2:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const b = new MB.ButtonV2(conn).setTitle('LyncxTeams').setBody('Pilih menu').addButton('Ping', 'ping').addButton('Menu', 'menu'); return await b.send(m.chat) }
```

**List / selection:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const b = new MB.Button(conn).setTitle('Menu').setBody('Pilih salah satu').addSelection('Buka pilihan').makeSection('Menu utama').makeRow('', 'Profil', 'Info akun bot', 'profile').makeRow('', 'Runtime', 'Info runtime', 'runtime'); return await b.send(m.chat) }
```

**AIRich teks dan kode:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const a = new MB.AIRich(conn).setTitle('LyncxTeams'); a.addText('Halo dari AIRich'); a.addCode('js', "console.log('LyncxTeams')"); return await a.send(m.chat) }
```

**AIRich tabel:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const a = new MB.AIRich(conn).setTitle('Runtime'); a.addTable([['Item','Value'],['Node.js',process.version],['Platform',process.platform]]); return await a.send(m.chat) }
```

**AIRich map:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const a = new MB.AIRich(conn).setTitle('Map'); a.addMap([{ latitude: -6.2, longitude: 106.816666, title: 'Jakarta', body: 'Indonesia' }]); return await a.send(m.chat) }
```

**Carousel:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const x = await new MB.Button(conn).setImage('https://example.com/one.jpg').setBody('Card one').addReply('Pilih', 'one').toCard(); const y = await new MB.Button(conn).setImage('https://example.com/two.jpg').setBody('Card two').addUrl('Buka', 'https://example.com').toCard(); const c = new MB.Carousel(conn).setBody('LyncxTeams carousel').addCard(x).addCard(y); return await c.send(m.chat) }
```

**Toolkit ambil buffer URL:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); return await MB.Toolkit.fetchBuffer('https://example.com/image.jpg') }
```

**Cek native-flow button:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); return MB.checkNativeFlowButtons([{ name: 'quick_reply' }, { name: 'cta_url' }]) }
```

**Cek apakah tipe button didukung Web:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); return MB.isWebSupportedButtonName('quick_reply') }
```

**Cek dukungan optional media `sharp`:**

```js
=> { const { hasOptionalMedia } = await import('@lyncxteams/baileys'); return await hasOptionalMedia('sharp') }
```

**Cek dukungan optional media `fluent-ffmpeg`:**

```js
=> { const { hasOptionalMedia } = await import('@lyncxteams/baileys'); return await hasOptionalMedia('fluent-ffmpeg') }
```

### 12. Panggilan dan private relay

**Buat link panggilan audio:**

```js
=> await conn.createCallLink('audio', false, 60 * 60 * 1000)
```

**Buat link panggilan video:**

```js
=> await conn.createCallLink('video', false, 60 * 60 * 1000)
```

**Tolak panggilan berdasarkan ID dan pengirim:**

```js
=> await conn.rejectCall('CALL_ID', 'CALLER_JID')
```

**Periksa fungsi private relay tersedia:**

```js
=> ({ sendPrivateRelay: typeof conn.sendPrivateRelay === 'function', relayPrivateMessage: typeof conn.relayPrivateMessage === 'function' })
```

> [!NOTE]
> Private relay memakai format dan opsi khusus. Gunakan dokumentasi `PRIVATE_RELAY.md` dari paket untuk payload yang sesuai; contoh ini sengaja tidak menebak isi pesan relay.

### 13. Status channel dan helper newsletter

**Ambil status newsletter:**

```js
=> await conn.getNewsletterStatuses('CHANNEL_JID')
```

**Ambil pembaruan status newsletter:**

```js
=> await conn.getNewsletterStatusUpdates('CHANNEL_JID')
```

**Kirim status teks ke newsletter:**

```js
=> await conn.sendNewsletterStatus('CHANNEL_JID', { text: 'Update LyncxTeams' })
```

**Reaction status newsletter:**

```js
=> await conn.sendNewsletterStatusReaction('CHANNEL_JID', 'STATUS_ID', '❤️')
```

**Cabut status newsletter:**

```js
=> await conn.revokeNewsletterStatus('CHANNEL_JID', 'STATUS_ID')
```

### 14. Pengalamatan LID / PN

**Lihat identifier pesan:**

```js
=> ({ remoteJid: m.key.remoteJid, remoteJidAlt: m.key.remoteJidAlt, participant: m.key.participant, participantAlt: m.key.participantAlt, sender: m.sender })
```

**Periksa format identifier pengirim:**

```js
=> ({ sender: m.sender, isLid: m.sender?.endsWith('@lid'), isPn: m.sender?.endsWith('@s.whatsapp.net') })
```

Jangan mengubah akhiran `@lid` menjadi `@s.whatsapp.net` secara manual. Pakai mapping dari WhatsApp atau helper yang tersedia.

### 15. Contoh gabungan

**Kirim ringkasan akun bot:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const a = new MB.AIRich(conn).setTitle('Bot information'); a.addTable([['Item','Value'],['Name',conn.user?.name || '-'],['JID',conn.user?.id || '-'],['Node.js',process.version],['Platform',process.platform]]); return await a.send(m.chat) }
```

**Kirim ringkasan grup:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const g = await conn.groupMetadata(m.chat); const a = new MB.AIRich(conn).setTitle('Group information'); a.addTable([['Item','Value'],['Name',g.subject || '-'],['Members',String(g.participants?.length || 0)],['JID',g.id || '-']]); return await a.send(m.chat) }
```

**Kirim daftar grup dalam teks:**

```js
=> { const groups = Object.values(await conn.groupFetchAllParticipating()); return await conn.sendMessage(m.chat, { text: groups.map((g,i) => `${i + 1}. ${g.subject}`).join('\n') || 'Tidak ada grup.' }) }
```

**Tampilkan ringkasan method yang benar-benar ada:**

```js
=> { const names = ['sendMessage','readMessages','sendPresenceUpdate','presenceSubscribe','onWhatsApp','onWhatsAppUsername','getUsernames','findUserId','groupCreate','groupMetadata','groupParticipantsUpdate','groupRequestParticipantsList','communityCreate','communityMetadata','newsletterCreate','newsletterMetadata','newsletterFollow','newsletterFetchMessages','getCatalog','getCollections','getBusinessProfile','updateProfileName','updateProfileStatus','updateBlockStatus','createCallLink','sendPrivateRelay','relayPrivateMessage']; return names.map(name => `${typeof conn[name] === 'function' ? '✓' : '—'} ${name}`) }
```

---

### Catatan kompatibilitas eval

- Method yang muncul di daftar runtime bisa saja method internal; jangan memanggilnya tanpa memahami argumennya.
- Contoh yang memakai `CHANNEL_JID`, `ID_KOMUNITAS`, `MESSAGE_ID`, `STATUS_ID`, atau `CALL_ID` adalah template dan harus diganti dengan identifier valid.
- Pengiriman media memakai URL contoh. Ganti dengan URL file yang dapat diakses WhatsApp.
- Beberapa fitur WhatsApp hanya aktif pada rollout tertentu. Jika method tersedia tetapi server mengembalikan error, itu bukan alasan untuk menambahkan method lain yang tidak ada di source.
- Eval memberi akses penuh ke proses bot. Jangan jalankan kode dari orang yang tidak dipercaya.

---

## LID and JID notes

WhatsApp may identify an account with a LID instead of a phone-number JID. This is expected in newer addressing flows. Prefer the identifiers supplied by the message and inspect alternate fields when available:

```js
const remote = message.key.remoteJid
const alternate = message.key.remoteJidAlt
const participant = message.key.participant
const participantAlt = message.key.participantAlt
```

Do not blindly replace `@lid` with `@s.whatsapp.net`; the two identifiers are not interchangeable by string substitution. Use the library's JID helpers and mapping facilities where appropriate.

## Optional media dependencies

The core package keeps image/video processing optional. Install only what your application needs.

| Package | Typical use |
|---|---|
| `sharp` | Image resize and thumbnail processing |
| `@napi-rs/image` | Alternative image processing backend |
| `jimp` | JavaScript image processing fallback |
| `fluent-ffmpeg` | FFmpeg convenience wrapper for media workflows |
| `audio-decode` | Audio decoding in supported workflows |
| `better-sqlite3` | SQLite-backed storage in applications that use it |

Examples:

```bash
npm install sharp
npm install fluent-ffmpeg
```

Installing a wrapper does not install the FFmpeg executable itself. Verify that the required binary exists in the runtime environment.

## Troubleshooting

### Pairing code does not arrive

- Use the full country code and digits only.
- Request the code after the socket is initialized.
- Do not run QR pairing and pairing-code requests concurrently.
- Check connection logs and retry with a fresh socket if the previous socket has closed.

### Session repeatedly disconnects

- Persist `creds.update` with `saveCreds`.
- Do not share one auth directory between multiple sockets.
- Reconnect only once per closed socket.
- If WhatsApp reports `loggedOut`, pair the account again.

### Media sending fails

- Check the MIME type and file path.
- Install the optional image processor required by the operation.
- Confirm FFmpeg is installed when the workflow invokes it.
- Keep temporary files available until the upload promise resolves.

### Interactive content renders differently

Interactive payloads are subject to WhatsApp client version, account rollout, and server-side validation. A successful relay does not guarantee every client renders every component identically.

### Message appears under a LID

Inspect `remoteJidAlt` and `participantAlt` if present. Avoid guessing a phone-number JID from a LID value.

## Development notes

The source is organized by responsibility:

| Directory | Responsibility |
|---|---|
| `lib/Socket/` | Socket lifecycle, chats, groups, messages, newsletters |
| `lib/MessageBuilder/` | Interactive message builders and rich response composition |
| `lib/Utils/` | Message, media, JID, and protocol utilities |
| `lib/Types/` | Shared TypeScript types and constants |
| `lib/Voip/` | VoIP core implementation |
| `lib/VoipJS/` | Higher-level call manager |
| `WAProto/` | WhatsApp protobuf definitions and generated code |

Before adding a method, check whether the socket already exposes it and whether the public type declarations include it. Keep runtime implementation and `.d.ts` signatures aligned. Protocol experiments should be clearly marked and verified against the current WhatsApp Web bundle before being treated as stable.

## Credits and license

LyncxTeams is an independent project in the Baileys ecosystem. This distribution includes work from upstream Baileys and other open-source components. Their original license files, copyright notices, and required attributions must remain intact when redistributing the project.

- Baileys upstream: [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
- Original Baileys author and early ecosystem work: adiwajshing
- Project package metadata: `@lyncxteams/baileys`
- MessageBuilder and bundled components: retain the attribution and license notices shipped with their source.

See [LICENSE](LICENSE), [NOTICE.md](NOTICE.md), and the relevant source headers for the exact terms that apply to each component. Do not remove third-party copyright or attribution notices.

---

<div align="center">
  <strong>LYNCXTEAMS · WhatsApp Multi-Device Toolkit</strong>
  <br />
  <sub>Built for developers. Respect the protocol. Preserve upstream credits.</sub>
</div>
