# Surface recovery action boundaries

## Airborne weak-damage landing selection

smashcraft:docs/smash-melee-reference/retail-damage-landing.json records eight
inputs executed through the NTSC 1.02 magnitude-comparison branches under
QEMU PPC750. Below 0.5 Melee units/frame, airborne Damage retains its damage
state on grounding. From 0.5 inclusive to 5 exclusive, it enters ordinary
Landing and clears hitstun. At 5 inclusive it enters DownBound directly;
this branch does not select a tech even when tech input is present.

Production floor contact now uses those three bands for non-tumbling airborne
damage. Ordinary landing retains the existing four-frame landing lock; both
recorded retail profiles have normal_landing_lag 4. Actor-specific landing-lag
variation is not established by this correction. ASDI landing is unchanged.
The floor-crossing fixture checks all three outcomes and the last locked and
first actionable normal-landing ticks. RecoveryTests passed 18/18 after the
middle-band case failed before the correction (19 stun instead of zero).
Evidence: smashcraft:build/damage-landing-focused.log.
The assembled suite passed 568/568 with zero compiler errors; evidence:
smashcraft:build/damage-landing-aggregate.log. This establishes integration
with the existing simulation fixtures, not native execution.

Source checkpoint `7ef7639f180bce1ef74d7e35ba6167a69e41682c` built
Smashcraft 0.0.15, build ID `physics-damage-landing`, with zero errors and
six existing warnings (smashcraft:build/damage-landing-map.log). Candidate:
~/code/wc3-melee/worktrees/melee-physics-public/build/wurst-map/Smashcraft 0.0.15.w3x.
SHA256: `48f22d9415643d0834025d7fd29f0a04dabe34beed95a32f8f47880b17e8f558`.
Deployment was disabled to preserve the concurrent input workstream's clients.
This candidate has not been observed in Warcraft.

The retail probe supplies magnitude and replaces action consumers with result
labels. It verifies original comparisons, not original square-root arithmetic,
collision, action initialization or native trajectories. DamageFly/DamageFall
distinctions and full frame-trace parity remain open. The authored loader is
smashcraft:tools/physics-probe/observe-damage-landing.mjs; executable bytes and
extracted proprietary data remain in private storage outside repositories.

Reference revision: `0296f009f32f710495979d30772d8332af2d411a`.
These are independently described control-flow observations, not copied game
implementation. Numerical animation lengths are recorded separately in
smashcraft:docs/smash-melee-reference/retail-action-lengths.json.

## Digital tumble exit

smashcraft:docs/smash-melee-reference/retail-tumble-exit.json records the
revision-identified common data: horizontal magnitude threshold
0.800000011920929 and input age strictly below 1. The independently described
DamageFall input behavior allows ordinary Fall after hitstun on that fresh
horizontal input. For the digital -1/0/+1 controls, a press from neutral or a
reversal exceeds the threshold and starts input age zero; continued holding
does not. Production now leaves tumble on this input, clamps ordinary aerial
self-velocity and permits ordinary drift. Input history is retained in replay
and cleared on reset. The focused RecoveryTests passed 20/20, including a
direction held through hitstun and a subsequent reversal, plus replay/reset.
Evidence: smashcraft:build/tumble-exit-focused.log.
The assembled suite passed 571/571 with zero errors and one existing warning
(smashcraft:build/tumble-exit-aggregate.log), including the corrected wall
fixture and the preceding weak-damage surface eligibility change.

This establishes the digital projection of the rule. Analog input magnitudes,
full retail callback priority, independent executable/frame-trace parity and
native behavior remain unverified. The 0.0.15 map predates this correction.

