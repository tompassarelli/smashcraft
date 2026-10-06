# Interaction graph

Smashcraft's interaction graph, computed from its own move data and physics:
for each situation, the options both players have, which option beats which and
by how many frames, and the frames in which a punish lands. It is the
measurement layer of the design docs: it describes what the game does and holds
no opinion. The vocabulary (spaced, advancing and fading aerials, out of
shield, tech chases, the graph as a concept) is in
[platform-fighter design language](platform-fighters.md); what the graph
should look like is Tom's stance, written only in
[gameplay design decisions](../gameplay-design.md).

## The generated graph

One page per fighter, with every situation's tables and a Mermaid graph:
[Archer](../../tools/move-data/interactions/archer.md),
[Rifleman](../../tools/move-data/interactions/rifleman.md),
[Illidan](../../tools/move-data/interactions/illidan.md). The same numbers,
one JSON row per situation and variant, are in
smashcraft:tools/move-data/interactions/interactions.jsonl. Both are generated
output: never edit them by hand, and never treat them as tuning input.

Combo trees are measured by the same command. Their rows are in
smashcraft:tools/move-data/interactions/combos.jsonl, with each fighter's
report in smashcraft:tools/move-data/interactions/combos-FIGHTER.md. These
reports compare the measured strings and stock-taking paths with the accepted
[combo targets](../gameplay-design.md#combo-structure). A reported violation
feeds balance work; a passing regeneration check says the written measurement
matches the game, not that the fighter meets every balance target.

The guaranteed-string search selects a common true follow-up greedily by its
least immediate damage across the victim scripts. Its measured damage and
length describe that selected string, rather than an exhaustive maximum.
Stock paths use the beam and depth limits written in each generated report.
A read requires a sampled victim choice that escapes the committed move;
when every choice is hit after gaining freedom, the extension is unclassified
and is excluded from the reported stock paths.

From smashcraft:ts/:

- `bun wisp interactions` plays every situation and combo search for every
  fighter, one worker thread a fighter (three workers; run it in a finite
  capacity scope on a shared machine), and writes the rows and pages. The five
  original situations take about 10 s with three free cores; the bounded combo
  search also explores stock-taking routes and reports progress per opening.
- `bun wisp interactions --check` plays them again and lists every row added,
  removed or changed against the written files, with the changed fields; it
  also checks the combo rows and reports, and fails until the files are written
  again. smashcraft:tools/move-data/compare.sh
  `--check` runs it after the move comparisons.
- `bun wisp interactions --move FIGHTER:MOVE` (for example
  `archer:forward-air`, `rifleman:down-tilt`) plays that fighter's situations
  and prints every place the move appears, as an aerial on a shield, an out of
  shield option, a punish, a landing or a neutral option, then what changed in
  the fighter's graph since the files were written. This is how a new or
  changed move is evaluated against the graph, by move comparisons and by
  character creation.

Implementation: smashcraft:ts/scripts/interactions.ts (situations, engine,
pages), smashcraft:ts/scripts/interactionsWorker.ts and
smashcraft:ts/scripts/wisp/commands/interactions.ts.
smashcraft:ts/scripts/interactions.tests.ts pins two of Archer's rows: an
unspaced advancing down air on shield is -8 and punished by jump neutral air
and jump back air started 12 or 13 frames after contact; a spaced fade-back
forward air is -2 and safe.

## How it is measured

Every number comes from playing the situation through the match frame executor
from controller rows (smashcraft:ts/scripts/frameScene.ts, shared with the
Melee oracle), with the six-frame attack buffer a live match gives each player.
So the graph reads the authored timing, hit regions, landing lag, shield,
hitlag, hitstun and input rules exactly as a match does, not a second model of
them. Every situation is a mirror match on the flat stage at 0%.

- **Situation.** Two fighters placed in a starting state, each with a default
  input (stand, hold a shield, hang) and a frame 0. The engine plays it once,
  keeps the state at the start of every frame, and replays each option pair from
  the first frame an option starts.
- **Option.** An input script that starts on a frame: a press (jab, a tilt with
  walk held, a smash on the C-stick, grab, a dodge with the shield held), or a
  short sequence (jump out of shield with the aerial buffered in jump squat).
- **Option start.** The first frame on which pressing the option starts it on
  that same frame, found by searching press frames. A start counts only when the
  press causes it: an action the fighter was starting anyway, such as a buffered
  aerial at takeoff, is not the press's.
- **Acts.** The first frame on which a press of attack starts an attack: a jab,
  an aerial, or in a shield a shield grab. A get-up or ledge attack doesn't
  count; that is the down or ledge option, not a free action.
- **Cell.** Two options, each from its first start. W or L: the row's option
  lands a hit or grab first, or is hit first, on that frame; T: both on one
  frame. When neither lands, the cell holds how many frames before (+) or after
  (-) the column the row can act again; "(shield)" marks an attack that met a
  shield, after which both are timed from the last contact.
- **Frame advantage on shield.** The defender's first out-of-shield action
  minus the attacker's first action, both from the contact: negative means the
  defender acts first.
- **Punish window.** The frames on which the punishing option, pressed and
  starting on that frame, lands a hit or grab before its target can act. The
  target runs its option and nothing else; a trade is not a punish. In landing,
  ledge and tech situations the contact must also come at or after frame 0,
  when the target is committed. The punishes tried are a standing fighter's
  jab, forward, up and down tilts, forward, up and down smashes and grab; out of
  shield, the defender's own options.

Distances are world units, six to a Melee unit. 48 is where two standing
Archers' hurt capsules touch; Rifleman's and Illidan's, slightly wider, overlap there.

## Situations

| Situation | Setup | Frame 0 | Options |
|---|---|---|---|
| Aerial on shield | The attacker stands a start distance (48 to 300, every 6) from a defender holding a digital shield, short hops and approaches until the aerial meets the shield. Aerials other than neutral air come out on the C-stick, so the stick stays free to drift; back air is thrown facing away | The aerial meets the shield | Defender: hold shield, shield grab, jump out of shield into each aerial (a short hop drifting toward the attacker), spot dodge, roll in, roll away. Attacker after landing: wait, jab, grab, shield, spot dodge, roll away |
| Neutral | Two standing fighters 60 and 120 apart | Both choose on frame 1 | Wait, jab, the tilts, the smashes, grab, shield, spot dodge, roll in, roll away, against the same set |
| Landing | A fighter at a short hop's apex height, 60 in front of a standing opponent | Touchdown | Empty landing, fast fall, drift away, each aerial pressed at once, air dodge down |
| Ledge | The fighter catches the right ledge from ledge height 30 outside it; the opponent stands 70 inside, facing it | The ledge option's start | Hang, climb, roll, ledge attack, jump, drop, on the first frame after the catch and once the 30 intangible frames are over |
| Tech | A tumbling fighter falls from 30 onto the stage, 70 from the opponent | Touchdown | Tech in place, tech roll in or away; or no tech, then lie, stand, get-up roll in or away, or get-up attack, each as early as the down states take it |

Aerials on shield use the terms of
[platform-fighter design language](platform-fighters.md#aerials-on-shield-spaced-advancing-fade-back-fade-forward):

| Drift | Press | Stick after contact |
|---|---|---|
| Advancing | the latest in the hop that still meets the shield: the lowest hit, least landing lag | none: lands in front |
| Fade-back | the earliest in the hop that meets the shield | away for the rest of the fall |
| Fade-forward | the earliest in the hop that meets the shield | on through the shield for the rest of the fall |

Unspaced starts from the nearest swept distance that reaches the shield, spaced
from the farthest; the page lists every distance that reaches it.

## What the graph leaves out

These are absent from the model, not claims about the game:

- The five original situations above omit percent, DI, SDI and ASDI. The
  combo reports exercise their separately declared percent and victim-choice
  menu; bounded true links are also in [move comparisons](../move-comparisons.md).
- Reaction time. Windows count frames from frame 0 and include presses a
  player could only make on a read; execution limits are in
  [execution windows](execution-windows.md).
- Specials, projectiles, dash attacks, dash and run approaches, fast-falled or
  double-jump aerials, platforms, analog shields, powershields and shield
  drops.
- Other matchups than the mirror, and the situation an exchange leads to: a
  cell in the original situations ends at its first hit or grab, or when both
  fighters can act again. Combo trees continue from the full replay state of
  each contact, through controller rows and the same match-frame executor.
