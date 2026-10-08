# Melee down moves and Smashcraft

Angles are degrees from facing; the next numbers are base knockback and
growth. These are independently recorded numerical facts from the public
DAT frame-data dump, read 8 October 2026, not copied implementation code.
`ThrowLw` throw type 0 is the throw; collateral hitboxes and escape throws
are excluded. `AttackLw4` lists distinct contact rows, including finishers.
361 is Melee's ground/air dependent Sakurai angle, not 361 literal degrees.
Set knockback is shown separately because it replaces ordinary scaling.
The publisher does not identify a disc revision, so these rows are not a
claim about PAL/NTSC differences.

Rifleman/Falco and Illidan/Captain Falcon follow the established
physics references. The expansion comparisons below are design analogies
chosen by kit (spacing sword, fast blade, heavy hammer, caster, grappler),
not claims that those original fighters are ports of Melee characters.

The outcome column is our inference from the launch rows and timing: shallow
launches can set up floor defense; compact rising throws create a DI read;
large rising smashes can become edgeguards instead. The actual outcome in
Melee also depends on victim weight, percent, fall speed, DI and stage. The
linked DAT is the primary numerical source; each name also links the
publisher's frame-data page for timing and visual context.

## Reference and pre-change values

Smashcraft values were read from production fighter tuning at `8246fc6d`,
including the first active down-smash contact and released down throw.
Other Melee contact rows are included so tips, inner hits and finishers are
not conflated. Damage is shown on the Melee rows only to distinguish them.

