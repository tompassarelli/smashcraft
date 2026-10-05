# #26 capture on the rematch-saturation lane — 6 October 2026

**Pass: every #26 gate passes, and the rematch no longer saturates.**
Local start − capture is 0 frames in all 198 samples; the batch-6 sweep had
p95 74 and max 91. Prediction stalls fell from 109 to 6. In the rematch,
both clients' echo stayed at 86–118 ms per second. Neither client fell
behind its game clock by more than 0.31 s in either match. No player-view
failure was recorded.

## Session

- Source: smashcraft `21e5395` (lane rematch-saturation-20261006, Wisp
  `e222aef`), built in this lane at the same commit. The integrity build
  (`typescript-integrity`, journal/editbox, pool-predicted, d0/r24) used the
  0.0.46 inputs (build.log): 8.49 s, 304 entries. Map SHA-256
  `b00b250ce0b4f257c0515872c1925bc0c6b4d4bfe4db3e538a9463912b5e4235`
  (38,582,201 bytes), private under
  ~/.local/share/smashcraft-build-inputs/rematch-saturation-20261006/.
- Helper `wc3-journal-0.0.45`, SHA-256
  `d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3`.
- CustomMapData held 75 (A) and 73 (B) entries, 129 and 121 files with
  subfolders (customdata-files.txt).
- `bun wisp fresh MAP --no-quick` (fresh.log), then one
  `bun wisp parity capture --helper … --build typescript-integrity --out DIR --app-id a=steam_app_3516115571 --app-id b=steam_app_3516115572 --first-epoch 1`
  at the default batch 6 with no chat commands. It exited 0 after 112.5 s
  (capture.log). `bun wisp parity result DIR` exited 0 (result.log).

## #26 table, match and rematch

| Metric | This run | Sweep batch 6 (30381c4, 94k-file folders) |
| --- | --- | --- |
| Edges injected per player | 648 / 648 | 648 / 648 |
| Lost / duplicated / reordered / stuck | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Applied at expected frame, both clients | 1296/1296 | 1296/1296 |
| Local start − capture, frames p50/p95/max (gate) | **0 / 0 / 0 (n=198), pass** | 0 / 74 / 91, fail |
| Opponent lateness, frames p50/p95/max | 7 / 12 / 23 (n=1391) | 6 / 21 / 23 |
| Rollback depth, frames p50/p95/max | 10 / 14 / 24 (n=336) | 11 / 24 / 24 |
| Prediction stalls at 24-frame limit | 6; longest 21 callbacks | 109; longest 58 |
| Final checksums match | Yes | Yes |

The full table and gates are in integrity-table.md and summary.json.
`player_view_failures` is empty.

## Per client

Receipt lag uses the network-model lane's method (lag-analysis.ts, as in
smashcraft:evidence/input-integrity-clean-folders-20261006/). Each helper
receipt is compared with the game's native send time of the frame it
consumed, relative to the first receipt. Positive means behind real time.

| | Match 1: A | Match 1: B | Rematch: A | Rematch: B |
| --- | --- | --- | --- | --- |
| Receipt lag vs own game clock, max (final), s | 0.28 (0.05) | 0.31 (0.05) | 0.11 (−0.03) | 0.02 (−0.03) |
| Echo, median of per-second means (lowest–highest), ms | 85.1 (73.1–198.1) | 68.9 (63.5–322.7) | 95.9 (86.2–113.6) | 100.7 (85.5–118.0) |
| Warcraft CPU over the match, median (max) % of one core | 84 (207) | 138 (233) | 92 (126) | 109 (173) |

For comparison, in the clean-folders run on cd79353 the rematch's echo rose
to 1.2 s on both clients from its 13th second. In the sweep, A's receipts
trailed by 0.96 and 1.06 s. Here the highest one-second echo means were
198 ms (A, match 1), 323 ms (B, match 1) and 118 ms in the rematch
(local-echo.txt). CPU was sampled once a second from /proc (cpu.txt).
