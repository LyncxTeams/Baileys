# WhatsApp Web Screenshot (`conn.wweb`)

Screenshot chat / beranda **web.whatsapp.com** lewat Chromium headless. Semua logika (login QR, buka chat,
scroll ke pesan terbaru, screenshot, auto-tutup saat idle) ada di Baileys, sehingga plugin bot hanya
beberapa baris.

> **Puppeteer tidak termasuk dependency Baileys.** Tetap dipasang di project bot:
> `npm install puppeteer` (atau `puppeteer-core` + `CHROME_PATH`).
> Baileys mencarinya di `process.cwd()` bot, atau bisa disuntik manual (lihat bawah).

## Plugin botwa (cukup ini)

```js
import puppeteer from 'puppeteer'

let handler = async (m, { conn, args, usedPrefix, command }) => {
  conn.wweb.usePuppeteer(puppeteer)          // opsional tapi paling aman
  await conn.wweb.run(m, { mode: (args[0] || 'chat').toLowerCase(), usedPrefix, command, name: conn.getName?.(m.chat) })
}
handler.command = /^(sswa|sswaweb)$/i
handler.owner = true
export default handler
```

Perintah: `.sswa` (screenshot chat ini), `.sswa home`, `.sswa login`, `.sswa reset`.

## API

| Method | Fungsi |
|--------|--------|
| `conn.wweb.run(m, { mode, usedPrefix, command, name })` | Satu panggilan penuh, balasan (QR, gambar, error) dikirim otomatis ke `m.chat`. `mode`: `chat` \| `home` \| `login` \| `reset` |
| `conn.wweb.screenshotChat(jid, { name, onQr })` | Return `Buffer` PNG chat `jid` |
| `conn.wweb.screenshotHome({ onQr })` | Return `Buffer` PNG beranda |
| `conn.wweb.login({ onQr })` | Login saja. Return `"already"` / `"ready"` |
| `conn.wweb.reset()` | Hapus sesi tersimpan |
| `conn.wweb.close()` | Tutup browser sekarang |
| `conn.wweb.usePuppeteer(pkg)` | Suntik puppeteer dari bot |

`onQr(buffer)` dipanggil saat WhatsApp Web minta scan QR (kirim sendiri sebagai gambar).

## Contoh eval (`=>`)

```js
=> conn.wweb.run(m, { mode: 'chat', name: conn.getName(m.chat) })
=> conn.wweb.run(m, { mode: 'home' })
=> conn.sendMessage(m.chat, { image: await conn.wweb.screenshotChat(m.chat), caption: 'ss' }, { quoted: m })
=> conn.wweb.reset()
```

## Konfigurasi

Lewat env atau config `makeWASocket({ ... })`:

| Env | Config | Default |
|-----|--------|---------|
| `WWEB_PROFILE` | `wwebProfile` | `./sessions-wweb` |
| `WWEB_IDLE_MS` | `wwebIdleMs` | `180000` (3 menit, lalu browser ditutup) |
| `CHROME_PATH` | `chromePath` | cari `/usr/bin/chromium`, `google-chrome`, dst |
| - | `puppeteer` | modul puppeteer yang disuntik saat membuat socket |

## Catatan

- Antrian internal: banyak perintah bersamaan dijalankan satu per satu (satu browser dibagi).
- Jika error "Chromium masih mengunci sessions-wweb", restart proses bot sepenuhnya.
- Pencarian chat memakai nama chat dan nomor. Untuk chat pribadi, kirim `name` (mis. `conn.getName(jid)`) agar akurat.
- File: `lib/Socket/wweb.js`, `lib/Socket/wweb.d.ts`, pemasangan di `lib/Socket/index.js`.
