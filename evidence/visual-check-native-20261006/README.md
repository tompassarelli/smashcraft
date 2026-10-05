# Visual check: Archer vs Rifleman, one match — 6 October 2026

**Pass.** Nothing was wrong at any time or frame. The stage deck is drawn
from match start to result. Arrows, blaster shots, hit sparks and landing
dust left view within half a second. Nothing stayed in view at the result
except the stage, and the quiet spell shows no puff, smoke or trail.

## Run

- Map: the main-profile build from smashcraft `306a54a` (build
  `typescript-dev`, SHA-256 `ccf41188…`, see
  smashcraft:evidence/reload-speed-native-20261006/).
- `bun wisp fresh MAP` started a `-dev quick` match on both clients: Archer
  (P1) against Rifleman (P2), one stock.
- Keyboard input through each client's private display, at the times in
  combat.log:
  - three specials and two attacks from each player;
  - a jump from both, then one more from P1;
  - six seconds without input;
  - P1 held left for 6 s and walked off.

  Both result screens named the winner; damage stood at 9% and 21%.
- Both clients were recorded (wf-recorder, 2 codec threads, in their own
  scope). The video stays private under
  ~/.local/share/smashcraft-build-inputs/native-owner-20261005/n3/video/.

## Results

**Frame probe at match start** (fresh.log):

- A: arena sky present (92.9%); stage in the stage band present (49 rows
  hold a deck-coloured run of at least 20% of the width, needs 15).
- B: arena sky present (98.5%); stage present (47 rows, needs 15).

**Frame probe in the quiet spell**, A's recording 3 s after the last input,
1280x720 (`bun wisp view frame`): sky 90.1%, stage present (24 rows, needs 8).
One small crop of that frame was inspected. It shows the deck and the two
fighters only: no dark puff at the stage centre, no smoke where blaster shots
ended, no impact or frost puffs at hit or dust spots, and no arrow-trail
streaks.

**Scene reports at the result** (frame 890, `a-scene-p0.txt`,
`b-scene-p1.txt`; `bun wisp view scene` passed on both). Each line gives:
live, in view, drawn, oldest frame, current in-view stay, longest stay in
frames.

| Model | Live | In view at result | Longest stay in view |
| --- | --- | --- | --- |
| StageDeck | 1 | 1 (drawn) | 869 frames (whole match) |
| ArrowMissile | 16 | 0 | 30 frames (0.5 s) |
| GyroCopterMissile (blaster) | 16 | 0 | 30 frames |
| ImpactHit | 8 | 0 | 30 frames |
| ImpactDust | 12 | 0 | 30 frames |
| Every other effect (frost, shield, KO, jump, roll, tech, clips…) | — | 0 | 0 |

30 frames is one report interval, so each of those stays was at most half a
second. GyroCopterMissile is the model whose parked smoke trail was the dark
puff at the stage centre (`05266a3`). It never stayed in view longer than one
interval and was not in view at the result.
