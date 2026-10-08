# Archer side-special play style (#273)

Wren Expert versus Forsaken Paladin, 120 three-stock, four-minute matches,
`--per-pair 120 --seeds 100 --matchups archer:forsaken-paladin --probe 0`.
The before and after records have identical stage, spawn variant, seed,
fighter order, opponent and tier for all 120 matches.

| Measurement | Before | After |
|---|---:|---:|
| Side-special starts | 2,769 | 818 |
| All move starts | 12,617 | 11,725 |
| Side-special share | 21.9465800111% | 6.9765458422% |
| Archer wins | 82/120 | 102/120 |

Before source: `febfa549646b662e676e49bb1b293f0b63c5dd1d`,
[farm 37760005241](https://github.com/tompassarelli/smashcraft/actions/runs/37760005241).
After source: `8b1fcc8eb0613301652df28ba46ef8d0e7b817ba`,
[farm 37761327643](https://github.com/tompassarelli/smashcraft/actions/runs/37761327643).
Both runs retain raw records in their `balance-field` artifact, `field.json`.
The before artifact also includes three other Forsaken Paladin pairs; only
the Archer pair is compared here.

Archer's computer now chooses homing arrows in its 380–520 long-range
spacing band and approaches behind Swift Arrow. The player's moves are
unchanged. Narrowing the weighting alone first reached 18.6041046530%
(2,375/12,766 starts; source `1c5da53bb1e703db5674e4a23dcce0945bfd8dba`,
[farm 37760462157](https://github.com/tompassarelli/smashcraft/actions/runs/37760462157)).
The retained fix makes that spacing band govern the homing-arrow choice
on the ground and in the air.

The shared final roster field supplies the 40–60% win-rate decision.
