# Surface recovery action boundaries

Reference revision: `0296f009f32f710495979d30772d8332af2d411a`.
These are independently described control-flow observations, not copied game
implementation. Numerical animation lengths are recorded separately in
smashcraft:docs/smash-melee-reference/retail-action-lengths.json.

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
