# Animation scorecard

From `ts/`, `bun wisp anim score` samples the shipped Classic timeline bodies,
writes `build/anim-score/classic.tsv` (a report, not tracked), and prints the worst 40 moves
and a summary for every fighter. `--fighter F` limits a run to a fighter slug;
`--graphics definitive` scores the Definitive bodies; `--assets PRIVATE_DIR`
uses another packaged asset view. A limited run replaces that fighter's rows.

Each row measures the mesh at the exact animation time chosen by production
pose selection while the simulation plays the move. Distances are fractions
of the ready body's height; silhouette masks use the far gameplay camera's
pixel scale. Ready is the pose production pose selection shows on the frame
after the move ends, so line 2 measures the transition the game draws.

1. **Body drive:** find the mesh vertex nearest the strike's far end at
   contact. A limb carrying that point is found by its hand/foot attachment;
   its shoulder/hip travel divided by tip travel measures body share. Also
   measure how far the filled silhouette's centre shifts toward the strike.
2. **Return:** mean drawn-vertex error from ready on the final move frame,
   largest single-frame change from end lag through two following frames,
   and tip travel past contact along its incoming direction. Zero overshoot
   fails even if the move ends exactly at ready.
3. **Timing:** the deepest pullback lies before first active; the extension
   peak is within one frame before contact or the class's late allowance;
   recovery keeps moving for the class's minimum share of end lag. Startup
   of three frames or less can omit measurable pullback. Active windows come
   from production collision regions or projectile spawns. The table also
   lists the linked Melee reference's start and total from the checked-in
   frame-data records; those columns do not change our gameplay timing.
4. **Contrast:** rasterize the drawn triangles, then take one minus the
   larger IoU of windup/contact and contact/mid-recovery. More is clearer.
5. **Judgement:** a fresh agent reads six gameplay-size key poses beside a
   Melee reference, scoring readability, weight, anticipation, follow-through
   and character independently. Every judged line must be at least 4/5.
   An unjudged move has no passing line 5.

The silhouette centre is a visible mass proxy, rather than a physical
mass-weighted centre. Missing limb names use body travel; the stored `limb`
column makes this inspectable. The independent weight judgement catches
motions these measurements can overrate. A passing animation row needs all
five lines, including an independent judgement, in each supported look.

## Judging

`bun wisp anim judge fetch` retrieves private reference GIFs from SmashWiki.
`bun wisp anim judge prepare --out PRIVATE_DIR [--fighter F]...`
renders batches; `--move FIGHTER:MOVE` selects particular moves. It accepts
the scoring command's graphics and asset flags. The camera follows each
pose's height while preserving gameplay scale, so flight does not crop the
body out of its strip. Read `docs/animation-judge-brief.md` in a fresh judge
context and write its requested JSONL. `bun wisp anim judge record
PRIVATE_DIR/scores-*.jsonl` validates and stores numerical judgements in
`tools/move-data/anim-score/judge.jsonl`. Reference pixels stay outside Git.

## Thresholds

The 9 October calibration uses 25 moves: five jabs, tilts, smashes, aerials
and specials, scored independently in five batches. Thresholds use good
individual judged lines (at least 4), rather than admitting a move because
one measured quantity happens to be large. Weight calibrates line 1,
follow-through line 2, anticipation line 3 and readability line 4.

For a minimum take 90% of the smallest positive good observation; for a
maximum take 110% of the largest. Late peak allowance is the largest positive
delay plus one frame. Round outward. Positive minima preserve the requirement
that a frozen body or absent follow-through fails. Where a class has no good
example on a line, use the pooled good examples for that line, and keep its
own contrast threshold. This is an initial calibration, tuned in source by
Tom as better examples are authored.

| Class | Body share ≥ | Mass shift ≥ | End error ≤ | Jump ≤ | Overshoot ≥ | Peak late ≤ | Recovery fill ≥ | Contrast ≥ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| jab | .41 | .15 | .053 | .029 | .029 | 1 | .86 | .36 |
| tilt | .90 | .023 | .053 | .055 | .029 | 2 | .53 | .16 |
| smash | .29 | .071 | .026 | .014 | .095 | 3 | .84 | .43 |
| aerial | .29 | .023 | .008 | .015 | .12 | 3 | .53 | .25 |
| special | .90 | .20 | .046 | .055 | .039 | 1 | .90 | .48 |

Jab weight uses Lich King's second jab; smash weight/return use Malfurion's
down smash; tilt weight uses Mountain King's angled up tilt and Thrall's
forward tilt. Jab return uses Grom's jab and Lich King's second jab. Special
weight/return use Mountain King's and Beastmaster's neutral specials.
The repaired Pit Lord back-air calibrates aerial return and contrast.
Anticipation uses the good jabs, Pit Lord/Lich King/Mountain King tilts,
Blademaster up smash and Beastmaster neutral special. Contrast uses each
class's good readability examples. Tilt return, aerial weight/timing
have no good class example and use the pooled values.

`bun test test/anim-score.test.ts` pins a driven strike passing all measured
lines, an arm-only strike failing body drive, and a direct return without
follow-through failing line 2. `bun run check` is the named source check.
Re-author worst first under #180; keep a change only when its row improves
and no other line falls, as required by #355.

The initial sampler covers normals for all 26 fighters and damaging or
projectile hero specials; Rifleman/Illidan's separately scripted specials and
non-striking utility moves need additional contact definitions before they
can receive a measured row.
