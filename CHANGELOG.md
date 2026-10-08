# Changelog

## 2.4.0

- Hardened pairing-code lifecycle so requests wait for WhatsApp pairing readiness.
- Rejects pairing-code requests on already-registered sockets.
- Normalizes phone input and prevents concurrent pairing-code requests.
- Expanded call processing to handle bundled call nodes instead of silently dropping later children.
- Added voice/video/group detection, caller metadata, reason and latency fields to call events.
- Preserved call metadata between offer and follow-up call states.
- Kept the existing Baileys socket API compatible with the fork.
