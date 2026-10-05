# Ordinary hitstun boundaries

The 23 numeric observations in
smashcraft:docs/smash-melee-reference/retail-hitstun-boundaries.json execute the
NTSC 1.02 multiplication, duration conversion, minimum duration, and damage-level
branches. Inputs include zero and neighboring binary32 values around scaled
durations 1, 3, 10, 21, 32, 35, and 1000. The original executable stays in private
storage outside the repository.

The original rounds knockback × 0.4000000059604645 to binary32, truncates to an
integer, and replaces zero with one. Damage levels change at scaled values 10,
21, and 32. Existing Smashcraft duration and level results agree with these
observations; this pass does not establish a duration defect or require a
formula change. The fixture compares those observable results, rather than
requiring an unobservable intermediate value.

The historical emitted-Lua check reported HITSTUN_BOUNDARIES_EXACT_PASS for all
23 cases, with zero compiler errors or warnings. The same production comparisons
now live in smashcraft:ts/src/game/sim/physicsPrecisionScalar.tests.ts and the
native profile documented in smashcraft:docs/native-physics-precision.md.

This is a selected arithmetic-block observation under QEMU PPC750, with a
synthetic common-table pointer supplying independently verified constants.
It does not prove reaction selection, hitlag, action release timing, complete
damage initialization, or native Warcraft behavior.
