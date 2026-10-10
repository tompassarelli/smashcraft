# Physics reference and implementation

## Moving platforms

Smashcraft's moving decks follow closed paths of timed linear legs, including
stationary legs for waits. The match frame chooses a binary32 pose directly;
rollback and prediction use that same frame, with no accumulated stage timer.
The main deck stays fixed. Hidden test stages 3 and 4 provide a Smashville-style
back-and-forth platform and independent loop/lift patterns.

Grounded fighters ride their floor before their own motion, including hitlag,
as Melee's `Fighter_procUpdate` adds `mpGetSpeed` to grounded position
(melee:src/melee/ft/fighter.c). Grounded traps and bears ride the same way,
following grounded items in melee:src/melee/it/item.c. Landing remaps the
previous endpoint by the floor's displacement (`mpCheckFloorRemap` in
melee:src/melee/mp/mplib.c); an already carried fighter is not shifted twice.
Down presses retain Melee's pass-through gate, and floor tech recovery rides
the platform. Moving raised platforms have no ledge: Melee's Stadium platform
line 0 and Icicle Mountain lines 0–2 have `LINE_FLAG_PLATFORM` without
`LINE_FLAG_LEDGE` (GrSt.dat/GrIz.dat). Main-deck ledges retain their usual catch
rules. Path dimensions and schedules are authored here; they are inspired by
Ultimate's layouts, without claiming Ultimate's exact timing.

The live simulation is smashcraft:ts/src/game/sim/. The numerical fixture suites
are smashcraft:ts/src/game/sim/physicsPrecisionState.tests.ts,
smashcraft:ts/src/game/sim/physicsPrecisionScalar.tests.ts and
smashcraft:ts/src/game/sim/physicsPrecisionMotion.tests.ts; their headless and
native commands are in smashcraft:docs/native-physics-precision.md.
Wurst source paths, compiler pins and test results below describe their
recorded historical revisions.

## Analog shield pressure and hitlag observations — 2026-10-04

The existing analog trigger bytes now preserve shield strength through input,
guard drain, contact damage/stun/pushback, relative visual size and replay.
Digital clicks remain full strength; analog pressure activates at byte 77.
The 54 original pressure/health/contact rows match production emitted Lua.
Four connected tests cover input thresholds, minimum hold, contact freezes and
replay restoration. Details and boundaries:
smashcraft:docs/melee-analog-shield.md. Projectile powershield input timing and
reflection are now implemented against an authored SmashCraft shield circle.
Melee perfect contacts also preserve shield health, use the observed unmodified
defender pushback with the same cap/stun, and emit a success flash. Their
four-sample timer is replayed; full callback ordering and post-contact
actionability still need verification. Twelve ordinary/perfect contact pushback
observations match emitted Lua alongside the existing 54 analog rows;
ordinary melee shield geometry/pokes/tilt, physical analog capture and native
verification remain open. See smashcraft:docs/melee-powershield.md.

The original capped hitlag calculation also matches 52 ordinary/electric and
crouching observations without a production formula change; see
smashcraft:docs/melee-hitlag-scalars.md. Ordinary/fixed launch matches 50
magnitudes and 150 context adjustments, and hitstun matches 23 duration/level
observations. These scalar checks do not establish ordered gameplay traces.
The assembled emitted-Lua probe passes fourteen groups with zero errors or
warnings; the normal simulation suite passes 592/592 with one existing
unused-import warning. Evidence:
smashcraft:build/analog-precision-integration.log and
smashcraft:build/analog-normal-integration.log.

## Flat-ground displacement and shield-motion arithmetic — 2026-10-04

Ordinary flat-ground displacement now rounds self movement, launch and attacker
recoil additions separately in that order. Digital defender and attacker ground
decrements also round their operands, friction product and results. A shield
contact replaces prior self ground speed rather than adding pushback to it.
Original fighter tuning is unchanged, and stale moves stay omitted
(smashcraft:docs/gameplay-design.md).

The independently observed corpus in
smashcraft:docs/smash-melee-reference/retail-ground-motion.json contains 22
composed original arithmetic cases and four original shield-entry store cases.
The production emitted-Lua comparison reported 30 mismatches before repair
and passes afterward; see smashcraft:docs/melee-ground-motion.md for operation
addresses, comparison details and limitations. The integrated normal Tests
filter passes 534/534, zero errors and one existing unused-import warning:
smashcraft:build/ground-motion-integration-tests.log. This does not prove slopes,
faster-than-walk friction branches, shield contact magnitudes, full original
trajectories or native gameplay. The native arithmetic diagnostic builder now
includes these cases; its runtime acceptance remains open.

## Airborne recoil cutoff state correction — 2026-10-04

The original below-cutoff recoil branch clears horizontal attacker recoil and
vertical launch, retaining vertical attacker recoil and horizontal launch.
Four private executions of its unchanged comparison/stores confirm these
numeric state effects. Production now applies launch decay before recoil decay
and preserves this retail interaction, while skipping an empty recoil vector.
The numerical facts and scope are in
smashcraft:docs/smash-melee-reference/retail-air-recoil-cutoff-state.json and
smashcraft:docs/melee-air-cutoff.md.

The previous cutoff fixture incorrectly composed both recoil axes as zero
below the boundary; it did not execute the original cutoff stores. Its
classification proof remains valid. Corrected emitted-Lua comparisons failed
on recoil boundary case 9 before repair and pass all eighteen boundary cases
plus four cross-channel cases afterward. Evidence:
smashcraft:build/recoil-cutoff-state-before.log and
smashcraft:build/recoil-cutoff-state-after.log. PhysicsTests pass 64/64 with zero
errors and one existing warning; evidence is
smashcraft:build/recoil-cutoff-state-physics-tests.log. Native gameplay remains unverified.

## Exact airborne below-cutoff-or-decay decision — 2026-10-04

Airborne launch and attacker recoil now compare their binary32 squared speed
with a derived boundary instead of invoking Warcraft SquareRoot. The original
three-refinement arithmetic, IBM's estimate accuracy contract, and exact integer
boundary inequalities establish the same below-cutoff-or-decay decision for the two
fixed retail constants under round-to-nearest. The derivation and its scope are
in smashcraft:docs/melee-air-cutoff.md.

Eighteen vectors around both boundaries match the original refinement block
and scalar routines in emitted Lua. Below-cutoff state composition was corrected
as described above; the earlier check did not establish the recoil stores. The original
refinement runs privately under QEMU with only its return boundary patched.
The error argument covers permissible estimate variation separately; it does
not assume that QEMU's estimate equals Gekko's. The previous host-Lua square
root also passed these cases; the replacement removes the native dependency
for this rule. PhysicsTests pass 64/64. Other square-root uses and native map
verification remain unfinished.

## Airborne attacker recoil arithmetic — 2026-10-04

The retail recoil branch at 0x8006BA98 calls atan2f; 0x8006BA9C rounds the
vertical square and 0x8006BAA8 fuses the horizontal square-plus-sum. Cosine and
sine calls at 0x8006BB24/0x8006BB40 feed axis `fnmsubs` at
0x8006BB34/0x8006BB50, both loading common +0x3E8. These numeric operation
facts identify the same direction/subtraction pattern as airborne launch decay.
Production now shares that calculation, with the separate recoil decay
0.05000000074505806 Melee units.

smashcraft:docs/smash-melee-reference/retail-air-recoil-decrement.json records
eleven above-cutoff vectors from original scalar execution and independently
authored PPC subtraction. The emitted-Lua production probe failed on the first
recoil case before repair and passes all 22 recoil axes afterward, alongside
the 22 launch axes and 22 resulting horizontal positions. Evidence:
smashcraft:build/air-recoil-before.log and smashcraft:build/air-recoil-after.log.
This is not execution of the original gameplay routine. The below-cutoff decision
uses the verified derived boundary above; native recoil remains unverified.

## Airborne horizontal position order — 2026-10-04

Ordinary airborne horizontal position now adds self velocity, launch velocity,
then attacker shield recoil separately, rounding each addition in Melee units.
Airborne defender shield pushback is already cleared before this phase.
Grounded motion, sampled ground rolls, and recovery displacement remain on
their existing paths and need separate source-order verification.

The emitted-Lua axis probe also checks eleven resulting horizontal positions
from initial Melee x = -60 and self velocity = 0.25, using the independently
recorded launch-axis outputs. Expected additions use IEEE binary32 arithmetic,
not a recorded full-game position trace. The first case failed before the
position repair; all eleven pass afterward. Evidence:
smashcraft:build/air-position-before.log and smashcraft:build/air-position-after.log.
This does not establish native collision or trajectory fidelity.

## Airborne knockback axis arithmetic — 2026-10-04

Airborne launch decay now converts the velocity operands to binary32 Melee
units, rounds the vertical square, uses one fused horizontal square-plus-sum,
and compares the rounded speed with the retail decay using strict less-than.
Above the cutoff it computes the direction using the independently authored
Melee scalar approximation and subtracts each decay component with one fused
rounding. It preserves the original tiny cardinal-axis residues instead of
forcing those axes to zero through radial rescaling.

smashcraft:docs/smash-melee-reference/retail-air-axis-decrement.json records
eleven above-cutoff vectors. Their direction values come from original scalar
routines executed under QEMU PPC750; their final axes come from independently
authored PPC `fnmsubs` arithmetic. This does not execute the original gameplay
function. The production emitted-Lua probe failed on case zero before the
repair and passes all 22 exact axis outputs afterward. Evidence:
smashcraft:build/air-decay-before.log and smashcraft:build/air-decay-after.log.

The cutoff uses the derived squared-speed boundary described above. Native
trajectories remain unverified.

## Recorded vertical precision — 2026-10-04

Ordinary gravity subtraction now rounds both operands and the result in Melee
units. Vertical position adds self velocity, then launch velocity, then attacker
shield recoil, rounding each addition separately. Shield-break falling uses
the same gravity and position arithmetic. Zero displacement preserves authored
stationary surface coordinates exactly. Original fighter stats remain authored.

The emitted-Lua probe generated from
smashcraft:docs/smash-melee-reference/slippi-ntsc-falco-fall.json failed on its
first recorded frame before the repair and passes all ten exact positions on
both original fighter hosts afterward. Only recorded gravity and terminal speed
are injected; these are test rigs, not roster changes. Evidence:
smashcraft:build/gravity-lua-before.log and smashcraft:build/gravity-lua-after.log.

The probe uses the compiler-owned Lua native fixture pinned separately by
`luaTestRuntimeCommit` in smashcraft:wurst-toolchain.lock. Its SquareRoot repair
does not change the compiler artifact and does not establish Warcraft native
square-root precision. Shared scalar approximations and their bounded proof
are documented in smashcraft:docs/melee-scalar-math.md; Gekko square-root cutoff
behavior, horizontal position order, and native
trajectory verification remain open.

## Verified retail combat parameters — 2026-10-03

Ordinary launching contacts now use the independently recorded GALE01 revision 2
common parameters. The private reference's main.dol SHA-1 is
`08e0bf20134dfcb260699671004527b2d6bb1a45`; the PlCo common-data root is data offset
`0x9FC0`, with a `0x20` archive header. Original game files remain outside this
repository. Numerical facts and behavioral observations alone inform this
independently authored Wurst implementation. The gameplay source at
melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c,
melee:src/melee/ft/fighter.c and melee:src/melee/ft/ftcommon.c, revision
`0296f009f32f710495979d30772d8332af2d411a`, supplies use-site facts; no license
covering that gameplay implementation was found and none is copied or translated.

The adopted values are +0xFC = 10 moving frames before launch merging,
+0x100 = 0.029999999329447746 launch speed per knockback unit,
+0x154 = 0.4000000059604645 hitstun frames per knockback unit, and
+0x158/+0x15C/+0x160 = 10/21/32 for the four damage reaction levels. Levels are
selected from the unrounded scaled knockback; the stun counter truncates it,
with a minimum of one. The fourth level selects tumble. Common flat-ground
knockback friction +0x200 = 1 multiplies the fighter's traction.

During the first nine moving frames since a launch, a new launch replaces the
old vector. Starting on frame ten, opposite components add and same-direction
components keep the greater magnitude, independently on each axis. The age
freezes during hitlag and advances on the frame hitlag expires. The contact
batch first chooses its strongest launch, then merges it once with residual
motion. Hitstun and reaction level belong to the new winning hit. The saved age
saturates at ten because later values do not affect this decision.

A grounded, downward or horizontal hit below tumble strength stays on the
floor. Its new tangent velocity is retained separately from the transient
merged vector so the next ground step decays the actual new ground launch.
An upward hit leaves the ground. A tumble-strength hit more than
0.1745329201221466 radians (+0x1E8) below the flat floor reflects its vertical
component upward by 0.800000011920929 (+0x1EC), retaining horizontal speed.
Shallower downward tumble launches remain downward for ordinary collision
resolution. Airborne targets do not receive this contact-time floor bounce.
These rules preserve the original roster's authored weights, traction, move
power and direction vectors; no reference fighter is added to the roster.

Replay copying and exact comparison include the age, ground tangent velocity
and damage level. Reset and stock loss clear them; launch-clearing actions also
clear the tangent channel. Focused tests exercise the nine/ten-frame boundary,
frozen age, axis merging, strongest-contact selection, ground traction,
all three damage-level thresholds, nine/eleven-degree floor launches and exact
snapshot restoration. Their synthetic expected values are arithmetic checks,
not newly captured game traces. The existing independent grounded-damage and
movement recordings remain part of the same physics test package.
`bash test.sh PhysicsTests` passed **48/48**, with zero compiler errors and one
existing unused-import warning; evidence is
smashcraft:build/retail-combat-tests.log. Exact retention checks preserve the
pre-contact vector rather than approximating its accumulated float32 decay.

This change covers contact-time launch selection and flat-floor attenuation.
General wall/ceiling geometry, collision-time rebounds/landing limits, analog
input, and special damage states are separate seams. No full-combat parity or
native game observation is claimed by these focused checks.

## Grounded digital shield correction — 2026-10-03

Production contact resolution now assigns defender shield pushback and direct
grounded-attacker recoil to separate motion channels. Held movement and launch
knockback retain their own values. Both shield channels freeze during hitlag,
then resume on its zero frame; defender motion decays by the actor's traction,
and grounded attacker recoil uses the sampled 1.1 traction factor. A later
clean hit, shield break or respawn clears the interrupted shield motion.
Replay snapshots copy and compare both channels and the shield-drain transition.

The paired reference below passes through the actual contact queue and
production `advance`, assigning Jigglypuff traction to the defender and Sheik
traction to the attacker across all Rifleman host combinations. It
checks contact health/stun/freeze, nine successive positions, guard-transition
drain timing, contact direction, detached sources and a perturbed recoil that
is detected at the first released frame. Position tolerance is 0.001 world
units; contact speed and shield-health tolerance is 0.0001. The final focused
shield suite passed **45/45** and the final aggregate passed **427/427**, zero
errors and one existing unused-import warning
(smashcraft:build/physics-shield-tests.log). The integrated Wurst sources are
identical to that checked final result; no redundant aggregate was run.

This verifies one grounded digital-contact case, not complete shielding parity.
Airborne attacker recoil remains unsupported and these grounded channels clear
on leaving the floor. Analog/powershield rules, raw common-table/revision
identity, cap/stacking cases, broader contact/actionability comparisons and
native play remain required. The cap of two Melee units follows the published
formula but is not exercised by this recording. Original playable fighter
stats and moves were not retuned by this change.

Map `melee-physics-foundation-r7` built with zero errors and six existing
warnings; Lua syntax and packaged script/assets checks passed
(smashcraft:build/physics-map-r7.log). The 16,092,788-byte artifact has SHA-256
`1e6adac28e3933d75fcd3c047536b7a4f96d5d9b5e56622f78a97515368c8a95`.
It is installed as `Smashcraft_Melee_Physics_r7.w3x` in
`~/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps`,
compared byte-for-byte with the build. Existing candidates and concurrent
clients remain preserved. Native r7 gameplay has not been observed.

## Paired digital shield reference — 2026-10-03

smashcraft:docs/smash-melee-reference/slippi-ntsc-shield-contact.json retains
twelve original states around Sheik's jab against Jigglypuff's full digital
shield on Final Destination, frames 10523–10534 of the public `air_dodge.slp`
fixture. Both inputs are neutral horizontally. The retained numerical fields
match the original parser output; the frame-data corpus
(smashcraft:references/melee-frame-data/records.jsonl) reports four damage and
three shieldstun frames for the jab.

Contact frame 10525 reports four hitlag frames. Both actors remain stationary
through 10528, then move on frame 10529 when hitlag reaches zero. The defender
starts with ground speed 0.45600005984306335 Melee units/frame and decays by
approximately 0.09 each released step. The attacker moves by approximately
−0.212, −0.124 and −0.036 units on its first three released steps. Slippi's
exported self-induced speeds omit that separate attacker recoil velocity, so
the attacker's positions are the relevant evidence. GuardSetOff occupies
released frames 10529–10531; Guard resumes at 10532, while ordinary held drain
resumes at 10533.

The published factual formulas at https://www.ssbwiki.com/Shield#Shield_pushback
give digital defender pushback `min(2, (integerDamage * 0.09 + 0.4) * 0.6)` and
attacker recoil `integerDamage * 0.07 + 0.02`. This four-damage contact agrees
with defender speed 0.456 and initial attacker recoil 0.3. The recorded
attacker decay is 0.088; the decompile's layout identifies a separate attacker
ground-friction multiplier at +0x3EC. Raw common values and game revision are
still unresolved. The published Jigglypuff DAT JSON independently supplies
traction 0.09000000357627869 and walk maximum 0.699999988079071. Defender
pushback starts below that walk maximum and decays by ordinary actor traction;
using Fox/Falco traction 0.08 and compensating with a 1.125 multiplier would
produce a passing trace with the wrong shared rule. The fixture must assign
the observation's actual character parameters. This recording identifies
NTSC, not a verified NTSC 1.02
disc or unmodified gameplay build. Analog shielding, powershields, defender
cap behavior and airborne attacker recoil are outside this excerpt.

## Original fighter tuning and reference test rigs — 2026-10-03

Smashcraft's fighters are original characters, and Melee physics verification
concerns shared equations and state rules (smashcraft:docs/gameplay-design.md,
"Principles"). Historical source mappings below describe prior work.

smashcraft:wurst/Simulation.wurst now gives each actor a `fighterPhysics` value
with weight, gravity, terminal/fast-fall speeds, drift and friction/caps,
ground speeds/traction, jump parameters and shield-break speed. Shared physics
uses those actor parameters. Named Rifleman and Demon Hunter defaults
preserve current numerical tuning; this separation makes no new balance choice.
Character identity continues to select authored moves and presentation. Illidan's
movement conveniences remain explicit behavior, and roll/move data are
still their authored, separate mechanics.

The Falco parameter rig exists only in smashcraft:wurst/PhysicsTests.wurst.
Recorded fall/jump comparisons explicitly assign the original-game values to
both Rifleman host actors. They no longer rely on Rifleman's defaults
happening to match. Tests also exercise different gravity, jump timing/speeds
and damage-contact weight on the same host identity. Parameters are copied by
value in replay snapshots, participate in replay equality, and survive respawn.
An older test which changed only character ID now assigns its intended Demon
Hunter parameters explicitly.

The integrated suite passed **423/423**, zero errors and one existing unused-
import warning (smashcraft:build/physics-parameters-tests.log). The source merge
adds no further simulation changes beyond that checked commit. Original-game
reference revision gaps, broader physics cases and native gameplay remain
unresolved; a correct test rig enables those checks and does not itself prove
the entire Melee physics foundation.

