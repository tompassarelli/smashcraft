# Physics reference and implementation

Wurst owns our independently authored simulation. The local Melee checkout at
~/code/resources/melee, revision 0296f009f32f710495979d30772d8332af2d411a,
is a reference for factual mechanics and numerical parameters, not source to
copy or translate. No license covering its decompiled gameplay code was found;
licenses in its tools subdirectories do not cover the game. No game assets or
implementation text are incorporated from that checkout.

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
use the numerical baseline below. Jump launch speeds are separately tuned
constants; their simulated apex heights match the six reference-table targets
as checked below. Digital direction input, simplified collision shapes and
Warcraft animation remain deliberate differences.

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

| Parameter | Fox / Archer target | Falco / Rifleman target |
| --- | ---: | ---: |
| Weight | 75 | 80 |
| Initial dash speed | 1.9 | 1.9 |
| Run speed | 2.2 | 1.5 |
| Walk speed | 1.6 | 1.4 |
| Ground traction | 0.08 | 0.08 |
| Air friction | 0.02 | 0.02 |
| Air speed | 0.83 | 0.83 |
| Air acceleration base + additional | 0.02 + 0.06 | 0.02 + 0.05 |
| Gravity | 0.23 | 0.17 |
| Terminal fall speed | 2.8 | 3.1 |
| Fast-fall speed | 3.4 | 3.5 |
| Jump squat frames | 3 | 5 |
| Full-jump height | 31.28 | 51.5 |
| Short-hop height | 10.65 | 11.58 |
| Double-jump height | 40.204 | 41.778 |
| Empty landing frames | 4 | 4 |

Distances and velocities are Melee units and units/frame; do not insert them
into a seconds-based Warcraft velocity without converting. Prefer simulation
units with rendering scale at the boundary. Report jump heights are trajectory
targets, not initial velocities; verify discrete integration before choosing
launch velocities. We target 60 logical frames per second independently of
render cadence.

The 2026-09-30 `jumpApexMatchesDocumentedCharacterTargets` test advances the
actual simulation for 80 ticks per trajectory, starting jumps through input
and measuring the maximum height above takeoff. All six cases pass within
0.001 Melee units (0.006 Warcraft units): Archer full/short/double heights
31.28/10.65/40.204 and Rifleman 51.5/11.58/41.778. The airborne double-jump
fixture starts 100 world units above the platform with one jump remaining.
This establishes isolated apex height at the documented six-to-one scale,
not airtime parity, input latency, animated pose height, or feel under combat.
Run `bash test.sh jumpApexMatches` from
~/code/wc3-melee/worktrees/test-loop; evidence is
wc3-melee:build/wurst-tests/jump-apex.log. No launch-speed changes were needed.

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

## Initial dash and dash dance

Unmodified grounded direction now starts at the documented initial dash speed
of 1.9 Melee units/frame (11.4 world units/frame) for both fighters. Holding
direction for ten ticks keeps that speed; the eleventh tick uses the documented
run speed, 2.2 for Archer or 1.5 for Rifleman. Reversing on ticks 2–10 immediately
changes facing and velocity and restarts the ten-tick window, allowing repeated
dash dancing. A neutral tick applies ordinary traction and advances the window,
so a short gap between keyboard directions does not discard an early reversal.
Stopping completely clears the movement phase.

The ten-tick duration is provisional research tuning, not a sourced Melee
duration. Initial-dash speed stays constant throughout that window; Melee's
acceleration within dash and animation-dependent transition are not reproduced.
At expiration, opposite direction brakes existing ordinary velocity by a
provisional 0.8 Melee units/frame each tick without changing facing. After
stopping, the next held-direction tick starts a fresh dash. From full run speed
this takes three braking ticks for Archer and two for Rifleman. This is an
independently authored approximation of run turning; its acceleration, facing
timing and zero-speed boundary are not claims of Melee parity. No implementation
expression from the unlicensed local reference was copied or translated.

The walk modifier immediately selects the existing 1.6/1.4 walk speeds and
clears the dash phase; releasing it starts a fresh initial dash. Jumps, shields,
attacks, dodge actions, hitstun, ground departure, landing and stock loss/reset
clear that phase while retaining their existing eligibility and momentum rules.
Hitlag freezes the phase and displacement. Grounded recovery still gates motion;
held direction starts a fresh dash on its expiration tick. Digital input has no
analog tilt or stick-smash threshold, and initial facing changes have no separate
turn startup. Dash attacks, crouch cancels and animation changes are outside
this movement slice.

