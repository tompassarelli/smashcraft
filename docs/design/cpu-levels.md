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
- **Level 9 reacts after 200 ms.** Its decisions use the opponent observation
  from 12 input frames earlier. Lower levels use older observations (the
  curve below); attacks, shields, jumps, movement, statuses and projectiles
  all cross the same delay. The computer reads no opponent input or pending
  command. Own movement legality, damage response, escape and recovery use
  its current state. A chosen sequence follows its own move clock without
  paying the observation delay again.
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

| Level | Reaction (frames) | Threats answered | Attack pause (frames) | Misplays | Idle | Gameplan weights | DI | Tech | Mash every (grab / freeze) | Ledge and get-up mixups | Shield grabs | Kit options | Punishes | Window misjudged (frames) |
| ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | --- | --- | --- | ---: | ---: | ---: |
| 1 | 36 | 0% | 60 + 0-59 | 45% | 55% | no | 0% | 0% | 14 / 16 | no | no | 0% | 10% | 12 |
| 2 | 33 | 10% | 46 + 0-49 | 35% | 40% | no | 10% | 10% | 12 / 14 | no | no | 0% | 20% | 10 |
| 3 | 30 | 20% | 36 + 0-41 | 26% | 28% | no | 30% | 20% | 10 / 12 | no | no | 0% | 30% | 8 |
| 4 | 27 | 30% | 28 + 0-33 | 18% | 18% | yes | 40% | 30% | 8 / 10 | yes | no | 30% | 40% | 6 |
| 5 | 24 | 40% | 21 + 0-27 | 12% | 10% | yes | 50% | 40% | 6 / 9 | yes | yes | 40% | 50% | 5 |
| 6 | 21 | 50% | 15 + 0-23 | 7% | 5% | yes | 60% | 50% | 5 / 8 | yes | yes | 50% | 60% | 4 |
| 7 | 18 | 50% | 11 + 0-20 | 4% | 2% | yes | 80% | 60% | 4 / 7 | yes | yes | 70% | 70% | 3 |
| 8 | 15 | 60% | 8 + 0-18 | 2% | 0% | yes | 90% | 62.5% | 3 / 6 | yes | yes | 80% | 90% | 1 |
| 9 | 12 | 70% | 6 + 0-17 | 0% | 0% | yes | 100% | 66.7% | 2 / 6 | yes | yes | 100% | 100% | 0 |

- *Reaction*: age of the visible opponent observation used for decisions,
  from 600 ms at level 1 to 200 ms at level 9, decreasing by 50 ms per level.
  Defense and punish do not wait a second time after that observation arrives.
  Defense projects an observed shot along its last visible velocity for the
  observation's age, and discards shots expected to have passed or expired.
  It uses no newer opponent sample for that prediction.
- *Direction commitment*: every level keeps a horizontal choice for at least
  five input frames before reversing, on the ground and in the air. Neutral
  braking may happen immediately, but does not reset that hold. Directional
  influence during hitlag and grab escape use their separate own-state rules.
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
- *Punishes*: of the punish windows it sees (below), the share it answers.
- *Window misjudged*: frames it overestimates a window by, so it may throw
  a move that comes out after the opponent can act again.

## Reads and move value

smashcraft:ts/src/game/match/botStrategy.ts records transitions in delayed
opponent observations, partitioned by close, middle and far spacing and by
ground, air, knockdown and ledge situations. Each context retains the policy's
bounded number of events, with a total ceiling of 128. Update stride, evidence
count and confidence are independent policy fields. An opponent change clears
the history. Match start and rematch clear history and outstanding reads.

A read forecasts the next recurrence of the common observed choice. The
computer may walk toward a grab position, hold a guard before a predicted
strike, or queue a strike before the expected jump, landing or movement.
The normal six-frame attack buffer can carry that commitment through the
fighter's own recovery. A committed guard can lose to an unexpected grab;
the forecast does not inspect new opponent inputs. Seeded choices sometimes
decline reliable patterns and sometimes guess from weak evidence.

smashcraft:ts/src/game/match/botMoveValue.ts weights eligible moves by observed
shield/jump frequency, authored damage and startup, an approximate kill reward,
recovery exposure at the computer's own percent, and resulting distance from
stage centre. A stock deficit or a short clock while trailing increases the
reward for risky comeback choices. The prediction is approximate: recovery,
directional influence and changed opponent behavior can invalidate it.
Every eligible move keeps a positive weight alongside its fighter's gameplan.
Lower judgment favors familiar answers and smashes; higher judgment uses the
value comparison more often.

smashcraft:ts/src/game/match/cpuDecisionPolicy.ts defines the independent policy
dimensions consumed by reads and move choice. The named opponent/tier design
is in smashcraft:docs/design/cpu-profiles.md. Mechanical reaction, execution
and spacing remain separate from judgment, memory and risk preference.
History and mutable read commitments are copied in detached snapshots,
restored with input rows and included in exact and periodic replay checksums.
smashcraft:ts/src/game/match/botStrategyContracts.tests.ts exercises adaptation,
successful and punishable reads, buffering, seeded variety and move value;
smashcraft:ts/test/native/pads/cpu-reads.pad is the native comparison script.

## Whiff punish

Without it, the computer answered threats but never attacked into an
opponent's end lag, so slow, committal fighters (Pit Lord) got away with
whiffs and overperformed in #105's matrix. smashcraft:ts/src/game/match/botPunish.ts
reads the window from the delayed opponent observation, the frames until it
can act: a ground move past its active frames (`attack.cooldown`), a missed
grab, a hero special past its last strike with nothing still to come (no
shot, partner, guard, armor or branch), landing lag, a dropped shield's
release lag, a dodge after its intangibility, and a grounded opponent
asleep or stunned (a status that blocks every action; its frames left,
shortened by any mashing; #105 found Dreadlord converted only a quarter of
his Sleeps before it). Attack clocks advance through the observation's age,
excluding the frozen frames of observed hitlag. A falling attack whose
trajectory reaches a deck during that delay supplies its authored landing lag,
less the frames already spent on the deck. A hit, a grab, a knockdown,
the ledge or a target still expected in the air is not a window. The computer then takes a ground move whose
first active frame lands inside the window and whose strike reaches where
the opponent will be (the bot's cached first-active-frame reach): its
gameplan's spacing tool when one fits (from level 4, with the gameplan
weights), so punishes keep each fighter's identity, else its fastest. A grab
is thrown only when the opponent's position, not just its body's edge, is in
reach, since grabs catch a narrower body and a missed grab is punished in
turn. With nothing in reach it runs in when a move would arrive in time
(a jab out of a run is the dash attack), and a shield lets go only for a
grab. It runs after defense and before the attack pause and idle
stretches, so a level's pause doesn't eat the window; the level gates it
with its delayed perception, the punish share and the misjudgment, each drawn
on the window's key under the match seed. Scripted checks:
smashcraft:ts/src/game/match/botPunishContracts.tests.ts.

## Determinism and the match seed

Every computer decision is a function of the match state, its bounded
opponent-observation history, its direction commitment and the frame,
drawn with `botChoice` (a scramble of 32-bit-safe integers), so each client
and every rollback re-simulation derives the same input. Levels live in
`MatchState.cpuLevels` and the seed in `MatchState.matchSeed`, both in the
snapshot, canonical state and first-difference, so restoring a snapshot
restores them. Observation records are immutable and shared by detached
snapshots; canonical state includes every observed scalar, and replay
restores the last horizontal choice and its first frame. Match start and
rematch clear both. The seed salts every `botChoice` for the length of one
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
