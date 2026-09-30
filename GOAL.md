# Smashcraft delivery goal

Deliver a complete, responsive, readable Warcraft III platform fighter in Wurst:
first a fully playable Archer–Rifleman game, then playable Demon Hunter
(Illidan), with a measured and justified multiplayer input architecture.
Preserve the playable map, authored assets, and agreed custom mechanics while
finishing missing systems. The owner should refine the game through playtesting,
not have to research basic rules or repeatedly discover omissions.

## Delivery order

1. Finish shared combat and recovery as connected, reference-grounded systems,
   starting with knockdown, techs, jab resets and getup options. Complete the
   current fighters' missing moves and interactions alongside that work.
2. Deliver the complete two-fighter game through real controls, animations,
   character/stage selection, match, KO, and New Match flow in Warcraft.
3. Add Demon Hunter to the same complete character standard. Roster expansion
   must not displace missing Archer/Rifleman specials or broken shared rules.
4. Complete scheduled-input integration and actual two-client comparisons.
   Independent replay and native-feasibility work may continue alongside
   gameplay; unproven networking must not replace the playable baseline.

## Reference-grounded combat

Use the pinned local Melee decompile to establish complete relevant rules:
conditions, state transitions, frame ordering, animation/event timing,
protection, collision/grounding, and interruption behavior. Follow references
into common parameters and character/action data where the code consumes them.
Extract factual mechanics; do not copy or translate unlicensed implementation.

Resolve each system's connected behavior before declaring it complete. Use
focused tests for rules and native checks for controls, poses and interactions.
Separate verified reference facts, deliberate Smashcraft choices and unresolved
gaps in the existing physics documentation. Never turn an unverified number
into a default or label a passing provisional test Melee parity. If a datum is
absent locally, obtain the exact missing data through an authorized source or
report that specific gap instead of guessing or assigning research to the owner.

Cover short-tap dash momentum and movement; walk/tilts; jump squat, short/full
jump and double jump; aerial momentum and landing; bounded attack buffering,
including first-airborne-frame attacks queued in jump squat; shields and shield
grab; knockback, hitlag, hitstun, shieldstun, DI/SDI and tumble; ground impact,
downbound, down-wait, down-damage/jab resets, face-up/down recovery, getup
stand/attack/rolls, tech windows/lockouts/protection; ledges, stocks and respawn.
Resolve applicable electric and crouch-cancel modifiers rather than leaving
them silently absent. Measure getup attack's actual hit advantage, including
the defender's escape options.

The proposed knockdown timing table is a comparison to verify against underlying
data, not evidence of universal Melee durations. Ordinary dodge rolls and getup
rolls are separate actions; do not inherit one action's timing into the other.

Keep intentional choices explicit:

- No stale-move penalties or freshness bonuses. Discourage spam through move
  design, commitment, spacing, recovery and counterplay; see intentional
  omissions in wc3-melee:README.md.
- Straight horizontal air dodge uses the agreed shallow downward direction
  for convenient wavedashing. Diagonal Down does not trigger fast-fall, and
  C-stick down-air does not inject movement Down or force fast-fall.
- Shared ordinary dodge profile until changed by the owner: spot dodge 22
  total/protection 2–15; forward/back rolls 31/protection 4–19; air dodge 49/
  protection 4–29, with 10 frames of special landing lag. State frame indexing
  explicitly. These choices do not prescribe getup-roll data.
- Custom attacks and specials need explicit, readable move data. Melee supplies
  the agreed mechanical foundation, not nonexistent Warcraft character move
  data. Mark original tuning honestly.

## Complete the fighters

Both current fighters need standing jab, directional and angled tilts,
distinct smashes, dash attack, all five aerials, normal/shield grabs, hold,
pummel, escape/release and four throws, plus shared movement, defense,
damage and recovery actions. Finish CPU recovery as well as pressure and
edgeguard behavior.

While holding an opponent, fresh Attack taps request pummels with explicit
startup/contact/recovery; holding Attack does not automatically repeat them.
Directional input selects forward/back/up/down throws. Author coordinated
holder/victim poses and one defined release/contact event per action; prevent
grab-context commands from leaking into ordinary attacks after release.

Archer: jump-cancellable neutral arrow; side-special wind-up followed by a
multishot fan; down-special hippogryph cover with a backward somersault and
brief airborne hang; up-special briefly mounts the hippogryph for fast ascent.
Finish the legible fist jab, directional tilts, extended-leg neutral air,
Fox/Falco-like back kick and tucked-startup downward dive kick. Running/basic
arrows are damage-only: no hitstun, hitlag, knockback or move interruption.
This includes multishot arrows and supersedes the earlier stun request.

