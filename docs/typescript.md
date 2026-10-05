# TypeScript in Smashcraft

Smashcraft's TypeScript compiles to Warcraft's Lua through TypeScriptToLua
(smashcraft:ts/). This page is the style contract for the game code. Behavior is
checked by tests and recorded tapes
(smashcraft:docs/warcraft-api-netcode-findings.md#lua-numbers-in-the-game
explains why three runtimes are compared).

Wisp is maintained in its own repository. smashcraft:ts/wisp.lock records
the immutable source revision and generated archive consumed by Bun. A clean
checkout needs only `bun install --frozen-lockfile` from smashcraft:ts/;
installing this dependency requires no private GitHub credentials.

Wisp owns compilation, numeric helpers and guards, reload and error
reporting, host services, and archive packaging. Smashcraft owns the map
declaration in smashcraft:ts/scripts/mapInfo.ts, imports and object data in
smashcraft:ts/scripts/wisp/mapInputs.ts, project paths and naming in
smashcraft:ts/scripts/wisp/project.ts, and game-specific commands, assets,
replay corpora and native acceptance journeys.

To update to Wisp's current published `main`, run from smashcraft:ts/:

```sh
bun run update:wisp
```

The updater fetches private Wisp `main` using Git's configured credentials,
resolves its commit, generates the Lua modules and declarations needed by TSTL,
and updates the archive, smashcraft:ts/wisp.lock, package metadata and Bun
lockfile. An already-generated archive for that commit is reused. There is no
manual SHA or archive-name selection. The dependency stays at that resolved
commit until the next update; `bun install` does not follow the branch.
Compiler versions remain separately pinned in smashcraft:typescript-toolchain.lock.
To select an exact source revision explicitly, use
`bun run update:wisp /absolute/path/to/wisp/checkout FULL_COMMIT`.
Generated dependency output belongs in smashcraft:ts/vendor/; maintained
framework implementations belong only in Wisp. Commit the new pin,
package metadata, Bun lockfile and generated archive together after checking
the affected consumer commands.

## The runtime decides the numbers

Map Lua has 32-bit integers that wrap silently and binary32 numbers whose raw
`+` and `*` don't round to nearest. Bun computes in binary64. So:

- Integers: `idiv`, `imod`, `floorDiv` and `floorMod` from `wisp/src/sim/intMath`. Never
  `Math.floor(a / b)` or `%` on integers: the first loses bits above 2^24 in
  Warcraft, the second floors in Lua and truncates in JavaScript.
- Bitwise `&`, `|`, `^` and `<<` are exact on 32-bit values in both runtimes;
  use them for masks instead of division arithmetic. Shift right with
  `floorDiv`: TypeScriptToLua rejects `>>`, and its `>>>` masks with
  4294967295, which a 32-bit Lua integer can't hold.
- Reals in synchronized code: wrap each real `+ - * /` in `f32()` (host
  rounding, free in Lua), or use the exact `wisp/src/sim/binary32` helpers where the value
  must match Melee or the game bit for bit.
- Decimal literals are exact binary32 values (`0.10000000149011612`, not `0.1`)
  and keep a decimal point (`2.0`) so they stay Lua floats.

## Model the data

- Records are `interface` or `type` with plain fields. No getters around
  fields, no positional setters such as `assign(held, pressed, released, x, z)`;
  pass an object or copy with a named function.
- Make invalid states unrepresentable: discriminated unions for state machines
  (`{ kind: "shieldStun"; frames: number }`), literal unions or `as const`
  tables for enumerations, `undefined` for absence instead of `-1` or `null`
  sentinels. Keep numeric codes only where a wire format or checksum needs them,
  at that boundary.
- `readonly` for data that doesn't change after creation; `as const` tables for
  move data and tuning constants.
- Validate at boundaries (decoding packets, reading files, chat commands) and
  return `T | undefined` or a result union. Inside the simulation, types carry
  the guarantees.

