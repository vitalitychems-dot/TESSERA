# LAN peer connection

Two browser tabs on one machine can talk without a public STUN or TURN server.

1. Open `http://127.0.0.1` in the first tab. That tab hosts the local signaling URL, `/api/rtc`.
2. Open the same origin in a second tab.
3. Both tabs use an empty ICE server list, so only host candidates on the LAN are offered.

A public signaling URL is refused. This note does not enable a feature flag.