Map `melee-physics-foundation-r6` built with zero errors and six existing
warnings; Lua syntax and packaged script/assets checks passed
(smashcraft:build/physics-map-r6.log). It was installed under the unique filename
`Smashcraft_Melee_Physics_r6.w3x` in
`~/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps`
and compared byte-for-byte with the build. Existing candidates and concurrent
clients remain preserved. Native r6 gameplay has not been observed.

## Recorded grounded damage correction — 2026-10-03

The production simulation now resumes physics, input gates and state countdowns
on the frame hitlag reaches zero. The previous branch decremented to zero and
returned, adding one frozen frame. The boundary is shared by ordinary damage,
grab pause, ledge and shield-break progression; release DI/ASDI occurs before
resumed physics. Existing exact freeze-frame expectations were updated to that
boundary without changing their numerical tolerances.

Grounded knockback on the current flat surfaces now decays by ground traction,
clamps to zero without reversing, and has zero vertical knockback. Airborne
knockback retains radial decay of 0.051 Melee units/frame. The earlier code
applied airborne decay to both states.

smashcraft:docs/smash-melee-reference/slippi-ntsc-grounded-damage.json records
Captain Falcon's grounded damage state on frames 3432–3445 of the public
Slippi `techTester.slp` fixture. Frame 3436 has zero hitlag, hitstun countdown 9
and resumed displacement. Before repair our countdown remained 10. The first
released knockback velocity should be 4.05764687 world units/frame; the old
ground decay produced approximately 4.23164677. Published Captain Falcon
traction +0x18 is 0.07999999821186066, exactly matching the extracted Fox/Falco
profiles used for this shared-rule comparison.

The full production fixture compares thirteen successive states: frozen frames,
release, horizontal displacement/velocity, hitstun expiry and crouch/actionability.
It detects deliberately perturbed knockback on original frame 3433. Position
tolerance is 0.0001 world units and velocity tolerance is 0.00001; floor origin
is normalized. The fourteen retained states and traction were checked against
their original intake fields. The assembled suite passed **419/419**, zero
compiler errors and one existing unused-import warning
(smashcraft:build/physics-grounded-release-aggregate.log).

This is a bounded recorded comparison, not full NTSC 1.02 acceptance. The source
is NTSC but its disc revision and modification status are unknown. It begins
after accepted launch, so it does not verify the move's damage/weight formula,
DI/SDI, tumble, shields or whole-character movement. Common multiplier +0x200
has not been independently extracted; the recording supports the effective
traction product for this flat-floor case. Sloped surfaces, wall/ceiling bounces,
remaining common values and native gameplay remain unresolved. Independently
authored Wurst uses factual observations, with no copied gameplay implementation.

Map `melee-physics-foundation-r5` built with zero errors and six existing
warnings. Existing Lua syntax and packaged script/assets checks passed
(smashcraft:build/physics-map-r5.log). The unique candidate was installed as
`~/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps/Smashcraft_Melee_Physics_r5.w3x`
and compared byte-for-byte with the build. Earlier candidates remain available.
The two existing Warcraft clients/private desktops belong to concurrent work;
they were preserved. Native r5 gameplay has not been observed.

## Physics integration — 2026-10-03

The physics changes were reconciled with public `main` in
~/code/smashcraft/worktrees/melee-physics-public, retaining its two-fighter
interfaces. The aggregate passed **402/402** tests with zero compiler errors
(smashcraft:build/physics-public.log). The focused snapshot test then passed
**1/1**, including nonzero crouch and roll-entry-facing restoration
(smashcraft:build/physics-replay.log). The map `melee-physics-foundation-r1`
built with zero compiler errors and six warnings; source staging, Lua syntax
and packaged script/assets passed the existing build checks
(smashcraft:build/physics-map.log). Native gameplay of this build remains
unobserved. Earlier checkpoint logs below describe their named historical builds.

The isolated development source passed 497/497 before this pass and 504/504
after the combined corrections. Its unrelated networking/presentation changes
are not part of this physics merge, and the concurrent development tree was
not modified. Numerical agreement in these tests does not establish NTSC 1.02
equivalence without the missing parameters and original-game comparisons.

| Rule group | Implemented and checked | Still required for parity |
| --- | --- | --- |
| Movement | Extracted jump speeds, full squat duration, ground/aerial entry ordering, takeoff momentum, air drift/overspeed, sampled roll travel, persistent fast-fall state, and five recorded dash-braking updates | Revision identity, complete frame trajectories, dash/run/turn common values and transitions, walk acceleration, and full EscapeAir animation/fall-special transition parity |
| Damage | Integer individual hit power, fractional same-frame total, strongest-contact selection, fixed knockback, cap, sampled crouch/smash modifiers and recorded flat-ground traction decay | Common-table confirmation, successive-frame stacking and other grounded surface conditions |
| Hitlag/hitstun | Separate counters, electric effects carried through contact resolution, crouch arithmetic, direct/detached source pause and recorded same-frame hitlag release | Broader original-game ordered traces, revision identity and verified common values |
| Shields | Integer shieldstun power, shield-break launch speed, recorded grounded digital defender pushback/attacker recoil and guard-drain timing; airborne attacker recoil initializes from common +0x7D4 `hit_weight_mul`, retains a separate x/z vector, decays by common +0x3E8, and is included in replay; bounded powershield timer plus swept-circle projectile reflection, replayed source visual family and reflection cue | Ordinary melee powershield contacts, shield geometry/pokes/tilt, physical analog capture and broader paired displacement/actionability traces |
| DI/recovery | Actual-vector DI normalization, grounded non-upward launch selection, existing floor tech/miss-tech/getup and sampled roll paths | Ground-bounce values, wall/ceiling collision geometry, tumble exceptions and threshold/tech traces |
| Replay/map | Crouch and roll-entry-facing snapshot restoration; map compilation and packaging | Native connected movement/contact/recovery check of this build |

The parameter corpus and explicit missing offsets are in
smashcraft:docs/smash-melee-reference/physics-parameters.json. The local retail
NTSC 1.02 reference identifies main DOL SHA1
`08e0bf20134dfcb260699671004527b2d6bb1a45` and PlCo SHA1
`c904de0c4c5eb3ef65211a75d8bd70ca5b0f9f41`; common +0x7D4, +0x3E8 and
+0x3EC are now confirmed from that table. Published character dumps still lack
disc-revision metadata, and other missing values are not filled by guesses.
Illidan keeps his original tuning; the digital dodge and
fast-fall controls and the absence of stale moves are owner decisions in
smashcraft:docs/gameplay-design.md.

Airborne shield contact adds a per-axis relative-motion term scaled by
`min(defender weight / attacker weight, 1) × hit_weight_mul`; common +0x7D4
sets `hit_weight_mul` to 0.25. Same-direction movement subtracts the attacker's
step from the defender's; opposing movement uses the defender's step. This is
covered by a production-step contact test, including both weight-ratio ranges
and accumulation. The retained Slippi airborne contact still does not expose
the recoil vector, so the formula is source-derived rather than directly
validated against that trace.

Airborne shield recoil uses common +0x3E8 = 0.05 Melee units per frame; on
flat-ground contact the horizontal channel uses traction × common +0x3EC = 1.1,
and its vertical component is discarded. The values come from
`technospider-ssbm/melee-shield-tilt` revision
`e8c05c2a0ed3419c1f461d0a5cb11728d01aa3b1`. Its listed PlCo SHA1 matches the
locally inspected retail NTSC 1.02 common table. The airborne multiplier is
also present at +0x7D4; only numerical parameters and the decompile use-site
were used as reference, not implementation code.
The retained airborne shield contact in
smashcraft:docs/smash-melee-reference/slippi-ntsc-airborne-shield-contact.json
shows the attacker frozen through hitlag and moving again on the first release
sample, but does not expose the shield-recoil vector. The common-derived
initialization and resulting displacement therefore remain unverified by this
trace.

The next acceptance sequence and GitHub dependencies are in
smashcraft:evidence/melee-foundation-roadmap.md. The factual frame-data intake at
smashcraft:references/melee-frame-data/README.md supports move research; it is
not a physics oracle, does not establish game revision, and supplies no hitbox
geometry. Its raw `gravity` field means fast-fall speed and `stun` means
shieldstun. No physics behavior changed as part of that intake.

Wurst owns our independently authored simulation. The local Melee checkout at
~/code/resources/melee, revision 0296f009f32f710495979d30772d8332af2d411a,
is a reference for factual mechanics and numerical parameters, not source to
copy or translate. No license covering its decompiled gameplay code was found;
licenses in its tools subdirectories do not cover the game. No game assets or
implementation text are incorporated from that checkout.

## Combat corrections — 2026-10-03

Low-knockback horizontal/downward hits on a grounded fighter now keep that
fighter grounded and project launch onto the flat floor. Upward hits and
tumble-strength hits still leave the ground. Grounded launch cannot be steered
off the floor by DI. This adopts the factual floor-normal selection in
melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c at the revision above; it does not
adopt the still-unverified grounded friction multiplier or ground-bounce data.
The existing 80-knockback tumble threshold remains the documented baseline.

DI now normalizes against the actual launch vector instead of the pre-direction
speed. Several custom attacks have nonunit direction vectors;
those directions no longer reduce the maximum DI rotation below 18 degrees.
Their authored launch speeds and directions remain unchanged. The factual
reference is the actual-vector normalization in the same damage module.

Digital shieldstun truncates incoming hit power before calculating its duration,
matching the integer damage input of the shield contact path in
melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c. Shield damage itself remains
fractional. Rifleman shield breaks now launch with their mapped
Fox/Falco character attribute, 3.299999952316284 Melee units/frame (19.7999997139
world units/frame), instead of the original 24-world-unit tuning. Illidan keeps
24. The factual parameter is character attribute +0x94 in the public Fox/Falco
DAT JSON at https://melee.theshoemaker.de/dat-dumps/Fox.json and
https://melee.theshoemaker.de/dat-dumps/Falco.json; the publisher's disc revision
is unknown. These are independently authored mechanics, with no copied or
translated gameplay implementation.

The focused combat tests cover contact, four frozen ticks, grounded launch and
the 31st actionable tick; 79.8916667/80.3544444 knockback cases straddle the
tumble boundary both on the floor and in the air. Separate cases check actual
vector DI, fractional shieldstun boundaries and shield-break contact/freeze/
first movement. These are numerical and behavioral tests, not an independent
game-execution oracle or a claim of full Melee parity.
`bash test.sh combat` passed 11/11 with zero compiler errors; evidence is
smashcraft:build/combat-tests.log. Existing airborne DI tests now explicitly
initialize an airborne fighter; their rotation and speed assertions are intact.

Remaining combat gaps require verified common data: the cross-frame launch
stacking gate (+0xFC), grounded knockback friction (+0x200), ground-bounce angle
and multiplier (+0x1E8/+0x1EC), defender shield pushback
(+0x294/+0x298/+0x2BC), and attacker pushback/decay
(+0x3E0/+0x3E4/+0x3E8/+0x3EC). Wall/ceiling collision and bounce geometry are
also absent from the current platform-only stage model. Existing floor tech,
missed-tech recovery and their provisional timing are unchanged. No missing
values were guessed, and these gaps remain open.

## Current correction checkpoint — 2026-10-01

Historical fixture before #339: The integrated suite passes 402/402 in
smashcraft:build/physics-aggregate.log. The normal map builds and installs as
`illidan-physics-complete`; build evidence is smashcraft:build/physics-map.log.
Native entry showed that build ID, Archer versus Rifleman, and working jump,
aerial attack and pause controls. The trace records the accepted ground
jump at frame 63 and aerial attack at frame 91, with zero dropped rows:
smashcraft:build/physics-native-controls-trace.txt. The final paused capture is
smashcraft:build/illidan-native/physics-controls-accepted.png. This short native
check does not measure every collision frame or prove the numerical formulas.
The corrections below retain the shared dodge durations, the 18-degree digital
wavedash, neutral-horizontal fast-fall and the absence of stale moves
(smashcraft:docs/gameplay-design.md).
Illidan retains original jump tuning and 128-unit roll paths; his drift follows the shared rule since #190.

Full Melee parity is not established. Rifleman forward-roll logical
facing now changes at the observed frame-20 event, with entry-facing travel
and pose retained throughout the roll (2026-10-02 correction below). Same-frame
damage now collects in one batch before selecting the strongest launch, as
described below. Missing common-data values leave launch stacking, ground launch
friction, tumble/bounce details, dash transitions and shield pushback unresolved.
Native roll-presentation and simultaneous-contact evidence remain outstanding.
Common-parameter work requires an extracted common table or another verified
numerical source. The public extracted-data index supplies character tables,
but no common table. Earlier checkpoint sections record historical tuning.

## Simultaneous damage contacts — 2026-10-02

The pinned Melee reference's damage-log selector in melee:src/melee/ft/ftcoll.c
evaluates contacts against accumulated temporary damage and selects the greatest
knockback; equal values retain the earlier entry. Its ordinary formula uses
truncated pre-frame percent plus the fractional temporary total while attack
power belongs to the individual hit. These are factual mechanics only: the
Wurst collection and resolution implementation is independently authored.

smashcraft:wurst/MatchStep.wurst now opens one synchronous contact batch before
grab actions and resolves it after melee, specials, summons and projectiles.
Every current damage path participates: throws, pummel, ordinary attacks,
Illidan's direct special, bear swipes, hippogryph strikes, flinching lasers,
damage-only arrows, recoil shots and mana burn. Eligible contacts are collected
before ordinary damage can cancel another same-frame action. Each launch uses
the whole unblocked damage total and its own power, growth, base, direction and
sampled victim context; only the strongest installs launch, hitstun, tumble,
SDI and pending DI. Throw DI resolves immediately when the throw wins. Equal
launches use stable contact order, not an assertion of arbitrary order parity.

Damage-only arrows retain their lack of flinch and hitlag. Lasers retain their
existing no-launch flinch when no launching contact exists; they cannot erase
a simultaneous stronger launch's DI or replace its hitstun. Pummel retains its
hold and shared hitlag. Direct attacks still freeze their attacker, detached
sources do not, and hitlag takes the maximum applicable pause. Contacts caught
by a shield all damage that shield, including on a frame that breaks it;
shield damage is excluded from the victim's damage total. Catch priority,
parry, trap capture and per-window contact memory remain separate rules.

The batch uses reusable value-array scratch and allocates no objects while
stepping or replaying. It is empty at every completed frame boundary, so it
adds no persistent snapshot fields. Standalone pair operations also collect
and resolve a complete batch when called outside the match step.

The integrated `bash test.sh Tests` run passes 423/423 with zero compiler
errors; evidence is smashcraft:build/two-clients/contact-batch-aggregate.log.
Six new tests exercise reversed collection order and fractional pre-hit
percent, mixed projectile kinds, shield depletion, direct-special trades,
both summons, throw/pummel damage, and exact match-step snapshot restoration.
The throw-release trap counterexample initially consumed an armed trap after
the victim had been thrown; releasing grounding immediately repairs that
boundary while retaining deferred launch selection. The new assertion and
existing grab, freeze-trap, special, hit-timing and replay checks pass together.
These checks establish numerical behavior, not native presentation or pacing;
this change has not been built into or installed as a map.

This correction does not implement launch stacking across different frames,
whose common-data time gate remains unverified. Ground launch/friction,
bounce and shield pushback data gaps remain unchanged; fighter tuning and the
decisions in smashcraft:docs/gameplay-design.md are unchanged.

## Roll-facing correction — 2026-10-02

The pinned libmelee empirical data in smashcraft:build/ref-libmelee-framedata.csv
matches SHA256 8e0d811290b511902076c0011db1a0116356a7ddaa68dfa369ea4f5dcdc93777
at revision ef679270ff95f0d42339dcdf1608282a35023349. Fox (character 1) and
Falco (22), forward roll (action 233), first report `facing_changed=True` on
one-based frame 20; frame 19 is false. Backward roll (234) remains false.
Only these factual observations are used; no LGPL library helper implementation
or unlicensed decompiled gameplay expression is incorporated.

Rifleman logical facing turns on that event. A stored entry facing selects
the movement profile, animation clip/rate and pose orientation for the whole
dodge. The authored clips perform a somersault without a horizontal turn;
rendered orientation therefore stays at entry facing until the clip ends.
Authored hurt volumes use the same orientation. Snapshots, exact comparisons
and canonical state include entry facing; interruption, reset and completion
clear it. Illidan has no adopted Melee profile and retains his original
completion-time turn and 128-unit travel. Durations and intangibility stay
unchanged for all fighters, and backward rolls/spot dodges retain facing.

The focused `bash test.sh rollFacing` run passes 5/5 with zero compiler errors;
evidence is smashcraft:build/two-clients/roll-facing-tests.log. It exercises both
facings, frame 19/20, hitlag freeze, snapshot restore across the turn, canonical
state sensitivity, travel totals, platform clamps, and unchanged backward/spot
orientation. These numerical checks do not prove native clip playback. This
change has not been built into or installed as a map; native presentation still
needs a parent-owned build and observation.

## Observed mechanics

These observations describe behavior; they do not establish numerical parity.
Paths below use `melee:` for ~/code/resources/melee.

| Mechanic | Reference | Observation and test target |
| --- | --- | --- |
| Jump squat / short hop | melee:src/melee/ft/kinds/ftCommon/ftCo_KneeBend.c | Ground jump has startup. Releasing jump during startup selects short hop; test release versus hold with explicit frame sequences. |
| Character movement | melee:src/melee/ft/types.h, ftCo_DatAttrs | Gravity, terminal fall velocity, fast-fall velocity, air drift, ground friction, jump velocity, and jump startup are separate character parameters. Test caps and transitions separately. |
| Initial dash / dash dance | melee:src/melee/ft/kinds/ftCommon/ftCo_Dash.c; melee:src/melee/ft/kinds/ftCommon/ftCo_Run.c; melee:src/melee/ft/kinds/ftCommon/ftCo_TurnRun.c | Initial dash and run are distinct actions. Dash accepts early opposite-direction input; run has a separate turning action that changes momentum. Timing depends on common data and animation commands; no exact duration was extracted. |
| Air dodge | melee:src/melee/ft/kinds/ftCommon/ftCo_EscapeAir.c | Direction chooses a velocity of common magnitude; neutral input produces zero initial dodge velocity. Dodge velocity decays. Ground contact enters special landing. Test diagonal normalization and retained horizontal motion through landing. |
| Shield | melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c | Shield health and analog shield strength affect shield size; held shield drains health. Our keyboard controls initially provide a full-strength digital shield. |
| Shield grab | melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c; melee:src/melee/ft/kinds/ftCommon/ftCo_Catch.c | The active guard input handler accepts grab while shield is held and begins the catch action. Our simulation lets only grounded grab (style 5) start directly from an active, unstunned shield; it keeps hitlag, hitstun, shieldstun, landing, cooldown and other action locks in force. Starting that grab drops the shield without adding shield-release lag. Grab during shield-release lag is not implemented. |
| Knockback | melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c; melee:src/melee/ft/types.h | Knockback magnitude/angle, damage state, and hitlag callbacks are distinct. Common data includes per-frame knockback decay; character data includes weight. Keep hitlag and hitstun separate. |
| Hitlag pose versus damage reaction | melee:src/melee/ft/fighter.c, Fighter_procAnim; melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c | Normal animation stepping and animation callbacks are gated during hitlag. Damage handling selects and evaluates a damage motion before installing hitlag callbacks; the victim need not freeze its pre-hit attack pose. Input processing and SDI remain separate from frozen animation. Every fighter needs authored damage reactions and exact contact-pose holds; this source observation does not establish Warcraft pose-restoration parity. |

