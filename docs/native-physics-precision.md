# Native arithmetic comparison

smashcraft:tools/physics-probe/build-native-precision.sh packages the production
Simulation, RollTravel and MeleeScalarMath sources with the existing numerical
comparison fixtures. It uses the locked compiler and standard library and
rejects uncommitted changes to those three simulation packages. Authored generated fixture sources remain inside the owning worktree’s build
directory. Map intermediates and candidates remain in private build storage
outside the repository, alongside the private terrain input.

Run the builder through the machine-capacity helper with the private terrain
map and a distinct run ID (lowercase letters, digits and hyphens) as its arguments.
It emits `Smashcraft diagnostic RUN_ID.w3x` without advancing the playable release
version. The builder
includes the four-player simulation's input dependencies. It does not install
a map or control a Warcraft client.

The historical candidate is a one-player diagnostic map, Smashcraft 0.0.13,
simulation source 98cb2dff36e204d4c2af287731f4116602320fe5:
~/code/wc3-melee/worktrees/melee-physics-public/build/physics-probe/native.xTRUdu/Smashcraft 0.0.13.w3x.
SHA-256: a5ab1dd839cf3cda65052dd38de67c47298a611eb83e233a0b6cb4ef00709bc0.
The build reports zero errors and four existing standard-library warnings;
packaged Lua syntax and script roundtrip pass. The candidate includes the current
production uniform-scale collision fix and all 508 recorded capsule/shield
classifications. It has not been installed or run natively. The concurrent
multiplayer task retains ownership of the authenticated clients.

The subsequent ordinary-melee contact and surface-rebound eligibility changes
are not in this candidate. Rebuild from the final production source before
using a native result to identify the current implementation. These fixtures
still do not exercise fighter-to-fighter geometry or connected surface play.

Acceptance requires MESSAGES 19 and all sixteen groups below. Rebuilding this
candidate adds no comparison cases and does not claim native acceptance.

On map initialization, the same authored comparisons used by the emitted-Lua
precision check execute in Warcraft. Each report is a short independent Preload
record. A timer closes the report after initialization, exporting
Warcraft III/CustomMapData/smashcraft-native-physics-precision.txt in that
client's documents directory. The source marker identifies the simulation
commit, not a claim about native equivalence. NATIVE_PHYSICS_COMPLETED means
the report finished; acceptance also requires all expected comparison results.

For the current candidate, require a fresh export from the observed map load,
the source marker above, MESSAGES 19, LAUNCH_MAGNITUDE_MISMATCH_COUNT=0,
DIRECTIONAL_INFLUENCE_MISMATCH_COUNT=0,
DIRECTIONAL_INFLUENCE_DISCRETE_MISMATCH_COUNT=0, no failure records, and all sixteen passing groups:

- GROUNDED_BINARY32_EXACT_PASS
- SHIELD_REGEN_BINARY32_EXACT_PASS
- SHIELD_DAMAGE_BINARY32_EXACT_PASS
- SHIELD_STUN_BINARY32_EXACT_PASS
- SHIELD_CONTACT_SUM_BINARY32_EXACT_PASS
- RECORDED_FALL_TEN_FRAMES_BINARY32_EXACT_PASS
- AIR_DECREMENT_BINARY32_EXACT_PASS
- SIGNED_ZERO_SCALARS_EXACT_PASS
- AIR_CUTOFF_BINARY32_EXACT_PASS
- GROUND_MOTION_BINARY32_EXACT_PASS
- HITSTUN_BOUNDARIES_EXACT_PASS
- LAUNCH_MAGNITUDE_BINARY32_EXACT_PASS
- HITLAG_SCALARS_EXACT_PASS
- ANALOG_SHIELD_BINARY32_EXACT_PASS
- DIRECTIONAL_INFLUENCE_BINARY32_EXACT_PASS
- CAPSULE_SHIELD_CLASSIFICATION_PASS

