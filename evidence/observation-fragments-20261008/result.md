# Exact repeated projectile fragments

The same original `playable-bot-four --frames 1800 --samples` workload reduced mean Lua instructions by 0.8% for both clients after batching consecutive identical inactive-projectile canonical fragments. Allocation and native calls were unchanged. The original fixture and 10/14 ms budget still fail.

Before: Smashcraft `533c0e63b584e2c2d1d5f9cd515bd25e5d0cf572`, Wisp `d8a967d32f6ee36116a1232a23c6cac36be91ce9`, hosted [run 37678974313](https://github.com/tompassarelli/smashcraft/actions/runs/37678974313). After: Smashcraft `8d276add5d5880af5ef16f1afa303acfe409e4d7`, same Wisp, one local finite heavy run using stock Lua32 from `~/code/smashcraft/worktrees/codex-perf-20261007/ts/build/lua-stock/lua-5.3.6/src/lua`. The candidate hosted run 37681873917 had no runner and was cancelled only after local execution began. Each measured run completed 1,800 frames with 0 problems.

| Per client | Before p0 | After p0 | Before p1 | After p1 |
| --- | ---: | ---: | ---: | ---: |
| Mean Lua instructions | 350141 | 347244 | 342502 | 339725 |
| Predicted mean ms | 8.371 | 8.309 | 8.207 | 8.148 |
| Predicted p50 ms | 6.86 | 6.82 | 6.81 | 6.76 |
| Predicted p95 ms | 20.34 | 20.06 | 20.38 | 20.11 |
| Predicted p99 ms | 24.59 | 24.31 | 24.04 | 23.82 |
| Predicted worst ms | 27.23 | 26.95 | 26.62 | 26.34 |
| Mean allocation KB/frame | 227 | 227 | 227 | 227 |

The count-based before/after comparator passes. The raw Lua microseconds come from different execution environments and are recorded in checks.txt; they are not a speed comparison. Native-call totals are identical, 414737 for p0 and 414388 for p1. The checked-in fixture was unchanged.

Original replay acceptance: 24 tapes, 19,310 frames, zero divergent frames in both stock and toward-zero Lua. Focused byte/storage/eviction cases passed in Bun and both Lua modes. The existing byte case now varies active-projectile position and compares the projectile suffix against independent scalar serialization. The observation module was 7/8 in each Lua mode because an unchanged test expected 13 fighters rather than the frozen roster's 21. Separate test-only correction `70566d65` landed at `84f612ae`; its affected check passed all 21×360=7560 traces with zero early reversals, preserving every per-fighter assertion.

Runtime repair `8d276add` landed at `703ead8457d7ffa579250acdbb2e1745839d0789`, with required type and source checks passing. That merge contains newer main gameplay and the Wisp `6a9cd081` standalone-host changes; the table above describes the frozen 533c0e63/8d276add comparison only.

Raw samples: before-533c0e63.perf.gz and after-8d276add.perf.gz. The exact original comparison, budget, and fixture commands and outputs are in checks.txt. No new profile, balance sweep, or memory soak was run for the candidate.
