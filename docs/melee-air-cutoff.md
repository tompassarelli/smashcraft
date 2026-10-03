# Airborne decay cutoff

Production compares the rounded squared speed with a derived binary32 boundary,
instead of calling Warcraft SquareRoot. This preserves Melee's zero-or-decay
decision for its fixed 0.051 launch and 0.05 recoil constants. It does not replace
all square roots or establish full native physics fidelity.

The identified NTSC 1.02 executable has SHA-1
`08e0bf20134dfcb260699671004527b2d6bb1a45`. Its refinement block begins at
0x8006BAB4, uses double constants 0.5 and 3, performs three reciprocal-square-root
Newton refinements with fused subtraction, and rounds the final product to
binary32 at 0x8006BAF4. The equivalent launch block has the same operation
pattern. These are arithmetic facts, not reused game implementation code.

[IBM's frsqrte instruction reference](https://www.ibm.com/docs/en/aix/7.2.0?topic=set-frsqrte-floating-reciprocal-square-root-estimate-instruction)
specifies an initial relative error of at most 1/32, permitting variation across
implementations. For relative estimate error e, an exact Newton step produces
`-1.5e² - 0.5e³`. With double unit roundoff u = 2^-53, an allowance of 8u per
step bounds the rounded operations: the squared estimate contributes at most
1.064u before subtraction, the fused correction remains between about 1.936
and 2.062, and the final multiplication adds less than 1.1u in normalized
error. Multiplication by 0.5 is exact. All these double intermediates remain
normal for positive finite binary32 squared speeds.

Starting at 1/32, conservative relative error bounds after the three steps are
0.00149, 0.00000334, and 0.00000000001674. Including the final multiplication
leaves the relative square-root error below 0.00000000002. This argument uses
round-to-nearest, ties-to-even, matching the reference arithmetic.

Let d be the binary32 decay, p its previous representable value, and
M = (d+p)/2. A rounded speed is below d precisely on the lower side of M.
For these two constants M² is not a binary32 value. The closest squared speeds
on each side of M² remain on their respective sides even after the full error
bound. The generator verifies this with exact integer cross-products:

- `below × (1+E)² < M²`
- `above × (1-E)² > M²`

Here E = 1/50000000000. Since square root is monotonic and the bound applies
to every positive finite binary32 squared speed, farther inputs cannot cross
the cutoff either. Zero takes the zero branch directly.

Both decays lie in [1/32,1/16), with spacing U = 2^-28.
The identity `M² = d×p + U²/4` permits one binary32 fused multiply-add.
For these two fixed values that result is the first representable squared
speed above M²; comparing squared speed strictly below it therefore implements
the original decision. The derived boundaries are 0.0026009997818619013 for
launch and 0.0024999999441206455 for recoil. They are computed once at package
initialization. Using rounded d² instead would disagree on two recorded cases.
Changing the common decay constants requires revisiting this bounded identity.

smashcraft:docs/smash-melee-reference/retail-air-cutoff-boundaries.json records
eighteen vectors around the boundaries. Independently authored PPC square/sum
arithmetic supplies the input; the unchanged original refinement block executes
under QEMU PPC750, with only its return boundary patched in a private executable.
Original scalar routines and authored fused subtraction supply the nonzero
axes. This is not execution of the complete original gameplay function.
The error argument covers permissible hardware estimate variation separately;
it does not claim that QEMU reproduces the Gekko estimate itself.

smashcraft:tools/physics-probe/generate-air-cutoff-probe.mjs checks the bound and
exact boundary inequalities, then generates production movement assertions from
the corpus. All eighteen vector results pass in emitted Lua before and after
the replacement; the prior host-Lua SquareRoot matched these cases already.
The replacement removes this rule's dependence on the native SquareRoot result.
Evidence: smashcraft:build/air-cutoff-before.log and
smashcraft:build/air-cutoff-after.log. Native map execution and the other physics
rules remain separately unverified.
