# Native bot session

`bun wisp integrity capture --bot` plays a candidate in the two signed-in
clients the way a bot playtest does. It uses the same virtual pads,
persistent `wc3-journal` helpers, native files and rig as #26's integrity
capture (smashcraft:ts/scripts/integrity/journey.ts). Use it for checks
that need Warcraft itself: stall recovery, saved moments, controller rows
and what each player sees with computer opponents.

Before a session, and whenever a client misbehaves, run `bun wisp client watch
--once` instead of reading the clients' screens: it prints each client's
state (signed in, menu screen, lobby, loading, in match, results,
disconnected, crashed), its map's load errors and the ladder scan, from
events (wisp:docs/watch.md). `bun wisp client wait CLIENT STATE...` waits
for one. A capture and `bun wisp fresh` stop at once when a client crashes or
loses Battle.net, with the evidence the watch saw.

## Which clients

Native testing defaults to Wisp's offline LAN pool: `bun wisp lan pool
--pairs N` runs it and `bun wisp lan fresh MAP.w3x --pair K` starts a match
(wisp:docs/lan.md). The
pool's throwaway clients have no account and no internet, each in its own
network namespace, and play over LAN; their clients file is
~/.local/state/wisp/lan/clients.json. Signed-in A and B are only for tests
that need Battle.net itself: real netplay or latency, direct play (#142),
spectating. Tom's install is Tom's.

## When a run desyncs

`fresh`, `integrity capture`, `pad` and `accept` run inside Wisp's desync
autopsy (wisp:docs/autopsy.md). On a new desync report they print

```text
desync autopsy: first divergent birth #N Class at turn T on client X
```

and save both clients' reports, poll logs and the comparison under
~/.local/state/wisp/autopsy/<time>/. The run itself is invalid and reruns
(below); the line names what to fix. `CScriptFunc` is a code callback made
on a different turn in each client, as in #158. For a desync outside a
session, `bun wisp engine desync`, `poll` and `diff` find the same
(wisp:docs/engine.md).

## The session

The session has a match and a rematch:

- Slot C becomes a computer Illidan (Demon Hunter). `--bot-four` adds a
  computer Archer in slot D, for four fighters.
- On fighter selection the match is set to one stock and one minute, with
  Automatic rematch on, on Sky Deck. The match and its automatic rematch play
  with the same fighters and settings, with no menu presses between matches.
  A development/integrity build uses `-dev rematch 20` so response export
  finishes during the visible countdown. The final result cancels the
  countdown with Escape before collecting evidence. A playable build uses its
  ordinary five-second countdown.
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
  client A just after its automatic start, so the frame-cost overlay shows a four-fighter match
  (development and integrity builds only).
- `--bot-perf` does the same with the three fighters of `--bot`, so a
  session measures both the matches `bun wisp perf bot` and `perf bot-four`
  predict. In either, the capture reads A's overlay from its screen every
  2 s through the rematch (a `perf-overlay` event each, one 120-frame
  window). `bun wisp perf native RESULT RUN` then holds the headless
  prediction of the same source to those readings (wisp:docs/frame-cost.md#checking-against-warcraft).
  Run it on a quiet machine: the meter's clock is likely wall
  time, so other work on the host inflates it.
- `--pad49` opens the first match with #49's script on slot 0, and that
  match has no stalls. The script: resting and drifted sticks, X, Y, down at
  0.650 and 0.670 of full tilt, and a held right.

## Healthy clients first

`bun wisp fresh` and `bun wisp integrity capture` run `bun wisp client doctor` before
they start and once after a failure (wisp:docs/doctor.md). It recovers a
client that dropped from Battle.net, crashed with its error dialog up, sits
at the empty Options/Exit Game login shell, a stale lobby, a score screen or
a stuck loading screen, or shares its prefix with a second runtime: it ends
the game (or the prefix), starts Battle.net on the client's own desktop when
needed and presses Play in the signed-in launcher. Don't restart or
hand-drive a client for these; run `bun wisp client doctor` (or `bun wisp client doctor b`)
and read its lines. It stops with one line when Tom must sign in. A capture
that failed isn't repeated: doctor heals its clients, and the next capture
starts healthy.

Before the first `bun wisp fresh` after a client starts, open Custom Games
→ Create Game and the 00-Smashcraft folder once: fresh clicks the folder's
first map, and Warcraft keeps the open folder for the session. Fresh moves
every other map in that folder to `smashcraft-replaced-maps`. Client A's
prefix also holds Tom's playtest map, so copy it back after a session.

When every client has a menu page, `bun wisp fresh` needs no menu preparation:
it places each client from the watch, leaves a lobby, match or score screen
through the page and Escape, hosts a private game with a random password,
joins it with that password (a page join of a game without one left the guest
in Battle.net's password prompt) and starts it 2 s after the lobby exists
(an immediate start crashed Warcraft III 3.0, #119). A client
without a page is driven by clicks, and its game stays public.

```sh
bun wisp integrity capture --bot [--bot-four | --bot-perf] [--pad49] \
  --helper /absolute/path/to/wc3-journal --build BUILD_ID \
  --out /absolute/path/to/new-capture \
  --app-id a=GAME_APP_ID_A --app-id b=GAME_APP_ID_B
