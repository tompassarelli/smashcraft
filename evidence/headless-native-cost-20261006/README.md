# Headless predicts native: behaviour and cost — 6 October 2026

wisp#19. What headless runs predicted against what the 0.0.48 and 0.0.49
native bot sessions measured. Development host, Lua 5.3.6 with LUA_32BITS
(`/nix/store/6xb8178isq7vkdhmmr75wyhgm2m9492g-lua32-5.3.6`), Wisp 21d9b2f.

## Behaviour

**Saved moments.** `bun scripts/integrity/botResult.ts DIR` now replays every
moment in `DIR/moments` (smashcraft:docs/native-bot-session.md). On copies of
the private captures, from this source:

| Capture | Build | Moments landing on Warcraft's checksum |
| --- | --- | --- |
| 0.0.48 R1 | playable 0.0.48, raw f32 | 0 of 4 |
| 0.0.49 R1 (14:50) | integrity built 14:30, before smashcraft#59's exact f32 | 0 of 4 |
| 0.0.49 R2 (15:03) | integrity at fc287ae0, exact f32 | 2 of 8 (the f1866 pair); the f774, f778 and f1850 pairs diverge by their first checkpoint |

So the #59 fix is not yet complete: six of R2's eight moments still diverge.

**Raw float rounding.** `bun wisp tapes` and `bun wisp parity numeric` now
run their Lua in a stock Lua32 and in one whose raw `+ - *` round toward zero
(wisp:native/toward-zero.h); each must equal Bun. The numeric corpus gained
`f32(a + b)`, `f32(a - b)` and `f32(a * b)` as the compiler emits them.

| Compile | Tapes, toward-zero Lua32 | Parity, toward-zero Lua32 | Both, stock Lua32 |
| --- | --- | --- | --- |
| Wisp 9ce7eef (raw f32) | diverge from actions line 10, fighter[1].physics.aerialJumpSpeed (859 frames) | 1139 of 22000 results differ (133 sums, 1006 products) | equal |
| Wisp da086d9 (exact f32, d361849) | 4 tapes, 1760 frames, 0 divergent | 0 of 22000 | equal |

## Cost

`bun wisp perf bot-four --frames 1800` plays the native session's
four-fighter match headlessly (smashcraft:ts/scripts/wisp/botMatch.ts) and
predicts each frame's Warcraft cost (wisp:docs/frame-cost.md, "Predicted
native cost"). The native numbers are the frame meter's overlay in each
session's four-fighter rematch: 0.0.48 R2 (r2-perf-overlay.txt in
smashcraft:evidence/bot-session-0048-native-20261006, 30 readings) and
0.0.49 R2 (overlay-0049-bot-four.txt here, OCR of 61 readings: time, Lua ms
median, max, natives median, max, catch-up median, max). 0.0.48 was predicted
from a headless build of its own source (632b5295, Wisp 5a21838 with the
measurement added, its helper's typing bursts and R2's tap-only beats).

| | 0.0.49 (model fitted here) | 0.0.48 |
| --- | --- | --- |
| Native median frame (median of windows, range) | 5.0 ms (3.5–6.0) | 4.03 ms (3.05–4.94) |
| Predicted p50 per frame, p0 / p1 | 4.89 / 4.90 ms (−2%) | 4.61 / 4.65 ms (+15%) |
| Native worst frame per window (median, range) | 48 ms (30–105) | 35 ms (18–66) |
| Predicted, same windows | 51–52 ms (+7%) | 50 ms (+41%) |
| Native p95 | not shown by those overlays | not shown |
| Predicted p95, p0 / p1 | 20.2 / 18.2 ms | 19.2 / 17.3 ms |
| Native calls, median frame | 155 | 151 |
| Headless native calls, median frame | 156 | 151 |

The p50s are within 20% on both builds. p95 is not checked: the overlay
showed median and maximum only, so Wisp's overlay now shows median / p95 /
max, and `parity capture --bot --bot-perf` shows it in a three-fighter
rematch too. 0.0.49's readings were taken while other work loaded the host
(capacity helper CPU pressure 30%); the meter's clock is likely wall time.

Fitted constants: native call 2 µs and collector 2 µs per KB. A collector
cost at the host's own full-collection rate (6.8–7.4 µs per KB) puts 0.0.48's
median 24% high: the collector's work does not land on the measured
callbacks in proportion to allocation.

`perf compare` holds predicted native time, allocation and typing stalls:
0.0.48's match against 0.0.49's fails it on allocation alone, mean +273%
and p95 +501% (compare-0048-against-0049.txt).

**Soak typing stalls.** `bun wisp soak --matches 12 --seed 3 --workers 2`
now charges the edit box's stall for what each helper types
(soak-current-helper.txt, soak-bursts.txt):

| Helper | Cost findings | Worst predicted frame |
| --- | --- | --- |
| current stand-in (≤256 characters ahead, joined records) | 2 matches, 2 and 8 frames | 115.5 ms |
| pre-8ac53f2f bursts | 2 matches, 4 and 16 frames | 387.8 ms |

The current stand-in still types about 480 characters in one frame after a
lag spike: a joined record of up to 16 packets is typed whole, then up to
256 more. The native 0.0.49 helper's largest emissions were 227–268 bytes,
back to back.

## #60: every press on its frame, shown on the next frame

smashcraft:ts/test/lag-recovery.test.ts now holds #60's gate in the full
suite (CI): through a 2 s stall of both games, one of one game and #26's
250 ms stall, with Wisp's modelled typing cost, every confirmed row equals
what the helpers journaled, and every press made while the game runs starts
its local action within one frame of wall time of its capture. This build:
362 such presses, 356 at 0 frames and 6 at 1 (callbacks up to 12 during the
catch-up, which runs 10 a frame); presses made while a game was stopped are
excluded. With the pre-8ac53f2f typing (`helpers.bursts = true`) the gate
fails: local starts up to 178 frames.
