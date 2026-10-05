# TypeScript in Smashcraft

Smashcraft's TypeScript compiles to Warcraft's Lua through TypeScriptToLua
(smashcraft:ts/). This page is the style contract for the game code. Behavior is
checked by tests and recorded tapes
(smashcraft:docs/warcraft-api-netcode-findings.md#lua-numbers-in-the-game
explains why three runtimes are compared).

Waygate is maintained in its own repository. smashcraft:ts/waygate.lock records
the immutable source revision and generated archive consumed by Bun. A clean
checkout needs only `bun install --frozen-lockfile` from smashcraft:ts/;
installing this dependency requires no private GitHub credentials.

Waygate owns compilation, numeric helpers and guards, reload and error
reporting, host services, and archive packaging. Smashcraft owns the map
declaration in smashcraft:ts/scripts/mapInfo.ts, imports and object data in
smashcraft:ts/scripts/waygate/mapInputs.ts, project paths and naming in
smashcraft:ts/scripts/waygate/project.ts, and game-specific commands, assets,
replay corpora and native acceptance journeys.

To update to Waygate's current published `main`, run from smashcraft:ts/:

```sh
bun run update:waygate
```

The updater fetches private Waygate `main` using Git's configured credentials,
resolves its commit, generates the Lua modules and declarations needed by TSTL,
and updates the archive, smashcraft:ts/waygate.lock, package metadata and Bun
lockfile. An already-generated archive for that commit is reused. There is no
manual SHA or archive-name selection. The dependency stays at that resolved
commit until the next update; `bun install` does not follow the branch.
Compiler versions remain separately pinned in smashcraft:typescript-toolchain.lock.
To select an exact source revision explicitly, use
`bun run update:waygate /absolute/path/to/waygate/checkout FULL_COMMIT`.
Generated dependency output belongs in smashcraft:ts/vendor/; maintained
framework implementations belong only in Waygate. Commit the new pin,
package metadata, Bun lockfile and generated archive together after checking
the affected consumer commands.

## The runtime decides the numbers

Map Lua has 32-bit integers that wrap silently and binary32 numbers whose raw
`+` and `*` don't round to nearest. Bun computes in binary64. So:

- Integers: `idiv`, `imod`, `floorDiv` and `floorMod` from `waygate/src/sim/intMath`. Never
  `Math.floor(a / b)` or `%` on integers: the first loses bits above 2^24 in
  Warcraft, the second floors in Lua and truncates in JavaScript.
- Bitwise `&`, `|`, `^` and `<<` are exact on 32-bit values in both runtimes;
  use them for masks instead of division arithmetic. Shift right with
  `floorDiv`: TypeScriptToLua rejects `>>`, and its `>>>` masks with
  4294967295, which a 32-bit Lua integer can't hold.
- Reals in synchronized code: wrap each real `+ - * /` in `f32()` (host
  rounding, free in Lua), or use the exact `waygate/src/sim/binary32` helpers where the value
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

Waygate's host tools use Effect for asynchronous orchestration: typed failures,
boundary decoding with Schema, bounded client publication and scoped resource
ownership. `smashcraft:ts/scripts/waygate.ts` is the single CLI entrypoint;
`bun waygate hot`, `build`, `rebuild`, `fresh`, `client`, `tapes` and `parity`
are commands composed from shared GameFiles, Clients, MapBuild, HotReload and
SourceErrors services. Each command prints its steps and elapsed time. Hot
reload publishes every client's payload before its manifest. A failed or
cancelled publication does not count as installed; client acknowledgements
decide that result. Warcraft acknowledgement files contain a complete Preload
function, including whitespace and line endings around the message.