The focused `initialDash` simulation filter passes 6/6 tests; the full suite
passes 180/180, including walk transitions, run-turn braking, and recovery
after air-dodge landing. Evidence is
wc3-melee:build/wurst-tests/initial-dash-focused.log and
wc3-melee:build/wurst-tests/initial-dash-full.log. Native dash-dance feel and
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
floor(damage / 3 + 3), so a 15-damage hit yields 8 frames. Electric and crouching
modifiers have their own rounding stages; this first slice excludes them.
Source: https://www.ssbwiki.com/Hitlag. Digital shieldstun's documented expression
is (damage * 0.45 + 2) * 200 / 201; determine integer frame accounting explicitly
when implementing rather than treating a real-valued duration as exact frames.

For ordinary percent-based hits, the documented knockback baseline is:

    K = (((p / 10 + p * d / 20) * 200 / (w + 100) * 1.4 + 18) * g + b) * r

Here p is post-hit percent (Melee floors the pre-hit percentage before adding
this frame's damage), d is move damage, w is victim weight, g is growth divided
by 100, b is base knockback, and r is contextual scaling (1 for the initial
ordinary case). Fixed-knockback attacks, crouch modifiers, DI and
special launch angles need explicit implementation before parity claims.
For a 12-damage hit on weight 80 at 0 pre-hit percent, growth 100,
base 20 and ratio 1, K is 51.0666667, launch speed 1.532 and floor(0.4*K) is 20.
These are useful independent arithmetic expectations for our Wurst tests.

The local reference's `src/melee/ft/ftcoll.c` at revision
`0296f009f32f710495979d30772d8332af2d411a` supports the percent timing fact:
`ftColl_GetDamageCount` casts accumulated percent to an integer before the
ordinary branch adds a fractional temporary component (`ftColl_80079AB0`, lines
2050–2104). The same path has a separate fixed-knockback branch and caps its
result using common data. The decompiled common-data fields do not expose
verified growth, base, or cap values here, so this work does not infer them from
field offsets or claim numeric parity. No reference implementation was copied.

`ordinaryHitKnockback` now receives pre-hit percent, this hit's damage, victim
weight, growth percent, base knockback, and context scale independently. The
map supplies growth and base from the selected hit region, with defaults of
100 and 20 for unchanged moves and contextual scaling of 1.
`ordinaryHitlagFrames` and `ordinaryHitstunFrames` make the normal
hit frame conversions testable at their integer boundaries. These helpers
cover only the documented ordinary, non-electric, non-crouching branch; the
separate fixed-hit, cap, shield, and modifier rules remain distinct work.

Smashcraft intentionally omits staling and freshness bonuses. The design
rationale is in wc3-melee:README.md, “Intentional omissions.” Do not add a
staling queue or projectile staleness snapshots.

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
projectiles/summons do not freeze the summoner. Electric and crouch-cancel
gameplay are still absent and must not be claimed implemented. Their future
victim formula is floor(c * floor(e * floor(3+d/3))), capped at 20;
the attacker's e and c remain 1. No later-game tipper hitlag multiplier applies.

Launch speed already uses 0.03*K, converted by the six-world-units scale.
The general >=80 tumble rule remains a prototype: the reference selects
damage states through scaled-knockback thresholds and ground/air conditions.
Exact boundary and grounded exceptions still require verification before a
full tumble-parity claim; a screenshot saying “exceeds 80” is not sufficient.

## Frame-authored hit regions

The match now selects facing-relative rectangular regions using the current
`attackFrame`. Regions include damage, growth, base knockback,
launch direction, and a numbered contact window. Lower region indices win
overlaps: a target receives exactly one selected effect per resolution.
Both fighters' effects and facing are copied before applying either hit, so
trades retain their original selected regions even when a hit cancels an
attack. Hit application retains the maximum of existing and incoming hitlag,
so unequal trades cannot shorten one fighter's freeze depending on resolution
order. Existing grab priority and independent projectile handling remain.
The unchanged moves keep their previous geometry, active frames and effects.

Flat forward tilt (style 6) has an inner region at local x=0–110 and a
higher-priority tip at x=90–145, both at local z=-130–130. All bounds are
inclusive world-unit offsets from the attacker to the victim's simulation
origin. Facing mirrors x. Its active frames remain 5–6, total duration 28;
the angled forward tilts retain their existing single regions and effects.
These are independently authored, provisional values, not Melee measurements:

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
(x=-105–105, z=20–190), three active frames, total duration 34 and landing lag
15 are retained. Hitlag freezes the authored attack clock, so the second
window is reached after those frozen ticks rather than after a wall-clock
delay. Each window can connect once; it does not reset every active frame.

These rectangles still test a single victim origin; they are not pose-derived
hurtboxes. Animation alignment, character-specific region tuning, and native
combat feel remain future work. Existing clip frame clocks and recovery
durations are preserved, but this does not establish geometric alignment.

The `SimulationTests` filter passes 146/146 tests, including nine added
resolution tests for overlap priority, mirrored launch, early/late effects,
frame/geometry boundaries, per-target contact memory, shield contact, re-hit
windows and trades. The compiler reports zero errors and warnings. Evidence:
wc3-melee:build/wurst-tests/hit-regions-20260930-final.log. Integration passed
211/211 tests in wc3-melee:build/wurst-tests/hit-regions-integrated.log. Map build
`hit-regions` succeeded with the four existing warnings and was installed;
the running client has not loaded it and native combat feel is unverified.

## Knockdown reference limits

The local Melee revision recorded above's `ftCo_DownBound.c`, `ftCo_DownAttack.c`,
`ftCo_Down.c`, and `ftCo_DownStand.c` establish separate down-wait choices for
get-up attack, directional rolls, and standing. They do not expose reliable
frame counts for the associated intangibility in the inspected functions.
The local prototype's knockdown durations remain provisional below, and the
tech-intangibility counts are sourced separately to the cited secondary data;
neither should be described as locally measured Melee timing.

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
delivery latency. See wc3-melee:DEVELOPMENT.md for the recorded input sequences.

## Separated launch velocity

Ordinary movement (`vx`, `vz`) and launch momentum (`knockbackX`, `knockbackZ`)
are stored separately. Position uses their sum. The factual Melee baseline is
launch speed `0.03 * knockback`, decaying by `0.051` per frame while air
friction is disabled; falling speed still takes effect. This simulation applies
the `0.051 * 6 = 0.306` world-unit decay to the launch vector's magnitude,
preserving its direction, while ordinary gravity and terminal speed affect
only `vz`. Launch decay continues after hitstun expires, and the player can
steer ordinary movement again when hitstun reaches zero. This keeps a downward
launch above the ordinary terminal-fall cap. The additional gravity-based
launch adjustment introduced in Brawl is not part of this Melee target.

A new ordinary hit resets movement velocity and replaces the stored launch
vector. This is a deliberate simplification: Melee can stack launches when
hits are sufficiently separated in time and the fighter is airborne; the
prototype does not track that history yet. Landing removes vertical launch
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
Neutral/directional dodge motion now uses provisional speed 18 world
units/frame, 0.9 decay and a 26-frame motion period. The 49-frame counter cap
is not a custom animation asset or a claim that those provisional motion
values match Melee.

An accepted air dodge replaces prior ordinary movement and clears both launch
momentum components, including for neutral input. This follows the momentum
halt described in the Melee section of https://www.ssbwiki.com/Air_dodge.
During each airborne motion tick, the simulation multiplies both dodge velocity
components by 0.9 before either displacement. A 45-degree input therefore
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
including landing. At scale six, their measured apexes match the table above
within 0.02 world units for both characters. Launch speeds are calibrated for
our gravity-before-displacement integration, not extracted Melee velocities:
for n ascending steps, height = n * velocity - gravity * n * (n + 1) / 2.
Fox uses 23.46 / 13.98 / 26.496 world units per frame; Falco uses
25.62 / 12.42 / 23.124. Matching apexes does not establish identical trajectories
or feel. Jump presses during squat are ignored without spending an air jump;
release during squat latches short hop even if jump is pressed again.

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

The owner defines neutral N as jab, N plus direction as smash, and N plus
direction while holding the walk modifier as tilt. C-stick bindings request
smashes directly. Walking uses the character baseline of 1.6/1.4 Melee units
per frame (Archer/Rifleman), independently of run speed. Walking changes
directly to the requested walk speed rather than modeling analog walk
acceleration. Tilt damage is 10 side / 8 up / 8 down. These damage values
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
total 41/31/37/34/38 ticks; landing lag 10/14/16/15/18 ticks, in neutral,
forward, back, up, down order. Forward and back hit only on their respective
sides; back launches away from facing, up launches mostly upward, and down
launches downward. Hit regions are simple rectangles around the fighter rather
than authored hitboxes. Neutral/back timing and weak damage are detailed below.

Neutral and back aerials use a shared Falco-inspired timing baseline for both
fighters. The factual tables at https://www.ssbwiki.com/Falco_(SSBM)/Neutral_aerial
(revision 1930482) and https://www.ssbwiki.com/Falco_(SSBM)/Back_aerial
(revision 1651640), retrieved 2026-09-30, report clean contact on frames 4–7,
late contact on 8–31 / 8–19, and interruption on 42 / 38. Cached pages are
wc3-melee:build/multiplayer-setup/falco-neutral-air.html and
wc3-melee:build/multiplayer-setup/falco-back-air.html. Only these factual numbers
are used; no article prose or decompiled implementation is copied.

The start tick is attackFrame 0, corresponding to reference frame 1. Thus both
moves have strong contact at indices 3–6; neutral lingers at 7–30 and back at
7–18. Completion at indices 41 / 37 permits the next action on reference
frames 42 / 38. The authored animation recovers over this actionable duration;
it does not reproduce the reference's longer full animation lengths (49 / 39).
Strong damage stays 7 / 8, while late damage is provisionally 5 for either move;
ordinary knockback and hitlag use that lower damage. Both phases retain hit
window 1, so a strong hit cannot rehit as weak after hitlag or target reentry.
A missed strong phase can still connect late. Up aerial's intentional separate
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

Each accepted blaster action emits one horizontal shot when startup ends.
Shots advance on simulation ticks independently of the owner's attack clock,
and persist through owner recovery or interruption. Collision sweeps the
horizontal distance traveled during a tick, so a beam cannot skip a stationary
fighter just because its endpoints lie on either side. Intangible or absent
targets do not absorb a shot. Shields absorb it without freezing the distant
shooter. Rifleman's neutral-special shot deals 3 damage, applies four frames
of victim-only hitlag, then at least 11 frames of hitstun, interrupting an
ordinary attack or special. This is the requested Falco-like brief flinch;
the 11-frame value is original provisional tuning, not verified Falco parity.
Archer arrows instead follow the damage-only rules below.

Projectile tuning is 36 Warcraft units per frame and 60 ticks of life
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

While holding shield, a fresh left/right press requests a roll; a fresh down
press requests a spot dodge. Input callbacks collect edges and the frame step
resolves them against held shield state, so shield/direction callback order
within that frame does not change the result. Holding direction cannot repeat
rolls; pressing shield while direction was already held does not roll. Two
opposite horizontal press edges cancel, and down takes priority if several
directions arrive in one frame. These are deliberate digital-input rules.

The local reference at melee:src/melee/ft/kinds/ftCommon/ftCo_Escape.c separates
forward/backward roll relative to facing and changes facing through an
animation event. Our simulation owns that transition instead of Warcraft's
animation. No reference implementation is copied. Cached character pages do
not provide verified dodge timing values; the initial ground-dodge parameters
are provisional rather than a Melee parity claim.

Roll lasts 31 frames, is intangible on frames 4–19 inclusive, and translates
at 8 world units per frame during that window (128 units unless stopped by
the platform edge). Spot dodge lasts 22 frames and is intangible on frames
2–15 inclusive. The start tick is frame 1. Roll facing stays fixed during
movement; a forward roll reverses facing at completion, while a backward
roll preserves it. Neither move permits attacks, jumps, steering or shielding
during its recovery. Jump takes priority over a simultaneous dodge request.
Spot dodge does not drop through a platform. Intangibility and recovery clocks
pause in hitlag. The owner's common frame-data profile specifies spot dodge
22 / protection 2–15, both rolls 31 / protection 4–19, and air dodge 49 /
protection 4–29 with 10 landing frames for every character. Air dodge retains
its existing helpless fall until landing after its animation completes.
Both fighters have authored ground-dodge clips. See wc3-melee:ANIMATIONS.md
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

Our current prototype enters tumble at knockback magnitude 80 or above. It
can leave tumble through an accepted air jump, air dodge or attack after
hitstun; landing while still tumbling starts knockdown. Ground impact lasts
12 ticks, followed by a vulnerable wait of up to 180 ticks before automatic
stand-up. Recovery checks attack, then horizontal roll, then stand. Held
horizontal input and held Up are accepted, including on the bound-to-wait
transition; an attack edge on that transition is consumed immediately. This
repairs the previous requirement to release/repress direction after impact.
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
Jump as stand-up input is a deliberate keyboard convenience. Both fighters
have authored recovery clips; get-up rolls reuse ordinary roll clips.

Impact presentation uses three distinct cues: a nine-frame white contact
star for damage, a fifteen-frame floor glint for successful techs, and a
twelve-frame green/white floor burst plus thirty-two-frame spreading dust for
missed techs. The latter stays at the landing point as the fighter recovers.
These are original procedural models based on the owner's visual direction;
their display lifetimes do not alter hitlag, tech windows, or recovery timing.
wc3-melee:wurst/ImpactEvents.wurst derives one frame's cues from numerical
before/after state, including both fighters in a trade. The live adapter uses
40 preallocated effects and presents each completed frame once; headless
replay creates no effects. Reconciliation of changed speculative journals is
still part of the unimplemented visible-rollback milestone.

Spot dodges emit two small outward-moving dust puffs. Ordinary, get-up and
tech rolls emit a compact blue-white star and one smaller puff moving opposite
the roll. These use frame-entry events, so sustained invulnerability does not
repeatedly create the cue.

Archer's down-air uses seven startup ticks and 20 active ticks (indices
7–26), with 38 total ticks. Its first three active ticks deal 9 damage and
the lingering kick deals 6, sharing one hit registry window. Its collision
region remains ±55 horizontally and −180..−10 vertically. Landing cancels
into 18-frame recovery (9 with L-cancel). The tucked startup and downward
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
cached at ~/code/wc3-melee/worktrees/test-loop/build/ref-Tech.html, reports a
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
lasts 40 with intangibility on 1–34. These totals and the 128-unit roll path
are initial tuning; both leave six vulnerable recovery ticks. Direction at
contact chooses the roll, whose movement is clamped to the current platform.
A tech clears impact hitstun and consumes its input window. Early-hitlag versus
last-hitlag inputs, repeated/grounded presses, window/lockout boundaries,
recovery actions, interruption and reset are tested in the same Wurst simulation
used by the map. Wall/ceiling techs and SDI/ASDI collision are not implemented.

