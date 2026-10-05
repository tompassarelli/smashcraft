# #26 capture with clean CustomMapData folders — 6 October 2026

**Match 1: with about 70 files in each CustomMapData folder, client A no
longer fell behind real time.** Its journal receipts trailed its game clock by
at most 0.28 s, and B's by at most 0.33 s. In the batch-6 sweep match (94,000
files per folder), A's trailed by 0.96 s and B's by 0.28 s. A's highest
one-second echo mean was 246 ms, against 1,284 ms in the sweep. **Match 2
still saturated, now on both clients.** From its 13th second, both clients'
echo rose together to 0.9–1.2 s.

**The capture did not finish, so there is no #26 table.** After match 2
ended, the capture's player-view check failed on both clients: "a hit spark
stayed in view for 4.00 s; it should be gone within 3.00 s" (ImpactDust,
240 frames without a break, lifetime 180). The capture stopped before
exporting match 2's response pages and before writing capture.json, so
`bun wisp parity result` could not run (result.log). As instructed, there was
one capture and no rerun.

## Session

- Source: smashcraft `cd79353`. The integrity build (`typescript-integrity`,
  journal/editbox, pool-predicted, d0/r24) was built with the 0.0.45 guide's
  inputs (build.log): 9.75 s, 304 entries. Map SHA-256
  `d237068abd8af29c09687f7835d46a7d3615b1e1fa79a93c3379b825a583a3b4`,
  private under ~/.local/share/smashcraft-build-inputs/integrity-clean-folders-20261006/.
- Helper `wc3-journal-0.0.45`, SHA-256
  `d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3`, the same
  bytes as the sweep's `wc3-journal-0.0.43`.
- `bun wisp fresh MAP --no-quick` (fresh.log), then
  `bun wisp parity capture --helper … --build typescript-integrity --out DIR --app-id a=steam_app_3516115571 --app-id b=steam_app_3516115572 --first-epoch 1`
  at the default batch 6, with no chat commands (capture.log).
- CustomMapData before the capture held 71 files on A and 63 on B, and 102
  and 94 after it (customdata-files.txt).

## Results

Receipt lag uses the network-model lane's method (lag-analysis.ts). Each helper
`editbox_receipt` is matched to the I4 row it consumed. The lag is the
receipt's wall time minus the game's native send time for that frame (the
response pages' D rows), relative to the first receipt. Run on the sweep's
batch-6 capture, this script reproduces that lane's A 0.96/1.06 s and B
0.28/0.24 s (baseline-b6.txt). Match 2 has no response pages, so its lag
cannot be computed this way. The frame/60 variant in analysis.txt is not the
same quantity: it also counts the workload's deliberate pause and prediction
stalls.

| | Match 1: A | Match 1: B | Match 2: A | Match 2: B |
| --- | --- | --- | --- | --- |
| Receipt lag vs own game clock, max (final), s | 0.28 (0.08) | 0.33 (0.08) | not measured | not measured |
| Sweep batch 6 (94k files), same method, s | 0.96 (0.11) | 0.28 (−0.02) | 1.06 (0.90) | 0.24 (0.08) |
| Echo, median of per-second means (lowest–highest), ms | 132.7 (84.6–245.8) | 133.7 (69.6–588.6) | 161.4 (102.6–1206.3) | 148.6 (108.4–1226.1) |
| Sweep batch 6 echo, ms | 148.0 (89.9–1284.0) | 77.6 (65.8–298.9) | 151.2 (109.8–1632.0) | 106.0 (76.3–229.4) |
| Warcraft CPU over the match, median (max) % of one core | 105 (249) | 104 (177) | 93 (156) | 110 (186) |

Per-second echo means are in local-echo.txt. In match 2 both clients held
100–180 ms for 12 s, then rose together: A to 507, 797, 1100 and 1206 ms,
and B to 519, 897, 1226 and 1164 ms. CPU was sampled once a second from
/proc for each Warcraft process (cpu.txt). Each process used about one core
(medians 93–110%), with peaks at 1.6–2.5 cores. The machine has 24 logical
CPUs. A and B used about the same CPU in both matches.

Player views at both match starts passed. Match 1's result scene check
passed too.
