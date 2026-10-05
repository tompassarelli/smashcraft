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

## Tests

`test(name, fn)` from `runtime/testing` registers a test that runs under Bun
and in 32-bit Lua. Keep a test only for a contract: a Melee reference value, a
gameplay or netcode invariant, a reproduced defect. A test that restates the
implementation or pins an incidental constant is deleted, not ported. Never
change an expected value to make a port pass; a disagreement is a port defect or
a source defect, named as such.

## Commands

From smashcraft:ts/:

- `bun test`: host tests (sub-second for a module).
- `bun run check`: type-check the host tools and the game with TypeScript 7
  (about 0.3 s). TypeScriptToLua needs the compiler API that only TypeScript
  6.0 has, so it compiles with 6.0 and the two report the same errors.
- `LUA=<32-bit lua> bun scripts/parity.ts`: emitted Lua against Bun on the
  numeric corpus.
- `bun scripts/wurst2ts.ts OUT_DIR WURST_FILE...`: the deterministic first pass
  of a port. Its output is scaffolding to rewrite, not the result.
