# Alternate host preflight, 5 October 2026

Observed 22:25 Taipei. The existing host opened the TypeScript integrity
diagnostic, derived four human slots, listened on loopback TCP 6113, answered
`slots`, and exited with status 0 on `quit`. A subsequent listener check showed
TCP 6113 free. No Warcraft client input, restart, installation, or authentication
change was performed. No real client joined, so this observation does not
establish an alternative-host match or an input-delay improvement.

Host: `~/code/gowarcraft3/worktrees/smashcraft-host/bin/w3gshost`, SHA256
`62a1aa45b31ce7b38f7ee6e0dff6ac513724102f2b391fb053cda78338f4ea9a`.
Existing host source is based on GoWarcraft3
`f13251b6caed199c3347214f4591e7ccaa96c7c7`, MPL-2.0, with retained
hosting/parser changes. This trial changed none of that source.

Map: `~/.local/share/smashcraft-build-inputs/build-port-20261005/build/Smashcraft diagnostic ts-integrity-r1.w3x`,
34,338,683 bytes, SHA256
`816293dee60eec35bd696374808b579b699cc3e58720dc9c0718432143f85eff`.
Host-derived archive SHA1 `0fc578d2c71464d4841ce0dcce3dd3cfb589ad6a`;
derived XOR `3a7467a0`. This is a preflight artifact, not a designation of the
candidate to use for the matched Battle.net comparison.

## Executed command

```sh
~/code/gowarcraft3/worktrees/smashcraft-host/bin/w3gshost \
  -map ~/.local/share/smashcraft-build-inputs/build-port-20261005/build/'Smashcraft diagnostic ts-integrity-r1.w3x' \
  -listen 127.0.0.1:6113 -name 'Smashcraft alternate host preflight' \
  -turn-rate 40 -version 10032
```

Standard input was retained in a terminal. The resulting host log was:

```text
2026/10/05 22:25:00.274659 hosting="Smashcraft alternate host preflight" listen=127.0.0.1:6113 map="Smashcraft diagnostic ts-integrity-r1" bytes=34338683 sha1=0fc578d2c71464d4841ce0dcce3dd3cfb589ad6a xoro=3a7467a0 slots=4 version=10032 batch=25ms
2026/10/05 22:25:00.274838 commands: start, slots, quit
2026/10/05 22:25:04.427709 slots=&{Slots:[{PlayerID:0 DownloadStatus:255 SlotStatus:Open Computer:false Team:0 Color:0 Race:Human ComputerType:Easy Handicap:100} {PlayerID:0 DownloadStatus:255 SlotStatus:Open Computer:false Team:0 Color:1 Race:Human ComputerType:Easy Handicap:100} {PlayerID:0 DownloadStatus:255 SlotStatus:Open Computer:false Team:0 Color:2 Race:Human ComputerType:Easy Handicap:100} {PlayerID:0 DownloadStatus:255 SlotStatus:Open Computer:false Team:0 Color:3 Race:Human ComputerType:Easy Handicap:100}] RandomSeed:1077127082 SlotLayout:CustomForces NumPlayers:4}
```

## Native admission procedure

The native client operator owns this procedure. Retain both signed-in clients
and the current network route. Do not restart a healthy client or install a
launcher into its prefix to try a guessed admission method.

1. Warm-leave the current map through the established Quit Mission / Back
   procedure and inspect the actual main-menu join choices. Record the game
   build and whether a LAN / Local Area Network browser exists. If absent,
   the local host has no established admission route for these retained
   clients: preserve that native observation and stop this path.
2. If a LAN browser exists, recover its actual discovery version from a
   client-originated discovery request. The `10032` above is the old library
   default, not a measured identifier for the current clients. Do not infer
   it from the displayed game patch number.
3. Start the same host command with the fixed #26 candidate map and that
   measured discovery version, retaining its terminal and full host log.
   Select the exact advertised lobby in both clients. Require two host
   `joined player` records, complete map states, and `ready player` records.
   An empty browser alone does not prove protocol incompatibility; preserve
   the client discovery request and host advertisement if this boundary fails.
4. Enter `start` only after both clients are ready. Require both clients to
   enter and finish the same match. Then run the existing #26 capture and
   reconciler, with the same map hash, helper, input workload, window and
   batch parameters as the Battle.net baseline. Compare the generated
   opponent-lateness and rollback-depth distributions; host batch settings
   are not substitutes for those measurements.
5. Enter `quit`, retain the host exit status, and verify TCP 6113 is free.
   No detached host is needed.

The bounded native result belongs to issue #19. The comparison is permitted
to begin while #26 is open under the operator's superseding scheduling
instruction; its fixed-candidate comparison requirements remain binding.

## FLO admission evidence

Read-only checks on 5 October found that `https://w3flo.com/setup` still states
“This website is a developer tool and has no use for you without permissions.”
It requires separate Blizzard sign-in, local-worker connection and server
connection. No service authentication or custom-map permission was attempted;
this is not a finding that Tom's accounts are denied access.

The current public launcher release is
`w3champions/launcher-e-release` 1.6.15, published 28 September 2026, with
Windows and macOS assets and no Linux asset. This does not establish Wine
incompatibility. The public older `w3champions/launcher` README marks it
deprecated. `w3champions/flo` returned HTTP 404. These read-only observations
do not provide a verified current custom-map admission interface, and no
external source was copied or used to derive an implementation.

The earlier retained source and service observations are in
`smashcraft:evidence/hosting-boundary-20261004.md`. The former link to
`smashcraft:docs/hosting-boundary-20261004.md` predates its move to evidence.
