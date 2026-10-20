# Baileys Lyncx — VoIP & VoipJS

Dokumentasi ini membedakan **dua implementasi VoIP** yang tersedia di source:

- **`lib/Voip/` — Voip (WASM/RTC client)**: API inti `VoipClient`, memakai socket WhatsApp yang sudah login. Tidak membuat sesi atau QR sendiri.
- **`lib/VoipJS/` — VoipJS (high-level call manager)**: API `Voip` untuk mengelola panggilan, media, incoming call, batas panggilan, serta guard frekuensi.

> Keduanya bukan nama lain untuk file yang sama. API, parameter, dan cara inisialisasinya berbeda. Periksa dependency media/native yang dibutuhkan source sebelum menjalankan fitur audio/video.

---

## 1. Voip Core

### Fungsi
Voip Core menyediakan client panggilan yang terhubung ke socket Baileys yang sudah login. Ini bukan sistem pairing/QR terpisah.

### Import

```js
import VoipClient, {
  makeVoipClient,
  AudioFeeder,
  VideoFeeder,
  VIDEO_FORMAT_I420
} from './lib/Voip/index.js'
```

Sesuaikan jalur import dengan cara package kamu mengekspor API tersebut.

### Membuat client

```js
import { makeVoipClient } from './lib/Voip/index.js'

const voip = await makeVoipClient(conn, {
  debug: true,
  logger: (...args) => console.log('[Voip]', ...args)
})
```

`conn` harus merupakan socket Baileys yang sudah terautentikasi dan koneksinya sudah terbuka.

Alternatif dengan lifecycle manual:

```js
import VoipClient from './lib/Voip/index.js'

const voip = new VoipClient({
  socket: conn,
  debug: true
})

await voip.connect()
```

### Panggilan keluar

```js
await voip.call('628123456789', {
  durationMs: 30000,
  audioSource: 'silence'
})
```

Nomor tersebut hanya contoh. `durationMs` mengatur durasi sesuai implementasi client, sedangkan `audioSource` harus memakai sumber yang didukung versi source yang digunakan.

### Lifecycle

```js
await voip.connect()

// Gunakan socket baru setelah Baileys reconnect:
await voip.attach(newConn)

// Saat client tidak digunakan:
voip.disconnect()
```

Jika socket Baileys berganti setelah reconnect, hubungkan client ke socket baru sesuai lifecycle di atas. Jangan menganggap client otomatis mengikuti socket baru.

### Catatan
- `makeVoipClient(socket, config)` membuat client dan menjalankan `connect()`.
- Konfigurasi client menerima socket melalui properti `socket`, `sock`, atau `conn`.
- `AudioFeeder`, `VideoFeeder`, dan `VIDEO_FORMAT_I420` tersedia sebagai ekspor pada implementasi yang mendukungnya.
- Hindari membuat beberapa client yang mengendalikan socket/call yang sama tanpa memahami lifecycle-nya.

---

## 2. VoipJS Call Manager

### Fungsi
VoipJS menyediakan API tingkat tinggi untuk mengelola panggilan, event panggilan masuk, media, serta batas pemakaian.

### Import

```js
import Voip from './lib/VoipJS/index.js'
```

Sesuaikan jalur import dengan ekspor package yang benar-benar tersedia.

### Membuat manager

```js
import Voip from './lib/VoipJS/index.js'

const voipJS = new Voip(conn, {
  maxConcurrentCalls: 1,
  maxCallsPerHour: 3,
  maxCallsPerDay: 8,
  minIntervalMs: 300000,
  voipLogLevel: 'warn',
  ffprobePath: 'ffprobe',
  allowedNumbers: []
})
```

`conn` harus berupa socket/koneksi yang didukung oleh adapter VoipJS versi kamu.

Opsi utama:
- `maxConcurrentCalls`: batas panggilan aktif bersamaan.
- `maxCallsPerHour`: batas panggilan per jam.
- `maxCallsPerDay`: batas panggilan per hari.
- `minIntervalMs`: jeda minimum antarpanggilan dalam milidetik.
- `allowedNumbers`: daftar nomor yang diizinkan; isi sesuai kebutuhan.
- `voipLogLevel`: tingkat detail log.
- `ffprobePath`: lokasi executable `ffprobe`.
- `tmpDir`: direktori sementara opsional.