## L-cancel

The factual reference https://www.ssbwiki.com/L-canceling (cached at
~/code/wc3-melee/worktrees/test-loop/build/ref-L-canceling.html) describes a
seven-frame Shield/Grab input window, landing lag halved and rounded down,
and inputs retained during hitlag. Digital Shield also feeds tech timing;
L-cancel itself is independent of the tech lockout. No source text or outside
implementation is incorporated.

Our frame convention gives seven contact opportunities including the press
tick: contact through +6 ticks succeeds, +7 expires. Inputs during hitlag
remain valid through the sixth subsequent unfrozen tick. The existing window
also freezes during hitlag; this pre-hitlag-input case and the exact input-phase
offset have not been independently measured against Melee. Each fresh Shield
or Grab press renews the opportunity; holding does not. Any landing consumes it,
and stock loss/reset clears it. Only an unfinished aerial normal receives the
reduction: neutral/forward/back/up/down recovery becomes 5/7/8/7/9 ticks under
current prototype tuning. Empty landings and air-dodge landings are unaffected.
Animation-specific autocancel windows and analog trigger behavior remain open.

## Smash charge

Melee smash attacks can be charged for up to 60 frames while holding attack.
SmashWiki reports a Melee maximum damage multiplier of 1.3671× (the 1.4× figure
is the rounded general-series value). Source: https://www.ssbwiki.com/Charge,
retrieved 2026-09-29 and cached at
`~/code/wc3-melee/worktrees/test-loop/build/ref-Charge.html`. The local
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
frame. The six-frame window is a Smashcraft control choice, not Melee parity.

