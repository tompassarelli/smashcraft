# Balance

Tom's balance spec (8 Oct 2026). Every number here is an **initial value
Tom tunes**; the code holds each in one constant, `BALANCE_SPEC`,
`PUNISH_RESET_FRAMES`, `DISADVANTAGE_FRAMES` and `SCORE_WEIGHTS` in
smashcraft:ts/scripts/balance.ts, and smashcraft:ts/scripts/balance.tests.ts
checks this doc states the same values. Changing one changes the code, the
test and this doc together.

## Philosophy

- Balance is an optimization toward Tom's taste written as numbers, not a
  playtest loop. The numbers are the win band, each fighter's play-style
  profile, move variety, the spam probe and conversion targets below.
- A fighter may not reach the 40-60% band through a degenerate strategy.
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

A fighter is **balanced** only when all three hold, with both computers at
Wren Expert:

| Rule | Initial value |
| --- | --- |
| Win rate against the field | 40% to 60% |
| Spam probe win rate against the Expert field | at most 45% |
| Largest single move's share of the fighter's damage | at most 40%, except its signature move |

The win-rate rule is the roster's existing gate (smashcraft:docs/design/roster.md,
"Balance gate"), unchanged. A **signature move** is named by the
`signature: MOVE PERCENT` line of the fighter's play-style profile in its
own design doc; that move may carry up to that share of the damage, every
other move stays under the ceiling. Only a design doc names a signature
move, never the measurement.

The full-roster `bun wisp farm balance` run prints the verdict as
"Balanced (win band, spam probe, move share): passes" or "fails" with each
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
| Win | outside 40-60% | 1 |
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
  knockback and growth within +-25% of the current value; startup, active
  and ending frames and landing lag within +-3 frames (startup at least 1).
- **Specials** (smashcraft:ts/src/game/sim/heroes/NAMESpecials.ts): damage,
  knockback, mana cost and cooldown within +-25%; frames within +-3.
- **Computer weights** (the fighter's gameplan,
  smashcraft:ts/src/game/sim/heroes/NAMEGameplan.ts or
  smashcraft:ts/src/game/sim/originalGameplans.ts): each move's weight from
  0.25x to 4x its current value, and spacing ranges within +-20%.
- **Fixed:** anything the fighter's design doc states as a commitment
  (a named frame, a reach, a weakness such as Mountain King's air drift),
  physics shared by the roster, and every value in this doc.

Each accepted change is recorded in the roster's Balance record with its
before and after score.

## Check

`bun wisp farm balance --wait` (from ts/) plays the field, then the spam
probes (`--probe N` matches a pair, 0 skips them), and prints the field,
style, conversion and balance tables with both verdicts. Locally, from
cpuField `--json` files: `bun scripts/cpuField.ts --merge FIELD_SHARDS
--probe PROBE_FILES`; one fighter's probe is `bun scripts/cpuField.ts
--probe-fighter SLUG --from FIELD.json --per-pair 40 --seeds 100 --json
OUT.json`.
