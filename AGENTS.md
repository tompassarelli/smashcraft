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

For fighter animation quality and action coverage, use the source-owned
`smashcraft-animation` skill (`agents path smashcraft-animation`): its
reference library supplies Sakurai's impact/attack principles and the Fox
drill example; its procedure routes the existing motion audit, paired throws,
recovery clips and nine-way pain reactions. The project index of sources,
with URLs, verified timestamps and rights, is
smashcraft:docs/design/animation-reference.md. Reference pixels remain private.

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
  `--profile native-input` measures the playable keyboard path with developer
  setup and the response probe (Ctrl+G records, Ctrl+H exports); its rendered
  marker identifies the callback actually captured in pixels. Report that
  diagnostic overhead; journal integrity is a separate input path.
- Build inputs: each private asset family is stored once under the hash of
  its contents and never edited; build-inputs.json names each family's hash,
  so changing art is `bun wisp inputs add FAMILY DIR` plus a commit, landed
  like code. `bun wisp inputs check` verifies them, `bun wisp inputs path
  [assets]` prints them for tools (smashcraft:docs/build-inputs.md).
  `bun tools/animations/recovery-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` from
  the repository root appends fighter recovery and transition clips before
  storing their families and refreshing the clip pool (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/drill-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  Blademaster, Warden and Shadow Hunter down-air drills, preserving earlier
  clips and writing both-facing silhouette sheets for the native review.
  `bun tools/animations/down-air-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  downward contact poses for the seven stock heroes whose casts/swings pointed forward.
  `bun tools/animations/jump-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  movement-only jump gestures, including Blademaster's front flip
  (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/down-air-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT` writes
  both-facing down-air sheets from production pose selection and the roster's
  strike-height inventory (smashcraft:docs/down-airs.md).
  `bun tools/animations/grab-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]` appends
  coordinated expansion-hero reach, hold, pummel and four-direction holder/victim
  gestures or reauthors their existing indices. `--character` limits reauthoring
  to one expansion fighter (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/grab-pads.ts` generates the #180 mirror and unlike-height capture batch:
  ten expansion heroes, four throws, both facings, with ordinary catch/pummel
  inputs and contact-frame captures in smashcraft:ts/test/native/pads/180/.
  `-dev quick pair FIRST / SECOND` selects different named fighters in the two human slots.
- Lich King animation authoring (from the repository root):
  `tools/animations/build-lichking.sh [PRIVATE_INPUTS] [IMMUTABLE_EXISTING_MODEL] [--replace NAME]`
  authors clips through Blender; the optional existing model preserves shipped
  sequences and appends only new clips; `--replace NAME` reauthors one existing clip at its same index and length (smashcraft:docs/fighter-animation-work.md).
- White body flashes (from the repository root):
  `bun tools/animations/white-flash-models.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  authors white body-only copies with the original meshes and animation keys for charge and heavy-hit flashes; store PRIVATE_OUTPUT as `impact-assets`.
- Damage reactions (from the repository root):
  `bun tools/animations/damage-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  appends all 13 fighters' nine articulated contact reactions, checks their
  drawn first poses, and preserves old sequences. Store changed model families
  and refresh the clip pool (smashcraft:docs/fighter-animation-work.md).
  The native blend diagnostic is `bun tools/animations/damage-blend-probe.ts
  PRIVATE_ASSETS PRIVATE_OUTPUT`; its `damage-blend-probe` map profile compares
  frozen/running presentation clocks inside one interrupted Archer model
  (smashcraft:docs/fighter-animation-work.md, "Native pain blending diagnostic").
- Fresh match: `bun wisp fresh MAP.w3x [--rebuild]` starts a new game, sends
  `-dev quick`, and waits until every signed-in client writes its receipt.
  `--rebuild` replaces the map script first. Other quick starts for `--chat`
  and pad scripts: `-dev quick hero NAME`, `-dev quick recovery hero NAME`
  (starts tumbling above the floor for recovery captures), and `-dev quick cpu OPPONENT DIFFICULTY [hero NAME]`,
  a quick match against a named computer at the selected difficulty over three stocks.
  The named variant uses the normal CPU selection rule.
  `-dev pain HEIGHT STRENGTH FIGHTER` starts the #181 mirror capture fixture:
  low/middle/high and small/medium/large, with ordinary projectile contacts at
  frame 150 after both players' scripted jab. `bun tools/animations/pain-pads.ts`
  from the repository root generates its 117 native parity scripts.
- Generated menus: smashcraft:ts/scripts/wisp/uiFrames.ts defines menu panels as Wisp
  frame definitions (wisp:docs/ui.md); after changing one or its layout, `bun
  scripts/wisp/uiFrames.ts` rewrites its FDF/TOC in smashcraft:tools/selection/art/
  and its bindings in smashcraft:ts/src/game/ui/ (test/ui-frames.test.ts holds them current).
- Client actions accept `--clients-file FILE`, including watch, doctor and
  keys; use the exact offline pair's file. `WISP_CLIENTS` does not select
  clients. Pixel/input actions need the pair's file with desktop tools
  (the acceptance and integrity runners prepare it through `withTools`).
- Client state: `bun wisp client watch [CLIENT...] [--once]` prints what each client
  is doing (signed in, menu screen, lobby, loading, in match, results,
  disconnected, crashed, its map's load errors, the ladder scan) from its menus,
  log, crash reports, match receipts and processes, never its screen. Run it
  before clicking or reading a client; `bun wisp client watch CLIENT --once` and
  `bun wisp client wait CLIENT STATE...` read or wait on one (wisp:docs/watch.md).
- Native script driver: `bun wisp map build --profile native-driver --name NAME --out MAP.w3x`
  packages a callback match driven by `bun wisp engine drive SCRIPT --client lan0a,lan0b`.
  `engine drive reset`, `capture`, `pause`, `step N`, and `resume` control the whole map callback;
  `engine drive FILE` accepts a pad script with its `#! chat` setup, starts at
  frame 0 paused, and uses the normal input-row adapter. A command file containing
  `capture` holds and saves the current frame, and pad `capture` lines save the
  named client's moment at their frame. VIEW held 60 frames saves its normal moment;
  START uses the normal pause action, and a driver resume continues that pause. `resume N` runs until frame N, while `step N` advances N frames from the current
  frame. Holds write the canonical checksum and saved moments for `bun wisp repro`.
  `bun scripts/nativeDriverAcceptance.ts --clients-file FILE --client lan0a,lan0b
  --script test/native/pads/archer-neutral.pad --frames 460 --runs 50 --out DIR`
  measures 50 full pad runs plus one stepped control, compares both clients and
  replays each hold. `--game-start-ms N` records launch-to-first-check time from the
  timestamp before hosting the map.
  This diagnostic path measures native script delivery, not hardware pad timing.
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
  signs a launcher at its Battle.net sign-in form in with the client's account
  (A: account c, B: account b; smashcraft:ts/scripts/wisp/doctor.ts), so Tom
  never signs in by hand (wisp:docs/doctor.md). `bun wisp client sign-out
  CLIENT...` signs a client out; the next doctor run signs it in. `fresh`,
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
  selection. The host presses Start now once the guest has joined; no Battle.net chat is sent.
  `online setup` installs the menu page and Allow Local Files after
  the owner agrees. The client's Online page runs them
  (smashcraft:docs/design/client.md, "Direct play").
- Playtest: `bun wisp play` builds current main (once per revision, however
  many plays start together) and goes from Tom's desktop to a match against a computer
  (smashcraft:docs/play.md). Experiments use `fresh`, captures or `accept`,
  with maps under Maps/00-Smashcraft/tests; play preserves two prior versions
  beside the latest correctly titled build and archives the rest under older/.
  The playable build plays on the keyboard alone, through Warcraft's own
  local keyboard sampling with two-frame delay and rollback (#60/#166);
  play starts no helper and never needs one.
  When the always-on controller service has a pad, the pad presses the same keys.
- Standalone play: `bun wisp play --standalone` opens the Wisp browser player
  with a full three-stock Archer against Wren Expert Rifleman. `--script FILE`
  runs the native driver's exact pad inputs; `--headless --frames N --out DIR`
  saves frame checksums and captures (`--capture-frames N,N` picks their frames).
  Private map and Warcraft assets stay in the existing local asset store.
- Controller layout: `bun wisp controller layout standard|zjump` changes the running service live, or saves the choice for its next start. Layout, tap jump and left/right full or light shield are kept in `~/.config/smashcraft/controller.json` (or `$XDG_CONFIG_HOME/smashcraft/controller.json`) and editable on the client Controller page.
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
  the model facts they read (smashcraft:docs/player-view.md); `view strikes --assets DIR`
  rewrites the hero strike moments swings and specials align to
  (smashcraft:docs/fighter-animation-work.md, "Hero swing alignment");
  `view motion --assets DIR` measures every fighter's movement and recovery
  clips and rewrites their foot cadence and audit (smashcraft:docs/fighter-motion.md);
  `view reach --assets DIR [--character ID]` rewrites how far fighters' swings
  draw toward their strikes (smashcraft:docs/hurtboxes.md).
- Repro: `bun wisp repro FILE [--view] [--test NAME] [--shrink [--out FILE]] [--frame N --out FILE] [--diff-frame N|previous]` replays a moment a player saved
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
- Headless match: `bun wisp headless [quick-match|desync] [--clients N] [--journey FILE] [--render DIR --frames N...]` plays
  the dev build's quick match in simulated clients in about a second and prints
  desyncs, error reports and scene problems; `--cost` adds its predicted
  Warcraft cost per frame. `--render` draws requested frames using the map's
  immutable imports and classic Warcraft assets; `--journey FILE` supplies
  capture inputs as journey JSON. Stock extraction uses `CASC_EXTRACTOR`
  and `WC3_STORAGE`; `WC3_TEXTURES` reuses extracted PNGs
  (smashcraft:docs/player-view.md).
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
- Air drift: `bun scripts/airDrift.ts` prints every fighter's air speed,
  air acceleration, dash/run-jump takeoff speed and dash-jump cross-up;
  smashcraft:ts/scripts/airDrift.tests.ts holds them to the bands in
  smashcraft:docs/gameplay-design.md ("Air drift and jump momentum").
  Analog ingress diagnostics use `bun wisp map build --profile analog-keys`
  or `--profile analog-cursor`; both keep one fixed top-down camera and the
  keyboard rollback input path. Cursor calibration holds PageUp at grid cell
  (0,0), then PageDown at (127,127), with Home and End held, before match measurements.
  Each corner writes `smashcraft-pad-calibration-pSLOT.txt`; finished matches
  export `smashcraft-pad-ROUTE-eEPOCH-pSLOT.txt` with captured axes, pressures,
  payloads and mouse/input-sync event counts. The candidates are opt-in;
  the playable build still samples its usual keys.
  Home marks an armed pad; End commits a complete payload. While Home stays
  held and End is released for an update, capture retains the last complete
  pad row's axes and pressures. Focus loss or Home release clears that packet.
  `bun scripts/analogNative.ts --pair N --clients-file FILE --helper WC3_CONTROLLER
  --map MAP --route keys|cursor --out DIR --app-id NAME=ID --app-id NAME=ID`
  runs 20 normal one-stock matches on an already admitted LAN pair; `--plan`
  prints the setup without touching clients. It saves calibration clock anchors,
  helper submissions, injected command times and each match's complete input
  rows and event counts for the physical route comparison.
- Roster AI coverage: `bun scripts/cpuCoverage.ts` prints movement, attacks,
  kit use, defense and recovery for all 13 selectable fighters over eight
  seeded Wren Expert matches each; `GAME_TESTS=botCoverage bun test test/game.test.ts`
  checks the same report, also included in the emitted-Lua32 suite.
- CPU reads and move value: smashcraft:docs/design/cpu-profiles.md describes
  bounded contextual habits, anticipatory commitments and risk-aware move
  choice; smashcraft:ts/src/game/match/botStrategyContracts.tests.ts checks
  adaptation, punishable reads, buffering and seeded decision variety.
- Named-opponent calibration: `bun scripts/cpuCalibration.ts [--revision SHA]
  [--out FILE] [--json FILE]` from ts/ measures all 30 identity/tier rows over
  seeds 0–9, with 100 eligible decisions per measure, distributions and hard
  collection/fairness/replay failures. `gh workflow run cpu-calibration.yml
  -f ref=COMMIT` runs the same report hosted. Procedure and remaining behavior
  gates: smashcraft:docs/design/cpu-profiles.md, "Calibration report".
- Difficulty report: `gh workflow run cpu-tiers.yml -f ref=COMMIT` measures Wren at every tier pair with `cpuTiers` (20 matches per pair, 100 Expert-vs-Rookie matches). The run summary and `cpu-tiers` artifact hold its table.
- Release roster: `bun scripts/releaseRoster.ts FIELD.json` (from ts/) writes
  smashcraft:ts/src/game/sim/heroes/releaseRoster.ts from a gate run's
  `cpuField --json` file: fighters outside the field band are hidden from
  selection (grid, stepping, opening picks) for players and computers, while
  measurement tools and named `-dev` commands keep every fighter. Empty
  unless the balance owner cuts a release build (smashcraft:docs/design/roster.md, "Balance gate").
- Compute farm: `bun wisp farm balance [--ref REF] [--wait]` plays the
  balance gate's computer field (Wren Expert, 400 a pair; `--opponent`, `--tier`,
  `--per-pair`, `--seeds`) on GitHub's free hosted runners, a `cpuField
  --pairs` process a core over about 17 jobs, and with `--wait` prints the
  verdict and field table. A Wren Expert run with at least 400 matches per pair
  fails when the balance gate fails, after publishing the report artifact;
  lower-tier or smaller exploratory fields remain reports.
  `bun wisp farm pads [--ref REF] [--only DIR]... [--wait]` plays
  every top-level smashcraft:ts/test/native/pads/ script (or each issue
  folder named by `--only`, such as `--only 151 --only 167`) headless through the
  real helper against its own `#!` expectations, for a change that moves hit
  timing or a new issue script on a loaded host; each job uploads its traces
  (`gh run download RUN`), the source of a new script's `#! expect` lines;
  `bun wisp farm perf ["RUN ARGS" ...] [--out DIR]` runs each
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
  `bun wisp integrity capture --screen --clients-file FILE --client NAME --out PRIVATE_DIR [--count N] [--region X,Y,WIDTH,HEIGHT]`
  measures serial framebuffer acquisition on the input stimulus clock and saves
  actual pixels privately (smashcraft:docs/native-bot-session.md). Its cadence
  sample is preparation for response measurements, with no latency pass result.
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
  fresh selected-pair setup receipts to `DIR/setup.json` before the first edge;
  missing chat entry or requested setup is INVALID at that client and boundary,
  with no input timeline started (Wisp's observed chat/command receipt helpers).
  the clients' input traces, scene reports and moments beside the result;
  captures require the requested frame in both drawn receipts, otherwise the
  run is INVALID with retained captures and the first failed boundary in its report
  (smashcraft:docs/native-bot-session.md, "Native checks by parity");
  a scripted quick match holds each requested pose locally through the capture
  while inputs and simulation continue; `held visual` images are not timing evidence;
  a desynced, crashed or early-ended run is INVALID and, with --map, rerun.
  `bun wisp pad SCRIPT --headless --helper BINARY --out DIR [--chat=TEXT]
  [--compare NATIVE_DIR] [--render DIR --frames N...]` plays the same script through the same helper into
  headless integrity clients. `--render` draws the script captures after the
  session stops; `--frames` selects their comma-separated frame numbers.
  It passes a native run when checksums, fighter
  lines and the script's `#!` expectations match (smashcraft:docs/native-bot-session.md,
  "Native checks by parity"; issue scripts in smashcraft:ts/test/native/pads/).
  Comparisons preflight the existing View replay export before starting helpers
  or native sessions: hold at least 60 frames and release (normally 70), after
  the last capture to preserve authored action frames. Missing exports fail
  early; actual moments and checksum parity remain required.
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
- Native acceptance: `bun wisp accept [--only ID...] [--pair K... | --pairs N] [--map MAP.w3x] [--dry-run]` runs every
  open native check declared in smashcraft:ts/scripts/wisp/acceptChecks.ts in
  as few fresh matches as their maps allow and prints pass, fail or
  needs-look per check with its evidence folder (wisp:docs/accept.md). `--pair K`
  selects the offline pool pair; every check, capture and receipt follows its
  two clients, and sessions start through `lan fresh`. Several pairs
  (`--pair K` repeated, or `--pairs N`) split the sessions over every pair at
  once, one process per pair, with each map built once; the merged report and
  each `shard-K/` are under the run's evidence folder. Declare
  a new native box there, next to the issue it closes, instead of a hand procedure.
  `--map MAP.w3x` uses that already-built candidate for the selected checks
  without rebuilding it; select checks needing the same build profile. Each
  shard receives the same immutable map. Use revision-specific private paths.
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

CPU observation histories retain shared samples through `copyBotMemory` and
release them through `clearBotMemory`; never assign one owner's history to
another. Observation checks stream canonical bytes, while replay text is
materialized on request. In Lua32, 100 warmed four-fighter observations plus
history copies used 0.011 KB/frame versus the previous 97.14 KB/frame observation
path. Keep this route allocation-free and use the unchanged
`playable-bot-four` performance fixture for whole-frame acceptance.

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
