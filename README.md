# Lyncx Baileys — VoIP & VoipJS

Dokumentasi ringkas modul panggilan pada `lib/Voip` dan `lib/VoipJS`.

> Catatan: kedua modul punya API berbeda. `Voip` memakai `VoipClient`/`makeVoipClient`, sedangkan `VoipJS` memakai class default `Voip` dengan koneksi Baileys yang sudah ada. Pastikan nama export dan path mengikuti versi paket yang sedang dipakai.

## Struktur

- `lib/Voip/index.js` — client VoIP, panggilan personal/grup, status panggilan, audio/video queue.
- `lib/Voip/audio-feeder.js` — sumber audio.
- `lib/Voip/video-feeder.js` — sumber video.
- `lib/Voip/signaling.js` — signaling panggilan.
- `lib/Voip/relay-transport.js` — transport relay.
- `lib/VoipJS/index.js` — API tingkat lebih tinggi untuk melakukan/menerima panggilan.
- `lib/VoipJS/voipClient.js` dan `WaVoipCoordinator.js` — client dan koordinasi signaling.
- Subfolder `media`, `relay`, `crypto`, `call`, dan `signaling` — implementasi media dan protokol internal.

## 1. Voip — `lib/Voip`

### Import

```js
import { makeVoipClient } from '@whiskeysockets/baileys/lib/Voip/index.js'
```

### Membuat client dan melakukan panggilan

```js
const voip = await makeVoipClient(conn)
await voip.connect()

const call = await voip.call('6281234567890', {
  durationMs: 30000
})

call.on('state', state => {
  console.log('Status panggilan:', state)
})

// Akhiri panggilan ketika diperlukan
call.end()
voip.disconnect()
```

Ganti nomor contoh dengan nomor tujuan yang memang berhak dihubungi. Format nomor/JID harus sesuai dengan implementasi paket.

### Panggilan dengan sumber audio

```js
const voip = await makeVoipClient(conn)
await voip.connect()

const call = await voip.call('6281234567890', {
  audioSource: './media/audio.ogg',
  durationMs: 30000
})

// Memasukkan sumber audio tambahan ke antrean
call.enqueue('./media/audio-lanjutan.ogg')

// Lihat jumlah antrean
console.log(call.queued())

// Akhiri panggilan
call.end()
```

### Panggilan grup

```js
const voip = await makeVoipClient(conn)
await voip.connect()

const call = await voip.callGroup('120363000000000000@g.us', {
  participants: ['6281234567890@s.whatsapp.net']
})
```

Contoh grup dan peserta di atas adalah placeholder. Periksa format JID serta dukungan panggilan grup pada versi yang digunakan.

## 2. VoipJS — `lib/VoipJS`

`VoipJS` menyediakan wrapper dengan API seperti `listen()`, `call()`, `accept()`, `reject()`, dan `hangup()`. Modul ini menerima objek koneksi Baileys yang sudah dibuat.

### Import dan mulai mendengarkan event

```js
import Voip from '@whiskeysockets/baileys/lib/VoipJS/index.js'

const voip = new Voip(conn, {
  maxConcurrentCalls: 1,
  maxCallsPerHour: 3,
  maxCallsPerDay: 8,
  minIntervalMs: 300000,
  voipLogLevel: 'warn'
})

await voip.listen()
voip.onIncoming(invite => {
  console.log('Panggilan masuk:', invite)
})
```

### Melakukan panggilan

```js
const call = await voip.call(
  '6281234567890@s.whatsapp.net',
  './media/audio.ogg',
  undefined,
  {}
)

console.log('Panggilan dibuat:', call)
```

Parameter media/resolusi dan opsi tambahan bergantung pada implementasi `VoipJS` di versi paketmu. Lihat deklarasi atau isi `lib/VoipJS/index.js` sebelum menggunakan fitur video.

### Menerima atau menolak panggilan

```js
// Mulai listener terlebih dahulu dengan await voip.listen().
voip.onIncoming(async invite => {
  // Contoh: tolak panggilan masuk secara eksplisit
  await voip.reject(invite.callId, 'busy')
})
```

Untuk menerima panggilan, gunakan `voip.accept(callId, media, resolution, options)` sesuai argumen yang didukung implementasi. Untuk mengakhiri panggilan berdasarkan ID:

```js
await voip.hangup(callId)
```

### Menutup client

```js
await voip.end()
```

Gunakan `await voip.end()` saat aplikasi benar-benar akan berhenti. Jangan membuat banyak instance listener untuk socket yang sama tanpa memahami lifecycle-nya.

## Catatan penting

1. Jalankan semua contoh di project ESM yang memiliki dependency Baileys yang sesuai.
2. Jangan menganggap `Voip` dan `VoipJS` saling dapat dipertukarkan; gunakan satu API sesuai kebutuhan dan source code versi tersebut.
3. Dukungan media bisa membutuhkan binary/dependency eksternal seperti FFmpeg atau `ffprobe`; periksa konfigurasi dan dokumentasi di source paket.
4. Jangan melakukan panggilan berulang tanpa persetujuan penerima. `VoipJS` pada source ini memiliki batas panggilan bawaan yang dapat dikonfigurasi.
5. Contoh di README ini adalah panduan awal. Uji di lingkungan pengembangan dan tangani error dengan `try/catch` sebelum dipakai di bot produksi.