Many numerical values are loaded through common/character data rather than
literal constants in these source files. The inspected checkout does not yet
provide verified numerical values for our parameter table. Do not substitute
field offsets for values or label remembered numbers as measured data.

## Initial implementation choices

Use a fixed logical frame step; frame counters drive jump squat, air dodge,
hitlag, hitstun, shield stun, and landing recovery. Warcraft schedules the
simulation and renders its result; wall-clock jitter does not alter a single
step's physics. Record the actual implemented rate with the simulation tests.

The simulation uses 60 logical frames/second and six Warcraft world units per
Melee distance unit. Movement, gravity, shield energy and ordinary knockback
use the numerical baseline below. Ground-jump launch speeds now use published
Fox/Falco DAT attributes, and aerial jumps multiply the full-jump attribute by
the published aerial multiplier. The first ground-jump tick preserves launch
velocity; subsequent ticks apply gravity. The six reference-table apex targets
remain checked below. Digital direction input, simplified collision shapes and
Warcraft animation differ from Melee.

Minimum mechanics checks: press edges; short/full jump; air-jump budget; landing
from above only; air-dodge landing momentum; shield drain/regeneration/break and
stun; hitlag freeze then knockback/hitstun; one stock per blast-zone crossing;
respawn and final-stock result. Tests must call the simulation used by the map.

## Documented numerical baseline (NTSC Melee)

Ordinary empty landings now apply four recovery ticks for either fighter.
The independent implementation starts this only on an airborne-to-ground
contact, so standing on a surface does not restart recovery. Air-dodge,
aerial-attack, tumble/tech and ASDI contacts keep their separate rules.
Landing recovery counts down before input eligibility is evaluated: jumping,
moving and starting an attack can resume on the same expiration tick.
Hitlag freezes the countdown. Early attack presses now use the six-frame
live command window described below. The reference fact that normal landing uses a
character-specific interruption threshold is in
melee:src/melee/ft/kinds/ftCommon/ftCo_Landing.c at revision
0296f009f32f710495979d30772d8332af2d411a. Only that behavioral fact was used;
no implementation text was copied. The four-frame values come from the table
sources below. Light/heavy landing selection by fall speed is not modeled;
ordinary airborne contacts use this one recovery duration.

Retrieved 2026-09-29 from SmashWiki's character Stats tables. These are reported
reference values, not measurements of our map or extracted local binary data.
Sources: https://www.ssbwiki.com/Fox_(SSBM) and
https://www.ssbwiki.com/Falco_(SSBM). Only factual parameters are recorded here;
no article prose or implementation is reused. Cached pages are build artifacts.

| Parameter | Fox reference target | Falco / Rifleman target |
| --- | ---: | ---: |
| Weight | 75 | 80 |
| Initial dash speed | 1.9 | 1.9 |
| Run speed | 2.2 | 1.5 |
| Walk speed | 1.6 | 1.4 |
| Ground traction | 0.08 | 0.08 |
| Air friction | 0.02 | 0.02 |
| Air speed | 0.83 | 0.83 |
| Separate maximum air velocity | 3.0 | 4.0 |
| Air acceleration base + additional | 0.02 + 0.06 | 0.02 + 0.05 |
| Jump horizontal initial contribution | 0.72 | 0.70 |
| Ground-jump horizontal momentum multiplier | 0.83 | 1.0 |
| Ground-jump horizontal maximum | 1.70 | 1.70 |
| Aerial-jump horizontal replacement | 0.90 | 0.94 |
| Gravity | 0.23 | 0.17 |
| Terminal fall speed | 2.8 | 3.1 |
| Fast-fall speed | 3.4 | 3.5 |
| Jump squat frames | 3 | 5 |
| Full-jump height | 31.28 | 51.5 |
| Short-hop height | 10.65 | 11.58 |
| Double-jump height | 40.204 | 41.778 |
| Empty landing frames | 4 | 4 |

The added horizontal attributes were checked against `ftCo_DatAttrs` offsets
using complete attribute arrays near the start of the public Fox/Falco DAT
JSON at https://melee.theshoemaker.de/dat-dumps/Fox.json and
https://melee.theshoemaker.de/dat-dumps/Falco.json. The cached downloads are
partial files, not complete valid JSON documents. The current complete intake
is recorded in smashcraft:docs/smash-melee-reference/physics-parameters.json; the
publisher does not identify its disc revision. Ground takeoff scales prior
self velocity, adds held-direction momentum, then caps it. Aerial jump replaces
horizontal self velocity, including zero for neutral input. Countersteering
preserves overspeed; matching input above the drift target brakes by air friction
and obeys the separate maximum. Ground takeoff does not apply drift or air
friction until the following tick. The vertical launch and first-tick ordering
are described in the jump checkpoint below; all six isolated jump-height
targets remain unchanged.

Distances and velocities are Melee units and units/frame; do not insert them
into a seconds-based Warcraft velocity without converting. Prefer simulation
units with rendering scale at the boundary. Report jump heights are trajectory
targets, not initial velocities; verify discrete integration before choosing
launch velocities. We target 60 logical frames per second independently of
render cadence.

Historical fixture before #339: The `completeJumpTrajectoriesMatchReferenceHeights` test advances each complete
trajectory for 120 ticks, starting jumps through input and measuring height
above takeoff. The six expectations remain Archer full/short/double
31.28/10.65/40.204 and Rifleman 51.5/11.58/41.778 Melee units, within 0.02
world units. The airborne double-jump fixture starts 100 world units above
the platform with one jump remaining. This checks simulation trajectories and
landing, not native timing, animated pose height, or disc-revision parity.

Walking/running off a floor or dropping through a platform leaves at most one
aerial jump. This transition removes the grounded jump once; subsequent falling
ticks do not consume the remaining jump. Landing still restores the normal budget.

Additional factual rules from https://www.ssbwiki.com/Hitstun,
https://www.ssbwiki.com/Knockback and https://www.ssbwiki.com/Shield:

- Melee hitstun uses 0.4 times knockback. Rounding and start/end frame accounting
  need explicit tests; the multiplier alone does not settle boundary timing.
- Launch speed is knockback times 0.03; knockback speed decays by 0.051 per frame.
- Melee shield maximum health is 60, ordinary damage multiplier 0.7, held drain
  0.28/frame, and regeneration 0.07/frame. Shield release lag is 15 frames and
  minimum hold is 8 frames. Analog light-shield behavior is a later difference.
