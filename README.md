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

Bagian ini khusus untuk command `eval` pada bot. Semua contoh di bawah memakai objek yang biasanya sudah tersedia di runtime bot:

| Variabel | Isi |
|---|---|
| `conn` | Socket WhatsApp yang sudah login dari LyncxTeams Baileys. |
| `m` | Pesan yang memicu command eval. |
| `m.chat` | JID chat tempat command dikirim. |
| `m.sender` | JID pengirim command. |
| `m.key` | Kunci pesan WhatsApp yang sedang diproses. |

Salin **satu contoh saja** ke eval. Tanda `=>` adalah awalan eval, bukan bagian dari JavaScript biasa. Contoh yang memakai `import()` mengambil builder/helper langsung dari paket `@lyncxteams/baileys`, jadi tidak perlu menambahkan import di file plugin.

> [!IMPORTANT]
> Jalankan eval hanya pada bot dan akun yang kamu kelola. Contoh yang mengubah pengaturan grup, profil, privasi, atau channel benar-benar mengirim perubahan ke WhatsApp. Pastikan target dan izin akun sudah benar sebelum menjalankannya.

### 1. Socket dan informasi akun

**Lihat seluruh informasi akun bot:**

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

**Lihat status koneksi WebSocket** (`1` biasanya berarti koneksi terbuka):

```js
=> conn.ws?.readyState
```

### 2. Mengirim pesan

**Kirim teks:**

```js
=> await conn.sendMessage(m.chat, { text: 'Hello from LyncxTeams' })
```

**Kirim teks sambil membalas pesan command:**

```js
=> await conn.sendMessage(m.chat, { text: 'Ini pesan balasan.' }, { quoted: m })
```

**Kirim pesan dengan mention pengirim:**

```js
=> await conn.sendMessage(m.chat, { text: `Halo @${m.sender.split('@')[0]}`, mentions: [m.sender] })
```

**Kirim emoji reaction ke pesan command:**

```js
=> await conn.sendMessage(m.chat, { react: { text: '⚡', key: m.key } })
```

**Hapus reaction dari pesan command:**

```js
=> await conn.sendMessage(m.chat, { react: { text: '', key: m.key } })
```

**Edit pesan yang sebelumnya dikirim bot** (ganti `MESSAGE_ID` dengan ID pesan bot):

```js
=> await conn.sendMessage(m.chat, { text: 'Teks yang sudah diperbarui', edit: { remoteJid: m.chat, fromMe: true, id: 'MESSAGE_ID' } })
```

**Kirim lokasi:**

```js
=> await conn.sendMessage(m.chat, { location: { degreesLatitude: -6.200000, degreesLongitude: 106.816666, name: 'Jakarta' } })
```

**Kirim polling:**

```js
=> await conn.sendMessage(m.chat, { poll: { name: 'Pilih salah satu', values: ['Pilihan A', 'Pilihan B', 'Pilihan C'], selectableCount: 1 } })
```

### 3. Mengirim media

**Kirim gambar dari URL:**

```js
=> await conn.sendMessage(m.chat, { image: { url: 'https://example.com/image.jpg' }, caption: 'Contoh gambar' })
```

**Kirim video dari URL:**

```js
=> await conn.sendMessage(m.chat, { video: { url: 'https://example.com/video.mp4' }, caption: 'Contoh video' })
```

**Kirim audio dari URL:**

```js
=> await conn.sendMessage(m.chat, { audio: { url: 'https://example.com/audio.mp3' }, mimetype: 'audio/mpeg' })
```

**Kirim audio sebagai voice note:**

```js
=> await conn.sendMessage(m.chat, { audio: { url: 'https://example.com/audio.ogg' }, mimetype: 'audio/ogg; codecs=opus', ptt: true })
```

**Kirim dokumen:**

```js
=> await conn.sendMessage(m.chat, { document: { url: 'https://example.com/file.pdf' }, mimetype: 'application/pdf', fileName: 'document.pdf' })
```

**Kirim stiker dari URL WebP:**

```js
=> await conn.sendMessage(m.chat, { sticker: { url: 'https://example.com/sticker.webp' } })
```

