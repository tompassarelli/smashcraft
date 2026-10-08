# #168 phase measurement, 8 October 2026

Measured checkout: `6702387c578d7c649f0314ed6d915ca69f55c6cc`.
Frozen gameplay base: `39ba34524029b1b45029bd60cc7b725c1681b453`.
Farm: https://github.com/tompassarelli/smashcraft/actions/runs/37760004496
Checkout's `git log -1 --format=%H` printed the measured full SHA.
Command: `bun wisp farm perf 'profile playable-bot-four --phases' --out ../evidence/perf-phases-168-20261008`.
Farm passed in 2.7 minutes; zero reported problems. No optimization was made.

The base includes landed projectile piece `2bb2e492a4a9c78b75d3396a9e8ffa58dd484914`;
failed effect candidate `373b3314835a6ef23d8ae55eeb34254cf9f01906` is absent.
Delay 2, rollback window 24, repair limit 6, p99 target 10 ms and worst target
14 ms are unchanged. Performance remains over both targets; this diagnostic
does not close the performance box.

## Workload and sample counts

The playable four-fighter workload, build settings, playback budgets and
acceptance-tape generator are unchanged from `e48c222ad23b99cf93c938fde7df33bedcb70d47`.
The generator SHA256 is `e73b54630d06350fe7e300b7dc2f755bf96d974909f0a763db48c49a0dd0b2b8`.
The retained 24 tapes in the earlier snapshot worker's `ts/build/tapes/` have
18,851 forward frames plus 459 correction frames, 19,310 total; their exact
file hashes are in `tapes.sha256`. Their earlier stock/toward-zero parity
result was zero divergent frames. Gameplay was not edited or replayed here.

As in the original performance measurement, the cost run is a separate
1,800-callback playable four-fighter match in two Lua32 clients, rather than
the parity tapes. The uninstrumented measurement runs first. Its two clients'
p95 tails and 30 median player-0 frames then select a separate profiled replay.

| Client | Measured callbacks | Profiled callbacks | Own p95 tail callbacks | Tail instruction samples |
| --- | ---: | ---: | ---: | ---: |
| 0 | 1,800 | 196 | 91 | 75,942 |
| 1 | 1,800 | 196 | 91 | 75,486 |

## Breakdown at the whole-frame percentile ranks

All times are predicted Warcraft milliseconds. Each column is the actual
callback at the full run's nearest-rank p95/p99/worst, rather than independently
sorted phase percentiles. Phase Lua cost is the uninstrumented callback's
instruction cost divided according to its 1,000-instruction stack samples.
The five exclusive Lua phases plus native and GC-model terms sum to total.
`stepMatch` is an inclusive core simulation subtotal inside those phases;
do not add it again. Repair's exact count is simulation steps under
`ReplayHistory.repair`, excluding new prediction steps.

| Phase / count | Client 0 p95 | Client 0 p99 | Client 0 worst | Client 1 p95 | Client 1 p99 | Client 1 worst |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Callback number | 1100 | 430 | 1392 | 1240 | 899 | 1703 |
| Total ms | 15.202 | 18.273 | 21.366 | 14.836 | 17.920 | 21.811 |
| Rollback repair Lua ms | 9.364 | 11.297 | 10.742 | 10.613 | 10.505 | 10.518 |
| Confirmed work Lua ms | 0.622 | 0.830 | 0.820 | 0.198 | 0.962 | 1.020 |
| New prediction Lua ms | 1.616 | 1.970 | 1.602 | 1.439 | 1.669 | 1.888 |
| Presentation Lua ms | 1.554 | 1.506 | 5.293 | 1.493 | 2.199 | 5.854 |
| Input, reconciliation and other Lua ms | 1.139 | 1.468 | 1.738 | 0.576 | 1.257 | 1.246 |
| Lua-to-native call ms | 0.656 | 0.704 | 0.736 | 0.466 | 0.692 | 0.828 |
| GC allocation-model ms | 0.251 | 0.498 | 0.435 | 0.052 | 0.636 | 0.457 |
| Core simulation `stepMatch`, inclusive ms | 5.428 | 7.686 | 6.367 | 6.044 | 6.362 | 6.345 |
| Total simulation step count | 7 | 7 | 7 | 6 | 7 | 7 |
| Rollback resimulation step count | 6 | 6 | 6 | 5 | 6 | 6 |
| Lua-to-native call count | 328 | 352 | 368 | 233 | 346 | 414 |
| Allocated KB | 125.422 | 248.797 | 217.531 | 25.922 | 317.781 | 228.734 |
| Instruction samples | 690 | 884 | 1034 | 796 | 845 | 1087 |

