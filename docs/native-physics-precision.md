# Native arithmetic comparison

smashcraft:tools/physics-probe/build-native-precision.sh packages the production
Simulation, RollTravel and MeleeScalarMath sources with the existing numerical
comparison fixtures. It uses the locked compiler and standard library and
rejects uncommitted changes to those three simulation packages. All generated
sources and map outputs remain inside the owning worktree's build directory.
The private terrain input remains outside the repository.

Run the builder through the machine-capacity helper with the private terrain
map as its argument. It does not install a map or control a Warcraft client.

The current candidate is a one-player diagnostic map, Smashcraft 0.0.13,
simulation source d99141834e19518b47123dab5d7710bb6d64c0ba:
~/code/wc3-melee/worktrees/melee-physics-public/build/physics-probe/native.sWMwP6/Smashcraft 0.0.13.w3x.
SHA-256: 7589afc945c3409b39acb1cd92c04ae7fb9c4f790a2c9e0defe42620c3ba0aaf.
The build reports zero errors and four standard-library unused-variable
warnings; packaged Lua syntax and script roundtrip pass. Evidence:
smashcraft:build/capsule-native-map.log. This candidate has not been
installed or run natively.

The builder now includes a sixteenth group, CAPSULE_SHIELD_CLASSIFICATION_PASS,
covering 374 original capsule/shield classifications. The current candidate
requires MESSAGES 19 and that additional passing group.

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