Map builds use staged outputs: interrupting a step stops its child process, a
failed step leaves the previous map in place, and archive entries are verified
four at a time. `waygate parity numeric` compares the numeric corpus against
Lua32; `waygate parity capture` and `waygate parity result` run and reconcile
the native issue #26 input-integrity check through the same CLI. `waygate fresh
MAP.w3x [--rebuild]` rebuilds the map script when requested, starts a new match,
sends `-dev quick`, and waits for every client's typed receipt.

Pure simulation, numeric operations, code transforms and binary-format
encoders remain plain TypeScript. The TSTL map compiler uses TypeScript 6's
compiler API, while the host checker uses TypeScript 7 with Effect tsgo. A
project `bun install` patches the native checker through the postinstall
script; ordinary checks reuse that binary without rerunning the patcher. A
successful host check does not establish that a library can compile to Lua.
Effect stays on the host. The installed package has no Lua module for TSTL to
resolve, and compiling Effect 4.0.1's source with TSTL 1.37.1 crashes the
compiler; past that, Effect's core creates BigInt values at module load, which
TSTL's Lua library lacks. The map also has no suspended work for fibers to
own: one frame timer advances explicit state, callbacks rebind by name after
hot reload, and rollback snapshots hold all gameplay state
([waygate#1](https://github.com/tompassarelli/waygate/issues/1)).

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

`test(name, fn)` from `waygate/src/runtime/testing` registers a test that runs under Bun
and in 32-bit Lua. Keep a test only for a contract: a Melee reference value, a
gameplay or netcode invariant, a reproduced defect. A test that restates the
implementation or pins an incidental constant is deleted, not ported. Never
change an expected value to make a port pass; a disagreement is a port defect or
a source defect, named as such.

## Commands

From smashcraft:ts/:

- `bun run test`: every host test file, in three isolated Bun workers. Use
  `bun test test/game.test.ts -t NAME` for a focused result.
- `bun run check`: type-check the host tools and the game with TypeScript 7.
  The compiler keeps separate host and game dependency caches in
  smashcraft:ts/build/typecheck-host.tsbuildinfo and
  smashcraft:ts/build/typecheck-game.tsbuildinfo. It rechecks changed files and
  their affected dependents, preserving cached diagnostics for unchanged files,
  including Effect diagnostics. A first check after removing these caches does
  all the work again. TypeScriptToLua needs the compiler API that only
  TypeScript 6.0 has, so it compiles with 6.0 and the two report the same errors.
- `bun scripts/typecheck-benchmark.ts`: CI's type-check latency gate. It reports
  a cold full check after removing both dependency caches, then changes the
  implementation of the command-receipt filename function shared by host and game.
  The full check after that edit must finish within 1000 ms. It also changes
  the exported argument type and requires errors in the fresh-match command
  and the game's receipt writer, then
  restores the source in `finally` and checks it again. Cold startup has no
  latency gate; every check still fails CI on unexpected compiler errors.
- `LUA=<32-bit lua> bun waygate parity numeric`: emitted Lua against Bun on
  the numeric corpus.
- `GAME_SOAK=1 bun test test/game.test.ts`: the long `*.soak.ts` scenarios,
  such as the 100000-frame replay tape, which the default suite leaves out.
  `GAME_SOAK=1` selects the same modules for `scripts/lua-tests.ts`.
- Set `LUA=<32-bit lua>`, then run `bun waygate tapes` for replay acceptance
  tapes. It records cases for every bound action, corrected predictions and a
  rematch, then compares canonical replay state and fighter poses after every
  frame in Bun and emitted Lua32. It reports the first divergent frame and
  field; the TypeScript Lua compile is cached by input hash.

## Build the map

From the repository root, `./build.sh BASE.w3m ASSET_CONTAINER.w3x` invokes
Waygate's map build with the private assets and packager. The equivalent direct
command from `ts/` is:

```sh
bun waygate build --base BASE.w3m --container ASSET_CONTAINER.w3x --assets DIR \
  --summon DIR --name NAME --out OUT.w3x
```

The map's script is
the base map's script plus the TSTL bundle, whose entry is
smashcraft:ts/src/platform/main.ts. Bun generates the fighter units
(war3map.w3u), FileIO's `$wsl` ability (war3map.w3a), the map description
(war3map.w3i), the map header and the matching `config()` from
smashcraft:ts/src/game/objectData.ts and smashcraft:ts/scripts/mapInfo.ts through
Waygate's generic encoders. For the
same base map, these files are generated deterministically from the declared
TypeScript data and the packaged map inputs.

The base map's archive has too few file slots for the imported assets, so the
build packages into a copy of a fully packaged private map, the asset
container. This is a mitigation: the build replaces the container's script,
object data, description and header, and fails unless every other base-map file
and every declared import equals its source. Imports the build does not declare
are carried along unverified.

The build first checks the running Bun and the declared and installed packages
against smashcraft:typescript-toolchain.lock.

`bun waygate build --profile integrity` packages normal gameplay with the
persistent helper's journal/editbox input, predicted fighter presentation and
native response export. Rebuild it with
`bun waygate rebuild MAP.w3x --profile integrity`. Its build ID is
`typescript-integrity`, as declared in smashcraft:ts/src/game/shell/currentBuild.ts;
the entry in smashcraft:ts/src/platform/integrityMain.ts shares the normal shell
and reload lifecycle. Use this profile for native input-integrity and
four-fighter match/rematch captures.

`bun waygate build --profile physics-probe` selects the production numerical
fixture map instead of the playable entry; the remaining build arguments are
the same. Rebuild it with `bun waygate rebuild MAP.w3x --profile physics-probe`.
The report and required groups are in smashcraft:docs/native-physics-precision.md.

`bun waygate build --profile frame-cost` packages the isolated 4096-frame
TypeScript workload. It writes its bundle key and complete replay state to
`smashcraft-frame-cost-KEY-p0-typescript.txt` in the client's CustomMapData.
smashcraft:ts/scripts/frameCost.ts retains `read CUSTOM_MAP_DATA RUN_ID` for
recorded paired results, including historical Wurst baselines. That reader
still requires equal complete states and a TypeScript/Wurst time ratio at most
one; new replay fields are never removed to fit an older baseline.

The presentation modules smashcraft:ts/src/game/presentation/fighterAssetInfo.ts
and demonHunterAssetInfo.ts are generated by
smashcraft:tools/animations/package.ts and package-illidan.ts; regenerate them
from the authored models.