### Mendengarkan panggilan masuk

```js
await voipJS.listen()

voipJS.onIncoming(info => {
  console.log('Incoming call:', {
    callId: info.callId,
    jid: info.jid,
    isVideo: info.isVideo,
    canAccept: info.canAccept
  })
})
```

`onIncoming` menerima informasi panggilan masuk. Gunakan `callId` dari event tersebut untuk mengelola panggilan yang bersangkutan.

### Menjawab atau menolak panggilan

Signature yang digunakan implementasi:

```js
await voipJS.accept(callId, media, resolution, options)
await voipJS.reject(callId, reason)
```

Kerangka penggunaan:

```js
await voipJS.accept(callId, media, resolution, {})
```

Atau:

```js
await voipJS.reject(callId, 'declined')
```

`media` dan `resolution` harus mengikuti format yang didukung engine media pada versi source kamu. Jangan menggunakan parameter contoh dari Voip Core untuk VoipJS secara langsung.

### Panggilan keluar

Signature:

```js
await voipJS.call(jid, media, resolution, options)
```

Kerangka:

```js
await voipJS.call(
  '628123456789',
  media,
  resolution,
  {}
)
```

Nomor hanya contoh; `media` dan `resolution` harus disesuaikan dengan engine media yang digunakan.

### API pengelolaan panggilan

```js
voipJS.calls
voipJS.maxConcurrentCalls

voipJS.on('event-name', listener)
voipJS.off('event-name', listener)

await voipJS.acceptCall(callId)
await voipJS.rejectCall(callId, reason)
await voipJS.hangup(callId)
await voipJS.end()
```

`calls` menyediakan daftar panggilan yang dikelola. Gunakan nama event yang benar-benar dikeluarkan oleh versi implementasi kamu.

### Catatan
- Mulai dengan satu panggilan aktif untuk pengujian.
- Pertahankan batas frekuensi panggilan.
- Pastikan dependency media yang dibutuhkan tersedia di lingkungan runtime.
- Gunakan fitur panggilan hanya dengan izin penerima.

---

## 3. Perbedaan cepat

| Aspek | `Voip/` | `VoipJS/` |
|---|---|---|
| API utama | `VoipClient`, `makeVoipClient` | `Voip` |
| Level | Client/core | Manager tingkat tinggi |
| Inisialisasi | Socket Baileys yang sudah login | `new Voip(conn, opts)` |
| Call keluar | `voip.call(phoneNumber, opts)` | `voipJS.call(jid, media, resolution, options)` |
| Incoming | Handler di client/signaling | `listen()`, `onIncoming()`, `incoming` |
| Guard panggilan | Tidak ditunjukkan sebagai opsi manager pada API inti | Allowlist, interval, batas per jam/hari, concurrency |
| Media | Feeder audio/video dan WASM engine | Media engine/relay dan API manager |
| QR/pairing | Tidak membuat sesi kedua | Tidak dimaksudkan membuat sesi kedua |

---

## 4. Troubleshooting

1. **`socket has no websocket yet`**  
   Tunggu sampai `connection.update` menunjukkan `connection: 'open'`, baru panggil `connect()`.

2. **`VoipClient needs the socket you are already logged in with`**  
   Pastikan objek socket diberikan saat membuat client.

3. **Target/LID gagal di-resolve**  
   Periksa nomor tujuan dan dukungan mapping LID/PN pada sesi Baileys yang digunakan.

4. **VoipJS gagal saat menerima `media` atau `resolution`**  
   Periksa bentuk parameter di `#launch`, `types.js`, serta engine media. Jangan langsung menyalin contoh dari `Voip/`, karena API-nya berbeda.

5. **Reconnect**  
   Gunakan socket baru hasil reconnect. Untuk `VoipClient`, panggil `attach(newConn)` sesuai lifecycle di source. Untuk VoipJS, periksa lifecycle client/coordinator pada versi yang digunakan sebelum membuat manager baru.

