# Balance

Tom's balance spec (8 Oct 2026). Every number here is an **initial value
Tom tunes**; the code holds each in one constant, `BALANCE_SPEC`,
`PUNISH_RESET_FRAMES`, `DISADVANTAGE_FRAMES` and `SCORE_WEIGHTS` in
smashcraft:ts/scripts/balance.ts, and smashcraft:ts/test/balance.test.ts
checks this doc states the same values. Changing one changes the code, the
test and this doc together.

## Philosophy

- Balance is an optimization toward Tom's taste written as numbers, not a
  playtest loop. The numbers are the win band, each fighter's play-style
  profile, move variety, the spam probe and conversion targets below.
- A fighter may not reach the 45-55% band through a degenerate strategy.
  A little signature-move dominance is fine (Jigglypuff's back air in
  Smash), but the game must not collapse into one-move spam. An offensive
  fighter spamming back air is a red flag.
- Each fighter plays its archetype: a rushdown fighter (Captain Falcon)
  leans on forward, neutral and down air and approaches; a zoner uses back
  air, retreats and projectiles.
- Gameplay is explosive: at high-level play a stock falls to about 3-4
  openings by Slippi's count, about 1.5-2x as explosive as master-level
  Melee (edgeguard mixups are part of why); about 2 is fine for a fighter
  whose design calls for it, never anywhere near 10, and a few correct reads
  can take a stock from zero.
- Playtests calibrate the profiles; they are not the primary engine. What
  Tom notices in play becomes a change to a profile or a threshold, and the
  tools then hold every fighter to it.

## Gate

A fighter is **balanced** only when all gates hold, with both computers at
Wren Expert:

| Rule | Initial value |
| --- | --- |
| Win rate against the field | 45% to 55% |
| Each matchup at 400 matches a pair | 30% to 70% |
| Defining archetype traits | inside the profile ranges below |
| Kit values | within the frozen baseline bounds below |
| Feel | block advantage keeps its sign; kill percent within ±15% of baseline |
| Spam probe win rate against the Expert field | at most 45% |
| Largest single move's share of the fighter's damage | at most 40%, except its signature move |

The win-rate rule is the roster's existing gate (smashcraft:docs/design/roster.md,
"Balance gate"). A **signature move** is named by the
`signature: MOVE PERCENT` line of the fighter's play-style profile in its
own design doc; that move may carry up to that share of the damage, every
other move stays under the ceiling. Only a design doc names a signature
move, never the measurement.

The full-roster `bun wisp farm balance` run prints the verdict as
"Balanced (win band, spam probe, move share, matchup, archetype, fixed baseline, feel): passes" or "fails" with each
failing fighter, rule and number; a Wren Expert run at 400 a pair fails the
run when either this or the win-rate gate fails.

## Spam probe

Each fighter's spam probe takes its top damage move from the same run's
field (the move that dealt the most of its damage) and plays the Expert
field attacking with that move only: the ordinary Expert computer moves,
shields, dodges and recovers (an up special offstage stays), but every other
attack, special, get-up and ledge attack it chooses is dropped. The move is
pressed whenever it reaches, a grounded fighter runs toward its target
until it does, and an aerial is jumped for near the target
(smashcraft:ts/scripts/spamPolicy.ts). It plays every other fighter, both
orders on every soak stage, 40 matches a pair (800 a fighter, a 95% interval
of about +-3.5 points), in the same farm run as the field.

## Field report

Beside each fighter's win rate the field prints, from the simulation state
read after every frame (deterministic for a given commit and seed):

- **Damage and stocks by move.** A hit is credited to the move the
  attacker's body was striking with (a grab hold or throw is the grab, a
  running special its slot), else to the last move it started (projectiles,
  summons, placed objects). Jab strings count as the jab, angled forward
  tilts as the forward tilt. A stock is credited to the move of the last
  hit; self-destructs are no one's. Top move share and top-2 share are of
  damage dealt.
- **Move variety:** the normalized Shannon entropy of moves started over the
  18-move kit (jab or shot, three tilts, three smashes, dash attack, grab,
  five aerials, four specials): 1 when every move is used alike, 0 for one
  move.
- **Play style:** each aerial's share of aerials started, aerials over
  normals started, frames moving toward the opponent over frames moving
  (while able to act), the ranged share (damage dealt while the body struck
  nothing) and each special's share of moves started.
- **Openings and punishes**, below.

## Openings and punishes