- Air dodge leads to helpless fall, or special landing on ground contact;
  landing with horizontal momentum is the basis for wavelanding/wavedashing
  (https://www.ssbwiki.com/Air_dodge). Numerical dodge parameters remain unsourced.

Adoption is mechanic-specific. A test passing against provisional constants
is not proof that the entire table has been adopted or that feel matches.

## Top blast-zone eligibility checkpoint

Production top-boundary death now requires position strictly above the boundary
and either grounded state, an active frozen state, or upward knockback strictly
greater than 2.4000000953674316 Melee units/frame. Ordinary jump velocity does
not meet the launch requirement. Production tests cover jump-only ascent, the
exact launch threshold, a qualifying launch, and contact exactly at the top
boundary. Numerical facts are in
smashcraft:docs/smash-melee-reference/retail-death-parameters.json.
This does not verify the complete death state machine: Melee's special forced
top-death flag (including its Jigglypuff shield-break case), star/screen selection,
camera constraints and death/respawn phase clocks remain open. Side and bottom
comparisons now also require strict crossing; the six-test blast-zone group
passes boundary-adjacent cases and the existing stock/ASDI cases. Frozen-state
release ordering is still unverified.

## Initial dash and dash dance

Grounded directional entry still assigns the authored initial dash speed of
1.9 Melee units/frame (11.4 world units/frame). Each following held-direction
tick now updates velocity instead of holding that value for the entire
authored thirteen-tick phase. Velocity above the fighter's run target brakes by
that fighter's traction. Velocity below the target accelerates by the
fighter-owned ground acceleration multiplier plus base, then clamps at the run
target and ground speed cap. The original roster currently shares authored
defaults of 0.1, 0.02 and 3 Melee units/frame for those three values; these are
Smashcraft tuning choices and are not imported Falco/Fox character stats.

The test-only Falco rig injects the independently recorded values 0.1, 0.02
and 3. A frame-by-frame test begins at frame -35 in Walk with ground velocity
-0.19, then records Dash at frame -34 with position advanced by -0.19 while
ground velocity has changed to -1.9. Frame -33 advances by -1.82. Tests match
this entry sequence and the next five overspeed-braking positions and velocities
on both Rifleman hosts; deliberately perturbed starting velocities
are detected at the first sample. This confirms the shared entry displacement
ordering and the recorded overspeed-braking branch. The recording does not
verify under-target acceleration, run transitions, turning, analog-stick
scaling or the disc revision.

The authored dash window and three-sample stick reversal policy are specified
in [gameplay design](gameplay-design.md#dash-dancing). Run-turn braking remains
an explicit authored action rule. The authored phase
no longer holds dash speed. The retail event facts in
smashcraft:docs/smash-melee-reference/retail-ground-movement-events.json now
contradict using that single cutoff for all transitions: Dash enables Run at
animation frame 12 for Fox/Falco and 16 for Captain Falcon; the separate common
early dash-input gate is 20. TurnRun sets its second command variable at frame
9. RunBrake sets its first variable at frame 0 and clears it at frame 15.
These are animation timeline facts, not independently observed simulation
ticks. Production needs distinct Dash, Run, TurnRun and RunBrake action rules,
actor-owned command timing, input priority, and paired boundary traces.
Opposite-direction run motion changes facing only after velocity crosses zero;
that does not prove the TurnRun command gate. No gameplay implementation from
the unlicensed local reference was copied or translated.

The simulation now records a separate ground action state and actor-owned
command clock. Dash entry consumes its first animation update before movement.
Explicit NTSC test rigs use Dash-to-Run command frames 12 (Fox/Falco) and 16
(Captain Falcon), TurnRun's facing command at frame 9 and animation end at
frame 20 (Fox/Falco) or 22 (Captain Falcon), plus the RunBrake opposite-input
command window through frame 14, closing at frame 15. The command events and
animation lengths come from the retail records above. TurnRun freezes at its
frame-9 command until velocity along its entry-facing direction is at most
0.01 Melee units (0.06 simulation world units); a subsequent action update
flips facing, then the remaining animation frames run before the action returns
to Run. RunBrake's command check does not make forward input enter Run;
opposite input can enter TurnRun at RunBrake's current animation frame. Original
Smashcraft fighters keep authored timing (currently 14/9/20/15); this is not
asserted as retail parity. NTSC RunBrake ends when its animation clip ends or
its 30-frame fighter countdown expires, whichever comes first. The recorded
clip lengths are 18 frames for Fox/Falco and 28 for Captain Falcon. TurnRun
completion enters Run only while forward input remains held; otherwise it
returns to Wait.
Exact event-to-simulation-tick scheduling, Dash opposite-input priority,
animation rate interactions, and run-entry delay still need paired retail
traces. Replay capture and equality include all ground-action clocks, the
RunBrake countdown, and actor rule values.

The walk modifier immediately selects the existing 1.6/1.4 walk speeds and
clears the dash phase; releasing it starts a fresh initial dash. Jumps, shields,
attacks, dodge actions, hitstun, ground departure, landing and stock loss/reset
clear that phase while retaining their existing eligibility and momentum rules.
Hitlag freezes the phase and displacement. Grounded recovery still gates motion;
held direction starts a fresh dash on its expiration tick. Digital input has no
analog tilt or stick-smash threshold, and initial facing changes have no separate
turn startup. Dash attacks, crouch cancels and animation changes are outside
this movement slice.

The focused `initialDash` simulation filter passes 6/6 tests, the under-target
acceleration/cap check passes 1/1, and the aggregate suite passes 430/430. The
independent recorded-dash comparison passes on both host identities and the
perturbed-input case fails at the expected first frame. The aggregate output is
smashcraft:build/wurst-tests/shared-dash-full.log. Native dash-dance feel and
keyboard delivery timing have not been validated for this change.

A later S/F short-tap report exposed an adapter loss: a press and release
between service ticks left `directionX()` neutral, so no initial dash ever
started. `PlayerInputState.consumeMovementX()` commits that horizontal press
once when neither direction remains held, then returns neutral on following
ticks. Opposing held directions and opposing taps in the same commit remain
neutral. Both players use this sampler; committed input rows retain the result
for replay. Existing dash speed and neutral traction are unchanged. The local
reference's `ftCo_Dash_Enter`/`ftCo_Dash_Phys` at the revision above separately
identify the initial velocity impulse and subsequent ground acceleration and
friction; those behavioral facts support preserving a short tap, not copying
its implementation or claiming our full dash model now matches Melee.

Grounded Shield + normal Attack now chooses the same grab command as O for
both fighters, including pressing shield and Attack within one frame. The
existing shield-stun/action locks still decide when the grab may begin. O
remains the dedicated grab binding. Neither path introduces an aerial grab.

## Hit timing and knockback

For a normal non-electric, non-crouching hit, the Melee hitlag baseline is
floor(floor(damage) / 3 + 3), so a 15-damage hit yields 8 frames. Electric and
crouching modifiers have separate truncation stages in `victimHitlagFrames`.
Source: https://www.ssbwiki.com/Hitlag. Digital shieldstun's documented expression
is (damage * 0.45 + 2) * 200 / 201; determine integer frame accounting explicitly
when implementing rather than treating a real-valued duration as exact frames.

For ordinary percent-based hits, the documented knockback baseline is:

    K = (((p / 10 + p * d / 20) * 200 / (w + 100) * 1.4 + 18) * g + b) * r

Here p is post-hit percent (Melee floors the pre-hit percentage before adding
this frame's fractional damage), d is integer attack power, w is victim weight,
g is growth divided by 100, b is base knockback, and r is contextual scaling.
Raw magnitude is capped at 2500 before crouch (2/3) or interrupted-smash-charge
(1.2) scaling. The state is sampled before interruption clears it. With no
staling queue, attack power is truncated scaled move damage, with a minimum
of one for positive damage below one. Zero damage retains zero power. The fixed-power
helper substitutes percent 10 and the declared fixed power; no current move
declares fixed knockback. DI and special launch angles remain distinct rules.
For a 12-damage hit on weight 80 at 0 pre-hit percent, growth 100,
base 20 and ratio 1, K is 51.0666667, launch speed 1.532 and floor(0.4*K) is 20.
These are useful independent arithmetic expectations for our Wurst tests.

The local reference's `src/melee/ft/ftcoll.c` at revision
`0296f009f32f710495979d30772d8332af2d411a` supports the percent timing fact:
`ftColl_GetDamageCount` casts accumulated percent to an integer before the
ordinary branch adds a fractional temporary component (`ftColl_80079AB0`, lines
2050–2104). The same path has a separate fixed-knockback branch and caps its
result using common data. The decompiled common-data fields do not expose
verified growth/base values here; the numerical cap of 2500 comes from the
published Knockback reference. No values are inferred from offsets and no
reference implementation was copied.

`ordinaryHitKnockback` now receives pre-hit percent, this hit's damage, victim
weight, growth percent, base knockback, and context scale independently. The
map supplies growth and base from the selected hit region, with defaults of
100 and 20 for unchanged moves and contextual scaling of 1.
`ordinaryHitlagFrames` and `ordinaryHitstunFrames` make the normal
hit frame conversions testable at their integer boundaries. These helpers
include the corrected integer-power boundary, raw cap and sampled motion
modifiers. Hitstun has a minimum of one tick for an ordinary flinching hit.

The fractional-power boundary follows the factual conversion in
melee:src/melee/ft/ftcoll.c (`getEnvDmg`, hurt/attacker/shield contact counters)
at revision 0296f009f32f710495979d30772d8332af2d411a. The damage percentage
itself is not rounded up. `integerHitPower` owns this conversion for knockback,
hitlag and digital shieldstun. A 0.25-damage hit at 12.75 pre-hit percent on
weight 80, growth 100 and base 20 produces 40.8583333333 knockback and two
shieldstun ticks. Previously the zero-power conversion produced a different
launch and only one shieldstun tick. The focused timing check passed **5/5**
with zero compiler errors (smashcraft:build/physics-fractional-power.log).
These checks establish the conversion and existing formula behavior, not
independent NTSC 1.02 frame-trace or native-game parity.

Stale moves and freshness bonuses are omitted (smashcraft:docs/gameplay-design.md,
“Stale moves and freshness bonuses”): there is no staling queue or projectile
staleness snapshot.

September 30 reference check: SmashWiki's Hitstun article identifies the
unconditional subtraction of one frame with Ultimate, not Melee. The local
Melee reference, revision above, initializes the damage counter from truncated
scaled knockback in melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c and decrements
it before the damage state's input transitions. Keep floor(0.4*K); jump and
attack must become eligible on the same expiry tick. The focused test exposed
and corrected our jump check occurring before the hitstun decrement.

melee:src/melee/ft/ftcommon.c, ftCommon_CalcHitlag, confirms separate truncation
stages for base duration, effect multiplier and crouch multiplier.
melee:src/melee/ft/fighter.c caps the result using common data. SmashWiki's
Hitlag article supplies the numeric normal rule and cap of 20. Normal hits now
derive hitlag from damage (zero damage gives zero), including tip/weak regions;
shield contacts pause the victim's shieldstun during hitlag, and detached
projectiles/summons do not freeze the summoner. Numerical crouch state is
replay-safe and clears on incompatible actions. The victim formula is
floor(c * floor(e * floor(3+floor(d)/3))), capped at 20;
the attacker's e and c remain 1. No later-game tipper hitlag multiplier applies.
No current move is electric; testing its math does not invent an electric move.

Electric effects now travel in the production `hitEffect` contact data. The
largest eligible hurt-contact damage supplies integer hitlag power, while the
strongest launch selects its electric effect. Strictly greater knockback wins;
equal-strength launches retain the first effect. Shields and the direct
attacker keep ordinary hitlag, and detached contacts leave their source
unfrozen. Existing move definitions remain ordinary. The sampled crouch state
continues to apply after the electric truncation stage. Contact scratch is
consumed synchronously and introduces no persistent snapshot state.

These independently implemented selection facts come from
melee:src/melee/ft/ftcoll.c and melee:src/melee/ft/fighter.c at revision
0296f009f32f710495979d30772d8332af2d411a. Four focused production-contact tests
cover direct/detached contacts, shield timing, crouch/electric truncation,
strongest-element versus largest-damage selection, reversed batches and ties.
The assembled aggregate with fractional-power correction passed **409/409**,
zero compiler errors and one existing warning
(smashcraft:build/physics-electric-aggregate.log). Numeric common-table
confirmation and original-game hitlag traces remain outstanding.

## Recorded neutral-fall comparison

smashcraft:docs/smash-melee-reference/slippi-ntsc-falco-fall.json retains ten
recorded Falco positions, neutral inputs and source identity from the public
Slippi fixture `ntsc.slp` at repository revision
ff815345e641836a331191320c0f6eae21542a5f. Original frames -59 through -50 are
compared through the production `advance` path, starting at the recorded
position on frame -60 with the declared zero-velocity fall-entry condition.
Expected positions are directly transcribed from the recording. The comparison
returns the first differing original frame; a deliberately altered initial
velocity must be detected on frame -59.

The source records `isPAL = false`, but does not identify the NTSC disc revision.
Its old protocol does not export velocities, grounded flags, hitlag or hitstun
counters. Zero initial self velocity is a declared entry condition tested by
the next recorded displacement, not a sampled oracle field. The comparison
covers neutral airborne gravity and position integration before floor contact.
Landing, terminal speed, knockback, action startup and full revision-specific
parity remain outside this trace. The position tolerance is 0.0001 world units
(about 0.0000167 Melee units), accounting for recorded per-frame binary32
rounding versus test/runtime arithmetic.

The LGPL-3.0-or-later Slippi parser 9.1.3 was executed unmodified only as a local
intake tool. No parser implementation or binary recording is included in the
map or these references; the retained excerpt is numerical telemetry.
Both comparison tests passed, including first-frame detection of the deliberately
perturbed velocity. The existing `recorded` filter passed **5/5**, with zero
compiler errors and one existing warning (smashcraft:build/physics-slippi-fall.log).

The second independent recording excerpt,
smashcraft:docs/smash-melee-reference/slippi-ntsc-falco-jump.json, captures
neutral held jump on original frames 25 through 30 in `wavedash-1.slp`.
Frames 25–29 are grounded squat; frame 30 is airborne, with recorded self
velocity 4.099999904632568 Melee units/frame. The test starts from the recorded
grounded position and zero velocity on frame 24, presses jump on frame 25,
holds it throughout and runs the production `advance` path. Height is measured
above the recorded grounded origin, subtracting its collision epsilon. This
preserves displacement and velocity while using the simulation's floor origin.
No unexported jump-squat countdown is treated as an observed field.

The comparison returns the first differing original frame; moving the input
one frame later must report frame 25. The source's protocol 3.19.0 exports
grounded flags and velocities, but its NTSC flag does not establish disc
revision or an unmodified gameplay build. The next recorded frame introduces
analog steering and trigger input, outside this neutral-entry fixture. Whole
jump trajectories, short hops, dodge/landing and native Warcraft execution
remain unverified by this excerpt.
The `recorded` filter passed **7/7**, including the jump comparison and the
delayed-input counterexample, with zero compiler errors and the existing
unused-import warning (smashcraft:build/physics-slippi-jump.log).

Launch speed already uses 0.03*K, converted by the six-world-units scale.
Tumble follows the reference's damage-level selection
(melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c `ftCo_8008DCE0`): level 3,
DamageFly, when knockback times +0x154 = 0.4 reaches +0x160 = 32, grounded or
airborne. Only tumbling landings tech or knock down; a weaker airborne hit
lands, or keeps its stun below +0x1E4 = 0.5, because its launch never reaches
the +0x1E0 = 5 knockdown speed (`ftCo_Damage_Coll`).
smashcraft:ts/src/game/sim/tumbleLandings.tests.ts checks every authored move
of each fighter at 10, 50 and 100 percent, grounded and airborne.

## Frame-authored hit regions

The match selects a facing-mirrored capsule for each active move region and a
separate capsule for each target body. Strike direction follows move identity:
jabs and horizontal attacks have horizontal centerlines, angled tilts follow
diagonal paths, and up/down aerials have vertical centerlines. Grounded upward
strikes use rising diagonals. The custom reach envelopes calibrate the strike
span; they are no longer victim-origin rectangles. Radii range from 10 to 40
world units according to the authored strike. Rifleman and Demon Hunter
use body capsules with radii 24, 26 and 25, extending from local z=4 to
88, 96 and 102. These are provisional, pose-independent custom tuning values,
not Melee hitbox or hurtbox measurements. Contact reach changes with this
explicit replacement; damage, active frames, recovery, and fighter stats do not.

An ordinary move connects when its capsule reaches either the body capsule or
the active shield circle. The shield query uses the move capsule's finite
radius, the fighter's authored shield center and radius, and the current shield
size multiplier. A contact covered by the shield enters the existing shield
damage/stun/pushback path; a contact outside the shield circle can hit the body
while guard is held. A capsule can also reach the shield before the body. The
first overlapping move region retains priority, and a shield intersection on
that selected region blocks its body intersection. Both fighters' selected
effects and facing are copied before applying either hit, so trades retain
their original regions. Hit application retains the maximum of existing and
incoming hitlag. Normal grabs and dash grabs keep their origin-range query and
shield bypass; projectiles keep their independent swept query. Multi-hit
specials still use their prior broad contact checks.

Flat forward tilt (style 6) has an inner reach envelope at local x=0–110 and a
higher-priority tip at x=90–145, both at local z=-130–130. The selected
horizontal centerlines end at x=76 (inner) and x=111 (tip), at z=45. Facing mirrors x. Its active frames remain 5–6, total duration 28;
the angled forward tilts retain their existing single regions and effects.
Damage and reach envelopes are independently authored provisional values, not
Melee measurements:

| Move / region / attack frames | Damage | Growth % | Base knockback | Hitlag ticks | Local launch direction (x,z) |
| --- | ---: | ---: | ---: | ---: | --- |
| Forward tilt tip / 5 | 10 | 110 | 24 | 6 | (0.8, 0.6) |
| Forward tilt inner / 5 | 7 | 80 | 16 | 5 | (0.7071, 0.7071) |
| Forward tilt tip / 6 | 8 | 90 | 18 | 5 | (0.8, 0.6) |
| Forward tilt inner / 6 | 5 | 70 | 12 | 4 | (0.7071, 0.7071) |
| Up aerial opening / 5–6 | 4 | 60 | 14 | 4 | (0.25, 0.9682458) |
| Up aerial finisher / 7 | 8 | 110 | 24 | 5 | (0.25, 0.9682458) |

Ordinary moves share window 1 across all their regions and active frames.
A victim records the opposing fighter, attack serial and latest contact
window; changing regions, leaving/re-entering the region, hitlag, and continued
overlap cannot repeat that hit. Shield contact consumes the same window. This
record is scoped to the current two-fighter match, not a history for multiple
concurrent opponents. Starting another attack increments its serial. Respawn
reset clears the victim's record.

Up aerial explicitly advances from window 1 on frames 5–6 to window 2 on
frame 7, permitting one opening hit and one finisher if the target remains
in range. Missing the opening does not prevent a finisher. Its old bounds
(x=-105–105, z=20–190), three active frames, total duration 34 and authored
landing lag 15 (landing with 7) are retained. Hitlag freezes the authored attack clock, so the second
window is reached after those frozen ticks rather than after a wall-clock
delay. Each window can connect once; it does not reset every active frame.

Ordinary strikes now test the capsules described above. Grab and special
queries remain simplified, and the capsules are not pose-derived hurtboxes.
Animation alignment, character-specific tuning, and native combat feel remain
open. Existing clip frame clocks and recovery durations are preserved.

The `SimulationTests` filter passes 146/146 tests, including nine added
resolution tests for overlap priority, mirrored launch, early/late effects,
frame/geometry boundaries, per-target contact memory, shield contact, re-hit
windows and trades. The compiler reports zero errors and warnings. Evidence:
smashcraft:build/wurst-tests/hit-regions-20260930-final.log. Integration passed
211/211 tests in smashcraft:build/wurst-tests/hit-regions-integrated.log. Map build
`hit-regions` succeeded with the four existing warnings and was installed;
the running client has not loaded it and native combat feel is unverified.

## Grounded knockdown and jab resets

At Melee revision `0296f009f32f710495979d30772d8332af2d411a`,
`ftCo_DownBound.c`, `ftCo_DownDamage.c`, `ftCo_Down.c`,
`ftCo_DownStand.c`, and `ftCo_DownAttack.c` establish separate bound, wait,
down-damage, stand, get-up attack, and directional-roll states. The retail
common values are in smashcraft:docs/smash-melee-reference/physics-parameters.json.

- DownBound's entry forgets earlier A/B presses. As the bound ends,
  `ftCo_DownBound_Anim` starts a get-up attack pressed during it (A/B press
  age under +0x24C = 60 frames, longer than any bound), else a get-up roll
  from the held stick, else enters DownWait with +0x424 = 220 frames.
  DownWait reads that same frame's input.
- DownWait counts down, then stands. Each frame it takes, in order: an A or B
  press (get-up attack), the stick at least +0x248 = 0.2 sideways and less
  than +0x020 = 50 degrees above horizontal (roll forward or back relative to
  facing), and the stick at least +0x244 = 0.2 up at 50 degrees or more, or an
  L/R press (stand).
- A C-stick flick does the same on the frame it crosses its threshold:
  `ftCo_800984D4` and `ftCo_80098400` attack on an up crossing of +0x7F4 =
  0.6625 (`ftCo_800DF644` in melee:src/melee/ft/ft_0DF1.c), and
  `ftCo_Down_CheckInput` rolls on a sideways crossing of +0x248 within the
  roll angle (`ftCo_800DF678`), preferring it to the left stick. The roll is
  forward or back by the flick's side. The C-stick is digital here, so a press
  of its smash direction is the crossing; held through the wait it does nothing.
- Smashcraft also stands on Jump and treats a sideways press released within
  its input row as a roll, for keyboards.

smashcraft:ts/src/game/match/knockdownInputContracts.tests.ts drives these
through helper rows, journal packets and synchronized input messages after
low-, medium- and high-percent knockdowns.

The extracted Sheik actions provide `DownBoundU/D` 26-frame clips,
`DownDamageU/D` 14-frame clips, and `DownStandU/D` 30-frame clips. The
frame-data records give Sheik 49 ticks for each get-up attack and 35 ticks for
each directional get-up roll. Other characters' recorded action lengths vary
by one or more ticks. Smashcraft uses one shared profile (smashcraft:docs/gameplay-design.md,
"Controls"): 26 bound,
13 down-damage, 30 stand, 49 get-up attack, and 35 get-up roll ticks. These
shared values are action timing choices informed by the extracted data, not a
claim that every Melee character shares them. The authored source starts clips
at animation frame 0 while simulation actions count from frame 1.

The Sheik `DownStand` event streams set body-collision state 2 initially and
restore state 0 at animation frame 20. `DownBackU` restores state 0 at frame
23, while `DownBackD`, `DownFowardU`, and `DownFowardD` restore it at frame 20.
The get-up attack streams restore state 0 after their waits: `DownAttackU`
reaches frame 24 and then waits 3 more frames (frame 27); `DownAttackD` reaches
frame 20 and then waits 2 more (frame 22). The extractor documents events
`0x68`, `0x6C`, and `0x70` as body/bone collision changes with invincibility
data.

Animation frame 0 is shown on simulation recovery frame 1. A restore event at
animation frame N therefore protects simulation frames 1 through N; frame N+1
is the first unprotected simulation frame. Smashcraft uses 20 frames for
stand/forward roll, 23 for a backward roll while face-up, 20 for a backward
roll while face-down, and 27/22 for Up/Down get-up attacks. This mapping
accounts for the `waitFor` delays and remains subject to native gameplay
verification.

The down-damage entry compares the frame's summed damage (`percentTemp`,
accumulated per contact in melee:src/melee/ft/ftcoll.c) against +0x428 = 7.
A frame whose contacts sum below 7 damage on a fighter in
DownBound, DownWait, or DownDamage enters the 13-tick
DownDamage reaction. Its hitstun is retained; after the animation, remaining
hitstun sets the down-wait timeout, and an expired timer forces stand. Damage
of 7 or more interrupts the grounded recovery and follows ordinary launch
resolution. Damage-only arrows do not enter DownDamage.

The numerical face-up/down choice follows the sign of the launch's vertical
component. This stable approximation selects the two reference action families;
it does not simulate Melee's joint rotation. The update pins downed fighters to
their selected stage surface. The decompile's collision/bounce behavior depends
on floor collision and common data; the prototype still omits physical rebound
and uses an immediate grounded bound. A face/rotation or rebound correction
requires the missing common collision data and a native pose check.

Get-up attack damage, hit shape, knockback, and startup remain Smashcraft move
tuning, not character move data from Melee. The implementation now records
down-wait remainder and face selection in replay snapshots so jab-reset and
recovery frames restore with the same future outcome.

## Directional influence

Melee reads the control stick on the last hitlag frame. A direction perpendicular
to the launch path can rotate it by about 18 degrees; partial stick tilt weakens
the change, and a parallel direction produces none. Source: the Melee section of
SmashWiki's Directional influence article, retrieved 2026-09-29
(cached at `build/ref-Directional_influence.html`).

The simulation samples the keyboard's left/right/up/down axes exactly once on
the last frozen tick. It normalizes diagonal digital input, computes the signed
cross product against the launch direction, and squares its signed magnitude to
set the rotation up to 18 degrees while preserving launch speed. The smooth
keyboard approximation cannot represent analog tilt, and this response curve
is an independent approximation rather than extracted Melee code. A neutral or
parallel input does not change the path.

## Smash DI and ASDI

The Melee reference reports a six-unit shift for each SDI pulse and a
three-unit shift for ASDI; attacks with fewer than two hitlag frames cannot be
SDI'd. Source: SmashWiki contributors, “Smash directional influence,” article
revision dated 2026-09-17, retrieved 2026-09-30,
https://www.ssbwiki.com/Smash_directional_influence (CC BY-SA 4.0). These
mechanics and numeric facts are used as reference only; no article text or game
code is copied.

Keyboard callbacks retain the newest digital SDI pulse until the next simulation
tick, separately from held directions. Entering a nonzero horizontal or vertical
component, including reversing its sign, captures the complete direction vector.
A press and release delivered together therefore retains its pulse without
pretending the direction is still held. At most one pulse is used per tick;
adding a diagonal component creates one, removing a component does not, and a
held direction does not repeat. Every tick expires the pulse, including menus
and ticks outside victim hitlag, so it cannot wait for a future hit. During
victim hitlag the pulse shifts the fighter once by 36 world units. SDI is
unavailable during a one-frame freeze. On the
last hitlag tick, ASDI shifts once by 18 world units in the held left-stick
direction, unless a C-stick direction is held; C-stick never changes DI, which
continues to use left-stick input. Shifts use a swept top-surface check, so ASDI
can land without tunneling through a platform. An ASDI landing cancels
non-tumble hitstun; tumble uses the existing tech window or knockdown recovery.
SDI cannot move down through a platform or up off a grounded, non-lifting hit.

This prototype uses keyboard axes instead of analog stick thresholds and does
not model grounded launch eligibility fully: ordinary hits currently send the
target airborne. Shield SDI is not implemented. Native held ASDI and tapped
SDI were observed in build 003040. Native callback tracing subsequently showed
short press/release pairs delivered together in roughly 100 ms batches. Retaining
the pulse fixes loss between simulation ticks; it does not remove that engine
delivery latency. See smashcraft:evidence/development-plan.md for the recorded input sequences.

## Separated launch velocity

Ordinary movement (`vx`, `vz`) and launch momentum (`knockbackX`, `knockbackZ`)
are stored separately. Position uses their sum. The factual Melee baseline is
launch speed `0.03 * knockback`, decaying by `0.051` per frame independently
of ordinary self-velocity friction; falling speed still takes effect. This simulation applies
the `0.051 * 6 = 0.306` world-unit decay to the launch vector's magnitude,
preserving its direction, while ordinary gravity and terminal speed affect
only `vz`. Decay occurs before displacement and freezes during hitlag. Launch
decay continues after hitstun expires, and the player can
steer ordinary movement again when hitstun reaches zero. This keeps a downward
launch above the ordinary terminal-fall cap. The additional gravity-based
launch adjustment introduced in Brawl is not part of this Melee target.

A new ordinary hit resets movement velocity; how its launch combines with an
earlier one is described in "Verified retail combat parameters" above. Landing removes vertical launch
momentum and retains horizontal carry. A tumble landing that enters tech or
knockdown recovery clears both launch components. Bounce momentum loss and
Melee's low-knockback grounded launch rules remain unimplemented.

## Air-dodge protection checkpoint

The locally cached SmashWiki Air_dodge table reports Fox and Falco intangible
on frames 4–29 inclusive, with a 49-frame animation. The simulation now tracks
the dodge frame separately from motion, blocks both strikes and grabs during
that interval, and ends dodge protection on landing or interruption by a hit.
Respawn protection is independent. The renderer lowers fighter opacity using
the same protection query used by hit detection.

The frame sweep test checks both characters at each frame 1–30. Additional
tests cover damage interrupting startup and landing ending dodge protection.
Neutral/directional dodge force now uses retail common +0x338 =
3.0999999046325684 Melee units/frame (18.59999942779541 world units/frame),
with +0x33C = 0.8999999761581421 decay. Retail motion state 236 selects
submotion/animation 44, ACTION_EscapeAir_figatree. The verified Fox, Falco and
Captain Falcon scripts write command variable zero to one at animation frame
30, recorded in smashcraft:docs/smash-melee-reference/retail-escapeair-events.json.
The simulation applies decay for 29 moving ticks and ordinary gravity plus
air drift from tick 30. The 49-frame animation cap remains sourced to the
version-unidentified frame table; this change does not establish full
animation-end/fall-special transition parity.

The update-number conversion uses a static callback/counter trace at Melee
revision 0296f009f32f710495979d30772d8332af2d411a, independently of the retail
command-word extraction. Fighter_ChangeMotionState requests animation zero;
the first animation evaluation consumes first-play without advancing and
processes commands at frame zero. EscapeAir entry then calls the animation and
command update once more, reaching frame one before its first physics step.
Subsequent unfrozen animation callbacks precede input and physics. The
asynchronous timer targets frame 30, and its command write occurs before that
frame's physics callback. This is 29 decay steps, not 30.

| Moving update | Animation frame before physics | Physics |
| --- | --- | --- |
| Entry | 1, following setup at 0 | Multiply velocity by retail decay |
| 29 | 29 | Last decay step |
| 30 | 30; command variable zero becomes one | Gravity, fast-fall eligibility and air drift |

The trace uses melee:src/melee/ft/fighter.c (state setup and callback phases),
melee:src/melee/ft/ftanim.c (animation then command processing),
melee:src/sysdolphin/baselib/aobj.c (first-play evaluation),
melee:src/melee/lb/lbcommand.c (absolute-frame timer), and
melee:src/melee/ft/kinds/ftCommon/ftCo_EscapeAir.c (entry and physics selection).
No implementation was copied or translated. This is source-derived scheduling
evidence, not a captured original-game trajectory. Hitlag freezes the action
clock and resumes this boundary on expiry; existing snapshot fields already
preserve the phase. Tests exercise neutral and both diagonal vertical
directions, all three steering inputs, the exact 29/30 boundary, hitlag, and
restore/replay through the boundary using the factual Falco rig. The original
roster and the 18-degree horizontal air dodge (smashcraft:docs/gameplay-design.md)
are unchanged.
The focused dodge filter passed 32/32 with zero compiler errors and one
existing unused-import warning; evidence is
smashcraft:build/retail-dodge-switch-tests.log. The long-displacement expectations
use independently calculated binary32 accumulation, matching the pinned Wurst
interpreter arithmetic; tolerances were retained. Native trajectory comparison
and the full animation-end transition remain outside this result.

An accepted air dodge replaces prior ordinary movement and clears both launch
momentum components, including for neutral input. This follows the momentum
halt described in the Melee section of https://www.ssbwiki.com/Air_dodge.
During each airborne motion tick, the simulation multiplies both dodge velocity
components by the extracted decay before either displacement. A 45-degree input therefore
travels along a 45-degree line until contact; neutral input stays still during
the motion period. This integration order is our implementation choice, not a
claim of frame-exact Melee motion. Ordinary gravity and launch decay keep their
existing order outside dodge motion.

The Landing Lag tables at https://www.ssbwiki.com/Fox_(SSBM)/Air_dodge and
https://www.ssbwiki.com/Falco_(SSBM)/Air_dodge report 10-frame landing animations
(retrieved 2026-09-30). Both characters now receive 10 ticks of landing recovery.
The contact tick starts the counter at 10; each subsequent tick reduces it,
and actions become available when it reaches zero. Landing retains horizontal
dodge velocity; subsequent grounded ticks apply traction, even if the airborne
motion timer has not expired. Tests cover cleared launch momentum, neutral and
diagonal motion, fast swept platform contact, sliding, and the exact recovery
boundary. Numerical speed, decay, motion duration and native feel remain
separate calibration work.

The 18-world-unit speed is an independently chosen research tuning value
(3 times the rendering scale of 6), not a sourced Melee parameter. At the former
speed 8, a regression starting jump from grounded, advancing six ticks total,
then requesting a downward diagonal dodge fails to reach the ground during
dodge motion. The same unchanged regression passes at speed 18 for both
characters, short and full jumps, and both horizontal directions; it also
checks retained horizontal speed and sliding during landing recovery. This
sequence represents the approximately six-tick keyboard callback spacing
observed in Warcraft. It adds no input buffering and does not establish native
timing, multiplayer behavior, or numerical Melee parity.

## Jump calibration checkpoint

Full, short and double jumps are tested through complete 120-frame trajectories,
including landing. Fox full/short vertical launch attributes are
3.680000066757202 / 2.0999999046325684 Melee units per frame; Falco uses
4.099999904632568 / 1.899999976158142. Aerial launch is the full-jump attribute
times 1.2000000476837158 for Fox or 0.9399999976158142 for Falco. These values
come from the complete published DAT JSON intake in
smashcraft:docs/smash-melee-reference/physics-parameters.json. The publisher's
game revision is unidentified, so these are not certified NTSC 1.02 values.

Historical fixture before #339: Behavioral facts from melee:src/melee/ft/kinds/ftCommon/ftCo_Jump.c,
melee:src/melee/ft/kinds/ftCommon/ftCo_JumpAerial.c, and
melee:src/melee/ft/kinds/ftCommon/ftCo_KneeBend.c at
0296f009f32f710495979d30772d8332af2d411a inform independently authored Wurst.
No decompiled implementation was copied, translated, or structurally adapted;
no gameplay-code license was established. Ground takeoff skips ordinary air
physics on its first tick, so launch velocity supplies the first displacement.
Aerial jump applies ordinary gravity and drift immediately. Ground jump spends
three grounded ticks for Archer or five for Rifleman before takeoff, including
the input tick. Release during those grounded ticks latches short hop; release
on takeoff does not. Hitlag freezes that decision. Repeated presses during
squat do not restart it or spend the aerial jump. Illidan retains its custom
launch speeds and squat timing; since #190 its takeoff momentum and drift follow
the shared rules ([gameplay design](gameplay-design.md#air-drift-and-jump-momentum)).

The focused checks assert the grounded startup ticks, first two airborne
positions and velocities, aerial launch, takeoff release, and hitlag. The full
trajectory assertions still cover all six previous apexes and landing.
This corrects the previously fitted ground launch speeds without claiming
complete movement parity. Initial-dash duration, acceleration, run-turn braking,
walk acceleration, and ordinary friction still need their complete source
parameters and transitions. Fast-fall persistence was subsequently corrected
as described below. Those other movement gaps remain open.

## Fast-fall persistence

The aggregate passed **404/404**, with zero compiler errors and one existing
unused-import warning (smashcraft:build/physics-fastfall.log). Tests cover
release, steering, aerial startup, landing, accepted jump/air dodge, self
velocity versus knockback, and snapshot restoration. Native behavior remains
unobserved.

Fast-fall activates while airborne with descending self velocity, before the
ordinary gravity step. Once active, releasing Down or steering horizontally
does not cancel it; aerial attack startup preserves it. Landing, an accepted
jump or air dodge, a flinching hit, ledge catch and reset clear it. Snapshots
capture and compare the flag. Fox uses the published attribute
3.4000000953674316 Melee units/frame; Rifleman uses Falco's 3.5.

These state facts come from melee:src/melee/ft/ftcommon.c
(`ftCommon_CheckFallFast`), melee:src/melee/ft/kinds/ftCommon/ftCo_AttackAir.c
and the motion-state fast-fall preservation flag at revision
0296f009f32f710495979d30772d8332af2d411a. Wurst implementation is independently
authored; no decompiled implementation is copied or translated.

Fast fall needs neutral horizontal input (smashcraft:docs/gameplay-design.md,
"Controls"). Retail common
+0x88 = 0.6625000238418579 is the downward stick threshold and integer
+0x8C = 4 requires input age strictly below four frames. Digital Down has
magnitude one. The input tick has age zero; three further held ticks remain
eligible, while the fifth tick is too late. Freshness ages during hitlag and
is tested on the expiry tick. A diagonal Down hold ages the same input, so
releasing horizontal movement does not create a new Down press. Acceptance
consumes the window; release followed by another press refreshes it. The saved
held state and age are copied and compared in replay, and reset clears both.
The age saturates at four because larger values have identical eligibility. Descending knockback alone cannot trigger
fast-fall while self velocity is rising; rising knockback does not prevent
activation while self velocity is descending. This separates knockback motion
from the character's gravity-driven fall.

The retail aerial checks use the explicit Falco factual rig through the
production engine. They cover early versus fresh Down at the apex, the age
three/four boundary during hitlag, diagonal-to-neutral input, replay restoration,
and every digital dodge direction with frozen and resumed motion. Existing
air-dodge displacement expectations were corrected for the extracted force;
the neutral vector remains zero and the original roster attributes are unchanged.
Focused filters passed retailAerial 5/5, dodge 30/30, and fast 9/9 with zero
compiler errors and the existing unused-import warning. Evidence is
smashcraft:build/retail-aerial-tests.log, smashcraft:build/retail-dodge-tests.log,
and smashcraft:build/retail-fastfall-tests.log. These checks do not establish
native behavior. The EscapeAir switch timing was subsequently corrected
using the command facts and callback trace described above.
Retail values and private file identity are recorded in
smashcraft:docs/smash-melee-reference/physics-parameters.json. These are numerical
and behavioral facts; no decompiled implementation was copied or translated.

## Raw movement parameter precision

Gravity, terminal speeds, drift speed/acceleration/friction, ground traction,
initial dash speed and aerial-jump horizontal velocity now retain the complete
published binary32 values in source, alongside the already sourced jump and
fast-fall values. Their factual source is
smashcraft:docs/smash-melee-reference/physics-parameters.json. Shared Fox/Falco
fields agree numerically. This avoids relying on shortened decimal spellings
when emitting Lua, whose number arithmetic differs from the Wurst headless
interpreter's binary32 arithmetic. It does not establish identical arithmetic
rounding to the original game, complete movement transitions or disc revision.
The aggregate passed **404/404**, zero compiler errors and the existing
unused-import warning (smashcraft:build/physics-raw-movement.log).

## Attack recovery checkpoint

Provisional attack cooldown prevents another attack, jump, air dodge, shield
startup, ground steering and facing changes. Air drift remains available.
Attack time freezes during hitlag. Recovery expires before action eligibility
checks; the frame that reaches zero accepts input. Ground steering waits for
recovery to finish. Tests exercise these rules through the shared advance
function.

## Jump out of shield

The local reference's melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c routes
active Guard/GuardOn input to the jump check in
melee:src/melee/ft/kinds/ftCommon/ftCo_Jump.c. Our independently authored
transition now clears shield and enters ordinary jump squat without requiring
shield release first. Holding the trigger cannot re-raise shield during squat.
Shieldstun still blocks the jump. Tests cover both characters and the complete
shield → jump → downward diagonal air dodge → sliding landing sequence.
Ground jumps also cancel shield-release recovery. In the same reference file,
GuardOff's input handling reaches ftCo_800CB024 in ftCo_Jump.c, which checks
jump input. Our transition clears release lag and enters the ordinary
character-specific squat; it does not bypass shieldstun, hitlag, hitstun,
landing recovery or attack recovery. Tests release a real held shield and
check every remaining release-lag tick for both characters, then take off.
Other release cancels and analog shield behavior remain outside this pass.
Ground dodge behavior is described below; this is not a complete
implementation of Melee's shield options.

## Prototype attack phases

Each accepted attack starts at frame zero. Its clock advances on subsequent
simulation ticks and pauses during hitlag. Collision is checked during the
active window, using the current fighter positions; startup and recovery do
not deal damage. Each move can connect once with the opponent, including when
the opponent shields. These are independently chosen prototype timings for
both characters, not sourced Melee move data:

| Attack | Startup ticks | Active ticks | Total ticks, excluding hitlag |
| --- | ---: | ---: | ---: |
| Neutral | 4 | 2 | 36 |
| Ground blaster | 2 | 1 | 24 |
| Air blaster | 2 | 1 | 15 |
| Up/down directional | 8 | 3 | 42 |
| Left/right directional | 6 | 3 | 36 |
| Grab | 5 | 2 | 36 |
| Forward tilt (flat/up-angled/down-angled), down tilt | 5 | 2 | 28 |
| Up tilt | 6 | 2 | 29 |

Warcraft's stock attack animation begins on accepted attack startup; it is
paused during hitlag. It does not yet align its contact pose to the active
window. Authored clips and move-specific damage, shapes and launch angles
remain required. The blaster is now a moving projectile emitted during its
active frame, rather than an instantaneous long-range hit check.

Neutral N is jab, N plus direction smash, and N plus direction while holding
the walk modifier tilt: the owner's input scheme (smashcraft:docs/gameplay-design.md,
"Controls"). C-stick bindings request
smashes directly. Walking uses the character baseline of 1.6/1.4 Melee units
per frame (Rifleman), independently of run speed. Walking changes
directly to the requested walk speed rather than modeling analog walk
acceleration. Tilt damage is 10 side / 8 up / 8 down; Rifleman's down tilt
deals 10 (smashcraft:docs/move-comparisons.md). These damage values
and the ground/air blaster timing
difference are provisional tuning. Blaster duration is captured at attack
start, so landing cannot rewrite its recovery. Aerial normals are now separate
simulation styles: neutral, forward, back, up, and down. Ground normals and grab
are rejected in the air, aerial normals are rejected on the ground, and blaster
remains usable in either state. Air steering changes horizontal velocity while
preserving facing, allowing a back aerial to hit and launch behind the fighter.
Landing cancels an aerial's remaining active/recovery animation and starts its
move-specific landing lag. Aerial hit geometry and damage remain prototype values:
strong damage 7/8/8/8/9; startup 3/5/3/5/7; active 28/2/16/3/3;
total 41/31/37/34/38 ticks; authored landing lag 10/14/16/15/18 ticks, which
they land with halved (see "Aerial landing lag"), in neutral, forward, back,
up, down order. Forward and back hit only on their respective
sides; back launches away from facing, up launches mostly upward, and down
launches downward. Hit regions are simple rectangles around the fighter rather
than authored hitboxes. Neutral/back timing and weak damage are detailed below.

Neutral and back aerials use a shared Falco-inspired timing baseline for both
fighters. The factual tables at https://www.ssbwiki.com/Falco_(SSBM)/Neutral_aerial
(revision 1930482) and https://www.ssbwiki.com/Falco_(SSBM)/Back_aerial
(revision 1651640), retrieved 2026-09-30, report clean contact on frames 4–7,
late contact on 8–31 / 8–19, and interruption on 42 / 38. Cached pages are
smashcraft:build/multiplayer-setup/falco-neutral-air.html and
smashcraft:build/multiplayer-setup/falco-back-air.html. Only these factual numbers
are used; no article prose or decompiled implementation is copied.

The start tick is attackFrame 0, corresponding to reference frame 1. Thus both
moves have strong contact at indices 3–6; neutral lingers at 7–30 and back at
7–18. Completion at indices 41 / 37 permits the next action on reference
frames 42 / 38. The authored animation recovers over this actionable duration;
it does not reproduce the reference's longer full animation lengths (49 / 39).
Strong damage stays 7 / 8, while late damage is provisionally 5 for either move;
ordinary knockback and hitlag use that lower damage. Both phases retain hit
window 1, so a strong hit cannot rehit as weak after hitlag or target reentry.
A missed strong phase can still connect late. Up aerial's separate
finisher window remains unchanged. This is rough shared timing, not a claim of
character-specific Fox/Falco parity; autocancel and current landing lag remain
separate unfinished tuning.

Holding Walk with horizontal input selects forward tilt; adding Up or Down
selects its angled variant. Vertical input alone keeps up/down tilt, and
C-stick smashes retain priority over a normal tilt on the same frame.
All three forward tilts deal 10 damage with 145 horizontal reach. Their
vertical hit coverage is centered at 0 / +65 / -65 relative to the fighter,
with the existing 130-unit vertical tolerance. These are prototype hit shapes,
not measured Melee hitboxes. Launch direction still uses the shared diagonal
knockback calculation. Headless tests cover selection, queue acceptance,
timing, damage, vertical hits/misses, facing and the horizontal range edge.

## Moving blaster shots

Historical fixture before #339: Projectile tuning is 36 Warcraft units per frame and 60 ticks of life
(2,160 units of travel), emitted 35 units ahead and 75 units above the fighter's
feet. The simplified target center is 45 units above the feet, with 24 units
of horizontal radius and 36 units of vertical tolerance. These are prototype
collision dimensions, not reconstructed Melee hitboxes. The increased range
lets a shot cross the arena rather than expire halfway through a long shot.
Archer's arrow effect and Rifleman's beam read simulation positions and are
removed when the simulation consumes or expires the shot; neither visual
determines contact. The Archer fighter asset excludes its separately animated
traveling arrow so that only the simulated projectile appears in flight.

## Ground dodge controls

The sampled ordinary/get-up/tech travel uses numerical observations from
libmelee revision ef679270ff95f0d42339dcdf1608282a35023349,
https://raw.githubusercontent.com/altf4/libmelee/ef679270ff95f0d42339dcdf1608282a35023349/melee/framedata.csv,
SHA256 8e0d811290b511902076c0011db1a0116356a7ddaa68dfa369ea4f5dcdc93777.
The associated library is LGPL-3.0; only factual numerical samples are used,
with no library implementation copied or translated. Signed reversals are
preserved. These are empirical paths, not binary-exact Melee parity. Get-up
paths depend on face-up/down and forward/backward action. Actual displacement,
both facings, stage-edge clamping, hitlag and replay are covered by
smashcraft:wurst/PhysicsTests.wurst.

While holding shield, a fresh left/right press requests a roll; a fresh down
press requests a spot dodge. Input callbacks collect edges and the frame step
resolves them against held shield state, so shield/direction callback order
within that frame does not change the result. Holding direction cannot repeat
rolls; pressing shield while direction was already held does not roll. Two
opposite horizontal press edges cancel, and down takes priority if several
directions arrive in one frame. These are Smashcraft's digital-input rules.

The local reference at melee:src/melee/ft/kinds/ftCommon/ftCo_Escape.c separates
forward/backward roll relative to facing and changes facing through an
animation event. Our simulation owns that transition instead of Warcraft's
animation. No reference implementation is copied. Cached character pages do
not provide verified dodge timing values; the initial ground-dodge parameters
are provisional rather than a Melee parity claim.

Historical fixture before #339: Roll lasts 31 frames and is intangible on frames 4–19 inclusive. Archer and
Rifleman use character/action-specific per-frame translation samples from
smashcraft:wurst/RollTravel.wurst, clamped to the platform edge. Ordinary roll
totals are approximately 201.6 and 231 world units respectively. Illidan keeps
the original 8-unit travel on frames 4–19 (128 units). Spot dodge lasts 22 frames and is intangible on frames
2–15 inclusive. The start tick is frame 1. Archer/Rifleman forward rolls reverse
logical facing on frame 20; Illidan retains his completion-time turn. Backward
rolls preserve facing. Neither move permits attacks, jumps, steering or shielding
during its recovery. Jump takes priority over a simultaneous dodge request.
Spot dodge does not drop through a platform. Intangibility and recovery clocks
pause in hitlag. Every character uses the owner's common dodge profile
(smashcraft:docs/gameplay-design.md, "Deviations from Melee"): spot dodge
22 / protection 2–15, both rolls 31 / protection 4–19, and air dodge 49 /
protection 4–29 with 10 landing frames for every character. Air dodge is
available once per airtime and ends actionable after its 49-frame animation;
landing, a ledge catch or a hit refreshes it (#100).
Both fighters have authored ground-dodge clips. See smashcraft:docs/fighter-animation-work.md
for playback and art limits.

## Knockdown reference observations

The local reference at the revision recorded above distinguishes ground
impact, down wait, stand-up, directional get-up rolls and get-up attack.
melee:src/melee/ft/kinds/ftCommon/ftCo_DownBound.c decrements a waiting timer
and eventually stands the fighter up. Its input priority checks attack,
then roll, then stand. melee:src/melee/ft/kinds/ftCommon/ftCo_DownAttack.c
accepts attack or special; melee:src/melee/ft/kinds/ftCommon/ftCo_DownStand.c
accepts Up or shield. melee:src/melee/ft/kinds/ftCommon/ftCo_Down.c distinguishes
forward/back relative to facing. These are factual state/input observations;
no decompiled implementation is copied or translated. Timing values for our
first recovery pass are provisional rather than extracted animation data.

Historical fixture before #339: Tumble starts at knockback 80 (damage level 3). After hitstun it ends on an
accepted air jump, air dodge or attack, or on a sideways stick flick: at least
+0x210 = 0.8 on the frame the stick crosses +0x008 = 0.25
(melee:src/melee/ft/kinds/ftCommon/ftCo_DamageFall.c `ftCo_DamageFall_IASA`).
A full keyboard diagonal reads 0.707 and does not flick. Landing while still
tumbling techs or starts the 26-tick bound, then the 220-tick wait and its
options listed under "Grounded knockdown and jab resets".
Stand-up lasts 30 ticks; roll lasts 31 and covers 128 world units, clamped to
the current platform. Their first 8 ticks are intangible. Get-up attack lasts
45 ticks, has 16 startup/3 active ticks, deals 7 damage once, covers both sides,
and is intangible during startup. Its hit region uses the ordinary hit formula
with provisional base knockback 75, rather than the generic base 20. At zero
pre-hit damage this yields knockback 98.04 against weight 75 and 97.9 against
weight 80, or 39 hitstun ticks under the current floor(0.4 × knockback) rule.
This move-specific value is intended to make a clean low-percent hit cause a
knockdown and leave the attacker time to act before normal attack eligibility
returns; it is original tuning, not a Melee move-data value. The focused test
checks actual action eligibility for both fighters in both facing directions,
including a successful neutral tech, plus shield and whiff outcomes. In the
clean missed-tech case the attacker can act 34 ticks after contact and its jab
becomes active at tick 38; the defender's earliest get-up attack becomes active
at tick 54 (Rifleman defender) or 50 (Archer defender). These are measured
headless simulation results with neutral DI, not a guarantee against every
defensive input or a native-runtime measurement. Recovery and hitstun clocks
pause together during hitlag.

All these recovery timings, threshold and hit shapes are provisional.
Instant surface impact replaces a physical bounce; face-up/down
variants, jab resets, and character-specific get-up data remain unfinished.
Jump also stands a downed fighter up, for keyboards. Both fighters
have authored recovery clips; get-up rolls reuse ordinary roll clips.

Impact presentation uses three distinct cues: a nine-frame white contact
star for damage, a fifteen-frame floor glint for successful techs, and a
twelve-frame green/white floor burst plus thirty-two-frame spreading dust for
missed techs. The latter stays at the landing point as the fighter recovers.
These are original procedural models based on the owner's visual direction;
their display lifetimes do not alter hitlag, tech windows, or recovery timing.
smashcraft:wurst/ImpactEvents.wurst derives one frame's cues from numerical
before/after state, including both fighters in a trade. The live adapter uses
40 preallocated effects and presents each completed frame once; headless
replay creates no effects. Reconciliation of changed speculative journals is
still part of the unimplemented visible-rollback milestone.

Spot dodges emit two small outward-moving dust puffs. Ordinary, get-up and
tech rolls emit a compact blue-white star and one smaller puff moving opposite
the roll. These use frame-entry events, so sustained invulnerability does not
repeatedly create the cue.

Historical fixture before #339: Archer's down-air uses seven startup ticks and 20 active ticks (indices
7–26), with 38 total ticks. Its first three active ticks deal 9 damage and
the lingering kick deals 6, sharing one hit registry window. Its collision
region remains ±55 horizontally and −180..−10 vertically. Landing cancels
into 9-frame recovery, half its authored 18. The tucked startup and downward
kick are animation only: down-air preserves ordinary aerial momentum,
gravity, and knockback. C-stick Down does not set movement Down or force
fast-fall; explicit straight-down movement retains separate fast-fall.
These are provisional design values, not extracted Sheik frame data.

## Floor-tech reference

The local Melee checkout's
melee:src/melee/ft/kinds/ftCommon/ftCo_DownAttack.c gates tech eligibility on
input timing counters and common data, and
melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveStand.c chooses forward/back by
horizontal input relative to facing. Those data field offsets are not timing
values. No decompiled implementation is copied.

The Melee section of https://www.ssbwiki.com/Tech, retrieved 2026-09-29 and
cached at ~/code/smashcraft/worktrees/test-loop/build/ref-Tech.html, reports a
20-frame digital shield-press window and a 40-frame interval between presses.
A repeated press inside that interval cancels the current opportunity. Grounded
shield presses also count. Pressing before the last hitlag frame leaves one
post-hitlag opportunity; pressing on the last hitlag frame leaves 20. The
lockout lasts 40 frames after hitlag. Most characters have six vulnerable frames
at the end of a tech. These are factual parameters from a secondary reference,
not extracted local binary measurements. Analog-trigger behavior is outside our
digital keyboard controls.

The first floor-tech implementation counts the press tick as opportunity 1:
contact through +19 ticks succeeds and contact at +20 misses. Every fresh
digital shield edge, including a grounded one, restarts the 40-tick lockout;
a retry inside it cancels the open opportunity. Holding Shield creates no new
edges. Input captured during early hitlag leaves one contact tick after freeze;
an accepted press on the final frozen tick leaves the full window. A window
opened before hitlag simply freezes in our implementation; that case has not
been independently verified against Melee.

An in-place tech lasts 26 ticks with intangibility on 1–20; a directional tech
lasts 40 with intangibility on 1–34. These totals are shared chosen tuning;
both leave six vulnerable recovery ticks. Rifleman use 39 empirical
motion samples and a stationary final tick; Illidan retains the 128-unit path. Direction at
contact chooses the roll when the stick is at least +0x254 = 0.2 sideways
(`ftCo_80098928`); its movement is clamped to the current platform.
A tech clears impact hitstun and consumes its input window. Early-hitlag versus
last-hitlag inputs, repeated/grounded presses, window/lockout boundaries,
recovery actions, interruption and reset are tested in the simulation the map
runs. Wall and ceiling techs are in "Wall and ceiling techs and wall jumps"
below; SDI and ASDI shifts meet the main deck's walls and underside as other
movement does (smashcraft:ts/src/game/sim/smashDirectionalInfluence.ts).

## Aerial landing lag

Landing ends an unfinished aerial and starts its landing lag: half the move's
authored lag, at least one frame, which is Melee's L-cancelled lag (PlCo +0x0E8
= 2, melee:src/melee/ft/kinds/ftCommon/ftCo_LandingAir.c). Neutral, forward,
back, up and down aerials land for 5/7/8/7/9 frames, from authored
10/14/16/15/18. No input changes it: Smashcraft omits L-cancelling, see
smashcraft:docs/gameplay-design.md. Empty landings (4 frames) and air-dodge
landings (10) keep their own lag.

## Smash charge

Melee smash attacks can be charged for up to 60 frames while holding attack.
SmashWiki reports a Melee maximum damage multiplier of 1.3671× (the 1.4× figure
is the rounded general-series value). Source: https://www.ssbwiki.com/Charge,
retrieved 2026-09-29 and cached at
`~/code/smashcraft/worktrees/test-loop/build/ref-Charge.html`. The local
reference's smash-charge data path in `melee:src/melee/ft/ftaction.c` and
`melee:src/melee/ft/ft_0DF0.c` confirms that duration and multiplier are
separate inputs and that damage grows with charge progress; the local
decompilation does not supply the game-data values. No implementation text is
copied.

The prototype lets a grounded up, down, or forward smash started through the
normal Attack binding pause just before its active frames. Holding Attack
accumulates at most 60 logical ticks; releasing it, reaching the cap, or
leaving the ground resumes the attack. Damage scales linearly to 1.3671× and
feeds the ordinary knockback calculation. Hitlag pauses charge accumulation;
fighter steering and attack/cooldown clocks pause while ordinary world timers,
gravity and platform motion continue. C-stick/direct smash commands are
immediate. These state and input rules are prototype choices, not claims of
complete Melee state-machine parity. Simultaneous hits snapshot both charge
amounts before applying either impact so trades retain both damage values.

## Platform drop priority

Live attack commands remain eligible for six simulation frames after their
assigned frame. They execute once when the action becomes legal, or expire;
this adds no delay to an already legal attack. During jump squat a C-stick
command retains its direction and resolves against airborne state at takeoff,
so an opposite-facing horizontal command begins back-air on the first airborne
frame. Melee has no general input buffer; Smashcraft's six-frame window is
adopted in smashcraft:docs/gameplay-design.md, "Execution and reaction windows".

A current queued attack takes priority over voluntary platform dropping during
the movement step. Action recovery also blocks the drop, so holding Down cannot
drop through during down-smash startup/charge or down-tilt recovery. With no
current attack or action lock, a fresh Down starts a platform descent:
like Melee's Pass check (melee:src/melee/ft/kinds/ftCommon/ftCo_Pass.c, stick
down past PlCo +0x464 = 0.66 entered under PlCo +0x468 = 6 frames ago), the
press must be under six input frames old. The fast-fall input age is that one
stick timer, so landing on a deck with Down still held stays on it.
The command queue's actual frame window determines whether an attack is current;
expired and future commands do not suppress movement. This is our digital-input
priority rule. The adopted mechanic defaults add no dedicated analog-threshold
shield-drop technique; shielded fighters keep their existing escape choices.

## Melee behaviour oracle

`bun wisp oracle` (from smashcraft:ts/) plays scripted Melee situations for
every fighter through the frame executor, from controller rows, and prints each
outcome beside the value cited from the decompilation and the retail reference
corpus, with the constant and source path for each scenario, then the counts
per area. The scenarios are in smashcraft:ts/scripts/meleeOracle.ts: jump squat
and hop heights, dash/run/walk speeds, fast-fall, landing lag, floor techs,
get-up options and timings, the tumble threshold, pass-through platforms, the
main deck's walls and underside (where launches meet them, the techs off them,
the push-off and wall jumps), shield release and dodges, and ledge catches, one
from against the wall.
smashcraft:ts/test/melee-oracle.test.ts runs the table in the test suite and
fails on any mismatch not listed in its `KNOWN_MISMATCHES`, and on a listed row
that now passes. A difference from Melee recorded in the deviations table of
smashcraft:docs/gameplay-design.md is reported as a departure under that row's
name and still shows Melee's value; it fails the test only if it stops
differing, and the test checks that every departure names a row of the table.
The aerial landing lag without an L press is such a departure (L-cancelling).