Source checkpoint `c3e0269de4e07cf89ec7759afab2aa56f5fd0a86` built
Smashcraft 0.0.16 with build ID `physics-tumble-exit`, zero errors and six
existing warnings (smashcraft:build/tumble-exit-map.log). It includes both
digital tumble exit and weak-damage surface eligibility. Candidate:
~/code/wc3-melee/worktrees/melee-physics-public/build/wurst-map/Smashcraft 0.0.16.w3x.
SHA256: `0a435ea41c8260bbd4b5a6309c6d29d8e512909239ed23c6cd52553137c66115`.
Deployment remains disabled while concurrent input work owns the clients;
native observation is outstanding.

An independent recording now supports the digital tumble-exit ordering:
smashcraft:docs/smash-melee-reference/slippi-ntsc-tumble-exit.json retains
frames 2980–2982 from the hash-identified Slippi techTester recording. Neutral
DamageFall at 2980 becomes ordinary Fall on left input at 2981, with horizontal
self velocity already -0.05999999865889549 that frame; the next held frame
has -0.11999999731779099. The production fixture injects the observed drift
increment and checks the state transition, both horizontal self velocities and
horizontal positions on both existing simulation hosts. It does not establish
actor acceleration attributes, vertical trajectory or exact trigonometric
knockback arithmetic. Position/velocity tolerances are 0.0001/0.00001 world
units, respectively, and do not imply bitwise equality.

The recording is explicitly NTSC but does not identify the retail revision;
it supports ordering rather than certifying NTSC 1.02. The independently
authored intake tool, smashcraft:tools/physics-probe/extract-tumble-exit.mjs,
reparses the hash-checked source through the existing unmodified LGPL parser.
The focused recordedTumbleExit case passed 1/1 (both simulation hosts), with
zero errors and the existing unused-import warning; evidence:
smashcraft:build/tumble-exit-trace.log. Production code and the 0.0.16 map are
unchanged by this additional frame check.

## Wall and ceiling eligibility

Weak airborne Damage also does not select wall/ceiling recovery. At the
recorded reference revision, its collision callback handles grounding;
DamageFly's callback separately checks wall/ceiling contact for recovery.
Production now requires the modeled tumble state for wall/ceiling tech or
reflection, rather than accepting hitstun alone. The contact fixture separates
ordinary motion, non-tumbling damage and tumbling damage at both surfaces;
a second fixture retains stun and the unused tech window on weak-damage
contact. Existing reflection fixtures now explicitly enter tumble, retaining
their velocity, threshold and normal assertions.
The assembled check passed 568/569; its sole failure was the exterior-wall
fixture's missing tumble setup. After giving that reflection fixture its
intended damage-flight state, its unchanged assertions passed 1/1.
Evidence: smashcraft:build/weak-damage-surface-aggregate.log and
smashcraft:build/weak-damage-wall-fixture.log. The source correction is newer
than the 0.0.15 candidate and is not packaged in that map.

This corrects weak-Damage eligibility. It does not establish a complete mapping
of DamageFly, DamageFall and FlyReflect states, independent retail contact
traces, or native collision behavior.

At reference revision `0296f009f32f710495979d30772d8332af2d411a`,
melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c dispatches wall/ceiling
reflection from the damage-flight collision callback. Ordinary Fall and
AttackAir have separate collision callbacks; remaining knockback by itself
does not select the damage rebound action.

Smashcraft previously reflected any sufficiently large inward knockback at
an authored wall or ceiling, including an actor in ordinary movement. The
production query now requires damage recovery (hitstun or its modeled tumble
state) before taking the rebound branch. Ordinary motion still contacts the
surface and loses its inward velocity, without starting a rebound cooldown.
The connected `surfaceReflectionRequiresDamageRecovery` case checks ordinary
versus damage movement at both a wall and ceiling. It failed before the fix
(ordinary movement rebounded at -9.355 instead of stopping) and passed after it.

This closes the ordinary-movement discrepancy. It does not prove the full
retail distinction between DamageFly, DamageFall and FlyReflect callbacks,
their animation/input ordering, ECB placement, or native surface trajectories.
Smashcraft's single tumble state still needs those distinctions verified.

