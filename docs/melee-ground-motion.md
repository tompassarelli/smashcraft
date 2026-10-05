# Flat-ground motion arithmetic

The shared simulation now rounds ordinary flat-ground position additions in
Melee units after the self-movement, launch, and attacker-recoil channels, in
that order. It also rounds the digital defender decrement, the grounded recoil
friction product, and the recoil decrement to binary32. World coordinates still
use six Warcraft units per Melee unit. Original fighter parameters are unchanged.

A grounded shield contact replaces the defender's previous self ground speed.
The simulation retains its separate pushback field and clears the old self
velocity when installing that field, so previous movement is not added again.
This change does not introduce stale-move penalties or freshness bonuses.

## Independent numeric evidence

smashcraft:docs/smash-melee-reference/retail-ground-motion.json contains 22
composed arithmetic cases and four shield-entry store observations from the
owner's NTSC 1.02 executable, SHA-1
`08e0bf20134dfcb260699671004527b2d6bb1a45`.
The reference symbol lookup used revision
`0296f009f32f710495979d30772d8332af2d411a`; that unlicensed source grants no
implementation reuse. No source implementation was copied or translated.
The repository retains numerical facts and an independently authored fixture
generator, with no original executable, disassembly, or assets.

The independently authored private loader is
~/.local/share/smashcraft-melee-reference/scalar-runner/run-ground-motion.mjs.
Its executable images and output remain under
~/.local/share/smashcraft-melee-reference/ground-motion-runner/.
It runs selected original arithmetic blocks under QEMU PPC750, with return
boundaries recorded in the corpus. Defender drag selection and ground-speed
addition, grounded launch decrement, recoil friction multiplication and
subtraction, and scalar position addition are executed separately. Ordinary
flat-ground friction is supplied as one. Position composition repeats the
original scalar horizontal add in the channel order observed in the original
update. It does not execute paired-single vector addition or the entire update.

One composed case begins at -60 with self speed 0.25, launch speed
0.7562744617462158, recoil -0.30000001192092896, and traction
0.07999999821186066. The observed decayed launch is 0.6762744784355164,
recoil is -0.2120000123977661, and position is -59.285728454589844.
Even rounding one combined sum would instead produce -59.28572463989258.
The defender case starting at 0.45600005984306335 decays to
0.3760000467300415 with that traction. Positive and negative cases include
values at and near the decrement-to-zero boundary.

The separate original direction/store block at 0x800930B0–0x800930CC
replaces previous ground speeds of either 1.75 or -1.75 with selected pushback
of either sign. The wrapper supplies the selected magnitude; it does not test
its damage formula. The production entry checks accordingly assert removal of
the previous velocity, without claiming a newly verified contact magnitude.

## Production comparison

smashcraft:tools/physics-probe/generate-ground-motion-probe.mjs turns these
facts into assertions through production contact handling and movement.
The existing smashcraft:tools/physics-probe/check-numerical-precision.sh compiles
those assertions with the locked Wurst compiler and runs the emitted Lua.
Compiler and standard-library pins are unchanged.

The pre-fix comparison reported 30 mismatches: 14 positions, ten recoil
values, two defender values, and all four shield-entry cases. The repaired
comparison passes all 22 arithmetic cases (four values per case) and four
entry cases, with zero compiler errors or warnings. All other existing
numerical-probe result groups also passed in that same run. Local logs are
smashcraft:build/ground-motion-before.log and
smashcraft:build/ground-motion-after.log in the melee-ground-motion lane.

This evidence covers ordinary flat-ground arithmetic and the entry overwrite.
It does not establish native Warcraft timing, a complete original-game
trajectory, signed-zero bit identity, slopes, faster-than-walk friction,
shield release and movement-state transitions, analog shields, collision
geometry, or shield contact magnitude precision. Ground dodge travel retains
its separately modeled path. Retail fighters remain test rigs rather than
replacing the original Warcraft fighters.
