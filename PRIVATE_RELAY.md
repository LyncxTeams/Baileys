# Private Relay (`spr`)

Kirim pesan **grup** yang hanya bisa dibuka oleh member tertentu. Member lain tetap menerima
paketnya, tapi tidak mendapat kunci sender-key, sehingga pesan tidak terbaca di sisi mereka
(gagal dekripsi disembunyikan dengan `decrypt-fail="hide"`).

Sudah terpasang otomatis di `makeWASocket`, tidak perlu import apa pun:

```js
conn.sendPrivateRelay(jid, content, options)
conn.relayPrivateMessage(jid, message, options)   // versi mentah (proto message)
```

Juga tersedia sebagai export: `import { sPR, makePrivateRelay } from '@lyncxteams/baileys'`

---

## 1. Cara kerja singkat

| Mode | Arti |
|------|------|
| `exclude` (default) | Semua dapat kunci **kecuali** jid di `target` |
| `include` | **Hanya** jid di `target` yang dapat kunci |

---

## 2. Opsi

| Opsi | Tipe | Default | Keterangan |
|------|------|---------|------------|
| `mode` | `"include"` \| `"exclude"` | `"exclude"` | Lihat tabel di atas |
| `target` | `string[]` | `[]` | JID (PN `@s.whatsapp.net` atau `@lid`). Boleh `jid:device` untuk device tertentu |
| `targetMe` | `boolean` | otomatis | `true`/`false` memaksa device bot sendiri ikut/tidak |
| `deviceMode` | `"all"` \| `"primary"` \| `"secondary"` | `"all"` | Batasi ke HP utama / device tertaut saja |
| `hideDecryptFail` | `boolean` | `true` | Sembunyikan notifikasi "menunggu pesan" di sisi yang tidak dapat kunci |
| `messageId` | `string` | auto | ID pesan kustom |
| `quoted` | message | - | Reply seperti `sendMessage` biasa |
| `mentions`, dll. | - | - | Semua opsi `generateWAMessage` ikut diteruskan |

`content` sama persis dengan `conn.sendMessage` (`{ text }`, `{ image }`, `{ poll }`, dst).

---

## 3. Contoh siap eval (`=>`)

Contoh memakai `m.chat` (jid grup) dan `m.sender` (pengirim perintah).

**Hanya pengirim yang bisa baca**
```js
=> conn.sendPrivateRelay(m.chat, { text: 'Rahasia, cuma kamu yang lihat' }, { mode: 'include', target: [m.sender] })
```

**Semua bisa baca kecuali satu orang**
```js
=> conn.sendPrivateRelay(m.chat, { text: 'Halo semua' }, { mode: 'exclude', target: ['628123456789@s.whatsapp.net'] })
```

**Hanya beberapa orang**
```js
=> conn.sendPrivateRelay(m.chat, { text: 'Khusus admin' }, { mode: 'include', target: ['628111@s.whatsapp.net', '628222@s.whatsapp.net'] })
```

**Hanya member yang di-mention / reply**
```js
=> conn.sendPrivateRelay(m.chat, { text: 'Cek ini' }, { mode: 'include', target: m.mentionedJid || [] })
```

**Hanya admin grup**
```js
=> (async () => { const meta = await conn.groupMetadata(m.chat); const admins = meta.participants.filter(p => p.admin).map(p => p.id); return conn.sendPrivateRelay(m.chat, { text: 'Khusus admin' }, { mode: 'include', target: admins }) })()
```

**Kirim gambar privat + reply**
```js
=> conn.sendPrivateRelay(m.chat, { image: { url: 'https://example.com/a.jpg' }, caption: 'Privat' }, { mode: 'include', target: [m.sender], quoted: m })
```

**Hanya device utama (HP) target**
```js
=> conn.sendPrivateRelay(m.chat, { text: 'Cuma HP utama' }, { mode: 'include', target: [m.sender], deviceMode: 'primary' })
```

**Bot sendiri tidak ikut menerima kunci**
```js
=> conn.sendPrivateRelay(m.chat, { text: 'tes' }, { mode: 'include', target: [m.sender], targetMe: false })
```

**Versi mentah (proto message sendiri)**
```js
=> conn.relayPrivateMessage(m.chat, { extendedTextMessage: { text: 'raw' } }, { mode: 'include', target: [m.sender] })
```

---

## 4. Catatan

- Fungsi ini **khusus grup** (`@g.us`). Untuk chat pribadi, filter `target` hanya memilih device mana yang dienkripsi.
- Pesan yang dikirim ke jid biasa/newsletter tetap berjalan, tapi mode include/exclude tidak berpengaruh di newsletter.
- `target` boleh PN atau LID; lookup LID ↔ PN dilakukan otomatis lewat `signalRepository.lidMapping`.
- Metadata grup diambil dari `cachedGroupMetadata` (jika diset di config), lalu fallback ke `groupMetadata`.
- Token laporan (`reporting_token`) memakai implementasi asli Baileys (`reporting-utils`), jadi pesan tetap
  bisa diverifikasi WhatsApp seperti pesan biasa. Fungsi `deriveReportingTag` lama dari `spr.js` (token
  non-standar dengan konstanta XOR) **tidak dibawa**.
- Jika hasilnya tidak sesuai, coba `await conn.resetGroupSenderKey(m.chat)` agar kunci grup didistribusikan ulang.
