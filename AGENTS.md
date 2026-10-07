# Smashcraft development

Smashcraft is a platform fighter for Warcraft III, written in TypeScript and
compiled to Lua with TypeScriptToLua. Wisp and Bun are the supported build,
test and development tools. `smashcraft:typescript-toolchain.lock` pins Bun,
TypeScript, TypeScriptToLua and Effect; the map build checks it. Wisp is
maintained in its own repository. smashcraft:ts/wisp.lock records the exact
source revision; Bun installs its generated archive from smashcraft:ts/vendor/.
Change framework code in an owned Wisp lane, publish it, and update the
consumer pin with `bun run update:wisp` from smashcraft:ts/ (fetches the
current published `main` and records its resolved commit). Never edit the
installed dependency or add a local framework copy.

Before adding tooling or diagnostics, consult Wisp's feature index at
smashcraft:ts/node_modules/wisp/docs/index.md (source: wisp:docs/index.md).
It includes opt-in features such as TypeScript call stacks and their costs.
A new `bun wisp` command isn't done until the list below names it;
smashcraft:ts/test/command-list.test.ts enforces that.

## Issues define the scope — finish them

Roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16) lists the
open work in order. Each issue's **Done when** and **Not required** lists are its
complete scope, and its "Rules for whoever picks this up" govern the work.

- Close an issue when its boxes pass, with one short comment (build, result,
  link). Don't add boxes or keep it open for guarantees it doesn't list.
- A problem that doesn't block a box goes in a new `priority:later` issue, not
  into the current one.
- Don't re-run a passing check unless the code it covers changed.
- Boxes marked (Tom) need Tom: prepare everything, ask once, keep working on
  other boxes. Never build automated stand-ins for a human playtest.
- After two failed fixes on the same box, or about a day without progress, stop
  and tell Tom what fails, one recommended fix and its cost.
- Keep each issue's Status section to 5 lines, edited in place, with at most
  one line of residual risk. Comment only to close or to ask Tom for a decision.

Answer "what can we claim about input timing?" from #26's integrity table, or
its Status until the table exists. A status question never starts a new
investigation.

## Source and workflow

- smashcraft:ts/src/ owns gameplay, deterministic state/replay, selection and UI.
- smashcraft:companion/ owns the Rust controller/helper boundary.
- smashcraft:client/ owns the player's desktop app (Tauri: Rust backend, Bun-built TypeScript pages); it uses controller support only through the service's local interface (smashcraft:client/README.md).
- smashcraft:tools/ owns build, native probes and automation.
- smashcraft:docs/ holds durable knowledge only: how systems work, design
  decisions, reference data and procedures. Status, progress, plans and claim
  tables live in the owning issue. A dated trial's raw record goes in
  smashcraft:evidence/ and is never edited afterwards. When a trial teaches
  something durable, add that fact to the relevant doc, with its build.
- Use the declared project development shell when available. Preserve pinned
  dependencies; do not repeat ad hoc environment setup as the normal loop.

## TypeScript and Wisp

Effect is the preferred foundation for Wisp's TypeScript tooling.
Read smashcraft:.agents/skills/effect/SKILL.md for Effect work and for the
weekly dependency/source update. The upstream repository is vendored at
smashcraft:repos/effect/ as read-only reference material: read its LLMS.md,
implementation and tests before choosing APIs. Import installed packages,
never the subtree. Upstream development instructions apply to upstream work,
not to Smashcraft's package manager, language or build commands.

smashcraft:ts/ is the TypeScript side, built on Wisp: the framework and
development loop for Warcraft maps in TypeScript. Read
warcraft-modding before changing TypeScript
or code in a running game, and smashcraft:docs/typescript.md before writing map
code. From smashcraft:ts/:
- Logic: `bun run test`, plus `LUA=<32-bit lua> bun scripts/lua-tests.ts` for the
  emitted Lua. `bun run check` type-checks.
- Every save: leave `bun wisp dev` running. It prints the saved files' type
  errors, the affected unit tests, the journeys (the quick match in two
  simulated clients and the affected journey tests) and the whole check, each
  timed from the save; add `--data A --data B` to also hot-reload both
  clients as `hot --watch` does. smashcraft:ts/scripts/wisp/commands/dev.ts
  declares the files tests read at run time, the journey tests and the
  per-file source-shape audit.
