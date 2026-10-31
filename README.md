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

These snippets are intended for a bot runtime that exposes the authenticated socket as `conn` and the current message as `m`. Paste one snippet at a time into the bot's eval command. They are not standalone Node.js scripts unless you define `conn`, `m`, and the required imports first.

### 1. Connection identity

```js
=> conn.user
```

### 2. Current bot JID

```js
=> conn.user?.id
```

### 3. Fetch a user's profile picture

```js
=> await conn.profilePictureUrl(m.sender, 'image')
```

### 4. Fetch group metadata

```js
=> await conn.groupMetadata(m.chat)
```

### 5. List participating groups

```js
=> Object.values(await conn.groupFetchAllParticipating()).map(g => ({ id: g.id, subject: g.subject, size: g.participants?.length || 0 }))
```

### 6. Read privacy settings

```js
=> await conn.fetchPrivacySettings(true)
```

### 7. Read blocked contacts

```js
=> await conn.fetchBlocklist()
```

### 8. Get disappearing-message duration

```js
=> await conn.fetchDisappearingDuration(m.chat)
```

### 9. Read business profile

```js
=> await conn.getBusinessProfile(m.sender)
```

### 10. Read newsletter metadata

```js
=> await conn.newsletterMetadata('jid', '123456789012345678@newsletter')
```

### 11. Fetch newsletter statuses

```js
=> await conn.getNewsletterStatuses('123456789012345678@newsletter')
```

### 12. Fetch newsletter status updates

```js
=> await conn.getNewsletterStatusUpdates('123456789012345678@newsletter')
```

### 13. Send a text message

```js
=> await conn.sendMessage(m.chat, { text: 'Test from LyncxTeams' })
```

### 14. Send a quoted response

```js
=> await conn.sendMessage(m.chat, { text: 'This message quotes your command.' }, { quoted: m })
```

### 15. React to the current message

```js
=> await conn.sendMessage(m.chat, { react: { text: '⚡', key: m.key } })
```

### 16. Send an interactive quick reply

```js
=> { const { Button } = await import('@lyncxteams/baileys'); const b = new Button(conn).setBody('Eval test').addButton('ok', 'Continue'); return await b.send(m.chat) }
```

### 17. Send an AIRich response

```js
=> { const { AIRich } = await import('@lyncxteams/baileys'); const r = new AIRich(conn).setTitle('LyncxTeams').setSubtitle('Eval preview'); r.addText('AIRich builder is available.'); return await r.send(m.chat) }
```

### 18. Send a code section

```js
=> { const { AIRich } = await import('@lyncxteams/baileys'); const r = new AIRich(conn).setTitle('Code sample'); r.addCode('js', "console.log('LyncxTeams')"); return await r.send(m.chat) }
```

### 19. Send a table section

```js
=> { const { AIRich } = await import('@lyncxteams/baileys'); const r = new AIRich(conn).setTitle('Runtime'); r.addTable({ headers: ['Key', 'Value'], rows: [['Node', process.version], ['Platform', process.platform]] }); return await r.send(m.chat) }
```

### 20. Send a location

```js
=> await conn.sendMessage(m.chat, { location: { degreesLatitude: -6.2, degreesLongitude: 106.8, name: 'Jakarta' } })
```

### 21. Send a temporary-message setting

```js
=> await conn.groupToggleEphemeral(m.chat, 86400)
```

### 22. Get group invite code

```js
=> await conn.groupInviteCode(m.chat)
```

### 23. Get pending join requests

```js
=> await conn.groupRequestParticipantsList(m.chat)
```

### 24. Get all group subjects

```js
=> Object.values(await conn.groupFetchAllParticipating()).map(g => g.subject)
```

### 25. Inspect a received message

```js
=> ({ key: m.key, pushName: m.pushName, messageType: Object.keys(m.message || {}) })
```

### 26. Decode the message text

```js
=> { const { getContentType } = await import('@lyncxteams/baileys'); const type = getContentType(m.message); return { type, content: m.message?.[type] } }
```

### 27. Check optional media support

```js
=> { const { hasOptionalMedia } = await import('@lyncxteams/baileys'); return hasOptionalMedia() }
```

### 28. Create a call link

```js
=> await conn.createCallLink('audio')
```

### 29. Fetch contact status

```js
=> await conn.fetchStatus(m.sender)
```

### 30. Check socket connection state

```js
=> conn.ws?.readyState
```

The eval cookbook intentionally uses read-oriented examples and ordinary message sends. Group-setting changes, participant moderation, block actions, account-link operations, and status publishing should be run only after checking the target and confirming the account has permission.

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