```

Every capture, `--bot` or not, starts from two humans: `-dev slots 3 0`
empties slots C and D, so the computers a Battle.net lobby adds are cleared
before `--bot` adds its own. It then plays the game's next match and its rematch.

### Setup by command, not by pointer

On a build with the dev console (development and integrity builds), a
capture sets the match up by typing chat commands into client A, never by
clicking the menus or reading their labels
(smashcraft:ts/src/game/shell/sessionSetup.ts). Each command applies the
menus' own rule for player 1, and both clients write their developer receipt
`smashcraft-dev-BUILD-pN.txt`: its `receipt=` count (the game's commands
so far) and its `SETUP` line, the fighter-selection state after the command
(`human-fighters`, `computers`, `characters`, `stocks`, `minutes`,
`automatic-rematch`, `stage`). The capture takes a command as confirmed
when both clients' receipts are newer, carry the same count and pass any
count this capture saw; it then checks the `SETUP` fields and stops with the
receipt when the map refused the command. A bot session types, in order:

```text
-dev slots 3 0              # C and D EMPTY
-dev slots 7 0              # C HMN
-dev slots 3 4              # C CPU
-dev slots 11 4             # --bot-four: D HMN
-dev slots 3 12             # --bot-four: D CPU
-dev fighter 3 Illidan
-dev fighter 4 Archer       # --bot-four
-dev stage 0                # Sky Deck
-dev time 1
-dev stocks 1
-dev auto-rematch on
-dev rematch 20
```

The pads then pick both players' fighters and start, as in #26's journey.
At each match start both clients write `smashcraft-stage-BUILD-pN.txt`
(`epoch`, `stage`, `decks`); the capture checks the player's view only
after both name the match, and a bot match must name stage 0. #26's
integrity capture sets its three stocks with `-dev stocks 3` and makes its
rematch slot change with `-dev slots`, recorded with the menu receipts as
before. A playable build has no dev console, so its journeys still click the
menus and read their labels.

What still reads the screen is evidence, not driving: the result screens
and their announcement, #26's pause notice, and `--bot-four`/`--bot-perf`'s
frame-cost overlay, besides the player-view frames.
The next match is one past the `epoch=` both clients' menu receipts name
(the last match begun, 0 in a new game); a capture can't start at a
rematch, so it stops there before any input and asks for a new game.
`--first-epoch N` names the first match instead.

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
  predicting it. The gate leaves out presses made while the presser's own
  game or helper was stopped, and presses the presser's client captured
  while a remote row 24 frames behind held its prediction (the probe's
  `held` rows); both are reported apart (`by_stall.own`,
  `prediction_held`). Presses made while the other player's process was
  stopped, and those in the second after a stop, are gated and also listed
  apart. `worst_gated_presses` names the latest ones by capture, match, slot
  and frame. A legal press whose first prediction didn't start its action
  has no local start; `confirmedAfter` gives the callbacks until the
  confirmed frame showed it. It exits 1 when the gate fails.

Input delay here is how many frames a helper has journaled by its own
clock beyond the last frame its client consumed. It is read at the helper's
edit-box receipts, about every 200 ms. One moment replays alone with
`bun wisp repro FILE`. A playable build writes no input trace, so only
integrity and development builds give confirmed states.

## Scripted moves: `bun wisp pad`

`bun wisp pad SCRIPT --helper HELPER --build BUILD --out DIR --app-id a=ID --app-id b=ID [--chat=TEXT]`
plays a script of timed pad states on both clients' virtual pads through
the real helpers, as the captures do. `--chat=TEXT` types a developer command
into client A once the helpers run (for example `-dev quick hero lich`, or
`-dev quick cpu wren expert` for a Wren Expert computer opponent, or
`-dev quick cpu wren expert hero NAME` to select any roster fighter as that computer
through the menu's selection rule). The `cpu-roster-*.pad` scripts cover the
complete selectable roster in one batch.
Each line is `FRAME CLIENT ACTION [ARGS]`: the match frame the edge is
meant for (or `+N` after the previous line), `a` or `b`, and
`press|release|tap BUTTON [FRAMES]`, `stick X Y`, `cstick X Y`
(-1..1, up positive), `shield AMOUNT` (0..1) or `capture` (that
client's whole frame). A capture waits until that client has drawn its
frame: the integrity build writes the predicted frame it drew to
`smashcraft-drawn-BUILD-pN.txt` in CustomMapData whenever it changes, and
under load the drawn match runs well behind the helper's clock (#156 on
7 Oct: 6 to 88 frames, so captures on the clock showed the moment before
the move). It is saved as `frame-FRAME-CLIENT-drawn-D.ppm`, D the frame drawn
when the capture began, and `captures.json` gives each capture's frames drawn
before and after it (the screen grab itself takes about 50 ms, three frames).
A dash attack is A with the stick back at neutral while the fighter still
dashes (a jab out of a dash); A with the stick held, even 12 frames into
the dash, is a forward smash. A menu-started
match holds fighters until GO! on frame 181; `-dev quick` matches start at
frame 1, and the helpers see it a few frames in, so start a script at frame 15
or later. Each edge is written a fifth into its frame on the helper's own
clock (its log's `match_start ... epoch_ns` and frame rule), and
`result.json` gives the frame each landed on: from the helper's event line
for buttons, from its frame rule for sticks and triggers. It exits 1 when an
edge landed off its frame or a helper stopped. It also copies each client's
input trace (`trace-a.txt`, `trace-b.txt`, written about 20 s into an
integrity-build match), its scene report (`scene-a.txt`, `scene-b.txt`) and
the moments it saved beside the result.

### Native checks by parity

A gameplay box passes natively when the native run of a pad script equals a
headless run of the same script. The headless run is
`bun wisp pad SCRIPT --headless --helper HELPER --out DIR --chat=TEXT --compare NATIVE_DIR`.
It sends the script through the same helper binary, in two headless clients
of the integrity build, so both sides translate the pad the same way. Then
it checks three things:

- Each headless moment replays to every native confirmed-state checksum
  in its frames. A View hold of a second saves a moment of the last ten
  seconds, so scripts hold View twice, near frames 500 and 1000. Native and
  headless moments that start on the same frame must hold the same rows (the
  native match ran the intended presses), and their starting states are
  compared field by field, so a checksum difference names its fields.
- The confirmed fighter lines in the traces are equal: specials, attacks,
  jumps, hits and recoveries, each with its frame.
- Each `#! expect CLIENT FRAME TEXT`, `#! absent CLIENT FROM-TO TEXT` and
  `#! scene CLIENT MODEL` line in the script holds on both sides. A
  `#! chat TEXT` line names the command that starts the match when `--chat`
  gives none.

