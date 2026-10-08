# Pairing and Calls

## Pairing code

Use `requestPairingCode(phoneNumber)` only for an unregistered socket. The phone number should contain the country code. The fork also normalizes common formatting characters before sending the request.

The request now waits for the pairing challenge when called too early, blocks concurrent requests, and refuses requests after credentials are registered.

## Call events

Listen to `call` on the socket event emitter. The event keeps the existing `[call]` payload shape and now preserves metadata for voice/video, one-to-one/group calls, caller phone number, reason, and latency when supplied by WhatsApp.

Statuses currently exposed include `offer`, `preaccept`, `transport`, `relaylatency`, `accept`, `reject`, `terminate`, `timeout`, and `ringing`.
