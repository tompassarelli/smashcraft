# Swift Arrow match-frame trials, 7 October 2026

Baseline source: add8cce07b2549236e5f47147b9933db57440703 (neutral arrow
unchanged from main); rework source: 7086eef11b1880571f2d92ae3ef5d698f5a2ba10.
Each trial plays 180 recorded-match frames of an Archer mirror at 240 units,
neutral-special presses every other frame. Defender responses are idle,
a held full shield, or a full jump pressed on frame 4. Damage includes Trueshot.
The recorded frames use the production capture/executor, not a standalone
projectile calculation. JSON lines report shot starts, first projectile's
post-step lifetime/speed, damage contacts, hitlag/hitstun, and ending shield.

smashcraft:evidence/archer-neutral-172-20261007/measure.ts is the exact
one-off probe used from smashcraft:ts/build/balance-172/; its imports are
relative to that execution location. The source contract is
smashcraft:ts/src/game/sim/archerArrow.tests.ts. Projectile interaction rows
come from smashcraft:ts/scripts/interactions.ts `projectileRows` at 60,
240 and 480 units; `flight` counts frames after the emission step, so a
45-frame authored lifetime is reported as 44.

The baseline repeats every 8 frames (23 starts); the rework every 30 (6).
Idle damage: 203 -> 40. Held-shield body damage: 182 -> 0. First release:
frame 3 -> 17 for a press on frame 2. Neutral projectiles at once: 10 -> 2.
At 60, shield-grab punish starts: none -> contact+1, +2, +3; defender acts
9 frames before the shooter. At 240, defender acts 3 frames before shooter.
At 480, the defender retains its shield instead of taking a body poke.

These files are the dated source trial. Native timeline evidence is owned by
issue #172 and the native batch using
smashcraft:ts/test/native/pads/archer-neutral.pad.