A press that never landed natively fails all three. Fighter lines include
each damage change and each change of a special's form (a glide, a Chaos
Strike, a swap), so a hit or a follow-up shows on its frame. A native run
is invalid, neither pass nor fail, when a client wrote a desync report or
crash during it, or when the match reached its results early. The native
pad prints `INVALID: desynced, rerun`. Given `--map MAP.w3x`, it starts a
new game (`bun wisp fresh MAP --no-quick`) and reruns, up to `--retries N`
times (3 by default). The native map must be
the integrity build (`bun wisp map rebuild MAP.w3x --profile integrity`,
`--build typescript-integrity`), since only that build writes the trace.
Issue scripts live in smashcraft:ts/test/native/pads/, one folder per issue.

### Many scripts in one game

Native acceptance also selects an offline pair with
`bun wisp accept --pair K --only ID...`. Its captures, player-position labels,
receipts and new LAN matches all follow that pair. `--dry-run` prints the same
plan without starting a match.

For `bun wisp integrity capture`, `--clients-file FILE` selects the clients for
the health check, desync autopsy and capture together. An offline pair's health
check reads its current state; a closed, crashed or disconnected pool client
stops the run so the pool owner can restart that pair.

Native batch helpers and pads stay alive until their game ends. Before typing a
selection command, the runner waits for the map's observed chat-open receipt in
`smashcraft-chat-BUILD-pSLOT.txt`; a missed Return sends no command text. Between
matches, reset waits for the journal's quiescence and chat handoff before typing.
Rebuild the integrity map's script when updating this handshake. Input deadlines
use each client's own match-start clock; identical frame numbers can require
different write times.