- Running game: `bun wisp hot --data <client A CustomMapData> --data <client
  B CustomMapData> --watch` hot-reloads every save into both clients and prints
  in-game errors with TypeScript lines.
- Map commands: `bun wisp map build [--profile NAME] --name NAME --out OUT.w3x`
  builds the TypeScript map from the private inputs smashcraft:build-inputs.json
  names (`--base`, `--container`, `--assets`, `--summon` override one);
  `bun wisp map rebuild MAP.w3x` replaces only its script.
- Build inputs: each private asset family is stored once under the hash of
  its contents and never edited; build-inputs.json names each family's hash,
  so changing art is `bun wisp inputs add FAMILY DIR` plus a commit, landed
  like code. `bun wisp inputs check` verifies them, `bun wisp inputs path
  [assets]` prints them for tools (smashcraft:docs/build-inputs.md).
  `bun tools/animations/recovery-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` from
  the repository root appends fighter recovery and transition clips before
  storing their families and refreshing the clip pool (smashcraft:docs/fighter-animation-work.md).
- Lich King animation authoring (from the repository root):
  `tools/animations/build-lichking.sh [PRIVATE_INPUTS] [IMMUTABLE_EXISTING_MODEL]`
  authors clips through Blender; the optional existing model preserves shipped
  sequences and appends only new clips (smashcraft:docs/fighter-animation-work.md).