Ceiling recovery, observed in melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveCeil.c,
consumes its horizontal impulse event once, then transitions to ordinary fall
when animation tracks finish. Its input-interrupt callback is empty. For the
three recorded test profiles the animation length is 26 frames. Entry clocks,
track completion and collision transitions must determine the actual simulation
boundary; the length alone is not a substitute for those rules.

Wall recovery, observed in melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c,
pauses animation during the startup timer. Timer expiry resumes animation and
applies the selected wall or wall-jump impulse. Wall and wall-jump animation
lengths are 26 and 40 frames respectively for the recorded profiles. After
startup, aerial actions can interrupt; ceiling recovery does not share that
interrupt policy. Wall physics applies aerial friction without ordinary steering
acceleration while this action remains active.

Wall entry sets facing opposite the passed collision direction. The source's
RightWallHug means a right-facing surface contacted by the fighter's left ECB
point, not a wall on the fighter's right. This is explicit in
melee:src/melee/mp/mpcoll.c and in the negative-X impact branch of
melee:src/melee/ft/ftCo_800C7CA0.c. PassiveWall passes -1 there and sets facing
to +1; LeftWallHug gives the opposite pair. Thus entry facing and horizontal
impulse point outward, matching Smashcraft's normal convention. The recorded
actor attributes are positive (0.5 and approximately 1.4 MU/frame). No facing
or horizontal-impulse sign correction is required for those profiles.

## Open production discrepancies

At primary revision `80df62d`, smashcraft:wurst/Simulation.wurst saturates the
ceiling clock at the impulse event and the wall clock at startup expiry. Neither
clock reaches the animation completion boundary. Ceiling recovery also does
not yet enforce its full input lock. Wall facing uses the outward stage normal;
its facing and signed impulse require reconciliation with the observations above.
The existing startup, impulse and protection tests do not prove these missing
action boundaries. Native recovery observation remains open.

The previously suspected facing discrepancy above was resolved by following
the wall collision flag to its ECB point and impact direction, as described
above. Collision repositioning remains unverified.

The subsequent ceiling-boundary implementation advances the clock beyond the
impulse, enters ordinary fall at the actor's configured animation end (26 in
the recorded profiles), and blocks attacks, specials, jumps and air dodges until
that transition. Air drift remains enabled: the ceiling physics callback uses
ordinary airborne drift and gravity. Three focused CeilingTech cases passed,
including production collision entry and the 25/26 action boundary. This closes
the modeled ceiling completion/input-lock discrepancy; independent frame traces,
ECB attachment/repositioning and native execution remain unverified. Wall action
completion and interrupts still require implementation.

The public attack, jump and air-dodge entry points now reject ordinary actions
during wall startup as well as the per-frame early return. The real-contact
wall fixture checks this lock on every startup tick and attack availability at
expiry; all five WallTech cases passed. Buffered wall-jump selection still uses
the separate recovery input path. Full post-startup interrupt priority and
animation completion remain open.

Wall recovery now advances beyond startup, with the paused startup excluded from
the animation clock. The actor-owned wall and wall-jump clip limits default to
26 and 40, matching the three recorded profiles. A real-contact fixture exercises
both selections through completion, retaining each state until the final frame;
the six WallTech cases passed. These modeled completion boundaries do not prove
collision positioning, facing, post-startup interrupt priority or independent
retail frame-trace parity.

Post-startup wall physics now rejects ordinary drift acceleration and retains
aerial friction, matching the observed PassiveWall physics callback. Successful
attack, special and aerial-jump entries leave surface recovery; air-dodge entry
already did so. The production collision case verifies friction against opposing
stick input, followed by a jump interrupt restoring normal drift. All seven
WallTech cases passed. Complete priority among simultaneous interrupt inputs
remains unverified.

The assembled primary tree at `872a370` passed the normal `Tests` filter:
490/490, zero compiler errors and one existing unused-import warning. Evidence:
smashcraft:build/physics-r10-aggregate.log. This includes the ceiling and wall
completion/input cases and deterministic replay checks, but excludes the ongoing
RunBrake follow-up and does not establish native or independent trace parity.