A current queued attack takes priority over voluntary platform dropping during
the movement step. Action recovery also blocks the drop, so holding Down cannot
drop through during down-smash startup/charge or down-tilt recovery. With no
current attack or action lock, Down still drops through passable platforms.
The command queue's actual frame window determines whether an attack is current;
expired and future commands do not suppress movement. This is our digital-input
priority rule. Analog shield dropping and stick-threshold fidelity remain open.

## Shield presentation boundary

The guard shell and HUD percentage read shieldEnergy/SHIELD_MAX; they do not
resolve collision. The shell shrinks as energy drains, while the current
prototype still blocks eligible contacts through its existing whole-fighter
shield rule. Shield tilting, geometric shield pokes and analog light shielding
remain differences. Shield-break recovery is described below. Green/yellow/red HUD colors
and the Warcraft spell shell are presentation choices, not reference parameters.

## Shield-break recovery

Shield depletion from holding guard, melee contact, and projectile contact now
uses one independently authored forced sequence in wc3-melee:wurst/Simulation.wurst:
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
wc3-melee:build/ref-Shield.txt, independently reports the pop/landing/stand/dizzy
sequence, percent dependence, mashing, termination by flinching attacks, and
30 HP after a Melee shield break. The cached page was consulted for facts only;
no article prose is reused. It does not verify our timings or launch strength.

