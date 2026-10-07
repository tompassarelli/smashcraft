# Approved Uther damage adjustment

After the second failed field, the commander explicitly approved one more
attempt: multiply Uther damage by 0.85, keep timings, geometry and hitlag,
then run the unchanged original thirteen-fighter field.

The preceding frozen result was **3571/4800 = 74.3958%**, at
`e4fa813953fedb41e7193d995875f252282584ac`, run
[37660886012](https://github.com/tompassarelli/smashcraft/actions/runs/37660886012).

The multiplier applies to every Uther damage contact after passive bonuses.
The contact keeps its original damage separately for hitlag, and armor uses
the actual reduced damage. Other fighters keep their existing values.

| Contact | Before | After | Hitlag |
| --- | ---: | ---: | --- |
| Hammer of Justice | 13 | 11.05 | 10 frames, unchanged |
| Holy Radiance hammer | 14 | 11.9 | unchanged |
| Holy Radiance wave | 6 | 5.1 | unchanged |
| Ascension | 8 | 6.8 | unchanged |
| Hammer Sweep forward tilt | 12 | 10.2 | 10 frames, unchanged |

Checks before publication: 56 focused Bun checks including passives, CPU
whole-kit use and Uther contracts; one additional direct normal contact
check; 24 emitted-Lua32 contracts. The three-extra-frame hammer pause and
loud heavy impact assertions are retained unchanged.

No further tuning is authorized if this field fails without a new measured
recommendation. Shared visual correction remains owned by #211. The commander
removed the human fun-verdict hold from issue #216.
