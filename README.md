# Baileys Lyncx — VoIP & VoipJS

Dokumentasi ini membedakan **dua implementasi VoIP** yang tersedia di source:

- **`lib/Voip/` — Voip (WASM/RTC client)**: API inti `VoipClient`, memakai socket WhatsApp yang sudah login. Tidak membuat sesi atau QR sendiri.
- **`lib/VoipJS/` — VoipJS (high-level call manager)**: API `Voip` untuk mengelola panggilan, media, incoming call, batas panggilan, serta guard frekuensi.

> Keduanya bukan nama lain untuk file yang sama. API, parameter, dan cara inisialisasinya berbeda. Periksa dependency media/native yang dibutuhkan source sebelum menjalankan fitur audio/video.

---

## 1. Judul cepat: `lib/Voip/` — Voip Core

### Struktur utama

```text
lib/Voip/
├── index.js
├── index.d.ts
├── signaling.js
├── signaling.d.ts
├── relay-transport.js
├── wasm-engine.js
├── worker-bootstrap.js
├── audio-feeder.js
├── audio-feeder.d.ts
├── video-feeder.js
├── video-feeder.d.ts
├── types.js
└── types.d.ts
```

### Fungsi singkat

| File | Peran |
|---|---|
| `index.js` | API utama `VoipClient`, pengelolaan call, dan lifecycle |
| `signaling.js` | Signaling panggilan WhatsApp |
| `relay-transport.js` | Transport relay media |
| `wasm-engine.js` | Engine media berbasis WASM |
| `worker-bootstrap.js` | Kode worker untuk engine |
| `audio-feeder.js` | Memasok audio ke pipeline panggilan |
| `video-feeder.js` | Memasok video/screen capture ke pipeline |
| `types.js` | Definisi tipe/runtime terkait |

### Import

```js
import VoipClient, {
  makeVoipClient,
  AudioFeeder,
  VideoFeeder,
  VIDEO_FORMAT_I420
} from './lib/Voip/index.js'
```

Jika package Baileys dipasang sebagai dependency, sesuaikan path import dengan ekspor package yang benar-benar tersedia.

### Membuat client dari socket yang sudah login

```js
import { makeVoipClient } from './lib/Voip/index.js'

const voip = await makeVoipClient(conn, {
  debug: true,
  logger: (...args) => console.log('[Voip]', ...args)
})
```

`conn` harus berupa socket Baileys yang sudah terautentikasi dan WebSocket-nya sudah terbuka. API ini tidak melakukan pairing/scan QR kedua kali.

Alternatif dengan lifecycle manual:

```js
import VoipClient from './lib/Voip/index.js'

const voip = new VoipClient({
  socket: conn,
  debug: true
})

await voip.connect()
```

### Melakukan panggilan

Bentuk API yang tersedia di source `VoipClient`:

```js
await voip.call('628123456789', {
  durationMs: 30000,
  audioSource: 'silence'
})
```

- Ganti nomor contoh dengan nomor tujuan yang valid.
- `durationMs` mengatur durasi sesuai implementasi client.
- `audioSource` default pada source adalah `'silence'`; sumber audio lain harus mengikuti format yang didukung implementasi.
- Pemanggilan dapat gagal jika target/LID tidak bisa di-resolve atau signaling belum siap.

### Lifecycle koneksi

```js
await voip.connect()

// Setelah socket Baileys reconnect, sambungkan client ke socket baru:
await voip.attach(newConn)

// Saat tidak digunakan lagi:
voip.disconnect()
```

Gunakan `attach(newConn)` untuk socket hasil reconnect yang baru. Jangan menganggap instance VoIP otomatis mengikuti objek socket baru tanpa attach.

### Catatan Voip Core

- `makeVoipClient(socket, config)` membuat client lalu memanggil `connect()`.
- `VoipClient` menerima `socket`, `sock`, atau `conn` di konfigurasi.
- Jangan menjalankan dua client yang mengendalikan call/socket yang sama tanpa memahami lifecycle internalnya.
- `AudioFeeder`, `VideoFeeder`, dan `VIDEO_FORMAT_I420` diekspor dari `index.js`; detail parameter feeder lihat file deklarasi `.d.ts`.