The normal 0.0.4 map built at primary `bd88afe`, build ID `melee-physics-r10`:
smashcraft:build/wurst-map/Smashcraft 0.0.4.w3x. SHA-256:
`1f5287970d30cb12c7ccf4a7c78a12f50be5afb7d14392fc7228354cd9f6a262`.
Compilation reported zero errors and six warnings; evidence is retained in
smashcraft:build/physics-map-r10.log. Automatic deployment was disabled to
preserve the peer's current native candidate. This build excludes the pending
RunBrake follow-up and has not been observed in Warcraft.

The RunBrake follow-up integrated as `da63988`; the assembled tree passed
492/492 normal tests (smashcraft:build/physics-r11-aggregate.log). Candidate
0.0.5 built at `b0aaf04`, build ID `melee-physics-r11`, with zero errors and six
warnings (smashcraft:build/physics-map-r11.log). Map:
smashcraft:build/wurst-map/Smashcraft 0.0.5.w3x. SHA-256:
`ddb778d5287a00ddfcf9d9aa5c518403c1766fac627d9bdace17800c1a1309f9`.
Deployment remained disabled and native observation is still outstanding.

TurnRun entered after its facing-command frame needs a separate first-pause
boundary check. The source initializes its pause marker to zero on entry; its
first animation callback observing the command pauses, and a subsequent callback
can flip facing. The current boolean command latch treats a past-command entry
as already paused. The existing frame-14 fixture checks eventual facing, but
does not isolate that first callback. This remains a movement timing discrepancy
to resolve before asserting retail action-clock parity.

The past-command TurnRun entry discrepancy is now fixed with a separate pending
pause state. Entry at frame 14 advances to 15 and pauses on the first subsequent
animation callback; only a later callback evaluates the velocity condition and
flips facing. The new production-transition case discriminates these callbacks,
and replay capture retains the pending phase. Focused TurnRun checks passed 4/4;
the assembled normal suite passed 493/493 with zero errors and the existing
unused-import warning (smashcraft:build/physics-turn-pause-aggregate.log).
This fix is not present in the previously built 0.0.5 map. Independent retail
frame traces and native action-clock verification remain open.

Candidate 0.0.6 includes the TurnRun first-pause fix. It built at `abe2d7b`,
build ID `melee-physics-r12`, with zero errors and six warnings; evidence:
smashcraft:build/physics-map-r12.log. Map:
smashcraft:build/wurst-map/Smashcraft 0.0.6.w3x. SHA-256:
`ef9a52f70fac081935da57e72b5299b972ab6a7e0d7706411809ffcda8ceb7a8`.
Deployment was disabled to preserve the peer candidate. Native observation,
independent traces and remaining dash input-priority rules are still open.

## Getup stand completion ordering

melee:src/melee/ft/kinds/ftCommon/ftCo_DownStand.c transitions to ordinary ground
state in its animation callback when tracks finish; the input phase follows that
callback. The selected retail profiles' DownStand clips are 30 frames in
smashcraft:docs/smash-melee-reference/retail-action-lengths.json.

Smashcraft previously cleared DOWN_STAND after processing jump input and returned
without ordinary input handling, adding a locked tick. Completion now runs in
the existing pre-input recovery phase, alongside floor-tech completion. A
production getup entry followed by a jump on tick 30 failed before the change
and passed afterward on both original hosts. Roll, down-damage and getup-attack
end conventions are separate and are not certified by this fix. The focused
completion case and existing RecoveryTests passed; broader assembled checks and
native verification remain pending for this change.

## Getup roll and attack completion