The fixtures cover recorded fall positions, grounded launch friction, selected
shield arithmetic, airborne launch/recoil decay and position additions, signed
zero scalar cases, cutoff boundaries, and the four recoil cutoff state cases.
The flat-ground group additionally checks 22 composed arithmetic cases and
four shield-entry overwrite cases. The additional groups check 23 original
hitstun duration/damage-level observations and 50 launch magnitudes with 150
context adjustments, 52 capped hitlag outputs, and 54 analog shield rows.
The analog group covers pressure, drain, stun, damage, shared size scaling and
pushback arithmetic, including twelve ordinary/perfect pushback outputs. It
does not test geometric shielding, complete contact response or physical input.
The fixtures execute production calculations inside Warcraft, without live fighter
models, controls or stage-contact observation. Passing would close the runtime
arithmetic boundary for these cases; it would not establish complete formulas,
collision geometry, action clocks, visual effects or playable-match acceptance.
Do not occupy or restart peer-owned clients to obtain this result.

The current candidate includes 56 original DI vectors. The emitted-Lua check
observes all 56 matching
vectors; see smashcraft:docs/smash-melee-reference/retail-di-vector.json for the
original execution boundary and limitations.


The current-source arithmetic candidate is Smashcraft 0.0.33, source
`7fd7c9debc50fa455167587a98aa6c0b48cb54fa`, built with compiler
`6b129956f6e7cf9582510f26b99d305526bf3ded`. Candidate:
~/.local/share/smashcraft-build-inputs/native-physics-activation-20261004/native.A4CCF6/Smashcraft 0.0.33.w3x.
SHA256: `197e0d4148c0f0680bc5b6b6513b836fbdc90505a36eea3a2f24d4e86e28036c`.
Compilation reports zero errors and four warnings; Lua syntax and packaged-script
comparison pass. Native execution failed on the retained Warcraft client. Both stale diagnostic contact
calls now use the production fighter roster API. Current acceptance uses the
same sixteen groups and nineteen messages above, with this new source marker.


## Native 0.0.33 counterexample

A fresh one-player load exported source 7fd7c9debc50fa455167587a98aa6c0b48cb54fa,
MESSAGES 689 and NATIVE_PHYSICS_FAIL. The export contains only source/count/final
verdict; individual initialization-phase Preload records were not retained. Emitted initialization order does not establish why.
Fresh screen OCR includes SHIELD_CONTACT_SUM_BINARY32_EXACT_FAIL, recorded fall
failures for frames -54 through -50, and SIGNED_ZERO_SIGN_1_angle_FAIL. Some
fixture groups print PASS even after individual FAIL messages, so those banners
do not establish passing groups. No arithmetic/native fidelity acceptance.

Evidence: wc3-melee:evidence/native-physics-precision-20261004/native0033.txt and
wc3-melee:evidence/native-physics-precision-20261004/native0033-screen.txt.
The next diagnostic buffers results and starts/writes/closes its export together in the timer; native execution must verify retained individual results and truthful group verdicts,
then separate fixture expectations from production/Lua32 arithmetic failures.
A scoped child owns that repair and a 0.0.35 candidate; this root owns native
client access. Peer communications remain stopped.


## Complete native 0.0.35 export

The repaired diagnostic candidate uses source
`ac26f22aa81f75ebc350a85324f38152f41f230c`, SHA256
`0bc8b9280c1aa9377e5f638e8ff0ed5b8bc982ca2a3309da9c9cffafa7fdc1e2`.
It buffers initialization results and exports them together after initialization.
A fresh one-player native load retains 700 diagnostic messages and the final
failure verdict. Six groups pass: grounded friction, shield regeneration,
shield damage, shield stun, hitlag scalars, and hitstun boundaries. The others
fail, including capsule/shield classification, analog shielding, launch,
directional influence, ground motion, air arithmetic, recorded fall and signed
zero. The export reports launch mismatch count 119, DI mismatch count 21 and
discrete DI mismatch count 15. These are comparison-case counts, not a whole-game
fidelity percentage.

Full authored numerical evidence:
wc3-melee:evidence/native-physics-precision-20261004/native0035.txt.
The reporting repair succeeds; production arithmetic acceptance fails.
Local IEEE Lua32 reproduces a subset of failures from non-reversible world-unit
scaling by six and back. The compiler repository also records Warcraft 3.0
arithmetic-result truncation rather than ordinary IEEE rounding; this explains
why Lua64 and IEEE Lua32 checks cannot substitute for the native comparison.
The exact production repair is still pending. No tests or comparison criteria
have been weakened.

## Capsule arithmetic repair — 5 October 2026

