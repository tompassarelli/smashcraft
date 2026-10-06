# Smashcraft delivery goal

Deliver a complete, responsive, readable Warcraft III platform fighter in TypeScript:
first a fully playable Archer–Rifleman game, then playable Demon Hunter
(Illidan), with a measured and justified multiplayer input architecture.
Preserve the playable map, authored assets, and agreed custom mechanics while
finishing missing systems. The owner should refine the game through playtesting,
not have to research basic rules or repeatedly discover omissions.

## Delivery order

Roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16) orders the
current work. The standing product sequence: verify the shared Melee physics
foundation before asserting move-category balance or tuning matchups, and add
visual cues as their owning mechanics are verified. Approved custom mechanics
stay.

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

Leaving a ledge without jumping must leave one aerial jump. Up-special recovery
must enter the appropriate helpless fall and jump lockout; do not generalize
that restriction to Archer's explicitly jump-cancellable neutral-special.
An airborne horizontal tap followed by released-direction neutral-special must
shoot toward the last tapped side without reversing movement momentum. An
air-dodge press during jump squat followed by left/right must buffer the shallow
downward dodge on the first airborne frame, including the default 8-key path.

The proposed knockdown timing table is a comparison to verify against underlying
data, not evidence of universal Melee durations. Ordinary dodge rolls and getup
rolls are separate actions; do not inherit one action's timing into the other.

Keep intentional choices explicit:

- No stale-move penalties or freshness bonuses. Discourage spam through move
  design, commitment, spacing, recovery and counterplay; see intentional
  omissions in smashcraft:README.md.
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
homing arrow that a well-timed jump avoids (#112); down-special hippogryph call to a perch and a dive from it
(down with a side keeps the backward hop); up-special steerable hippogryph
ride with a leap-off (smashcraft:docs/design/archer-specials.md).
Finish the legible fist jab, directional tilts, extended-leg neutral air,
Fox/Falco-like back kick and tucked-startup downward dive kick. Running/basic
arrows are damage-only: no hitstun, hitlag, knockback or move interruption.
This includes the homing arrow and supersedes the earlier stun request.

Rifleman: recognizable Warcraft-style bullet; running/swiping bear;
neutral-special bullet impact must briefly flinch the victim, like Falco's
laser, distinctly from Archer's damage-only arrows;
five-second freezing trap with visible ice entombment and defined release rules;
aimed recoil-shot recovery: the stick picks up, diagonally up or level and the
shot fires the opposite way, with one second shot to change route and early
protection ending at frame 10 (#127, smashcraft:docs/design/kit-review-1.md).
Finish readable kicks with cape clearance and canonical blue portraits with
the gun fully visible. Repair material/import causes rather than recoloring
around an unresolved asset defect.

Demon Hunter: neutral-special Mana Burn; side-special Fel Rush with
Vengeful Retreat and Chaos Strike branches, and mana drained by every hit he
lands (#147, smashcraft:docs/design/illidan.md);
up-special visible animated wings and quick rising recovery, with a jump in
its frames 16-28 starting a glide pitched by the stick and a wing slash out of
it; down-special Immolate with shine-like horizontal ground knockback and
downward air spike, jump-cancellable from its first active frame (#128,
smashcraft:docs/design/kit-review-1.md). Do not infer reflection or final
tuning from move names alone. Deliver
his full normals, aerials, grabs/throws, shared actions, effects, portraits,
selection and replay coverage, not just his specials or model.

Apply smashcraft-character-creation to every completed/new fighter.
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
Y acts as Start/Pause: confirms selection screens and toggles a synchronized
match pause. Combat and the match clock stop while input/network servicing
continues; pause-time attacks must not accumulate for release on resume.
Y also confirms a rematch after results. Reserve Y from rebinding; leave Enter
available to Warcraft chat.

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

Keep one deterministic, snapshot-capable simulation with immutable per-frame
inputs, stable interaction order, complete gameplay state and replay without
native side effects. Local presentation stays separate from combat.
Multiplayer acceptance is the **Done when** list of input integrity
[#26](https://github.com/tompassarelli/smashcraft/issues/26) and online play
[#17](https://github.com/tompassarelli/smashcraft/issues/17). Headless tests do
not prove working multiplayer or physical latency.

## Completion and reporting

Each part of this goal is tracked by a GitHub issue under roadmap
[#16](https://github.com/tompassarelli/smashcraft/issues/16). A part is complete
when its issue's Done-when boxes pass, and its Not-required list says what
completion does not include. Report what passed, on which build, with one line
of residual risk. Owner playtests decide feel; the agent prepares them and
fixes what they find. Keep the public repository current. Mechanics and
intentional differences live in smashcraft:docs/physics.md, and the build loop
in smashcraft:docs/development-loop.md.