> [!NOTE]
> URL media pada contoh hanya placeholder. Ganti dengan URL file yang benar-benar bisa diakses. Pemrosesan media tertentu membutuhkan backend opsional seperti `sharp` atau FFmpeg sesuai jenis medianya.

### 4. Membaca pesan dan kontak

**Lihat struktur pesan yang memicu eval:**

```js
=> m
```

**Lihat key pesan:**

```js
=> m.key
```

**Lihat tipe konten pesan:**

```js
=> { const { getContentType } = await import('@lyncxteams/baileys'); return getContentType(m.message) }
```

**Ambil isi pesan berdasarkan tipe kontennya:**

```js
=> { const { getContentType } = await import('@lyncxteams/baileys'); const type = getContentType(m.message); return { type, content: m.message?.[type] } }
```

**Tandai pesan command sebagai sudah dibaca:**

```js
=> await conn.readMessages([m.key])
```

**Ambil foto profil pengirim:**

```js
=> await conn.profilePictureUrl(m.sender, 'image')
```

**Periksa nomor/JID melalui WhatsApp:**

```js
=> await conn.onWhatsApp(m.sender)
```

**Periksa username WhatsApp:**

```js
=> await conn.onWhatsAppUsername('username')
```

**Ambil status/About pengirim:**

```js
=> await conn.fetchStatus(m.sender)
```

**Ambil profil bisnis pengirim jika tersedia:**

```js
=> await conn.getBusinessProfile(m.sender)
```

### 5. Grup WhatsApp

Contoh pada bagian ini menggunakan `m.chat` sebagai target grup. Jalankan di dalam grup yang benar.

**Ambil metadata grup:**

```js
=> await conn.groupMetadata(m.chat)
```

**Lihat nama, deskripsi, dan jumlah anggota grup:**

```js
=> { const g = await conn.groupMetadata(m.chat); return { id: g.id, subject: g.subject, desc: g.desc, participants: g.participants?.length } }
```

**Ambil daftar seluruh grup yang diikuti bot:**

```js
=> await conn.groupFetchAllParticipating()
```

**Ambil nama semua grup:**

```js
=> Object.values(await conn.groupFetchAllParticipating()).map(g => g.subject)
```

**Ambil kode undangan grup:**

```js
=> await conn.groupInviteCode(m.chat)
```

**Buat tautan undangan grup:**

```js
=> `https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}`
```

**Lihat permintaan bergabung yang masih menunggu:**

```js
=> await conn.groupRequestParticipantsList(m.chat)
```

**Lihat pengaturan metadata grup:**

```js
=> { const g = await conn.groupMetadata(m.chat); return { announce: g.announce, restrict: g.restrict, memberAddMode: g.memberAddMode, joinApprovalMode: g.joinApprovalMode } }
```

**Ubah nama grup:**

```js
=> await conn.groupUpdateSubject(m.chat, 'Nama Grup Baru')
```

**Ubah deskripsi grup:**

```js
=> await conn.groupUpdateDescription(m.chat, 'Deskripsi grup baru')
```

**Aktifkan mode hanya admin yang bisa mengirim pesan:**

```js
=> await conn.groupSettingUpdate(m.chat, 'announcement')
```

**Kembalikan agar semua anggota bisa mengirim pesan:**

```js
=> await conn.groupSettingUpdate(m.chat, 'not_announcement')
```

**Aktifkan pesan sementara 7 hari:**

```js
=> await conn.groupToggleEphemeral(m.chat, 7 * 24 * 60 * 60)
```

**Nonaktifkan pesan sementara:**

```js
=> await conn.groupToggleEphemeral(m.chat, 0)
```

**Keluar dari grup saat ini:**

```js
=> await conn.groupLeave(m.chat)
```

### 6. Privasi dan profil akun

**Lihat pengaturan privasi akun bot:**

```js
=> await conn.fetchPrivacySettings(true)
```

**Lihat daftar akun yang diblokir:**

```js
=> await conn.fetchBlocklist()
```

**Lihat durasi pesan sementara pada chat:**

```js
=> await conn.fetchDisappearingDuration(m.chat)
```