- Damage reactions (from the repository root):
  `bun tools/animations/damage-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  appends all 13 fighters' nine articulated contact reactions, checks their
  drawn first poses, and preserves old sequences. Store changed model families
  and refresh the clip pool (smashcraft:docs/fighter-animation-work.md).
- Fresh match: `bun wisp fresh MAP.w3x [--rebuild]` starts a new game, sends
  `-dev quick`, and waits until every signed-in client writes its receipt.
  `--rebuild` replaces the map script first. Other quick starts for `--chat`
  and pad scripts: `-dev quick hero NAME`, `-dev quick recovery hero NAME`
  (starts tumbling above the floor for recovery captures), and `-dev quick cpu N [hero NAME]`,
  a quick match against a selectable computer at level N (1-9) over three stocks.
  The named variant uses the normal CPU selection rule.
- Client state: `bun wisp client watch [CLIENT...] [--once]` prints what each client
  is doing (signed in, menu screen, lobby, loading, in match, results,
  disconnected, crashed, its map's load errors, the ladder scan) from its menus,
  log, crash reports, match receipts and processes, never its screen. Run it
  before clicking or reading a client; `bun wisp client watch CLIENT --once` and
  `bun wisp client wait CLIENT STATE...` read or wait on one (wisp:docs/watch.md).
- Engine debugger: a native desync? `bun wisp engine desync A B` names the
  first differing turn and checksum section of the clients' Desync.log
  dumps; `bun wisp engine poll --client a,b` during a repro and `bun wisp
  engine diff A.log B.log` name the agent (handle, code callback) one client
  made on another turn; `engine watch` (offline clients) gives each birth's
  game stack, `engine locate` re-finds offsets after a Warcraft update. Dev
  clients from clients.json only, never Tom's install. Two tiers: passive
  reads (`desync`, `poll`, `diff`, `locate`) may follow signed-in A/B;
  anything that traps, stops or writes (`watch`, `locate --watch`) runs only on
  verifiably offline clients and refuses otherwise. A read tries first; when
  it fails it prints the ptrace_scope commands, which only Tom runs
  (wisp:docs/engine.md).
- Offline LAN pool, the default for native testing (see "Native testing and
  UI"): `bun wisp lan setup --from INSTALL [--pairs N]` creates throwaway
  clients with no account once; `bun wisp lan pool --pairs N [--pool-profile
  parity|visual]` runs them in pairs, each pair in a network namespace with
  only loopback (foreground, admitted by the capacity helper); `bun wisp lan
  fresh MAP.w3x [--pair K]` hosts and starts a LAN match on Wisp's own host;
  `lan status`, `lan end --pair K`. The host logs every turn's actions and
  compares checksums each turn: `bun wisp engine actions --client lan0a,lan0b
  [--follow]`. The pool's clients file is ~/.local/state/wisp/lan/clients.json;
  the full engine tier runs there (wisp:docs/lan.md).
- Client recovery: `bun wisp client doctor [CLIENT...]` brings clients A and B to a
  ready state: it recovers a client that dropped from Battle.net, crashed
  with its error dialog up, sits at the empty login shell, a stale lobby or
  a stuck loading screen, or shares its prefix with a second runtime, and
  stops with one line when Tom must sign in (wisp:docs/doctor.md). `fresh`,
  `integrity capture` (bot sessions included), `play` and `accept` run it before
  they start and once after a failure; run it instead of driving a client by
  hand.
- Desync autopsy: `client doctor`, `client watch`, `pad`, `integrity capture` (bot sessions
  included), `fresh` and `accept` run inside Wisp's desync autopsy. On a new
  desync report they print "first divergent birth #N Class at turn T on
  client X" and save the evidence under ~/.local/state/wisp/autopsy/
  (wisp:docs/autopsy.md). The class needs memory reads
  (`kernel.yama.ptrace_scope`); without them, one line says so.
- Client driver: `bun wisp client look|read|click|keys CLIENT ...` reads and
  drives a client. Session values live in ~/.local/state/smashcraft/clients.json.
- Menus: `bun wisp menus host|join|start|leave` drives lobbies through Wisp's
  menu page instead of clicks (`install RETAIL_DIR --port N` once per prefix,
  with the account owner's agreement; smashcraft:docs/wisp.md, "Menu control").
- Direct play: `bun wisp online host [--client NAME]` hosts the newest
  Smashcraft map as a private Battle.net game and prints its join code;
  `bun wisp online join CODE [--client NAME]` joins it; both return at fighter
  selection. `online setup` installs the menu page and Allow Local Files after
  the owner agrees. The client's Online page runs them
  (smashcraft:docs/design/client.md, "Direct play").
- Playtest: `bun wisp play` builds current main (once per revision, however
  many plays start together) and goes from Tom's desktop to a match against a computer
  (smashcraft:docs/play.md). Experiments use `fresh`, captures or `accept`,
  with maps under Maps/00-Smashcraft/tests; play preserves two prior versions
  beside the latest correctly titled build and archives the rest under older/.
  The playable build plays on the keyboard alone, through Warcraft's own
  synchronized key events (#166); play starts no helper and never needs one.
  When the always-on controller service has a pad, the pad presses the same keys.
- Controller: `bun wisp controller` points the always-on controller service
  (`wc3-journal --service`, the login unit smashcraft-controller.service) at
  main's helper and restarts it, or runs the service in the foreground when
  the unit isn't installed. The service finds Warcraft III on :0, the pad and
  any Smashcraft session by itself, so a map opened from Custom Games plays
  on the controller: a keyboard build (the playable one) gets the pad as the
  map's standard keys, a journal build (integrity) a journal helper
  (smashcraft:companion/README.md, "Always-on controller service"). The
  controller is optional: the keyboard is the baseline.
- Live tuning: `bun wisp tune --data A --data B` serves a panel that changes
  the values smashcraft:ts/scripts/wisp/tunables.ts declares in the running
  match and writes kept ones back (smashcraft:docs/typescript.md).
- Player view: `bun wisp view scene DATA_DIR...` and `bun wisp view frame
  FRAME.ppm...` report what a player would see wrong; `view models` rewrites
  the model facts they read (smashcraft:docs/player-view.md); `view strikes`
  rewrites the hero strike moments swings and specials align to
  (smashcraft:docs/fighter-animation-work.md, "Hero swing alignment");
  `view motion --assets DIR` measures every fighter's movement and recovery
  clips and rewrites their foot cadence and audit (smashcraft:docs/fighter-motion.md);
  `view reach --assets DIR [--character ID]` rewrites how far fighters' swings
  draw toward their strikes (smashcraft:docs/hurtboxes.md).
- Repro: `bun wisp repro FILE [--test NAME] [--frame N --out FILE] [--diff-frame N|previous]` replays a moment a player saved
  with K (or View held on a controller) in simulated clients, to the checksum
  the game recorded; `--test NAME` writes a test that replays it. `--frame N
  --out FILE` saves its exact canonical state after N; `--diff-frame previous`
  or another saved frame adds a sorted field-path diff (wisp:docs/repro.md).
- Replays: every client records each match as `smashcraft-replay-N.txt` (a
  manifest written at its end) and `smashcraft-replay-N-K.txt` parts written
  during it. `LUA=<32-bit lua> bun wisp replay FILE [--out JOINED]` replays a
  manifest with its parts, or a joined replay, in Bun and 32-bit Lua to every
  recorded checksum; `--out` writes the joined replay to share
  (smashcraft:docs/design/client.md, "Full-match replays").
- Headless match: `bun wisp headless [quick-match|desync] [--clients N]` plays
  the dev build's quick match in simulated clients in about a second and prints
  desyncs, error reports and scene problems; `--cost` adds its predicted
  Warcraft cost per frame.
- Frame cost: `LUA=<32-bit lua> bun wisp perf [quick-match|bot|bot-four|playable-bot-four]`
  plays a run in 32-bit Lua and prints each client's predicted Warcraft cost
  per frame (p50, p95, worst, typing stall); `bun wisp perf compare A B` fails
  on a rise in predicted cost, allocation or typing stall. Landing gate (#48):
  CI holds `playable-bot-four` to smashcraft:ts/test/fixtures/perf/playable-bot-four.perf;
  after an intended rise or a cut, rewrite that file with `--out` and commit it.
  `bun wisp perf budget RUN_FILE` holds a `--samples` run to #168's frame
  budget (p99 10 ms, worst 14 ms predicted). Spike census (#168): `bun wisp
  perf census [--fighter NAME] [--stage ID] [--functions]` plays every
  fighter's moves, specials and follow-ups in a playable-build training match
  and every stage's hazards, and fails any entry over 2 ms above its standing
  baseline; `--functions` names the map functions of each worst frame. Run it
  on the farm (`bun wisp farm perf "census --fighter archer --functions"`).
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
- Agency sweep: `bun wisp agency [--attacker NAME] [--starter NAME]`
  replays every fighter's throws, jab resets, normals and specials (or only
  the named starters) against every fighter with every victim input class and
  prints the stretches the victim can't act in and the loops follow-ups make
  (smashcraft:docs/typescript.md); 11-28 minutes an attacker, inside the
  capacity scope.
- Roster AI coverage: `bun scripts/cpuCoverage.ts` prints movement, attacks,
  kit use, defense and recovery for all 13 selectable fighters over eight
  seeded level-9 matches each; `GAME_TESTS=botCoverage bun test test/game.test.ts`
  checks the same report, also included in the emitted-Lua32 suite.
- Compute farm: `bun wisp farm balance [--ref REF] [--wait]` plays the
  balance gate's computer field (level 9, 400 a pair; `--level`,
  `--per-pair`, `--seeds`) on GitHub's free hosted runners, a `cpuField
  --pairs` process a core over about 17 jobs, and with `--wait` prints the
  verdict and field table; `bun wisp farm pads [--ref REF] [--wait]` plays
  every smashcraft:ts/test/native/pads/ script headless through the real
  helper against its own `#!` expectations, for a change that moves hit
  timing; `bun wisp farm perf ["RUN ARGS" ...] [--out DIR]` runs each
  `bun wisp perf RUN ARGS` in its own job (default `playable-bot-four`),
  prints each summary and writes each run to DIR. Predictions come from
  counts, so a runner predicts what this machine would; use it instead of a
  local perf run; `bun wisp farm memory [--minutes N] [--wait]` runs the
  30-minute memory soak (also nightly). Without `--ref` it measures the checkout's HEAD (a commit not on
  main goes to a scratch `farm/` branch, deleted after the run). Use it
  instead of a local cpuField or pad run: the repository is public, so the
  runners cost nothing, and this machine stays free. Measured 7 Oct on main
  43021d8c: the level-9, 400-a-pair field (26,400 matches) took 4.1 min from
  dispatch to the printed table, against about 25 min locally; all 17 pad
  scripts took 4.2 min.
