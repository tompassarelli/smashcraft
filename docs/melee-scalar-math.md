# Melee scalar approximation

`smashcraft:wurst/MeleeScalarMath.wurst` supplies pure Wurst `meleeAtan2(y, x)`,
`meleeSin(angle)`, and `meleeCos(angle)`. Inputs and intermediate results use
explicit binary32 rounding and the pinned standard library's fused multiply-add.
The implementation is independently authored from numerical approximation facts
and mathematical equations, without consulting or translating decompiled code.

The numerical facts are recorded in
`smashcraft:docs/smash-melee-reference/retail-trig-coefficients.json` and
`smashcraft:docs/smash-melee-reference/retail-trig-scalars.json`. The source
executable SHA-1 is `08e0bf20134dfcb260699671004527b2d6bb1a45`; reference
revision is `0296f009f32f710495979d30772d8332af2d411a`. No license for external
implementation code has been established, and no such code is reused.
Proprietary executable data remains in private storage outside repositories.

Atan uses an odd polynomial, reciprocal reduction, and five tangent-subtraction
segments. Each segment stores a split denominator offset, split numerator, and
split angle correction. Sine and cosine use nearest-quadrant reduction followed
by interleaved even and odd polynomials. The small-residual cosine branch uses
the normalized residual directly, which matters at the vertical axes. Rounding
after individual reductions and additions is observable and intentional.

The supported sine/cosine domain is finite angles within
`[-float32(pi), float32(pi)]`, including angles returned by `meleeAtan2`.
`meleeAtan2` accepts finite vectors; zero vectors use the vertical zero's sign
to choose positive or negative half pi. Nonfinite inputs are outside the claim;
this is not a general replacement for all platform trigonometric functions.

The subsequent original-routine fixture
smashcraft:docs/smash-melee-reference/retail-signed-zero-scalars.json exposes a
branch discrepancy: atan2(-0, -1) returns negative float32(pi), whereas the
previous implementation selected positive pi. Their sine residues have
opposite signs. atan2(-0, +0) also selects negative half pi. The implementation
now preserves the zero's sign when selecting the quadrant. The fourteen-case
generated Wurst fixture checks forty actual emitted-Lua outputs against the
original routines, including zero-result signs through IEEE reciprocal.
It failed on the negative-zero angle before repair and passes afterward.
Evidence: smashcraft:build/signed-zero-before.log and
smashcraft:build/signed-zero-after.log. This verifies these scalar cases,
not all signed-zero behavior in the remaining physics formulas or native Warcraft.

The 16 recorded input cases cover cardinal axes, ordinary vectors, diagonals in
all four quadrants, a small vector angle, and direct axis angles. They yield 43
function outputs. All 16 focused Wurst tests and all 43 exact numeric comparisons
in actual generated Lua passed with compiler
`9913e1bd300c2053637d756a11bae8c3c8ed568f` and standard library
`bb1e0458db5a372ba2a6928112452785e435d01a`. Numeric equality here does not
distinguish the sign of zero. The ignored worker harness is at
`~/code/smashcraft/worktrees/retail-trig-math/build/scalar-math/check.sh` and
`~/code/smashcraft/worktrees/retail-trig-math/build/scalar-math/run.lua`.

The original scalar outputs were obtained under QEMU PPC750, not measured on
GameCube hardware. These checks establish agreement on the recorded scalar
cases, not exhaustive finite-domain equivalence or full-game physics fidelity.
