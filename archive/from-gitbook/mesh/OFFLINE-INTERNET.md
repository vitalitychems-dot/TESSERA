# Offline Internet

When the network is down, Tessera still answers from pages already carried in the git mesh.

- The file index searches those pages and marks each hit `live: false`.
- Writes wait in a local queue and replay once the link returns.
- The app shell is cached so the studio opens with no network.
- A badge shows offline, waiting, or online.
- Neighbors on the same machine sync signed pages. A USB bundle can carry the same bytes.
- A local Kiwix server is optional and stays off until an owner points it at a localhost URL.

This page does not enable a feature flag, and it does not add wallets or payments.