The prototype choices are explicit: launch vertically at 24 Warcraft world
units/tick with the existing character gravity and terminal speed; hold the
landing pose for 12 ticks; stand for 30 ticks; then remain dizzy for
`max(60, 240 - floor(max(0, percent)))` ticks, sampled on dizzy entry. Each
fresh synchronized mash edge removes three additional remaining dizzy ticks,
on top of that frame's normal one-tick reduction. These numbers, the minimum
duration, and our uniform mash weight are provisional tuning, not verified
Melee values. InputSnapshot.mashPressed admits at most one such edge per tick;
held inputs alone are not mash edges. Mash edges before dizziness or during
hitlag have no effect and are not banked.

Shield health stays at zero through the pop/landing/stand and becomes 30 on
dizzy entry. It stays exactly 30 through dizziness and on its expiration tick;
normal shield drain/regeneration resumes on subsequent normal simulation ticks.
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
shieldBreakRemaining is the dizzy countdown; shieldBreakDizzyFrames(percent)
exposes its initial provisional duration. Public timing constants are
SHIELD_BREAK_LAND_FRAMES=12, SHIELD_BREAK_STAND_FRAMES=30 and
SHIELD_BREAK_RESTORED_ENERGY=30. LAND begins on contact; each timed phase
transitions after exactly its stated number of later unfrozen ticks. Expiration
clears state/frame/countdown without consuming the current input as an ordinary
action; the match's following attack-resolution phase can start a legal attack.

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
local data field offsets do not establish actual timing or geometry values;
none of that unlicensed implementation is copied or translated.

