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
Cooldown and visual attack time freeze during hitlag and otherwise decrement
before action eligibility checks; the frame that reaches zero accepts input.
Ground steering waits for cooldown even when the visual attack timer ends
earlier. Tests exercise these rules through the shared advance function.
Move-specific startup/active/recovery windows remain unfinished, and the
current inability to jump out of shield is a deliberate recorded gap.