The private archive reader additionally resolved DownAttackU/D for Fox, Falco
and Captain Falcon: all six clips contain 50 animation frames. Their numeric
records were added to smashcraft:docs/smash-melee-reference/retail-action-lengths.json
after matching the existing source hashes and animation table/archive links.
The corresponding getup-roll clips contain 36 frames. Entry in
melee:src/melee/ft/kinds/ftCommon/ftCo_Down.c and
melee:src/melee/ft/kinds/ftCommon/ftCo_DownAttack.c explicitly advances animation
once; their end boundaries therefore occur 35 and 49 subsequent ticks after
entry, respectively. Both animation callbacks enter ordinary ground state
before the input phase.

Roll and getup-attack completion now join stand completion in the pre-input
phase. The existing first-actionable-frame case covers all three entries on
both original hosts; it verifies the last locked frame and a jump on completion.
All nine getup-filter cases passed, including existing contact/frame-advantage
checks (smashcraft:build/getup-actions-completion.log). This does not certify
full retail protection events, collision repositioning, independent frame traces
or native behavior. The changes have not yet been packaged into a new map.

## Grounded damage completion input

DownBound enters at animation frame zero without an extra advance; its selected
26-frame clips retain the existing 26-subsequent-tick boundary. DownDamage enters
through melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c:ftCo_8008DCE0, which advances
animation once; its selected 14-frame clips retain the existing 13-tick boundary.
These facts do not justify changing either duration.

melee:src/melee/ft/kinds/ftCommon/ftCo_DownDamage.c transitions to DownWait when
the clip ends with remaining damage time. The fighter's later input callback
then uses the new state's getup checks. Smashcraft previously returned immediately
after that transition and lost getup input on the completion tick. It now checks
getup input that tick while preserving the newly initialized wait timer when
there is no input. The new case enters grounded damage through an actual hit,
checks every locked tick, and requests getup attack on completion on both hosts.
RecoveryTests passed 14/14, zero errors and one existing unused-import warning;
evidence: smashcraft:build/down-damage-completion.log. Native execution and the
broader remaining recovery/collision claims are still open.

DownWait also decrements its timer in the animation callback and starts stand
on expiry before its input callback runs. Smashcraft previously prioritized
getup input over that expiry. The timer now advances first on existing wait
ticks; a newly entered wait still keeps its entry timer. The boundary case
requests getup attack with one versus two wait ticks remaining: expiry starts
stand, while the preceding tick accepts attack. RecoveryTests passed 15/15,
zero errors and the existing unused-import warning; evidence:
smashcraft:build/down-wait-expiry.log.

The assembled recovery changes passed 496/496 normal tests with zero errors
and the existing unused-import warning
(smashcraft:build/recovery-ordering-aggregate-fixed.log). The first aggregate
exposed four getup fixtures that seeded DownWait with an expired default timer;
they now initialize the intended remaining duration, retaining their combat
assertions. This aggregate verifies the integrated simulation cases, not native
callback timing, rendering, collision geometry or complete Melee parity.

Candidate 0.0.7 packages these recovery fixes at source commit ab15900,
build ID `melee-physics-r13`. It built with zero errors and six warnings;
evidence: smashcraft:build/physics-map-r13.log. Map:
smashcraft:build/wurst-map/Smashcraft 0.0.7.w3x. SHA-256:
`18f7352bd10b33a0ff0cfdc98cd0dde73627acc64bac67bcd0b584374c3f34d4`.
Deployment remained disabled to preserve the concurrent native-input session.
This candidate has not been observed natively and does not include the pending
dash/guard/grab changes or star/screen death implementation.

## Floor recovery leaving support

DownBound, Passive, DownWait and DownStand run the ordinary floor-support
collision path; losing support enters Fall. Down rolls, PassiveStand and
DownAttack use the constrained floor path. Sources:
melee:src/melee/ft/kinds/ftCommon/ftCo_DownBound.c,
melee:src/melee/ft/kinds/ftCommon/ftCo_Passive.c,
melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveStand.c,
melee:src/melee/ft/ft_081B.c and melee:src/melee/mp/mpcoll.c.
The support result ultimately comes from mpColl_8004ACE4's touching-floor
boolean; ft_80082708's enum/local names alone are misleading for that result.