Rifleman: recognizable Warcraft-style bullet; running/swiping bear;
five-second freezing trap with visible ice entombment and defined release rules;
downward-shot upward recovery with early protection ending before the apex.
Finish readable kicks with cape clearance and canonical blue portraits with
the gun fully visible. Repair material/import causes rather than recoloring
around an unresolved asset defect.

Demon Hunter: neutral-special Mana Burn; side-special evasion/parry;
up-special visible animated wings and quick rising recovery; down-special
Immolate with shine-like horizontal ground knockback and downward air spike.
A short post-recovery glide remains tentative. Do not infer mana-drain,
reflection, exact parry rules or final tuning from move names alone. Deliver
his full normals, aerials, grabs/throws, shared actions, effects, portraits,
selection and replay coverage, not just his specials or model.

Apply smashcraft-character-creation-distilled to every completed/new fighter.
Author distinct startup, contact and recovery poses in the existing Blender
pipeline, preserving interpolation and existing clips. Include grounded and
airborne hitstun reactions, contact-pose hitlag freezing, prone/getup poses,
tech/roll glow and dust, missed-tech dust, ledge actions, KO and respawn.
Keep weapons attached and legible at gameplay size in both facings.
Bake action-frame hit/hurt volumes, strong/weak phases, tip regions and re-hit
rules into the numerical simulation; rendered bones never decide collision.

## Controls, presentation and match flow

Use QWER left-hand controls, U special, I jump, O grab, P walk/tilt; shield plus
Attack or O grabs. L is not the default grab key. Finish both keyboard presets,
rebinding and saved settings. Keep distinct jab/tilt/aerial input semantics and
fresh-edge handling under buffering, hitlag and releases.

Provide visible movable chips for every active human/CPU, independent fighter
choices and mirror matches; distinct character/stage screens; retained choices
and settings on New Match; and reliable character → stage → match flow.
Fix Enter/chat interference and restart disconnects at their owning causes.
Retain four-slot presentation; actual three/four-player combat is a later
expansion, not something to imply from four visible cards.

Finish Smashcraft/Tompas branding, readable white text with black shadow,
larger percentages, restrained menu accents and normalized portrait framing.
Preserve a locked, stable camera, hidden native healthbars/blast zones and
useful off-screen indicators. Verify the Space camera fix through real use.

## Prove multiplayer

Follow wc3-melee:SMASHCRAFT_NETCODE_PROPOSAL.md and the user's implementation
brief. Keep one deterministic, snapshot-capable simulation with immutable
per-frame inputs, stable interaction order, complete gameplay state and replay
without native side effects. Finish scheduled input, shared frame advancement,
confirmed results and separation of local presentation from combat.

Compare 60 Hz D=3/R=0 and D=3/R=6, plus the proposed D=2 and D=5 profiles.
Use dedicated bounded native sync transport where native gates justify it;
do not merely add a queue after synchronized key callbacks. Retain fixed delay
and the current baseline. Introduce shadow rollback before visible prediction.

Arrange two actual clients; a VM is a candidate to evaluate, not a proven
measurement setup. New paid resources/accounts require owner authorization.
Measure early polling, transport capacity/age, engine stalls, animation-phase
restoration, effects/audio reconciliation, responsiveness and slot fairness.
Run the specified replay/fault scenarios and two-client tests: no confirmed
mismatches, silently rewritten inputs or unbounded storage. Adopt a default
from measured responsiveness and readable corrections, not the algorithm name.
Do not claim equal physical latency or working multiplayer from headless tests.
A Rust bridge or engine extension requires a demonstrated missing capability
and a real supported interface; it is not an assumed fallback.

## Completion and reporting

Keep the public repository current. Use wc3-melee:LOOP.md for installed and
observed build/evidence, wc3-melee:PHYSICS.md for mechanics and intentional
differences, and existing development/animation documents for remaining work.
This goal sets current priorities over older development notes.

Report implemented, source-tested, installed, native-verified and untested
separately. A compiled move, generated clip or green test is not delivery.
A system is complete only when its agreed connected behavior works in the
installed map through real controls, both fighters/facings and relevant mirror,
interruption, stock/reset and replay cases. Multiplayer additionally requires
real two-client evidence. The full goal remains open until every agreed part
is delivered or the owner explicitly changes its scope.
