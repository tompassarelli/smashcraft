# Native cost model against the 0.0.48/0.0.49 overlays — 7 October 2026

wisp#19, cost box. Wisp b58a21f (`perf native`, `perf fit`:
wisp:docs/frame-cost.md#checking-against-warcraft).

**Inputs.**
- Native: the four-fighter rematch overlays, keeping windows inside the match
  (median natives ≥ 100). 0.0.49 R2 has 62 windows on a 1 ms clock, from
  smashcraft:evidence/headless-native-cost-20261006/overlay-0049-bot-four.txt.
  0.0.48 R2 has 41 windows on a 1.1 ms clock, from
  smashcraft:evidence/bot-session-0048-native-20261006/r2-perf-overlay.txt.
  Both are converted here to `overlay-*.json`, with median and max per
  window. Those overlays showed no p95.
- Headless: `perf bot-four --frames 1800 --samples` of each build's source,
  the same runs as smashcraft:evidence/headless-native-cost-20261006
  (perf-bot-four-0049.txt from eb2b5e97, perf-bot-four-0048.txt from
  632b5295). Their instruction, native-call and allocation summaries are
  identical. Player 0 is client A, which showed the overlay.

**Result** (fit-result.txt). This is the median across windows of each
window's value, native → predicted.

| Model | 0.0.49 median | 0.0.49 max | 0.0.48 median | 0.0.48 max |
| --- | --- | --- | --- | --- |
| `WARCRAFT_COST` (native call 2 µs, collector 2 µs/KB; fitted on 0.0.49 on 6 Oct) | 5.00 → 5.00 (+0%) | 47.97 → 51.00 (+6%) | 3.97 → 4.40 (+11%, held out) | 31.01 → 49.50 (+60%) |
| Fitted to both builds, and to either one held out | 5.00 → 5.00 | +2% | +11% | +56% |
| Fitted to each build's first half of windows, checked on the second | 5.00 → 5.00 (+0%) | −17% | 4.03 → 4.40 (+9%) | +57% |

- The median is within 20% on both builds under every fit, held out included.
- The p95 can't be checked: no native reading has one.
- The fit settles at native call 0–1 µs and collector 0 µs/KB. On a 1 ms
  clock the medians don't respond to either cost, so only the
  quarter-weighted maxima drive the fit, and 0.0.48's maxima are predicted
  high whatever the costs: they are Lua-instruction spikes (2.67 M
  instructions in the worst frame). So `WARCRAFT_COST` stays as it is.

**Next native session** (owner/native): a bot session's `--bot-four` and
`--bot-perf` rematches now read median/p95/max. From the build's source,
after `botResult.ts`:

```sh
LUA=<32-bit lua> bun wisp perf native "$S/bot-four/bot-result.json" bot-four
LUA=<32-bit lua> bun wisp perf native "$S/bot-perf/bot-result.json" bot
```

Each one passes when the median and p95 are both within 20%. To refit, run
`bun wisp perf fit SAMPLES=READINGS ...` with each run's `perf --samples`
output.
