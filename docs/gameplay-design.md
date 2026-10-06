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

## Open questions for the owner

Proposed lower and upper bounds for each execution and reaction window type.
They are proposals, not decisions; the evidence for each is in
[execution windows](design/execution-windows.md). Accepted bounds move up into
this document as decisions and become oracle or interaction-graph checks.

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

Mechanic-level questions drawn from other games (parry, air dodge, rage, short-hop input, ledge rules and others) are listed at the end of [modern platform fighters](design/modern-platform-fighters.md). Questions raised by fighting-game and platform-fighter design language (hurtbox extension, disjoints, counter hits, shield geometry, whiff penalties, DI strength, launchers and others) are listed at the end of [fighting games](design/fighting-games.md) and [platform fighters](design/platform-fighters.md).

Questions drawn from Melee itself are at the end of the
[Melee case study](design/melee/README.md#open-design-questions-for-the-owner).

The move comparisons check one category rule that no owner decision states:
in the same shield-contact context, greater shield damage costs later attacker
recovery or an earlier defender response
(smashcraft:docs/move-comparisons.md). Whether it is a design rule for
Smashcraft's moves is open.
