# Named computer opponents

Choose an **Opponent** and **Difficulty** independently. The six original
fictional opponents are **Rook, Ember, Flint, Vale, Kite and Wren**. Each grows
through exactly five tiers: **Rookie, Beginner, Intermediate, Advanced, Expert**.
These 30 combinations are authored Smashcraft difficulty settings, with no
claimed equivalence to human ratings or imitation/endorsement of real players.
Design ownership: [#183](https://github.com/tompassarelli/smashcraft/issues/183).

## Identity and growth

An opponent is a recognizable player with several competencies, rather than
an exclusive archetype. Tendencies weight legal choices; they never forbid
aggression, defense, grabs, reads, movement, recovery or any part of a fighter's
kit. Raising difficulty improves weaker skills as well as dominant ones.
Rook becomes better at scrapping and taking initiative, rather than merely
becoming a more narrowly specialized planner. Ember learns patience, reads
and defense while retaining an impatient streak.

Rookie leaves obvious openings; Beginner understands basic exchanges;
Intermediate combines a plan with inconsistent decisions; Advanced punishes
ordinary mistakes; Expert is extremely hard but beatable. Each identity has
its own progression in mechanics, reactions, judgment, adaptation and risk.
Expert combines excellent primary and secondary skills; persistent habits
still leave smaller openings for deliberate conditioning or baiting.

The description and tendency tags below are final menu copy. Tags summarize
preferences, not an exhaustive list of the opponent's abilities.

| Opponent / stable ID | Description | Tendency tags | Secondary competencies that grow | Persistent weakness |
| --- | --- | --- | --- | --- |
| Rook / `rook` | Makes a plan, then fights for the space to use it. | Plans ahead · Controls space | Close scrapping, taking initiative, conversion execution | Reluctant to gamble; can surrender a fleeting chance while seeking safety |
| Ember / `ember` | Pushes the pace and looks for the next opening. | Takes initiative · Keeps pressure | Habit reads, defensive techs, disengaging after a failed push | Impatient; can extend pressure one step too far |
| Flint / `flint` | Turns practiced movement into clean attacks. | Precise movement · Clean follow-ups | Matchup judgment, adaptation, choosing when to abandon a string | Trusts rehearsed routes; conditioning can bait the follow-up |
| Vale / `vale` | Stays composed, then turns defense into an opening. | Patient defense · Punishes mistakes | Proactive grabs, approaching safely, sustained offense | Gives up initiative while waiting for a convincing opening |
| Kite / `kite` | Changes pace and finds unusual ways through. | Changes routes · Bold choices | Reliable conversions, safe landings, recognizing patterns | Still chooses occasional risky escapes or recoveries |
| Wren / `wren` | Changes tools to match the fight in front of them. | Flexible choices · Steady pace | Burst pressure, precise defense, exploiting conditioned habits | Falls back to comfortable neutral resets under uncertainty |

### Individually authored five-tier paths

Each cell is a complete tier-specific strengths/opening preview. Its **Strong
at / Watch for** wording is final menu copy. Different paths improve secondary
skills at different points; they do not apply constant archetype offsets.

| Opponent | Rookie | Beginner | Intermediate | Advanced | Expert |
| --- | --- | --- | --- | --- | --- |
| Rook | Strong at: Following a plan. Watch for: Slow answers and mistimed close attacks. | Strong at: Holding useful space. Watch for: Pressure that breaks the setup. | Strong at: Spacing and learning habits. Watch for: Sudden pressure and missed gambles. | Strong at: Reading habits and fighting up close. Watch for: Hesitation at risky openings. | Strong at: Adaptation, spacing and close conversions. Watch for: Baiting caution when a gamble is needed. |
| Ember | Strong at: Quick approaches. Watch for: Repeated unsafe attacks. | Strong at: Basic pressure and follow-ups. Watch for: Chasing past a safe opening. | Strong at: Sustained pressure and spotting escapes. Watch for: Impatient extensions. | Strong at: Pressure reads and defensive techs. Watch for: A baited extra attack. | Strong at: Fast conversions, reads and pressure resets. Watch for: Impatience after a blocked push. |
| Flint | Strong at: Practiced movement. Watch for: Repeating a mistimed follow-up. | Strong at: Simple clean strings. Watch for: Starting them at the wrong distance. | Strong at: Execution and reliable punishes. Watch for: Familiar routes after you change habits. | Strong at: Precise movement and matchup choices. Watch for: Conditioning the trusted follow-up. | Strong at: Execution, adaptation and choosing conversions. Watch for: Baiting a rehearsed route. |
| Vale | Strong at: Blocking obvious attacks. Watch for: Grabs and long waits. | Strong at: Basic whiff punishes. Watch for: Feints that keep the initiative. | Strong at: Defense and proactive grabs. Watch for: Hesitation after a safe reset. | Strong at: Defense, safe approaches and pressure. Watch for: Delayed attacks that restart the wait. | Strong at: Precise punishes and offense from defense. Watch for: Taking initiative while Vale waits for certainty. |
| Kite | Strong at: Trying different routes. Watch for: Unsafe landings. | Strong at: Changing pace and escaping. Watch for: Dropped conversions. | Strong at: Varied approaches and short conversions. Watch for: Bold recoveries. | Strong at: Pattern reads and reliable follow-ups. Watch for: A risky escape after being cornered. | Strong at: Route changes, precise conversions and reads. Watch for: Recognizing the occasional bold recovery. |
| Wren | Strong at: Trying attack and defense. Watch for: Long pauses before a reset. | Strong at: Basic answers to several situations. Watch for: Comfortable repeated approaches. | Strong at: Flexible tools and burst pressure. Watch for: Predictable resets under uncertainty. | Strong at: Matchup choices and conditioned punishes. Watch for: Baiting the return to neutral. | Strong at: Adaptation, precise defense and varied pressure. Watch for: Conditioning the preferred neutral reset. |

## Initial decision parameters

These are individually authored starting rows, not measured win-rate results.
A shared decision policy consumes independent dimensions, with no identity
branch that restricts legal behavior. Percentage shares use the match's seeded
integer draws. They never change damage, hit regions, movement speed or legal
technique windows. Calibration may tune rows while preserving the identities
and developmental paths above.

In the table: **Execute** is correct execution of an eligible intended technique;
**Judge/Space** is context-sensitive move evaluation / correct reach-window
judgment; **History** is observations retained per relevant context / update
stride in observations; **Read** is minimum evidence count / pattern-confidence
percent; **Repeat** is choosing a familiar eligible answer instead of
reconsidering; **Punish** weights likely punishment relative to full evaluation;
**Initiative/Variance** weights proactive pressure / high-variance choices;
**Guess** is speculative commitment without sufficient evidence. All percentage
columns are decision shares except Punish, which is a value weight and may
exceed 100. Initiative and variance weight preferences, not capability ceilings.

| Opponent | Tier | Reaction frames | Execute % | Judge/Space % | History | Read | Repeat % | Punish % | Initiative/Variance % | Guess % |
| --- | --- | ---: | ---: | --- | --- | --- | ---: | ---: | --- | ---: |
| Rook | Rookie | 36 | 45 | 35/55 | 8/4 | 2/60 | 65 | 80 | 25/15 | 15 |
| Rook | Beginner | 32 | 62 | 52/68 | 12/3 | 3/65 | 50 | 90 | 35/18 | 12 |
| Rook | Intermediate | 27 | 80 | 75/82 | 20/2 | 4/70 | 35 | 105 | 50/22 | 8 |
| Rook | Advanced | 21 | 91 | 88/92 | 28/1 | 5/75 | 22 | 115 | 65/28 | 5 |
| Rook | Expert | 18 | 96 | 96/97 | 32/1 | 5/80 | 15 | 120 | 75/35 | 3 |
| Ember | Rookie | 30 | 60 | 20/35 | 4/4 | 2/40 | 80 | 35 | 90/70 | 40 |
| Ember | Beginner | 27 | 72 | 40/52 | 6/3 | 2/50 | 65 | 45 | 90/65 | 30 |
| Ember | Intermediate | 21 | 84 | 65/72 | 12/2 | 3/60 | 45 | 60 | 90/60 | 20 |
| Ember | Advanced | 15 | 93 | 82/86 | 20/1 | 4/65 | 32 | 75 | 90/55 | 12 |
| Ember | Expert | 14 | 97 | 94/95 | 28/1 | 5/75 | 22 | 90 | 88/50 | 8 |
| Flint | Rookie | 30 | 65 | 25/35 | 4/16 | 2/45 | 80 | 50 | 60/20 | 20 |
| Flint | Beginner | 27 | 78 | 40/58 | 8/12 | 3/55 | 68 | 65 | 62/22 | 15 |
| Flint | Intermediate | 21 | 88 | 65/78 | 12/4 | 3/65 | 52 | 80 | 65/25 | 10 |
| Flint | Advanced | 15 | 95 | 84/90 | 20/2 | 4/70 | 38 | 90 | 70/30 | 7 |
| Flint | Expert | 14 | 98 | 95/96 | 28/1 | 5/75 | 28 | 100 | 75/35 | 4 |
| Vale | Rookie | 36 | 50 | 30/45 | 6/4 | 2/65 | 75 | 90 | 15/10 | 10 |
| Vale | Beginner | 30 | 65 | 50/62 | 10/3 | 3/70 | 60 | 100 | 25/12 | 8 |
| Vale | Intermediate | 24 | 80 | 72/80 | 16/2 | 4/75 | 42 | 110 | 45/18 | 6 |
| Vale | Advanced | 18 | 92 | 88/90 | 24/1 | 5/80 | 28 | 115 | 60/25 | 4 |
| Vale | Expert | 15 | 97 | 96/95 | 32/1 | 5/80 | 20 | 115 | 72/32 | 3 |
| Kite | Rookie | 36 | 50 | 25/45 | 4/4 | 2/40 | 45 | 40 | 65/90 | 45 |
| Kite | Beginner | 30 | 65 | 42/60 | 6/3 | 2/50 | 32 | 50 | 65/85 | 35 |
| Kite | Intermediate | 24 | 82 | 65/75 | 12/2 | 3/60 | 22 | 65 | 68/78 | 25 |
| Kite | Advanced | 18 | 92 | 84/88 | 20/1 | 4/65 | 12 | 80 | 72/70 | 15 |
| Kite | Expert | 14 | 96 | 95/96 | 28/1 | 5/75 | 8 | 95 | 78/65 | 9 |
| Wren | Rookie | 36 | 50 | 30/40 | 4/4 | 2/50 | 70 | 55 | 40/25 | 20 |
| Wren | Beginner | 30 | 67 | 48/58 | 8/3 | 3/60 | 55 | 70 | 48/28 | 15 |
| Wren | Intermediate | 24 | 82 | 70/74 | 16/2 | 3/65 | 40 | 85 | 60/35 | 10 |
| Wren | Advanced | 18 | 93 | 87/89 | 24/1 | 4/70 | 27 | 95 | 70/40 | 7 |
| Wren | Expert | 14 | 97 | 96/96 | 32/1 | 5/75 | 20 | 105 | 78/45 | 4 |

An execution miss produces a legal dropped or simpler input, including a roll
in place of jump/wavedash preparation, a neutral aerial in place of a
directional aerial, or a jab in place of a special. Expert misses 2–5% of
eligible technical inputs, following each identity’s Execute percentage. A judgment
miss considers fewer candidates or misjudges observed spacing; it never
inspects a future action. Bounded history covers neutral approach,
shield/escape, landing and ledge choices, partitioned by relevant spacing.
History and every decision commitment participate in rollback/replay.

Move value weighs estimated success, damage/kill reward, likely punishment and
resulting position at the relevant percent. A stock/time deficit increases
willingness to take a comeback gamble without faster perception or extra
knowledge. Rook's reluctance and Ember's impatience remain biases, not rules
that prevent a rational desperate attack or a safe disengagement.

Every combination preserves [#176](https://github.com/tompassarelli/smashcraft/issues/176):
trained recognition (a held guard, tech or ledge answer) waits at least 14 frames
(233 ms). A new decision waits at least 16 frames (267 ms), plus one frame for
each additional viable option: retreat, grounded shield, remaining jump and legal
attack. The slower authored tier delay still applies. Each observed cue draws
0–2 additional frames from the shared match seed; every client and replay draws
the same delay. Horizontal reversals are at least four frames apart.
[#356](https://github.com/tompassarelli/smashcraft/issues/356) draws each turn’s
interval from the match seed and the last committed turn. Targets come from
master, diamond and platinum Slippi replays for Expert, Advanced and
Intermediate (smashcraft:docs/design/human-input-consistency.md); Beginner and
Rookie are guesses. Intended medians are Rookie 8, Beginner 7, Intermediate 7,
Advanced 7 and Expert 6 frames, and no intended turn holds past 12 frames, since
a 13-frame hold enters run. Faster intended turns incur more late-turn noise,
scaled by `100 − Execute`. Each turn overshoots into run with chance 44, 32, 11,
7 and 6 in 10,000 from Rookie through Expert. Expert’s acceptance range is
0.4–0.8 unintended runs per minute; each lower tier is at least as high and
Rookie stays at or below 4. Measured 9 Oct over 120,000 controlled frames a
tier: 2.85, 2.46, 0.84, 0.78 and 0.63 runs per minute, medians 8, 7, 7, 7 and 6.
Frame-tight presses (wavedash air dodges) miss 9 points more
often than Execute: Expert Wren slips on 11.8% of 6,000 of them (361 wrong
options), against measured masters’ 12.5–13%. Braking to neutral remains
immediate. The computer calibration report prints these tables.
Prepared sequences and fallible reads can act before a predicted action occurs.
Delayed observations, bounded history and move-value logic are owned by
[#182](https://github.com/tompassarelli/smashcraft/issues/182).

Defense forecasts an observed strike's clock and position through the
observation delay. Visible shots follow their last observed velocity; arrival
uses the defender's own approach speed, and shots expected to have passed or
expired are discarded. A guard with a later authored protection window waits
until that window can meet the strike. Protected approaches hand over to attack
selection at the fighter's projected authored reach. These forecasts use no
newer opponent sample.

A visible projectile-special windup also forecasts its authored launch and
flight through the delay, so the computer can defend before the shot itself
enters the delayed sample. A falling cast that lands and cancels before its
launch contributes no shot. The same chance to miss a defense and the same
fighter-specific shield, dodge, jump or stance choices still apply.

Normal attacks, hero-special reach and punishes advance the delayed target's horizontal position
through the observation delay using its last observed velocity. The attacker's
own slide starts at the decision frame, so the delay is counted only for the
target. The forecast remains fallible when that target changes direction.

An active Divine Shield can also fund a ranged attack when the opponent remains
outside melee reach. Its mana is available for that attack instead of being held
for a second guard; without active protection, the guard reserve still applies.

## Defence and aerial execution slips

[#357](https://github.com/tompassarelli/smashcraft/issues/357) adds legal seeded
input errors without changing fighter stats. DI uses the victim’s visible
knockback angle: side launches turn upward for survival and downward for combo
escape; vertical launches turn outward for survival and inward for escape.
Survival takes priority at 80 damage or launch speed 20. Absent DI and wrong
DI are separate, disjoint outcomes. Kill-percent hits require at least 100%
damage, upward launch, and speed at least 3 Melee units per frame. Other hits
use the all-knockback context; along-launch inputs are not counted as absent.
Strong SDI opportunities have at least 9 hitlag frames. Multi-hit follow-ups
start within 15 frames after the previous hitlag ends and have at least 3
hitlag frames. The victim's hit duration and elapsed time supply these
classes, even when the preceding SDI was missed. Attempts pulse every other
tick; a small separate share points the wrong way.

The [Slippi measurements](human-input-consistency.md) map master to Expert,
diamond to Advanced and platinum to Intermediate. Rates per 1,000 actual
opportunities are:

| Difficulty | No DI, kill percent | No DI, other hits | Wrong DI | Strong SDI missed | Follow-up SDI missed | Wrong SDI, of attempts | Accidental full hop |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Expert | 140 | 180 | 45 | 620 | 880 | 40 | 9 |
| Advanced | 170 | 200 | 70 | 690 | 880 | 65 | 12 |
| Intermediate | 180 | 220 | 95 | 690 | 890 | 90 | 16 |
| Beginner | 240 | 300 | 120 | 780 | 930 | 115 | 24 |
| Rookie | 320 | 400 | 145 | 860 | 970 | 140 | 36 |

Wrong-direction rates, Beginner/Rookie rates and aerial misspacing remain
guesses. The 33% survival-shortening replay proxy ignores stage position and
is not the wrong-DI target. For execution `E`, aerial mistakes retain
`20 + 4 × (100 − E)` per thousand and drift lasts
`5 + floor((100 − E)/8)` frames. Expert requests 2.8–3.6% aerial mistakes.
A successful intended short hop presses the dedicated short-hop button;
a mistake holds ordinary jump through squat. A drifting aerial keeps its
planned gap, but a slip adds 5–11 ticks of inward stick and fast-falls when
descending, with a seeded 0–2 tick delay after startup. Lower execution also extends the
inward drift. Hit, jump and attack serials plus slot, character and shared
match seed keep a choice fixed for its opportunity on every client and replay.
Only delayed opponent position supplies the drift direction.

The `botExecutionNoise` production-input sweep executes 2,000 of each
opportunity for every identity and tier, counting absent and wrong DI separately,
strong and follow-up SDI travel,
actual takeoff speed and final aerial position. It checks Expert’s issue
ranges and monotonic errors at lower tiers. The shield-grab case executes the
same aerial with correct spacing and an Expert drift mistake.

## CPU-slot selection

The card retains its fighter portrait/chip and displays a compact summary:
`CPU 2 · Rook · Intermediate`, followed by **Opponent settings** below the
chip drag area. Choosing settings never picks up the chip. The slot owner or
first human can edit; others may open a read-only preview saying **Only the
slot owner or first player can change this opponent.** Changing fighter
preserves opponent and difficulty; the identity adapts its tendencies to that
fighter's kit.

Open one CPU slot's centered panel over the roster:

```text
CPU 2 — Opponent settings                         [Close]

Opponent          ‹ Rook         ›
Difficulty        ‹ Advanced     ›

Makes a plan, then fights for the space to use it.
Plans ahead · Controls space
Strong at: Reading habits and fighting up close.
Watch for: Hesitation at risky openings.

[Done]
Move: W/R + Space/E   Choose: N   Back: U
```

The last line uses actual bindings. Controller prompts say **Move: Stick or
D-pad · Choose: A · Back: X**. Default keyboard controls are W/R left/right,
Space/E up/down, N Choose, U Back; Enter remains Warcraft chat.

1. CPU cards and their **Opponent settings** buttons participate in menu
   focus. Move to the button and press Choose; no pointer is required.
2. Focus starts on Opponent. Up/down visits Opponent, Difficulty, Done.
   Left/right changes the focused value; Choose on a value advances once.
   Opponent cycles Rook, Ember, Flint, Vale, Kite, Wren, Random. Difficulty
   stops at Rookie/Expert. Changes apply immediately. The description/tags
   follow identity; Strong at/Watch for follow both identity and tier.
3. Choose on Done, Back or Close retains choices, closes the panel and returns
   focus to the settings button. Start closes and consumes its press, so it
   cannot start a match behind the panel. Require release before another action.
4. Mouse arrows perform the same changes. Only committed choices are shared;
   focus is local. Shared changes refresh an open preview; permission loss
   changes it to read-only.

New CPU slots default to **Wren + Intermediate**, offering varied approachable
play. Retain choices across New Match, fighter/stage changes and automatic
rematches in the map session; no new cross-session storage is needed. Training
**Fight** uses these choices; Stand/Shield/etc. keep their explicit behavior.

**Random** changes only opponent, with preview **A different opponent each
match.** and no fixed identity/strength/weakness preview. Draw uniformly from
six IDs once at match start with the shared match seed. Retain the resolved
identity through replay/rollback and reveal it in countdown/results, for
example `CPU 2 · Kite · Intermediate`. Rematches draw again; repeats are
allowed. The selector continues to show Random until changed.

## State, implementation and calibration

Use stable opponent IDs `rook`, `ember`, `flint`, `vale`, `kite`, `wren` and tier
IDs `rookie`, `beginner`, `intermediate`, `advanced`, `expert`, distinct from
copy. Selection records chosen opponent (or Random) and tier; match state also
records resolved opponent and bounded observation/commitment history per CPU.
Snapshots, canonical comparisons, first-difference and full-match replays carry
these fields. All decisions use existing seeded integer draws, with no clock,
client-local randomness, hidden input or private future state.

[#184](https://github.com/tompassarelli/smashcraft/issues/184) composes a resolved
independent decision record for each named opponent/tier over #182's shared
policy. The record supplies execution, judgment, spacing, history capacity /
update stride, read evidence/confidence, repetition, punish weight, speculative
guesses, initiative and variance separately from reaction delay. Identity tags
never dispatch to restricted action sets. The live five-tier/opponent model
replaces level-only selection; migrate in-tree menus, launch requests, training
Fight, developer setup, reports and fixtures together without an old selector
or compatibility adapter. General strongest-play diagnostics explicitly select
**Wren + Expert**, avoiding a silent weaker default.

[#185](https://github.com/tompassarelli/smashcraft/issues/185) owns selection and
player-guide copy. [#186](https://github.com/tompassarelli/smashcraft/issues/186)
owns one aggregate calibration report across all 30 combinations: reaction,
execution, judgment/spacing, adaptation after a pattern switch, repetition,
successful/wrong reads, ahead/behind risk, and proactive/defensive/kit activity.
Fixtures must show secondary growth as well as dominant tendencies: Rook's
close conversion and initiative, Ember's reads and defensive techs, Flint's
adaptation, Vale's offense, Kite's disciplined conversions and Wren's pressure.
One controlled exploit per identity/tier exposes its enduring opening; it need
not guarantee a player win. Pairwise win rates help order difficulty but do
not replace behavior measurements, imply human rank or require identities to
tie every matchup. Keep existing difficulty, whole-roster kit coverage and
fighter-balance gates; never lower their thresholds. Hosted sweeps use explicit
revision/seed sets. Fairness, five-frame commitment and replay determinism
remain hard checks.

## Calibration report

From ts/, `bun scripts/cpuCalibration.ts --out build/cpu-calibration/report.md
--json build/cpu-calibration/report.json` collects all 30 authored rows using
the same ten seeds (0–9). The default supplies ten eligible decisions per seed
for each measure. `--trials-per-seed N` changes the sample count; fewer than
100 decisions per measure fails collection. `--revision SHA` records the
revision explicitly; otherwise the command records Git HEAD. The hosted route
is `gh workflow run cpu-calibration.yml -f ref=COMMIT`; its summary and
cpu-calibration artifact contain the numerical report.

Controlled situations call the real shared policy: an unexpected side change,
shield, jump, smash or shot; a legal tumbling tech; neutral move selection at
two distances; a close whiff-punish opportunity; learned strikes followed by
shield events; the same move's value ahead and behind; a visible incoming
strike; and Rifleman's ready short-hop blaster. Reaction distributions include
the cases with no changed input within the observation delay plus 30 frames.
The same seeded decision sequence is restored and replayed in each sample.
Direction requests include neutral braking and measure actual reversals.

The command fails insufficient collection, an early reaction, a direction
reversal inside five frames or any restored-state difference. Close conversions
play the chosen punish for 60 simulation frames and count actual connections.
Developmental checks require each named primary/secondary outcome to improve
from Rookie to Expert without falling between adjacent tiers; Flint's pattern
switch must improve at every tier. Each identity also faces its named bait:
Rook's brief speculative opening, Ember's extra pressure attack, Flint's
conditioned forward tilt, Vale's feinted reset, Kite's guarded ledge escape
and Wren's chased uncertain retreat. Each counter plays for 60 frames and must
catch at least one eligible commitment at every tier, counting damage or a
grab. Counts and distributions remain visible when a check fails. Difficulty,
whole-roster kit use, balance and native parity retain their separate gates.

Use the existing hosted difficulty and field commands for their original
thresholds (Expert wins at least 95/100 against Rookie; every fighter lies
within 45–55% against the Wren Expert field at 400 matches per pair), and the
existing kit/recovery/gameplan contracts for whole-roster coverage. Reuse a
passing result only while its covered policy is unchanged. Calibration rows
change one measured behavior at a time; never retune fighter stats or relax a
coverage/rank assertion to make an AI report pass. These are authored
Smashcraft measurements, with no human rating or imitation claim.

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
gameplan's spacing tool when one fits, so punishes keep each fighter's identity, else its fastest. A grab
is thrown only when the opponent's position, not just its body's edge, is in
reach, since grabs catch a narrower body and a missed grab is punished in
turn. With nothing in reach it runs in when a move would arrive in time
(a jab out of a run is the dash attack), and a shield lets go only for a
grab. It runs after defense and before the attack pause and idle
stretches, so a profile's pause doesn't eat the window; the profile gates it
with its delayed perception, the punish share and the misjudgment, each drawn
on the window's key under the match seed. Scripted checks:
smashcraft:ts/src/game/match/botPunishContracts.tests.ts.

## Determinism and the match seed

Every computer decision is a function of the match state, its bounded
opponent-observation history, its direction commitment and the frame,
drawn with `botChoice` (a scramble of 32-bit-safe integers), so each client
and every rollback re-simulation derives the same input. Selected identities, resolved identities and tiers live in
`MatchState.cpuOpponents`, `MatchState.cpuResolvedOpponents` and `MatchState.cpuTiers` and the seed in `MatchState.matchSeed`, both in the
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
`bun scripts/cpuTiers.ts` measures Wren at the five tiers against each other
(smashcraft:docs/typescript.md).

The field calls `produceComputerInput`, which delays the observation before
choosing any response. `PERCEIVED_SKILLS` has zero extra reaction frames only
inside that already delayed policy, so defense and punish do not wait twice.
It is not a zero-delay field opponent. Expert strength comes from its existing
fallible, conditioned reads and prepared sequences; the reaction change does
not alter fighter numbers or gameplan weights.