- Tapes: set `LUA` to the 32-bit Lua executable, then run `bun wisp parity tapes` to
  compare replay results across Bun, that Lua32 and a Lua32 whose raw float
  `+ - *` round toward zero (`TOWARD_ZERO_LUA`, or built with nix on first use).
- Parity: `bun wisp parity numeric` compares the numeric corpus with both Lua32s;
  `bun wisp integrity capture ...` runs native input-integrity capture and
  `bun wisp integrity result DIR` reconciles its output. `bun wisp parity
  headless --helper BIN --out DIR` runs the same capture through the real
  helper (built with `--text-out`) into headless clients, then reconciles it.
  `bun wisp integrity capture|result|headless` owns native input sessions; numeric parity
  and replay tapes stay under `parity`.
- Native journeys: `bun wisp integrity capture --four-fighters` runs #17's
  four-fighter match (smashcraft:docs/native-four-fighters.md);
  `bun wisp integrity capture --playable` runs a playable candidate's one-stock
  match and rematch (smashcraft:docs/playable-0047.md).
  `bun wisp integrity result DIR` reconciles either session from its recorded kind.
- Scripted pad: `bun wisp pad SCRIPT --helper BINARY --build BUILD --out DIR
  --app-id a=ID --app-id b=ID [--chat=TEXT] [--map MAP.w3x [--retries N]]` plays timed virtual-pad input
  through each client's real helper and reports the frame each edge landed on
  (script syntax: smashcraft:ts/scripts/integrity/padScript.ts). It copies
  the clients' input traces, scene reports and moments beside the result;
  a desynced, crashed or early-ended run is INVALID and, with --map, rerun.
  `bun wisp pad SCRIPT --headless --helper BINARY --out DIR [--chat=TEXT]
  [--compare NATIVE_DIR]` plays the same script through the same helper into
  headless integrity clients. It passes a native run when checksums, fighter
  lines and the script's `#!` expectations match (smashcraft:docs/native-bot-session.md,
  "Native checks by parity"; issue scripts in smashcraft:ts/test/native/pads/).
  Several scripts are one batch, and the batch is how native parity runs:
  `bun wisp pad SCRIPT|DIR... --helper BINARY --out DIR --map MAP.w3x
  [--pairs N | --pair K... | --app-id a=ID --app-id b=ID]` starts ONE game per client pair,
  types `-dev reset` between scripts (a new game only after an invalid run),
  runs every headless side alongside (`--headless-jobs N`) and compares as
  each native run ends; `--pairs N` (the first N) or `--pair K` (a share) shards over the offline LAN pool.
  Never loop `bun wisp fresh` + `bun wisp pad` per script (about a minute a
  script); `--fresh-each` exists only to measure that. `bun wisp pad
  SCRIPT|DIR... --headless ...` plays the same batch in one headless session
  (smashcraft:docs/native-bot-session.md, "Many scripts in one game").
