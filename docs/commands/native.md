# Native

- One-client Definitive look captures (signed-in clone b, c or d):
  `bun scripts/nativeCapture.ts build --out MAP.w3x --control PAD|DIR...` bakes
  the scripts and their `capture` frames into a native-capture map that plays
  both pads itself and holds each capture frame with the fighters' animations
  and effects frozen; host it with `bun wisp fresh MAP.w3x --no-quick
  --clients-file FILE` while `bun scripts/nativeCapture.ts run --clients-file FILE
  --client NAME --manifest MAP.captures.json --out DIR` captures the screen. A
  capture counts only when the drawn stamp in its own pixels (a row of cells
  along the top-left of the 4:3 UI area) names that fixture and frame, so a
  screen that hasn't redrawn can't pass for it. `--control` first plays the
  checked-in control (the same Rifleman walk twice around a Mountain King script);
  `bun scripts/nativeCapture.ts compare DIR control-walk control-walk-again`
  prints how far the twins' captures differ per frame. `run` also records the
  client's own PipeWire sink to DIR/audio.wav on the captures' clock
  (`--audio-sink SINK` or `--no-audio`). `bun scripts/nativeCapture.ts plan
  PAD|DIR...` plays the scripts headlessly on the map's schedule and checks
  each `#! cue FROM[-TO] NAME: sound=… effect=… tint=b shake=b recoil=b` line
  against the held capture frames, without a Warcraft client.

Automated native match/rematch tests use one stock by default. A named workload
may use more stocks or a longer timer only when its required sample needs it;
record that reason beside the test (for example, #26's all-binding edge sample).
Keep ordinary combat completion intact; do not force a win to shorten a test.

Frame acceptance follows the root AGENTS.md budget.

Never touch Tom’s install or account a. Pick clients by the required look:
the offline LAN pool is Classic only; Definitive checks use signed-in clones
b, c or d. The offline pool remains the default for Classic pad parity,
captures, `accept` checks and desync hunts.

Wisp is the test engine (Tom, 8 Oct; wisp#75 M1): 98% of checks run on Wisp,
not on a running Warcraft copy. A gameplay box (rules, meters, items, hazards,
terrain effects, recovery, tutorial progression, pause state, match flow) is
met by one Wisp run of the real map, two simulated players where the rule
needs two, citing the run; tick it and say so. Visual, audio and frame-cost
boxes move to Wisp as its frames, cue logs and cost model land; until then a
box that only Warcraft can check links the Wisp issue for the missing piece.
New Done-when boxes are written against Wisp evidence. Warcraft records
reference captures when art or the client changes, plays one smoke match
before a build goes to Tom, and covers listed intractable cases only.

Native checks use one worker per available client (signed-in b, c, d for Definitive), sharing
the visual queue; pairs are only for sync and EX checks. A TypeScript-only
change (presentation values, effects, menus, CPU tuning) hot-reloads into one
running match with `bun wisp hot --data ... --watch` between captures; rebuild
the map only for imports, object data or art. Each lane builds its own
current-main map (about 90 s) unless one is already built for that commit;
visual captures take no exclusive lease, timing checks do. Record captures per
hour per lane in the status.
A native `bun wisp pad` timing check (a script without a `capture` step) waits
for an exclusive machine-capacity window before client input and keeps it
through the whole batch (maximum 15 minutes).
To run four timing lanes together, start their foreground batch runner inside
one `machine-capacity run --class exclusive --timeout-seconds 900 -- ...`
command; pad children reuse that window. Separate exclusive commands queue in turn.
Each result records `load_average` and `capacity_lease` (#311).
The signed-in clones (B, C, D) cover Definitive captures and tests that need Battle.net
itself: real netplay or latency, direct play, spectating, and as the
updated install the pool is copied from. Do not start them for a Classic offline check;
preserve an already signed-in client at its menu for the next client worker.
A run during which a client wrote a desync report or
crashed is invalid; rerun it.

Read warcraft-modding and its off-monitor dependency,
private-desktop-development, before controlling the game. Default automation off-monitor; use the primary display
for a requested hands-on trial. Preserve authenticated clients across map
iterations. Never direct-launch Warcraft as assumed authentication recovery.
Keep A/B in separate prefixes and use distinct online accounts. Credentials
belong in the encrypted machine configuration, never this repository or logs.

For changed custom UI, inspect the resolved Warcraft frame components before
raw positioning or click overlays. Run headless layout checks where supported,
then verify native hit targets, keyboard-focus release, draw order and
widescreen behavior. Keep local presentation separate from synchronized
gameplay and create shared handles consistently.

Release names and permission follow the root AGENTS.md.
