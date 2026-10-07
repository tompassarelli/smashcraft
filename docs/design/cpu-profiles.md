# Computer opponents: difficulty and style

Choose **Difficulty** and **Opponent style** independently. Difficulty has
exactly five tiers: **Rookie, Beginner, Intermediate, Advanced, Expert**.
Each offers the same six styles, giving 30 combinations. These are authored
Smashcraft difficulty settings, with no claimed equivalence to human ratings.
Design ownership: [#183](https://github.com/tompassarelli/smashcraft/issues/183).

## Difficulty

Rookie leaves obvious openings; Beginner understands basic exchanges;
Intermediate combines a plan with inconsistent decisions; Advanced punishes
ordinary mistakes; Expert is extremely hard but beatable. Strength comes from
reaction, execution, judgment, spacing and adaptation together. Styles shape
that strength: fast mechanics can accompany a simple plan, and a patient,
strategic opponent can react more slowly. Expert combines strong mechanics and
strategy without erasing those differences.

Initial authored tuning below is a starting specification, not a measured
win-rate or human-skill calibration. Percentages are seeded decision shares;
they never change damage, hit regions, movement speed or legal action windows.

| Base dimension | Rookie | Beginner | Intermediate | Advanced | Expert |
| --- | ---: | ---: | ---: | ---: | ---: |
| Observe a new opponent action after (60 Hz frames) | 36 | 30 | 24 | 18 | 12 |
| Correctly execute an intended eligible technique | 50% | 65% | 80% | 90% | 96% |
| Use context-sensitive move value instead of a familiar simple choice | 25% | 40% | 60% | 80% | 95% |
| Correctly judge matchup reach / punish window | 40% | 55% | 70% | 85% | 95% |
| Observations retained per relevant context | 4 | 8 | 12 | 20 | 32 |
| New observations between history updates | 4 | 3 | 2 | 1 | 1 |
| Observations needed before a learned read | 2 | 3 | 3 | 4 | 5 |
| Observed pattern share needed for a learned read | 50% | 60% | 65% | 70% | 75% |
| Repeat a familiar eligible answer rather than reconsider | 70% | 55% | 40% | 25% | 15% |
| Weight given to likely punishment, relative to full evaluation | 50% | 65% | 80% | 90% | 100% |

An execution miss produces a legal late, dropped or simpler input, never
impossible movement. A judgment miss evaluates a limited candidate set or
misjudges observed spacing; it does not secretly inspect a future action.
History covers neutral approach, shield/escape, landing and ledge choices,
partitioned by relevant spacing. Short history and slower updates make low
tiers repeat stale plans. A read is a fallible commitment based on that history;
low tiers also guess without sufficient evidence, independently of learned reads.

Move value considers estimated success, damage or kill reward, punish risk,
and resulting position at the relevant percent. Losing stocks or running out
of time increases willingness to take a high-variance comeback option. Difficulty
improves risk judgment; it does not simply make every stronger opponent safer.

## Six styles

These descriptions and the **Strong at / Watch for** phrases are final menu copy.

| Style | Description | Strong at | Watch for |
| --- | --- | --- | --- |
| All-rounder | Mixes pressure, defense and movement. | Varied choices | Predictable resets |
| Technician | Moves quickly and strings attacks together. | Fast execution | Baited commitments |
| Strategist | Controls space and learns your habits. | Spacing and adaptation | Sudden pressure |
| Rushdown | Stays close and keeps the pressure on. | Sustained pressure | Overextended attacks |
| Counterpuncher | Waits for an opening, then strikes. | Defense and punishes | Grabs and feints |
| Wildcard | Changes pace and takes bold chances. | Unpredictable choices | Risky recoveries |

Apply the following offsets to each tier's base dimensions. Clamp percentage
shares to 5–98%, reaction to at least 12 frames, retained observations to at
most 32, and update/evidence counts to at least one. Style preferences then
weight eligible actions within the fighter's own gameplan; every fighter
retains its kit and recovery choices. These are six parameter sets over one
decision policy, not 30 separate opponents.

| Style | Reaction | Execution | Judgment / spacing | History / repetition | Risk and enduring bias |
| --- | --- | --- | --- | --- | --- |
| All-rounder | Base | Base | Base / base | Base / base | Base; resets to a familiar neutral plan |
| Technician | −3 frames | +12 points | −12 / −8 points | Updates one observation slower; repeat +10 points | Punish weight −10 points; favors rehearsed movement and strings |
| Strategist | +6 frames | −8 points | +12 / +12 points | Retain +8; update one observation sooner; repeat −10 points | Punish weight +10 points; learned-read threshold +5 points; favors stage control |
| Rushdown | −2 frames | +5 points | −5 / −5 points | Repeat +10 points | Punish weight −20 points; favors closing distance and extending advantage |
| Counterpuncher | Base | +5 points | +5 / +8 points | Learned-read threshold +5 points; repeat +10 points | Punish weight +15 points; favors defense and confirmed punish windows |
| Wildcard | +2 frames | −5 points | −5 / base | Repeat −15 points; retained history halved | Punish weight −15 points; favors varied routes and occasional speculative commitments |

No style weakens the human-reaction floor or five-frame direction commitment
from [#176](https://github.com/tompassarelli/smashcraft/issues/176). A prepared
sequence or prediction may act before a new opponent action occurs; a response
to unexpected new information must wait for that combination's delay.
Delayed observations and history/value evaluation are owned by
[#182](https://github.com/tompassarelli/smashcraft/issues/182).

### Variety at every tier

Each cell states a recognizable strength and an opening the player can exploit.
Expert openings are smaller, requiring deliberate baiting or changing a habit.

| Style | Rookie | Beginner | Intermediate | Advanced | Expert |
| --- | --- | --- | --- | --- | --- |
| All-rounder | Tries several moves; obvious pauses | Uses basic offense/defense; repeats resets | Covers common options; predictable transitions | Mixes exchanges well; familiar neutral resets | Strong across the kit; bait its preferred reset |
| Technician | Quick rehearsed inputs; unsafe repetition | Simple strings; chases bad openings | Clean movement/combos; limited adaptation | Precise conversions; baitable commitments | Excellent execution; outsmart its rehearsed follow-up |
| Strategist | Has a plan; slow reactions and poor reach judgment | Holds useful space; loses to sudden pressure | Learns habits; slower emergency answers | Adapts and controls space; interrupt its setup | Excellent reads/positioning; change pace before it can respond |
| Rushdown | Runs in often; easy whiff punishes | Maintains pressure; overextends | Converts close openings; chases too far | Strong advantage; bait the next extension | Relentless pressure; punish a committed extension |
| Counterpuncher | Shields and waits; easy grabs | Finds obvious whiffs; passive resets | Reliable punishes; susceptible to feints | Strong defense; concedes initiative | Precise punishes; condition defense then grab or feint |
| Wildcard | Varied attempts; poor landings | Surprises with route changes; unsafe gambles | Changes tempo; inconsistent conversions | Difficult to read; voluntary risky routes | Strong varied choices; recognize and punish its bold recovery |

## CPU-slot selection

The card keeps the fighter portrait/chip and shows a compact summary:
`CPU 2 · Intermediate · All-rounder`, followed by **Opponent settings**.
Place that button below the chip's drag area; choosing it never picks up the
chip. The existing slot owner or first human may edit it; others can read the
summary and open a read-only preview saying **Only the slot owner or first
player can change this opponent.** Changing fighter preserves both choices.

Open a centered panel over the roster, with one CPU slot at a time:

```text
CPU 2 — Opponent settings                         [Close]

Difficulty        ‹ Intermediate ›
Opponent style    ‹ Strategist   ›

Controls space and learns your habits.
Strong at: Spacing and adaptation
Watch for: Sudden pressure

[Done]
Move: W/R + Space/E   Choose: N   Back: U
```

The last line uses the player's actual bindings; controller input displays
**Move: Stick or D-pad · Choose: A · Back: X**. The default keyboard preset
uses W/R for left/right, Space/E for up/down, N for Choose and U for Back.
Use the same input actions as other menus; do not use Enter (Warcraft chat).

1. From the roster, move to **Opponent settings** and press Choose. CPU cards,
   including their settings buttons, participate in menu focus; keyboard and
   controller never require a pointer to reach them.
2. Panel focus starts on Difficulty. Up/down visits Difficulty, Opponent style,
   then Done. Left/right changes the focused value; Choose on a value advances
   it once. Difficulty stops at Rookie/Expert; style cycles the six styles and
   Random. Changed values apply immediately and update the preview.
3. Choose on Done, Back, or Close closes the panel and returns focus to the
   settings button. Closing retains changes; there is no hidden Save step.
   Start also closes the panel, consuming that press, so it cannot start a
   match behind the panel. Release is required before another menu action.
4. Mouse clicks on arrows perform the same changes. Only committed value
   changes are shared; focus and preview are local. A shared update refreshes
   an open preview, and losing edit permission changes it to read-only.

New CPU slots default to **Intermediate + All-rounder**, an approachable mix
without a surprise specialization. Retain slot choices across New Match,
fighter/stage changes and automatic rematches for the map session. No new
cross-session storage is needed. Training's **Fight** uses these choices;
Stand/Shield/etc. retain their explicit training behavior.

**Random** changes only style, with preview **A different style each match.**
and no fixed strength/weakness preview. Choose uniformly from the six styles
once at match start using the shared match seed, retain the resolved style
through rollback/replay, and reveal it in the countdown and results, such as
`CPU 2 · Intermediate · Wildcard`. Each rematch draws again; repeated draws
are allowed. The selection panel continues to show Random until changed.

## State and calibration contract

Selection and match state name the difficulty tier, selected style (including
Random), resolved style, and bounded observation/commitment history per CPU.
Include them in snapshots, canonical comparisons and full-match replays.
Resolve all decisions with the existing seeded integer draws; no clock,
client-local randomness, hidden opponent inputs or private future state.
Use stable identifiers distinct from display copy.

The five-tier model replaces the live level-only choice. Migrate in-tree menus,
launch requests, training Fight, developer setup, reports and fixtures together;
retain no competing level selector or compatibility adapter. Named diagnostic
workloads explicitly select Expert + All-rounder when they need strongest
general play; changing the normal menu default must not silently weaken them.

Calibration reports all 30 combinations using seeded controlled opponents:
reaction delay, execution success, punish/spacing judgment, adaptation after
a pattern change, familiar-answer share, read success/wrong reads, and risk
when ahead versus behind. A fixed-tier style report must distinguish Technician
mechanics from Strategist planning and expose each documented weakness.
Pairwise win rates help order tiers, but are not the only strength measure;
styles need not tie in every matchup. Run difficulty, whole-roster kit coverage
and existing fighter balance gates on the integrated policy without lowering
their thresholds. Farm sweeps use explicit revision/seed sets; fairness,
direction commitment and deterministic replay remain hard checks.

Implementation boundaries: [policy and replay state #184](https://github.com/tompassarelli/smashcraft/issues/184)
composes the tier/style model over #182; [selection #185](https://github.com/tompassarelli/smashcraft/issues/185)
owns controls and copy; [calibration #186](https://github.com/tompassarelli/smashcraft/issues/186)
owns the aggregate behavior report and tuning.
