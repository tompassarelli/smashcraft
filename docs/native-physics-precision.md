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
simulation source 8bb5f06a0667efeb5b4c65a7dd724be48601799f:
~/code/wc3-melee/worktrees/melee-physics-public/build/physics-probe/native.lGt6cO/Smashcraft 0.0.13.w3x.
SHA-256: 95dd52a99b4b1b7931916aeadc50465281df627aa37924ec5449e7497ed58a8a.
The build reports zero errors and four standard-library unused-variable
warnings; packaged Lua syntax and script roundtrip pass. Evidence:
smashcraft:build/native-physics-launch-build.log. This candidate has not been
installed or run natively.

On map initialization, the same authored comparisons used by the emitted-Lua
precision check execute in Warcraft. Each report is a short independent Preload
record. A timer closes the report after initialization, exporting
Warcraft III/CustomMapData/smashcraft-native-physics-precision.txt in that
client's documents directory. The source marker identifies the simulation
commit, not a claim about native equivalence. NATIVE_PHYSICS_COMPLETED means
the report finished; acceptance also requires all expected comparison results.

For the current candidate, require a fresh export from the observed map load,
the source marker above, MESSAGES 13, LAUNCH_MAGNITUDE_MISMATCH_COUNT=0, no failure records, and all twelve passing groups:

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

The fixtures cover recorded fall positions, grounded launch friction, selected
shield arithmetic, airborne launch/recoil decay and position additions, signed
zero scalar cases, cutoff boundaries, and the four recoil cutoff state cases.
The flat-ground group additionally checks 22 composed arithmetic cases and
four shield-entry overwrite cases. The additional groups check 23 original
hitstun duration/damage-level observations and 50 launch magnitudes with 150
context adjustments. The fixtures execute production calculations inside Warcraft, without live fighter
models, controls or stage-contact observation. Passing would close the runtime
arithmetic boundary for these cases; it would not establish complete formulas,
collision geometry, action clocks, visual effects or playable-match acceptance.
Do not occupy or restart peer-owned clients to obtain this result.