This independently authored prototype samples catches before either fighter's
movement on each match tick. An airborne, falling fighter must face inward
and have its feet within 54 world units outside the endpoint and between
90 units below and 12 above its height. Down suppresses catching. Existing
attack/recovery, hitlag, hitstun, grabbed, dodge and shield-break locks suppress
catching. A free ledge chooses the nearer eligible fighter by squared distance
to the endpoint from the shared snapshot; exact ties catch neither. Existing
owners retain the ledge throughout hanging and an ongoing climb/roll/attack.
Both ledges resolve independently. These region, timing and contention rules
are provisional choices, not measured Melee parameters.

A catch anchors the feet 24 units outside and 90 below the endpoint, clears
movement and launch velocity, and restores one air jump. It does not reset
percent, shield energy, stocks or respawn protection. Catch protection lasts
30 unfrozen ticks (including the catch tick); hanging afterward is vulnerable.
Choosing an option never refreshes that protection. Jump, release, interruption
and completed recovery remove it. Every departure starts a 30-unfrozen-tick
regrab lock. Ordinary flinching damage and grabs interrupt the ledge action;
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
for the other options. wc3-melee:wurst/MatchStep.wurst resolves pair catches
before advancing either fighter; standalone simulation consumers must do the
same. Pure Wurst checks cover both characters and sides, eligibility, upper
platform exclusion, contention/ownership, option timing and locks, attack
contact, protection expiry, regrab timing, hit/grab interruption and reset.
They do not establish native animation alignment or Melee numerical parity.

