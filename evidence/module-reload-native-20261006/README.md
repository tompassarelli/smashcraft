# Hot reload ×10 with module-level deltas, wisp#13 — 6 October 2026

**Pass: median 0.432 s from save to both clients running the new code**
(min 0.394 s, max 0.559 s, n = 10; target ≤ 0.5 s). Each sample sent one
changed module of 169: about 19 KB of 1.25 MB. All six paired confirmed
checksums were equal on both clients in every sample, both clients
acknowledged the same apply clock, and the new marker showed in both traces.
The same procedure with whole-bundle publishes had a median of 0.841 s
(smashcraft:evidence/reload-speed-native-20261006/).

## Setup

- Source: smashcraft `ab05b1d` (playable-ts-20261005 with Wisp 8666714, not
  yet published). A main-profile map (build `typescript-dev`) was built with
  the 0.0.46 inputs (build.log): 8.20 s, 304 entries. Map SHA-256
  `3f8de9fc51eb19cbb821b3e4cbb93b7619b7e4721be531b042af3692c6bcb806`
  (38,579,938 bytes), private under
  ~/.local/share/smashcraft-build-inputs/module-reload/.
- It was the only map in `Maps/00-Smashcraft` on both clients; 0.0.46 moved
  to `smashcraft-replaced-maps` with its bytes unchanged. CustomMapData held
  75 (A) and 73 (B) entries.
- `bun wisp fresh MAP` put both clients in a quick match in 28.4 s. Its
  player-view check passed: on both clients "1 stage deck piece drawn; 1 of
  267 effects in view across 25 models", with the stage in 49 rows (A) and
  47 rows (B) (fresh.log).
- `bun wisp hot --data A --data B --watch` ran for all edits (wisp.log). Its
  version counter continued from earlier state in `smashcraft-hot`, so the
  cold full publish was v12: 169 of 169 modules, 1,254,436 bytes, running
  in both clients after 7.16 s. That publish is not a sample.

## Procedure

reload-driver.ts, ten times, one second apart:

1. Ctrl+T on A starts an input trace on both clients.
2. 0.4 s later, save a new marker (`module-reload-N`) at the end of the
   `confirmed frame` trace line in smashcraft:ts/src/platform/shell/diagnostics.ts.
3. Wait for `vN running in 2 client(s)`.
4. Read both `smashcraft-hot-ack-pN.txt`: "applied N at T".
5. Wait for both 300-frame traces, pair their confirmed checksums by frame,
   and check the marker.

The source was restored afterwards. The watcher published that as v23:
0.521 s, one module. The watcher printed no error or desync line.

## Samples

"Wisp step" is the first number on the `vN running in 2 client(s)` line,
from change detection to both acknowledgements. "Save → report" is the
driver's time from writing the file to reading that line. Each publish line
read `1 of 169 module(s), 19185 of 1254461 bytes, 8 file(s)`, give or take
1–2 bytes for the marker's length. Per-sample frames, checksums and lines
are in reload.json and driver.log.

| Sample | Version | Wisp step, s | Save → report, ms | Equal checksum pairs | Frames | Apply clock, both |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | v13 | 0.559 | 567 | 6/6 | 3350–3649 | 43.33594 |
| 2 | v14 | 0.444 | 450 | 6/6 | 3731–4030 | 49.55469 |
| 3 | v15 | 0.437 | 448 | 6/6 | 4113–4412 | 55.90625 |
| 4 | v16 | 0.394 | 399 | 6/6 | 4496–4795 | 62.25 |
| 5 | v17 | 0.418 | 426 | 6/6 | 4878–5177 | 68.64844 |
| 6 | v18 | 0.426 | 433 | 6/6 | 5260–5559 | 75.01562 |
| 7 | v19 | 0.453 | 458 | 6/6 | 5643–5942 | 81.41406 |
| 8 | v20 | 0.395 | 399 | 6/6 | 6024–6323 | 87.71094 |
| 9 | v21 | 0.402 | 410 | 6/6 | 6406–6705 | 94.10938 |
| 10 | v22 | 0.454 | 460 | 6/6 | 6790–7089 | 100.5312 |
| **Median** | | **0.432** | **441** | | | |
