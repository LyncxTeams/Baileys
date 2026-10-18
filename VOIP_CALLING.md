# Outbound WhatsApp VoIP

This build bundles the VoIP engine, signaling, relay transport, audio/video feeders, worker bootstrap, and WhatsApp WASM resources.

The public API is exported from `lib/Voip/index.js`.

Requirements: Node.js 20+ and `ffmpeg` for media feeder features.

## Anti-ban guard (default ON)

`VoipClient.call()` refuses risky calls:

- Target bebas by default. `allowedNumbers` bersifat opsional: kalau diisi, hanya nomor itu yang boleh dipanggil.
- Max `maxCallsPerHour` (3), `maxCallsPerDay` (8), min `minIntervalMs` (300000) between calls.
- Duration capped by `maxDurationMs` (60000).
- Call is cancelled if the TC token is empty (target should have chatted with the bot number first).

```js
const voip = await makeVoipClient(sock); // atau { allowedNumbers: ['62812xxxxxxx'] } untuk membatasi target
```

Use a spare number for testing. No client-side setting can guarantee a WhatsApp account will not be banned.

## VoipJS (pure JavaScript, no WASM)

Ported from the HIROBOT VoIP module into `lib/VoipJS`. It uses this package's own Baileys (no separate `baileys` install needed):

```js
import { CylicVoipJs } from '@lyncxteams/baileys'

const voip = new CylicVoipJs(sock) // opts: maxConcurrentCalls, ffprobePath, tmpDir, maxCallsPerHour, ...
await voip.call('62812xxxxxxx', 'https://example.com/audio.mp3', '720p') // URL or local path
```

`loadVoipJS()` still works if you prefer lazy loading: `const { default: Voip } = await loadVoipJS()`.

Requires Node 20+ and `ffmpeg`/`ffprobe` in PATH. The same anti-ban guard applies (3 calls/hour, 8/day, 5 min interval; `allowedNumbers` optional).
