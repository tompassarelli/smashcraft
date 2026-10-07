# Point-blank projectile punishment, 7 October 2026

The production interaction graph fires each projectile special on frame 10
at a mirror defender 60 units away, shield held from frame 1. These files
retain its projectile rows for Archer, Lich and Lich King. `before.jsonl`
uses main ff93ac03; `after.jsonl` changes only Frost Nova's end from 37 to 39
and Defile's end from 46 to 50.

For the baseline comparisons, the same checkout and probe replace just
smashcraft:ts/src/game/sim/heroes/lichSpecials.ts with 432244f5's version
(`lich-baseline.jsonl`), or just
smashcraft:ts/src/game/sim/heroes/lichKingSpecials.ts with d5594b72's parent
version (`defile-baseline.jsonl`). Each source file is restored immediately
after the probe. Other fighters' rows in those files remain the candidate.

Lich's baseline 8% orb allows shield grab at contact+10 (advantage -10).
The 9% orb adds shieldstun and removes that punish (advantage -8). Two
extra cast frames restore grab at contact+12 (advantage -10).

Defile previously allows shield grab at contact+7..9 (advantage -11).
Its longer warning removes that punish (advantage -5). Four extra recovery
frames restore grab at contact+5 (advantage -9), preserving the warning,
pool duration, pulse spacing, damage, growth and repeat interval.

Archer's new draw and recovery satisfy the rules she previously departed
from: shield grab at contact+1..3, two arrows maximum. Removing those stale
departures strengthens the existing rule check. The unchanged check in
smashcraft:ts/scripts/projectileRules.tests.ts passes all 16 tests after the
repair; it failed Archer, Lich and Lich King before it.