Slippi's conversion statistics are the reference
([slippi-js stats](https://github.com/project-slippi/slippi-js/tree/master/src/stats)).

- A **punish** starts with a hit and lasts until the opponent has spent
  **45 frames** in control, grounded and actionable (out of hitlag, hitstun,
  a hold, tumble and the floor), without being hit (`PUNISH_RESET_FRAMES`,
  Slippi's `PUNISH_RESET_FRAMES`), or loses the stock. Being hit or held
  restarts the count; actionable in the air pauses it.
- A punish is an **opening** when it leads somewhere: a second hit lands
  within it, or its hit leaves the opponent in a disadvantage state:
  knocked down or tumbling, on the ledge, off the main deck, or unable to
  act for at least **30 frames** (`DISADVANTAGE_FRAMES`). Any other lone hit,
  projectile or melee, is a **poke**: it isn't an opening, and its damage
  counts as poke damage.
- An opening is a **neutral win** when the opponent wasn't punishing the
  fighter at the time (otherwise a counter-attack). A neutral win
  **converts** when it lands a second hit.
- A **zero-to-death** is a stock taken by one opening that began at that
  stock's first hit.

Reported per fighter, over **kills ending an opening** (Slippi's kill
count): openings per kill by **Slippi's count** (every punish, pokes
included) and **pokes excluded**, the **one-hit share** of punishes, pokes
per kill and poke damage per kill, damage per opening (the average combo's
damage), the share of neutral wins converted, combo hits (average and
most), the most damage in one combo and the zero-to-death share of those
kills. A combo here is an opening's hits.

**Reference.** slippi-js stats on 1,345 master-versus-master ranked Melee
games (Fox, Falco, Marth, Sheik, Jigglypuff, Captain Falcon and Peach
mains; measured for this spec on 8 Oct 2026): about **5.9 openings per kill**
by Slippi's count (Captain Falcon 5.3 to Falco 6.5), about **3 multi-hit
openings per kill** (2.4-3.8), about 21% damage per opening (30-34% for a
multi-hit one) and a one-hit share of about 48%.

**Targets (Tom, 8 Oct)**, about 1.5-2x as explosive as that Melee:

| Measure | Target |
| --- | --- |
| Openings per kill, Slippi count: 3-4 | `slippiOpeningsLow`, `slippiOpeningsHigh` |
| Openings per kill, pokes excluded: 2-3 | `openingsLow`, `openingsHigh` |
| One-hit share of punishes | flagged (!) above 50% (`oneHitWarn`) |

About 2 by Slippi's count is fine where a fighter's design calls for it (its
profile's `openings-per-kill`); far above 4 is the failure. The Slippi-count
target applies to **combo potential**, measured by the combo search
independent of computer skill; the field's realized rates show whether the
computers actually convert, and are reported, not scored.

## Combo potential

`bun wisp combos [--fighter NAME]... [--jobs N]` measures the fighter's
available punish rather than its computer player's choices. It plays ordinary
controller inputs through the match frame executor. Each of 21 fighters is
measured against Murloc, Rifleman and Cairne (light, middle and heavy bodies)
at the centre and ledge of stage 0: 126 units. Every landing opener is searched
at 0–180% in 10% steps and five held DI directions: out, up, down, in and none.
The defender's result is the least damaging of the attacker's best routes
against each DI, preferring a route that escapes a KO.

The search saves each contact state and tries grounded, dash, hop, drift and
double-jump follow-ups. It retains four routes at each of eight depths. Attack
presses cover the first six available frames individually and later frames at
two-frame intervals. A link must hit before the defender's first free frame;
a tumble landing ends the true combo because it offers a tech. Offstage flight
is played with the defender jumping and using up special toward the stage.
The search is finite; the table reports the routes it found.

A conversion begins with the best searched opener at the grid percent at or
below the current damage. True links count together. Up to two best reads of
the four tech outcomes may continue that conversion, because a tech chase
does not provide the 45 grounded actionable frames that end a Slippi punish.
Otherwise the next setup begins a new conversion; this models separate neutral
wins rather than playing a complete neutral exchange. Repeat from 0% until a
KO or 12 conversions. A `+` marks any fighter with an unfinished chain.
The target is 3–4 conversions by Slippi's count and 2–3 conversions with two
or more hits. The separate read count charges each tech read as another opening.

The table includes maximum true damage, median best punish damage across
0–120% and six opponent/position units, median kill-confirm percent, mean
openings per kill, multi-hit openings, openings counting reads and damage per
opening. The command writes detailed units to `tools/move-data/combos/units.jsonl`
and the roster table to `tools/move-data/combo-potential.json` and `.md`.
Every retained opener route is replayed from a fresh match; any changed damage
or stock result fails the command. Route playback also runs in Bun and Lua32,
and a seeded Wren match checks that the explorer finds an observed true follow-up.

## Play-style profiles

Each fighter's design doc (its own doc, or its section of
smashcraft:docs/design/roster.md) ends its identity with a "Play-style
profile" holding one fenced `balance-profile` block. They are Tom-tunable
drafts written from the design docs and kits on 8 Oct; playtests calibrate
them. Keys, percentages as LOW-HIGH ranges:

| Key | Meaning |
| --- | --- |
| `fighter` | the fighter's slug |
| `archetype` | rushdown, zoner, bait-and-punish, heavy, grappler, setplay or all-rounder |
| `aerials` | each aerial's share of aerials started: `nair`, `fair`, `bair`, `uair`, `dair` |
| `air-share` | aerials over normals started |
| `approach` | frames moving toward the opponent over frames moving |
| `ranged` | share of damage dealt while the body struck nothing |
| `specials` | each special's share of all moves started (`neutral`, `side`, `up`, `down`), from the fighter's design, not cross-roster norms |
| `variety-floor` | optional; the move-variety floor, 0.55 by default |
| `top-move-ceiling` | optional; the largest move's damage share, 40 by default |
| `signature` | optional; `MOVE PERCENT`, the signature move and the damage share it may carry |
| `openings-per-kill` | optional; the fighter's combo-potential target by Slippi's count, 3-4 by default |

smashcraft:ts/scripts/balance.ts reads every block under docs/design/; a
fighter without one is scored without profile terms, and the tests require
one for every selectable fighter.

## Balance score

Each fighter's score is a weighted sum of distances outside its targets, in
percentage points (openings in openings); 0 meets every target. The field
report prints the total and each term.

| Term | Distance | Weight |
| --- | --- | ---: |
| Win | outside 45-55% | 1 |
| Profile | summed over every profile range missed | 0.5 |
| Variety | below the variety floor (x100) | 1 |
| Top move | above the top-move ceiling, or the signature move's allowance | 1 |
| Probe | spam probe above 45% | 1 |
| Openings | potential openings per kill (Slippi's count) outside the profile's range (default 3-4) | 10 |
| Recovery | recovery envelope outside the roster band | 1 |

**Slots for other tools.** `Measured.potentialOpeningsPerKill` takes the
combo search's openings per kill for each fighter, and
`Measured.recoveryDistance` its distance outside the roster's recovery
band (double jump plus up and side special, vertically and horizontally,
from below and beside the ledge, against Melee bands). Until those tools
report, the terms print "-" and add nothing.

## Tunable parameters

An optimizer that tunes a fighter against its score changes only these, per
fighter, within these bounds:

- **Normals and throws** (`AuthoredMove` and `AuthoredThrow` in
  smashcraft:ts/src/game/sim/heroes/NAMEMoves.ts; the original fighters'
  in smashcraft:ts/src/game/sim/moves.ts): each hit region's damage, base
  knockback and growth within ±25% of the frozen baseline value; startup, active
  and ending frames and landing lag within ±3 frames (startup at least 1).
- **Specials** (smashcraft:ts/src/game/sim/heroes/NAMESpecials.ts): damage,
  knockback, mana cost and cooldown within ±25% of the frozen baseline; frames within ±3 of baseline.
- **Computer weights** (the fighter's gameplan,
  smashcraft:ts/src/game/sim/heroes/NAMEGameplan.ts or
  smashcraft:ts/src/game/sim/originalGameplans.ts): calibrate weights and spacing against its play-style profile first,
  then freeze the complete gameplan, computer code and chosen opponent/tier
  before kit tuning. Win rate is never
  the calibration target; kit rounds cannot change computer play.
- **Fixed:** anything the fighter's design doc states as a commitment
  (a named frame, a reach, a weakness such as Mountain King's air drift),
  physics shared by the roster, and every value in this doc.

### Fixed baseline and feel

`ts/scripts/balanceBaseline.json` records the actual authored values for all
26 fighters when #355 lands. `currentKit` reads the same normal tables and
special records as the game, including the original fighters' shared tables
and numeric values in their special/projectile/summon/throw source. Damage,
base knockback and growth stay within ±25%; startup, active, ending and
landing frames within ±3 frames. Bounds always use this fixed file, never
last round's values. Specials' mana costs and cooldown stay within ±25%.
Reach, launch angle, physics, hurtboxes and other values are fixed.

Every contact keeps the sign of its digital-shield advantage: negative stays
negative, positive stays positive, and zero stays zero. Normal contacts use
first active contact; aerials land on contact and use their final landing lag.
Special contacts use first active contact or projectile emission with zero
travel time. The same contexts are used before and after; a projectile's
travel-distance spacing is fixed, never a tuning variable.

Kill percent is measured in the production hit and motion code: one uncharged
contact against a grounded Rifleman at Sky Deck centre, neutral DI, no
recovery input, followed for 360 frames. The first whole percent killing
within the 0–300% range is recorded separately for each damaging contact.
Each recorded kill threshold stays within ±15% of baseline; a contact with
no KO through 300% cannot gain one. Both are feel locks, alongside the
whole-field matchup and identity gates.

### Defining archetype traits

The following profile ranges are hard gates; all other profile ranges stay
scored. Each range comes from that fighter's own design profile.

| Archetype | Defining trait |
| --- | --- |
| rushdown | approach share |
| zoner | ranged damage share |
| bait-and-punish | approach share (measured patience and approach mix) |
| heavy | air share (grounded commitment) |
| grappler | approach share (closing to grab range) |
| setplay | ranged damage share (placed threats and summons) |
| all-rounder | approach and ranged shares |
| skirmisher | approach and air shares |
| trapper | ranged and down-special shares |
| mobility trickster | air and side-special shares |

### Honest optimizer rounds

`balanceOptimizer.ts` provides finite-difference coordinate descent over real
kit values: each candidate moves one allowed scalar by one frame or 1% of
baseline. No candidate contains code, opponent/stage conditions, computer
rules, reach changes or gameplan weights. The optimizer's profile phase must
finish before it freezes computer play; kit rounds reject changed gameplans.

The win-rate gate remains 45–55%, but the optimizer's target is **50%**
(`winTarget`). Its score replaces the win-band distance with distance from
50; other score terms remain the same. Among valid candidates, prefer the
one closer to 50, then the fewest/smallest changes from baseline. A fighter
stops once its measured two-sided **95% Wilson interval** includes 50%, using
its total decisive matches (ties excluded). At 400 a pair across 25 opponents
this is about ±1 percentage point; it is measured, never a separate 49–51%
hard gate. This avoids demanding precision the field cannot support.

Every trial re-measures the whole roster, every pair on every seed, with at
least 400 matches a pair in aggregate. Partial fields cannot estimate a rate
or enter candidate acceptance. Score samples come from each seed's measured
whole field and the production balance score, not a supplied improvement.

A change is kept only when its paired improvement on held-out seeds exceeds
the run's 95% interval: mean improvement > Student-t 0.975 critical value × standard error. The
normal-limit constant is 1.96; finite seed counts use the conservative
lower-degrees-of-freedom entry from the [NIST Student-t table](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm). Among
passing candidates equally close to 50%, fewest values changed from baseline wins; total distance
in baseline-bound units breaks ties. Training, held-out selection and final
confirmation use disjoint seeds. The final confirmation must pass the same
rules and improvement interval on seeds never used by the optimizer.

Every kept change writes through the required Balance record callback before
returning a kept result. Its row contains the changed before/after
values, held-out seeds and scores, improvement and interval, and unused-seed
confirmation scores. The retune writes this row into the roster's Balance
record in the same commit as the kit change. A discarded/noisy change has no
kept record. #355 establishes these rules; the retune follows #354's fresh field.

## Check

`bun wisp farm balance --wait` (from ts/) plays the field, then the spam
probes (`--probe N` matches a pair, 0 skips them), and prints the field,
style, conversion and balance tables with both verdicts. Locally, `--seed-offset N` selects a fresh seed range; from
cpuField `--json` files: `bun scripts/cpuField.ts --merge FIELD_SHARDS
--probe PROBE_FILES`; one fighter's probe is `bun scripts/cpuField.ts
--probe-fighter SLUG --from FIELD.json --per-pair 40 --seeds 100 --json
OUT.json`.

## Roster retune (#414)

10 Oct 2026. Measured on main 38ee916d7 with the Balance workflow's field
(Wren Expert both sides, 48 matches a pair, seed offset 0, 1,200 matches a
fighter), 8 of 26 fighters were inside 45–55%. Each fighter outside 47–53% had
every damage literal in its moves and specials scaled by one factor, about
0.6% of damage for each point it sat from 50%. Its knockback growth was scaled
the other way so kill percents stay close to their baseline: ×(1 + 1.1 × the
cut) for a nerf and ×(1 − 0.6 × the buff) for a buff. Down smashes keep their
damage, because their growth is the roster's fixed 40. Rifleman keeps his
values: his normals are the reference attacker the physics and input
reference tests measure against. Dreadlord's forward and back air land in 11
frames instead of 10, so their shield advantage stays −1 with the extra
damage. Literals stay exact float32 values. Each fighter's design doc keeps its pre-#414 move rows;
the live value is that row times the factor below.

| Fighter | Damage | Growth |
| --- | ---: | ---: |
| blademaster | ×0.929 | ×1.078 |
| mountain-king | ×0.978 | ×1.025 |
| warden | ×0.913 | ×1.096 |
| lich | ×1.067 | ×0.960 |
| forsaken-paladin | ×1.072 | ×0.957 |
| dreadlord | ×1.109 | ×0.935 |
| shadow-hunter | ×0.951 | ×1.054 |
| pit-lord | ×1.055 | ×0.967 |
| beastmaster | ×0.881 | ×1.131 |
| thrall | ×1.024 | ×0.986 |
| jaina-proudmoore | ×0.952 | ×1.053 |
| sylvanas-windrunner | ×0.972 | ×1.031 |
| cairne-bloodhoof | ×0.973 | ×1.030 |
| chen-stormstout | ×0.966 | ×1.038 |
| peon | ×1.024 | ×0.985 |
| goblin-tinker | ×0.923 | ×1.084 |
| kael'thas-sunstrider | ×1.035 | ×0.979 |
| murloc | ×1.073 | ×0.956 |
| grom-hellscream | ×0.904 | ×1.105 |
| kobold | ×1.121 | ×0.928 |
| medivh | ×1.057 | ×0.966 |
| anub'arak | ×1.116 | ×0.930 |

The same field on this retune puts 12 of 26 inside 45–55%. The low end moved
up (Kobold 29.9→35.3%, Anub'arak 30.7→37.0%, Dreadlord 31.8→39.6%) and the
high end down (Goblin Tinker 62.7→54.9%, Grom 65.9→61.4%), but 14 fighters
are still outside the band; Rifleman rose to 77.3%.

## Player panel and equal skill ceilings (#358)

Every fighter targets a 45–55% mean over all six Expert personalities, with
an equal vote for Rook, Ember, Flint, Vale, Kite and Wren. Each personality's
fighter rate must be 40–60%. Each personality must share first place on at
least 1 fighter, and on at most 50% of the roster; ties count for every tied
personality. Wren keeps 400 matches a pair; the other five use 100.

Each fighter's `ceiling-plan` block is a **draft for Tom to correct**. Its
basic gameplan uses the named subset, one approach and shield, without combo
routes, advanced kit sequences or read-based punishes. Its expert gameplan
uses the full authored plan at the same mechanical and judgment skill. Expert
must win at least 55% (a fixed 5 percentage point depth margin) over basic in
100 mirror matches, with both sides measured equally.

Final skill profiles run 25 matches a pair. Perfect execution removes tech,
DI, SDI, hop and aerial drift slips and uses 100% execution with full kit
reliability. Perfect judgment removes judgment, spacing, guess and repeated
answer mistakes, idle stretches and punish misjudgments. It keeps personality
preferences, human observation delays and the shared move-value estimate;
that estimate is fallible, so this is a mistake-free judgment profile, not an
omniscient opponent. The ceiling combines both improvements.

The execution and judgment gains are measured against the same fixed Wren
Expert field, as is Advanced-to-ceiling headroom. An `execution` or `decision`
path needs at least 60% of the positive single-axis gains on its named axis;
there must be a positive gain. `mixed` needs a gain above 0 on each axis.
Ceiling versus ceiling targets 45–55% for every fighter. Each fighter's
Advanced-to-ceiling gain must be positive and within 10 percentage points of
the roster median. The depth margin, axis majority and headroom tolerance are
initial draft values; `CEILING_SPEC` in balance.ts owns every number here.

`bun wisp farm balance` runs the panel after the existing Wren field and spam
probes, using at most eight hosted jobs at once. The final table prints panel,
diversity, depth, declared path, ceiling and headroom pass/fail verdicts. Missing
samples fail completeness; no kit is retuned by the measurement. The profile
runner reports actual process CPU (user plus system) for production matches.
