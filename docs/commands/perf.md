# Perf

The budget defaults to p99 10 ms and 14 ms for the mean of the worst 1% of
frames; that older limit remains until the frame-cost work lowers it.
Acceptance still requires the root’s 10 ms budget, so pass `--p99 10 --top 10`
explicitly. No frame-cost gate reads one worst frame: which frame is worst
moves whenever a bot's choices change, so gates read a percentile or the
worst 1% mean (#394); `perf budget` still prints the worst frame.

- Frame cost: `LUA=<32-bit lua> bun wisp perf [quick-match|bot|bot-four|playable-bot-four|playable-duel|playable-human-four]`
  plays a run in 32-bit Lua and prints each client's predicted Warcraft cost
  per frame (p50, p95, worst, typing stall); `bun wisp perf compare A B` fails
  on a 5% rise in instructions (mean or worst 1% mean), predicted cost,
  allocation or typing stall (worst 1% mean). Landing gate (#48):
  CI holds `playable-bot-four` to smashcraft:ts/test/fixtures/perf/playable-bot-four.perf;
  after an intended rise or a cut, rewrite that file with `--out` and commit it.
  Wisp-only acceptance: `bun wisp perf native READINGS --samples FILE --json`
  checks retained solo/four-fighter references within 20% at callback p50/p95;
  then `bun wisp perf compare BASELINE CANDIDATE --json` gates the current
  candidate. The exact command and calibration scope are in
  smashcraft:docs/native-bot-session.md, "Wisp-only frame-cost acceptance".
  `bun wisp perf budget RUN_FILE --p99 10 --top 10` holds a `--samples` run to #168's frame
  budget (p99 10 ms, worst 1% of frames 10 ms on average, predicted). `bun wisp perf profile
  playable-bot-four --phases --out FILE` preserves measured samples and each
  client's slow-frame phase samples and simulation/repair step counts;
  profiling is a separate replay, excluded from measured costs. Spike census (#168): `bun wisp
  perf census [--fighter NAME] [--stage ID] [--functions]` plays every
  fighter's moves, specials and follow-ups in a playable-build training match
  and every stage's hazards, and fails any entry over 2 ms above its standing
  baseline; `--functions` names the map functions of each worst frame. Run it
  on the farm (`bun wisp farm perf "census --fighter rifleman --functions"`).
