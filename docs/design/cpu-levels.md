# Computer difficulty levels

How Smashcraft's computer opponent plays at levels 1 to 9, why each level
differs the way it does, and how a level and the match seed stay
deterministic under rollback. Source: smashcraft:ts/src/game/match/cpuLevel.ts
(the table), smashcraft:ts/src/game/match/botPlay.ts (where it applies).
Tracking: [#134](https://github.com/tompassarelli/smashcraft/issues/134).

## Prior art

**Melee (levels 1-9).** The level scales how often a computer acts on a
decision it has already made: level 1 "will almost never" input the attack it
chose and waits a long time, level 9 acts at once. Low levels stand next to
the opponent and jab or tilt; high levels use aerials, smashes and grabs.
Low levels roll only to change direction; level 9 defends nearly every attack
it isn't in lag for. Low levels recover in a simple, gimpable pattern; high
levels mix up their recovery and air dodge out of tumble. Mashing (sleep,
shield break, grabs) gets faster with the level. Level 1 on "Stand" takes
every attack. ([SmashWiki: AI](https://www.ssbwiki.com/AI),
[SmashWiki: Level 1 CPU](https://supersmashbros.fandom.com/wiki/Level_1_CPU))

**Ultimate level 9 and amiibo.** Ultimate's level 9 reads inputs: it answers
an attack on its first frame with a shield, perfect shield or dodge, which
players call unfair and also exploit, because its patterns (ledge options,
recovery routes) are fixed and learnable. Amiibo (Figure Players) are a
different design: they start from a level-like base and learn from how
they are trained (which moves they're fed, how players fight them), so their
weights drift toward a style. Their strength comes from stats and learned
habits, not from frame-1 reactions. ([SmashWiki: Computer player](https://www.ssbwiki.com/Computer_player))

**Fighting-game AI difficulty.** Human visual reaction is about 200-300 ms,
12-18 frames at 60 frames a second ([Infil: On Reaction Times](https://ki.infil.net/reaction.html)).
Difficulty that feels fair scales several human-like limits together
(reaction delay, decision quality, deliberate mistakes, awareness) inside
sane ranges rather than pushing one to an extreme: an easy computer that
only reacts slowly but executes perfectly still feels robotic, and a hard
one with frame-1 reactions feels like input reading
([gamedev.net: error margins](https://www.gamedev.net/forums/topic/433977-noob-ai-q-programming-error-margins/)).

## Decisions

- **Many limits, scaled together.** A level is one row of limits, each
  moving monotonically toward full strength (the table below); no level
  changes how the computer moves its fighter or which plans its gameplan
  offers, only how quickly, how often and how well it uses them.
- **Level 9 is the computer at full strength**, exactly the gameplan
  computer that #105 tuned (with seed 0 it plays move for move as before
  levels existed). It answers a strike as soon as the strike is coming,
  which is Ultimate's level-9 feel at Smashcraft's 12-frame lookahead; its
  fighter's gameplan is what makes it a solid player rather than a reader.
- **Level 1 is a punching bag**: it stands still more than half the time,
  answers no attack, throws moves that can't reach, never influences a
  launch, never techs, climbs straight up from the ledge and stands up from
  the floor. It still returns to the stage, as Melee's level 1 does, so its
  losses come from the opponent.
- **Low levels ignore the gameplan's move weights** (below level 4) and
  choose evenly among moves in reach; positioning still follows the
  gameplan, so each fighter keeps its silhouette at every level.
- **The menu and `wisp play` default to level 9.** Play exists to try a
  fighter against its gameplan; the menu matches what players met before
  levels existed. play.ts declares the level.

## The table

| Level | Reaction (frames) | Threats answered | Attack pause (frames) | Misplays | Idle | Gameplan weights | DI | Tech | Mash every (grab / freeze) | Ledge and get-up mixups | Shield grabs | Kit options |
| ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | --- | --- | --- | ---: |
| 1 | 30 | 0% | 60 + 0-59 | 45% | 55% | no | 0% | 0% | 14 / 16 | no | no | 0% |
| 2 | 25 | 10% | 46 + 0-49 | 35% | 40% | no | 10% | 10% | 12 / 14 | no | no | 0% |
| 3 | 20 | 20% | 36 + 0-41 | 26% | 28% | no | 30% | 20% | 10 / 12 | no | no | 0% |
| 4 | 16 | 30% | 28 + 0-33 | 18% | 18% | yes | 40% | 30% | 8 / 10 | yes | no | 30% |
| 5 | 13 | 40% | 21 + 0-27 | 12% | 10% | yes | 50% | 40% | 6 / 9 | yes | yes | 40% |
| 6 | 10 | 50% | 15 + 0-23 | 7% | 5% | yes | 60% | 50% | 5 / 8 | yes | yes | 50% |
| 7 | 7 | 50% | 11 + 0-20 | 4% | 2% | yes | 80% | 60% | 4 / 7 | yes | yes | 70% |
| 8 | 4 | 60% | 8 + 0-18 | 2% | 0% | yes | 90% | 62.5% | 3 / 6 | yes | yes | 80% |
| 9 | 0 | 70% | 6 + 0-17 | 0% | 0% | yes | 100% | 66.7% | 2 / 6 | yes | yes | 100% |

- *Reaction*: frames an attacker's move must have run (a shot must have
  flown, Immolation burned) before the computer answers it at all.
- *Threats answered*: of the threats it sees in time, the share it shields,
  dodges, parries or meets with a stance; the rest it takes.
- *Attack pause*: frames after an attack before it may start another.
- *Misplays*: attack decisions within 350 units of the target that throw
  any normal, in reach or not.
- *Idle*: half-second stretches it stands where it is (it still defends,
  recovers and gets up).
- *Kit options*: when a fighter's advanced kit option suits the moment
  (a Wind Walk cross-up or feint, a Mirror Image swap, a full or baited
  Thunder Clap, a Storm Bolt recall, Shadow Pursuit, a Frost Nova burst, a
  second recoil shot, a glide, a leap off the hippogryph), the share of
  those moments it takes it (smashcraft:ts/src/game/match/botKitOptions.ts).
  The same share gates the play around the newest moves: running in for a
  dash attack, a charged Eye Blast, an anti-air jump into an aerial, the
  move that cashes a ready passive, and shielding (or dodging Cleave)
  against an opponent’s ready passive. Ordinary specials are unaffected.

## Determinism and the match seed

Every computer decision is a function of the match state and the frame,
drawn with `botChoice` (a scramble of 32-bit-safe integers), so each client
and every rollback re-simulation derives the same input. Levels live in
`MatchState.cpuLevels` and the seed in `MatchState.matchSeed`, both in the
snapshot, canonical state and first-difference, so restoring a snapshot
restores them. The seed salts every `botChoice` for the length of one
computer's decision (`useMatchSeed`); the salt is `seed mod 46337 × 7919 mod
46337`, products below 2^31, so Warcraft's 32-bit Lua agrees with Bun. Seed 0
salts nothing. The first match after the map loads plays seed 0; each later
match (rematch or back to fighter selection) plays the next seed, so
rematches differ without any clock or client-local randomness.

The seed is what makes win rates measurable: before it, a computer-against-
computer setup was one fixed match, so a matchup's rate was 0% or 100% per
setup. `bun scripts/cpuField.ts --seeds N` plays N seeds of each setup and
`bun scripts/cpuLevels.ts` measures the levels against each other
(smashcraft:docs/typescript.md).

## Selection

At fighter selection a CPU card shows "Level N" between a lower and a raise
button under the card, below the area where a press picks up the card's
chip. The first human or the player whose slot it is may change it (the same
rule as choosing that computer's fighter, `canChooseComputer`); for anyone
else the buttons are disabled. The click is a synchronized frame click, so
every client applies the same change. `bun wisp play` sends
`PLAY v=2 computers=MASK level=L` and the map applies the level before the
match starts.
