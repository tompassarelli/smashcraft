# Native bot session

`bun wisp parity capture --bot` plays a candidate in the two signed-in
clients the way a bot playtest does. It uses the same virtual pads,
persistent `wc3-journal` helpers, native files and rig as #26's integrity
capture (smashcraft:ts/scripts/integrity/journey.ts). Use it for checks
that need Warcraft itself: stall recovery, saved moments, controller rows
and what each player sees with computer opponents.

## The session

The session has a match and a rematch:

- Slot C becomes a computer Demon Hunter. `--bot-four` adds a computer
  Archer in slot D, for four fighters.
- The match timer is one minute; matches use their normal stocks.
- Both pads play a beat every 400 ms: 5 ms taps of A, Y and X, a 200 ms
  left-trigger shield, and 300 ms full-tilt dashes right and left.
- At 6, 14 and 22 s, client B's game is stopped with SIGSTOP for 2 s. Before
  any stall, the capture checks that the window's process runs on the
  client's own DISPLAY.
- At 30 s both pads hold View for 1.3 s, so each helper asks its client to
  save a moment.
- `--bot-four` leaves the rematch undisturbed and types `-dev perf` into
  client A before it, so the frame-cost overlay shows a four-fighter match
  (development and integrity builds only).
- `--pad49` opens the first match with #49's script on slot 0, and that
  match has no stalls. The script: resting and drifted sticks, X, Y, down at
  0.650 and 0.670 of full tilt, and a held right.

```sh
bun wisp parity capture --bot [--bot-four] [--pad49] \
  --helper /absolute/path/to/wc3-journal --build BUILD_ID \
  --out /absolute/path/to/new-capture \
  --app-id a=GAME_APP_ID_A --app-id b=GAME_APP_ID_B --first-epoch 1
```

## Reading a capture

From smashcraft:ts/:

- `bun scripts/integrity/botResult.ts DIR [CUSTOM_MAP_DATA ...]` writes
  `bot-result.json`. It holds each stall's input delay before, at its peak
  and after; each match's end receipts; both clients' confirmed states at
  common trace frames; and the moments saved during the capture, copied
  into `DIR/moments`.
- `bun scripts/integrity/botInputs.ts DIR` counts each match's scripted
  presses against the rows each helper typed. It also reports any button
  held in the last row, and the input delay away from stalls.
- `bun scripts/integrity/pad49Result.ts DIR [EPOCH]` checks #49's script
  step by step against slot 0's rows.
- `bun scripts/integrity/stallSeries.ts DIR SLOT EPOCH TRIAL` prints one
  helper's delay at each receipt around one stall.

Input delay here is how many frames a helper has journaled by its own
clock beyond the last frame its client consumed. It is read at the helper's
edit-box receipts, about every 200 ms. Moments replay with
`bun wisp repro FILE`. A playable build writes no input trace, so only
integrity and development builds give confirmed states.

## Integrity workload stocks

#26's integrity capture (no `--bot`) plays three stocks in every match. Its
pads dash both ways for the whole workload. On 0.0.48, with one stock,
Player 2 drifted off the stage 19–21 s into the first match. That ended the
match before the workload's scheduled Start pause, so the capture had no
pause to check.
