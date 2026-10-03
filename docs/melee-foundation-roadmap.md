# Melee foundation, balance design, and visual legibility

Requested 2026-10-03. Establish an independently authored, reference-tested
Melee physics foundation before treating original Warcraft fighters as balanced.
Use a familiar visual language first, then evolve its artwork toward Warcraft.
This roadmap sequences the shared-mechanics work in
wc3-melee:docs/delivery-goal.md. Controls, character completion, and multiplayer
remain requested work; this does not declare them finished or replace their goal.

## Shared physics and original fighters — owner clarification, 2026-10-03

Melee fidelity applies to the shared equations, integration and state rules.
Smashcraft's playable fighters are original characters with independently
chosen parameters. A historical Archer→Fox or Rifleman→Falco association is
not a requirement to copy either fighter's complete movement, weight, moves,
rolls or balance. Individual borrowed values, such as a jump-squat duration,
are separate design choices.

Reference verification uses a test-only actor with explicit original-game
parameters through the same production physics engine. A Falco test rig can
check gravity, jump timing and weight without making Rifleman a Falco clone.
Reference cases must assign their parameters explicitly rather than rely on
a playable fighter's defaults matching the source. Character identity still
selects Smashcraft moves and presentation; its parameters are chosen separately.
Keep current playable numerical tuning during this separation; future tuning
belongs to deliberate character design, not automatic reference-data intake.

## What is established now

The local retail source is now identified as GALE01 revision 2 (NTSC 1.02).
Its executable SHA-1 matches the pinned decompile's expected retail executable,
and its PlCo SHA-1 matches the published shield-table extraction. The ISO and
extracted proprietary files remain in private storage outside every repository;
only independently recorded numerical facts enter the reference corpus.

Current implementation and reference limits are recorded in smashcraft:docs/physics.md
and smashcraft:docs/smash-melee-reference/surface-action-boundaries.md. Production
source includes actor-owned parameters and test-only Melee rigs, recorded
fall/jump, dash-entry, grounded-damage, floor-recovery and shield-contact cases.
It also includes retail launch stacking, damage-level selection, grounded
movement, rebound and test-arena surface recovery. These implementations do not
establish full parity or complete collision geometry.

The assembled simulation passes 592/592 normal Wurstunit checks. The
generated-Lua production probe passes selected grounded-friction, shield regen,
shield damage, shield-contact accumulation and fused shieldstun boundaries,
plus 22 composed ground-motion cases and four shield-entry overwrite cases.
The interpreter alone cannot prove emitted-Lua precision. Production airborne
launch and recoil now use retail scalar directions, fused per-axis subtraction,
and independently derived squared-speed cutoffs for the fixed retail decays.
Their emitted-Lua comparisons pass; the cutoff derivation is documented in
smashcraft:docs/melee-air-cutoff.md. Below-cutoff recoil retains its vertical
component and clears vertical launch, matching four original branch executions;
the earlier fixture's incorrect vertical recoil composition has been repaired.
Ordinary/fixed launch arithmetic now matches 50 original outputs and 150
crouch/charge adjustments exactly in emitted Lua; the previous calculation
failed 34/50 magnitude comparisons. Existing hitstun duration and damage levels
match 23 original boundary observations without a formula change. Capped hitlag
matches 52 original ordinary/electric/crouching observations. Analog pressure
now reaches drain, contact damage/stun/pushback, relative visual size and replay,
with 54 original numeric rows matching emitted Lua and four connected tests.
See smashcraft:docs/melee-analog-shield.md for its boundaries. The assembled
precision check passes fourteen groups. Other formula rounding, shield geometry/powershields,
connected/sloped ECB contacts and native trajectory checks remain open.

The latest physics candidate is Smashcraft 0.0.12, build melee-physics-r26,
source 8bb5f06a0667efeb5b4c65a7dd724be48601799f. It built with zero errors and
six existing warnings. SHA-256:
a23845b7631e71695a0e24db91f9d30647d57784e52d45cd2db20e89bb06b860.
Artifact: ~/code/wc3-melee/worktrees/melee-physics-public/build/wurst-map/Smashcraft 0.0.12.w3x.
Build evidence: smashcraft:build/physics-map-r26.log. Deployment was disabled;
this candidate has not been installed or observed natively. Separate native
input/contact probes do not establish its physics or presentation. The separate
native arithmetic candidate in smashcraft:docs/native-physics-precision.md
packages the existing comparison cases for Warcraft execution and remains
unobserved natively.

