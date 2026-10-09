# Soak

- Soak: `bun wisp soak` plays 200 headless matches, every fighter pair on
  every stage with fuzzed and computer players, in at most four workers
  (run it inside the capacity scope), and writes a repro file per finding;
  `bun wisp soak --repro FILE` replays one. `--helper BIN` plays through the
  real controller helper instead (needs /dev/uinput). Its lock-loop detector
  reports a fighter caught in a loop it can't act out of (#68).
  `bun wisp soak memory [--minutes N]` plays the playable build match after
  match (every fighter and stage, rematches included) in 32-bit Lua and
  fails when the Lua heap, live Warcraft handles or what the map's globals
  reach grow after a 10-minute warm-up (#168); run it with `farm memory`.
  Its saved samples include each menu's reachable table field shapes and
  representative reference paths: compare the full shape union between a
  warm-up high and a later rise to identify the retaining lifecycle.
  Native handles are checked separately: their emulator-owned record identities
  are excluded from map tables because Warcraft exposes them as opaque handles.
  Overnight playtest (#403): `bun scripts/playtest.ts --first N --count M --out FILE`
  plays matches `N` to `N+M-1` of a fixed plan that reaches every fighter, stage and
  computer level, each seed twice with state hashes every 600 frames; `--merge FILES
  --report-dir DIR` classifies them into one report and one body per finding kind:
  matches still in play at the frame cap, zero-to-death strings of three or more hits,
  fighter win rate outside 35-65%, a move over half its fighter's KOs, stages with no
  stock lost, and runs whose hashes differ. `--repro N` replays match `N`. The nightly
  Playtest workflow runs it on the newest green main in `ceil(matches / 334)`-sized
  shards (1,200 ms a match with both runs, measured locally on four cores) and files
  issues labelled `playtester`, one per kind, updated in place. The loop and the
  classification are pure in smashcraft:ts/scripts/playtestCore.ts.
