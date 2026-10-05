# Launch magnitude numeric observations

The production ordinary/fixed launch calculations now match 50 independent
NTSC 1.02 scalar outputs exactly in emitted Lua. Before the repair, 34 of those
50 comparisons failed. A further 150 comparisons match the original crouch,
charge, and sequential crouch-plus-charge arithmetic. All existing groups in
smashcraft:tools/physics-probe/check-numerical-precision.sh also passed after the
repair; compilation reported zero errors and zero warnings.

The launch arithmetic uses binary32 input and operation rounding, the rounded
weight ratio, and fused multiply-add for the additive growth terms. Contact
resolution retains crouch and charge flags until it applies their adjustments
sequentially. Damage inputs, accumulated contact damage and stored percent are
rounded to binary32. Authored fighter weights and attack parameters remain
unchanged. No stale-move penalty or freshness bonus is introduced.

## Independent executable observations

smashcraft:tools/physics-probe/observe-retail-launch.mjs is an independently
authored foreign executable loader. It executes the complete scalar routine
at `0x80079AB0..0x80079C6C` and the complete context routine at
`0x8008D930..0x8008DA48` under QEMU PPC750. Neither routine is patched.
The synthetic fighter supplies pre-hit percent, accumulated damage, ordinary
or crouch action state, charge state, unit scale and zero armor. The synthetic
hit supplies integer power, growth, fixed power and base knockback. The three
launch multipliers are neutral. The original common table is loaded privately.

The input set contains ordinary, fractional-damage, sub-one-damage, zero-growth,
fixed-power and capped results across weights 75, 80, 100, 110 and binary32
97.3. Each resulting magnitude is also passed through crouch, charge and both
adjustments. Simultaneous crouch and charge is an arithmetic fixture; it does
not assert that normal gameplay reaches that state.

Original executable SHA-1: `08e0bf20134dfcb260699671004527b2d6bb1a45`.
Original common-data SHA-1: `c904de0c4c5eb3ef65211a75d8bd70ca5b0f9f41`.
Symbol/ABI lookup used doldecomp/melee revision
`0296f009f32f710495979d30772d8332af2d411a`. No gameplay implementation license
was established: no external implementation was copied or translated. The
repository retains authored tooling and numeric facts only. All original
binaries, common data and generated original-containing ELF files remain
outside repository trees under
~/.local/share/smashcraft-melee-reference/launch-magnitude-runner and
~/.local/share/smashcraft-melee-reference/ntsc-1.02.

smashcraft:docs/smash-melee-reference/retail-launch-magnitude.json retains input
values and independently observed output bits. The fixture generator
smashcraft:tools/physics-probe/generate-launch-magnitude-probe.mjs emits exact
assertions against production functions; it contains no replacement formula.

## Boundaries

These observations establish scalar arithmetic on QEMU with Linux's default
floating-point state. They do not establish GameCube hardware behavior, native
Warcraft execution, contact collection ordering, original damage-to-integer-power
conversion, action-state selection, attack history, armor, non-unit character
scale, launch angles, vector conversion or hitstun timing. Multiple simultaneous
contacts use Smashcraft's existing collection rules; only their scalar input
storage precision changed. The corpus passes integer growth/base parameters;
authored fractional parameters remain supported but are not retail comparisons.
