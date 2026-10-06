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
- **Deviations start from Ultimate and Rivals of Aether 2** (6 Oct). When a
  Melee mechanic feels worse than it should and we deviate from it, look first
  at Smash Ultimate's and Rivals of Aether 2's values; proposals cite both
  (where they exist) and recommend one as the starting point. Tom tunes from
  there. First application: shield release lag, 15 → 11 frames, Ultimate's
  value (#100).
- **Positions are used, not camped** (6 Oct, #103). Platforms are used quickly
  and situationally: to extend a combo or escape a pressure string. A fighter
  sitting on a platform is slightly disadvantaged against one below it;
  advantage comes from leaving a position well (running off and fast falling),
  not from height or from the fastest jump. See "Platforms" below.

## Bounded SDI

Reversible default selected under the owner's authorization, 6 Oct 2026 (#70),
and implemented in smashcraft:ts/src/game/sim/smashDirectionalInfluence.ts.

SDI should change where a hit leaves the defender, with a useful escape choice
in multi-hits, without rewarding ever more inputs with unbounded travel. Count
travel distance, including reversals, rather than distance from the hit's origin.
All distances below are Melee units; one is six world units.

- **Per hit:** at most 12 units total, comprising at most 9 SDI and 3 ASDI.
- **Per uninterrupted string:** at most 24 units total across SDI and ASDI.
  A new contact renews the hit allowance, never the string allowance. A string
  ends after one complete tick in which the defender can act, or on stock loss,
  respawn or match reset. Hitlag, hitstun, grabs and scripted holds (freeze
  traps, the stage cannon, knockdown bounce and jab-reset damage) keep it open;
  a gap between multi-hits while the defender is still held does not renew it.
  The tick that ends hitstun is the first actionable tick, so a hit landing at
  its end still continues the string; the string renews at the start of the
  next tick.
- **Smoothing:** each fresh pulse requests up to the existing 6-unit travel,
  spent in ordered steps of at most 3 units per tick while hitlag remains.
  Reserve up to 3 units of the remaining string allowance for that hit's ASDI
  before admitting SDI requests. Pending requests reserve the remaining hit and
  string allowance, so extra flicks cannot build an unbounded queue. ASDI uses
  the release tick's whole 3-unit step; do not drain queued SDI on that tick.
  Discard unfinished SDI on release or a replacement hit, and release its
  unused reservation. Never continue it into hitstun or ordinary movement.
- **Contacts:** charge each requested step's length before collision clipping;
  walls cannot refill the allowance. Use the existing swept surface contacts,
  grounded non-lifting restriction and blast-zone checks for every step. ASDI
  still prefers the C-stick, can land, and uses the existing non-tumble/tech
  landing rules. Continuous DI still reads the left stick on release and keeps
  its launch-angle rule. Attacker hitlag never admits victim SDI.

The shared string cap also limits ASDI: after 24 units have been spent, a later
hit supplies no positional SDI or ASDI until control returns. This is a deliberate
departure from Melee; reserving ASDI on each eligible hit keeps the held-direction
choice useful before that cap. An ordinary stationary-held direction generates
no repeat pulses. No extra delay is added before the first smoothed step.

At these defaults, a two-frame freeze permits 3 SDI plus 3 ASDI units; a
four-frame or longer freeze can spend the full 12. Two fully spent hits exhaust
the 24-unit string budget. The numerical defaults are ordinary tuning values
and can be revised together without altering the rule.

Each fighter's launch state carries the travel charged this hit and this
string and at most two queued requests (a full pulse and the rest of the hit's
SDI, the most the defaults admit), in Melee units, through snapshots, replay
and rollback. smashcraft:ts/src/game/sim/smashDirectionalInfluence.tests.ts
replays the ten teleport fixtures through the production step: the 20-frame
cases now travel 72 world units (12 Melee units) instead of 702, the three-hit
strings 144 instead of 378 and 2,106, and no tick moves more than 18. The
oracle's "smash DI" rows report Melee's 114 units and 6-unit shifts beside our
9 and 3 under the SDI departure. Native feel remains a later playtest.

The factual baseline is [Melee's defense](design/melee/defense.md#influence-on-knockback)
and [SDI teleports](design/melee/techniques.md#sdi-teleports). The current
unbounded simulation's measurements at build 89abaf3c are retained in
smashcraft:evidence/sdi-design-20261006.json.

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

Accepted measurement targets for #83, following the owner's 6 Oct 2026
authorization to carry out the recommendations. The interaction graph reports
violations to guide balance work; this measurement issue does not rebalance
every move ([interaction graph](design/interaction-graph.md)).

| Target | Accepted | Breaks it |
|---|---|---|
| Guaranteed follow-ups after an opening | at most 2, at every percent | a string of 4 or more hits that no victim choice escapes |
| Guaranteed damage from one opening, by the victim's percent when it lands | at most 30% at 0–99%; from 100%, a guaranteed string may end in a KO | more damage than that before the victim has a choice that escapes |
| Reads for 0-to-death | about 2–3: from 0%, no opening takes the stock with fewer than 2 reads, and each fighter has openings that take it with 3 | a stock taken from 0% with 0 or 1 reads; or a fighter with no 0-to-death path even with 3 reads |

The damage cap is chosen to fit the reads target: an opening and 2–3 reads,
each followed by guaranteed follow-ups worth up to about 30%, bring a victim
from 0% to roughly 90–120% before the last hit.

## Throw regrabs

Implementation choice, 6 Oct 2026 (#85), under the owner's instruction to
implement the suggested defaults: a grab cannot catch a fighter whose current
hitstun came from a throw. Standing, dash and shield grabs share this rule.
When that hitstun ends, grabs can catch again. A follow-up strike can still hit
during throw hitstun; if it replaces the throw's hitstun, ordinary grab
eligibility returns. Damage-only arrows do not replace the throw's hitstun.
A gentle landing keeps the throw's remaining hitstun instead of ending it
early while the victim is still recovering from the landing.

This removes direct throw-to-regrab chains while retaining true throw-to-attack
combos and attack-to-grab reads. It does not grant a timed immunity after control
returns or forbid grabs during ordinary attack hitstun.

## Platforms

Owner decisions, 6 Oct 2026 (#103), implemented in
smashcraft:ts/src/game/sim/platformMoves.ts. Platforms are physical things
fighters contest, not lines they phase through: in real life you climb onto a
platform and climb off it. They replace #51's instant pass-through and the
"Platform shield drop" default, following the principle that positions are
used, not camped.

- **Platform ascent.** When a rising fighter's body meets a pass-through
  platform from below, the fighter ascends it. An attack in its startup or
  active frames carries on through the platform, so its hitbox still reaches a
  fighter standing there: the platform never protects the fighter on top. The
  ascent begins as those frames end, if the body is still in the platform, and
  cancels the attack's remaining recovery; contact during recovery, or during a
  special, ascends at once. Rising into a platform after a hit is a lag cancel.
  A helpless fighter stays helpless. The ascent lasts the fighter's jump squat
  (Archer 3, Rifleman 5, Illidan 4, each hero its own), the honest proxy for
  its agility, and carries its feet from where they met the platform to its top.
  - Rising through is the default: the fighter keeps its momentum, with gravity,
    and leaves the top still rising if it has rise left. Holding jump, or up
    past the stick-up jump threshold (0.6625), sustains the rise with no
    gravity. An up air into a platform hits through it, then its recovery
    cancels into the ascent; a fresh rising up air or another aerial can follow.
  - Down held or pressed during the ascent ends it standing on the platform,
    with no landing lag; still holding down crouches.
  - Shield held or pressed ends it standing on the platform, shielding.
- **Platform descent.** A fresh down on a platform (analog at Melee's
  drop-through speed, or a digital down) lowers the fighter through it over its
  jump squat, until its body is below the platform. The tilt modifier keeps a
  digital down for crouching and down tilts. An aerial, air dodge or special
  pressed during the descent comes out on its first free frame below.
- **Platform wraps.** A half-circle (away from a side, down, then toward it,
  starting within the fighter's jump squat) at airborne contact with a platform
  swings the fighter around its edge toward that side, up to about one body
  width (8 Melee units) and never past the platform's end, facing reversed:
  a cross-up fake-out. During an ascent it wraps over onto the platform,
  standing; on the frame a falling fighter would land, it wraps under the
  platform, still airborne. The wrap lasts the jump squat and is legal only
  toward a side where the platform continues past the fighter. Holding down
  while drifting is not a half-circle, and a fighter standing on a platform
  cannot wrap: down there is a plain descent.
- **No platform shield drop.** Down while shielding does not fall through a
  platform; leaving one goes through a descent.
- Fighters are fully vulnerable, hittable and grabbable, through ascent,
  descent and wraps. With no shield drop, a jump-squat descent and attacks
  that hit through the platform from below, a fighter on a platform is slightly
  behind one below it, as the principle intends. Measured by
  smashcraft:ts/scripts/platformAdvantage.ts (earliest first hit from rest, each
  fighter on a stage 1 side platform with another directly below): across the
  64 pairs of the 8 selectable fighters at #103's landing, the fighter below
  strikes first in 31, level in 10 and later in 23; its test requires the fighter below to
  strike no later in at least 60% of pairs. The trailing pairs are mostly
  Archer, Rifleman and Illidan on top, whose descent plus down air is fastest.
- Presentation: ascent plays the fighter's ledge-climb clip, descent its
  ledge-hang clip and both wraps its ledge-roll clip, each stretched over the
  move (smashcraft:ts/src/game/presentation/fighterClips.ts).

## Grab holds and pummels

Owner direction, 6 Oct 2026 (#101): grabs are legible and never a chore. Melee's
hold grows with the victim's percent, so nobody can tell how many pummels a
grab allows, and every grab invites a pummel chore. Implemented in
smashcraft:ts/src/game/sim/grabs.ts with its values in
smashcraft:ts/src/game/sim/moves.ts:

- **Hold ignores percent.** Every grab holds 90 frames (Ultimate's 0% hold).
  Each mash input, a fresh press or a new stick direction as before, takes 8
  frames off (Ultimate's stick value), but no hold ends before frame 30.
- **Only the throw is guaranteed.** A throw input on any of the first 29 held
  frames starts the throw whatever the victim mashes.
- **One pummel, and it is a read.** Every fighter's pummel connects 48 frames
  after its input and lasts 56; a kit authors only its effect. Pressed on the
  first held frame, it lands on frame 48. A victim pressing 8 times a second
  from the catch escapes on frame 42; 7 a second escapes on frame 43; 6 a
  second escapes on frame 50 and takes it. A victim who doesn't mash takes it.
  After the pummel the grabber throws (a throw pressed during the pummel
  starts when it ends) or the victim goes free.
- **Neutral release.** A mash escape and the release after a pummel leave both
  fighters able to act on the same frame (11 frames later), so a release
  grants no guaranteed follow-up.
- **Escape meter.** Both players see a segmented bar above the held fighter:
  full is the whole hold, it drains each frame and faster with mashing, and
  empty is the escape; its lines split it into 10-frame segments. A mark
  stands as many frames from the empty end as a pummel needs to land: 48
  while the pummel is available, closing in as a started pummel winds up, and
  gone once it has landed. A bar at or short of the mark empties before the
  pummel lands, even without mashing. Implemented in
  smashcraft:ts/src/game/presentation/escapeMeter.ts and
  smashcraft:ts/src/game/ui/escapeMeter.ts.

This departs further than Ultimate, whose hold still scales with percent; see
"Grab hold" in the deviations table.

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
| SDI | Each fresh stick movement during hitlag moves the fighter 6 units, as often as every frame ([case study](design/melee/defense.md#influence-on-knockback)) | Weakened in later games ([SmashWiki](https://www.ssbwiki.com/Smash_directional_influence)) | SDI + ASDI travel capped at 12 units per hit (at most 9 SDI) and 24 per uninterrupted string, in steps of at most 3 per tick ([bounded SDI](#bounded-sdi)) | Keep displacement choices useful while bounding visible jumps and repeated-hit travel | #70 |
| Grab hold | 76 + 1.6 frames per percent, minus 1 a frame and 6 per mash input; pummels repeat while held ([case study](design/melee/defense.md#grabs)) | Brawl onward: 90 + 1.7 frames per percent, 8 per stick mash input (14.4 per button in Smash 4 and Ultimate), never under 19 ([SmashWiki](https://www.ssbwiki.com/Grab)). Rivals 2: one pummel per grab, Attack or Special, broken when the victim presses the same button ([FAQ](https://rivals2.com/faq)); a 60-frame hold animation ([workshop](https://rivals2.com/workshop/?p=389)) | 90 frames at any percent; 8 off per mash input, never under 30; one pummel, connecting 48 frames after its input, then a throw or a neutral release ([grab holds](#grab-holds-and-pummels)) | Legible: the same hold every grab, a visible escape meter, no pummel chore; deliberately further than Ultimate | #101 |
| Horizontal air dodge | The dodge goes where the stick points | – | A horizontal-only digital air dodge angles 18° below horizontal, mirrored, by default and with no toggle | Owner-selected control (30 Sep); the shallow angle keeps horizontal momentum into the landing | – |
| Fast fall | A fresh stick down, diagonals included | – | Down with neutral horizontal input only; down-left and down-right keep drifting | Owner-selected control, 30 Sep | – |
| Air dodge | Directional; ends in helpless fall (FallSpecial) until landing | Ultimate: one directional air dodge per airtime, no helpless fall, refreshed on landing, ledge grab and being hit ([SmashWiki](https://www.ssbwiki.com/Air_dodge)). Rivals of Aether 2: the dodge ends in an ordinary fall ([workshop](https://rivals2.com/workshop/?p=389)) | Once per airtime, ending actionable; refreshed on landing, ledge catch and being hit; spends no jump. Direction, momentum and the wavedash/waveland through landing are unchanged | Owner decision, 6 Oct: the air dodge works as in Smash | #100 |
| Shield release lag | 15 frames (GuardOff) | Ultimate: 11 frames | 11 frames; the 8-frame minimum hold and direct shield grab/jump bypass are unchanged | Owner decision, 6 Oct: Melee's lag makes dropping shield almost never worth it; dropping shield should be a real alternative to jumping into an aerial or rolling out of shield. Ultimate's value is the starting point; tune if it still goes unused | #100 |
| Dodge timing | Per fighter | – | One shared profile: spot dodge 22 frames, intangible 2–15; rolls 31, intangible 4–19; air dodge 49, intangible 4–29, landing 10 | Owner's common frame-data profile | – |
| Powershield | A full press within 2 frames of the trigger moving, while raising the shield: a hit in its first 4 frames does no shield damage and pushes back harder, a projectile in its first 2 reflects. The hit's shieldstun is unchanged, and the common +0x2B8 counter (4 frames) only lets attacks and grabs cut the shield drop short (`ftCo_80092F2C`, `ftCo_GuardOff_IASA`, `ftCo_80094138`); a press during shieldstun is ignored (`ftCo_GuardSetOff_IASA` is empty) | Ultimate: release-timed in the first 5 frames of the 11-frame shield drop; any attack skips the drop lag and acts 3 frames sooner than a block against direct hits; no reflection ([SmashWiki](https://www.ssbwiki.com/Perfect_shield)). Rivals 2: a 4-frame perfect shield plus a separate parry, active 6–13, that stuns the attacker 40–100 frames ([Dragdown](https://dragdown.wiki/wiki/RoA2/System_Mechanics/Defense)) | Melee's raise-timed press, but a parry: no shield damage, no shieldstun, no release lag; any grounded option on the first frame after the hit's freeze, an option pressed during the freeze buffered into it. One press parries one hit; a red parry re-pressed in shieldstun parries the next hit in a 2-frame window. Ground only ([Powershield and parry](#powershield-and-parry)) | A true parry with a clear reward that stays the player's own choice of punish, after Street Fighter III's parry and red parry (owner, 6 Oct) | #102 |
| Platform ascent | A rising fighter passes up through a platform with no change to its action (mpCheckFloor meets a platform only while descending) | Ultimate passes through the same way ([SmashWiki](https://www.ssbwiki.com/Soft_platform)); Rivals 2 not sourced | Attacks hit through it; an ascent over the jump squat cancels the remaining recovery; jump or up sustains the rise, down stands, shield shields, a half-circle wraps over ([Platforms](#platforms)) | Platforms are contested physically; positions are used, not camped | #103 |
| Platform descent | A fresh down falls through at once | Ultimate drops through at once ([SmashWiki](https://www.ssbwiki.com/Soft_platform)); Rivals 2 not sourced | A vulnerable descent over the jump squat; a half-circle onto a platform from above wraps under it ([Platforms](#platforms)) | Leaving a platform is a commitment, so sitting on one is slightly disadvantaged | #103 |
| Platform shield drop | Down while shielding drops through a platform | Removed in Ultimate ([SmashWiki](https://www.ssbwiki.com/Shield_drop)); Project+ keeps it | Removed: down while shielding stays on the platform | Owner (6 Oct): no safe retaliation from a platform; leaving one goes through a descent | #103 |

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

### Expansion roster defaults

Owner decision, 6 October 2026: adopt the 2 October expansion brief as
[the roster specification](design/roster.md). Build Blademaster, Mountain King,
Warden, Lich, Uther, Dreadlord and Shadow Hunter in that order; "shadow shaman"
means Shadow Hunter (Rokhan), and Uther uses the Paladin identity. The eight
Tavern fighters are optional candidates, including Brewmaster; their inclusion
in the specification is not a commitment to ship them.

The specification answers these design questions for the expansion:

| Question | Adopted default |
| --- | --- |
| Physical differences | Use each hero's relative weight, run and air-speed table as initial tuning. The complete candidate table spans weight 0.85–1.28, run 0.80–1.14 and air 0.70–1.12. Jump velocity and gravity initially inherit the reference. |
| Archetypes | State each fighter's purpose and exploitable weakness before building its moves. |
| Meter | 100 mana, full on spawn; ground regeneration at 6/second after 120 frames without spending, while actionable. Specials use their listed costs; normals and grabs are free. Every up special has a weaker free recovery. |
| Cooldowns | Only optional ultimates use cooldowns; ultimates are off in competitive play. |
| Disjoints | Weapon extensions only; attached body parts keep hurtboxes. |
| Throw escape | Mashing; retain the existing escape system and use the brief's fallback only where none exists. |
| Simultaneous grabs | Both break, with symmetric separation and 12 frames of recovery. |
| Regrabs | Today's #85 throw-hitstun restriction, including remaining hitstun after gentle landing; no fixed 45-frame timer. |

These are expansion defaults and authored starting values, not claims that the
existing three fighters have already changed. Preserve existing fighters and
the infrastructure finish line when integrating new gameplay.

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

## Character trade-offs and move evaluation

Evaluation model selected under the owner's authorization, 6 Oct 2026 (#62).
Use the current Archer, Rifleman and Illidan, with jab, down tilt, forward smash,
forward air and down air as the first sample. The numerical baseline is
smashcraft:tools/move-data/gameplay-model.json, derived from the published
move exports, contextual comparisons, interaction graph and retained bot data;
it is an analysis artifact, never gameplay tuning input.

### Numerical identities

These are authored values at d1971253, rounded for display. Run and air speed
are world units per frame. Reach below is the hit capsule's forward extent
relative to its fighter, before adding the opponent's hurt capsule; it is not
an effective range or a guaranteed connection. All three have a 4-frame,
5-damage jab, with 21 unpaused frames total. Down tilt starts on frame 5 and
lasts 28 frames; forward smash starts on 6 and lasts 36.

| Fighter | Weight | Run / air speed | Jump squat | Down tilt damage / reach | Forward smash damage / reach | Down air active frames |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Archer | 75 | 13.20 / 4.98 | 3 | 8 / 145 | 18 / 121 | 20 |
| Rifleman | 80 | 9.00 / 4.98 | 5 | 10 / 145 | 18 / 121 | 3 |
| Illidan | 80 | 11.10 / 5.28 | 4 | 7 / 115 | 15 / 171 | 3 |

Archer pays for the fastest run and jump start with the lowest weight.
Rifleman's down tilt pays more damage at Archer's timing and reach, while his
run is slower and jump start later. Illidan's forward smash reaches farther
but deals less, and his down tilt gives up both damage and reach; his air speed
is highest. These are the strengths and costs to preserve or deliberately
replace when authoring the fighters' original volumes and animations.

### Model and provisional targets

Evaluate a move in a named situation: fighter and opponent, stage, spacing,
percent, grounded/airborne state, timing, and DI/defensive policy. The definitions
of frame advantage, reachable punishment and weighted choices come from
[fighting-game design](design/fighting-games.md#frame-advantage-safety-and-punishes)
and the [interaction graph](design/platform-fighters.md#the-interaction-graph).

- **Option count N:** group inputs by their ordered outcome against every
  tested response (winner, hit/grab/none, blocked). Count distinct groups;
  keep timing and damage alongside them. The neutral mirror fixtures offer
  13 inputs each, but N is 8 at distance 60 for all three, and 6/6/7 at 120
  for Archer/Rifleman/Illidan. This is a coarse sampled distinction, not a
  count of all strategic choices. Provisional target: at least three distinct
  patterns in each ordinary neutral sample, with each attacking choice denied
  by a reachable block, evasion or counter in that named situation.
- **Punish window P:** retain the exact set of start frames that land before
  the target can act, and its longest contiguous interval. Do not turn holes
  into a continuous window or infer a punish from negative advantage alone.
  Close advancing down air is -8/-10/-8 in the three mirror fixtures; jump
  neutral air and jump back air each punish from frames 12 and 13. Spaced
  fade-back forward air is -2 for all three and has no tested reachable punish.
  Of the 30 aerial/shield variants per fighter, 19/19/20 have no tested punish.
  Preserve the spacing-dependent safe/unsafe distinction rather than making
  every aerial uniformly safe or unsafe.
- **Reward and risk:** use direct damage R on a successful named hit and
  damage C from a specified reachable punish, then report R/C and the binary
  break-even success probability C/(R+C). Keep stock loss, follow-up situation
  and escape choices separate; do not convert them into invented damage points.
  If no tested punish reaches, C and the ratio are unknown, not zero/infinity.
  Provisional target: extra reward pays in an observed cost (commitment,
  exposure, fewer safe spacings or a stronger punish), not merely a slower
  number whose consequence no opponent can exploit.

In the grounded first-active, spacing-60, 0% contact fixture against Rifleman,
Illidan's forward smash deals 15 and is -6 at the normal-action gate after
shield release. An approaching Rifleman jab starts at 32 and hits at 36 before
Illidan acts at 37: a 5-damage cost, R/C = 3, break-even 25% for precisely that
binary branch. Archer and Rifleman deal 18 and are -4; no tested jab reaches
before recovery, so their ratios remain unknown. These comparisons are not
the mirror fixture's earliest out-of-shield gate or a full payoff matrix.

### Predictions and the role of bots

The existing fixtures make three falsifiable predictions for this sample:
Archer's long-active down air remains punishable at close advancing spacing
while his spaced fade-back forward air is safe against the tested responses;
Rifleman's stronger down tilt produces 18 hitstun frames against weight 100
versus Archer's 17 at the same timing and reach; Illidan's longer-reaching
forward smash still permits the specified shield-release jab punish. Evaluate
any proposed change against these named rows with the existing move and
interaction commands, then retain its before/after effect on N, P and R/C.

The retained post-down-tilt 540-match bot run supplies historical context:
CPU-versus-fuzz wins were 118/120, 120/120 and 116/120, and damage per landed
hit 8.86, 7.03 and 8.32 for Archer, Rifleman and Illidan. Repeated deterministic
CPU setups are not independent samples. The Rifleman change moved 118 to 120
wins, while two unrelated fuzz matches also changed; that run did not resolve
a balance effect. Its policy, stages and revision are named in
smashcraft:evidence/rifleman-down-tilt-20261006/README.md. Later gameplay changes
mean these are historical observations, not present balance, human win odds,
or a complete formula for fun. A playable change and its relevant bot/geometry
measurement remain the acceptance work in #62 after #61.

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
| Red parry (re-press in shieldstun) | 2 | 4 | 2 |
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
short-hop release, parry, powershield, red parry and ledge windows against
these ranges. Interaction timing checks apply the reaction, required-link and
precision rules to authored situations. No current move is designated a
required link or guaranteed reaction option; the graph's existence of a punish
is not a claim that a human can react to it.

## Shared mechanic defaults

Delegated choices, 6 Oct 2026 (#62): the owner authorized carrying out the
recommended defaults without another approval round. The remaining questions
from the descriptive references are resolved below. Existing explicit owner
decisions, the expansion roster contract and the #85 throw-hitstun rule take
precedence over older proposals. These are authoring defaults; recording one
does not imply its implementation or balance has been checked.

### Attack geometry and commitment

The descriptive basis is [fighting-game language](design/fighting-games.md),
[platform-fighter language](design/platform-fighters.md) and
[Melee's attacks](design/melee/attacks.md).

| Question | Adopted default | Reason |
|---|---|---|
| Attack hurtboxes and fidelity | Author deterministic per-frame body volumes from the verified animation pose, including extended limbs during startup, active frames and recovery. Weapons can extend without a hurtbox; attached hands, feet, wings and tails cannot. | Make visible exposure and whiff punishment agree; implements #62's animated-hurtbox direction and the roster's weapon-only disjoints. |
| Hitbox generosity | Match the visible strike's path and outer extent. Use its authored capsule thickness, without an extra invisible range bonus or a solid volume filling an entire swing. | Spacing must be readable; the roster already states this geometry contract. |
| Disjoint cost | Keep weapon-only disjoints. Pay for extra effective reach with an observable cost in commitment, body exposure, safe spacing or punishability; do not require one universal startup tax. | Reach matters through whole interactions, as the character-evaluation model above measures. |
| Counter hits | No new universal bonus for hitting startup. Preserve explicitly authored vulnerabilities, including the existing interrupted-smash-charge modifier. | Predictable move outcomes; no random critical hits or hidden universal damage layer. |
| Knockdowns | Ordinary knockdowns retain tech or missed-tech/get-up choices. Authored forced states, such as jab-reset stand and freeze, remain explicitly marked by the locked-state signal. | Preserve real defensive choices without pretending that a forced interval can be escaped. |
| Invincible reversals | No universal action that clears hitstun or knockdown. A kit can have stated armor or intangible frames after its action becomes legal, with punishable failed commitment; keep the roster's defensive limits. | A defensive read can have value without bypassing the opponent's earned hit. |
| Same-frame strikes and clanking | Resolve valid fighter strikes symmetrically as trades from the same pre-contact state. Add no universal 9%-difference clank rule; any move-specific clash or projectile interaction must be explicit. | Preserve the established simultaneous-contact model instead of adding an unseen priority system. |
| Grab versus strike; mutual grabs | Preserve the existing grab-over-strike contact priority. Mutual grabs break symmetrically, with the roster's 12-frame recovery. Throw-hitstun regrabs remain forbidden by #85. | Make the interaction deterministic and retain the adopted throw counterplay. |
| Throw defence | Existing mash escape; no new timed throw-tech input. Once an immediate throw has started, only the release-frame DI choice remains, as the locked-state signal explains. | The expansion contract preserves the existing escape system and true throw-to-strike follow-ups. |
| Grab hold and pummel | Every hold lasts 90 frames at any percent; each mash input takes 8 off, never below 30. One pummel per grab, connecting 48 frames after its input; then a throw (bufferable) or a neutral release. Both players see the escape meter above the held fighter ([grab holds](#grab-holds-and-pummels)). | Owner direction (#101): the throw is the guarantee, the pummel a visible read, and no grab is a chore. |
| Option selects | Keep combinations that retain commitment and an opponent answer. Repair a specific option select when it removes both branches' counterplay for free; no blanket ban on emergent input combinations. | Judge the actual interaction, not the mere existence of a multi-purpose input. |
| Mixup branch reward | Each intended branch must offer a meaningful different result or punish. Use its measured reward/risk and break-even probability; no universal damage floor for the weaker branch. | A position, escape or stock threat can matter without an invented damage-equivalent score. |
| Balance changes and archetypes | State each fighter's purpose and exploitable weakness, then adjust the evidenced interaction with buffs or nerfs as needed. No buff-first rule or universal "no 7–3" numerical promise. | Preserves the adopted roster identities and the current bounded evaluation model. |

### Shields and defence

| Question | Adopted default | Reason |
|---|---|---|
| Shield geometry | Keep the shrinking bubble (confirmed by #102): it drains while held (0.28 health a frame digitally), regenerates once lowered (0.07 a frame), and its radius scales with health (0.15 + 0.85 × health/60 × pressure scale), so a worn shield exposes the body to a projectile passing outside it. Melee contacts on a raised shield are all blocked; melee pokes are not modelled yet. Preserve the authored shield centre and current input handling; add no required shield-tilt input. | Keep the established shield system and visible body exposure rather than replacing it with a fixed bubble. |
| Aerial shieldstun | Keep the shared ground/aerial formula. | Aerial safety already varies through contact timing, landing, spacing and drift; no separate universal aerial multiplier is needed. |
| Whiff penalties | No global extra miss-only recovery or landing-lag multiplier. Author commitment and recovery per move. | Counterplay should follow the same visible move phases whether the strike connects or misses. |
| Ground moves on shield | Close committed moves should have reachable punishment; spaced pokes may be safe. In the same shield-contact context, greater shield damage costs later attacker recovery or an earlier defender response. | Adopts smashcraft:docs/move-comparisons.md's measured category rule without changing its gate; it is not a global damage-to-lag formula. |
| Aerials on shield | Preserve late-contact, immediate-landing and fade-back safety; close advancing aerials can be punished. | The existing graph distinguishes close down air from spaced forward air. Do not make all aerials uniformly safe or unsafe. |
| Shield release and out-of-shield actions | Owner decision (6 Oct, #100): 11-frame release lag, Ultimate's value, with the 8-frame minimum shield hold. Direct shield grab and jump bypass release lag when otherwise legal; jump into aerials, rolls and spot dodges remain available. Add no instant grounded up-smash cancel. | Melee's 15 frames make dropping shield almost never worth it; dropping shield should be a real alternative to jumping into an aerial or rolling out of shield. Tune later if it is still never used. Shieldstun and other action locks still apply. |
| Platform shield drop | Removed (owner, 6 Oct, #103): down while shielding stays on the platform. Leaving a platform goes through a [platform descent](#platforms); shielded fighters use their jump, dodge or release choices. | Superseded: no safe retaliation from a platform, so a fighter on one is slightly behind one below. |
| Cross-ups | Coverage follows each move's authored front/back regions and legal facing change. No automatic tracking or universal behind-the-fighter hit extension. | A cross-up changes which responses reach; the answer comes from the move, not hidden target tracking. |
| Powershield and dedicated parry | The raise-timed powershield, with the accepted 2-frame input window and its projectile reflection, is a true parry: no shieldstun and no release lag, any grounded option on the first frame after the hit's freeze ([Powershield and parry](#powershield-and-parry), #102). Ground only. Counters stay per-fighter specials such as Illidan's parry; add no universal parry button or release-timed replacement. | One shared, learnable timing whose reward is the defender's own punish, kept apart from the committal counters a kit can author. |

### Movement, recovery and resources

| Question | Adopted default | Reason |
|---|---|---|
| Air dodge | Owner decision (6 Oct, #100): one directional air dodge per airtime with the shared frame profile. It ends actionable, not in helpless fall, and spends no jump; landing, catching a ledge and being hit refresh it. | Works as in Smash; once per airtime still prevents repeated free dodges, and wavedash movement is unchanged. |
| Wavedash and waveland | Keep air-dodge momentum through landing and the 10-frame dodge landing lag, including the owner-selected shallow digital angle. | An interactive movement option, unlike the removed L-cancel chore. |
| Offstage air-dodge buffering | Do not add a general held-input air-dodge buffer. Retain fresh dodge presses and the deliberate dodge press queued during jump squat; a fresh offstage press still works when legal. | Avoid accidental automatic dodges while preserving explicit player commands. |
| Platforms | Ascent, descent and wraps last the fighter's jump squat and leave it vulnerable; no shield drop ([Platforms](#platforms)). | Positions are used, not camped (owner, 6 Oct, #103). |
| Short hop and jump squat | Keep release-during-squat short hops, without a jump+attack macro or a new mandatory binding. Jump squat remains per fighter within #69's 3–5 frames: Archer 3, Rifleman 5, Illidan 4. | Preserves current controls and physical differences inside the accepted execution bounds. |
| Input buffer and priority | Keep the 6-frame human attack grace. Same-frame attack requests prefer grab, unchargeable C-stick smash, chargeable smash, tilt, then the established style ordering; conflicting equal requests leave facing neutral. Existing action locks and fresh-input rules remain authoritative. | Deterministic input intent without a new universal hold buffer or callback-order priority. |
| Wall movement | Keep existing wall tech and authored wall-jump eligibility. No wall climbing or free refresh of jumps, recovery specials or ledge protection. | Movement should respect the visible stage walls without granting an unlimited recovery loop. |
| Ledges | Keep exclusive occupancy/edgehogging, first-frame catch intangibility of 30 frames and the 30-frame regrab lock. No trump or extra two-frame catch vulnerability. | Retains the current Melee-derived ledge system within #69's accepted bounds. |
| DI, crouch and ASDI | Retain 18° maximum continuous DI rotation, crouch cancelling and ASDI-down landing behaviour. SDI/ASDI travel uses the selected bounded-SDI design when #70 is implemented. | Keep useful defensive positioning while addressing teleport distance at its chosen seam. |
| Tech chases and platforms | Preserve current floor-tech and tech-roll timing on the surface actually contacted; pass-through platforms catch from above and do not become walls or ceilings. Extensions can require reads; only call a response reaction-based when its visible cue meets #69's budget. | Gives platforms a real escape/landing role and supports the short-combo, chained-read direction without promising a guaranteed human reaction chase. |
| Launchers and recovery routes | Each fighter has at least one deliberate launcher into a juggle, tech chase or ledge situation and at least two meaningfully different recovery choices through path, drift, ledge/stage destination or timing. A second recovery special is not required. | Makes follow-up reads and offstage counterplay part of each kit; the roster already requires a weaker free recovery. |
| Physical spread and dash dancing | Keep existing per-fighter gravity, fall/air/run speed, weight and initial-dash windows; retain dash dancing. Expansion fighters use the adopted relative-property table as starting tuning, with reference jump velocity/gravity until deliberately authored otherwise. | No forced common weight/speed profile and no heavy-must-be-slow rule; each strength needs its stated cost. |
| Rage, meter and cooldowns | No percent-dependent rage bonus. Expansion mana and free recovery use the adopted roster contract; no new common meter or cooldown on ordinary specials. Optional ultimate cooldowns stay off in competitive play. | Predictable knockback and explicit resources, consistent with the removed stale/freshness layer and adopted expansion defaults. |
| Interaction-graph requirements | Use the existing contextual option-count, reachable-punish and reward/risk model above, plus #83's accepted combo targets. Keep distinct defensive answers in ordinary neutral; do not impose one payoff ratio or option count on every forced state. | A locked interval can be honest, while an ordinary neutral option needs a reachable counter. The measured sample is not a guarantee about every matchup. |

## Stage defaults

Delegated choices, 6 Oct 2026 (#75), reconciling the owner's stage direction,
the [stage research](design/stages.md) and the published themed catalog.
Tournament labels below are a proposed competitive preset, not a claim of
external tournament adoption or proven matchup balance.

| Question | Adopted default | Reason |
|---|---|---|
| Flat stage | Keep Sky Deck accessible as the clearly labelled test/practice tile after the eight themed stages; exclude it from the ranked competitive list. | Matches the owner's testing use without promoting the flat arena as the default competitive choice. |
| Moving platforms | Their deterministic movement remains enabled in competitive play. | The owner explicitly welcomes drifting and independently patrolling platforms. |
| Starters and counterpicks | Start with Frozen Throne, Hellfire Citadel, Durotar Skies and Naxxramas; use Nordrassil, Gryphon Aerie, Blackrock and Ahn'Qiraj as counterpicks. | Stable or broadly familiar layouts lead; wind, tight carried-platform play, cannon recovery and timed platform relief provide deliberate matchup variation. |
| Static versus hazardous | Keep both. Frozen Throne and Hellfire Citadel are mechanically static; blizzard, embers and background motion are cosmetic. | The owner asks for light learned hazards, not a hazard on every stage. |
| Hazard effects | No incidental hazard damage. Wind and platforms can move fighters; Blackrock's readable recovery cannon can launch them. Fixed schedules and visible routes remain learnable. | Preserves the requested wind, Randall-like platform and barrel without random chip damage. |
| Blast zones and size | Use the published #80 per-stage bounds; keep new competitive layouts within the researched Melee legal size band as a starting point. Keep Blackrock's cannon on its normal-size deck, not Kongo Jungle's oversized camping layout. | The earlier overly tight blast zones are superseded; legal-band dimensions are a starting design choice, not proof of competitive balance. |
| Race/theme spread | Keep Hellfire Citadel, the Burning Legion stage, in place of Ring of Valor. Preserve Frozen Throne and representation for Human, Orc and Night Elf alongside Scourge and raid themes. | Adopts the research's variety recommendation and the already published catalog; no additional Naga stage is required. |
| Graphics | Support the installed classic-graphics clients with available classic models/skies and authored effects. HD-only scenery is optional future art, never required for these stages to read correctly. | The actual test clients must see the intended arena. |
| Ahn'Qiraj platform art | Keep the authored rising platform in a Qiraji/Obsidian Statue scene. Do not describe a built-in substitute as a tentacle; a bespoke animated tentacle is not required for the current platform mechanic. | The research found no available tentacle model; the current themed platform gives an honest supported default. |
| Competitive list size | Eight themed stages, in the published order: Frozen Throne, Nordrassil, Gryphon Aerie, Durotar Skies, Naxxramas, Hellfire Citadel, Blackrock, Ahn'Qiraj. | Fits the owner's 5–8-stage scope and the accepted variety proposal. |

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

## Legible hurtboxes

Delegated choices, 6 Oct 2026 (#97), under the owner's instruction that
correct play should win: spacing that is right by every visible cue must not
lose to a hurtbox the player could not see. The mechanisms behind Ultimate's
"played right, still lost" reports, and Melee's comparable cases, are in
[hurtbox legibility](design/hurtbox-legibility.md). Authoring is described in
smashcraft:docs/hurtboxes.md.

1. **One body outside attacks.** Standing, idle, walking, dashing, running,
   jumping, falling and shielding all use the standing body; only crouch,
   attacks and specials author others. No idle pose, animation timing or
   random draw ever selects a body.
2. **Connected.** Every part of every body touches its first part (the torso)
   directly or through other parts: no floating hurt volumes.
3. **Held poses.** Every authored pose lasts at least 3 frames, and an
   attack's or special's poses do not overlap and end within the move. A
   gap between poses returns to the standing body, and counts as a change.
4. **Bounded steps.** One change of body (entering the move, pose to pose,
   returning to standing) moves the body's front, back, top or bottom extent by
   at most 60 world units (10 Melee units, about one standing body width plus
   a quarter). A longer reach ramps through intermediate poses.
5. **Protection where the strike is.** An intangible or invincible part
   touches one of the same move's hit regions: protection belongs to the
   striking limb, never to a hidden torso or head.
6. **Touching is hitting.** Any overlap of a strike and a normal part,
   tangency included, is a hit: no glancing-blow or phantom band. A strike's
   tested volume is its authored capsule on that frame, never a chord swept
   from the previous frame.
7. **Judged on the shown frame.** A contact is resolved against the pose both
   fighters show on the contact frame, from the same pre-contact state for
   both; no zoom or slowdown replays the hit in a different pose.

Rules 1–6 are checked on every fighter's authored bodies, the original three
and each registered hero, by smashcraft:ts/src/game/sim/hurtboxLegibility.tests.ts. A fighter that needs
to break a rule lists a named departure there and in this section, with its
reason. Current departures: none.

## Powershield and parry

Delegated design, 6 Oct 2026 (#102), under the owner's direction that the
shield stays Smash's slowly shrinking bubble and a powershield becomes a true
parry with a clear reward; the owner added Street Fighter III: Third Strike's
parry strings and red parry the same day, and decided against an air parry.
Ultimate's and Rivals 2's parries are cited first and Melee's from the
decompilation in the deviations table above; Third Strike's rules are in
[fighting-game design language](design/fighting-games.md#parries-street-fighter-iii-third-strike).
The starting point is Ultimate's reward, any option with no shield-drop lag,
taken further to no shieldstun so the defender acts on the next frame, as the
owner asked. Rivals 2's stun on the parried attacker is not adopted: it pays
out automatically, which is what counter specials are for (below). The input
stays Melee's raise-timed press, so a parry is a read of the hit's timing.

1. **The shield.** The bubble drains while held, regenerates once lowered and
   shrinks with its health, as the Shields and defence rows above record.
2. **Parry timing.** A full shield press within 2 frames of the trigger first
   moving, while raising the shield, opens the parry: a melee hit in its first
   4 frames, or a projectile in its first 2 (which reflects, rule 1 of
   [Projectiles and powershield](#projectiles-and-powershield)), is parried.
   An unshielded fighter presses on the hit's frame or up to 3 frames before.
3. **The reward.** A parried hit does no shield damage and no shieldstun. Its
   freeze (hitlag) still plays, and on the freeze's last frame, the first the
   defender can act on, it can start any grounded option: jab, a tilt, a
   smash, shield grab, a jump into any aerial, either roll, a spot dodge, or
   simply drop the shield, all with no release lag. An option pressed during
   the freeze is buffered into that frame: an attack keeps its buffer through
   the freeze, a jump or ground dodge is held for it. A parried projectile
   gives the same reward from the next frame. The reward lasts while the
   shield stays held for 4 frames (Melee's `+0x2B8` counter); holding it
   longer spends it, and dropping the shield then costs the ordinary release
   lag.
4. **One press, one hit.** A press parries one hit or one projectile and its
   window closes. Each hit of a multi-hit move and each projectile of a stream
   needs its own timed press: drop the shield (free after a parry) and press
   again. An ordinary block anywhere in the string ends the reward and takes
   that hit's shieldstun, so parrying every hit gives the reward after the
   last one, as Third Strike's parried supers do.
5. **Red parry.** In shieldstun from an ordinary block, a fresh full press (let
   go of the shield and press it again; the shieldstun holds it up) parries the
   next hit if it lands on the hit's contact frame or the one before: a 2-frame
   window. Success clears the shieldstun and gives the same reward. One try
   per blocked hit: a second press in the same shieldstun does nothing, so
   mashing earns nothing. Why 2 frames: tighter than the parry's 4, as Third
   Strike's red parry is tighter than its parry, and at #69's lower bound for
   an optional powershield; 1 frame would be an unaided one-frame input,
   below every bound #69 accepts.
6. **Ground only.** There is no air parry (owner, 6 Oct): it would make every
   aerial approach a guess. Shields and parries are ground tools; airborne
   defence is the air dodge and a fighter's counter specials.

### Powershield versus counter specials

Melee keeps the universal powershield apart from per-character counters
(Marth's and Roy's Counter), and Smashcraft keeps that split:

| | Universal powershield | Counter specials |
|---|---|---|
| Who | Every fighter, through the shared shield | Fighters whose kit authors one: Illidan's parry (Parry Step), Uther's Divine Guard (#96) |
| Input | The ordinary shield press, timed | A special move |
| Commitment | None beyond the shield: a press that parries nothing is an ordinary shield | Startup, a counter window and recovery; a whiff is punishable |
| Reward | No shieldstun or release lag and next-frame action with the defender's own grounded option, which can still be the wrong choice | An automatic strike or effect authored by the move, such as Parry Step cancelling the attack and launching the attacker |
| Against strings | One press per hit; the red parry rejoins a string | The move's own window |

The powershield never strikes back on its own: the punish is the defender's
choice and execution. A counter is a committed read with an automatic payoff
and a whiff punish.

## Projectiles and powershield

Delegated choices, 6 Oct 2026 (#98), under the owner's direction that
projectiles create pressure without making play safe, spammy and boring, and
that a practised player can powershield on purpose. Ultimate's and Melee's
projectile properties are described in [projectiles](design/projectiles.md).

1. **Powershield reflects.** Raising the shield so its reflector is up when a
   traveling projectile arrives reflects it back at its shooter, at 0.7 speed
   and half damage, now owned by the reflector. The reflector is up for the
   shield's first 2 frames, inside #69's accepted 2–4. Every traveling
   projectile is reflectable; only persistent zones, puddles, markers and
   summons are not (the roster contract), and a held shield blocks those.
   A reflection is a parry: the defender acts from the next frame with no
   shieldstun or release lag, and each projectile of a stream needs its own
   press ([Powershield and parry](#powershield-and-parry)).
2. **Unsafe up close.** Fired point blank into a held shield, every
   projectile is punishable: some out-of-shield option of the defender lands
   before the shooter can act. At range a projectile may be safe by distance;
   rule 5 covers that.
3. **Few at once.** A fighter has at most 3 traveling projectiles and 2
   persistent objects out at once (the roster contract); a cast beyond the
   cap fails before spending mana.
4. **Short flights.** A traveling projectile lives at most 90 frames.
5. **A counterplay option in every projectile situation.** Against each
   projectile at every tested spacing, the defender has at least one option
   other than holding shield that avoids it: a powershield, a jump, a dodge
   or a roll. The interaction graph's projectile situations show which.
6. **Out-of-shield answers for every fighter.** Every fighter keeps shield
   grab, jump out of shield into any aerial, both rolls, spot dodge and the
   raise-timed powershield; no fighter trades one of them away.

The headless checks measure every fighter's projectiles, the original three
and each registered hero's, against rules 1–5; rule 6 is checked from the
interaction graph's out-of-shield options. Any departure is named here with
its reason.
