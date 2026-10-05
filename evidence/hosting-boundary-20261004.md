# Controlled hosting: current delivery boundary

Observed 4 October 2026, 06:50–06:53 Taipei. No native controlled-host match has
been established. Keep the Battle.net comparison labeled Battle.net.

**Recommendation:** finish the current native Battle.net input experiment while
retaining the controlled host for a client with a demonstrated compatible join
interface. Do not replace the retained clients with Classic or claim that the
public FLO developer website provides ordinary custom-map admission. The current
blocking seam is native client admission, before any hosting latency comparison.

## Runnable host and exact candidate

The existing MPL-2.0 fork executable at
`~/code/gowarcraft3/worktrees/smashcraft-host/bin/w3gshost` successfully opened the
actual 0.0.19 map, derived four human slots, listened on loopback TCP 6113,
reported its slots, and exited cleanly on `quit`. No host remains running.

```sh
~/code/gowarcraft3/worktrees/smashcraft-host/bin/w3gshost \
  -map ~/.local/share/smashcraft-build-inputs/production-netcode-20261004/build/'Smashcraft 0.0.19.w3x' \
  -listen 127.0.0.1:6113 -name 'Smashcraft 0.0.19 controlled' \
  -turn-rate 40 -version 10032
```

Keep stdin open. Commands are `slots`, `start`, `quit`. `start` requires joined
players with complete maps and a measured ping. The host derives map metadata;
there are no manually substituted map checksums.

Observed archive: 33,816,865 bytes; SHA256
`246ce77febd0ac5cece16b43a3b530bc33eb6910917982ec2e5255f6dcbb2e80`;
SHA1 `17e40347e7d9b94011d58a5a2164a9cd1beef868`; derived XOR `9f9adf95`.
Configured batch interval: 25 ms. This is host configuration and a map-loading
check, not native joining, end-to-end latency or competitive evidence.

**There is no verified join procedure for the retained Reforged 3.0 clients.**
The command advertises mDNS using its configured wire discovery version, then
accepts W3GS TCP joins. `10032` is the old library default, not the measured
identifier of Warcraft 3.0. Existing research in
`smashcraft:docs/netcode-proposal.md` records that Reforged 3.0 removed the LAN UI
and a separate Classic client retains it. No native main-menu inspection or
Classic setup was performed by this hosting task. Changing a discovery number
cannot establish a missing client join interface. Do not sign out or restart
healthy clients merely to test that guess.

For a demonstrated LAN-capable client, the intended procedure is to advertise
its observed discovery version, open its LAN browser, join the exact advertised
name in each client, verify host `ready` and map-complete events, then enter
`start` on the host. This conditional procedure is not current-client proof.

## Official FLO access is a separate boundary

Fresh read-only requests found:

- https://w3flo.com/setup displays: “This website is a developer tool and has no
  use for you without permissions.” It asks for Battle.net sign-in, connection to
  a local FLO worker and then connection to the server. This is a current served
  page, independently consistent with historical source.
- https://w3flo.com/api/get-player-info returned HTTP 400, `accessToken is
  required`, for an unauthenticated read. No authenticated custom-map creation
  or permission denial was attempted, so no claim is made that Tom's accounts
  lack permission. Existing Battle.net game authentication alone does not prove
  this distinct service session exists.
- No TCP listener existed at the historical worker port 3551 in the observed
  environment. The historical web UI connects to `ws://127.0.0.1:3551` by default.
- The official launcher release API reports 1.6.15, published 28 September 2026,
  with Windows and macOS assets. It provides no Linux asset in that release.
  This does not prove Wine incompatibility. No launcher was installed into the
  live game prefixes, and no ordinary W3Champions custom-map access was proven.

Historical `flo-webui:components/GameLobby/GameViewCreated.tsx` explicitly shows
a “LAN game name”. Historical `flo-2022:crates/client/src/lan/game/mod.rs` starts
an mDNS publisher and a local LAN proxy to FLO. Those components therefore do
not establish a replacement join mechanism in current Reforged.

## What hosting and equalization actually change

Source inspection of the existing implementations, not a measurement of the
current official service:

- `gowarcraft3:network/lobby/game.go` queues received `GameAction` bytes and
  broadcasts common `TimeSlot` batches at its configured frequency. It pauses
  batches when its lagger list is nonempty. The implementation does not parse
  `BlzSendSyncData` calls or enforce a map-sync calls-per-second quota there.
- `flo-2022:crates/node/src/game/host/dispatch.rs` similarly receives opaque
  `OutgoingAction` payloads, queues them and broadcasts common action ticks.
  It has action packet size/fragment handling and outer synchronization/lag
  handling. Those controls are not evidence of a Warcraft-native sync quota.
- `flo-2022:crates/node/src/constants.rs` defaults action ticks to 30 ms;
  `FLO_GAME_STEP_MS` configures them. The historical action clock clamps the
  requested step to at least 15 ms. These values do not establish script timer,
  render or physical input rates.
- `flo-2022:crates/node/src/game/host/delay.rs` divides an added delay by two and
  applies it to incoming and outgoing traffic. The historical `!delay` command
  accepts 0 to remove delay or 25–100 ms in a release build. Ordered queued
  traffic is preserved by its queue. This is manual per-player traffic delay,
  not evidence that an automatic equalizer is active today.
- `flo-webui:pages/api/create-game.ts` accepts an equalizer field in its schema
  but does not include that field in its constructed create request. Public
  controller protocol fields alone do not prove ordinary-lobby equalization.

Example of the intended tradeoff: if the measured routes are 20 ms and 80 ms RTT,
adding 60 ms to the faster route can equalize the route budgets. In this historical
implementation that means approximately 30 ms per direction. It makes the faster
route slower; it does not remove 60 ms from the slower route. Real one-way
asymmetry, jitter, batch alignment and game presentation still need measurement.

A different host can change server placement, routes, batching and per-player
traffic delay. It cannot reconstruct an input never captured, correct a wrong
original-frame tag, or by itself change the native engine's internal capture or
sync submission policy. Because the host receives opaque action payloads after
the client emits them, these source files cannot identify a pre-emission stall
inside Warcraft. **No packet quota or cause of the 4.78-second plateau was
established by this task.**

Source revisions retained read-only: FLO 98c2a3bf9538abfbea6140bc4b65b8603c1676b6;
web UI 8286abdca62d521d953902122b97f60729e2908f. Host fork based on
GoWarcraft3 f13251b6caed199c3347214f4591e7ccaa96c7c7, with previously authored
uncommitted hosting/parser changes retained. No external implementation was
copied or modified in this task. No displays, prefixes or game processes were
changed.
