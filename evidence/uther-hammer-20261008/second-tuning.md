# Uther second balance tuning

The first recovery adjustment was measured at
`8901bfcd74492dc9e2a9818420dc225062f84e4b` by the original field:

`bun wisp farm balance --ref 8901bfcd74492dc9e2a9818420dc225062f84e4b --wait`

[Run 37659325382](https://github.com/tompassarelli/smashcraft/actions/runs/37659325382)
completed 31,200 matches in 5 minutes 28 seconds. Uther won
**3880/4800 = 80.8333%**. Every other fighter passed 40–60%. Holy Radiance
remained 35% of Uther's starts, and mana spent per stock was 167. The raw
farm table is `field-r2.md`.

The second adjustment raises Holy Radiance's cost from 20 to 50 mana. Its
14-damage hammer hit, 6-damage wave, startup, travel and 69-frame total
commitment stay fixed. Hammer of Justice still costs 10 mana.

Seven focused Bun checks pass, including the same eight-seed all-special
CPU coverage and the protected-attack case. That case supplies 60 mana:
it can pay Holy Radiance while Divine Shield is active, while the unprotected
CPU keeps the 25 mana needed for its defensive stance.
