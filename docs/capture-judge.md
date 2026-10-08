# Capture judge

From `ts/`, run `bun wisp judge CAPTURE_DIR --rubric RUBRIC.json`.
The command reads native RGB PPM captures, checks their drawn script/frame
stamps, and writes `CAPTURE_DIR/judge.json`. Each case passes when every rubric
line passes. Reports include the measured samples, stamp checks, and pass/fail
per line. Borderline measurements retain their measured grade and also carry
`needsLook: true`; only those measurements produce crops under `judge-crops/`.
The command does not call a model. Its `modelCrops` list is the review queue;
`modelCaptures` counts unique source captures requiring review.

A rubric has `cases`, each with `name`, `fixture`, `script` (the drawn script
number), and `lines`. Every line has a `name`, `metric`, and `frames`:

- `pixels`: compare sampled frames against `baseline`, counting pixels whose
  largest RGB channel difference exceeds `tolerance` (default 20). `region`
  is `[left, top, right, bottom]` as fractions of capture width and height.
- `contrast`: run the existing `tools/stage/contrast.ts` reader against `mask`
  (relative to the capture directory) and the sampled capture; `field` is
  `absDL` (default), `dE00`, or `localDL`.
- `stamp`: pass only if every sampled capture names its requested frame and
  script. Other metrics check stamps too, including the pixel baseline.

Measurements use the maximum of the sampled values, so a transient cue may
appear in either +2 or +8. Set `min` and/or `max` to the acceptable range.
For sustained visibility or per-frame limits, use one rubric line per frame.
Set `borderline` to a numeric distance from either threshold to request a
crop; its default is zero. Choose the region to exclude labels and fighters
unrelated to the cue. Missing or malformed captures stop grading with a file
error; no missing frame can silently pass.

The #82 reference rubric is `ts/test/native/rubrics/82-f9d0fbf3.json`, for
`~/.local/state/smashcraft/native-batch-bc-20261008/82-fullscreen-captures`.
Its 1,000-pixel visibility threshold separates the two faint electric cues
from the readable stars, ice, rings and dust in the independent model judge's
14 captured cases (12 pass, 2 fail). The region excludes the side fighters.
The seven additional failed rows in the #82 comment describe uncaptured
coverage and audio, and are outside this capture rubric. This reference
rubric is specific to the old capture schedule, not the expanded #303 pad.
