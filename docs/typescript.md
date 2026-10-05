# TypeScript in Smashcraft

Smashcraft's TypeScript compiles to Warcraft's Lua through TypeScriptToLua
(smashcraft:ts/). This page is the style contract for that code. Ported modules
read as TypeScript written for this game, not as Wurst in TypeScript syntax.
Behavior equivalence is proven by tests and recorded tapes
(smashcraft:docs/warcraft-api-netcode-findings.md#lua-numbers-in-the-game
explains why three runtimes are compared).

## The runtime decides the numbers

Map Lua has 32-bit integers that wrap silently and binary32 numbers whose raw
`+` and `*` don't round to nearest. Bun computes in binary64. So:

- Integers: `idiv`, `imod`, `floorDiv` and `floorMod` from `sim/intMath`. Never
  `Math.floor(a / b)` or `%` on integers: the first loses bits above 2^24 in
  Warcraft, the second floors in Lua and truncates in JavaScript.
- Bitwise `&`, `|`, `^` and `<<` are exact on 32-bit values in both runtimes;
  use them for masks instead of division arithmetic. Shift right with
  `floorDiv`: TypeScriptToLua rejects `>>`, and its `>>>` masks with
  4294967295, which a 32-bit Lua integer can't hold.
- Reals in synchronized code: wrap each real `+ - * /` in `f32()` (host
  rounding, free in Lua), or use the exact `sim/binary32` helpers where the value
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
The installed Effect package currently has no Lua module for TSTL to resolve;
keep Effect imports on the host until an actual emitted-Lua check supports a
change to that boundary.

For APIs, read smashcraft:repos/effect/LLMS.md and its version-matched source
and tests. Application imports resolve installed packages, not vendor paths.
The exact reference identity is smashcraft:repos/effect.json; its update
procedure and cadence belong to smashcraft:.agents/skills/effect/SKILL.md.

### Game modules

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

`test(name, fn)` from `runtime/testing` registers a test that runs under Bun
and in 32-bit Lua. Keep a test only for a contract: a Melee reference value, a
gameplay or netcode invariant, a reproduced defect. A test that restates the
implementation or pins an incidental constant is deleted, not ported. Never
change an expected value to make a port pass; a disagreement is a port defect or
a source defect, named as such.

## Commands

From smashcraft:ts/:

- `bun run test`: every host test file, in two isolated Bun workers. Use
  `bun test test/game.test.ts -t NAME` for a focused result.
- `bun run check`: type-check the host tools and the game with TypeScript 7
  (about 0.3 s). TypeScriptToLua needs the compiler API that only TypeScript
  6.0 has, so it compiles with 6.0 and the two report the same errors.
- `LUA=<32-bit lua> bun waygate parity numeric`: emitted Lua against Bun on
  the numeric corpus.
- `GAME_SOAK=1 bun test test/game.test.ts`: the long `*.soak.ts` scenarios,
  such as the 100000-frame replay tape, which the default suite leaves out.
  `GAME_SOAK=1` selects the same modules for `scripts/lua-tests.ts`.
- Set `LUA=<32-bit lua>`, then run `bun waygate tapes` for replay acceptance
  tapes. It
  records tapes covering every bound key, rollbacks, predictions corrected
  through the replay history and a rematch, replays them in Wurst's own Lua
  (smashcraft:tools/tape-oracle/), in Bun and in TypeScript's emitted Lua, and
  compares the canonical replay state and fighter poses after
  every frame. It prints the first divergent frame and field. The Wurst side
  needs what smashcraft:test.sh needs: the locked compiler in
  smashcraft:toolchain/ and the generated asset info in smashcraft:build/.
  Both compiles are cached by input hash.
- `bun scripts/wurst2ts.ts OUT_DIR WURST_FILE...`: the deterministic first pass
  of a port. Its output is scaffolding to rewrite, not the result.

## The TypeScript-only map

`WC3_PRIVATE_ASSETS=DIR ./build-typescript.sh BASE_MAP ASSET_CONTAINER` (from the
repository root) builds a map without compiling Wurst. Its script is the base
map's script plus the TSTL bundle, whose entry is
smashcraft:ts/src/platform/main.ts. Bun generates the fighter units
(war3map.w3u), FileIO's `$wsl` ability (war3map.w3a), the map description
(war3map.w3i), the map header and the matching `config()` from
smashcraft:ts/scripts/objectData.ts and smashcraft:ts/scripts/mapInfo.ts. For the
same base map they are byte-identical to the Wurst build's, and the generated
`config()` makes the same native calls as Wurst's (checked 2026-10-05 against
build.sh at checkpoint 3f36f10).

The base map's archive has too few file slots for the imported assets, so the
build packages into a copy of a fully packaged private map, the asset
container. This is a mitigation: the build replaces the container's script,
object data, description and header, and fails unless every other base-map file
and every import that build.sh declares equals its source. Imports the build
does not declare are carried along unverified.

The build first checks the running Bun and the declared and installed packages
against smashcraft:typescript-toolchain.lock.

The presentation modules smashcraft:ts/src/game/presentation/fighterAssetInfo.ts
and demonHunterAssetInfo.ts are generated by
smashcraft:tools/animations/package.ts and package-illidan.ts with the Wurst
asset-info packages; regenerate them from the authored models.
