# Baileys - Extended Status & Message API

Baileys ini mempertahankan API utama dan menambahkan helper yang tersedia di build ini.
Contoh di bawah dibuat untuk langsung dipakai dengan `await conn.****` atau import dari `@whiskeysockets/baileys`.

## Status Text

### Status dengan font dan warna

```js
import { StatusFont } from '@whiskeysockets/baileys'

await conn.sendMessage('status@broadcast', {
  text: 'Halo semua'
}, {
  statusJidList,
  backgroundColor: '#7C3AED',
  textColor: '#FFFFFF',
  font: StatusFont.CALISTOGA_REGULAR
})
```

`statusJidList` berisi JID penerima status. Opsi warna dan font diteruskan ke status message.

## Status Media

```js
await conn.sendMessage('status@broadcast', {
  image: { url: './liburan.jpg' },
  caption: 'Weekend'
}, {
  statusJidList
})
```

```js
await conn.sendMessage('status@broadcast', {
  video: { url: './video.mp4' },
  caption: 'Video status'
}, {
  statusJidList
})
```

```js
await conn.sendMessage('status@broadcast', {
  audio: { url: './audio.mp3' },
  mimetype: 'audio/mpeg',
  ptt: true
}, {
  statusJidList,
  backgroundColor: '#7C3AED'
})
```

## Newsletter / Channel Status

Semua API berikut tersedia sebagai method socket.

```js
await conn.sendNewsletterStatus(
  '123456789@newsletter',
  { text: 'Halo dari Channel' }
)
```

```js
await conn.sendNewsletterStatus(
  '123456789@newsletter',
  { image: { url: './foto.jpg' }, caption: 'Foto baru' }
)
```

### Reaction

```js
await conn.sendNewsletterStatusReaction(
  '123456789@newsletter',
  123,
  '❤️'
)
```

### Revoke / hapus status

```js
await conn.revokeNewsletterStatus(
  '123456789@newsletter',
  'STATUS_ID'
)
```

### Fetch status

```js
const statuses = await conn.getNewsletterStatuses(
  '123456789@newsletter'
)
```

### Fetch status updates

```js
const updates = await conn.getNewsletterStatusUpdates(
  '123456789@newsletter'
)
```

Newsletter status juga menyediakan parsing response/ACK, server ID, attribution, media type, dan status update secara internal.

## Status Sticker Helpers

Helper sticker yang tersedia:

```js
import {
  stickerArea,
  locationSticker,
  channelSticker,
  linkSticker,
  musicSticker,
  messageSticker,
  StatusLinkType
} from '@whiskeysockets/baileys'
```

### Area

```js
const area = stickerArea({
  x: 0.1,
  y: 0.72,
  width: 0.5,
  height: 0.1
})
```

### Location sticker

```js
const sticker = locationSticker({
  latitude: -6.2088,
  longitude: 106.8456,
  name: 'Jakarta',
  area: {
    x: 0.1,
    y: 0.72,
    width: 0.5,
    height: 0.1
  }
})
```

### Channel sticker

```js
const sticker = channelSticker({
  jid: '123456789@newsletter',
  name: 'Channel Saya',
  serverMessageId: 123
})
```

### Link sticker

```js
const sticker = linkSticker({
  url: 'https://example.com',
  title: 'Buka website',
  linkType: StatusLinkType.RASTERIZED_LINK_FULL_URL
})
```

### Music sticker

```js
const sticker = musicSticker({
  songId: 'SONG_ID',
  title: 'Song',
  author: 'Artist'
})
```

### Message sticker

```js
const sticker = messageSticker({
  stanzaId: 'MESSAGE_ID',
  message: {
    conversation: 'Pesan yang dirujuk'
  }
})
```

> Helper sticker di atas tersedia sebagai builder/annotation. `sendMessage()` pada build ini belum menambahkan field `statusStickers` sebagai opsi publik, jadi jangan memakai `statusStickers: [...]` sebelum API tersebut ditambahkan ke jalur `sendMessage`. cape bro /* cylic

## Music Message

```js
import {
  buildMusicMessage,
  MusicMessageStyle
} from '@whiskeysockets/baileys'

const music = buildMusicMessage({
  songId: 'SONG_ID',
  title: 'Song',
  author: 'Artist',
  songUri: 'https://mmg.whatsapp.net/song',
  artworkUri: 'https://mmg.whatsapp.net/artwork',
  style: MusicMessageStyle.VINYL
})

await conn.sendMessage(m.chat, music)
```

Host musik dapat divalidasi dengan:

```js
import { isMusicHostAllowed } from '@whiskeysockets/baileys'

await isMusicHostAllowed('https://mmg.whatsapp.net/song')
```

## Question / Poll-style Message

```js
import {
  makeQuestionMessage,
  makeQuestionReplyMessage,
  makeQuestionResponseMessage
} from '@whiskeysockets/baileys'
```

```js
const question = makeQuestionMessage({
  text: 'Pilih menu favorit kamu'
})

await conn.sendMessage(m.chat, question)
```

```js
const reply = makeQuestionReplyMessage({
  text: 'Pilihan saya A',
  serverQuestionId: 123
})

await conn.sendMessage(m.chat, reply)
```

```js
const response = makeQuestionResponseMessage({
  key: quotedKey,
  text: 'A'
})

await conn.sendMessage(m.chat, response)
```

## Modern Message

```js
import { prepareModernMessageContent } from '@whiskeysockets/baileys'

const content = prepareModernMessageContent({
  text: 'Modern message'
})
```

Helper modern message juga mencakup status question answer, status quoted, status mention, status sticker interaction, status notification, comment, event invite, scheduled call, dan association message.

## Status Interaction Helpers

```js
import {
  makeStatusAddYoursAssociation,
  makeStatusQuotedMessage,
  makeStatusMentionMessage,
  makeStatusQuestionAnswerMessage,
  makeStatusStickerInteractionMessage
} from '@whiskeysockets/baileys'
```

Contoh:

```js
const quoted = makeStatusQuotedMessage({
  originalStatusId: statusKey,
  text: 'Status yang dibalas'
})
```

```js
const mention = makeStatusMentionMessage({
  key: statusKey
})
```

```js
const answer = makeStatusQuestionAnswerMessage({
  key: statusKey,
  text: 'Jawaban'
})
```

```js
const addYours = makeStatusAddYoursAssociation(statusKey)
```

## Comment Message

```js
import { makeCommentMessage } from '@whiskeysockets/baileys'

const comment = makeCommentMessage({
  targetMessageKey: statusKey,
  content: {
    text: 'Komentar'
  }
})
```

## Event Invite

```js
import { makeEventInviteMessage } from '@whiskeysockets/baileys'

const event = makeEventInviteMessage({
  eventId: 'EVENT_ID',
  eventTitle: 'Acara',
  startTime: Date.now() + 3600000,
  caption: 'Sampai ketemu'
})

await conn.sendMessage(m.chat, event)
```

## Scheduled Message

Helper encode/decode scheduled message tersedia:

```js
import {
  encodeScheduledMessage,
  decodeScheduledMessage
} from '@whiskeysockets/baileys'

const scheduled = encodeScheduledMessage({
  conversation: 'Pesan terjadwal'
})

const decoded = decodeScheduledMessage(
  scheduled.message.conditionalRevealMessage,
  scheduled.revealKey
)
```

Scheduled call juga tersedia:

```js
import {
  makeScheduledCallCreationMessage,
  makeScheduledCallEditMessage
} from '@whiskeysockets/baileys'
```