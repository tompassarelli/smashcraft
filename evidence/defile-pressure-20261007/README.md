# Defile pressure sample, 7 October 2026

One forced-standing Lich King versus Archer sample for the original and the
rework, using the match-ordered frame helper in
smashcraft:ts/src/game/sim/heroes/lichKingSpecials.tests.ts. On every frame the
Archer is returned to the pool centre, on the ground, with reaction clocks
cleared. Down special is pressed on frame 1 and every frame from 47 until a
second cast starts. This measures the pool's pressure budget, not a natural
combo or a match win rate. The original uses its old projectile executor and
authored projectile values; the rework uses the current production executor.

smashcraft:evidence/defile-pressure-20261007/pressure.jsonl records the hit
frames, expiry, next entry and damage. The original's declared 24-frame wait
gave 25 frames between hits because the wait decremented and skipped that
frame; the rework's 36-frame wait gives exactly 36. The 20-mana, 46-frame cast
is unchanged. The longer explicit cast wait preserves the original recast
interval as the pool duration shrinks, leaving 141 frames between the first
pool's expiry and the second pool's placement in this sample.

The production contract also exercises an unhurt jump-and-drift response in
both facings, shielding without growth, refused recasts without mana loss,
and rollback copies of the growth and wait. Native appearance and LAN parity
are separate acceptance checks in #174.