Smashcraft previously returned after recovery motion without resolving support.
It now checks the current flat surface after recovery motion, transitions
unconstrained skids to ordinary fall when they cross its endpoint, and preserves
rolling/attacking recovery's edge constraint. Departure keeps remaining
horizontal knockback, consumes the ground jump, and resumes aerial gravity on
the next tick. Recovery also records its actual displacement and checks blast
zones after motion. Initial support can be acquired from a coincident floor
when no surface identifier has yet been set.

The production landing/retained-knockback case failed before the fix because
grounded remained true beyond an edge. It now covers both hosts, both sides,
main and raised platforms, missed tech, in-place tech and rolling tech. The
rolling variant remains supported at the endpoint; the other variants fall.
The assembled suite passed 497/497 with zero errors and the existing unused
import warning (smashcraft:build/recovery-edge-aggregate.log). These checks
establish the modeled flat-surface transition, not full retail ECB shapes,
connected/sloped terrain, independent retail departure traces or native timing.

## Shield-break pose and release ordering

ShieldBreakDown and ShieldBreakStand enter at animation frame zero without an
extra advance. The selected retail rigs use DownBound clips of 26 frames and
DownStand clips of 30 frames, recorded in
smashcraft:docs/smash-melee-reference/retail-action-lengths.json. The engine now
accepts actor-owned shield-break down/stand lengths and snapshots them in replay.
Original fighter defaults retain their authored 12/30 poses; the retail rig
supplies 26/30 and verifies the last locked tick and both exact transitions.

melee:src/melee/ft/kinds/ftCommon/ftCo_Furafura.c restores shield health to common
+0x280 (30) in the animation callback, subtracts the timer/mash amounts and
enters ordinary ground state when the timer expires. The later input callback
can jump on that same tick. melee:src/melee/ft/fighter.c:Fighter_procCollResolve
then regenerates health by common +0x27C (0.07) when guard is inactive, including
hitlag. Fighter_ChangeMotionState clears the guard-active flag; consequently a
dizzy frame ends at 30.07, not an indefinitely fixed 30. The source's collision
phase also checks blast zones during hitlag.

Smashcraft's completion-jump case failed before correction (expected squat 3,
actual 0). Completion now resumes ordinary input processing. Shield-break
regeneration runs during its locked states and hitlag; dizziness restores health
before regeneration. Existing assertions that preserved the previous fixed
health/end-tick lock were updated to these sourced outcomes. Actor pose checks
passed and the snapshot roundtrip passed; assembled and native evidence for
the final release/regeneration changes remains pending.

The assembled release/regeneration changes subsequently passed 500/500 normal
tests with zero errors and the existing unused-import warning
(smashcraft:build/shieldbreak-ordering-aggregate.log). The added hitlag case
checks regeneration while the animation remains paused, then verifies stock
loss beyond a side blast zone before hitlag expires. Native observation is
still outstanding; the normal Lua-number arithmetic has not been shown to
match PowerPC binary32 operation-by-operation rounding.

## Dash-grab completion and contact bounds

The independently recorded CatchDash clips for Fox, Falco and Captain Falcon
are all 40 frames (smashcraft:docs/smash-melee-reference/retail-action-lengths.json).
The entry in melee:src/melee/ft/kinds/ftCommon/ftCo_Catch.c starts at frame zero
without an extra animation advance; completion waits for the animation tracks.
The retail test rigs therefore use 40 subsequent ticks, replacing the website's
39-frame total. Original fighters retain their authored grab timing.

A production-entry whiff test exposed a missing position check in dash-grab
contact selection: the active tick could capture a target anywhere. Contact now
requires the target to be inside the existing authored forward grab region.
The same case verifies no capture, the last locked tick (39), and a jump on the
completion tick (40). Focused dash-grab/contact/replay checks passed 5/5.
Startup, retail active-window geometry, and exact retail callback mapping remain
unverified; the 40-frame rig does not establish those claims.