| Smashcraft fighter / Melee comparison | Melee down throw: damage, angle / base / growth | Melee down smash: damage, angle / base / growth | Melee outcome (throw; smash) | Smashcraft down throw angle / base / growth | Smashcraft down smash angle / base / growth |
| --- | --- | --- | --- | --- | --- |
| Rifleman / [Falco](https://meleeframedata.com/falco) ([DAT](https://melee.theshoemaker.de/dat-dumps/Falco.json)) | 1%: 270° / 37 / 40 | 16%: 25° / 20 / 70; 13%: 80° / 20 / 70 | tech chase; low tech chase / edgeguard | 70° / 75 / 40 | 45° / 20 / 100 |
| Illidan / [Captain Falcon](https://meleeframedata.com/captainfalcon) ([DAT](https://melee.theshoemaker.de/dat-dumps/Captain%20Falcon.json)) | 7%: 65° / 18 / 34 | 18%: 361° / 30 / 100; 16%: 361° / 20 / 100 | DI mix-up / tech chase; tech chase / edgeguard | 70° / 75 / 40 | 75° / 22 / 95 |
| Blademaster / [Marth](https://meleeframedata.com/marth) ([DAT](https://melee.theshoemaker.de/dat-dumps/Marth.json)) | 5%: 135° / 16 / 50 | 11%: 75° / 70 / 72; 11%: 361° / 20 / 100; 11%: 361° / 16 / 100; 16%: 70° / 70 / 100; 11%: 361° / 30 / 100; 11%: 361° / 15 / 100; 16%: 75° / 70 / 100 | DI mix-up; tip pop-up / edgeguard | 65° / 75 / 40 | 25° / 22 / 100 |
| Mountain King / [Bowser](https://meleeframedata.com/bowser) ([DAT](https://melee.theshoemaker.de/dat-dumps/Bowser.json)) | 0%: 50° / 18 / 30; 12%: 0° / 0 / 100 | 2%: 150° / 40 / 50; 2%: 190° / 40 / 50; 10%: 90° / 40 / 140 | DI mix-up; multi-hit pop-up / edgeguard | 75° / 75 / 40 | 25° / 25 / 100 |
| Warden / [Sheik](https://meleeframedata.com/sheik) ([DAT](https://melee.theshoemaker.de/dat-dumps/Sheik.json)) | 3%: 80° / 17 / 50; 5%: 361° / 0 / 0 (set 90) | 13%: 40° / 35 / 80; 10%: 50° / 35 / 80 | tech chase on fastfallers, DI mix-up on floaties; tech chase / edgeguard | 70° / 75 / 40 | 25° / 22 / 100 |
| Lich / [Zelda](https://meleeframedata.com/zelda) ([DAT](https://melee.theshoemaker.de/dat-dumps/Zelda.json)) | 2%: 120° / 20 / 42; 2%: 40° / 0 / 100 (set 25) | 11%: 30° / 20 / 90; 11%: 30° / 20 / 80 | DI mix-up; low tech chase / edgeguard | 75° / 75 / 40 | 25° / 22 / 110 |
| Forsaken Paladin / [Ganondorf](https://meleeframedata.com/ganondorf) ([DAT](https://melee.theshoemaker.de/dat-dumps/Ganondorf.json)) | 7%: 100° / 18 / 36 | 8%: 160° / 0 / 100 (set 90); 8%: 160° / 0 / 100 (set 130); 14%: 120° / 60 / 110; 12%: 120° / 60 / 110 | DI mix-up / tech chase; link into rising finisher / edgeguard | 70° / 75 / 40 | 25° / 25 / 100 |
| Dreadlord / [Mewtwo](https://meleeframedata.com/mewtwo) ([DAT](https://melee.theshoemaker.de/dat-dumps/Mewtwo.json)) | 6%: 69° / 16 / 50; 5%: 80° / 40 / 104; 5%: 80° / 40 / 105 | 15%: 361° / 20 / 103 | DI mix-up; tech chase / edgeguard | 65° / 75 / 40 | 25° / 22 / 110 |
| Shadow Hunter / [Link](https://meleeframedata.com/link) ([DAT](https://melee.theshoemaker.de/dat-dumps/Link.json)) | 4%: 90° / 15 / 50; 2%: 361° / 0 / 0 (set 90) | 13%: 75° / 26 / 90; 16%: 75° / 26 / 90; 17%: 75° / 26 / 90; 11%: 75° / 20 / 90; 16%: 75° / 20 / 90; 17%: 75° / 20 / 90 | DI mix-up; pop-up / edgeguard | 70° / 75 / 40 | 25° / 22 / 110 |
| Pit Lord / [Bowser](https://meleeframedata.com/bowser) ([DAT](https://melee.theshoemaker.de/dat-dumps/Bowser.json)) | 0%: 50° / 18 / 30; 12%: 0° / 0 / 100 | 2%: 150° / 40 / 50; 2%: 190° / 40 / 50; 10%: 90° / 40 / 140 | DI mix-up; multi-hit pop-up / edgeguard | 65° / 75 / 40 | 25° / 22 / 95 |
| Beastmaster / [Donkey Kong](https://meleeframedata.com/donkeykong) ([DAT](https://melee.theshoemaker.de/dat-dumps/Donkey%20Kong.json)) | 7%: 361° / 15 / 45 | 16%: 115° / 35 / 100; 14%: 98° / 35 / 100 | tech chase / edgeguard; pop-up / edgeguard | 70° / 75 / 40 | 25° / 22 / 110 |
| Lich King / [Roy](https://meleeframedata.com/roy) ([DAT](https://melee.theshoemaker.de/dat-dumps/Roy.json)) | 6%: 120° / 16 / 60 | 21%: 75° / 42 / 70; 14%: 361° / 15 / 100; 16%: 75° / 42 / 68; 8%: 361° / 15 / 100 | DI mix-up; tip pop-up / edgeguard | 70° / 75 / 40 | 30° / 22 / 95 |

## Smashcraft decision

Every down move is a tech-chase starter. The victim chooses tech in place,
tech toward, tech away or a missed tech, and the attacker can move before
that defense ends. This uses Melee's shallow-launch relation rather than
copying its values: Smashcraft's longer authored recoveries need enough
base knockback to tumble at low percent and enough hang time to keep the
attacker's recovery from consuming the whole chase.

Down throws use a 25° outward launch, with their existing base and growth.
Down smashes use 25°, base 75 and growth 40. Their front/back contacts keep
their existing direction, damage and active windows. Nine slower down
smashes recover 12 frames earlier (Pit Lord, 13 frames); the original three
and Warden keep their timings. The stock clips already fit startup, contact
and recovery separately; Lich King's authored clip uses the shorter action
length at its existing rate to preserve the first strike's timing.

The tests run production contacts and movement at 20%, 40% and 60%, checking
tech in place, both tech rolls and missed-tech stand, roll and attack getups,
both facings, against Rifleman and Pit Lord.

## Current Smashcraft values

All rows are tech chase. Angle / base / growth are taken from production
contact data. Timing is unchanged for throws; the down-smash recovery is the
frames after its last active frame, excluding shared hitlag.

| Fighter | Down throw angle / base / growth | Down smash angle / base / growth | Down-smash recovery |
| --- | --- | --- | --- |
| Rifleman | 25° / 75 / 40.00 | 25° / 75 / 40.00 | 31 |
| Illidan | 25° / 75 / 40.00 | 25° / 75 / 40.00 | 25 |
| Blademaster | 25° / 75 / 38.20 | 25° / 75 / 40.00 | 19 |
| Mountain King | 25° / 75 / 44.20 | 25° / 75 / 40.00 | 22 |
| Warden | 25° / 75 / 40.00 | 25° / 75 / 40.00 | 28 |
| Lich | 25° / 75 / 40.00 | 25° / 75 / 40.00 | 23 |
| Forsaken Paladin | 25° / 75 / 40.00 | 25° / 75 / 40.00 | 22 |
| Dreadlord | 25° / 75 / 36.20 | 25° / 75 / 40.00 | 20 |
| Shadow Hunter | 25° / 75 / 40.00 | 25° / 75 / 40.00 | 21 |
| Pit Lord | 25° / 75 / 40.00 | 25° / 75 / 40.00 | 28 |
| Beastmaster | 25° / 75 / 42.40 | 25° / 75 / 40.00 | 22 |
| Lich King | 25° / 75 / 40.00 | 25° / 75 / 40.00 | 28 |

There are no down throws classified as DI mix-up: all thirteen take the
tech-chase branch. DI still changes the landing point and tech timing.
