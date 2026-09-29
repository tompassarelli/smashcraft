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
| Forward tilt (flat/up-angled/down-angled), down tilt | 5 | 2 | 28 |
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
start, so landing cannot rewrite its recovery. Aerial normals are now separate
simulation styles: neutral, forward, back, up, and down. Ground normals and grab
are rejected in the air, aerial normals are rejected on the ground, and blaster
remains usable in either state. Air steering changes horizontal velocity while
preserving facing, allowing a back aerial to hit and launch behind the fighter.
Landing cancels an aerial's remaining active/recovery animation and starts its
move-specific landing lag. Aerial hit geometry and tuning are prototype values,
not Melee measurements: damage 7/8/8/8/9; startup 3/5/6/5/7; active 2/2/2/3/3;
total 25/31/33/34/38 ticks; landing lag 10/14/16/15/18 ticks, in neutral,
forward, back, up, down order. Forward and back hit only on their respective
sides; back launches away from facing, up launches mostly upward, and down
launches downward. Hit regions are simple rectangles around the fighter rather
than authored hitboxes. Charged smashes still need their own move behavior.

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
pause in hitlag. Archer now has authored ground-dodge clips; Rifleman's clips
remain to be authored. See wc3-melee:ANIMATIONS.md for playback and art limits.

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
stand-up. Fresh recovery presses choose attack, then roll, then stand.
Stand-up lasts 30 ticks; roll lasts 31 and covers 128 world units, clamped to
the current platform. Their first 8 ticks are intangible. Get-up attack lasts
45 ticks, has 16 startup/3 active ticks, deals 7 damage once, covers both sides,
and is intangible during startup. Recovery clocks freeze during hitlag.

All these recovery timings, threshold and hit shapes are provisional.
Instant surface impact replaces a physical bounce; face-up/down
variants, jab resets, and character-specific get-up data remain unfinished.
Jump as stand-up input is a deliberate keyboard convenience. Rifleman recovery
art is still stock; Archer get-up rolls reuse ordinary roll clips.

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

A current queued attack takes priority over voluntary platform dropping during
the movement step. Action recovery also blocks the drop, so holding Down cannot
drop through during down-smash startup/charge or down-tilt recovery. With no
current attack or action lock, Down still drops through passable platforms.
The command queue's actual frame window determines whether an attack is current;
expired and future commands do not suppress movement. This is our digital-input
priority rule. Analog shield dropping and stick-threshold fidelity remain open.