Historical fixture before #339: Character data compares only where a fighter borrows it: Archer's and
Rifleman's movement, landing and action timings are Fox's and Falco's, and
Illidan's are original, so those rows read n/a for him; Illidan's ledge catch
box and wall data are Captain Falcon's, as Archer's and Rifleman's are Fox's
and Falco's. Common rules (input windows, tech gates,
knockback, platforms, ledge boxes) apply to all three. Where Smashcraft
authors a value, such as ground acceleration or aerial landing lag, the
scenario checks Melee's rule applied to it, not the value.

## Pass-through platforms

Stage 1's two raised decks are pass-through platforms, as in Melee: a fighter
rises through them from below and lands on top only while descending onto
them, and Down drops through them. They have no walls or underside, so they
never stop upward motion, bump a fighter's head, rebound a launch or allow a
wall or ceiling tech. In Melee a platform is a floor line flagged
`LINE_FLAG_PLATFORM` (melee:src/melee/mp/forward.h, revision 0296f009f):
`mpCheckFloor` (melee:src/melee/mp/mplib.c) hits a level floor line only while
the ECB bottom descends, `mpCheckCeiling` scans ceiling-kind lines only, and
`mpJointUpdateDynamics` disables a platform line that is not floor-kind;
`mpColl_80044628_Floor` (melee:src/melee/mp/mpcoll.c) skips the platform being
dropped through. The main deck's walls and underside are below.