The retained 0.0.35 export includes capsule/shield classification failures.
The production `capsuleCircleIntersects` routine still evaluated subtraction,
multiplication, addition and division before calling `roundToFloat32`. On the
native runtime, that call cannot recover bits already lost by the operation.
It now passes the operands separately to the pinned standard library's
`subtractFloat32`, `multiplyFloat32`, `addFloat32` and `divideFloat32`. Existing
fused operations, square-root calls, contact thresholds, transform order and
authored fighter dimensions are preserved. No reference implementation was
copied and no recorded expectation changed.

The focused check compiled the production packages plus the output of
wc3-melee:tools/physics-probe/generate-capsule-probe.mjs, then ran only
`init_CapsuleShieldPrecisionProbe` through the existing Lua test shim.
All 508 classifications passed in Lua 5.3; compilation reported zero errors
and zero warnings. It used compiler `6b129956f6e7cf9582510f26b99d305526bf3ded`,
stdlib `e3714f629113ee682353c3244065fee3e7d9ae16`, and test shim
`1f36fff43a4987bc133c676072ee396f15294aa0` from the unchanged lock. The local
invocation and result are retained at
~/code/wc3-melee/worktrees/physics-scale-20261005/build/physics-probe/check-capsule.sh
and
~/code/wc3-melee/worktrees/physics-scale-20261005/build/physics-probe/capsule-compile.log.

This is a bounded capsule/shield calculation repair. Native re-execution of
the existing 508 authored comparisons remains required; the generated inputs
are unchanged. It does not repair the separate motion representation gap:
wc3-melee:evidence/native-physics-precision-20261004/native0037-analysis.json retains
frame 6's stored world velocity `-7.1399993896484375`, versus the direct sum
`-7.139999866485596` of the same operands. That observation does not measure
an independently maintained trajectory in original units. Repeated scaling
to six world units and back still loses information, and the complete native
precision criterion remains open.

## Original-unit motion accumulation — 5 October 2026

Position accumulation and gravity-driven vertical velocity now retain their
binary32 values in original units between integration steps. World X/Z and
vertical velocity remain available at the intentional six-unit scale. An
intervening world-coordinate write is imported at the next integration;
unchanged projected coordinates are not divided back into the accumulator.
Landing, solid-surface contact and stock reset establish new motion origins.
Snapshots copy the retained values and their last published coordinates, and
both first-difference reporting and canonical replay state include them.

The exact ten-position recorded Falco fall is the trajectory oracle. The
native fall fixture now supplies its recorded initial position through the
original-unit setter and checks each retained position as well as the existing
world-coordinate comparison. Its recorded values and contact/grounding checks
are unchanged. Native0037's direct addition of stored world operands is not
the original-unit oracle; frame 6's projected velocity need not change when
the original trajectory is retained correctly.

Two authored aerial-dodge checks previously accumulated their expected
positions by repeatedly dividing projected coordinates by six. They now
accumulate in original units, with force, decay, action-clock assertions and
tolerances unchanged. The independent 29-step binary32 recurrence starts at
Z=50 and decays the launch velocity by 0.8999999761581421 each tick. Its upward
endpoint is 68.79904174804688, published as 412.79425048828125 in binary32 world
coordinates; the previous repeated-conversion endpoint was
412.7943115234375. These are authored arithmetic expectations, not new native
or original-game observations.

This repair does not recover information lost before a scaled tuning value or
authored velocity enters the accumulator. For example, binary32 scaling of
terminal speed 3.0999999046325684 to six world units yields
18.599998474121094; converting that stored value back gives
3.0999996662139893. Ground acceleration, launch/recoil decay and authored
action calculations still have their existing world-valued interfaces.
Native execution of the repaired trajectory and those remaining ingress and
scalar boundaries are not established by source checks.

Validation: `bash ~/code/wc3-melee/worktrees/physics-scale-20261005/test.sh PhysicsTests 90`
passed 71/71 tests with zero compiler errors and nine warnings. This includes
the ten exact recorded positions, adoption of world-coordinate edits, reset,
and replay restored after six fall steps; changing one retained position ULP
is visible to first-difference and canonical-state comparison. The initial
69/71 run exposed the two old aerial-dodge position expectations above; both
pass with original-unit expectations and unchanged tolerances. Logs are
~/code/wc3-melee/worktrees/physics-scale-20261005/build/wurst-tests/canonical-motion.log
and
~/code/wc3-melee/worktrees/physics-scale-20261005/build/wurst-tests/canonical-motion-repaired.log.
The locked compiler and standard library are unchanged. No map build or native
client was run for this repair.
