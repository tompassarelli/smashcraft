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
- Every check gets one run on a commit: it passes, ship; a failure gets fixed
  and run once more. Load-bearing rules get one run of the broader check (the
  farm sweep), not repeats: determinism, rollback, netcode and input. Only
  frame-cost and latency checks may confirm once on a quiet machine.
- Agents run every check, playtests included, by script or capture; Tom plays
  only when he wants to, and anything he notices becomes an issue. Don't write
  boxes that wait on Tom.
- After two failed fixes on the same box, or about a day without progress, stop
  and tell Tom what fails, one recommended fix and its cost.
- Keep each issue's Status section to 5 lines, edited in place, with at most
  one line of residual risk. Comment only to close or to ask Tom for a decision.

Answer "what can we claim about input timing?" from #26's integrity table, or
its Status until the table exists. A status question never starts a new
investigation.

## Roster

The current roster has 21 fighters. Every fighter needs a pointed personality:
funny, annoying, menacing, heroic, or another specific character. Never flat or
generic. Add only Grom (#340), Anub’arak (#341), Malfurion (#342), Medivh (#343)
and Kobold (#344), then hold at 26, Melee’s size, until every fighter feels good.
Use Warcraft’s own models before importing new assets.
Support Classic and Definitive only. Each player chooses their look; gameplay,
move timing, hitboxes and hurtboxes are identical. Reforged is dropped from the plans.

## Source and workflow

- smashcraft:ts/src/ owns gameplay, deterministic state/replay, selection and UI.
- smashcraft:companion/ owns the Rust controller/helper boundary.
- smashcraft:client/ owns the player's desktop app (Tauri: Rust backend, Bun-built TypeScript pages); it uses controller support only through the service's local interface (smashcraft:client/README.md).
- smashcraft:tools/ owns build, native probes and automation.
- smashcraft:docs/ holds durable knowledge only: how systems work, design
  decisions, reference data and procedures. Status, progress, plans, claim
  tables and trial results live in the owning issue: the table, the run link
  and the commit. When a trial teaches something durable, add that fact to the
  relevant doc, with its build.
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

Host tools that Bun runs (commands, runners, builds, captures, farm jobs) are
written as Effect programs when they start processes, wait, retry, hold a
resource or parse outside data. Load the effect-development skill before
designing one, and follow the four rules and examples in
smashcraft:docs/typescript.md, "Host tools". Map code compiled to Lua
stays plain TypeScript; pure calculations stay plain functions.
smashcraft:ts/test/effect-host-tools.test.ts enforces this.

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
- Logic: run the tests a change affects locally (`bun wisp dev`), full suites
  on the farm: `bun wisp farm test --wait` runs the full Bun suite (`bun run
  test`) and the 32-bit Lua suite (`LUA=<32-bit lua> bun scripts/lua-tests.ts`)
  for HEAD on GitHub's free runners and prints the counts and each failing
  test (wisp:docs/farm.md). Don't run the full suites on this machine.
  `bun run check` type-checks.
- Sweeps: a test that plays many matches, a whole roster or every stage is a
  sweep: register it with `sweep()` (smashcraft:ts/src/runtime/sweep.ts, or
  smashcraft:ts/test/sweep.ts in Bun-only files) and keep its smallest form,
  such as one seeded match, as an ordinary test. The suite skips sweeps;
  `SWEEPS=1 bun run test` and `SWEEPS=1 bun scripts/lua-tests.ts` run only
  them, and CI's Sweeps (Bun) and six Lua32 (sweeps) jobs run them on every push,
  so a failing sweep turns main red (#243).
  `LUA_PARTITION=K/N` divides `LUA_JOBS` name-hash shards across N jobs;
  CI runs at most six Lua jobs alongside its two Bun jobs.
- Test cost: one test may use at most 4 s of CPU in Bun and 6 s in 32-bit
  Lua (its process's user plus system time on a GitHub runner;
  smashcraft:ts/scripts/testCost.ts). They were set on 8 Oct from the lean
  suite (#243, #244): the heaviest suite tests then used 3.2 s and 4.5 s, and
  the 29 tests above moved to the sweeps. Only Tom raises them. `bun run test`
  and `bun scripts/lua-tests.ts` charge each test's CPU to its file (a game
  test to its src module) and compare each file with its row in
  smashcraft:ts/test/cost-baseline.tsv or smashcraft:ts/test/lua/cost-baseline.tsv.
  A test over the ceiling fails, and on a whole run so does a file whose CPU
  per test rises more than 25% (and more than 1 s) at the same test count;
  both name the file and say "shrink it or move it to the farm" (shrink it, or
  make it a `sweep()`). A new file or a changed test count passes under the
  ceiling and rewrites its row: commit it with the tests. `TEST_COST_UPDATE=1`
  rewrites every measured row, after a cut. Rows are scaled by the run's
  median ratio, so a slower machine compares fairly; a verdict reached while
  CPU pressure was above Wisp's 30% is inconclusive (exit 75), not a failure.
  Every run ends with the suite's CPU, test count and CPU per test against
  the baseline, and its five heaviest tests. Tests get Wisp's two-minute
  timeout, which only catches hangs; a test that asserts speed is a
  `timingTest`, which the runner runs alone after the suite
  (wisp:docs/testing.md).
- Oracles: every test's title ends with its oracle, where its expected value
  comes from outside the code under test: `[native]` (real-game captures or
  replay tapes from real matches), `[reference]` (an independent
  implementation: Wurst parity, Bun vs 32-bit Lua, retail Melee recordings),
  `[spec #N]` or `[spec docs/…]` (a value Tom or a design doc set, cited),
  `[repro #N]` (reproduces a real defect and fails on the pre-fix code) or
  `[invariant]` (holds however the code computes it: same seed twice, equal
  client checksums, round trips, rollback equals straight play). A headless
  expectation no native capture has confirmed yet is `[provisional]` and
  listed on wisp#69. A test without an oracle restates the code: don't write
  it. `bun run test` and `bun scripts/lua-tests.ts` refuse to run when a
  title lacks a tag (smashcraft:ts/scripts/oracleTags.ts), so titles stay
  literal text (#243).
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
  `--profile pause-probe` runs the integrity map's unchanged input path and
  starts its response probe at match setup. The first pause and resume emit
  `pause-boundary` rows; resume exports the positions presented in that callback
  automatically, for `ts/test/native/pads/206/pause-dash.pad`.
  Headless `pad` writes `pause-draws.jsonl` with the last paused picture and
  first resumed picture, fighter/effect positions and animation clocks,
  observing once after each real draw's callbacks (#86).
- Map size: players download the map in the lobby, so prefer Warcraft's own
  assets (reshape, recolour, rescale or recombine stock models, doodads,
  effects and animations) before importing a file. A custom asset is fine
  where stock can't do the job well; each new import's commit names its size
  and why stock couldn't do it. `bun wisp map build` prints the map's size and
  imported bytes; the default build fails when the map is more than 10% over
  smashcraft:ts/map-size-baseline.tsv, naming the largest new imports. After a
  justified import or a cut, rebuild with `MAP_SIZE_UPDATE=1` and commit the
  baseline (smashcraft:docs/design/map-size.md).
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
  `bun tools/animations/attack-gesture-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]`
  appends distinct roster attack gestures without changing combat data or old clips;
  `--character` regenerates one fighter while retaining other generated bindings;
  `--pose POSE` appends only that missing gesture, preserving existing clips.
  `bun tools/animations/dreadlord-pounce-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` authors Dreadlord’s horizontal corkscrew, bite and recovery; `bun tools/animations/dreadlord-pounce-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT` captures their production phase selection in both facings.
  `bun tools/animations/jump-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  movement-only jump gestures, including Blademaster's front flip
  (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/blademaster-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  appends a distinct gesture for each Blademaster normal and his back throw,
  preserving the shipped plunge and double-jump flip.
  `bun tools/animations/peon-clips.ts STOCK_PEON.mdx PRIVATE_OUTPUT` appends
  Peon's tool strikes, movement, recovery, paired grabs and nine pain poses,
  preserves the 22 stock sequences and writes both-facing silhouette sheets.
  `bun tools/animations/peon-pool.ts AUTHORED_PEON.mdx PRIVATE_OUTPUT` prepares
  Peon's checked pooled clips and a retained record for the final roster export.
  `bun tools/animations/warden-fan-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` authors
  Warden's ground and air Fan of Knives casts, preserving other clips
  (smashcraft:docs/design/warden-fan-of-knives.md).
  `bun tools/animations/down-air-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT` writes
  both-facing down-air sheets from production pose selection and the roster's
  strike-height inventory (smashcraft:docs/down-airs.md).
  `bun tools/animations/pain-captures.ts PRIVATE_OUTPUT [FIRST_FIGHTER_SLUG]` plays accepted hits through
  the Wisp map, checks held hitstun and recovery, validates the bound pain models,
  and renders interruption, entry, held and recovery frames for the remaining roster.
- Definitive body textures: `bun tools/animations/hd-textures.ts PRIVATE_FAMILY CASC_EXTRACTOR [STORAGE]` packages existing stock DDS mipchains at up to 512 pixels under exact HD map imports and changes only the bodies' texture names. No texture is reencoded. The map build refuses an unresolved HD body texture.
  `bun tools/animations/stand-captures.ts PRIVATE_OUTPUT` checks each selectable
  fighter's shipped timeline against its source geosets at every Stand/move frame
  and renders both-facing Stand frames in Classic and Definitive.
  `bun tools/animations/grab-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]` appends
  coordinated expansion-hero reach, hold, pummel and four-direction holder/victim
  gestures or reauthors their existing indices. `--character` limits reauthoring
  to one expansion fighter (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/pit-lord-specials.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  authors Pit Lord's four special gestures while preserving all earlier clips.
  `bun tools/animations/kaelthas-clips.ts STOCK_BLOOD_MAGE.mdx PRIVATE_OUTPUT`
  appends Kael’thas’s normal, special, paired throw, recovery and nine pain
  gestures, preserves all eleven stock sequences, and writes both-facing sheets.
  `bun tools/animations/murloc-clips.ts STOCK_MURLOC.mdx PRIVATE_OUTPUT` appends the
  Murloc's normal, special, paired throw, recovery and nine pain gestures to the
  stock Tiderunner, preserves its nine sequences and writes both-facing sheets;
  run it twice for a fresh clip table, since its reach search reads the table.
  Add `--kobold` with the stock Kobold input to author Kobold's pick, candle,
  recovery, throw and nine pain gestures and refresh only his clip/stride rows.
  `bun tools/animations/anubarak-clips.ts STOCK_CRYPT_LORD.mdx PRIVATE_OUTPUT` authors
  Anub'arak's insect gestures, floor burrow, paired throws and nine pain poses,
  preserving all seventeen stock clips and writing both-facing pose sheets.
  `bun tools/animations/grab-pads.ts` generates the #180 mirror and unlike-height capture batch:
  every selectable fighter, four throws, both facings, with ordinary catch/pummel
  inputs and contact-frame captures in smashcraft:ts/test/native/pads/180/.
  `-dev quick pair FIRST / SECOND` selects different named fighters in the two human slots.
- Original strike authoring (from the repository root):
  `bun tools/animations/grom-clips.ts STOCK_GROM.mdx PRIVATE_OUTPUT` authors
  Grom's axe attacks, war cry, rush, leap, throws, recovery and nine pain
  poses on his stock campaign rig and writes both-facing sheets.
  `blender --background --python tools/animations/strikes.py -- rifleman|illidan`.
  `SMASHCRAFT_ANIMATION_ASSETS=PRIVATE_DIR` selects the editable inputs;
  `SMASHCRAFT_STRIKE_CLIP='Attack Jab'` reauthors only the jab.
- Thrall stock-rig animation authoring (from the repository root):
  `bun tools/animations/thrall-clips.ts STOCK_THRALL.mdx PRIVATE_OUTPUT [POSE...]` appends
  mounted hammer, casting, recovery, grab and nine contact-reaction clips,
  writes both-facing side-view sheets, and refreshes Thrall clip and stride
  metadata. Store the generated model in `hero-models` and refresh the
  original clip pool before building. With pose names, reauthor only those clips
  from the existing `PRIVATE_OUTPUT/thrall.mdx`, preserving every other clip.
  Exact `Thrall Damage HEIGHT STRENGTH` names (each number 0–2) replace only
  the selected held pain poses; the generator requires nine distinct first poses.
- Illidan locomotion authoring (from the repository root): run Blender with
  `--python tools/animations/illidan-locomotion.py -- PRIVATE_FIGHTER.blend PRIVATE_AUTHORED`,
  then `bun tools/animations/illidan-locomotion.ts PRIVATE_ASSETS PRIVATE_AUTHORED PRIVATE_OUTPUT`.
  Package with `bun tools/animations/package-illidan.ts PRIVATE_OUTPUT --metadata-only`,
  store `illidan-animation`, and refresh the original clip pool.
- Malfurion stock-rig authoring: `bun tools/animations/malfurion-clips.ts STOCK_FURION.mdx PRIVATE_OUTPUT` appends staff, nature-spell, recovery, paired-throw and nine pain gestures while preserving the eight campaign sequences.
- Medivh animation authoring (from the repository root):
  `bun tools/animations/medivh-clips.ts STOCK_MEDIVH.mdx PRIVATE_OUTPUT`
  appends staff, blink, raven, grab, recovery and nine pain clips, preserving the
  22 stock sequences. Store `hero-models`, export only Medivh, then timeline it.
- Jaina animation authoring (from the repository root):
  `bun tools/animations/jaina-clips.ts STOCK_JAINA.mdx PRIVATE_OUTPUT`
  appends her staff strikes, spell gestures, movement and nine contact reactions;
  store the generated model in `hero-models` and refresh the original clip pool.
- Tinker animation authoring (from the repository root):
  `bun tools/animations/tinker-clips.ts PRIVATE_CLASSIC_HEROTINKER.mdx PRIVATE_OUTPUT [--no-pool]`
  preserves the 23 classic sequences and authors the claw-pack, Robo-Goblin,
  recovery, paired throws and nine pain reactions. It writes the private
  model, both-facing silhouette sheets, clip metadata and measured stride;
  `--no-pool` leaves pooled export to the combined roster pass
  (smashcraft:docs/fighter-animation-work.md, "Goblin Tinker").
- Lich King animation authoring (from the repository root):
  `tools/animations/build-lichking.sh [PRIVATE_INPUTS] [IMMUTABLE_EXISTING_MODEL] [--replace NAME]`
  authors clips through Blender; the optional existing model preserves shipped
  sequences and appends only new clips; `--replace NAME` reauthors one existing clip at its same index and length (smashcraft:docs/fighter-animation-work.md).
- Definitive fighter body: `bun tools/animations/hd-models.ts AUTHORED.mdx STOCK_DEFINITIVE.mdx PRIVATE_OUTPUT.mdx [--character ID --rig PAIRS.ts]`
  transfers production poses to the stock Definitive rig and checks both retargeted
  clips and the final timeline within 0.5 units / 0.5 degrees.
- Normal timeline body pilot (from the repository root):
  `bun tools/animations/timeline-models.ts PRIVATE_ASSETS PRIVATE_POOL MountainKing`
  combines Mountain King's normal mesh and keys into one seekable model in a writable copy
  of `original-clips-static-lights` and refreshes its clip and model tables.
  Store the family with `bun wisp inputs add original-clips-static-lights PRIVATE_POOL`.
- White body flashes (from the repository root):
  `bun tools/animations/white-flash-models.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]`
  authors white body-only copies with the original meshes and keys for selectable gameplay poses, removing unused sequences and repeated constant keys for charge and heavy-hit flashes; store PRIVATE_OUTPUT as `impact-assets`.
  `--character` refreshes one fighter in an existing PRIVATE_OUTPUT family and its model tables.
- Sylvanas animation authoring (from the repository root):
  `bun tools/animations/sylvanas-clips.ts STOCK_SYLVANAS.mdx PRIVATE_OUTPUT`
  appends bow attacks, casts, recovery, paired grabs and nine damage reactions
  to the classic undead Sylvanas rig, preserving its stock sequences.
- Cairne animation authoring (from the repository root):
  `bun tools/animations/cairne-clips.ts STOCK_TAUREN.mdx PRIVATE_OUTPUT`
  appends the complete totem kit, recovery, paired grabs and nine pain clips
  to the private classic Tauren Chieftain model, preserving its stock clips.
- Forsaken Paladin animation authoring (from the repository root):
  `bun tools/animations/forsaken-paladin-clips.ts STOCK_FORSAKEN_PALADIN.mdx PRIVATE_OUTPUT`
  keeps the stock Forsaken body, sword and rig, and
  authors his strikes, recovery, paired throws and nine pain poses.
  `bun tools/animations/stock-forsaken-model.ts STOCK_CLASSIC_FORSAKEN.mdx AUTHORED_FORSAKEN.mdx PRIVATE_OUTPUT.mdx`
  restores the stock Classic mesh and version-1800 skin while retaining the shipped motion.
- Chen animation authoring (from the repository root):
  `bun tools/animations/chen-clips.ts STOCK_CHEN.mdx PRIVATE_OUTPUT` authors
  Chen's staff, footwork, special, recovery, paired throw and nine pain clips
  from his private stock model and regenerates his clip table
  (smashcraft:docs/design/chen.md).
- Damage reactions (from the repository root):
  `bun tools/animations/damage-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  appends all 13 fighters' nine articulated contact reactions, checks their
  drawn first poses, and preserves old sequences. Store changed model families
  and refresh the clip pool (smashcraft:docs/fighter-animation-work.md).
- Fresh match: `bun wisp fresh MAP.w3x [--rebuild]` starts a new game, sends
  `-dev quick`, and waits until every signed-in client writes its receipt.
  `--rebuild` replaces the map script first. Other quick starts for `--chat`
  and pad scripts: `-dev quick hero NAME`, `-dev quick recovery hero NAME`
  (starts tumbling above the floor for recovery captures), and `-dev quick cpu OPPONENT DIFFICULTY [hero NAME]`,
  a quick match against a named computer at the selected difficulty over three stocks.
  `-dev quick promo stage N pair FIRST / SECOND` starts two Wren Expert computers over three stocks with match HUD, hints and developer receipts hidden (for example `-dev quick promo stage 0 pair rifleman / illidan`). `-dev reset` restores the normal UI.
  `-dev quick stage N [lighting stock|stage] [backdrop on|off] [view near|far|off] [fog on|off]`
  applies the stage look before the first match draw, avoiding midmatch chat.
  Classic and Definitive use the same setup; omitted options keep current defaults.
  `-dev classic NAME` starts that fighter's Classic run and `-dev classic boss NAME` its boss battle (smashcraft:docs/design/classic-mode.md).
  `-dev lore N` starts Lore Battle N (1-20, smashcraft:ts/src/game/classic/loreBattles.ts) for the first player.
  `-dev lore win` during a Lore Battle knocks out every opponent (a boss's health to zero), so the battle ends and is saved as cleared through the normal result.
  `-dev quick offstage hero NAME` starts the #189 recovery check at x=700, z=300 on Frozen Throne with jumps spent.
  The named variant uses the normal CPU selection rule.
  `-dev pain HEIGHT STRENGTH FIGHTER` starts the #181 mirror capture fixture:
  low/middle/high and small/medium/large, with ordinary projectile contacts at
  frame 150 after both players' scripted jab. `bun tools/animations/pain-pads.ts`
  from the repository root generates its 117 native parity scripts.
- Item setup at fighter selection: `-dev items on|off` controls whether pickups appear;
  `-dev item speed|jump|heavy on|off` controls each kind. The normal selection
  buttons show Items, Speed, Extra jump and Heavy, all on by default.
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
- One-client look captures (clone-a, or any single signed-in client):
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
- Offline LAN pool, the default for native testing (see "Native testing and
  UI"), on live build 3.0.0.24268 only (the private LAN plugin refuses other
  builds): `bun wisp lan setup --from INSTALL [--pairs N]` creates throwaway
  clients with no account from one updated install (a clone's
  `pfx/drive_c/Program Files (x86)/Warcraft III`, under 1 s for 4 pairs); `bun wisp lan pool --pairs N [--pool-profile
  parity|visual]` runs them in pairs, each pair in a network namespace with
  only loopback (foreground, admitted by the capacity helper); `bun wisp lan
  fresh MAP.w3x [--pair K]` hosts and starts a LAN match on Wisp's own host;
  `lan status`, `lan end --pair K`. The host logs every turn's actions and
  compares checksums each turn. Joining LAN games needs Wisp's private LAN
  plugin in ~/.local/share/wisp-private/lan/. The pool's clients file is
  ~/.local/state/wisp/lan/clients.json (wisp:docs/lan.md). Pad parity on the
  pool takes an integrity map (`bun wisp map build --profile integrity` or
  `map rebuild MAP --profile integrity`) and `--pair K...`; measured 9 Oct, a
  pair runs 70 s after `lan pool` starts and is in a match 36 s after `pad`
  asks. Run two pairs by default and add one only while the capacity helper's
  `protectedCpuSomeAvg10` stays under 20 (three pairs read 22-31 under normal
  agent load).
- Client recovery: `bun wisp client doctor [CLIENT...]` brings clients A and B to a
  ready state: it recovers a client that dropped from Battle.net, crashed
  with its error dialog up, sits at the empty login shell, a stale lobby or
  a stuck loading screen, or shares its prefix with a second runtime, and
  signs a launcher at its Battle.net sign-in form in with the client's account
  (A: account c, B: account b; smashcraft:ts/scripts/wisp/doctor.ts), so Tom
  never signs in by hand (wisp:docs/doctor.md). Clients named clone-a, clone-b,
  clone-c or clone-d start only through ~/.local/share/wisp/online/launch.sh and keep
  their own sign-in (wisp:docs/lan.md, "Clone-a"). `bun wisp client sign-out
  CLIENT...` signs a client out; the next doctor run signs it in. `fresh`,
  `integrity capture` (bot sessions included), `play` and `accept` run it before
  they start and once after a failure; run it instead of driving a client by
  hand.
- Client driver: `bun wisp client look|read|click|keys CLIENT ...` reads and
  drives a client. Session values live in ~/.local/state/smashcraft/clients.json.
- Menus: `bun wisp menus host|join|start|leave` drives lobbies through Wisp's
  menu page instead of clicks (`install RETAIL_DIR --port N` once per prefix,
  with the account owner's agreement; smashcraft:docs/wisp.md, "Menu control").
- Direct play: `bun wisp online host [--client NAME] [--password VALUE]` hosts the newest
  Smashcraft map as a private Battle.net game and prints its join code;
  `bun wisp online join CODE [--client NAME] [--password VALUE]` joins it;
  with an explicit host password, the guest supplies that same password. All
  hosted games are private and passworded; without the flag the code carries
  the generated password. Both return at fighter selection. The host presses Start now once the guest has joined; no Battle.net chat is sent.
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
  with a full three-stock Illidan against Wren Expert Rifleman. `--script FILE`
  runs the native driver's exact pad inputs; `--headless --frames N --out DIR`
  saves frame checksums and captures (`--capture-frames N,N` picks their frames).
  `--presentation native|pool-confirmed|pool-predicted` selects fighter presentation;
  live play defaults to `pool-predicted`, scripts to `native`.
  `--four-fighters --frames 7200 --out DIR` is wisp#48's 60 FPS measurement
  (one game copy, four fighters; smashcraft:docs/play.md).
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
  FRAME.ppm...` report what a player would see wrong; `view models --prune` removes facts for deleted models without remeasurement; `view models` rewrites
  the model facts they read; `view models ... --only MODEL,...` refreshes only the named rows (smashcraft:docs/player-view.md); `view strikes --assets DIR`
  rewrites the hero strike moments swings and specials align to
  (smashcraft:docs/fighter-animation-work.md, "Hero swing alignment");
  `view motion --assets DIR [--character ID]` measures every fighter's movement and recovery
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
- Headless match: `bun wisp headless [quick-match|desync] [--clients N] [--journey FILE] [--render DIR --frames N... --graphics classic|definitive]` plays
  the dev build's quick match in simulated clients in about a second and prints
  desyncs, error reports and scene problems; `--cost` adds its predicted
  Warcraft cost per frame. `--render` draws requested frames using the map's
  immutable imports and classic Warcraft assets; `--journey FILE` supplies
  capture inputs as journey JSON. Stock extraction uses `CASC_EXTRACTOR`
  and `WC3_STORAGE`; stock caches follow that installation's `.build.info`, so
  updated game art is extracted again. `WC3_ASSET_MANIFEST=FILE` records the build
  and SHA256 of every returned asset for a comparison. `WC3_TEXTURES` reuses extracted PNGs
  (smashcraft:docs/player-view.md).
- Frame cost: `LUA=<32-bit lua> bun wisp perf [quick-match|bot|bot-four|playable-bot-four|playable-duel|playable-human-four]`
  plays a run in 32-bit Lua and prints each client's predicted Warcraft cost
  per frame (p50, p95, worst, typing stall); `bun wisp perf compare A B` fails
  on a rise in predicted cost, allocation or typing stall. Landing gate (#48):
  CI holds `playable-bot-four` to smashcraft:ts/test/fixtures/perf/playable-bot-four.perf;
  after an intended rise or a cut, rewrite that file with `--out` and commit it.
  Wisp-only acceptance: `bun wisp perf native READINGS --samples FILE --json`
  checks retained solo/four-fighter references within 20% at callback p50/p95;
  then `bun wisp perf compare BASELINE CANDIDATE --json` gates the current
  candidate. The exact command and calibration scope are in
  smashcraft:docs/native-bot-session.md, "Wisp-only frame-cost acceptance".
  `bun wisp perf budget RUN_FILE` holds a `--samples` run to #168's frame
  budget (p99 10 ms, worst 14 ms predicted). `bun wisp perf profile
  playable-bot-four --phases --out FILE` preserves measured samples and each
  client's slow-frame phase samples and simulation/repair step counts;
  profiling is a separate replay, excluded from measured costs. Spike census (#168): `bun wisp
  perf census [--fighter NAME] [--stage ID] [--functions]` plays every
  fighter's moves, specials and follow-ups in a playable-build training match
  and every stage's hazards, and fails any entry over 2 ms above its standing
  baseline; `--functions` names the map functions of each worst frame. Run it
  on the farm (`bun wisp farm perf "census --fighter rifleman --functions"`).
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
  seeded Wren Expert matches each; `SWEEPS=1 GAME_TESTS=botCoverage bun test test/game.test.ts`
  checks the same report as a sweep (in Bun and Lua32), and the suite plays
  one seeded match a fighter.
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
- Compute farm: `bun wisp farm test [--ref REF] [--wait]` runs the full Bun
  and 32-bit Lua suites, sharded by measured time
  (smashcraft:.github/workflows/farm-test.yml).
  `bun wisp farm balance [--ref REF] [--wait]` plays the
  balance gate's computer field (Wren Expert, 400 a pair; `--opponent`, `--tier`,
  `--per-pair`, `--seeds`) on GitHub's free hosted runners, a `cpuField
  --pairs` process a core, eight pairs a job and at most 8 jobs at once (the
  account runs 20 jobs at once; wisp:docs/ci.md, "Runner capacity and
  waiting"), then each fighter's spam probe (its top damage move only,
  `--probe N` matches a pair, 40 by default, 0 to skip), and with `--wait`
  prints the verdicts, the field table and the damage-by-move, play-style,
  openings-per-kill and balance-score tables (smashcraft:docs/design/balance.md).
  A Wren Expert run with at least 400 matches per pair fails when the win-rate
  gate or the balanced gate fails, after publishing the report artifact;
  lower-tier or smaller exploratory fields remain reports.
  `--matchups rifleman:chen-stormstout,lich:chen-stormstout` runs only those
  named pairs for a repair comparison; its report is not a full-roster gate.
  `bun wisp farm pads [--ref REF] [--only PATH]... [--wait]` plays
  every top-level smashcraft:ts/test/native/pads/ script (or each issue
  file or folder named by `--only`, such as `--only 151 --only rifleman-cues.pad`) headless through the
  real helper against its own `#!` expectations, for a change that moves hit
  timing or a new issue script on a loaded host; each job uploads its traces
  (`gh run download RUN`), the source of a new script's `#! expect` lines;
  `bun wisp farm perf ["RUN ARGS" ...] [--out DIR]` runs each
  `bun wisp perf RUN ARGS` in its own job (default `playable-bot-four`),
  prints each summary and writes each run to DIR. Predictions come from
  counts, so a runner predicts what this machine would; use it instead of a
  local perf run; `bun wisp farm memory [--minutes N] [--wait]` runs the
  30-minute memory soak (also nightly). Without `--ref` it measures the checkout's HEAD (a commit not on
  main goes to a scratch `farm/` branch, deleted after the run).
  `bun wisp farm memory --matches 50 --ref FULL_SHA --wait` runs the playable
  Lua build in two clients per job through 50 all-computer matches across at most
  four jobs, including rematches,
  and fails on a crash or desync. `bun wisp soak memory --matches N --bundle FILE`
  checks an extracted playable Lua bundle locally; its report names every match.
  Use the farm instead of a local cpuField or pad run: the repository is public, so the
  runners cost nothing, and this machine stays free. Measured 7 Oct on main
  43021d8c: the level-9, 400-a-pair field (26,400 matches) took 4.1 min from
  dispatch to the printed table, against about 25 min locally; all 17 pad
  scripts took 4.2 min.
- Tapes: set `LUA` to the 32-bit Lua executable, then run `bun wisp parity tapes` to
  compare replay results across Bun, that Lua32 and a Lua32 whose raw float
  `+ - *` round toward zero (`TOWARD_ZERO_LUA`, or built with nix on first use).
- Native corpus (wisp#69): every native session (`pad`, `fresh`, captures, `accept`,
  `client doctor|watch`) records what its clients' maps wrote into
  ~/.local/state/wisp/corpus/ with no extra step:
  each match's replay, whose test-build frames each carry a digest of every
  fighter's position, velocity, action, timers, shield and damage
  (smashcraft:ts/src/game/replay/frameDigest.ts). `bun wisp parity corpus [DIR...]`
  replays every recording (by default smashcraft:ts/test/corpus/ and the local
  corpus) in Bun and 32-bit Lua, each on the commit that recorded it, and names
  each replay's first divergent frame and field; `bun wisp parity corpus keep
  RECORDING...` copies local recordings into smashcraft:ts/test/corpus/, which
  CI and `farm test` replay on every push.
  A native box in a subsystem with zero corpus divergence is met by its
  headless check plus the weekly native spot batch. Keep the corpus coverage
  and replay result for that subsystem in wisp#69; native lanes batch the
  weekly spot checks with their other pending sessions.
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
  [--compare NATIVE_DIR] [--render DIR --frames N... --graphics classic|definitive]` plays the same script through the same helper into
  headless integrity clients. `--render` draws the script captures after the
  session stops; `--frames` selects their comma-separated frame numbers.
  Repeat `--graphics classic --graphics definitive` to draw the same captured scenes in both profiles, in `DIR/classic` and `DIR/definitive`.
  Headless checks hold the script's capture frames even without `--render`,
  so brief spell cues are observed before play resumes.
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
  types `-dev reset` between scripts (a new game only after an invalid run;
  `--hot` also hot-reloads the current TypeScript before each script),
  runs every headless side alongside (`--headless-jobs N`) and compares as
  each native run ends; `--pairs N` (the first N) or `--pair K` (a share) shards over the offline LAN pool.
  Never loop `bun wisp fresh` + `bun wisp pad` per script (about a minute a
  script); `--fresh-each` exists only to measure that. `bun wisp pad
  SCRIPT|DIR... --headless ...` plays the same batch in one headless session
  (smashcraft:docs/native-bot-session.md, "Many scripts in one game").
- Pad cut (#233): `bun scripts/nativePadCut233.ts --pair N --clients-file FILE --helper WC3_CONTROLLER --map MAP --out DIR --app-id NAME=ID --app-id NAME=ID` uses one existing offline LAN pair, stops its own controller producer for 1 s, and checks the HUD waiting count and normal match results.
- Keyboard timing: `bun scripts/nativeKeyboardPad.ts --script FILE --helper WC3_CONTROLLER --out DIR --clients-file FILE --client NAME --app-id ID`; `--observe` validates the same SDL stimulus without keyboard output. It records the original physical 60 Hz deadlines on CLOCK_MONOTONIC, separately from native simulation frames; this is playable draw timing, while journal parity remains `bun wisp pad`. Export the response probe after capture.
- Native acceptance: `bun wisp accept [--only ID...] [--pair K... | --pairs N | --clients-file FILE] [--solo] [--map MAP.w3x] [--dry-run]` runs every
  open native check declared in smashcraft:ts/scripts/wisp/acceptChecks.ts in
  as few fresh matches as their maps allow and prints pass, fail or
  needs-look per check with its evidence folder (wisp:docs/accept.md). `--pair K`
  selects the offline pool pair; every check, capture and receipt follows its
  two clients, and sessions start through `lan fresh`. `--solo --pair K`
  starts each client in its own single-player game through `lan solo`, for
  captures on 3.0.1 where LAN is removed; it sends each game's setup separately.
  Several pairs
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
  `-dev camera-smooth on|off` compares native one-frame camera transitions
  with the normal camera in the same development map; it keeps the simulated
  camera unchanged (smashcraft:docs/high-refresh.md).
  `bun scripts/cameraDraw.ts --video PRIVATE.mkv --pages DATA_DIR --out PRIVATE_DIR
  [--slot 0 --run 1 --viewport X,Y,W,H]` joins lossless compositor frames and
  their original timestamps to the response marker and exported callback rows.
  Script-cost capture: `bun wisp build --profile native-perf ...` uses playable
  key input and pooled presentation with developer setup commands. In a match,
  `-dev capture 18000` writes every client's raw callback samples; read full-run
  median/p95/p99/worst with Wisp's capture reader. Procedure and limits:
  smashcraft:docs/native-bot-session.md, "Raw playable cost captures".
- Capture judge: `bun wisp judge DIR --rubric FILE` writes `DIR/judge.json` with each case and measurement line, checks drawn frame stamps, and lists only crops near a rubric threshold for model inspection. Rubric format and #82 reference: `docs/capture-judge.md`, `ts/test/native/rubrics/82-f9d0fbf3.json`.
- Stage lighting: `bun wisp accept --only '170-*'` captures stock lighting, a
  fighter mask and stage lighting in one paused scene per stage. From the
  repository root, `bun tools/stage/contrast.ts MASK.png STOCK.png STAGE.png`
  measures fighter/background lightness and colour distance. The native
  owner records the graphics profile and checks #168's budget; procedure:
  smashcraft:docs/design/visual-quality.md.
  `bun wisp accept --only '191-*'` captures every stage at its closest and
  widest gameplay camera for the floating-stage art checklist. Development
  maps expose `-dev view near|far|off` for those framings and
  `-dev fogv STYLE ZSTART ZEND DENSITY HEIGHTSTART HEIGHTEND LINEARSTART LINEAREND R G B OVER_SKY`
  for the existing 3.0 fog comparison; these affect only local presentation.
- Stage-select cards: `bun scripts/stageThumbnails.ts --stage NAME` (from ts/,
  through the capacity helper) regenerates one stage's layout silhouette and
  hero render, stores it and records its input hash in its own row of
  ts/stage-thumbnails.json; run it after changing that stage or its art, or
  ts/test/stage-thumbnails.test.ts fails and prints the command. Without
  `--stage` it redraws every stage (smashcraft:docs/design/stage-select.md).
- Melee oracle: `bun wisp oracle` plays Melee situations for every fighter
  and prints each outcome beside the value cited from the decompilation; the
  test suite fails on any mismatch it doesn't list as known
  (smashcraft:docs/physics.md, "Melee behaviour oracle").
- Combo potential: `bun wisp combos [--fighter NAME]... [--jobs N]` searches
  true combos and tech-chase reads, replays its best routes, and writes the
  per-fighter openings-per-kill table (docs/design/balance.md, "Combo potential").
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
the clean-room check (smashcraft:ts/scripts/cleanRoom.ts: no game files or
copied game scripts outside smashcraft:clean-room-allowlist.tsv; wisp:docs/clean-room.md),
`bun run check` and the type-escape audit (smashcraft:ts/test/source-shapes.test.ts)
when the pushed commits change ts/, the model facts check
(smashcraft:ts/test/model-facts.test.ts; it refuses with the `bun wisp view models`
refresh command) when they change clips or model build inputs, and client/ui's
type-check when they change it, in a few seconds (smashcraft:ts/scripts/prePush.ts).
It checks the working tree, so push from a clean checkout of the commit.
A push to main then runs the tests its change affects (`bun wisp dev`'s selection, plus the affected game modules in 32-bit Lua when sim code changed; at most 150 s, under the capacity helper) and is refused when one fails that main's latest completed CI run doesn't, naming each and its rerun command; tests main already fails don't block, and each verdict is appended to new-fail-gate.tsv in the clone's git directory (smashcraft:ts/scripts/newFailures.ts).

Main stays green. Each CI run on main opens, updates or closes the one
"main is red" issue (smashcraft:.github/workflows/main-red.yml), which lists the
failing tests and the first failing commit; the pre-push gate prints that list
on every push. A red main is not "already failing": before landing, check
whether your change touches a listed test, and if your commit broke main, fix
it first.
A push to a `claude/**` branch (a cloud worker's) lands on main by itself
when its full suite adds no failure to main's, and otherwise comments on the
referenced issue (smashcraft:docs/ci.md, "Autoland").

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

A steady 60 fps is unconditional (Tom, 9 Oct): players react to what each
frame shows, so a repeated frame breaks competitive play. The map's own work
stays under 10 ms on every frame, worst case included, so Warcraft can draw
inside 16.7 ms. A frame-cost box that misses this is unfinished work, never a
target to relax or a choice to put to Tom.

Pick the clients by what the test needs (Tom, 7 Oct). The offline LAN pool
is the default for native testing: pad parity runs, captures, `accept`
checks and desync hunts.

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

Native lanes: four solo-profile lanes, one per client (a, b, c, d), share
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
The signed-in clones (B, C, D) are only for tests that need Battle.net
itself: real netplay or latency, direct play (#142), spectating, and as the
updated install the pool is copied from. Keep them stopped otherwise; with
all three running, two pool pairs pushed protected pressure to 44. Tom's install (account a,
display :0) is Tom's. A run during which a client wrote a desync report or
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

Don't publish releases, GitHub or otherwise, until Tom decides to release.
Playable candidates are private builds named Smashcraft 0.0.N; increment only N.
Internal diagnostics use distinct run IDs and names without advancing the
player release counter. Always identify the current playable artifact separately
from an experimental candidate; a diagnostic pass does not replace that release. Install one
current candidate under Maps/00-Smashcraft. Keep proprietary game assets and
base maps privately outside repository trees. Preserve peer work in owned lanes.