Native parity runs as a batch: name several scripts, or a folder of them.

```sh
bun wisp pad ts/test/native/pads --helper HELPER --out DIR \
  --map MAP.w3x --pairs 4                       # the offline LAN pool
bun wisp pad SCRIPT... --helper HELPER --out DIR --map MAP.w3x \
  --app-id a=ID --app-id b=ID                   # signed-in A and B
```

Where the time went (A+B, 7 Oct 2026, integrity build, 17 scripts run one
`fresh` + native pad + headless compare at a time): a new game took 42 to
64 s a script (5 s to the menus, 7 s hosting, 4 to 5 s joining, 21 to 26 s
loading to fighter selection), the native run 23.5 to 26 s for about 1050
frames, and the headless compare 22 s, because the headless clients play in
real time through the real helper. That was about 1 min 50 s a script and
over 35 min a batch, more than half of it starting games.

So a batch:

- Starts ONE game per client pair, and between scripts types `-dev reset`.
  The reset ends any match and puts the match rules back exactly as the map
  started them (`startingSelection`: the players in the game, the boot's
  match seed and settings), so the script's own `#! chat` command (`-dev
  quick ...`) starts a match equal to a new game's first match.
  smashcraft:ts/test/dev-reset.test.ts holds that: a match after a
  mid-match reset writes the same integrity-trace checksums and fighter
  lines as the first match, and its saved moments the same starting state,
  after a computer match and a camera match in between. Matches keep state
  for slots they don't play (moment snapshots, the step's observed actions,
  per-slot presentation), so the reset clears those too. It costs about a second (its receipt,
  `SETUP phase=0`, from both clients). A new game is started only for a
  pair's first script and after an invalid or broken run.
- Starts every script's headless reference run at once, `--headless-jobs N`
  at a time (3 by default; each is two real-time clients and two helpers,
  about 0.8 CPU), and compares each native run as soon as both sides exist.
  The native runs never wait for a compare. A reference run that slipped an
  edge on a loaded host runs again, twice at most, and so does a script
  whose edges were written late (after a reset, not a new game). Real-time
  runs slip on a saturated host: on 7 Oct, at a load average near 30 on 24
  cores, 8 of 17 headless-session scripts slipped and 9 passed; one run
  alone slipped no edge. Run batches on a quiet host or the farm.
- With `--pairs N` (the first N pairs) or `--pair K` (repeated: a share
  other runners also use), shards the scripts over the pairs of the
  offline LAN pool (`$XDG_STATE_HOME/wisp/lan/pool.json`, each pair a
  clients file in the schema of clients.json; a new game there is
  `bun wisp lan fresh MAP --pair K`). Each pair takes the next script when
  it is free.

It writes `DIR/batch.tsv` and `batch.json`: each script's new-game, reset,
native, headless and compare seconds, attempts and verdict, then the
totals. `--fresh-each` starts a new game per script, only to measure the
old loop. `bun wisp pad SCRIPT|DIR... --headless --helper HELPER --out DIR`
runs the same batch in one headless session (resets included) against new
headless clients per script, which proves the reset through the real
helper without any Warcraft client.

## Declared checks: `bun wisp accept`

Native boxes that a chat command, a capture and a rule can answer (#82's
effect cases, #57's underside, #73's map load, each complete hero's match for
#96) are declared in smashcraft:ts/scripts/wisp/acceptChecks.ts and run in
one batch:

```sh
bun wisp accept --dry-run          # the plan: sessions, steps, captures, rules
bun wisp accept [--only 82-*]      # evidence in ~/.local/state/smashcraft/accept/RUN/
```

Each check prints PASS, FAIL or NEEDS-LOOK with its folder; a needs-look
check names what to look for in its cropped frames (wisp:docs/accept.md).
The underside profile needs its map built first, as smashcraft:docs/player-view.md
describes. The bot captures below stay hand-run.

## One session for the native gates

One run of each capture below, from smashcraft:ts/ of the checkout the
map's script is built from, answers every native check these captures
feed. The checkers replay moments in this source, so build and check from
the same checkout. Run each `botResult.ts` before the next capture: it
copies every moment its clients saved since its capture began.

```sh
export LUA=/path/to/32-bit/lua
S=~/.local/share/smashcraft-build-inputs/SESSION   # a new private folder
HELPER=/absolute/path/to/wc3-journal               # release build of this checkout's companion/
MAP="$S/Smashcraft integrity.w3x"                  # copy of an integrity map and its .w3x.base.lua
UNDERSIDE=/absolute/path/to/underside.w3x          # a dev map whose scenario is underside (#57)
A_DATA="$(jq -r '.clients[0].documents' ~/.local/state/smashcraft/clients.json)/CustomMapData"
B_DATA="$(jq -r '.clients[1].documents' ~/.local/state/smashcraft/clients.json)/CustomMapData"
CAPTURE=(--helper "$HELPER" --build typescript-integrity --app-id a=GAME_APP_ID_A --app-id b=GAME_APP_ID_B)