**Lihat foto profil bot:**

```js
=> await conn.profilePictureUrl(conn.user.id, 'image')
```

**Ubah nama profil bot:**

```js
=> await conn.updateProfileName('Nama Bot Baru')
```

**Ubah About/status profil bot:**

```js
=> await conn.updateProfileStatus('Available')
```

**Ubah privasi Last Seen menjadi kontak:**

```js
=> await conn.updateLastSeenPrivacy('contacts')
```

**Ubah privasi foto profil menjadi kontak:**

```js
=> await conn.updateProfilePicturePrivacy('contacts')
```

**Ubah privasi Status menjadi kontak:**

```js
=> await conn.updateStatusPrivacy('contacts')
```

**Ubah privasi tanda dibaca:**

```js
=> await conn.updateReadReceiptsPrivacy('all')
```

> [!WARNING]
> Perintah profil dan privasi di atas mengubah akun bot yang sedang login, bukan akun pengirim command. Nilai privasi yang diterima WhatsApp dapat berubah mengikuti versi server.

### 7. Newsletter / WhatsApp Channel

Ganti `CHANNEL_JID` dengan JID channel yang valid dan kamu kelola atau ikuti.

**Ambil metadata channel:**

```js
=> await conn.newsletterMetadata('jid', 'CHANNEL_JID')
```

**Ambil status channel:**

```js
=> await conn.getNewsletterStatuses('CHANNEL_JID')
```

**Ambil pembaruan status channel:**

```js
=> await conn.getNewsletterStatusUpdates('CHANNEL_JID')
```

**Ambil daftar subscriber channel:**

```js
=> await conn.newsletterSubscribers('CHANNEL_JID')
```

**Ikuti channel:**

```js
=> await conn.newsletterFollow('CHANNEL_JID')
```

**Berhenti mengikuti channel:**

```js
=> await conn.newsletterUnfollow('CHANNEL_JID')
```

**Kirim teks status ke channel:**

```js
=> await conn.sendNewsletterStatus('CHANNEL_JID', { text: 'Update dari LyncxTeams' })
```

**Beri reaction pada status channel:**

```js
=> await conn.sendNewsletterStatusReaction('CHANNEL_JID', STATUS_SERVER_ID, '❤️')
```

> [!CAUTION]
> Mengirim status, mengikuti/berhenti mengikuti channel, dan memberi reaction adalah tindakan nyata pada akun WhatsApp. `STATUS_SERVER_ID` harus diganti dengan ID status yang valid dari hasil fetch.

### 8. MessageBuilder terintegrasi

Builder harus diimpor dari paket LyncxTeams. Semua contoh berikut mengirim pesan baru ke chat tempat command eval dijalankan.

**Button quick reply:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const msg = new MB.Button(conn).setTitle('LyncxTeams Menu').setBody('Pilih salah satu menu.').setFooter('LyncxTeams').addReply('Ping', 'ping').addReply('Menu', 'menu'); return await msg.send(m.chat) }
```

**Button URL dan copy code:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const msg = new MB.Button(conn).setTitle('Useful Links').setBody('Pilih tindakan.').addUrl('Buka Website', 'https://example.com').addCopy('Salin Kode', 'LYNCX-2026'); return await msg.send(m.chat) }
```

**Button dengan gambar:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const msg = new MB.Button(conn).setImage('https://example.com/image.jpg').setTitle('LyncxTeams').setBody('Button dengan header gambar.').addReply('Lanjut', 'continue'); return await msg.send(m.chat) }
```

**ButtonV2:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const msg = new MB.ButtonV2(conn).setTitle('LyncxTeams').setBody('Pilih menu.').addButton('Menu', 'menu').addButton('Ping', 'ping'); return await msg.send(m.chat) }
```

**List / selection:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const msg = new MB.Button(conn).setTitle('Daftar Menu').setBody('Pilih salah satu.').addSelection('Buka daftar').makeSection('Menu Utama').makeRow('', 'Profil', 'Lihat profil bot', 'profile').makeRow('', 'Runtime', 'Lihat runtime', 'runtime'); return await msg.send(m.chat) }
```

**AIRich teks:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const rich = new MB.AIRich(conn).setTitle('LyncxTeams'); rich.addText('Halo! Ini pesan AIRich dari eval.'); return await rich.send(m.chat) }
```