- Native acceptance: `bun wisp accept [--only ID...] [--dry-run]` runs every
  open native check declared in smashcraft:ts/scripts/wisp/acceptChecks.ts in
  as few fresh matches as their maps allow and prints pass, fail or
  needs-look per check with its evidence folder (wisp:docs/accept.md). Declare
  a new native box there, next to the issue it closes, instead of a hand procedure.
  Render cadence: `-dev render-clock` in a development map records timer
  callback bursts and cost; `bun wisp accept --only 169-render-clock --dry-run`
  prints its native plan (smashcraft:docs/high-refresh.md).
  Script-cost capture: `bun wisp build --profile native-perf ...` uses playable
  key input and pooled presentation with developer setup commands. In a match,
  `-dev capture 18000` writes every client's raw callback samples; read full-run
  median/p95/p99/worst with Wisp's capture reader. Procedure and limits:
  smashcraft:docs/native-bot-session.md, "Raw playable cost captures".
- Stage lighting: `bun wisp accept --only '170-*'` captures stock lighting, a
  fighter mask and stage lighting in one paused scene per stage. From the
  repository root, `bun tools/stage/contrast.ts MASK.png STOCK.png STAGE.png`
  measures fighter/background lightness and colour distance. The native
  owner records the graphics profile and checks #168's budget; procedure:
  smashcraft:docs/design/visual-quality.md.