Smashcraft departs from Melee's instant pass-through (#103, #392): a body
whose ECB top rises into a platform climbs it, ending any aerial; a fresh Down
on one, or full Down when falling onto it, drops through it; and the stick's
depth toward the platform at contact chooses whether a climb stands on it,
each move lasting the fighter's jump squat (smashcraft:docs/gameplay-design.md,
"Platforms"; smashcraft:ts/src/game/sim/platformMoves.ts). The walking modifier
keeps a digital Down on a platform for crouching and down tilts. Falling onto a platform with no intent lands, and the platforms' lack of
walls and underside is unchanged.

## Slippery floors

A deck can have a floor friction below one; shallow water's, on Tomb of
Sargeras's main deck (its overhanging platforms are dry), is 0.5
(`WATER_FRICTION`, smashcraft:ts/src/game/sim/stage.ts). While a fighter
stands on such a floor, every traction it slides against is multiplied by it:
the run brake and dash/run stop, the neutral ground drag that carries a
wavedash or waveland, the ground knockback slide, and shield pushback and
recoil. Each of those slides is about twice as long on water. Acceleration,
the dash's entry speed and authored travel (rolls, attack movement) are
unchanged, so a fighter starts moving as on ground but stops late. In the air
and on ordinary decks the friction is exactly one and the arithmetic is
unchanged.

Melee multiplies traction by the floor material's friction the same way, in
`ft_GetGroundFrictionMultiplier` (melee:src/melee/ft/ft_081B.c) and the
material table `mpLib_803BF248` (melee:src/melee/mp/mplib.c): 1.0 for most
materials (including Melee's water, which only splashes), 0.9 for Great Bay's
turtle, 0.2 for ice and 0.1 for the UFO. Melee also scales the ground
acceleration itself (`ftCommon_SetSelfMovementFromGroundedMovement`,
melee:src/melee/ft/ftcommon.c), which makes starting on ice sluggish.
Tom decided, 7 Oct (delegated): shallow water uses 0.5, between the turtle and
ice, so slides are clearly longer without Icicle Mountain's ice, and only the
slowing is scaled, so water is slippery, not sticky. The computer players'
slide prediction (smashcraft:ts/src/game/match/botFooting.ts) uses the same
friction. smashcraft:ts/src/game/sim/floorFriction.tests.ts compares each
slide on ordinary ground and water with the same fighter and input.

## Main deck walls and underside

Every stage's main deck has Final Destination's side walls and underside.
Final Destination is the reference because stage 0 is its layout, one flat
deck, and stage 1 keeps the same main deck. The lines come from its
`coll_data` (melee:src/melee/mp/types.h `MapCollData`, `MapLine`; loaded by
`mpLibLoad` in melee:src/melee/mp/mplib.c) in the owner's GALE01 revision 2
GrNLa.dat (611125 bytes, SHA-1 fa607d7bb7dd4072d2d3968e1e31fd458bc397f8),
whose `grGroundParam` scale (`Ground_801C0498`) is 1. The private reader is
~/.local/share/smashcraft-melee-reference/stage-collision-facts.ts; only the
numbers below are kept.

Below its floor (ledge vertices at x ±85.5657, y 0) each side is five
wall lines and a short sloped underside, in Melee units:

| Line | Kind | From | To |
| --- | --- | --- | --- |
| 9 | right wall | (85.5657, 0) | (85.5657, -10.5) |
| 10 | right wall | (85.5657, -10.5) | (65.7993, -20.4538) |
| 7 | right wall | (65.7993, -20.4538) | (65.8374, -31.3443) |
| 8 | right wall | (65.8374, -31.3443) | (61.4195, -47.3663) |
| 6 | right wall | (61.4195, -47.3663) | (53.7736, -54.2584) |
| 5 | ceiling | (53.7736, -54.2584) | (47.4560, -55.3882) |
| 4 | ceiling | (47.4560, -55.3882) | (-47.4560, -55.3882) |

Lines 3, 15, 14, 12, 13 and 11 mirror lines 5, 6, 8, 7, 10 and 9 on the left.
The face kinds are Melee's: line 10 slopes in under the ledge but is a wall,
so a launch into it can wall tech. smashcraft:ts/src/game/sim/stage.ts keeps
each side's lines as far from its own ledge as they are from Final
Destination's, at six world units per Melee unit. Smashcraft's deck is 200 Melee units wide to Final
Destination's 171.13, so the level underside spans the wider deck between the
sides: in world units the walls drop straight from each ledge (x ±600) to z -63,
slope in to x ±481.4 at z -122.7, and meet the underside at z -332.33,
which spans x ±371.3. The main deck's model is drawn from these lines on
every stage: smashcraft:ts/scripts/stageDeck.ts extrudes the walking line,
walls and underside 60 units to each side of the fighters' plane, and
smashcraft:tools/stage/package.ts writes it at arena scale, named after its
MDL text. smashcraft:ts/test/stage-model.test.ts checks that the shipped
model is the one drawn from the current lines, that its front faces' outline
is those lines on both shipped stages, and that its model facts' bounds reach
each wall and the underside. Stage 1's raised decks keep the scaled slab.

Historical fixture before #339: A fighter meets a wall with its flank: Melee's ECB side touches the wall, and
`mpColl_LoadECB_JObj` (melee:src/melee/mp/mpcoll.c) keeps an airborne ECB at
least 2 units a side. Smashcraft fighters use that 2-unit half-width
(`BODY_HALF_WIDTH`, smashcraft:ts/src/game/sim/surfaces.ts), so a fighter
stopped against the wall below a ledge stands 12 world units outside it, and
its ledge catch box (which adds the same half-width) still holds the ledge.
Undersides and other ceilings stop the fighter's top: Melee's airborne ECB
top, the highest of the six ECB bones its fighter data lists (ftData x44),
which falls and jumps load with no pad (`mpColl_LoadECB_JObj`). In each
reference model's bind pose (PlFxNr.dat, PlFcNr.dat, PlCaNr.dat, read by
~/.local/share/smashcraft-melee-reference/ecb-top-facts.ts) times its
`model_scaling` (+0x8C) that is Fox's 11.625 x 0.96 = 11.16 for Archer,
Falco's 12.5 x 1.1 = 13.75 for Rifleman and Captain Falcon's 19.36 x 0.97 =
18.78 for Illidan, Melee units (`bodyTop`, smashcraft:ts/src/game/sim/surfaces.ts).
The contact, and the ceiling tech or bounce that starts from it, is on the
ceiling; the fighter stands its top below it. The animation moves Melee's
bones, so its ECB top changes from frame to frame; Smashcraft keeps the bind
pose's. Under the main deck's underside the bottom blast zone (-420) leaves
Archer 20.7 world units and Rifleman 5.2, and Illidan none: his position
would be past it (#80 lowers it to Final Destination's). A wall moves the fighter but not its own velocity,
as Melee's airborne collision only moves the position (`ft_800835B0`,
melee:src/melee/ft/ft_081B.c): launch velocity into the wall stops, or a
tumbling launch rebounds at 0.8, and a fighter that rises past the wall's top
carries on over the stage. An underside stops a rise. A fighter that slips past
a ledge's corner within its half-width of the wall, as when running off the
ledge, is moved out sideways to its flank, as Melee's ECB slides off the
corner. A wall tech pushes off along the facing it turns to, away from even a
sloped wall (`ftCo_PassiveWall_Anim`); see "Wall and ceiling techs and wall jumps" below.

Ledge actions don't collide with the body; Melee's cliff actions run their own
collision (`ftCo_CliffClimb_Coll`). Climbs, rolls and ledge attacks pass through
it onto the floor. A ledge jump starts beside the wall below the ledge, slides
up its face and carries its inward speed onto the stage. Wall and ceiling
contact tests on raised decks use `SOLID_DECK_TEST_STAGE`
(smashcraft:ts/src/game/sim/stage.ts), stage 1's layout with solid raised
decks, which no match can select.
smashcraft:ts/src/game/sim/surfaces.tests.ts checks the geometry against the
table, smashcraft:ts/src/game/match/wallTechInputContracts.tests.ts launches
each fighter into the side through helper journal rows and techs off it, and
the oracle's wall/ceiling and ledge rows check where launches meet the side and
underside, the techs off them and a catch from against the wall.

## Camera limits, off-screen damage and blast zones (Melee reference)

Melee gives each stage three nested regions. The numbers below come from the
owner's GALE01 revision 2 files through the private readers
~/.local/share/smashcraft-melee-reference/blast-zone-facts.ts,
camera-facts.ts and offscreen-damage-facts.ts. Only the numbers are kept.

**Stage points.** A stage's `map_head` general points
(melee:src/melee/gr/ground.c `Ground_801C34AC`) set the camera offset (0x94),
camera range (0x95, 0x96) and dead range (0x97, 0x98). `Ground_801C39C0` and
`Ground_801C3BB4` store them relative to the offset, and
melee:src/melee/gr/stage.c adds it back, so the absolute values are the
points themselves. In Melee units:

