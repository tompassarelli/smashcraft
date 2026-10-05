# Preloader caching and hot reload, 5 October 2026

Map: `Smashcraft diagnostic hot-r4` (fast TypeScript rebuild of the hot-r4
build), loaded as game `hot-r5` on two signed-in clients, at character
selection.

## Preloader cache probe

A temporary line in the demo tick read `smashcraft-hot-cacheprobe.pld` through
`Preloader` every 0.5 s and wrote what it read to the observe file. The host
then changed that file:

| Host action | Map read |
|---|---|
| file absent | (nothing) |
| created with `one` | `one` |
| rewritten as `two` (same size) | `one` |
| deleted | (nothing) |
| created with `alpha` | `one` |
| rewritten as `three-longer-text` | `one` |
| deleted, then created with `beta` | `one` |

Preloader checks on every call whether the file exists. It runs the content it
first read from that path for the rest of the session, whatever the file holds
later.

## Hot reload, two-phase protocol

Content-addressed chunk files, per-version manifests and all-clients-ready
install. Times are from smashcraft:ts/scripts/hot.ts: TypeScript edit saved to
acknowledgement files from both clients.

- 21 of 21 published versions installed in both clients (v1-v22, except v8,
  which replaced the reloader itself and was installed by the previous one).
  v9-v11 ran before the tool could parse the timed acknowledgements, so they
  weren't timed.
- Edits v13-v22 with a warm compiler: 976, 1131, 1145, 1167, 1171, 1202, 1236,
  1274, 1322 and 1412 ms. The median is 1187 ms. Compiling took 316-659 ms,
  writing the files 92-130 ms, and the clients 551-754 ms.
- Each client stamped its install with game time from a timer started on a
  synchronized frame: v9 0.0078125 s, v10 11.57031 s, v11 23.03125 s and v22
  68.78125 s, identical in both clients.
- The demo tick counter (state in a global) continued across every reload: tick
  365 after v22.
- The tool restarted between v11 and v12 and continued numbering from the
  manifests on disk.

The earlier single-manifest design installed v1 and then never another
version. That is what led to this probe.
