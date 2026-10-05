# Hot reload by module, host side, with fake clients — 6 October 2026

**Save → both acknowledgements: 374 ms median before, 181 ms after**
(n = 10 edits each; two fake clients). A typical edit now sends 19,165 bytes
(1 of 169 modules) instead of the whole 1.23 MB bundle.

This measures the host's share only. The fake clients answer as soon as their
files appear and do no Lua work, and no synchronized answer travels. The native
two-client figure (0.841 s before, smashcraft:evidence/reload-speed-native-20261006/)
also includes each client's polling, file reads, Lua work and Battle.net's
synchronized answers.

## Setup

- Smashcraft `cd79353`, main profile (`tsconfig.map.json`), ts/ of the
  `module-reload-20261006` lane. The edit target is the `confirmed frame` trace line of
  smashcraft:ts/src/platform/shell/diagnostics.ts, as in the native procedure.
- Before: Wisp `d20668a` (whole-bundle reloads), the pin at `cd79353`.
- After: Wisp `8666714` (module reloads, `4c56852`, plus reused resolved
  requires and number-rule scans), installed with `bun run update:wisp`.
- Driver: fake-reload.ts in this folder, run from ts/ with
  `bun ../evidence/module-reload-host-20261006/fake-reload.ts 10` through
  the machine-capacity helper. It starts `bun wisp hot --data A --data B --watch`
  on two empty temporary CustomMapData folders, waits for the first (cold)
  publish, then saves 10 marker edits 300 ms apart. Each fake client polls its
  hot folder every 2 ms, reads the files the manifest names (the delta when
  its installed state is the base) and writes its acknowledgement. "Save →
  acks" is the driver's time from writing the file to reading the
  `vN running in 2 client(s)` line.

## Results

| | Before | After |
| --- | --- | --- |
| Save → both acks, median [min–max] | 374 ms [300–410] | 181 ms [158–232] |
| `compile` step's own time, last 5 edits | 0.249–0.353 s | 0.135–0.157 s |
| Bytes a client reads per edit | 1,230,769 (7 files) | 19,239 (1 file) |
| Published per edit | 1,230,249 bytes | 19,165-byte delta + 1,253,395-byte full payload |

Raw lines: before.log and after.log (each edit's driver time, its watcher
step lines and the bytes the first fake client read).

The same edit's client compute in 32-bit Lua 5.3.6, from the full and delta
payload files the host writes (median of 15): full payload 123 ms (hash 80,
load 39), delta 5.5 ms (link and module scope 3.4).
