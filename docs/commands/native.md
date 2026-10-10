# Native

Development builds expose the retained 3.0.0 lever diagnostic: `-dev lever fog on|off`,
`-dev lever density NUMBER`, `-dev lever oversky on|off`, `-dev lever shadows COUNT`
and `-dev lever light INDEX on|off`. Compare `-dev lighting stock|stage` and
`-dev backdrop on|off` in the same paused scene. Use `-dev view near|far` with
`-dev lever camz -100000|100000` to reach the camera's lowest or highest allowed
height; `-dev lever camz off` restores the normal extreme height and
`-dev view off` restores the match camera. The override still passes through
the existing camera limits.

- One-client Definitive look captures (signed-in clone b, c or d):
  `bun scripts/nativeCapture.ts build --out MAP.w3x --control PAD|DIR...` bakes
  the scripts and their `capture` frames into a native-capture map that plays
  both pads itself and holds each capture frame with the fighters' animations
  and effects frozen; host it with `bun wisp fresh MAP.w3x --no-quick
  --clients-file FILE` while `bun scripts/nativeCapture.ts run --clients-file FILE
  --client NAME --install DIR --manifest MAP.captures.json --out DIR` captures
  the screen. `run` first reads DIR/.build.info and the live build from
  `w3/versions`, records both in captures.json and refuses when they differ;
  `bun scripts/nativeCapture.ts build-check --install DIR [--update-bytes N]`
  runs that check alone and, before Battle.net may update to a new live build,
  compares the install's free space with the update's size. A
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

Never touch Tom’s install; run account a only as clone-a through its
launch.sh, which yields to Tom’s game. Pick clients by the required look: the
offline LAN pool is Classic only; Definitive checks use the signed-in pairs
clone-c+clone-b and clone-a+clone-d (wisp:docs/lan.md). The offline pool remains the default for Classic pad parity,
captures, `accept` checks and desync hunts.

Wisp gives every verdict that is a number from the map's code (wisp#75 M5):
rules, meters, items, hazards, recovery, match flow,
determinism and checksums, timing, CPU frame cost, audio events, and which
model, effect, animation or HUD element shows on which frame, where, at what
scale and pose. Such a box is met by one Wisp run of the real map, two
simulated players where the rule needs two, citing the run. Appearance that
depends on Warcraft's shading (light, colour, contrast, materials, fog, water,
bloom) gets its verdict on Wisp within its calibrated range when the lever's
fidelity gate passes and the verdict is outside the gate's error margin.
Native truth runs on the Warcraft VM: take one spot check per lever per build
when the verdict is inside that margin, the settings fall outside the
calibrated range, or the appearance depends on PopcornFX particles. Batch those
spot checks on the VM. An unstable reference is inconclusive; it never widens
the gate's bounds. The laptop runs only product proofs requested in the real
game (60 fps on Tom's machine, the trailer, a listening clip). New Done-when
boxes follow the same line.

Native checks use one worker per available client (signed-in b, c, d for Definitive;
clone-a only through its launch.sh), sharing the visual queue; pairs are only for
sync, netplay and EX checks. A TypeScript-only
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
