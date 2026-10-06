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
- The match timer is one minute; matches use their normal stocks. The
  match plays Sky Deck. Before the rematch, slot 0's stick switches the
  stage screen to Three Bridges, so a session shows both stages.
- Both pads play a beat every 400 ms: 5 ms taps of A, Y and X, a 200 ms
  left-trigger shield, 300 ms full-tilt dashes right and left, and 100 ms
  full-tilt C-stick flicks right, up, left and down. Each edge's phase
  names its beat (`bot-EPOCH-beat:c-up`).
- At 6, 14 and 22 s, client B's game is stopped with SIGSTOP for 2 s. Before
  any stall, the capture checks that the window's process runs on the
  client's own DISPLAY.
- At 12 and 30 s both pads hold View for 1.3 s, so each helper asks its
  client to save a moment. A session that plays both matches past 30 s
  saves eight moment files (four moments, saved on both clients).
- On a development or integrity build, each match exports its response
  pages after its trace, so its presses can be reconciled like #26's.
- `--bot-four` leaves the rematch undisturbed and types `-dev perf` into
  client A before it, so the frame-cost overlay shows a four-fighter match
  (development and integrity builds only).
- `--pad49` opens the first match with #49's script on slot 0, and that
  match has no stalls. The script: resting and drifted sticks, X, Y, down at
  0.650 and 0.670 of full tilt, and a held right.

Before the first `bun wisp fresh` after a client starts, open Custom Games
→ Create Game and the 00-Smashcraft folder once: fresh clicks the folder's
first map, and Warcraft keeps the open folder for the session. Fresh moves
every other map in that folder to `smashcraft-replaced-maps`. Client A's
prefix also holds Tom's playtest map, so copy it back after a session.

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
  into `DIR/moments`. It then replays every moment in `DIR/moments` in two
  simulated clients, as `bun wisp repro` does, and records in
  `moment_replays` whether each lands on the checksum Warcraft recorded
  (`moment_replays_passed`; a `PASS` or `FAIL` line per moment on stderr).
  Run it from the source the captured build was made from.
- `bun scripts/integrity/botInputs.ts DIR` counts each match's scripted
  presses against the rows each helper typed. It also reports any button
  held in the last row, and the input delay away from stalls.
- `bun scripts/integrity/pad49Result.ts DIR [EPOCH]` checks #49's script
  step by step against slot 0's rows.
- `bun scripts/integrity/stallSeries.ts DIR SLOT EPOCH TRIAL` prints one
  helper's delay at each receipt around one stall.
- `bun scripts/integrity/pressResult.ts OUT.json DIR ...` checks #60's
  claim over integrity-build captures, bot sessions and #26's alike. It
  counts presses, the actions they cover, lost and extra edges, and edges
  applied off their frame. It also gives each legal press's local start:
  callbacks from the presser's client capturing it to that client first
  predicting it. Presses made while the presser's own game or helper was
  stopped are reported apart from the gate. So are presses made while the
  other player's was stopped, and presses in the second after a stop.
  `worst_gated_presses` names the latest ones by capture, match, slot and
  frame. A legal press whose first prediction didn't start its action has
  no local start; `confirmedAfter` gives the callbacks until the confirmed
  frame showed it.

Input delay here is how many frames a helper has journaled by its own
clock beyond the last frame its client consumed. It is read at the helper's
edit-box receipts, about every 200 ms. One moment replays alone with
`bun wisp repro FILE`. A playable build writes no input trace, so only
integrity and development builds give confirmed states.

## Integrity workload stocks

#26's integrity capture (no `--bot`) plays three stocks in every match. Its
pads dash both ways for the whole workload. On 0.0.48, with one stock,
Player 2 drifted off the stage 19–21 s into the first match. That ended the
match before the workload's scheduled Start pause, so the capture had no
pause to check.