- Melee oracle: `bun wisp oracle` plays Melee situations for every fighter
  and prints each outcome beside the value cited from the decompilation; the
  test suite fails on any mismatch it doesn't list as known
  (smashcraft:docs/physics.md, "Melee behaviour oracle").
- Interaction graph: `bun wisp interactions` plays every fighter's
  situations (aerials on shield, neutral, landing, ledge, tech) and writes
  smashcraft:tools/move-data/interactions/, which Git ignores (write it before
  a change); `--check` lists what the change moved and `--move FIGHTER:MOVE` evaluates one move against the graph
  (smashcraft:docs/design/interaction-graph.md).
- Physics diagnostic: `bun wisp map build --profile physics-probe ...` selects
  the production numerical fixtures. Rebuild it with
  `bun wisp map rebuild MAP.w3x --profile physics-probe`; see
  smashcraft:docs/native-physics-precision.md for the unchanged report gate.
- Frame workload: `bun wisp map build --profile frame-cost ...` runs the
  isolated 4096-frame TypeScript executor and records its complete replay state.
  smashcraft:ts/scripts/frameCost.ts reads recorded paired benchmark results.

## Verify the changed behavior

Portrait outfits: `bun tools/selection/render-fighters.ts --extract EXTRACTOR --assets PRIVATE_ASSETS --slots --reuse`
renders and checks the four slot outfits; omit `--slots` for the neutral grid.
The renderer extracts only the standing sequence with the existing clip tool
(Rifleman: 427,224 animation keys to 881), avoiding full-pool Blender imports.
See smashcraft:docs/design/fighter-portraits.md.

Every push runs the pre-push gate (smashcraft:.githooks/pre-push, enabled for
the repository with `git config core.hooksPath .githooks`; safe-push runs it):
`bun run check` and the type-escape audit (smashcraft:ts/test/source-shapes.test.ts)
when the pushed commits change ts/, and client/ui's type-check when they change
it, in a few seconds (smashcraft:ts/scripts/prePush.ts). It checks the working
tree, so push from a clean checkout of the commit.

From smashcraft:ts/, use `bun test test/game.test.ts` for focused game tests,
`bun run check` for host and map type-checking, and
`LUA=<32-bit lua> bun scripts/lua-tests.ts` for emitted-Lua tests. Use
`bun wisp map build ...` to build a map. See smashcraft:docs/development-loop.md
for the local toolchain and base-map setup.

Pure simulation tests establish logical rules, not Warcraft callback timing,
physical-controller latency, UI focus or online fairness. For those claims,
use the native map and retain exact candidate, input path and measured evidence.
Consume the physics agent's published changes without silently overwriting its
work. Include all mutable gameplay state in deterministic snapshots/replay.

## Native testing and UI

Automated native match/rematch tests use one stock by default. A named workload
may use more stocks or a longer timer only when its required sample needs it;
record that reason beside the test (for example, #26's all-binding edge sample).
Keep ordinary combat completion intact; do not force a win to shorten a test.

Pick the clients by what the test needs (Tom, 7 Oct). The offline LAN pool
is the default for native testing: pad parity runs, captures, `accept`
checks and desync hunts.
Signed-in A and B are only for tests that need Battle.net itself: real
netplay or latency, direct play (#142), spectating. Tom's install (account a,
display :0) is Tom's. A run during which a client wrote a desync report or
crashed is invalid; read the autopsy line it printed
(wisp:docs/autopsy.md), rerun, and debug the desync with `bun wisp engine`.

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

Don't publish releases, GitHub or otherwise, until Tom decides to release.
Playable candidates are private builds named Smashcraft 0.0.N; increment only N.
Internal diagnostics use distinct run IDs and names without advancing the
player release counter. Always identify the current playable artifact separately
from an experimental candidate; a diagnostic pass does not replace that release. Install one
current candidate under Maps/00-Smashcraft. Keep proprietary game assets and
base maps privately outside repository trees. Preserve peer work in owned lanes.