# Four fighters: three 2 s stops of B in match 1; overlay read through the rematch; four moments a client.
bun wisp fresh "$MAP" --rebuild --profile integrity --no-quick
bun wisp integrity capture --bot --bot-four "${CAPTURE[@]}" --out "$S/bot-four"
bun scripts/integrity/botResult.ts "$S/bot-four" "$A_DATA" "$B_DATA"
bun scripts/integrity/botInputs.ts "$S/bot-four" > "$S/bot-four/bot-inputs.json"
# Predicted against native cost (wisp#19): fails unless median and p95 are within 20%.
LUA=<32-bit lua> bun wisp perf native "$S/bot-four/bot-result.json" bot-four

# Three fighters, the same.
bun wisp fresh "$MAP" --no-quick
bun wisp integrity capture --bot --bot-perf "${CAPTURE[@]}" --out "$S/bot-perf"
bun scripts/integrity/botResult.ts "$S/bot-perf" "$A_DATA" "$B_DATA"
bun scripts/integrity/botInputs.ts "$S/bot-perf" > "$S/bot-perf/bot-inputs.json"
LUA=<32-bit lua> bun wisp perf native "$S/bot-perf/bot-result.json" bot

# #26's all-action workload: grab, walk and stick moves; three fighters in the rematch.
bun wisp fresh "$MAP" --no-quick
bun wisp integrity capture "${CAPTURE[@]}" --out "$S/integrity"
bun wisp integrity result "$S/integrity"

# Presses over all three captures (exits 1 when the gate fails).
bun scripts/integrity/pressResult.ts "$S/press-result.json" "$S/integrity" "$S/bot-four" "$S/bot-perf"

# Headless predictions of the two bot matches, from this source.
bun wisp perf bot --out "$S/perf-bot.json"
bun wisp perf bot-four --out "$S/perf-bot-four.json"

# One saved moment replayed alone, to the checksum Warcraft recorded.
bun wisp repro "$(ls "$S"/bot-four/moments/*.txt | head -1)"