## Every exclusive phase above 2 ms in the measured slow tail

The following are phase distributions within each client's 91 slow callbacks;
they are not full-run phase percentiles. A 91-element p99 has the same nearest
rank as its maximum. Presentation includes the fighter agency forecast, camera,
rendering and UI; confirmed work includes confirmed events and replay recording.
The remaining group includes input service, reconciliation and replay service
outside the other four stacks.

| Client | Phase | Tail p95 ms | Tail p99 / worst ms | Tail callbacks above 2 ms |
| --- | --- | ---: | ---: | ---: |
| 0 | Rollback repair | 12.263 | 15.007 | 91 |
| 0 | New prediction | 2.394 | 2.491 | 17 |
| 0 | Presentation | 4.966 | 5.567 | 35 |
| 0 | Input, reconciliation and other | 1.735 | 3.201 | 1 |
| 1 | Rollback repair | 12.496 | 13.833 | 91 |
| 1 | New prediction | 2.256 | 2.564 | 11 |
| 1 | Presentation | 4.358 | 6.151 | 43 |
| 1 | Input, reconciliation and other | 1.646 | 2.826 | 1 |

Confirmed work's tail worst is 1.390 / 1.337 ms. Core `stepMatch` is also
above 2 ms, as the nested simulation subtotal shown above. All three repair
count percentiles within both tails are 6. On the worst player-0 callback,
the ordinary function profile identifies `renderPersistentPresentation` /
`FighterAgencyForecast.classify` and `advanceFighterMotion` / `decayKnockback`
alongside `ReplayHistory.repair`. The second- and third-worst callbacks name
`executeMatchFrame`, `prepareMatchFrame` and computer input/attack selection
under repair. Full raw function samples are retained in `samples.txt.gz`.

## GC, allocation and instrumentation

The existing measured path stops GC during a client callback, measures map
allocation with emulated-native allocation subtracted, and collects between
callbacks after 16 MB of heap growth. Actual host collector work was
9,517,152 us for 926,714 KB freed, outside all callback timings. Its ratio
is a host observation, not a measured native pause.

The existing Warcraft cost model assigns 2 us per KB allocated and 2 us per
native call. The GC rows above use that allocation term; GC pause placement
inside Warcraft is not observed by this farm run. Mean measured allocation
is 68 KB per callback in both clients, with worst 503 / 501 KB. Profiler
allocations and hook time occur only in the separate replay and enter none
of the measured instructions/native/allocation totals. Profiler slowdown was
not timed separately; phase costs are sampling estimates, not clock timings.

Saved raw measurement SHA256:
`625c17a4919be47aac762915d52c9c02798380838f530381592e39f0ff76cc91`.
`phases.json` retains unrounded rank values and phase distributions.

Checks: `bun run check` passed; farm compiled the map and diagnostic program
and completed both replays; safe-push's type/source checks passed. Initial
run 37759759295 was cancelled after finding a wrong prediction method name;
its raw output is retained locally as `25a98bfa-cancelled.txt` and is not used
in this table. No native clients were requested.

Repair is the largest p99 cost. Presentation forecasting contributes the
additional worst-frame spikes. The table supplies those measured targets for
the next fix decision without selecting a new architecture.
