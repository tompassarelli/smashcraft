# Human input consistency

How consistently real Melee players execute inputs, measured from Slippi
replays. It calibrates the computers' human noise (#354 reactions, #356 dash
dance and execution slips, #357 DI, SDI and jump height) and is a general model
to reuse if a similar mechanic ever appears. Every Melee technique is measured,
including ones Smashcraft doesn't have.

**Source.** [erickfm/melee-ranked-replays](https://huggingface.co/datasets/erickfm/melee-ranked-replays)
(MIT; anonymized Slippi online ranked games, 2023). Rank groups are the
dataset's matched pairs: **master-master** (1,267 games, 7,599 player-minutes),
**diamond-diamond** (411 games, 2,552) and **platinum-platinum** (405 games,
2,540). Characters: Fox, Falco, Marth, Sheik, Jigglypuff, Captain Falcon,
Peach. Two-human games of at least one minute only. The dataset starts at
platinum, so there is no data below it. Measured 9 Oct 2026. Rerun:
smashcraft:tools/slippi/README.md.

**Level mapping.** Master → Expert, diamond → Advanced, platinum →
Intermediate. Beginner and Rookie have no data and keep their guesses.

**Reading the numbers.** Times are 60 Hz frames. Inputs are the processed
stick and the physical buttons in each frame's pre-frame record. States are
the post-frame action state. Online replays record each opponent action on the
game frame it happened, while the player saw it a few frames later (online
delay and rollback). Reaction times below therefore include that lag, which
is the same frame-to-input number a computer reading the game state produces.
Ranks differ much less than expected. Platinum ranked players are already
committed players, so the contrast is master against the upper-middle ladder,
not against beginners.

## Kinds of input consistency

Each kind is a precise class of input task. "Success" is the share done right.
"Error" is the timing error in frames as mean ± standard deviation.

| Kind | Definition | Melee techniques measured | Master | Diamond / platinum | Smashcraft today |
|---|---|---|---|---|---|
| **Press in a window after an event** | One press must land inside a fixed window that ends at a game event the player predicts (landing, ground contact). | L-cancel (7-frame window before aerial landing); tech (20-frame window before contact, 40-frame lockout) | L-cancel 87.5% success, last press 3.6 ± 3.0 frames before landing, 7.9% no press, 4.6% too early. Tech 47.9% success, press 11.6 ± 10.7 before contact | L-cancel 86.2% / 83.4%; tech 47.4% / 47.3% | L-cancel: none (removed, #54). Tech: the tech press before landing |
| **Hold for a duration, then release** | A button must be released before a deadline that starts at its own press. | Short hop by releasing X/Y before the end of jumpsquat | Short-hop hold median 2 frames (p10–p90 1–4); release 1.7 ± 0.7 frames before the deadline; accidental full hop 0.9% of quick-aerial jumps | release 1.8 ± 0.7 / 1.8 ± 0.7; accidental full hop 1.2% / 1.6% | Pad short hop by release during jump startup; the short-hop button always short hops (#357 jump height) |
| **Fast two-input sequence** | A second input must follow the first on a specific frame. | Wavedash: jump, then airdodge on the first frame it's allowed | 87.0% on the earliest frame, 11.1% one frame late, 1.9% two or more late; delay 0.18 ± 0.66 | earliest 85.9% / 83.0%; ≥ 2 late 2.3% / 2.4% | Wavedash (air dodge out of jump squat) |
| **Stick-angle precision** | The stick angle at one input sets the outcome's size. | Wavedash angle below horizontal | median 40.9° (p10–p90 27.9–48.1°); one player's own angles vary by 6.5° sd | 40.9° / 41.9°; 6.3° / 6.1° sd | Wavedash length; air dodge direction |
| **Repeated rhythm** | The same alternating input repeated at a chosen interval. | Dash dance (full left↔right reversals); multishine | Dash dance interval min 1, p1 3, p5 4, p10 4, median 6, p90 13 (7.6 ± 3.8); 2.0% under 4 frames. Multishine: 1 sequence in 1,267 games, so match play gives no rhythm data | median 7 / 7, p90 14 / 14; under 4 frames 2.3% / 2.3% | Dash dance (#356) |
| **Overshoot of a held input** | A held direction kept a few frames too long produces an unwanted state. | Dash that becomes a run, braked or turned within 6 frames | 0.58 per minute, 17.4% of runs | 0.46 / 0.50 per minute | Unintended runs (#356) |
| **Reaction-gated input** | An input that can only be right after seeing the opponent's choice. | Tech chase: stick fully toward the opponent's tech roll | 23.9% move before 12 frames (guesses). From 12 frames: p5 15, p10 16, p25 19, median 21, p90 33 (22.7 ± 6.1) | median 22 / 23, p5 16 / 14 | Computer reaction floors (#354) |
| **Directional hold under pressure** | A direction held during a short freeze (hitlag) changes the outcome. | DI on the launch frame; SDI during hitlag | DI on 82% of knockback hits (perpendicular 52.5%); at kill percent no DI 13.9% and survival-shortening DI 32.6% (proxy). SDI on 38.0% of strong hits, 12.2% of multi-hit follow-ups | no DI at kill percent 17.2% / 17.8%; SDI on strong hits 31.2% / 31.2% | DI (#357); SDI: none yet |
| **Timing against own habit** | A repeated timed input drifts from the player's usual frame. | Short-hop aerial frame after takeoff, against that player's median for that aerial | within ±1 frame 59.4%; 3+ frames late 17.4%; deviation sd 4.7 frames | 59.5% / 57.4%; 18.3% / 18.4% late | Aerial timing and drift (#357) |
| **Option substitution** | A different legal option comes out where the player usually picks another. | Roll out of shield by players who usually wavedash out of shield | 22.8% of their shield exits (294 players), proxy | 24.5% / 21.4% | Execution miss "simpler input" (#356) |

## Measure definitions

1. **Dash-dance reversal interval.** A reversal is a frame where the stick
   reaches full deflection (|x| ≥ 0.8) on the side opposite the last full
   deflection. The interval is the frames since that previous reversal,
   counted only when every frame between them was Dash or Turn and the
   interval is at most 30. The 1–3 frame tail (2%) likely includes stick
   snapback, which is hardware noise rather than intent.
2. **Unintended run.** A Dash → Run transition followed by RunBrake or TurnRun
   within 6 frames, without leaving Run first. It's a proxy: some immediate
   brakes are deliberate.
3. **DI.** A hit is a frame where hitlag starts while the victim is in a damage
   state. The DI stick is the stick on the first frame after hitlag, and the
   launch vector is that frame's knockback velocity, which already includes
   the DI. Classes, for hits with launch speed ≥ 1.0: **none** if the stick's
   magnitude is below 0.2875; otherwise **away** (within 45° of the launch),
   **in** (within 45° of the opposite) or **perpendicular**. **Kill-percent
   hits**: 100% or more after the hit, launch speed ≥ 3.0 (knockback 100) and
   upward. **Survival-shortening DI** is a proxy. Below 60° from horizontal,
   survival rotates the launch toward vertical (up and in). From 60° to 80°,
   survival rotates it toward horizontal. Above 80°, either way survives. A
   perpendicular component ≥ 0.3 that rotates the wrong way counts as a slip.
   The rule ignores stage position, so treat "wrong way" as an upper bound.
   "No DI" is the robust number.
4. **SDI.** An SDI input is a hitlag frame, after the first, where either stick
   axis crosses |0.7| from below. **Strong hit**: hitlag ≥ 9 frames.
   **Multi-hit follow-up**: a hit starting within 15 frames of the previous
   hit's hitlag end, hitlag ≥ 3.
5. **Jump hold.** The press is an X or Y rising edge on the first jumpsquat
   frame or the frame before it. The hold is the frames it stays pressed. The
   deadline is the frames from the press to the last jumpsquat frame. A hold
   shorter than the deadline is a short hop. **Accidental full hop (proxy)**
   applies to jumps with an aerial within 12 frames of takeoff. It counts the
   full hops released exactly at the deadline beyond the average of those
   released 1 and 2 frames after it. The excess is the near-miss bump.
6. **Technical slips.** L-cancel success uses Slippi's own L-cancel status on
   aerial landings, with the timing taken from the last L, R (digital or
   analog ≥ 0.3) or Z press within 30 frames before landing. A **late aerial**
   is a short-hop aerial whose frame after takeoff is 3 or more past that
   player's median for that aerial in that game (at least 5 samples). **Roll
   for wavedash** counts out-of-shield rolls among players who wavedashed out
   of shield at least 3 times and in at least 60% of those exits. Both are
   proxies: delayed aerials and deliberate rolls count as slips.
7. **Reactions.** The opponent starts a forward or backward tech roll within 60
   units of a player who is idle on the ground and isn't already holding
   toward the roll. The reaction is the frames until the stick is fully toward
   the roll (|x| ≥ 0.8), up to 40 frames. Responses under 12 frames come
   before the roll can be told apart, so they count as guesses. A first
   attempt measured shield and jump presses after nearby ground attacks
   instead. Its distribution fell steadily from 1 frame with no reaction hump,
   so it measured simultaneous decisions, not reactions, and was dropped.

Wavedash timing counts a jumpsquat followed by an airdodge within 8 frames of
takeoff and a landing within 15 frames after it. Its angle uses wavedashes with
|x| ≥ 0.3. Tech success is the share of hitstun or tumble landings that end in
a tech state instead of a missed-tech bounce.

## Measured table

Produced by `bun report.ts` in smashcraft:tools/slippi/ on the sample above.

| Measure | master-master | diamond-diamond | platinum-platinum |
|---|---|---|---|
| Games / player-games / minutes | 1267 / 2534 / 7599 | 411 / 822 / 2552 | 405 / 810 / 2540 |
| 1. Dash-dance reversal interval, frames: min / p10 / median / p90 / max | 1 / 4 / 6 / 13 / 30 | 1 / 4 / 7 / 14 / 30 | 1 / 4 / 7 / 14 / 30 |
| 1. Reversals measured | 72028 | 19732 | 18408 |
| 1. Mean ± sd | 7.6 ± 3.8 | 7.9 ± 3.9 | 8.1 ± 4.1 |
| 1. Share under 4 frames | 2.0% | 2.3% | 2.3% |
| 1. p1 / p5 | 3 / 4 | 3 / 4 | 3 / 4 |
| 2. Dash-to-run entries per minute | 3.33 | 3.17 | 3.26 |
| 2. Unintended runs per minute (braked or turned within 6 frames) | 0.58 | 0.46 | 0.50 |
| 2. Share of runs that are unintended | 17.4% | 14.4% | 15.3% |
| 3. Hits with knockback (speed ≥ 1.0) | 81964 | 27377 | 26896 |
| 3. DI none | 18.0% | 19.9% | 22.0% |
| 3. DI in (against launch) | 12.0% | 12.1% | 11.9% |
| 3. DI away (along launch) | 17.4% | 17.3% | 16.5% |
| 3. DI perpendicular | 52.5% | 50.7% | 49.6% |
| 3. Kill-percent hits (≥ 100% after the hit, launch speed ≥ 3.0, upward) | 13837 | 4629 | 4662 |
| 3. Kill-percent slip (no DI or survival-shortening DI) | 46.5% | 47.2% | 47.4% |
| 3. … of which no DI | 13.9% | 17.2% | 17.8% |
| 3. … of which wrong way | 32.6% | 30.1% | 29.6% |
| 3. Kill-percent DI with no angle change (along or against) | 9.5% | 9.1% | 9.7% |
| 3. Slip on hits that took the stock | 43.7% of 4138 | 45.1% of 1327 | 44.6% of 1318 |
| 4. Strong hits (hitlag ≥ 9) with any SDI input | 38.0% of 3140 | 31.2% of 1005 | 31.2% of 997 |
| 4. SDI inputs per strong hit | 0.46 | 0.37 | 0.35 |
| 4. Multi-hit follow-ups with any SDI input | 12.2% of 11876 | 11.9% of 3851 | 11.0% of 3718 |
| 5. Button jumps measured | 161977 | 54861 | 54217 |
| 5. Short-hop share | 49.5% | 51.1% | 49.8% |
| 5. Short-hop hold, frames: min / p10 / median / p90 / max | 1 / 1 / 2 / 4 / 7 | 1 / 1 / 2 / 4 / 7 | 1 / 1 / 2 / 4 / 5 |
| 5. Short-hop release, frames before deadline: mean ± sd | 1.7 ± 0.7 | 1.8 ± 0.7 | 1.8 ± 0.7 |
| 5. Full-hop hold past deadline, frames: min / p10 / median / p90 / max | 0 / 1 / 5 / 15 / 37 | 0 / 0 / 5 / 17 / 37 | 0 / 0 / 5 / 14 / 37 |
| 5. Accidental full hop proxy (of jumps with an aerial within 12 frames) | 0.9% of 50414 | 1.2% of 17274 | 1.6% of 16125 |
| 6. Aerial landings with L-cancel status | 79641 | 24906 | 24191 |
| 6. L-cancel success | 87.5% | 86.2% | 83.4% |
| 6. No L/R/Z press in 30 frames before landing | 7.9% | 8.0% | 9.9% |
| 6. Last press, frames before landing: mean ± sd | 3.6 ± 3.0 | 3.8 ± 3.1 | 3.8 ± 3.2 |
| 6. Missed by pressing too early (≥ 7 frames before) | 4.6% | 5.8% | 6.7% |
| 6. Short-hop aerials vs own median | 31934 | 10908 | 9776 |
| 6. Aerial ≥ 3 frames later than own median | 17.4% | 18.3% | 18.4% |
| 6. Aerial within ±1 frame of own median | 59.4% | 59.5% | 57.4% |
| 6. Aerial timing deviation sd, frames | 4.70 | 4.78 | 4.84 |
| 6. Roll out of shield by players who usually wavedash out of shield | 22.8% of 2698 (294 players) | 24.5% of 683 (76 players) | 21.4% of 501 (58 players) |
| Wavedashes measured | 19286 | 6582 | 6942 |
| Wavedash airdodge on the earliest frame | 87.0% | 85.9% | 83.0% |
| Wavedash airdodge 1 frame late | 11.1% | 11.9% | 14.6% |
| Wavedash airdodge ≥ 2 frames late | 1.9% | 2.3% | 2.4% |
| Wavedash delay mean ± sd, frames | 0.18 ± 0.66 | 0.21 ± 0.72 | 0.23 ± 0.69 |
| Wavedash angle below horizontal, deg: p10 / median / p90 | 27.9 / 40.9 / 48.1 | 27.2 / 40.9 / 48.1 | 29.5 / 41.9 / 48.1 |
| Wavedash angle sd within a player, deg (median player) | 6.5 (1409 players) | 6.3 (457 players) | 6.1 (471 players) |
| Tech attempts on landing from hitstun or tumble | 20468 | 6719 | 6996 |
| Tech success | 47.9% | 47.4% | 47.3% |
| Tech: no L/R press in 40 frames before contact | 25.4% | 27.3% | 26.6% |
| Tech: last press, frames before contact: mean ± sd | 11.6 ± 10.7 | 11.9 ± 10.7 | 12.2 ± 10.8 |
| 7. Tech rolls chased (opponent within 60 units, chaser idle) | 809 (+228 with no response in 40) | 250 (+74 with no response in 40) | 231 (+87 with no response in 40) |
| 7. Stick toward the roll under 12 frames (guess, not reaction) | 23.9% | 22.8% | 19.5% |
| 7. Reaction, frames ≥ 12: p5 / p10 / p25 / median / p90 | 15 / 16 / 19 / 21 / 33 | 16 / 18 / 20 / 22 / 32 | 14 / 18 / 20 / 23 / 34 |
| 7. Reaction, frames ≥ 12: mean ± sd | 22.7 ± 6.1 | 23.2 ± 5.3 | 24.3 ± 6.3 |
