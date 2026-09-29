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
| Air dodge | melee:src/melee/ft/kinds/ftCommon/ftCo_EscapeAir.c | Direction chooses a velocity of common magnitude; neutral input produces zero initial dodge velocity. Dodge velocity decays. Ground contact enters special landing. Test diagonal normalization and retained horizontal motion through landing. |
| Shield | melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c | Shield health and analog shield strength affect shield size; held shield drains health. Our keyboard controls initially provide a full-strength digital shield. |
| Knockback | melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c; melee:src/melee/ft/types.h | Knockback magnitude/angle, damage state, and hitlag callbacks are distinct. Common data includes per-frame knockback decay; character data includes weight. Keep hitlag and hitstun separate. |

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
constants; their resulting apex heights have not yet been compared to the
reference table. Digital direction input, simplified collision shapes and
Warcraft animation remain deliberate differences.

Minimum mechanics checks: press edges; short/full jump; air-jump budget; landing
from above only; air-dodge landing momentum; shield drain/regeneration/break and
stun; hitlag freeze then knockback/hitstun; one stock per blast-zone crossing;
respawn and final-stock result. Tests must call the simulation used by the map.

## Documented numerical baseline (NTSC Melee)

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
render cadence. Initial implementation may differ until that migration lands.

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
ordinary case). Staling, fixed-knockback attacks, crouch modifiers, DI and
special launch angles need explicit implementation before parity claims.
For a non-staled 12-damage hit on weight 80 at 0 pre-hit percent, growth 100,
base 20 and ratio 1, K is 51.0666667, launch speed 1.532 and floor(0.4*K) is 20.
These are useful independent arithmetic expectations for our Wurst tests.

## Air-dodge protection checkpoint

The locally cached SmashWiki Air_dodge table reports Fox and Falco intangible
on frames 4–29 inclusive, with a 49-frame animation. The simulation now tracks
the dodge frame separately from motion, blocks both strikes and grabs during
that interval, and ends dodge protection on landing or interruption by a hit.
Respawn protection is independent. The renderer lowers fighter opacity using
the same protection query used by hit detection.

The frame sweep test checks both characters at each frame 1–30. Additional
tests cover damage interrupting startup and landing ending dodge protection.
Neutral/directional dodge motion still uses provisional speed 8 world
units/frame, 0.9 decay and a 26-frame motion period; landing lag remains the
provisional 20 frames. The 49-frame counter cap is not a custom animation asset
or a claim that those provisional motion values match Melee.

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
Shield-release-lag cancels remain unfinished. Ground dodge behavior is described
below; this is not a complete implementation of Melee's shield options.

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
| Side/down tilt | 5 | 2 | 28 |
| Up tilt | 6 | 2 | 29 |

Warcraft's stock attack animation begins on accepted attack startup; it is
paused during hitlag. It does not yet align its contact pose to the active
window. Authored clips and move-specific damage, shapes and launch angles
remain required. The blaster is now a moving projectile emitted during its
active frame, rather than an instantaneous long-range hit check.

The owner defines neutral N as jab, N plus direction as smash, and N plus
direction while holding the walk modifier as tilt. C-stick bindings request
smashes directly. Walking currently uses half the normal ground speed; tilt
damage is 10 side / 8 up / 8 down. These and the ground/air blaster timing
difference are provisional tuning. Blaster duration is captured at attack
start, so landing cannot rewrite its recovery. Aerial normal attacks and
charged smashes still need their own move behavior.

## Moving blaster shots

Each accepted blaster action emits one horizontal shot when startup ends.
Shots advance on simulation ticks independently of the owner's attack clock,
and persist through owner recovery or interruption. Collision sweeps the
horizontal distance traveled during a tick, so a beam cannot skip a stationary
fighter just because its endpoints lie on either side. Intangible or absent
targets do not absorb a shot. Shields absorb it without freezing the distant
shooter. Fox deals 3 damage without flinch; Falco deals 3 damage and at least
11 frames of hitstun. These damage/stun values are provisional.

Initial projectile tuning is 36 Warcraft units per frame and 30 ticks of life
(1,080 units of travel), emitted 35 units ahead and 75 units above the fighter's
feet. The simplified target center is 45 units above the feet, with 24 units
of horizontal radius and 36 units of vertical tolerance. These are prototype
collision dimensions, not reconstructed Melee hitboxes. Beam rendering reads
simulation positions; it does not determine contact.

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
the platform edge). Spot dodge lasts 23 frames and is intangible on frames
2–15 inclusive. The start tick is frame 1. Roll facing stays fixed during
movement; a forward roll reverses facing at completion, while a backward
roll preserves it. Neither move permits attacks, jumps, steering or shielding
during its recovery. Jump takes priority over a simultaneous dodge request.
Spot dodge does not drop through a platform. Intangibility and recovery clocks
pause in hitlag. Dedicated dodge animations are still required.