---

## 5. Penting

README ini menjelaskan API dan struktur yang terlihat di source repository. Implementasi VoIP dapat bergantung pada protokol WhatsApp yang berubah, dependency media, runtime, serta dukungan server. Jalankan tes pada akun/perangkat yang kamu kontrol, dan jangan menganggap contoh kerangka sebagai jaminan panggilan akan berhasil di semua versi.


---

## 5. Eval Tests (CylicVoip & CylicVoipJS)

Jalankan potongan berikut melalui eval bot dengan prefix `=>`. Tes ini memeriksa ekspor modul dan inisialisasi client; tidak melakukan panggilan sungguhan. Sesuaikan path import jika nama package atau ekspor di project berbeda.

### 5.1 Cek export Voip Core

```js
=> (async () => {
  const mod = await import('@whiskeysockets/baileys/lib/Voip/index.js')
  return {
    exports: Object.keys(mod),
    defaultExport: typeof mod.default,
    makeVoipClient: typeof mod.makeVoipClient,
    AudioFeeder: typeof mod.AudioFeeder,
    VideoFeeder: typeof mod.VideoFeeder
  }
})()
```

### 5.2 Cek export VoipJS

```js
=> (async () => {
  const mod = await import('@whiskeysockets/baileys/lib/VoipJS/index.js')
  return {
    exports: Object.keys(mod),
    defaultExport: typeof mod.default,
    Voip: typeof mod.default
  }
})()
```

### 5.3 Inisialisasi CylicVoip

```js
=> (async () => {
  if (!conn?.user) throw new Error('Socket Baileys belum login')
  const { makeVoipClient } = await import('@whiskeysockets/baileys/lib/Voip/index.js')
  if (!conn.ws || conn.ws.readyState !== 1) throw new Error('WebSocket belum terbuka')
  conn.cylicVoip ??= await makeVoipClient(conn, {
    debug: true,
    logger: (...args) => console.log('[CylicVoip]', ...args)
  })
  return 'CylicVoip berhasil diinisialisasi'
})()
```

### 5.4 Inisialisasi CylicVoipJS

```js
=> (async () => {
  if (!conn?.user) throw new Error('Socket Baileys belum login')
  if (!conn.ws || conn.ws.readyState !== 1) throw new Error('WebSocket belum terbuka')
  const Voip = (await import('@whiskeysockets/baileys/lib/VoipJS/index.js')).default
  conn.cylicVoipJS ??= new Voip(conn, {
    maxConcurrentCalls: 1,
    maxCallsPerHour: 3,
    maxCallsPerDay: 8,
    minIntervalMs: 300000,
    voipLogLevel: 'debug'
  })
  return 'CylicVoipJS berhasil dibuat'
})()
```

### 5.5 Periksa status instance

```js
=> ({
  socketLogin: !!conn?.user,
  websocket: conn?.ws?.readyState,
  cylicVoip: !!conn?.cylicVoip,
  cylicVoipJS: !!conn?.cylicVoipJS
})
```

Nilai `websocket` bernilai `1` biasanya menunjukkan WebSocket terbuka.

### 5.6 Bersihkan instance tes

Jalankan hanya jika tidak ada panggilan aktif. Nama method cleanup harus cocok dengan implementasi yang dipakai.

```js
=> (async () => {
  if (conn.cylicVoip) {
    await conn.cylicVoip.disconnect()
    delete conn.cylicVoip
  }
  if (conn.cylicVoipJS) {
    await conn.cylicVoipJS.end()
    delete conn.cylicVoipJS
  }
  return 'Instance VoIP tes dibersihkan'
})()
```

**Catatan penting:** nama export, constructor, dan method dapat berbeda antarversi. Jika muncul `ERR_MODULE_NOT_FOUND`, `is not a constructor`, atau `... is not a function`, jalankan tes export terlebih dahulu dan sesuaikan dengan API yang benar-benar diekspor package. Jangan menjalankan kedua client untuk mengendalikan panggilan yang sama secara bersamaan sebelum kompatibilitasnya dipastikan.