## Shape the code

### Effect on the host

Wisp's host tools use Effect for asynchronous orchestration: typed failures,
boundary decoding with Schema, bounded client publication and scoped resource
ownership. `smashcraft:ts/scripts/wisp.ts` is the single CLI entrypoint;
`bun wisp hot`, `build`, `rebuild`, `fresh`, `client`, `tapes` and `parity`
are commands composed from shared GameFiles, Clients, MapBuild, HotReload and
SourceErrors services. Each command prints its steps and elapsed time. Hot
reload publishes every client's payload before any manifest, into each
client's `CustomMapData/smashcraft-hot` folder, which every client polls 32
times a second ([Wisp hot reload](https://github.com/tompassarelli/wisp/blob/main/docs/hot-reload.md)).
In `hot --watch`, each change's `vN running in 2 client(s)` line ends at the
time from its save to both clients' acknowledgements. A failed or cancelled
publication does not count as installed; client acknowledgements decide that
result. Warcraft acknowledgement files contain a complete Preload
function, including whitespace and line endings around the message.

Map builds use staged outputs: interrupting a step stops its child process, a
failed step leaves the previous map in place, and archive entries are verified
four at a time. `wisp parity numeric` compares the numeric corpus against
Lua32; `wisp parity capture` and `wisp parity result` run and reconcile
the native issue #26 input-integrity check through the same CLI. `wisp fresh
MAP.w3x [--rebuild] [--from-game]` rebuilds the map script when requested,
starts a new match, sends `-dev quick`, and waits for every client's typed
receipt. Use `--from-game` when every client is already in a running map:
it skips menu discovery, opens and checks Game Menu, then runs the recorded
End Game / Quit Mission sequence. The ordinary mode also accepts results,
lobby, Create Game and Custom Games screens. Both modes verify results and
Custom Games after leaving, actual lobby player counts after hosting/joining,
and fresh ready files after loading. It then checks what each player sees
(smashcraft:docs/player-view.md).

`bun wisp hot --data A --data B --watch` also prints each native desync:
its turn and every Warcraft engine value that differs, with both clients'
values, from the Desync.txt each client writes (see Wisp's
docs/hot-reload.md, "Desync reports"). To check that path, type
`-dev desync` in a dev-console build (`main` or `integrity` profile): the
typing player's client alone creates one timer, so the clients' handle
counts diverge and Warcraft ends the game in a desync. The playable profile
registers no `-dev` command.

The playable profile does not poll for hot reloads either (`MapBuild.hotReload`).
Under Wine a lookup of a missing file reads its whole folder, and a client
without a `smashcraft-hot` folder pays that for all of CustomMapData on every
poll. Candidate 0.0.44 (`a5a0315`) polled 32 times a second while client A's
CustomMapData held 94,057 files and no `smashcraft-hot` folder. Listing them
takes 32–35 ms on this host, so the polls asked for about 1 s of lookups per
second of game, and both clients nearly stopped at fighter selection.
smashcraft:ts/test/selection-load.test.ts keeps file reads and effect
creation out of the playable entry's selection frames.

Pure simulation, numeric operations, code transforms and binary-format
encoders remain plain TypeScript. The TSTL map compiler uses TypeScript 6's
compiler API, while the host checker uses TypeScript 7 with Effect tsgo. A
project `bun install` patches the native checker through the postinstall
script; ordinary checks reuse that binary without rerunning the patcher. A
successful host check does not establish that a library can compile to Lua.
Effect stays on the host. The installed package has no Lua module for TSTL to
resolve, and compiling Effect 4.0.1's source with TSTL 1.37.1 crashes the
compiler; past that, Effect's core creates BigInt values at module load, which
TSTL's Lua library lacks. From smashcraft:ts/,
`bun test/compatibility/probe-effect-tstl.ts` reproduces the resolution failure
and the compiler crash. The map also has no suspended work for fibers to
own: one frame timer advances explicit state, callbacks rebind by name after
hot reload, and rollback snapshots hold all gameplay state
([wisp#1](https://github.com/tompassarelli/wisp/issues/1)).

For APIs, read smashcraft:repos/effect/LLMS.md and its version-matched source
and tests. Application imports resolve installed packages, not vendor paths.
The exact reference identity is smashcraft:repos/effect.json; its update
procedure and cadence belong to smashcraft:.agents/skills/effect/SKILL.md.

### Game modules

- Name each module for the specific data or responsibility it owns, and each
  export for the value or operation its callers use. Avoid names inherited from
  the source language or names that promise a feature the module does not have;
  keep foreign names only at an actual foreign interface.
- Simulation is data plus functions over data. Use a class only for an owner
  with identity and a lifecycle, such as a native handle or a presentation
  object, never as a namespace.
- One concept per module, named exports, no default exports. Module scope does
  no work at import time: no natives, timers or triggers until an explicit
  `start`.
- Use the language: destructuring, `for…of`, optional chaining, `satisfies`,
  inference where a declaration adds nothing, and early returns over nesting.
- Synchronized decisions never depend on table iteration order, wall clocks,
  local-only state or `async` (coroutines can't cross a lockstep frame).

## Where the runtime forces a shape

Lua allocates every table and object. Code that runs every frame, and again for
each frame of a rollback replay, reuses preallocated records instead of
creating them: a ring of rows, a scratch record per participant. Keep that
shape deliberately and say so in one comment
(`// Preallocated: rollback replays run this every frame.`). Measure before
adding pooling anywhere else.

Engine callbacks (timers, triggers, frame events) go through the dispatch
table, so hot reload can replace code without rebinding them.

A closure made inside `for (let i = …)` sees the loop's final value in Lua:
TypeScriptToLua keeps one variable for the whole loop instead of one per
iteration. Copy the index into a `const` in the body, or take it as a
`forEach` callback parameter.

## Tests

`test(name, fn)` from `wisp/src/runtime/testing` registers a test that runs under Bun
and in 32-bit Lua. Keep a test only for a contract: a Melee reference value, a
gameplay or netcode invariant, a reproduced defect. A test that restates the
implementation or pins an incidental constant is deleted, not ported. Never
change an expected value to make a port pass; a disagreement is a port defect or
a source defect, named as such.

## Commands

From smashcraft:ts/:

- `bun run test`: every host test file, in isolated Bun workers. The short-lived
  workers keep the baseline and DFG JIT tiers; the highest tier's compile cost
  exceeds its savings over this suite. Use
  `bun test test/game.test.ts -t NAME` for a focused result.
- `bun run check`: type-check the host tools and the game with TypeScript 7.
  The compiler keeps separate host and game dependency caches in
  smashcraft:ts/build/typecheck-host.tsbuildinfo and
  smashcraft:ts/build/typecheck-game.tsbuildinfo. It rechecks changed files and
  their affected dependents, preserving cached diagnostics for unchanged files,
  including Effect diagnostics. A first check after removing these caches does
  all the work again. Declaration-only output in smashcraft:ts/build/typecheck-host/
  and smashcraft:ts/build/typecheck-game/ records export signatures during that
  first check, so implementation-only edits can stop at unchanged signatures.
  TypeScriptToLua needs the compiler API that only
  TypeScript 6.0 has, so it compiles with 6.0 and the two report the same errors.
  The check then runs Wisp's number rules (TS9300: non-binary32 literals, `%`,
  `>>>`, `Math.floor(a / b)`, `Math.random`, `Date`, `JSON`, `Intl` and type
  escapes) over tsconfig.game.json through TypeScript 7's API, caching each
  file's findings in smashcraft:ts/build/number-rules.json. The editor reports
  the same errors through the `wisp/plugins/number-rules-service.cjs` entry in
  smashcraft:ts/tsconfig.json, only when it runs the workspace TypeScript 6
  language service (smashcraft:ts/node_modules/typescript/lib); TypeScript 7's
  language server, which smashcraft:.vscode/settings.json selects, loads no
  plugins.
- `bun scripts/typecheck-benchmark.ts`: CI's type-check latency gate. It reports
  a cold full check after removing both dependency caches, then changes the
  implementation of the command-receipt filename function shared by host and game.
  The full check after that edit must finish within 1000 ms. It also changes
  the exported argument type and requires errors in the fresh-match command
  and the game's receipt writer, then
  restores the source in `finally` and checks it again. Cold startup has no
  latency gate; every check still fails CI on unexpected compiler errors.
- `LUA=<32-bit lua> bun wisp parity numeric`: emitted Lua against Bun on
  the numeric corpus.
- `GAME_SOAK=1 bun test test/game.test.ts`: the long `*.soak.ts` scenarios,
  such as the 100000-frame replay tape, which the default suite leaves out.
  `GAME_SOAK=1` selects the same modules for `scripts/lua-tests.ts`.
- Set `LUA=<32-bit lua>`, then run `bun wisp tapes` for replay acceptance
  tapes. It records cases for every bound action, corrected predictions and a
  rematch, then compares canonical replay state and fighter poses after every
  frame in Bun and emitted Lua32. It reports the first divergent frame and
  field; the TypeScript Lua compile is cached by input hash.
- `bun scripts/unused-code.ts`: lists exports no other module uses,
  smashcraft:ts/ files nothing imports or names, and smashcraft:tools/ files no
  live document or source names, and exits 1 if any remain. Map bundle entries'
  exports count as used; references from smashcraft:evidence/ do not. About 10 s.

## Build the map

From the repository root, `./build.sh BASE.w3m ASSET_CONTAINER.w3x` invokes
Wisp's map build with the private assets and packager. The equivalent direct
command from `ts/` is:

```sh
bun wisp build --base BASE.w3m --container ASSET_CONTAINER.w3x --assets DIR \
  --summon DIR --name NAME --out OUT.w3x
```

The map's script is
the base map's script plus the TSTL bundle, whose entry is
smashcraft:ts/src/platform/devMain.ts: smashcraft:ts/src/platform/main.ts,
which every profile's entry shares, plus the scene recorder. Bun generates the fighter units
(war3map.w3u), FileIO's `$wsl` ability (war3map.w3a), the map description
(war3map.w3i), the map header and the matching `config()` from
smashcraft:ts/src/game/objectData.ts and smashcraft:ts/scripts/mapInfo.ts through
Wisp's generic encoders. For the
same base map, these files are generated deterministically from the declared
TypeScript data and the packaged map inputs.

The base map's archive has too few file slots for the imported assets, so the
build packages into a copy of a fully packaged private map, the asset
container. This is a mitigation: the build replaces the container's script,
object data, description and header, and fails unless every other base-map file
and every declared import equals its source. Imports the build does not declare
are carried along unverified.

Repository-authored models are generated: each generator writes the models,
their textures and an import list under smashcraft:build/, and the models'
content-addressed import paths to a checked-in module under
smashcraft:ts/src/game/, which the map compiles. Regenerate instead of editing
those modules. smashcraft:ts/scripts/wisp/mapInputs.ts lists each family
(`GENERATED_MODELS`) with its import list and generator; the stage deck comes
from smashcraft:tools/stage/package.ts. The build fails unless each family's
import list under `--assets` holds every model its module names, and unless the
summon evidence lists the clips smashcraft:ts/src/game/presentation/summonClipInfo.ts
names; the archive check then verifies the map carries them. `rebuild` and
`fresh --rebuild` keep the map's imports, so they fail unless the archive's file
list names every imported model the new script names (`SCRIPT_MODELS`); build
the map again after regenerating a model.

Pooled fighters and their model sounds derive from the original fighter models.
smashcraft:tools/animations/export-original-clips.ts reads them from
`--assets PRIVATE_ASSETS`, writes one clip model per original sequence, each
fighter's static light and their evidence to `--out` outside the checkout, and
writes smashcraft:ts/src/game/assets/fighterOriginalClipInfo.ts; with
`--metadata-only` it checks retained clips against the current sources and
writes only the module. smashcraft:tools/animations/export-model-sounds.ts
resolves each model sound event through the game's AnimSounds.slk (`--sounds`)
and writes smashcraft:ts/src/game/assets/modelSoundInfo.ts. The build fails
unless `--assets`'s original-clips-static-lights/original-clips-evidence.json
lists every clip and light the module names, and unless every sound cue names a
stock label and keys a pooled clip. Sound labels are the game's own sounds, so
the map imports none. Hidden pooled clips wait collapsed on the ground beneath
the floor, like every hidden effect, because alpha does not stop a model's
particle emitters.

The build first checks the running Bun and the declared and installed packages
against smashcraft:typescript-toolchain.lock.

`bun wisp build --profile integrity` packages normal gameplay with the
persistent helper's journal/editbox input, predicted fighter presentation and
native response export. Rebuild it with
`bun wisp rebuild MAP.w3x --profile integrity`. Its build ID is
`typescript-integrity`, as declared in smashcraft:ts/src/game/shell/currentBuild.ts;
the entry in smashcraft:ts/src/platform/integrityMain.ts shares the normal shell
and reload lifecycle. Use this profile for native input-integrity and
four-fighter match/rematch captures.

`bun wisp build --profile physics-probe` selects the production numerical
fixture map instead of the playable entry; the remaining build arguments are
the same. Rebuild it with `bun wisp rebuild MAP.w3x --profile physics-probe`.
The report and required groups are in smashcraft:docs/native-physics-precision.md.

`bun wisp build --profile frame-cost` packages the isolated 4096-frame
TypeScript workload. It writes its bundle key and complete replay state to
`smashcraft-frame-cost-KEY-p0-typescript.txt` in the client's CustomMapData.
smashcraft:ts/scripts/frameCost.ts retains `read CUSTOM_MAP_DATA RUN_ID` for
recorded paired results, including historical Wurst baselines. That reader
still requires equal complete states and a TypeScript/Wurst time ratio at most
one; new replay fields are never removed to fit an older baseline.

`bun wisp build --profile stack-trace` compiles the development build with
Wisp's stack plugin (smashcraft:ts/tsconfig.stack-trace.json), so an in-game
error report lists each active TypeScript frame as `src/FILE.ts:LINE: in
FUNCTION`, innermost first. Rebuild with
`bun wisp rebuild MAP.w3x --profile stack-trace`; `bun wisp hot --profile
stack-trace --data DIR ... --watch` reloads and prints that bundle's reports.
Its build ID is `typescript-stack-trace`, and its entry
smashcraft:ts/src/platform/stackTraceMain.ts adds one command to the
development build: `-dev stack-demo`, which throws three calls below its chat
handler (smashcraft:ts/src/platform/stackDemo.ts). Only a build with a developer
console registers it, and no other entry compiles it. The report is written
only when its message differs from the previous one, so type
`-dev stack-demo 2` for another. The instrumented bundle is about 2.2 times the
normal bundle's size and costs CPU
(wisp:docs/stack-traces.md), so keep it out of playable and
measurement builds. Frames cover this repository's TypeScript; Wisp's
precompiled dispatch and reporter, and Warcraft natives, add none.
`LUA=<32-bit lua> bun scripts/lua-tests.ts` compiles
smashcraft:ts/test/stack/entry.ts with the plugin and checks that the demo's
report names its frames at the lines that executed them.

The presentation modules smashcraft:ts/src/game/presentation/fighterAssetInfo.ts
and demonHunterAssetInfo.ts are generated by
smashcraft:tools/animations/package.ts and package-illidan.ts; regenerate them
from the authored models.
