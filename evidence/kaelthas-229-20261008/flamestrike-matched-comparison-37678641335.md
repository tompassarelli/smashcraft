# Flame Strike matched comparison

The frame-17–52 Flame Strike candidate won **85/360 (23.61%)**, against
the reused baseline's **65/360 (18.06%)**: 20 additional wins, or 5.56
percentage points. All three named matchups improved.

| Kael versus | Baseline wins | Candidate wins | Added wins |
| --- | ---: | ---: | ---: |
| Lich | 18/120 | 25/120 | 7 |
| Lich King | 9/120 | 15/120 | 6 |
| Peon | 38/120 | 45/120 | 7 |
| Total | 65/360 | 85/360 | 20 |

Baseline: `6da945c034f51541b4b0fd264a2449b47b024318`, using art's retained
completed local baseline. Candidate: `e7e5d4c167e3c41a20619fa38328552033c137a8`,
the baseline plus only gameplay/docs/contracts commit `910e0242`.
The failed prediction patch `b222e886` is absent. The candidate's AI and
selectable roster are identical to the baseline; later main changes are not
part of this comparison.

[Hosted candidate run](https://github.com/tompassarelli/smashcraft/actions/runs/37678641335)
completed successfully in 141 seconds from dispatch through its result.
It used Wren Expert in both slots, requested 100 matches per pair, 100 seeds,
one spawn variant, three stocks, a four-minute clock and all 12 default field
stages. Rounding to complete stage/slot-order groups produced 120 matches per
pair. The reused baseline and candidate have the same **360 stage, variant,
seed, fighter-order, opponent and tier setups** and identical options.
Neither arm had a tie or time-out. No duplicate baseline or local candidate
was run: the hosted candidate shard received a runner and played the sample.

The aggregate is still below 40%; this targeted sample does not replace the
original 40–60% full-field gate. That gate and the previously failed full-field
result are unchanged.

The numerical comparison is in
`flamestrike-matched-comparison-37678641335.json`. The hosted raw records and
table are retained privately under
`~/.local/share/smashcraft-build-inputs/kaelthas-229/authored/flamestrike-comparison-37678641335/`.
The reused raw baseline remains under
`~/.local/share/smashcraft-build-inputs/kaelthas-229/authored/delay-comparison-local/baseline/`.
The farm published its scratch ref through `safe-push`; its type check and
source-shape check passed under a `heavy` capacity scope. The farm scope
released and the temporary remote ref was removed after completion.