The hang dimensions now fit the measured reach of both fighter rigs.
wc3-melee:tools/animations/ledges.py reads the simulation's hang offset, depth,
mount duration, climb duration and climb inset directly when baking wrist
contact. wc3-melee:wurst/FighterAssets.wurst fixes both model scales at one so
model coordinates and simulation world units agree. The animation adds no
root travel. Packaged-model wrist checks establish contact at the hang point
and through the first five climb ticks; native visual alignment remains a
separate check. These dimensions are prototype art/gameplay tuning, not
measured Melee values.

## Default digital wavedash and fast-fall directions

Owner-selected controls (2026-09-30): a horizontal-only air dodge uses an angle
of 18 degrees below horizontal for either fighter, mirrored for left/right.
Its initial vector has the existing 18-unit magnitude, approximately
(+/-17.1190, -5.5623), before ordinary 0.9 air-dodge decay. This is the default,
with no modifier or toggle. Explicit up/down/diagonal input retains its
previous direction and normalized speed; neutral retains zero initial velocity.
The shallow choice helps preserve horizontal landing momentum, but a dodge
started too high may still expire before reaching the ground. It is a control
choice, not a claim of measured globally maximum wavedash distance.

Fast-fall now requires down with neutral horizontal input. Down-left/down-right
continue air drift without selecting fast-fall speed. Shield dodges, DI, down
attacks and platform-drop handling retain their separate inputs. Existing
fast-fall descent/actionability rules remain; native feel needs the new build.

## Rifleman freezing trap

Down+B places one trap on Rifleman's current grounded surface. Placement is
instant when the next simulation frame accepts the input; airborne placement,
placement while shielded or action-locked, and a second live trap are ignored.
The trap arms after 20 match frames, lasts up to 1,800 frames (30 seconds),
and has a 90-frame placement cooldown. It triggers on an opposing grounded
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
and `frozenFrames`. Snapshot restore copies and compares these fields exactly.
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
wc3-melee:wurst/Simulation.wurst (`grabContactFrame`, `grabActionDuration`).
Pummel deals three damage once, without launch, and freezes both clips and the
hold timer during its normal hitlag. The four throws each deal damage once at
release and use the shared knockback/hitstun formula; throw DI uses the victim's
input on that frame, without adding ordinary hitlag or SDI. Down throw visually
slams to the floor and launches into an upward bounce. Character throw damage,
angles, growth/base knockback, trajectories, action lengths and ten-frame escape
recovery are original starting tuning, not extracted Sheik values. The existing
simultaneous-grab clash remains an intentional alternative to port priority.

Holder/victim action, frame, serial, mash signs, timer and reciprocal links are
copied and compared in snapshots. Damage, freeze, stock/reset interruptions clear
the pair. The original 20-frame fixtures were updated to the damage-dependent
capture contract; successful capture now exits grab startup into the explicit
hold action rather than retaining the whiff cooldown.

Both fighters have pummel and four throw clips plus matched victim clips in
wc3-melee:tools/animations/grab_animations.py. The animation boundary consumes
timing from Wurst; canonical pair state owns translation and release. Native
pose alignment, real-button use and interruption readability require the
installed-build check and are not proved by the numerical tests.

### Archer arrows: damage without interruption

Owner correction: normal/running arrows and multishot arrows add damage without
hitstun, hitlag, knockback, DI setup or interruption of attacks, grabs, ledges or
recovery. They do not erase a reaction already in progress. Shield hits retain
shield-energy damage but add no shieldstun or hitlag; depleting shield energy
still uses the shared shield-break rule. Unshielded damage still breaks the
Rifleman trap's ice, as required by that mechanic. Rifleman's projectiles retain
their separate hit behavior. This replaces the earlier arrow-stun request.
