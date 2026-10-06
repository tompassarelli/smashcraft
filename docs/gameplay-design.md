# Gameplay design decisions

This is the one place Smashcraft's stance is written: the owner's principles
and decisions, how Smashcraft departs from Melee, and the questions still open.
The design references are descriptive and take no position:
[Melee case study](design/melee/README.md),
[modern platform fighters](design/modern-platform-fighters.md),
[execution windows](design/execution-windows.md) and the
[physics reference](physics.md). Each decision below names its owner's date
and, where there is one, its issue.

## Principles

Owner decisions, 6 Oct 2026 (#62):

- **Not a Melee clone.** Melee's data is a reference, not a template, and every
  fighter gets original hitboxes. The owner had already said so for the
  physics (3 Oct): Smashcraft's fighters are original characters; verifying
  Melee's physics concerns its shared equations and state rules, not making
  Archer Fox or Rifleman Falco; any value a fighter borrows from a Melee
  fighter, such as a jump squat, is a separate design choice. Melee fighters
  appear only as test rigs.
- **The best mechanics from any platform fighter.** The candidates are
  inventoried in [modern platform fighters](design/modern-platform-fighters.md) (#66).
- **No false agency.** Players must never believe they can escape when they
  can't. Wobbling and 0-to-death chain grabs are the anti-pattern
  ([Melee case study](design/melee/techniques.md#jank)). Locked states should
  be legible (#68).
- **SDI without teleport jank** (#70).
- **Non-interactive execution is dubious** (6 Oct, #54; see "L-cancelling" below).
- **Short true combos, devastating combos through reads** (6 Oct, #83; see
  "Combo structure" below).

## Combo structure

Owner decision, 6 Oct 2026 (#83): devastating combos should be the norm
against a player who is being outplayed, but they are earned through reads,
not granted by one hit.

- True combos are short: a hit guarantees about one or two follow-ups at most.
- Every extension beyond that is a read: a DI guess, a tech or escape guess,
  a coin flip the defender influences.
- A player who wins 2–3 reads in a row can take a stock from 0. Explosive
  moments come from chained reads, not from everyone landing two hits.
- One hit never guarantees a stock (see also "No false agency", #68).

Terms for measuring it. An **opening** is a hit or grab that lands. A
**guaranteed follow-up** lands whatever the victim does: every DI direction
including none, SDI, tech in place, left, right or missed, jump, air dodge and
mash. A **read** is a follow-up that lands against some of those choices but
not all, when the victim makes one it beats. A **string** is an opening and the
follow-ups that land after it.

Proposed targets, for the owner to accept or change; they are proposals, not
decisions. Accepted targets become interaction-graph checks
([interaction graph](design/interaction-graph.md)).

| Target | Proposed | Breaks it |
|---|---|---|
| Guaranteed follow-ups after an opening | at most 2, at every percent | a string of 4 or more hits that no victim choice escapes |
| Guaranteed damage from one opening, by the victim's percent when it lands | at most 30% at 0–99%; from 100%, a guaranteed string may end in a KO | more damage than that before the victim has a choice that escapes |
| Reads for 0-to-death | about 2–3: from 0%, no opening takes the stock with fewer than 2 reads, and each fighter has openings that take it with 3 | a stock taken from 0% with 0 or 1 reads; or a fighter with no 0-to-death path even with 3 reads |

The damage cap is chosen to fit the reads target: an opening and 2–3 reads,
each followed by guaranteed follow-ups worth up to about 30%, bring a victim
from 0% to roughly 90–120% before the last hit.

## Direction, not yet a rule

- Fighters generally need launchers into follow-ups such as tech chases.

## Throw regrabs

Implementation choice, 6 Oct 2026 (#85), under the owner's instruction to
implement the suggested defaults: a grab cannot catch a fighter whose current
hitstun came from a throw. Standing, dash and shield grabs share this rule.
When that hitstun ends, grabs can catch again. A follow-up strike can still hit
during throw hitstun; if it replaces the throw's hitstun, ordinary grab
eligibility returns. Damage-only arrows do not replace the throw's hitstun.

This removes direct throw-to-regrab chains while retaining true throw-to-attack
combos and attack-to-grab reads. It does not grant a timed immunity after control
returns or forbid grabs during ordinary attack hitstun.

## Physics foundation

Smashcraft's shared physics follows Melee's NTSC 1.02 rules, as roadmaps #2
and #9 set out, checked against the decompilation and by `bun wisp oracle`
(smashcraft:docs/physics.md). Where Smashcraft departs from Melee, the
departure is a row in the table below, and the oracle reports each departure it
exercises under that row's name; smashcraft:ts/scripts/meleeOracle.tests.ts
checks that every oracle departure names a row here.

## Deviations from Melee

| Mechanic | Melee | Ultimate or others | Smashcraft | Reason | Issue |
|---|---|---|---|---|---|
| L-cancelling | An L, R or Z press within 7 frames before landing halves an aerial's landing lag | Removed from Brawl onward, with more autocancel; kept in Project M and Project+ ([SmashWiki](https://www.ssbwiki.com/L-cancel)) | Removed: every aerial lands with the L-cancelled lag, with no input | Non-interactive execution test, a chore on every aerial with no decision in it | #54 |
| Stale moves and freshness bonuses | Repeats among the last 9 connected moves deal less damage and knockback | Ultimate keeps the 9-move queue, adds a freshness bonus, counts shield hits and weakens the knockback effect ([SmashWiki](https://www.ssbwiki.com/Stale-move_negation)) | None: a repeat deals the same damage and knockback | An over-engineered attempt at move diversity; diversity comes by construction, from move design | decisions 4 and 6 Oct |
| Tap-jump | Stick up jumps, always | Optional from Brawl onward ("Stick Jump" in Ultimate; [SmashWiki](https://www.ssbwiki.com/Tap_jump)) | Removed: stick-up and Space are just "up"; jump is its own button | Jump is its own button (owner, 6 Oct) | #49 |
| Stick deadzone | Each stick axis reads zero within 0.28 of centre, after a radial clamp | not covered here | Melee's deadzone applies to every controller; the value and its decompilation citation are in smashcraft:companion/README.md | A resting or drifting stick reads neutral | #49 |
| SDI | Each fresh stick movement during hitlag moves the fighter 6 units, as often as every frame ([case study](design/melee/defense.md#influence-on-knockback)) | Weakened in later games ([SmashWiki](https://www.ssbwiki.com/Smash_directional_influence)) | Pending: SDI that keeps its purpose without teleport jank | SDI should let the victim influence where multi-hits and strong hits leave them, without too much SDI teleporting a fighter | #70 |
| Horizontal air dodge | The dodge goes where the stick points | – | A horizontal-only digital air dodge angles 18° below horizontal, mirrored, by default and with no toggle | Owner-selected control (30 Sep); the shallow angle keeps horizontal momentum into the landing | – |
| Fast fall | A fresh stick down, diagonals included | – | Down with neutral horizontal input only; down-left and down-right keep drifting | Owner-selected control, 30 Sep | – |
| Dodge timing | Per fighter | – | One shared profile: spot dodge 22 frames, intangible 2–15; rolls 31, intangible 4–19; air dodge 49, intangible 4–29, landing 10 | Owner's common frame-data profile | – |

## Controls

- **Tap-jump** (owner, 6 Oct, #49): stick-up and Space are just "up"; jump is
  its own button.
- **Stick deadzone** (owner, 6 Oct, #49): Melee's stick deadzone applies to
  every controller. The value and its decompilation citation are in
  smashcraft:companion/README.md.
- **Digital air dodge and fast fall** (owner-selected, 30 Sep): a
  horizontal-only air dodge angles 18° below horizontal by default, with no
  modifier or toggle; fast fall needs down with neutral horizontal input. The
  implementation is in smashcraft:docs/physics.md, "Default digital wavedash
  and fast-fall directions".
- **Attack inputs** (owner): neutral attack is the jab, attack with a direction
  is a smash, and attack with a direction while holding the walk modifier is a
  tilt (smashcraft:docs/physics.md, "Prototype attack phases").
- **Shared dodge and knockdown timing**: every fighter uses the owner's common
  dodge profile in the table above, and one knockdown profile recorded in
  smashcraft:docs/physics.md, "Grounded knockdown and jab resets", as the
  requested shared profile.

## Fighters

- **Rifleman's trap escape** (delegated choice, 6 Oct 2026, #84): keep the
  single 300-frame freeze, then prevent any trap from catching that fighter
  until 20 frames after thaw. A hit that breaks ice grants the same interval.
  This covers the accepted 15-frame response floor plus the longest current
  five-frame jump squat: a jump chosen 15 frames after thaw leaves the ground
  before a waiting trap can spring. The trade-off is that Rifleman can still
  cover the escape with another move, and an idle fighter can be caught again
  when the interval expires. This is trap immunity, not protection from damage.

- **Archer's arrows** (owner correction): normal, running and multishot arrows
  add damage without hitstun, hitlag, knockback or interruption; shields still
  take their damage. smashcraft:docs/physics.md, "Archer arrows: damage without
  interruption", has the rule.

## Stale moves and freshness bonuses

Smashcraft deliberately has neither stale-move penalties nor freshness bonuses.
Repeating a move does not reduce its damage or knockback parameters, and using
a different move does not grant a damage bonus.

Attack-history penalties add inconsistency without improving the intended
combat decisions. Repetitive play should be punishable through startup and
recovery, spacing, commitment, defensive options, and opponent counterplay. If
a move is too effective when repeated, improve those interactions instead of
adding a hidden repetition penalty. Move outcomes should remain predictable
under the same combat conditions; victim percent, weight, hit region, and
other explicit mechanics still affect the result.

This is an intentional departure from Melee, not a missing feature.

Owner decision reaffirmed 2026-10-04: **skip Melee's stale-move mechanic**,
including its freshness bonus, for the physics foundation and subsequent
character balancing. Do not implement a recent-move queue, history-based damage
or knockback multipliers, or projectile staleness snapshots. This omission is
accepted scope, not a fidelity defect or a deferred implementation task.
Independent Melee comparisons must state that this modifier is omitted; all
other shared formula requirements remain open until verified.

Reaffirmed by the owner 2026-10-06: stale moves are an over-engineered attempt
to create move diversity. Diversity should come by construction, from move
design (how each move's hitboxes, startup, recovery and rewards work), not from
a bolted-on physics rule that rescales damage behind the player's back.

## L-cancelling

Non-interactive execution is dubious. Smash's execution tests are meant to be
interactive: they reward anticipating and reading the opponent's responses to
your actions. Part of Smash's appeal as an alternative to traditional fighters
is that its most complex execution is an interaction with the opponent, not a
single-player flowchart. L-cancelling is a single-player execution test that
involves no opponent, which is why it is a bad idea.

L-cancelling asks for a thoughtless input on every aerial. It is a persistent
chore that tires players' hands and adds an arbitrary execution test with no
benefit. The game's depth belongs in mechanics with real decisions: combo
follow-ups, directional influence and aerial drift.

Every aerial therefore lands with Melee's L-cancelled landing lag, automatically:
half its authored landing lag, at least one frame (Melee's PlCo +0x0E8 = 2). No
button shortens or lengthens it, and there is no L-cancel input, window or state.
Empty and air-dodge landings keep their own lag.

This is an intentional departure from Melee, not a missing feature.

Owner decision 2026-10-06 (#54): **remove L-cancelling**. This omission is
accepted scope, not a fidelity defect or a deferred implementation task.
Independent Melee comparisons, including `bun wisp oracle`, must state that
L-cancelling is omitted.

## Computer opponent

The computer (smashcraft:ts/src/game/match/botPlay.ts and its bot*.ts
siblings) plays inside the synchronized simulation: each frame it reads the
match and writes its fighter's controls and attack commands, as a player's
input row would, so every client and every rollback replay derives the same
decisions. It keeps no state of its own beyond the attack delay in the
replayed runtime (`botAttackDelays`). Each choice that looks random is
`botChoice`, a nonlinear hash of whole numbers from the match (the frame,
attack and grab serials, hits taken, the truncated percent) whose squares
stay inside 32-bit integers, so Bun and Warcraft's Lua compute it alike.

- It never steers its fighter past the point where it could still stop on
  the main deck: on the ground and in the air it compares where the fighter
  would come to rest, braking at traction or air acceleration, with the
  deck's edges less 40 units, and turns back when that point would pass them.
  A ground attack starts only if the slide it leaves ends on the deck it
  stands on, and specials that move it (Disengage, Parry Step) only with room
  to land.
- It attacks with whatever reaches: each move's strike at its first active
  frame, from the authored hit regions and contact capsules, against the
  target where both will be by then. Specials join when they suit the
  distance; shots, Multishot and the bear from range. A 40-frame plan
  weighs ground pressure, jumping in with aerials, or keeping away and
  shooting.
- It shields, spot dodges, rolls or (Illidan) parries some strikes, shots,
  Immolations and bear swipes, one choice per threat, and lets others land.
- Knocked down it gets up: with the target in reach mostly a get-up attack,
  otherwise a stand, a roll or a short wait; one tumble landing in three it
  misses the tech. It never lies still under jab resets.
- Off the stage it returns to the deck or, facing a free ledge, falls onto
  the ledge and climbs, rolls, jumps or attacks from it.

The 540-match `--policy cpu` soak checks this behaviour: departures,
self-destructs, time-outs and the moves that landed
(smashcraft:ts/scripts/soakOutcomes.ts summarizes them).

## Execution and reaction windows (#69)

Adopted 6 Oct 2026 under the owner's instruction to carry out the proposed
recommendations. These are delegated design choices, not quotations from the
owner. Evidence and its limitations are in
[execution windows](design/execution-windows.md). Bounds are design constraints,
not claims that these timings guarantee human reaction on every setup.

| Window type | Lower | Upper | Today |
|---|---|---|---|
| Reaction-based option (responder must see a cue, then act) | 15 frames from the cue, for one option | about 25 at four options | not measured |
| Tech (defensive press before contact) | 11 | 20 | 20 |
| Tech lockout between presses | 20 | 40 | 40 |
| Input buffer | 4 | 10 | 6 |
| Offensive link or follow-up | 3 | none beyond the move's own timing | no required links |
| Jump squat; short-hop release window | 3 | 5 | 3 and 5 |
| Parry active window | 6 | 10 | 6 |
| Powershield input window | 2 | 4 | 2 |
| Ledge intangibility | 30 | 37 | 30 |
| Ledge regrab lock | 30 | 60 | 30 |
| Any required precision input with no aid | 3 | n/a | L-cancel removed |

The reaction figures are authoring targets: at least 15 frames from the first
visible cue for one response, about 25 for four choices. The latter is a chosen
budget, not a measured Hick coefficient or a hard maximum on readable cues.
Required links and unaided precision inputs need at least 3 accepted frames;
there is no mandatory one-frame input in ordinary play. Optional optimizations
may be tighter. A powershield is such an optional reward, not required defence.
Longer delays need a stated gameplay reason rather than automatic rejection.
The 20-frame tech-lockout floor and 60-frame regrab ceiling are chosen bounds,
not empirical limits.

The oracle checks the shipped tech, lockout, attack buffer, jump squat and
short-hop release, parry, powershield and ledge windows against these ranges.
Interaction timing checks apply the reaction, required-link and precision
rules to authored situations. No current move is designated a required link
or guaranteed reaction option; the graph's existence of a punish is not a
claim that a human can react to it.

## Open questions for the owner

Mechanic-level questions drawn from other games (parry, air dodge, rage, short-hop input, ledge rules and others) are listed at the end of [modern platform fighters](design/modern-platform-fighters.md). Questions raised by fighting-game and platform-fighter design language (hurtbox extension, disjoints, counter hits, shield geometry, whiff penalties, DI strength, launchers and others) are listed at the end of [fighting games](design/fighting-games.md) and [platform fighters](design/platform-fighters.md).

Stage questions (the flat stage, moving platforms, hazards, blast zones and the stage list) are at the end of [stages](design/stages.md#open-design-questions-for-the-owner).

Questions drawn from Melee itself are at the end of the
[Melee case study](design/melee/README.md#open-design-questions-for-the-owner).

The move comparisons check one category rule that no owner decision states:
in the same shield-contact context, greater shield damage costs later attacker
recovery or an earlier defender response
(smashcraft:docs/move-comparisons.md). Whether it is a design rule for
Smashcraft's moves is open.

## Hit presentation

Recommended defaults adopted under Tom's 6 Oct 2026 instruction to do all
recommended work (#82), rather than recorded as independently chosen by Tom:

- Warcraft's stock spell and impact art carries Melee's event vocabulary;
  the descriptive mapping is in smashcraft:docs/design/melee/hit-effects.md.
  Demon Hunter melee contacts use Cleave, Immolation uses fire and
  Mana Burn uses lightning; those element choices change presentation only.
- Strength has three sizes (0.75, 1.0, 1.25), at knockback 80 and 180.
  The upper threshold follows Melee's strong normal spark; 80 and the sizes
  are authored readability defaults. No random extra spark obscures strength.
- Hitlag lightly colours the victim by element and vibrates its body by
  2 world units, 3 for electric; the camera stays steady. Freeze retains blue.
  These are bounded Warcraft approximations, not Melee's colour programs.
- Walk steps are quiet at a 16-frame cadence; run steps are louder at 8;
  dash has one louder start cue. Combat and landing cues take priority in
  players' attention. This is an authored rhythm, not imported footstep audio.
- Pummels are short, quiet and higher-pitched; throw releases use a separate
  Blink sound. Preserve the existing star/screen KO body treatment, with
  Warcraft impact sounds and the fighters' original death cues.

Style questions raised by the mapping: should whole-screen shake replace the
small body vibration; should every contact have a louder flash; should footsteps
track each clip's exact planted foot; should top KOs become Warcraft explosions?
The adopted defaults above answer these with a steady camera, bounded sparks,
a shared footstep rhythm and retained top-KO bodies. Revisit only after an
observed readability problem; no separate approval is outstanding for them.

## Legible locked states (#68)

No false agency asks that a fighter who can't get out knows it. The agency
analysis (smashcraft:docs/typescript.md, "Victim agency") sorts every frame
a fighter is under the other's control into three states.

- **Locked, nothing matters**: no input changes anything. Measured on 6
  October: a grab thrown at once (5 to 51 frames from the grab until the
  thrown fighter can act, longest for an up throw at 150%), the forced stand
  after a jab reset (15 frames), hitstun after a launch until the 20 frames
  before a tumble landing (up to about 100 frames after a smash attack at
  100%), and the Rifleman's freeze (299 frames).
- **Locked, only DI matters**: only the stick changes what happens: SDI
  pulses during hitlag, and DI on hitlag's last frame or on the frame a throw
  lets go. These are short: 1 frame in a throw, up to 9 in a smash attack's
  hitlag.
- **You can act**: a button changes what happens. That includes a press the
  buffer keeps for up to 6 frames and a tech press up to 20 frames before the
  landing, so the analysis says "can act" before the fighter visibly moves.

Prior art, described: traditional fighting games' combo counters count a hit
only while the opponent is still in hitstun, so the counter tells both
players whether the defender could have acted; Street Fighter 6's training
mode frame meter shows each frame of both characters as a coloured pip
(startup, active, recovery, hitstun, blockstun) ([EventHubs](https://www.eventhubs.com/news/2022/sep/16/sf6-training-visual-frame-data));
Super Smash Bros. Ultimate marks some states on the fighter itself: a
flashing red overlay and an orange halo while stunned after a shield break,
and in Training Mode a blue glow while intangible and green while invincible;
from Brawl on, a stunned fighter plays a recovery animation as its stun ends
([SmashWiki, stun](https://www.ssbwiki.com/Stun); [SmashWiki, Training Mode](https://www.ssbwiki.com/Training_Mode)).

Adopted 6 Oct 2026 under the owner's blanket authorization to carry out the
recommendations; these are delegated choices, not quoted owner answers:

- Mark the two locked states; "you can act" is the unmarked default.
- Use distinct fighter tints or outlines for "nothing matters" and "only DI".
  Both players see the same distinction. Choose the final colours during the
  visual implementation so they remain readable on every fighter.
- Remove the locked signal on the first frame an input can change the outcome,
  including a buffered button or a tech press before movement resumes.
- Show DI-only frames accurately, including the one-frame throw release;
  do not stretch the signal across frames where DI no longer changes anything.
- Compute the live signal with a cheap rule over current fighter state
  (hitlag, hitstun, grab, freeze, forced stand, buffer and tech eligibility).
  Validate it against the existing replay-based agency analysis before shipping.

Implementing and observing these signals is a separate follow-up to #68's
completed detector and design proposal. The analysis is the validation oracle,
not a thirty-input replay workload to run for every fighter during a match.

The Rifleman's trap can freeze a fighter again as each freeze ends (#84).
Throw-to-regrab chains are governed by the throw regrab rule above (#85).
