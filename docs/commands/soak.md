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
  `bun wisp soak memory --handles` plays four computers through one match, then
  a match and its automatic rematch, in 32-bit Lua, and fails unless every live
  Warcraft handle kind (HandleCensus, smashcraft:ts/scripts/wisp/handleCensus.ts)
  is back at its fighter-selection count (#409); the sweep in
  smashcraft:ts/test/handle-baseline.test.ts plays the same in Bun.
