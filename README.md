

## Added status / message helpers

Semua helper di bawah sudah diekspor dan bisa dipakai langsung dari `conn`/import Baileys. Untuk eval, contoh paling sederhana:

```js
await conn.sendNewsletterStatus('123456789@newsletter', { text: 'Halo' })
await conn.sendNewsletterStatus('123456789@newsletter', { image: media, caption: 'Foto' })
await conn.sendNewsletterStatusReaction('123456789@newsletter', 123, '❤️')
await conn.revokeNewsletterStatus('123456789@newsletter', 'MESSAGE_ID')
await conn.getNewsletterStatuses('123456789@newsletter')
await conn.getNewsletterStatusUpdates('123456789@newsletter')

await conn.sendMessage(m.chat, { text: 'Question', ...makeQuestionMessage({ text: 'Pertanyaan' }) })

const sticker = stickerArea({ x: 0.25, y: 0.4, width: 0.5, height: 0.2 })
const link = linkSticker({ url: 'https://example.com', title: 'Open' })
const location = locationSticker({ latitude: -7.25, longitude: 112.75, name: 'Surabaya' })
const channel = channelSticker({ jid: '123456789@newsletter', name: 'Channel', serverMessageId: 123 })
const music = musicSticker({ songId: 'SONG_ID', title: 'Song', author: 'Artist' })
const message = messageSticker({ stanzaId: 'MESSAGE_ID', message: { conversation: 'Quoted' } })

const musicMessage = buildMusicMessage({
  songId: 'SONG_ID',
  title: 'Song',
  author: 'Artist',
  songUri: 'https://mmg.whatsapp.net/song',
  artworkUri: 'https://mmg.whatsapp.net/artwork'
})

await conn.sendMessage(m.chat, { ...musicMessage })
```

`generateMessageIDV2()` tetap menggunakan format sederhana `FuadXyro:XXXXXXXX` dengan suffix random.
