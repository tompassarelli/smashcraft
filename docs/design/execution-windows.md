# Execution and reaction windows

Reference for how tight execution and reaction windows are in other games, what
human perception and motor control allow, and where Smashcraft's windows sit.
It follows from "non-interactive execution is dubious" in
[gameplay design decisions](../gameplay-design.md#l-cancelling): a window is
worth its difficulty only when it is part of an exchange with the opponent.

A frame is 1/60 s = 16.7 ms. A window of N frames means N consecutive frames in
which the input is accepted. Numbers marked (secondary) come from wikis, forum
posts or search summaries and were not checked against game data or developer
statements. Retrieved 2026-10-06.

## Windows other games use

| Game | Window | Frames | Source |
|---|---|---|---|
| Melee | Tech (shield press before floor contact) | 20, then 40-frame lockout after hitlag | [SmashWiki Tech](https://www.ssbwiki.com/Tech) |
| Melee | L-cancel (L/R/Z before landing) | 7 (up to 6 after hitlag) | [SmashWiki L-canceling](https://www.ssbwiki.com/L-canceling) |
| Melee | Ledge intangibility | 30 + 7 grab animation (37) | [SmashWiki Edge](https://www.ssbwiki.com/Edge) |
| Melee | Ledgedash: earliest release | frame 9 of the hang; 0 to 15 grounded actionable intangible frames by character (Fox and Pichu 15, Peach 0) | [SmashWiki Ledgedash](https://www.ssbwiki.com/Ledgedash) |
| Melee | Wavedash landing lag | 10 frames without attacking; jump squat 3 to 6 by character. The page gives no input-window frame counts | [SmashWiki Wavedash](https://www.ssbwiki.com/Wavedash), [Jump](https://www.ssbwiki.com/Jump) |
| Melee | Input buffering | none in general; a few actions buffer 2 to 3 frames | [SmashWiki Buffer](https://www.ssbwiki.com/Buffering) |
| Project M | 1-frame changes counted as real execution relief (backdash tolerance, short-hop last-squat-frame fix, DACUS 2 frames) | 1 to 2 | [Critpoints](https://critpoints.net/2015/11/02/execution-in-pm-vs-melee/) |
| Ultimate | Tech | 11 (Smash 4: 8) | [SmashWiki Tech](https://www.ssbwiki.com/Tech) |
| Ultimate | Hit buffer | 9 (Brawl and Smash 4: 10) | [SmashWiki Buffer](https://www.ssbwiki.com/Buffer) |
| Ultimate | Hold buffer | a held input acts as soon as possible if held until at most 3 frames before (secondary) | [Smashboards](https://smashboards.com/threads/ultimate-buffering-system.465269/) |
| Ultimate | Jump squat and short hop | 3 for almost every character (Kazuya 7); release of jump within the squat gives a short hop | [SmashWiki Jump](https://www.ssbwiki.com/Jump) |
| Ultimate | Directional air dodge windup | 5 | [SmashWiki Wavedash](https://www.ssbwiki.com/Wavedash) |
| Ultimate | Ledge intangibility | 23 to 123 by damage and air time (about 63 fresh); at most 6 grabs before landing, each regrab reduces it | [SmashWiki Edge](https://www.ssbwiki.com/Edge) |
| Street Fighter V | Link | 1-frame links of SF4 became 3-frame links; smallest buffered window 5 (secondary) | search summary of community posts |
| Street Fighter 4 | Sakura's bread-and-butter 1-frame link, the standard example of a barrier | 1 | [Sirlin](https://www.goodreads.com/author_blog_posts/2725327-execution-in-fighting-games?tab=book) |
| Tekken 7 | Input buffer | 8 (window of 9 including the motion); some inputs need exact 1-frame simultaneity (Electric Wind God Fist) (secondary) | search summary |
| Guilty Gear Strive | Attack button buffer | 5 (secondary) | search summary |
| Rivals of Aether II | Parry | 5 startup, 8 active, 37 end lag; a community proposal keeps a 10-frame window as 4 to 14 (secondary) | search summary of the game's forum and workshop |

Not retrieved in this pass: Street Fighter link windows by move, Tekken and
Guilty Gear link or cancel windows, Melee's wavedash input window, and
developer statements on buffer lengths. Add them with their source when found.

## Human limits

- **Simple reaction time.** About 190 ms to a visual stimulus and 160 ms to a
  sound in laboratory tasks ([Mental chronometry](https://en.wikipedia.org/wiki/Mental_chronometry)).
  Reviews give 180 to 200 ms and 140 to 160 ms ([Kosinski review summarized by BioNumbers](https://bionumbers.hms.harvard.edu/bionumber.aspx?id=110800)).
  Measured on a screen with a controller, about 200 to 250 ms is the working
  range, i.e. 12 to 15 frames, before any display or input latency. Ultimate
  alone adds roughly 6 frames of fixed delay ([SmashWiki Frame delay](https://www.ssbwiki.com/Frame_delay)).
- **Auditory advantage.** Sound is about 40 ms (2 to 3 frames) faster to
  respond to than light, because the stimulus reaches the brain in 8 to 10 ms
  rather than 20 to 40 ms.
- **Choice reaction time.** Hick's law: T = b · log2(n + 1) for n equally likely
  options, b empirical ([Hick's law](https://en.wikipedia.org/wiki/Hick%27s_law)).
  Two options cost log2(3) = 1.58 b, four 2.32 b, eight 3.17 b. Where one
  stimulus must be chosen from several responses, the simple reaction time is
  a floor, not the expected time. The value of b was not retrieved; Hick and
  Hyman measured with 10 lamps and keys.
- **Timing precision.** Professional percussionists' inter-tap interval
  variability (coefficient of variation) was 0.052, non-percussionists' 0.115
  ([Frontiers in Human Neuroscience 2014](https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2014.01003/full)).
  The retrieved summary gives no millisecond figures; at an assumed 500 ms interval those
  are about 26 ms and 58 ms standard deviation, i.e. 1.6 and 3.5 frames. This
  is tapping to a beat, not hitting a game window, so it is only an order of
  magnitude: even trained timing is wider than a 1-frame window.
- **Precision aids.** Plinking (alternating or rolling buttons so that one of
  several presses lands in a narrow window) and buffering are the community's
  answers to windows below human precision; a game that needs them has a
  window narrower than its players. No source was retrieved for plinking
  specifically.

## How designers reason about tightness

- **Sirlin.** "The more a game is about the difficulty of making your character
  do what you want to do, the necessarily less it is about strategy." He
  treats 1-frame links as execution that excludes players without adding
  strategy and prefers lowering them (SF4 Sakura example) over weakening the
  character ([Execution in Fighting Games](https://www.goodreads.com/author_blog_posts/2725327-execution-in-fighting-games?tab=book)).
  Retrieved through a summary of the Goodreads copy; the original page was not
  reachable.
- **Execution does not equal depth.** Critpoints argues that a frame or two of
  tolerance, as Project M gave, does not change the strategic game
  ([Execution in PM vs Melee](https://critpoints.net/2015/11/02/execution-in-pm-vs-melee/)).
- **Buffers.** Brawl introduced a universal 10-frame buffer and Ultimate
  shortened it to 9, so successive designers keep a buffer near a sixth of a
  second ([SmashWiki Buffer](https://www.ssbwiki.com/Buffer)). A general
  article advises a buffer "forgiving but not overly generous", per move
  ([Wayline](https://www.wayline.io/blog/input-buffering-fighting-games));
  it gives no frame counts.
- **Why Smash removed execution tests.** Sakurai judged L-canceling and
  wavedashing to widen the gap between beginners and advanced players too much
  ([SmashWiki L-canceling](https://www.ssbwiki.com/L-canceling)).
- **Smashcraft.** Owner decision #54 removed L-cancelling, accepting the
  principle in [gameplay design decisions](../gameplay-design.md).

## Smashcraft's windows today

| Window | Frames | Where |
|---|---|---|
| Tech press window; lockout between presses | 20; 40 | smashcraft:ts/src/game/physics/techInput.ts |
| Tech intangibility; tech roll | 20; 34 | smashcraft:ts/src/game/sim/conditions.ts |
| Wall tech startup; wall-tech jump input; wall jump stick flick | 5; 20; 3 | conditions.ts, smashcraft:ts/src/game/sim/fighter.ts |
| Attack buffer (human) | 6 | smashcraft:ts/src/game/input/attackBuffer.ts |
| Powershield input; fast-fall input; platform drop input | 2; 4 (age below); 6 | fighter.ts, [physics.md](../physics.md) |
| Jump squat (Archer, Rifleman); release inside it gives a short hop | 3; 5 | [physics.md](../physics.md) |
| Ledge catch intangibility; regrab lock after release or interruption | 30; 30 | smashcraft:ts/src/game/sim/ledge.ts, transitions.ts |
| Knockdown bound; down wait; get-up attack input age; down recovery intangibility | 26; 220; under 60; 20 to 27 | smashcraft:ts/src/game/sim/down.ts, conditions.ts |
| Demon Hunter parry | 4 to 9 inclusive | smashcraft:ts/src/game/sim/hits.ts |
| Roll, spot dodge, air dodge intangibility | 4 to 19; 2 to 15; 4 to 29 | [physics.md](../physics.md) |
| Dash to run command; run brake opposite-input window | 12 or 16; through 14 | [physics.md](../physics.md) |
| Late dash guard grab | 3 | smashcraft:ts/src/game/sim/step.ts |
| Shield release lag; minimum shield hold | 11; 8 | [physics.md](../physics.md) |
| L-cancel; wavedash input timing | none; not a defined window | [gameplay design decisions](../gameplay-design.md) |

## Bounds adopted for Smashcraft

The recommendations below were adopted 6 Oct 2026 through the owner's blanket
authorization to carry out the proposed work. The authoritative decisions and
check scope are in [gameplay design decisions](../gameplay-design.md#execution-and-reaction-windows-69).
These are chosen design bounds; the evidence does not establish that every
value inside a range is equally usable. Frame figures at 60 fps.

| Window type | Lower | Upper | Evidence | Today |
|---|---|---|---|---|
| Reaction-based option (the responder must see something and then act) | 15 frames from the first visible cue, for one option | 15 plus Hick growth for several options; at 4 options about 25 | Visual reaction 190 to 250 ms is 11 to 15 frames before display and input latency; choice time rises with log2(n + 1) | not measured |
| Tech (defensive press before contact) | 11 | 20 | Ultimate 11, Melee 20 | 20 |
| Tech lockout between presses | 20 | 40 | Melee 40; no source for a lower value, so the lower bound is a guess | 40 |
| Input buffer | 4 | 10 | Strive 5, SFV smallest 5, Tekken 8, Ultimate 9, Brawl 10 | 6 |
| Offensive link or follow-up (a required timing between two actions) | 3 | none beyond the move's own timing | Sirlin on 1-frame links; SFV widened them to 3; expert tap spread of about 1.6 frames | no required links |
| Jump squat; short-hop release window | 3 | 5 | Ultimate 3; Melee 3 to 6 | 3 and 5 |
| Parry active window | 6 | 10 | Rivals II 8 active; proposal keeps 10 | 6 |
| Powershield input window | 2 | 4 | Melee-derived 2; the buffer lower bound and human spread of a frame or two argue against 1 | 2 |
| Ledge intangibility | 30 | 37 | Melee 30 plus 7 grab animation; Ultimate decays by regrab | 30 |
| Ledge regrab lock | 30 | 60 | Melee 30; Ultimate limits grabs to 6 per airtime instead; the upper bound is a guess | 30 |
| Any required precision input (no aid available) | 3 frames | n/a | The tap-precision figures above: a 1-frame requirement is narrower than even expert variability | L-cancel removed |

Required ordinary-play inputs have at least 3 accepted frames. Reaction-based
options have at least 15 frames after the first visible cue, with a larger
budget for choices. Optional precision rewards can be tighter. The four-choice
25-frame target is a design budget: the empirical Hick coefficient remains
unretrieved.