Collision/tech coverage, remaining shared rules and native verification still
prevent M1 closure. Identifying the retail disc does not identify the revision
of previously acquired Slippi recordings. VFX implementation and its native
acceptance remain separate from the formula checks. Staling and freshness
bonuses remain the deliberate omission in smashcraft:docs/gameplay-design.md.

## The ladder and its completion evidence

| Milestone | Deliverable | Evidence required to climb |
| --- | --- | --- |
| M0: Reference data and comparison fixtures | Factual frame-data corpus, verified parameters, and a small independent comparison path | Explicit sources, units, frame indexing, missing-data list, and one deliberately wrong result detected |
| M1: Melee physics foundation | Movement, damage response, shielding, tumble, surface impacts, techs, and recovery in the actual simulation | Paired frame traces for named cases; exact state/event boundaries; stated numerical tolerances; bounded native proof |
| M2: Move design and balance constraints | One move-data model and contextual tests for commitment, reach, shield pressure, and combo opportunity | Representative moves produce checkable hit/whiff/shield timelines; every roster exception is visible |
| M3: Combat visual legibility | Familiar dust/impact/protection cues driven by verified events | Native clips prove timing, placement, surface orientation, distinction, and pause/replay behavior |
| M4: Measured roster tuning | Repeatable matchup experiments and deliberate tuning | Before/after measurements plus human play evidence for the specific changed trade-off |

M0 feeds M1. Move-data organization can start after reference intake, but balance
claims wait for M1. Event work and VFX can proceed as their owning mechanics are
verified, alongside M2. Final matchup tuning needs both trustworthy mechanics
and readable combat. Cosmetic experimentation does not block numerical repairs.

## GitHub tracking

Roadmap: https://github.com/tompassarelli/smashcraft/issues/2