The assembled dash-grab changes passed 505/505 tests with zero errors and the
existing unused-import warning (smashcraft:build/dash-integration-aggregate.log).
Native behavior remains unobserved.

The integrated source checkpoint 058d8c5 built Smashcraft 0.0.8 with build ID
melee-physics-r14, zero errors and six warnings. The local candidate is
~/code/wc3-melee/worktrees/melee-physics-public/build/wurst-map/Smashcraft 0.0.8.w3x;
SHA256 a18fb26577cb7a38b827b40f363f14710b2d2480946b8f7b07363dac48fcf25e.
Build evidence: smashcraft:build/physics-map-r14.log. Deployment was disabled;
this candidate has not been installed or observed natively. The concurrent
input workstream retains the authenticated clients for its 0.0.9 probe.

## Grab event clock

smashcraft:docs/smash-melee-reference/retail-grab-events.json independently
records Catch and CatchDash command timings for all three selected retail rigs.
Standing catch capsules are created at timeline frame 6 and cleared at 8.
Fox/Falco dash capsules are created at 11 and cleared at 13; Captain Falcon's
are created at 10 and cleared at 12. All have two active timeline frames.
The recorded radius/offset integers are bone-local facts, not world-space reach.

melee:src/melee/ft/fighter.c:Fighter_ChangeMotionState requests animation frame
zero and processes the action script during entry. The action-script timer
starts at zero; melee:src/melee/ft/ftaction.c:ftAction_80073240 subtracts the
unit animation rate before processing the first wait. Consequently an encoded
wait of 11 leaves 10 subsequent ticks before capsule creation. CatchDash adds
no further entry advance. The retail rig now uses first active tick 10 for
Fox/Falco and 9 for Captain Falcon, with two active ticks. The original authored
roster retains its existing startup and one-tick dash-grab window. Animation
completion remains 40 subsequent ticks: the first HSD animation interpretation
holds frame zero, and subsequent interpretations advance until the clip end.

The production-entry cases verify startup before tick 10, first contact at 10,
contact on the second active tick, no contact on the following tick, and the
last locked/completion boundary at 39/40. Replay includes active duration.
Focused cases passed 6/6 with zero errors and the existing unused-import warning
(smashcraft:build/grab-event-timing-tests.log). These are source-mapped numerical
checks; independent retail replay/native grab traces remain outstanding.

## Numerical oracle boundary

The recorded grounded-hit example subtracts traction 0.07999999821186066 from
knockback 0.7562744617462158. Binary64 arithmetic yields
0.6762744635343552; binary32 rounding yields 0.6762744784355164, exactly the
recorded velocity (smashcraft:docs/smash-melee-reference/slippi-ntsc-grounded-damage.json).
This is a discriminating counterexample for runtime arithmetic precision.

The pinned compiler's ILconstReal stores Java float and rounds interpreter
operations to binary32. Its Lua backend emits ordinary real literals and
arithmetic. Thus a Wurstunit exact-equality check can pass without establishing
the emitted Lua behavior. The new grounded-step exact check passed in the
interpreter; it is not a Lua/native precision acceptance result. The existing
trace comparisons retain their stated tolerances and remain useful for update
order. Exact runtime precision requires a reusable numeric primitive plus
explicit operation/unit ordering and an actual emitted-Lua/native check.

The integrated grab-clock and shield-phase changes passed 513/513 Wurstunit
checks with zero errors and the existing unused-import warning
(smashcraft:build/shield-phase-grab-aggregate.log). This includes regeneration
through locked phases and same-tick captures, strict-negative depletion, and
damage/drain break-entry health. The subsequent held-guard suite passes 60/60,
including drain before jump/dodge/release inputs. The numerical integration
aggregate passed 515/516; its ASDI landing expectation used world-scaled
subtraction rather than the retail binary32 subtraction in Melee units.
The exact expected value is now 8.220000267028809 Melee units, and that focused
case passes 1/1 (smashcraft:build/binary32-asdi-focused.log). Native verification
and precision of the remaining operations remain open.

