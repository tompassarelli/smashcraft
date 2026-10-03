# Analog shield pressure

Production now preserves analog shield pressure from the existing NetworkInput
trigger bytes through InputSnapshot, fighter state, replay snapshots and frame
comparisons. A digital click supplies full strength. With no digital click,
bytes 0–76 do not request guard; byte 77 is the first active pressure. Pressure
below the retail threshold preserves the previous strength during a forced
minimum hold. Shieldstun and hitlag retain the contact strength.

The shared pressure interpolation drives guard drain, shield damage, stun,
defender pushback, and relative visual size. Authored Warcraft shield scale and
fighter parameters remain unchanged. At pressure 128, strength is
0.28851544857025146: a 10-power contact at health 60 leaves 51.577030181884766
health, produces duration 13.436975479125977, and pushes back
1.612437129020691 Melee units. The production integer stun count is 13 under
the existing duration-to-action-clock rule.

The corpus smashcraft:docs/smash-melee-reference/retail-analog-shield.json
contains 54 original NTSC 1.02 observations over six pressures, three health
values and three integer contact powers. The complete nonbreaking guard update
and stun routines run under QEMU PPC750. Size, damage and pushback use bounded
original fragments with the explicit return patches recorded in the corpus.
The size observation uses unit base size, isolating the shared multiplier
without importing any retail fighter's geometry. The observations establish
scalar outputs, not a complete original guard/contact update.

The independently authored loader
smashcraft:tools/physics-probe/observe-retail-shield.mjs loads the revision-matched
retail executable and common table privately. Its original-containing ELF and
binary outputs stay outside repositories in
~/.local/share/smashcraft-melee-reference/analog-shield-runner. Reference
revision 0296f009f32f710495979d30772d8332af2d411a supplies symbol/ABI lookup;
no external implementation was copied or translated.

Observed focused check: 54 numeric-observation tests and four connected
input/guard/contact/replay tests pass (58/58), with zero compiler errors and
one existing unused-import warning. The fixed compiler and standard-library
pins are unchanged. No existing test or gate was weakened.

After integration, the emitted-Lua comparison matches all 54 numeric rows
and passes all fourteen precision groups with zero compiler errors or warnings.
The normal suite passes 592/592. Evidence:
smashcraft:build/analog-precision-integration.log and
smashcraft:build/analog-normal-integration.log.

Still open: geometric shield coverage/pokes/tilt, powershields, physical analog
controller capture, ordered original guard-state traces, and native Warcraft
verification. Current contacts still use the existing whole-fighter guard rule;
visual size does not establish collision coverage. Existing keyboard producer
rows use digital guard and full trigger bytes. A future physical analog
producer must preserve independent digital-click bits and pressure bytes;
setting a digital held bit for every nonzero pressure forces full shielding.