| Stage file | Offset | Camera left/right | Camera top/bottom | Blast left/right | Blast top/bottom |
| --- | --- | --- | --- | --- | --- |
| GrNLa.dat (Final Destination, SHA-1 fa607d7b) | (0, 12) | -170 / 170 | 114 / -80 | -246 / 246 | 188 / -140 |
| GrNBa.dat (Battlefield) | (0, 44) | -200 / 200 | 170 / -59 | -280 / 280 | 250 / -136 |
| GrSt.dat (Yoshi's Story) | (0, 44) | -180 / 179 | 169 / -71 | -251 / 248 | 240 / -130 |
| GrOp.dat (Dream Land) | (0, 9) | -165 / 165 | 190 / -81 | -255 / 255 | 250 / -123 |
| GrIz.dat (Fountain of Dreams) | (0, 40) | -165 / 165 | 150 / -113 | -265 / 265 | 270 / -195 |
| GrPs.dat (Pokémon Stadium) | none | -181 / 180.25 | 142 / -66 | -230 / 230 | 180 / -111 |

Pokémon Stadium's file has no offset point, so `Ground_801C39C0` reports
"use dummy CamRange" and uses its default range (-170, 170, 120, -60); its
dead range is the points above. Converted the way the main deck's walls are
(each side keeps its distance from its own ledge, ±85.5657 on Final
Destination; heights are six world units per Melee unit above the floor),
Final Destination's camera limits are x ±1106.6, z -480 to 684, and its
blast zones x ±1562.6, z -840 and 1128.

**KO.** `ftCo_800D3158` (melee:src/melee/ft/ft_0D31.c) runs after each
frame's movement (`Fighter_procUpdate`, melee:src/melee/ft/fighter.c): right
if x > right, left if x < left, top if y > top and the fighter is grounded,
frozen or launched upward faster than PlCo +0x4F0 = 2.4 Melee units/frame
(a star KO with chance PlCo +0x520 = 16 in 100 unless the camera forbids it),
bottom if y < bottom. Every comparison is strict.

**Camera.** melee:src/melee/cm/camera.c `Camera_8002B3D4` frames the
fighters' camera boxes, eases toward that framing and keeps the view inside
the camera range; smashcraft:docs/melee-camera.md lists its steps, constants
and where our camera differs.

**Off-screen.** A fighter is off-screen when its camera bone projects outside
the screen (`ftLib_UpdateScreenVisibility`, melee:src/melee/ft/ftlib.c;
`Camera_80030BBC`). The magnifier (melee:src/melee/if/ifmagnify.c) then draws
it at the screen edge along the direction from the screen's centre, clamped
to ±252.7 × ±162.7 of the 640×480 frame, with an arrow rotated to that
direction. `Fighter_procAnim` (melee:src/melee/ft/fighter.c) counts frames in
the magnifier while the fighter's percent is under PlCo +0x7B0 = 150 and
deals PlCo +0x7B4 = 1% every PlCo +0x7AC = 60 consecutive frames, resetting
the count whenever the fighter is back on screen; at 150% or more the count
neither runs nor resets. Versus matches enable it (`gmvs.c` sets the player
flag unless the mode's xD_b2 is set; training, home-run contest, all-star and
some events clear it).

Smashcraft stores one **16:9 match view** and each fighter's magnifier timer
in deterministic snapshots. Its subject extents, eye-distance easing and
interest rates use the reference values (smashcraft:docs/melee-camera.md). The camera remains a side
view: Warcraft keeps the yaw at 90° and the downward pitch at 10°; the field
of view eases its half-angle tangent between the cited 30° and 38° endpoints
by 10% each frame. This is the projection used by
smashcraft:ts/src/game/sim/matchCamera.ts, not Melee's rotating 3D camera.
Local rendering reads that view, adapts it to the monitor's aspect, and never
writes the resulting local view into gameplay. A fighter outside the
canonical current view, including one that briefly outruns it inside the
stage camera limits, counts toward the 60-frame damage rule. Practice disables
that rule. At 150% the counter is retained, even on returning to view.

The current flat deck and two-bridge layout use Final Destination's bounds;
Frozen Throne's Battlefield layout uses GrNBa.dat's points, with each side's
distance from its ±68.4 Melee ledges preserved. In world units its camera is
x ±1389.6, z -354..1020, and its blast region x ±1869.6, z -816..1500.
smashcraft:ts/src/game/sim/stageBounds.ts owns these conversions.

The unobscured fighting view stops at the camera limits. The part behind
the HUD may extend below the bottom camera limit, but the whole raw frame
stops at least 20 world units above the bottom blast plane. Corner clamping
shapes the eased goal, then runs again after easing and after local aspect
adaptation. Recovery within 100
world units of the main deck underside keeps the fighter and nearby underside
above the HUD; a distant high fighter may then use a bubble. Bubbles project
the fighter's camera point against the actual local view and place its portrait
and directional chevron along the ray from the screen centre, using Melee's
magnifier inset and staying above the HUD. They receive no input focus.

In a development build, `-dev camera` starts a one-stock match with the first
fighter frozen outside the camera limits for three seconds, then its retained
launch moves it across the side blast plane. It exercises the portrait, arrow,
offscreen damage and an off-camera KO without changing combat completion.

## Wall and ceiling techs and wall jumps

A wall tech holds the fighter on the wall for five frames (PlCo +0x760), then
pushes it off away from the wall at its reference's `passivewall_vel_x`
(ftCo_DatAttrs +0x100), or, when jump was pressed in the last 20 frames or
the stick is up (`ftCo_800C1E0C`), launches its reference's wall jump (+0x104
sideways, +0x108 up), then air friction and gravity act as usual
(melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c). Each fighter takes
these from its Melee reference, read from the owner's GALE01 revision 2 DATs
(smashcraft:docs/smash-melee-reference/physics-parameters.json), in Melee
units a frame:

| Fighter | Reference | Push-off | Wall jump sideways | Wall jump up | Minimum approach | Ceiling impulse (frame) |
| --- | --- | --- | --- | --- | --- | --- |
| Rifleman | Falco | 0.5 | 1.3 | 3.6 | 0.5 | 0.7 (14) |
| Illidan | Captain Falcon | 0.5 | 1.4 | 3.1 | 0.5 | 2.0 (11) |

All three references wall jump (`ftFx_Init_OnLoad`, `ftFc_Init_OnLoad` and
`ftCa_Init_OnLoad` set `can_walljump`); a fighter whose tuning lacks
`canWallJump` never wall jumps. Every hero takes Fox's values, so
every selectable fighter wall techs and wall jumps.

**Intangibility.** The wall tech, the wall tech's jump and the plain wall jump
all enter through `ftCo_800C1E64`, which ends with
`ftColl_8007B760(gobj, PlCo +0x764)`: the fighter is intangible for 14
frames, counted from the frame it meets the wall (melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c;
the plain jump reaches it from melee:src/melee/ft/ftwalljump.c
`ftWallJump_8008169C`). The five-frame hang is inside that window, so the
fighter leaves the wall on frame 6 still intangible through frame 14 and is
hittable from frame 15. Smashcraft gives all three the same 14 frames
(`SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES`, smashcraft:ts/src/game/sim/surfaces.ts).

A ceiling tech (`ftCo_800C23FC`, melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveCeil.c)
stops the fighter's motion and has no hang: gravity and air drift go on
(`ft_80084DB0`). On its animation's throw-flag event, frame 14 for Fox and
Falco and 11 for Captain Falcon
(smashcraft:docs/smash-melee-reference/retail-ceiling-tech-events.json), the
fighter's sideways speed becomes the stick's horizontal value times its
reference's `passiveceil_vel_x` (+0x10C, `ftCo_PassiveCeil_Anim`), and it
stops being intangible. That frame's drift follows Melee's
`ftCommon_CalcSelfAccel_AccelToVelClampedFrom` (melee:src/melee/ft/ftcommon.c)
for every fighter: toward the stick it adds the acceleration up to the air
speed, and above it subtracts the air friction instead, no lower than the air
speed and no higher than +0x078 `air_max_horizontal_velocity` (Captain
Falcon's 3 for Illidan). Captain Falcon's own drift turns his 2.0 into 1.99,
so Illidan's authored immediate drift cap does not apply on that frame: with
his own friction his 2.0 becomes 1.98. From the next frame his ordinary drift,
capped at 0.88, applies again.

Analog rows retain their raw horizontal axis for air drift, before the
directional-influence stick is normalized diagonally. Per
`ftCommon_CalcSelfAccel_DriftFrom`, the target air speed scales by the
horizontal stick magnitude, while acceleration adds the signed base to the
stick times the multiplier. The shared retail base for Fox, Falco and Captain
Falcon is 0.02 Melee units/frame (+0x068); Smashcraft's authored full-stick
acceleration stores base plus multiplier. Full horizontal keyboard rows,
including keyboard diagonals, keep the existing full-rate drift. The
input-row fixture is `ts/src/game/sim/analogAirDrift.tests.ts`.

A wall jump follows `ftWallJump_8008169C` (melee:src/melee/ft/ftwalljump.c).
After the frame's collision, a fighter that is falling, jumping, tumbling
past hitstun, or in a wall or ceiling recovery past its hang checks it;
aerials, specials, air dodges, special fall and hitstun don't. Meeting a wall
faster sideways than the minimum approach speed opens a 130-frame window
(PlCo +0x768) while the fighter stays against that wall, and pushing the
stick at least 0.8 away from it (+0x76C) within 3 frames of the stick leaving
the horizontal smash deadzone (+0x770) starts the jump. It enters the wall
tech's state (`ftCo_800C1E64`): motion stops, the fighter turns away, it is
intangible for 14 frames (+0x764, see above), hangs 5 (+0x774), then launches as above. Each
earlier wall jump since the fighter last stood on the ground scales the rise
by 0.975 (+0x778). A fighter moved out of the deck's body (see above) counts
as against that wall, as Melee's collision leaves it touching.

smashcraft:ts/src/game/match/wallTechInputContracts.tests.ts checks the
push-off, the wall tech's jump, a drift-and-flick wall jump, their 14
intangible frames (an overlapping strike passes through until the 15th) and
the ceiling tech's impulse for every selectable fighter through helper journal rows, and the oracle's
wall/ceiling rows compare the hang, launch speeds, rises and the ceiling
impulse's frame and speed with the reference values.

## Shield presentation boundary

The guard shell and HUD percentage read shieldEnergy/SHIELD_MAX; they do not
resolve collision. The shell shrinks as energy drains, while the current
prototype still blocks eligible contacts through its existing whole-fighter
shield rule. Shield tilting, geometric shield pokes and analog light shielding
remain differences. Shield-break recovery is described below. Green/yellow/red HUD colors
and the Warcraft spell shell are presentation choices, not reference parameters.

## Shield-break recovery

Shield depletion from holding guard, melee contact, and projectile contact now
uses one independently authored forced sequence in smashcraft:wurst/Simulation.wurst:
upward pop, landing, standing up, then dizziness. It replaces the former
40-frame hitstun placeholder. The factual reference is
~/code/resources/melee at revision 0296f009f32f710495979d30772d8332af2d411a,
specifically melee:src/melee/ft/kinds/ftCommon/ftCo_ShieldBreakFly.c,
melee:src/melee/ft/kinds/ftCommon/ftCo_ShieldBreakDown.c,
melee:src/melee/ft/kinds/ftCommon/ftCo_ShieldBreakStand.c and
melee:src/melee/ft/kinds/ftCommon/ftCo_Furafura.c. The supplied factual
observations establish upward launch, forced landing/stand, unavailable normal
actions, shorter dizziness at higher percent, mash recovery, and restored
shield health held fixed while dizzy. No license covering this decompiled game
implementation was found; none of its implementation text or structure is
copied or translated. The sequence is expressed in our existing fixed-tick
simulation with our existing collision query.

The factual page https://www.ssbwiki.com/Shield, already cached in
smashcraft:build/ref-Shield.txt, independently reports the pop/landing/stand/dizzy
sequence, percent dependence, mashing, termination by flinching attacks, and
30 HP after a Melee shield break. The cached page was consulted for facts only;
no article prose is reused. It does not verify our timings or launch strength.

Verified retail common values set shield maximum to 60, held digital drain to
0.14 times the full-shield factor 2 (0.28 per logical frame), regeneration to
0.07 per frame, and post-break restoration to 30. The digital shield-damage
and shieldstun rules use integer hit power. Raw stun is
`integerDamage * 0.3 * 1.5 + 2`; action ticks are
`floor(rawStun * 200 / 201)`. Defender pushback is
`min(2, rawStun * 0.2 * 0.6)`, while grounded direct-attacker recoil is
`integerDamage * 0.07 + 0.02`. The common grounded recoil-friction multiplier
is 1.1; airborne recoil decays by 0.05 per frame.

The sourced dizzy duration is the real-valued `max(0, 400 - percent) + 90`,
sampled on entry. Each unfrozen action tick removes 1; a fresh synchronized
mash edge removes an additional 3. The fractional remainder stays in replayed
state. InputSnapshot.mashPressed admits at most one such edge per tick; held
inputs alone are not mash edges. Mash edges before dizziness or during hitlag
have no effect and are not banked. Analog light-shield interpolation remains
unsupported. The authored 12-tick landing pose and 30-tick stand pose remain
prototype animation lengths and are not inferred from these common values.

The numeric common source is verified GALE01 revision 2 (PlCo SHA-1
`c904de0c4c5eb3ef65211a75d8bd70ca5b0f9f41`); no proprietary binary is retained
in this repository. The decompiled source is used for numerical facts and
field behavior only.

Shield regeneration runs once after input transitions and contact collection,
before contact damage resolves. The source callback order is animation, input,
grab collision, attack collision, then collision resolution; regeneration begins
the last of these. The factual source is melee:src/melee/ft/fighter.c at the
revision above. An active fighter without guard gains 0.07000000029802322 per
tick, capped at 60, including hitlag, ledges, grabs, down states and wall-tech
startup. A guard-to-grab input or capture clearing guard therefore permits
regeneration that tick. Continuing guard does not. Smashcraft's custom trap
freeze also retains regeneration; that extension has no retail counterpart.

Shield-break pop/landing/stand use the same regeneration phase. Dizzy entry and
each unfrozen dizzy animation tick restore 30 before regeneration, leaving
30.07 after the frame, including expiration if no new guard starts. Hitlag
pauses that reset but not regeneration. The shared standalone actor step and
production match step compose the same motion and regeneration phases; the
match delays regeneration until both fighters' contact collection is complete.
Inactive (`out`) fighters do not regenerate. Melee's separate sleeping flag is
not modeled, so this is not a claim of complete sleeping-state parity. These
rules establish logical ordering, not exact binary32 arithmetic parity.

Shield depletion requires health strictly below zero; reaching exactly zero
keeps guard active, including for another hit during hitlag. Continuing drain
can then break it on the next action tick. A drain-caused break sets health to
zero before that frame's regeneration, leaving 0.07. A damage-caused break sets
health to the common restoration value 30 during contact resolution, after
regeneration has already run; its first later non-guard frame reaches 30.07.
The common break transition preserves that caller-selected health. These facts
come from melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c,
melee:src/melee/ft/fighter.c and
melee:src/melee/ft/kinds/ftCommon/ftCo_ShieldBreakFly.c at the revision above.

Held guard drains at the active animation boundary before jump, ground dodge,
release or grab inputs. A resulting break preempts those inputs; reaching
exactly zero instead still permits a legal exit, followed by regeneration.
Ordinary guard input entry initializes guard without draining on that tick;
the following active animation tick supplies its first held drain. Hitlag
pauses drain. Shieldstun and its return-to-guard completion tick do not drain;
guard inputs become available on that completion tick, with drain resuming on
the following tick if guard remains active. The source entry call processes
animation commands, but does not invoke GuardOn's animation callback; the
GuardOn/Guard callbacks own drain, and GuardSetOff's callback owns return to
guard. This distinction is sourced from melee:src/melee/ft/ftanim.c and
melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c at the revision above. Powershield
and analog light-shield state transitions remain outside this digital-guard
model.

Movement, fast falling, attacks, shielding, jumps, air dodges, ground escapes,
platform drops, ordinary get-up actions and floor techs cannot cancel recovery.
Landing uses the highest crossed eligible surface; it does not enter ordinary
knockdown or gain that system's get-up intangibility. A break grants no
invulnerability and never calls the respawn reset.

Ordinary flinching melee damage, grabs and Falco's flinching laser cancel any
break phase into their normal consequences. Fox's non-flinching laser adds
percent without cancelling recovery or recomputing an already active dizzy
timer. Hitlag freezes phase clocks, vertical movement and mash recovery.
Blast-zone stock loss clears break state; real respawn restores the existing
full shield and 90-tick invulnerability. Reset also clears the break serial.

The adapter contract is FighterState.shieldBreakState (`SHIELD_BREAK_NONE=0`,
`SHIELD_BREAK_AIR=1`, `SHIELD_BREAK_LAND=2`, `SHIELD_BREAK_STAND=3`,
`SHIELD_BREAK_DIZZY=4`), shieldBreakFrame (elapsed unfrozen ticks in the current
phase, zero on entry), and shieldBreakSerial (increments once per break).
shieldBreakRemaining is the real-valued dizzy countdown;
shieldBreakDizzyFrames(percent) exposes its initial sourced duration. Public timing constants are
SHIELD_BREAK_LAND_FRAMES=12, SHIELD_BREAK_STAND_FRAMES=30 and
SHIELD_BREAK_RESTORED_ENERGY=30. LAND begins on contact; each timed phase
transitions after exactly its stated number of later unfrozen ticks. Expiration
clears state/frame/countdown and permits otherwise legal actions on that same
simulation tick.

Eight focused Wurst tests cover all depletion paths, both characters' actual
pop trajectories and forced actions, phase boundaries, percent/mash recovery,
hitlag in every phase, damage/grab interruption, the two laser behaviors,
stock loss/reset, fixed shield health and absence of break invulnerability.
These are simulation checks; native rendering, keyboard synchronization across
two clients, and numerical Melee parity are separate unproven claims.

## Outer ledge recovery

Only the two outer endpoints of solid main surface 0 can be caught. Upper
pass-through platforms have no catchable ledges. The behavioral reference is
melee:src/melee/ft/kinds/ftCommon/ftCo_CliffWait.c and the adjacent CliffClimb,
CliffJump, CliffEscape and CliffAttack actions at the revision above. Their
separate ledge options and quick/slow variants are factual context only. The
local data field offsets do not establish the options' timing or geometry;
none of that unlicensed implementation is copied or translated.

Catching follows Melee's cliff-catch check at the revision above:
melee:src/melee/ft/ftcliffcommon.c (the catch, its facing turn and
`ftCo_CliffCatch_Phys` placement), the ledge boxes `mpColl_80044164` and
`mpColl_800443C4` in melee:src/melee/mp/mpcoll.c with their caller's falling
and facing gates, and each action's collision callback in
melee:src/melee/ft/ft_081B.c. Only facts and values are used.

- **Who catches.** Falling and jumping fighters, helpless fall after an
  up-special, fighters whose air dodge's 49-frame animation has ended, tumble once
  hitstun ends, and fighters recovering from a tech or grab release. Aerial
  attacks (AttackAir), air dodges (EscapeAir), hitstun (Damage/DamageFly),
  shield-break flight, grabs and frozen fighters never catch. Melee's specials
  choose per move; Smashcraft's original specials have no catch window.
- **When.** Only after a frame whose movement went down (Melee compares the
  frame's start and end heights), never while down is held (Melee: stick y at
  or below minus common +0x480, 0.6600000262260437; Smashcraft's down is the
  digital direction, which the helper raises at about a fifth of stick
  travel), and never during the regrab lock.
- **Which ledge.** Only the ledge ahead of the fighter's facing. A catch turns
  the fighter toward the stage.
- **Grabs.** A fighter hanging on the ledge can't be caught by a standing, dash
  or shield grab, intangible or not. The hang gives the hanger
  `x1A6A = 511` (`ftCliffCommon_80081370`, `ftCo_8009A804`), every catch gives
  its grabber `x1A68 = 1` (`ftCo_800D8C54` in
  melee:src/melee/ft/kinds/ftCommon/ftCo_Catch.c), and `ftColl_80078A2C`
  (melee:src/melee/ft/ftcoll.c) skips a victim whose two masks share a bit.
  `Fighter_ChangeMotionState` clears the mask, so climbs, rolls, ledge attacks
  and drops are catchable again. `hangsOnLedge` in
  smashcraft:ts/src/game/sim/ledge.ts applies it.
- **The box.** Each fighter's ledge snap x, y and height (ftData x44
  +0x10/+0x14/+0x18, melee:src/melee/ft/types.h `ftData_x44_t`) place it: the
  ledge vertex must lie strictly beyond the fighter's position and strictly
  less than its collision half-width plus snap x ahead, and strictly between
  snap y minus and plus half the height above its feet. Both ranges sweep the
  frame's start and end positions, so a fast fall can't pass through. Melee's
  half-width is the animated airborne collision box, never under 2 units
  (`mpColl_LoadECB_JObj`); Smashcraft fighters use 2, the flank they also meet
  walls with (see "Main deck walls and underside").

| Fighter | Reference data | Snap x / y / height (Melee units) | Reach (world) | Ledge above feet (world) |
| --- | --- | --- | --- | --- |
| Rifleman | Falco, PlFc.dat | 11 / 13 / 9 | 78 | 51–105 |
| Illidan | Captain Falcon, PlCa.dat | 9 / 17 / 11 | 66 | 69–135 |

The values were read from the owner's GALE01 revision 2 files (identities in
smashcraft:docs/smash-melee-reference/physics-parameters.json) and convert at
six world units per Melee unit. Illidan has no other adopted Melee profile;
Captain Falcon, the corpus's third retail fighter, supplies only his box.

