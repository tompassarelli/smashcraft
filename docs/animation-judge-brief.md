# Animation judge brief

You judge Smashcraft fighter moves against the bar set by Super Smash Bros.,
Street Fighter and Rivals of Aether. You did not author these moves, and
nothing you write changes them: you only score. This is line 5 of the
animation scorecard (smashcraft:docs/animation-scorecard.md, #367).

## What you see

Each move is one image (open it with your file-reading tool):

- **Top row, ours:** the move's key frames drawn by the game's renderer with
  the gameplay camera at its widest framing (the smallest a fighter appears in
  a match), cropped but not enlarged: the move's first frame, the windup
  extreme, contact (the first frame that can hit), the last active frame, the
  middle of the recovery, and the last frame of the move. The fighter faces
  right.
- **Bottom row, reference:** frames of a Melee move of the same kind, from
  SmashWiki's hitbox animations (coloured bubbles are hit regions; ignore
  them and the different art style). When no reference exists the bottom row
  is missing; judge against the standard below.

Judge the body's motion and silhouettes only: not textures, lighting,
effects, model detail or damage numbers. Don't read the repository's code or
other judges' scores.

## Score five lines, 1 to 5

| Line | 5 means | 1 means |
| --- | --- | --- |
| `readability` | Each key pose reads instantly at this size as a distinct silhouette: you can tell windup, hit and recovery apart and see where the hit lands. | Frames look alike, or the striking limb is lost inside the body. |
| `weight` | The whole body drives the hit: hips and shoulders turn or shift into it, the support foot plants, mass moves toward the target. | Only an arm or weapon moves; the body stands still. |
| `anticipation` | A clear, readable windup in the opposite direction before contact, sized to the move (small for a jab, big for a smash). | No windup: the limb starts from rest straight into the hit. |
| `followThrough` | The body carries on past the hit, then settles smoothly back into ready, with no pop. | The pose snaps back, freezes, or ends somewhere other than ready. |
| `character` | The motion fits this fighter (a hulking brute, an agile assassin, a caster) and couldn't be swapped onto another fighter unnoticed. | Generic: any fighter could perform it identically. |

A move passes at 4 or higher on every line. Score each line on its own; a
good silhouette doesn't excuse a missing windup. Use the reference row to
calibrate what a 4 or 5 looks like for that kind of move. Be strict: a 3 is
"acceptable in an older or smaller game", not "fine".

## Output

Write one JSON object per line to the scores file your batch names, one per
move, with exactly these fields:

```json
{"look":"classic","fighter":"thrall","move":"forward-smash","judge":"YOUR-ID","readability":3,"weight":2,"anticipation":4,"followThrough":3,"character":4,"note":"One sentence: the biggest visible problem, or what makes it work."}
```

`fighter` and `move` are the slugs your batch lists; `judge` is your batch's
judge id (for example `judge-3-claude`). Integers 1–5 only. Then reply with
one line: how many moves you scored and the path you wrote.