# The deck's underside: frames land in ~/.local/state/smashcraft/frames/.
bun wisp fresh "$UNDERSIDE"
```

What answers each check:

| Check | Where |
| --- | --- |
| Saved moments replay to Warcraft's checksum | `moment_replays_passed` in both `bot-result.json`s; a PASS or FAIL line per moment |
| 2 s stop recovers within 1 s | `bot-four/bot-result.json` `trials_passed` (three trials, match 1); `bot-perf`'s for the three-fighter build |
| Clients agree | `matches[].confirmed_frames_differing` empty, equal final checksums |
| Steady-state frame cost, four fighters | `bot-four/bot-result.json` `frame_cost_overlay`: median of window medians, median and worst p95, worst frame, windows holding a frame over 16.7 ms |
| Frame cost, three fighters | `bot-perf/bot-result.json` `frame_cost_overlay` |
| Predicted against native cost | `perf-bot-four.json` and `perf-bot.json` p50 / p95 against `frame_cost_overlay.lua_ms` `median_of_medians` / `median_p95` of the matching capture |
| Scripted presses against helper rows | `bot-inputs.json` |
| Every press on its frame, local start | `press-result.json` `gate` and `passed`: at least 1000 presses, every action (the integrity workload brings grab and moves, the bot sessions dashes and C-stick) |
| #26's table | `integrity result`'s output for `$S/integrity` |
| What players see | `player-view-EPOCH/` frames in each capture; the underside run's frames |

## Integrity workload stocks

#26's integrity capture (no `--bot`) plays three stocks in every match. Its
pads dash both ways for the whole workload. On 0.0.48, with one stock,
Player 2 drifted off the stage 19–21 s into the first match. That ended the
match before the workload's scheduled Start pause, so the capture had no
pause to check.

Pad script frame numbers are simulation-frame deadlines. The helper's
`match_start` record preserves its publication timestamp and `first_frame`
(3 for D2); the injector derives a frame-one clock origin from both. Its
result retains `frame_one_ns` and `match_starts`, and compares each actual
helper event against the unchanged planned frame. Treating the publication
as frame 1 injects D2 scripts two frames late.

## Raw playable cost captures

For keyboard response measurements, build or rebuild with
`--profile native-input`. It keeps the playable keyboard input, fixed
two-frame delay, rollback and predicted pooled fighters, and adds only the
developer setup commands and response probe. Ctrl+G begins recording;
Ctrl+H exports the callback and input rows into CustomMapData. The magenta
marker's position identifies the callback shown in a captured framebuffer.
Record the original host input timestamps and the framebuffer timestamps;
the exported game clock alone cannot establish press-to-screen latency.
The probe adds diagnostic work, so report its overhead separately from the
ordinary release's cost. Use the integrity profile for journal diagnostics.

Build or rebuild with `--profile native-perf` for script-cost trials of the
playable build. The diagnostic uses the playable build's local keyboard rows
and predicted pooled fighters, with developer setup commands and the frame meter;
it has no hot reload or scene recorder. The ordinary playable entry contains
no meter. Use the same diagnostic map bytes for each graphics-rate comparison.

Set up the roster and rules through the developer commands, then start through
the normal menus. `-dev quick` resets stocks to one, so do not use it after
setting a long match. A four-fighter trial needs four active fighters and must
stay in the match for the whole capture. Early results, crashes and desyncs
invalidate it.

In a running match, type `-dev capture 18000`. Its confirmation names the run
and starting match frame. Each client records the next 18,000 callbacks and
then writes `smashcraft-perf-capture-pSLOT-runRUN.txt` in CustomMapData. Require a
fresh file from each client. The receipt records elapsed **clock** milliseconds;
18,000 callbacks mean five minutes only at 60 callbacks per second. Retain
actual native start/end times and gameplay phase for the five-minute gate.

From smashcraft:ts/, read a receipt with Wisp's host capture reader:

```sh
bun -e 'import { parseFrameCostCapture, captureDistribution } from "wisp/scripts/wisp/frameCostCapture"; const c = parseFrameCostCapture(await Bun.file(Bun.argv[1]).text()); console.log(JSON.stringify({ elapsed_clock_ms: c.elapsedMs, microseconds: captureDistribution(c) }));' /absolute/path/to/CAPTURE.txt
```

The output gives full-run median, p95, p99 and worst callback cost. The parser
rejects incomplete, reordered, clockless and reloaded samples. The #168 script
gate is p99 at most 10 ms and worst at most 14 ms, over the accepted five-minute
four-fighter workload; GPU/render time remains outside this meter.
`bun wisp perf native CAPTURE.txt RUN --samples HEADLESS.perf` can compare its
observed 120-frame windows to a prediction from the same candidate and
workload. Capture output is generated after the last measured callback; wait
for it to finish before another timing trial.