The scalar production probe reproduced GROUNDED_BINARY32_EXACT_FAIL under
Lua 5.3.6 before the correction (smashcraft:build/physics-probe/runtime-before.log).
The standard-library fork now provides pure Wurst real.roundToFloat32(), pinned
at 2cd84edbafaf4abce2fe370f38b32f8f0d5848a6 from
https://github.com/tompassarelli/WurstStdlib2. Its five focused checks passed both
in the compiler interpreter and emitted Lua; the Apache-2.0 source license is
retained in the fork. The project lock and both build/test consumers select
this immutable library pin.

Grounded knockback friction/subtraction now round in Melee units before
converting back to world units. Shield-health regeneration, held drain, and
contact subtraction round their scalar results to binary32. The unchanged
Lua production probe now reports GROUNDED_BINARY32_EXACT_PASS, and regeneration
from 20 reports SHIELD_REGEN_BINARY32_EXACT_PASS (20.06999969482422).
Evidence: smashcraft:build/binary32-lua-precision.log; compilation had zero
errors/warnings. Reproduce with bash ~/code/wc3-melee/main/tools/physics-probe/check-numerical-precision.sh
from the project checkout. The probe executes the generated production advance
function with scalar dependency initialization and the compiler's existing
native test fixture; it does not launch Warcraft or initialize the map UI.

This closes those numerical operations, not the full precision gap. Other
movement/launch operations, PowerPC fused-operation order, world-unit conversion
boundaries, complete contact geometry, and native trajectory checks remain open.

Retail shield damage accumulates unscaled contacts before applying the shared
factor once. The digital factor is the binary32 value 0.699999988079071,
derived from the retail lightshield endpoint 0.30000001192092896. Selected
endpoints are recorded in smashcraft:docs/smash-melee-reference/retail-shield-damage-endpoints.json.
The production contact accumulator now follows that order and rounds both the
sum and scaled damage to binary32. A pair of contacts with damage 9 and 1 takes
shield health from 8 to exactly 1; scaling each contact first gives a different
binary32 result. That focused case failed before the change and passes 1/1
afterward (smashcraft:build/shield-sum-before.log and
smashcraft:build/shield-sum-after.log). The generated-Lua probe failed on the
nine-damage scalar before the change and now passes the scalar and production
contact-sum checks (smashcraft:build/shield-damage-lua-before.log and
smashcraft:build/shield-damage-lua-after.log), with zero compile errors/warnings.

The private revision-identified executable also confirms fused single-precision
subtractions for both airborne knockback axes, following atan2f and cosf/sinf.
The current radial rescaling is mathematically equivalent but does not preserve
that operation order. Instruction-kind checks and the decay value are retained
in smashcraft:docs/smash-melee-reference/retail-air-decay-operations.json.
Airborne precision remains open pending a reusable fused arithmetic primitive,
matching trigonometric results, and trajectory verification. No executable
bytes or proprietary assets are retained in these records.

Digital shieldstun now uses the retail binary32 damage factor followed by a
rounded power multiplication and a fused multiply-add. The revision-identified
instructions at 0x80092F1C and 0x80092F20 confirm those two arithmetic boundaries.
For three damage, the duration is 3.3500001430511475; rounding the last multiply
and add separately gives 3.3499999046325684. These facts are retained in
smashcraft:docs/smash-melee-reference/retail-shield-damage-endpoints.json.
The reusable pure Wurst fused primitive accepts finite binary32 operands,
preserves the exact product in integer limbs, and rounds once. Its eight focused
checks passed both in the interpreter and emitted Lua before publication to
the Apache-2.0 stdlib fork at bb1e0458db5a372ba2a6928112452785e435d01a.
The project lock and build/test/probe consumers select that immutable pin.
The integrated shield suite passes 62/62 (smashcraft:build/shield-fused-integration.log).
Airborne trigonometric matching and native formula behavior remain open.