**AIRich kode:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const rich = new MB.AIRich(conn).setTitle('JavaScript Example'); rich.addCode('js', "const name = 'LyncxTeams'\nconsole.log(name)"); return await rich.send(m.chat) }
```

**AIRich tabel:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const rich = new MB.AIRich(conn).setTitle('Runtime Info'); rich.addTable([['Property', 'Value'], ['Node.js', process.version], ['Platform', process.platform]]); return await rich.send(m.chat) }
```

**AIRich map:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const rich = new MB.AIRich(conn).setTitle('Map Preview'); rich.addMap([{ latitude: -6.200000, longitude: 106.816666, title: 'Jakarta', body: 'Example location' }]); return await rich.send(m.chat) }
```

**Carousel dua kartu:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const a = await new MB.Button(conn).setImage('https://example.com/one.jpg').setBody('Kartu pertama').addReply('Pilih', 'one').toCard(); const b = await new MB.Button(conn).setImage('https://example.com/two.jpg').setBody('Kartu kedua').addUrl('Buka', 'https://example.com').toCard(); const carousel = new MB.Carousel(conn).setBody('Contoh carousel').addCard([a, b]); return await carousel.send(m.chat) }
```

### 9. Helper dan utilitas

**Periksa dukungan native-flow untuk Web:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); return MB.isWebSupportedButtonName('quick_reply') }
```

**Periksa batas native-flow button:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); return MB.checkNativeFlowButtons([{ name: 'quick_reply' }]) }
```

**Periksa apakah `sharp` tersedia:**

```js
=> { const { hasOptionalMedia } = await import('@lyncxteams/baileys'); return await hasOptionalMedia('sharp') }
```

**Periksa apakah FFmpeg wrapper tersedia:**

```js
=> { const { hasOptionalMedia } = await import('@lyncxteams/baileys'); return await hasOptionalMedia('fluent-ffmpeg') }
```

**Ambil buffer dari URL:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); return await MB.Toolkit.fetchBuffer('https://example.com/image.jpg') }
```

### 10. Pengalamatan LID / PN

**Lihat seluruh key pengirim dan chat:**

```js
=> ({ remoteJid: m.key.remoteJid, remoteJidAlt: m.key.remoteJidAlt, participant: m.key.participant, participantAlt: m.key.participantAlt, sender: m.sender })
```

**Lihat apakah pengirim menggunakan LID atau PN JID:**

```js
=> ({ sender: m.sender, isLid: m.sender?.endsWith('@lid'), isPn: m.sender?.endsWith('@s.whatsapp.net') })
```

Jangan mengubah string `@lid` menjadi `@s.whatsapp.net` secara manual. Keduanya adalah identifier berbeda; gunakan mapping/helper LID dari library jika memang perlu mencari pasangan identifier.

### 11. Contoh gabungan

**Kirim ringkasan akun bot menggunakan AIRich:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const rich = new MB.AIRich(conn).setTitle('Bot Information'); rich.addTable([['Item', 'Value'], ['Name', conn.user?.name || '-'], ['JID', conn.user?.id || '-'], ['Node.js', process.version], ['Platform', process.platform]]); return await rich.send(m.chat) }
```

**Kirim ringkasan grup menggunakan AIRich:**

```js
=> { const { MB } = await import('@lyncxteams/baileys'); const g = await conn.groupMetadata(m.chat); const rich = new MB.AIRich(conn).setTitle('Group Information'); rich.addTable([['Item', 'Value'], ['Name', g.subject || '-'], ['Members', String(g.participants?.length || 0)], ['JID', g.id || '-']]); return await rich.send(m.chat) }
```

**Kirim daftar nama grup menggunakan pesan teks:**

```js
=> { const groups = Object.values(await conn.groupFetchAllParticipating()); return await conn.sendMessage(m.chat, { text: groups.map((g, i) => `${i + 1}. ${g.subject}`).join('\n') || 'Tidak ada grup.' }) }
```

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