smashcraft:ts/src/game/match/step.ts resolves catches at the start of each
match tick, before any fighter moves, from each fighter's stored last movement
(`motion.deltaX`/`deltaZ`), so both ledges resolve from one shared snapshot.
A free ledge goes to the nearer eligible fighter by squared distance to the
endpoint; exact ties catch neither. Owners keep the ledge through hanging and
an ongoing climb/roll/attack. Melee catches inside the same frame's collision
step and gives a contested ledge to whichever fighter it updates first.

A catch anchors the feet 24 units outside and 90 below the endpoint, clears
movement and launch velocity, ends a helpless fall or air dodge, and restores
one air jump. Melee anchors the fighter at the ledge vertex plus its
CliffCatch animation's TransN offset, scaled by model scaling: Fox 4.8
outside and 13.44 below on the catch frame, settling to 1.92 and 14.4 while
hanging; Falco 5.5 and 15.4, then 2.2 and 16.5 (Melee units). Smashcraft's
24/90 world units (4/15 Melee units) is that rule with an offset fitted to
these fighters' rigs, which smashcraft:tools/animations/ledges.py bakes into
the hang clips. A catch does not reset percent, shield energy, stocks or
respawn protection. Catch protection lasts 30 unfrozen ticks (including the
catch tick); hanging afterward is vulnerable. Choosing an option never
refreshes that protection. Jump, release, interruption and completed recovery
remove it. Release and interruption start a 30-unfrozen-tick regrab lock
(Melee's common +0x498 ledge cooldown, 30, set by stick drops, the hang
timeout and damage); a ledge jump and a completed climb, roll or attack don't.
Ordinary flinching damage and grabs interrupt the ledge action;
non-flinching lasers only add damage. Stock loss clears ledge ownership and
protection; reset also clears the catch serial and regrab clock.

Fresh options are prioritized Jump, inward/Up climb, outward/Down release,
Shield roll, then Attack. Held directions alone never choose an option. The
catch tick only anchors, so options start on subsequent ticks. Jump launches
inward at the character's ordinary air-speed cap and full-jump launch speed,
keeping the restored air jump. Release starts outward at 2 world units/tick
and downward at 2. Climb/roll/attack interpolate from the hang point to the
platform over 12 ticks, ending respectively 24/140/64 units inward. Their
whole actions last 25/36/40 ticks after entry; ordinary actions remain locked
until completion. The ledge attack deals 7 damage on action ticks 16–18,
reaches 140 units inward and 90 vertically, and uses ordinary hit/knockback
resolution with one hit per action. Hitlag freezes the action and protection
clocks. These trajectories, speeds, hit regions and durations are provisional;
percent-dependent quick/slow options and animation-specific timing are absent.

The adapter reads FighterState.ledgeState (LEDGE_NONE/HANG/CLIMB/ROLL/ATTACK,
values 0–4), ledgeSide (-1 left, +1 right), ledgeFrame (0 on phase entry),
and ledgeSerial (one increment per catch). InputSnapshot.ledgeVerticalPressed
is a fresh Up (+1) or Down (-1) edge. The simulation reuses jumpPressed,
getupDirectionPressed/getupDirection, airDodgePressed and getupAttackPressed
for the other options. Standalone simulation consumers resolve pair catches
before advancing either fighter, as the match step does.
smashcraft:ts/src/game/sim/ledge.tests.ts covers every fighter and side, the
reference boxes and their strict edges, the swept movement, eligibility,
upper platform exclusion, contention/ownership, option timing and locks,
attack contact, protection expiry, regrab timing, hit/grab interruption and
reset. smashcraft:ts/src/game/match/ledgeCatchContracts.tests.ts plays
recoveries through captured rows and the frame executor: falls beside the
ledge and double jumps from below catch inside the box and fall past just
outside it. None of these establish native animation alignment.

The hang dimensions now fit the measured reach of both fighter rigs.
smashcraft:tools/animations/ledges.py reads the simulation's hang offset, depth,
mount duration, climb duration and climb inset directly when baking wrist
contact. smashcraft:wurst/FighterAssets.wurst fixes both model scales at one so
model coordinates and simulation world units agree. The animation adds no
root travel. Packaged-model wrist checks establish contact at the hang point
and through the first five climb ticks; native visual alignment remains a
separate check. These dimensions are prototype art/gameplay tuning, not
measured Melee values.

## Default digital wavedash and fast-fall directions

The owner's digital controls (smashcraft:docs/gameplay-design.md, "Controls"):
a horizontal-only air dodge uses an angle
of 18 degrees below horizontal for either fighter, mirrored for left/right.
Its initial vector uses 3.4 Melee units (20.4 world units), deliberately about
9.7% faster than Melee's 3.1 (#347), before the unchanged 0.9 air-dodge decay.
The 10-frame landing lag, intangibility, and per-fighter traction are unchanged. This is the default,
with no modifier or toggle. Explicit up/down/diagonal input retains its
previous direction and normalized speed; neutral retains zero initial velocity.
A dodge started too high may still expire before reaching the ground. The angle
is not the one for Melee's longest wavedash
(smashcraft:docs/design/melee/movement.md).

Fast-fall now requires down with neutral horizontal input. Down-left/down-right
continue air drift without selecting fast-fall speed. Shield dodges, DI, down
attacks and platform-drop handling retain their separate inputs. Existing
fast-fall descent/actionability rules remain; native feel needs the new build.

Historical fixture before #339: In the air, the latest steerable horizontal direction is remembered without
changing ordinary facing. After releasing that direction, neutral B turns the
fighter and fires Archer's arrow or Rifleman's shot toward that remembered
side, while preserving horizontal momentum. A held horizontal direction still
selects side-B. The remembered side has no timeout and clears on landing or
reset; replay snapshots include it.

## Jump-squat buffered wavedash

A fresh air-dodge/shield press during jump squat queues one air dodge at
takeoff. Subsequent nonzero movement direction during that squat updates its
direction; releasing the direction retains the last choice. Straight left or
right uses the shared shallow downward angle, allowing an 8 then
left/right keyboard sequence without a modifier. The dodge begins before the first
airborne physics step and uses the ordinary special landing lag. Interruption
and reset clear the request. Queue and direction are included in snapshots.
Both fighters and facings, late direction, interruption and snapshot handling
pass the source tests; actual keyboard timing and slide feel remain unverified.

## Up-special aerial recovery

Up-specials consume the aerial jump budget, and an up-special
that finishes while airborne enters helpless fall. During that fall, steering
and fast-fall remain available; jumping, air dodge, attacks and further
specials are locked. Landing or a ledge catch clears the helpless state. A
flinching hit interrupts the recovery or helpless fall, permitting actions again
after hitstun, but does not restore jumps already spent. Rifleman consumes the jump budget when his grounded launch begins. These are shared game rules, not exact Melee frame timings.

The local reference's `melee:src/melee/ft/kinds/ftCommon/ftCo_FallSpecial.c`
shows an airborne fall-special entry consuming all jumps; its grounded entry
uses a separate transition. This supports the recovery-state behavior, not our
character-specific animation lengths or all exact interrupt timings. Numerical
state is stored in `FighterState.specialFall` and copied by rollback snapshots.
Rendered fall-special pose and input feel still require in-game verification.

## Rifleman freezing trap

When ice expires or a hit breaks it, every trap ignores that fighter until
20 frames after thaw (#84). The thaw frame completes the frozen tick; normal
movement resumes on the next frame. Trap eligibility returns on frame 20,
after that frame's movement, so a jump pressed on frame 15 completes even the
Rifleman's five-frame squat before contact. Other attacks still hit normally.
The immunity timer is replay state and clears on stock loss and respawn.

Down+B places one trap on Rifleman's current grounded surface. Placement is
instant when the next simulation frame accepts the input; airborne placement,
placement while shielded or action-locked, and a second live trap are ignored.
Rifleman plays a 20-frame laying action, then can move and attack again.
The trap arms after 20 match frames, lasts up to 480 frames (8 seconds),
and has a separate 90-frame placement cooldown. It triggers on an opposing grounded
fighter on that same surface within 42 world units. These are provisional
control and range values, not Melee or Warcraft measurements.

Contact consumes the trap and holds the target in an ice state for at most 300
simulation frames (five seconds at 60 Hz). The countdown advances during
hitlag, so hitlag cannot stretch the cap. Movement, attacks, dodges, shield,
jump and other action inputs are ignored while frozen. A damaging unshielded
hit breaks the ice before applying its normal damage and launch; shielded
damage does not break it. A shielded contact consumes the trap without freezing
the defender. Invulnerable targets do not consume it, so it can trigger later
if they remain in range. KO and reset clear both placed and frozen state.

Numerical state lives in `FighterState.freezeTrapLife`, `freezeTrapArming`,
`freezeTrapX/Z`, `freezeTrapSurface`, `freezeTrapSerial`, `freezeTrapCooldown`
and `frozenFrames`/`freezeImmunityFrames`. Snapshot restore copies and compares
these fields exactly.
The trap and ice shell are presentation only; animation, visual timing and
native multiplayer behavior require a loaded Warcraft build to validate.

## Grab, pummel, throw and escape

The capture timer now uses `floor(76 + 1.6 * damage_at_capture)` rather than
20 frames. This is the equal-ranking Melee profile reported by
https://www.ssbwiki.com/Grab. Smashcraft currently applies no ranking/handicap
adjustment. That is an explicit simplification; it does not claim full Melee
capture parity. Damage during a hold does not recalculate its initial timer.

The factual input behavior was checked in melee:src/melee/ft/ftcommon.c and
melee:src/melee/ft/kinds/ftCommon/ftCo_CaptureWait.c at
0296f009f32f710495979d30772d8332af2d411a. Any fresh Attack/Special/Jump/Grab/
shield-button edge supplies one mash contribution per frame. Multiple buttons
in that frame still count once. A change to either or both remembered nonneutral
movement-axis signs supplies a separate contribution; neutral does not erase
the remembered sign. Each contribution removes six frames, in addition to the
ordinary countdown. The six-frame value is corroborated by the published grab
reference; the local common-parameter data remain unavailable. C-stick and
walk-modifier inputs are not grab-mash buttons. No decompiled implementation
was copied or translated.

Fresh Attack has priority over direction when selecting a held action. Attack
starts one pummel; holding it cannot repeat. Fresh movement or C-stick direction
selects a throw relative to the holder's facing (vertical takes priority on a
diagonal). Commands during pummel/throw recovery are discarded, not buffered
into another action. Escape is evaluated before a new pummel/throw selection.
Once a throw begins its victim stays committed until release or interruption.
Ordinary attack requests are cleared throughout both ends of the grab context,
including its final tick. Special input cannot leak through on release.

Contact/release and total frame counts are one-based and owned by
smashcraft:wurst/Simulation.wurst (`grabContactFrame`, `grabActionDuration`).
Pummel deals three damage once, without launch, and freezes both clips and the
hold timer during its normal hitlag. The four throws each deal damage once at
release and use the shared knockback/hitstun formula; throw DI uses the victim's
input on that frame, without adding ordinary hitlag or SDI. Down throw visually
slams to the floor and launches into an upward bounce. Character throw damage,
angles, growth/base knockback, trajectories, action lengths and ten-frame escape
recovery are original starting tuning, not extracted Sheik values. Simultaneous
grabs clash; Melee resolves them by port priority.

Holder/victim action, frame, serial, mash signs, timer and reciprocal links are
copied and compared in snapshots. Damage, freeze, stock/reset interruptions clear
the pair. The original 20-frame fixtures were updated to the damage-dependent
capture contract; successful capture now exits grab startup into the explicit
hold action rather than retaining the whiff cooldown.

Both fighters have pummel and four throw clips plus matched victim clips in
smashcraft:tools/animations/grab_animations.py. The animation boundary consumes
timing from Wurst; canonical pair state owns translation and release. Native
pose alignment, real-button use and interruption readability require the
installed-build check and are not proved by the numerical tests.

## Demon Hunter combat prototype (original provisional tuning)

Character ID 2 now has explicit simulation mobility and authored contact
regions. It uses the shared movement, shield, grab, knockback, hitlag, hitstun,
landing, ledge, stock and replay systems. These values are a first numerical
combat prototype, not values extracted from Melee or Blizzard character data.
Animation clips, pose alignment, HUD/selection, and installed-map behavior are
not established by these source tests.

Ground attack IDs are 0 jab, 2 up smash, 3 down smash, 4 forward smash,
6 forward tilt, 7 up tilt, 8 down tilt, and 9/10 up/down-angled forward tilt.
Neutral Attack during a grounded dash is converted to the dedicated ID 18 dash
attack (4 startup, 2 active, 32 total ticks). Styles 1 and 5 remain the
existing projectile and grab actions. The remaining attacks use shared
`attackStartupFrames`, `attackActiveFrames`, and
`attackDurationFramesForGrounding` tables. The five aerial IDs 12–16 likewise
use shared action clocks. Illidan supplies distinct facing-relative regions and
hit effects for each action; no Rifleman region is used.

| Special ID | Action and provisional timing | Contact/effect |
| --- | --- | --- |
| 9 | Mana Burn: 16-tick startup, 30-tick recovery; one orb out at a time | Fires a slow orb at 12 world units/tick for 90 ticks at shield-centre height; 5 damage, a flinch and a stun that scales with percent ([roster](design/roster.md#mana-burn-neutral-special)). No mana resource is modeled or drained. |
| 10 | Fel Rush (#147): tell ticks 1–5, rush 20 units/tick on 6–15, acts on 30; 40-tick cooldown; once per airtime, level in the air | Strikes each body it passes once (6 damage, pop-up at 80 degrees) and stops short of a raised shield. A press in ticks 10–24 branches: special is Vengeful Retreat (a vault back, acting on its tick 17), attack is Chaos Strike (10 damage at 40 degrees on its ticks 5–8, acting on 31) ([Illidan](design/illidan.md#side-special-fel-rush)). |
| 11 | Wing Ascent: 3-tick startup within 28 total ticks; 90-tick cooldown | Quick upward launch, consumes remaining jumps, grants four ticks of protection at launch, and enters helpless fall if still airborne at completion. A post-ascent glide is not implemented. |
| 12 | Immolate (ground): 4-tick startup, 4-tick active window, 27 total ticks; 24-tick cooldown, jump-cancellable from tick 4. Flame Crash (air, #147): hang ticks 1–4, plunge 24 units/tick from 5, helpless if still airborne on 34; landing burst ticks 1–3, acting 24 ticks after landing | Ground: one contact, forward region to 140 units, 7 damage and horizontal launch. Plunge: 9 damage, a spike against airborne targets and a 60-degree launch against grounded ones; burst ±150 units, 8 damage at 65 degrees ([Illidan](design/illidan.md#down-special-in-the-air-flame-crash-picked)). |

`SPECIAL_DEMONHUNTER_*` constants are the renderer/action IDs for these
specials. Grounded/airborne contact, both facings, parry interruption, jump
consumption, and snapshot restoration have focused Wurst coverage. This does
not certify model animation, local presentation safety, multiplayer behavior,
or final move tuning.

Simultaneous Immolate contacts are collected before either hit is applied,
including the ground/air launch choice. Both fighters therefore trade when
their active volumes overlap on the same tick; changing argument/slot order
does not let the first hit cancel the second contact. The regression failed
before this change and passes for both grounded and airborne mirror contacts.
The focused character suite passes 12/12:
smashcraft:build/wurst-tests/illidan-trade-after-r2.log. Earlier failing evidence:
smashcraft:build/wurst-tests/illidan-trade-before.log.

### Binary32 arithmetic boundary

The historical standard-library pin included the pure Wurst Binary32 package
from the Tom-owned Apache-2.0 fork. The shared engine
rounds grounded knockback decay in Melee units and rounds shield-health updates
to binary32. A generated-Lua production probe, not just the binary32 compiler
interpreter, verifies the recorded first traction subtraction and regeneration
from 20 to 20.06999969482422. These production checks now live in
smashcraft:ts/src/game/sim/physicsPrecisionState.tests.ts.

This is partial precision coverage. Other formulas and their PowerPC operation
ordering still require migration and comparison. The probe does not establish
Warcraft timing, rendering, or native map startup.

Digital shield damage sums raw contacts before applying the retail binary32
factor once. Shieldstun rounds integer power times 0.30000001192092896 before
the fused multiplication by 1.5 and addition of 2. The standard-library pin now
provides fusedMultiplyAddFloat32 for this single-round operation. Analog shield
input is preserved, and projectile powershield timing/reflection is implemented
separately. Melee perfect contacts now preserve shield health and use the
observed defender pushback; post-contact action timing and native verification
remain open. Digital formula precision does not establish those behaviors. See
smashcraft:docs/melee-powershield.md.

## Independently observed directional influence arithmetic

The production DI helper reconstructs the launch from its angle and magnitude,
with a signed squared cross-product rotation capped by the supplied unit stick
and the common 18-degree coefficient. It rounds to binary32 and uses the shared
independently authored trig approximations. Nonzero parallel input still passes
through polar reconstruction; neutral input and sufficiently small launch vectors
retain their components. Grounded eligibility remains the existing Smashcraft
rule and has not been independently verified against the original routine.

smashcraft:docs/smash-melee-reference/retail-di-vector.json retains 56 numeric
observations, exact input/output bits, source hashes, original routine addresses,
runtime revision and licensing/extraction limitations. Original NTSC 1.02 code
ran in the unchanged Melee Unlocked Gekko interpreter at revision
4bb37070e4311169259dadaeed06a156523e5c7d, with a private host adapter and exact
licensed paired-single service excerpts. It executed 13,959 instructions and 72
paired-single loads and stores after original trig initialization. This is not a
Linux portability repair, complete game execution or hardware measurement. The
private harness, ELF, extracted binary and game data remain outside repositories.
Only numerical facts enter this independently authored implementation.

The existing rotation arithmetic mismatched 39 of 56 vectors (33 of 48 cases
representable by the discrete input path), using emitted Lua and diagnostic
host math.sin/math.cos bindings for the old native calls. The repaired production
helper matches all 56 exactly, including zero signs, under the existing emitted
Lua precision check. The observations distinguish several rounding mistakes but
do not uniquely identify all possible intermediate evaluation sequences. This
bounded claim does not establish controller polling, physical deadzones,
grounded DI eligibility, hitlag scheduling, collision or full-match parity.
Evidence: smashcraft:build/di-before.log and smashcraft:build/di-after.log.
The focused directionalInfluence filter passes 5/5 tests, including adapter
magnitude through hitlag release, replay snapshot independence and correction
equality, and existing discrete DI behavior (smashcraft:build/di-connected.log).

Network input preserves DI magnitude by dividing each captured signed byte axis
by 127, then normalizing radially only when length exceeds one. This is
Smashcraft's input boundary, not a claim about original GameCube polling or
quantization. Full keyboard diagonals retain unit length. Explicit DI components
and their validity flag travel with frame snapshots and participate in replay
input equality; directly constructed snapshots retain discrete direction fallback.
No new persistent fighter state is introduced. Movement, SDI and tilt capture
keep their existing input rules. Original Warcraft characters retain authored
statistics; stale moves and freshness bonuses stay omitted
(smashcraft:docs/gameplay-design.md).

Stratholme (6) uses a three-segment main floor: flat from x −420 to 420 at
21 world units, sloping down to its ledges at x ±600, z 0. Ground speed is
travel along the line, so the horizontal step takes the segment's cosine.
Landing, techs, get-ups, projectiles and ledge climbs use the height at the
fighter's x. The generated deck mesh follows those same line endpoints.

Tomb of Sargeras (7) draws a translucent, slowly scrolling water sheet over
its main deck. Water and lava use two triangles per surface, zero particles,
and zero lights. Warcraft's HD water natives configure terrain water;
these floating platforms instead use authored models that also draw in Classic.
