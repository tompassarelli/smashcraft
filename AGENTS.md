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
warcraft-typescript-development-distilled before changing TypeScript
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
- Map commands: `bun wisp build --base BASE.w3m --container MAP.w3x --assets
  DIR --summon DIR --name NAME --out OUT.w3x` builds the TypeScript map;
  `bun wisp rebuild MAP.w3x` replaces only its script.
- Fresh match: `bun wisp fresh MAP.w3x [--rebuild]` starts a new game, sends
  `-dev quick`, and waits until every signed-in client writes its receipt.
  `--rebuild` replaces the map script first.
- Client driver: `bun wisp client look|read|click|keys CLIENT ...` reads and
  drives a client. Session values live in ~/.local/state/smashcraft/clients.json.
- Repro: `bun wisp repro FILE [--test NAME]` replays a moment a player saved
  with K (or View held on a controller) in simulated clients, to the checksum
  the game recorded; `--test NAME` writes a test that replays it.
- Headless match: `bun wisp headless [quick-match|desync] [--clients N]` plays
  the dev build's quick match in simulated clients in about a second and prints
  desyncs, error reports and scene problems.
- Tapes: set `LUA` to the 32-bit Lua executable, then run `bun wisp tapes` to
  compare replay results across Bun and Lua32.
- Parity: `bun wisp parity numeric` compares the numeric corpus with Lua32;
  `bun wisp parity capture ...` runs native input-integrity capture and
  `bun wisp parity result DIR` reconciles its output. `bun wisp parity
  headless --helper BIN --out DIR` runs the same capture through the real
  helper (built with `--text-out`) into headless clients, then reconciles it.
- Physics diagnostic: `bun wisp build --profile physics-probe ...` selects
  the production numerical fixtures. Rebuild it with
  `bun wisp rebuild MAP.w3x --profile physics-probe`; see
  smashcraft:docs/native-physics-precision.md for the unchanged report gate.
- Frame workload: `bun wisp build --profile frame-cost ...` runs the
  isolated 4096-frame TypeScript executor and records its complete replay state.
  smashcraft:ts/scripts/frameCost.ts reads recorded paired benchmark results.

## Verify the changed behavior

From smashcraft:ts/, use `bun test test/game.test.ts` for focused game tests,
`bun run check` for host and map type-checking, and
`LUA=<32-bit lua> bun scripts/lua-tests.ts` for emitted-Lua tests. Use
`bun wisp build ...` to build a map. See smashcraft:docs/development-loop.md
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

Read warcraft3-development-distilled and its off-monitor dependency before
controlling the game. Default automation off-monitor; use the primary display
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