| Milestone | Work | Depends on |
| --- | --- | --- |
| M0 | [#3 Acquire authoritative Melee parameter and frame-data references](https://github.com/tompassarelli/smashcraft/issues/3) | — |
| M0 | [#4 Establish independent frame-by-frame physics comparison fixtures](https://github.com/tompassarelli/smashcraft/issues/4) | — |
| M1 | [#5 Match movement integration and character physics](https://github.com/tompassarelli/smashcraft/issues/5) | #3, #4 |
| M1 | [#6 Match knockback, hitlag, hitstun, DI/SDI, and electric modifiers](https://github.com/tompassarelli/smashcraft/issues/6) | #3, #4 |
| M1 | [#7 Match shields, shieldstun, pushback, and out-of-shield timing](https://github.com/tompassarelli/smashcraft/issues/7) | #3, #4 |
| M1 | [#8 Match tumble, surface bounces, techs, knockdown, and getup](https://github.com/tompassarelli/smashcraft/issues/8) | #3, #4, #5, #6 |
| M1 | [#9 Close the bounded Melee physics foundation acceptance](https://github.com/tompassarelli/smashcraft/issues/9) | #5, #6, #7, #8 |
| M2 | [#10 Make move data explicit and queryable for design comparisons](https://github.com/tompassarelli/smashcraft/issues/10) | #3 |
| M2 | [#11 Establish contextual move-category balance rules](https://github.com/tompassarelli/smashcraft/issues/11) | #9, #10 |
| M2 | [#12 Analyze roster hitboxes, punish windows, and combo envelopes](https://github.com/tompassarelli/smashcraft/issues/12) | #11 |
| M3 | [#13 Tie combat effects to verified event timing and contact geometry](https://github.com/tompassarelli/smashcraft/issues/13) | #5, #6, #7, #8 |
| M3 | [#14 Reproduce legible dust, impact, bounce, and protection cues](https://github.com/tompassarelli/smashcraft/issues/14) | #13 |
| M4 | [#15 Establish a measured roster-tuning and playtest loop](https://github.com/tompassarelli/smashcraft/issues/15) | #9, #12, #14 |

Native GitHub sub-issues and blocking dependencies are attached; the table also preserves the readable dependency graph.


## Meaning of a clean foundation

Use NTSC 1.02, 60 logical steps/second, and explicit Melee-to-Warcraft distance
conversion. Compare a test-only Melee reference configuration in the **same
production simulation**, assigning named original-game parameters explicitly.
Do not create a second simulator that only proves itself. Warcraft fighters
retain independently authored stats and moves; Fox/Falco test profiles are
measurement fixtures and never select the playable roster's design.

Record verified facts, unresolved data, observed implementation behavior, and
intentional choices separately. The no-staling decision is authoritative in
smashcraft:docs/gameplay-design.md and is excluded from the missing-work list.
Preserve previously approved no-staling/no-
freshness, shared dodge timings, digital wavedash direction, and original
specials until an owner decision changes them. Those exceptions prevent an
unqualified whole-game parity claim; they do not excuse incorrect shared rules.
Where an exception changes an oracle result, select the agreed reference inputs
or explicitly measure that exception instead of silently adjusting expectations.

The claim is bounded: matching selected movement trajectories, formulas,
protection windows, and connected collision/recovery transitions. Full parity
requires expanding the named cases and resolving every relevant data gap; a
green suite written from our existing constants does not establish it.

## How balance will be represented

Move categories provide design expectations, not Melee-wide laws. Smash attacks
usually trade commitment for reach, power, or kill potential; normals usually
offer quicker interactions; aerials add movement, landing timing, and positional
risk. Exceptions need an explicit role and counterplay.

Measure recovery **after actual contact**, attacker/defender hitlag, shieldstun,
pushback, spacing, landing lag, L-cancel success/failure, and the defender's
reachable out-of-shield option. Landing on an aerial's last active frame can
replace airborne recovery with landing recovery; it does not make every aerial
safe. A whiff supplies no defender stun, so test whiff punishment separately.

Hitlag pauses actions; hitstun prevents the victim from acting. Percent-dependent
knockback can add hitstun, but also carries the opponent farther away. A jab
therefore does not acquire a guaranteed combo simply because percent increases.
True follow-ups need both a time window and reachable geometry against declared
DI/SDI, gravity/fall speed, tech opportunities, and escape inputs. Shieldstun is
a separate interaction; damage-percent growth is not a substitute for its rules.

Enforce the owner's desired **Smashcraft** comparison under declared conditions:
a smash should not silently dominate the intended spaced normal or late aerial
in commitment, shield punishability, reach, and reward. Emit diagnostic results,
not a universal scalar balance score. A larger hitbox is not intrinsically better
when hurtbox exposure, placement, active time, movement, and reward differ.

## Work packages

Each package below becomes a GitHub issue with its dependencies and acceptance
criteria. Checks compare the production simulation to independent facts or
observations. No fixture may be generated from the same function it tests.

### A — Acquire authoritative Melee parameter and frame-data references

Milestone: M0. Dependencies: none.

Capture meleeframedata.com's factual move/character data as JSONL with character,
move, raw field values, source URL, source revision/retrieval context, units,
frame convention, conditions, and missing values. Prefer its published source
data where available; distinguish a repository snapshot from the live site.
Retain phase-specific/multihit values rather than collapsing them into one range.
Do not infer hitbox coordinates from GIF pixels or scrape artwork as data.
Credit the site's Janoris/Mitchell Meier, Joel Schumacher's extractor, and other
listed sources. Keep external implementation/artwork separate from factual data;
missing licensing blocks code/art derivation, not independently recording facts.

Resolve the exact common parameters and character/action scripts needed by C–F.
The decomp checkout has field meanings, not automatically the numerical values.
Use an authorized owned ISO/extractor or another verified published source;
record the precise unresolved table if unavailable. Review the site's warning
that GIF counters can be zero-based while displayed data is one-based and that
throw timings use Mario as the reference victim. Preserve such conditions.

Acceptance:
- [ ] JSONL parses and covers each discovered character, with per-page/move counts.
- [ ] Spot checks against source and selected live pages agree or report differences.
- [ ] Missing, textual, and conditional values remain explicit rather than zero.
- [ ] Common/character parameters required for physics have independently sourced values, or named blockers; blockers keep dependent parity claims open.

### B — Establish independent frame-by-frame physics comparison fixtures

Milestone: M0. Dependencies: none; incorporates A's verified records as available.

Use the existing Wurst simulation/test path. Specify initial state, immutable
frame inputs, units, original-game version, rounding, and the frame on which an
action begins/ends. Import a small independent corpus from original-game traces,
verified extracted tables, or independently calculated formula cases. Label what
each source can prove: a frame-data website does not prove gravity or collision
ordering, and ordinary Slippi post-frame fields do not expose every required
timer. Melee Unlocked is supplementary; its own full equivalence is not assumed.

For trajectories record position, self velocity, knockback velocity, grounded
surface and motion state. For contacts also record percent, hitlag/hitstun/
shieldstun counters, protection and first actionable frame. Compare float32
behavior/rounding at the appropriate boundary; declare justified tolerances,
never a loose tolerance that hides a state transition error. Stop at the first
divergence with the reproducing inputs and expected/actual fields.

Acceptance:
- [ ] One independent numeric fixture and one ordered state-transition trace run against production simulation.
- [ ] A deliberately perturbed value/frame produces a useful failing comparison.
- [ ] The corpus documents unavailable oracle fields and cannot label them verified.
- [ ] Fixture results distinguish numerical checks from installed/native observations.

### C — Match movement integration and character physics

Milestone: M1. Dependencies: A, B.

Verify gravity, terminal/fast-fall speeds, jump squat, release-selected short hop,
full/double jumps, horizontal takeoff momentum, air acceleration/friction/caps,
ground traction, dash acceleration/window, run/turn, walk, landing, and air-dodge
decay/landing momentum. Source launch velocities rather than solving only for a
desired apex: matching jump height does not establish airtime or integration.
Keep self motion and knockback motion distinct. Reference configuration uses
original input semantics; digital conveniences stay explicit gameplay choices.

Acceptance:
- [ ] Fox/Falco fixtures match full per-frame trajectories, apex time, airtime, and action boundaries under held/released/neutral input.
- [ ] Dash/run/turn and countersteer/overspeed examples expose the current provisional values and replace them with verified rules.
- [ ] Landing, jump-budget, fast-fall, and dodge transitions work through production input and state ordering.
- [ ] Remaining movement deviations are named; no whole-movement parity claim while relevant gaps remain.

### D — Match knockback, hitlag, hitstun, DI/SDI, and electric modifiers

Milestone: M1. Dependencies: A, B.

Verify percent/damage truncation, weight, growth/base/fixed knockback, caps,
context modifiers, special launch angles, launch speed, knockback decay,
grounded launch friction, launch stacking and simultaneous-contact selection.
Prove hitlag versus hitstun sequencing, exact first actionable frame, crouch and
interrupted-smash modifiers, DI/SDI/ASDI ordering, attacker versus victim and
detached-source behavior, and the electrical hitlag branches without inventing
an electric Warcraft move. Preserve sampled pre-interruption state.

Acceptance:
- [ ] Independent cases include fractional percent/damage, multiple weights, low/high percent, fixed knockback, angle boundaries, electric/crouch branches, and cap boundaries.
- [ ] Contact → pause/SDI → launch/DI → hitstun expiry traces match exact events and counters.
- [ ] Same-frame trades and successive-frame launches select/stack by verified rules.
- [ ] First failing production behavior is repaired at its owning cause; source-only arithmetic tests are not reported as native proof.

### E — Match shields, shieldstun, pushback, and out-of-shield timing

Milestone: M1. Dependencies: A, B.

Verify shield damage/drain/regeneration/size, hitlag and shieldstun frame ordering,
attacker/defender pushback, release/minimum-hold timing, shield break, jump-
cancelled options and shield grabs. Separate full digital shielding from analog
light shield and identify which is supported in the reference configuration.
Use actual contact geometry and post-contact actionable frames; existing timing
helpers alone cannot prove pressure or punish reach.

Acceptance:
- [ ] Independent shield-contact traces match both bodies' displacement and first actionable frames.
- [ ] Representative normal/smash/aerial contacts include close versus spaced contact and early versus late landing.
- [ ] Defender option startup, shield-exit rules, and reach are included in punishment results.
- [ ] Unsupported analog branches remain explicit rather than silently asserted equivalent.

### F — Match tumble, surface bounces, techs, knockdown, and getup

Milestone: M1. Dependencies: A, B, C, D.

Verify tumble selection with grounded/airborne exceptions; floor, wall and
ceiling impacts; bounce threshold/reflection/attenuation; contact position and
surface normal; repeated-contact suppression; hitlag/ASDI grounding; and remaining
hitstun through downbound. Verify tech input windows, lockouts, held/fresh input,
protection, tech rolls, face-up/down down-wait, jab reset/down-damage, getup stand,
attack and rolls. Ordinary dodge rolls and getup rolls are different actions.
Use bounded stage fixtures with named floor/wall/ceiling geometry; absent surface
support is a blocker for that claim, not permission to omit it.

Acceptance:
- [ ] Paired traces include threshold-adjacent floor/wall/ceiling impacts and tech-window/lockout boundary inputs.
- [ ] Miss-tech → bounce → prone → getup and jab-reset sequences match action/protection boundaries.
- [ ] Hit/contact and impact event positions/normals are available to presentation without affecting collision decisions.
- [ ] Native checks exercise the connected recovery sequence and identify installed build, controls, and remaining unobserved cases.

### G — Close the bounded Melee physics foundation acceptance

Milestone: M1. Dependencies: C, D, E, F.

Run the existing assembled physics comparison once after relevant fixes and a
short native interaction path in the built map: short/full hop, hitlag into
launch, shielding, missed-tech/tech and getup. Review reference/configuration
exceptions against wc3-melee:docs/physics.md and the agreed design choices.
Record scenario results and first mismatches, not an unsupported percentage of
whole-game fidelity. Publish the precise accepted mechanics envelope and the
exact unresolved blockers. An unresolved required physics gap keeps M1 open.

Acceptance:
- [ ] C–F's reference cases and connected state transitions pass in the shared production simulation.
- [ ] Installed/native observation is recorded separately from deterministic source checks.
- [ ] Approved design departures are explicit and not mistaken for reference defects.
- [ ] Every claimed mechanic has a source and observed comparison; remaining unsupported claims stay open.

### H — Make move data explicit and queryable for design comparisons

Milestone: M2. Dependencies: A.

Use source-owned Wurst data and existing hit-volume/animation authoring patterns.
Represent startup, active phases, interruption/total duration, grounded/airborne
recovery, landing/L-cancel lag, damage, angle, growth/base/fixed knockback,
hitbox offsets/shapes/size, hurtbox exposure, movement, shield effects, hitlag
effects, multi-hit/re-hit rules, and special conditions. Preserve strong/weak/tip
phases. Expose a factual export for analysis instead of duplicating hand-maintained
facts. Original Warcraft moves are original tuning, not inferred Melee records.

Acceptance:
- [ ] Representative jab, tilt, smash and aerial encode their actual production behavior and phase-specific geometry.
- [ ] Export can join move data to the reference corpus without changing simulation authority.
- [ ] Analysis distinguishes declared move properties from derived contact outcomes.
- [ ] Missing fields are resolved or marked unknown; no default zero masquerades as data.

### I — Establish contextual move-category balance rules

Milestone: M2. Dependencies: G, H.

Define the owner's Smashcraft expectations as comparisons under named scenarios:
normals for low commitment/interaction, smashes for committed reach/power/kill
reward, and aerials for movement/landing/spacing trade-offs. Evaluate whiff recovery,
close/spaced shield contact, early/late aerial landing, L-cancel outcomes, defensive
response startup/reach and expected reward. Do not enforce the false universal
rule that every Melee smash is unsafe or every normal/aerial is safe. Treat
exceptions as visible design choices requiring rationale and counterplay.

Acceptance:
- [ ] A representative smash versus spaced normal/late aerial comparison reports contact timing, recovery, shieldstun, separation, and reachable punish options.
- [ ] A deliberate category trade-off violation is detected by the existing design check path.
- [ ] Exceptions identify intended role, cost, and counterplay; a generic balance score cannot close the issue.
- [ ] The rules specify gameplay assumptions, not folklore based only on attack labels.

### J — Analyze roster hitboxes, punish windows, and combo envelopes

Milestone: M2. Dependencies: I.

Apply the design comparisons to Archer, Rifleman and Demon Hunter moves. Report
per-phase reach/vertical coverage/hurt exposure, hit/whiff/shield commitment,
reward and candidate role. Sweep representative percent, weight/fall-speed,
spacing, contact frame, DI/SDI and grounded/airborne conditions. Label a follow-up
as true only when it connects before the declared escape under tested geometry;
distinguish guaranteed links, tech chases, reads and escapable pressure.
Use a small meaningful sweep first rather than pretending exhaustive simulation
solves strategic balance. Do not automatically retune all fighters.

Acceptance:
- [ ] Queryable outputs expose outliers and unknown fields for the current roster.
- [ ] At least one follow-up's viable percent interval includes both timing and reach limits, not just hitstun > startup.
- [ ] Category comparisons identify specific dominated trade-offs and proposed changes with expected consequences.
- [ ] Unmeasured matchups, human adaptation, execution difficulty and novelty remain limitations.

### K — Tie combat effects to verified event timing and contact geometry

Milestone: M3. Dependencies: C, D, E, F.

Extend the existing impact-event/presentation seam for ordinary landing, roll,
spot dodge, floor/wall/ceiling missed-tech impacts, bounce, successful tech,
hitlag/launch, protection and electrical contacts. Measure emission frame,
contact anchor, surface normal, facing, travel and lifecycle from authoritative
scripts/data or frame-stepped observations. Distinguish verified trigger timing
from independently chosen artwork timing; do not assume a whole effect is dust
when a composite contains flashes/rings/debris. Presentation never chooses
hitboxes, protection or physics.

Acceptance:
- [ ] Each supported cue has a named verified trigger and explicit reference/unknown status.
- [ ] Floor/wall/ceiling anchors and orientation follow impact geometry; roll/spot-dodge emissions use their actual action events.
- [ ] Pause, interrupted actions, new stock/match, and existing replay behavior do not duplicate or leave stale effects.
- [ ] Event checks cover the production seam; visible correctness remains L's native check.

### L — Reproduce legible dust, impact, bounce, and protection cues

Milestone: M3. Dependencies: K.

Refine current effects with independently authored or appropriately licensed
assets. Begin with familiar Melee cue roles: brief contact burst, ground dust,
motion trail, missed-tech impact/bounce cue and distinct tech/protection cue.
Match event onset, placement, expansion/fade/lifetime and layering sufficiently
for readable play, then permit Warcraft texture/color/detail changes while
preserving cue meaning. Use original-effect data/footage as observations when
authorized; repository licensing does not grant Nintendo asset rights.

Acceptance:
- [ ] Native clips at gameplay scale show knockdown, both roll directions, spot dodge and hard floor/wall/ceiling impacts in both facings where supported.
- [ ] Tech versus miss-tech, electrical versus normal contact, and protection versus vulnerable recovery are visibly distinguishable for supported interactions.
- [ ] Effects remain behind the essential fighter/hit interaction; timing, anchors, surface orientation and paused lifetime are inspected.
- [ ] Reused asset rights and unobserved cases are recorded; screenshot similarity alone is not timing proof.

### M — Establish a measured roster-tuning and playtest loop

Milestone: M4. Dependencies: G, J, L.

Use existing replay/scenario and playable-map paths to reproduce representative
neutral, shield pressure, whiff punishment, combos, recovery and kill situations.
Choose one exposed trade-off to change at a time, state its intended role and
measure before/after outcomes. Combine simulation evidence with actual play;
scripted/bot wins and a table of frame data do not establish a balanced matchup.
Custom physics departures belong to a later named decision and must retain a
clear comparison to the accepted foundation.

Acceptance:
- [ ] One real roster change has a baseline, predicted effect, repeatable numerical scenario and observed playable result.
- [ ] Matchup notes distinguish mechanical guarantees, scenario coverage and human observations.
- [ ] Regression checks retain the M1 mechanics envelope and detect unintended effects on move-category commitments.
- [ ] Subsequent tuning issues cite specific data/play evidence rather than reopening foundational uncertainty without a counterexample.

### Routine test feedback and tuning freedom

The full assembled source suite took approximately 46 seconds. A focused
PhysicsTests run took 11.3 seconds. Compiler measurement for SimulationTests
showed parsing 2.68 seconds, typechecking 3.52 seconds, intermediate translation
0.62 seconds, test execution 4.32 seconds, and Lua translation 1.28 seconds.
Compilation is a material fixed cost; these observations do not isolate JVM
startup or establish Java itself as the cause. Set `WC3_TEST_MEASURE=1` when a
phase measurement changes the next optimization; routine runs need no timing
report. Use named focused filters during edits and the aggregate at integration.

Tests must preserve observable shared physics, action boundaries and replay
behavior. Independently recorded Melee rigs retain their exact numerical
expectations. Original-fighter tuning is changeable: short hops must rise less
than full hops, and angled variants share the flat move's timing, without
freezing arbitrary heights or damage values. This first focused audit does not
claim the entire suite has been audited. Redundant cases, literal-only checks,
provisional move timing and slow repeated simulations still need review.

After grounded movement/surface integration, the aggregate passed 463/463.
Its measured test execution was 34.26 seconds. The 4,096-frame replay alone
passed with 17.37 seconds of interpreter execution and is now in ReplaySoak,
outside the routine Tests filter. Its assertions and scenario are unchanged;
shorter replay/rollback regressions remain in the routine suite.

The 1,024-frame every-frame rollback scenario is also retained unchanged in
ReplaySoak. Its routine counterpart now runs one complete 192-frame input
cycle, crossing the 64-frame history ring and retaining all event/rollback
assertions; that focused case passed with 3.92 seconds of interpreter execution.
The routine suite after the first split passed 462/462 in 28.8 seconds end to
end. No end-to-end speed is claimed yet for the second split.
