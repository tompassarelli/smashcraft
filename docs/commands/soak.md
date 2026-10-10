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
  Growth is a slope test, at fighter selection and after every match (x the
  match number): the Lua heap must grow under 1 MB per 10 minutes and 1 KB
  per match, and each count (live effects are the `effect` handle kind) is
  flat unless its fitted line rises a whole handle across the window with a
  slope over three standard errors. What is alive varies with the lineup just
  played, since each fighter pools its own effects, so a single higher sample
  is not a leak; a failure names the kind that grows. 30 game minutes take
  about 33 minutes on one core.
  Its saved samples include each menu's reachable table field shapes and
  representative reference paths: compare the full shape union between a
  warm-up high and a later rise to identify the retaining lifecycle.
  `bun wisp soak handles [--rematches N]` plays smashcraft:ts/scripts/wisp/handleBaseline.ts's
  four-computer match and 20 rematches (N) through fighter selection in each look, Classic and
  Definitive, in Bun (smashcraft:ts/test/soak/handles.ts) and on the compiled integrity build in
  32-bit Lua, all four runs at once (#409). After every match each live Warcraft handle kind at
  fighter selection must equal its menu baseline: the kinds the first match adds and the menu keeps
  (effects and frames of the stage-loading cover, one fighter body per fighter) equal their counts
  after the first match, every other kind (sounds, timers, triggers, ...) the cold menu's. It prints
  each client's counts before, after the first match and after the last rematch per look, and fails
  naming the kind and match that differ. 21 matches a look exceed both suites' per-test ceilings;
  smashcraft:ts/test/handle-baseline.test.ts keeps the match and one rematch in each look.
  It takes about 20 minutes on four cores (Bun 2.5, Lua32 20 a look) and each Lua run holds
  about 1.4 GB, compacting the emulator after every match.
  Native handles are checked separately: their emulator-owned record identities
  are excluded from map tables because Warcraft exposes them as opaque handles.
  Overnight playtest (#403): `bun scripts/playtest.ts --first N --count M --out FILE`
  plays matches `N` to `N+M-1` of a fixed plan that reaches every fighter, stage and
  computer level, each seed twice with state hashes every 600 frames; `--merge FILES
  --report-dir DIR` classifies them into one report and one body per finding kind:
  matches still in play at the frame cap, stuck matches (no damage or stock change for
  `--stuck-seconds`, 30), zero-to-death strings of three or more hits, true combos over
  #83's rule (more than two follow-ups, or two or more moves over 30% from below 100%,
  with no actionable frame between them; one move instance's hits count once), fighter
  win rate outside 35-65%, a move over half its fighter's KOs, a move whose usage share
  passes its fighter's Tukey fence (Q3 + 3 IQR) and 30% over 100 starts, stages with no
  stock lost, and runs whose hashes differ. `--repro N` replays match `N`. The nightly
  Playtest workflow runs it on the newest green main in `ceil(matches / 334)`-sized
  shards (1,200 ms a match with both runs, measured locally on four cores; at most
  eight at once, within the account's 40 jobs) and files issues labelled `playtester`,
  one per kind under a stable title ("Playtester: matches that never end"): a kind
  with findings updates its open issue's body or opens one, an empty kind comments
  on its open issue. `--issues FINDINGS --open-issues OPEN --dry-run` prints those
  actions instead of the JSON lines the workflow applies with gh. The loop, the
  classification and the issue actions are pure in smashcraft:ts/scripts/playtestCore.ts.