---

## 2. Judul cepat: `lib/VoipJS/` — VoipJS Call Manager

### Struktur utama

```text
lib/VoipJS/
├── index.js
├── WaVoipCoordinator.js
├── voipClient.js
├── voip-deps.js
├── protobuf.js
├── bytes.js
├── types.js
├── signaling/
├── relay/
├── app-data/
├── crypto/
├── media/
├── call/
└── shim/
```

### Fungsi singkat

| Folder/file | Peran |
|---|---|
| `index.js` | API tingkat tinggi `Voip`, call manager, guard, dan event |
| `WaVoipCoordinator.js` | Mengatur state/event panggilan |
| `voipClient.js` | Client panggilan tingkat bawah |
| `signaling/` | Signaling dan bridge |
| `relay/` | Relay, STUN, DTLS, SCTP, dan data channel |
| `app-data/` | Stream/protokol app data |
| `crypto/` | Utilitas enkripsi dan SRTP |
| `media/` | Pipeline audio/video dan RTP |
| `call/` | State dan sesi media panggilan |
| `shim/` | Adapter untuk integrasi ke lingkungan Baileys |

### Import

```js
import Voip from './lib/VoipJS/index.js'
```

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

`conn` adalah objek koneksi yang dipakai oleh adapter VoipJS pada source ini. Pastikan bentuk socket cocok dengan integrasi yang tersedia pada versi repository kamu.

Opsi yang tampak di constructor:
- `maxConcurrentCalls`: jumlah panggilan aktif maksimum; harus integer positif.
- `maxCallsPerHour`: batas panggilan per jam (default 3).
- `maxCallsPerDay`: batas panggilan per hari (default 8).
- `minIntervalMs`: jeda minimum antarpanggilan (default 300000 ms).
- `allowedNumbers`: jika berisi nomor, target di luar daftar ditolak; daftar kosong tidak membatasi target berdasarkan allowlist.
- `voipLogLevel`: level log (default `warn`).
- `ffprobePath`: path executable `ffprobe` (default `ffprobe`).
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

`onIncoming` memberikan objek informasi panggilan. Cara menjawab/menolak tetap bergantung pada call ID dan media yang disediakan.

### Menjawab atau menolak panggilan

Signature yang tersedia di source:

```js
await voipJS.accept(callId, media, resolution, options)
await voipJS.reject(callId, reason)
```

Contoh kerangka—isi `media` dan `resolution` dengan format yang memang didukung implementasi media pada repository:

```js
const callId = 'CALL_ID_DARI_EVENT'

await voipJS.accept(
  callId,
  media,
  resolution,
  {}
)

// Atau, jika tidak ingin menjawab:
await voipJS.reject(callId, 'declined')
```

Contoh di atas sengaja tidak mengarang format `media`/`resolution`; cek implementasi `#launch`, kelas media, serta tipe di `lib/VoipJS/index.js` dan `lib/VoipJS/types.js` sebelum dipakai.

### Melakukan panggilan keluar

Signature:

```js
await voipJS.call(jid, media, resolution, options)
```

Contoh kerangka:

```js
await voipJS.call(
  '628123456789',
  media,
  resolution,
  {}
)
```

Parameter `media` dan `resolution` harus mengikuti struktur media yang diterima fungsi `#launch` pada source VoipJS. Nomor tujuan pada contoh hanya placeholder.

### Call manager lainnya

API publik yang tampak di source meliputi:

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

`calls` mengembalikan daftar call yang dikelola. Nama event yang benar harus dilihat dari event yang diemits oleh coordinator/client; jangan menebak nama event selain API `onIncoming` yang tersedia.

### Batas penggunaan

- Mulai dengan `maxConcurrentCalls: 1`.
- Pertahankan guard frekuensi untuk mencegah panggilan berulang.
- Gunakan hanya untuk panggilan yang memang diizinkan penerima.
- Jangan mematikan guard untuk mengakali limit.
- Untuk penggunaan audio/video, pastikan binary/dependency yang dibutuhkan tersedia dan dites di lingkungan target.

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

