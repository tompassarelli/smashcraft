# Move tables

Design for [#408](https://github.com/tompassarelli/smashcraft/issues/408):
fighter moves as compact numeric tables read by one small interpreter, in place
of per-move code. It measures today's move code, proposes the table format and
the interpreter loop, sets the determinism rules and picks the first fighter.

## What the move code costs today

Measured on commit `8b76d67` (Wisp pin `9f1d3fa`) in a stock Lua32
(`LUA_32BITS`, Lua 5.3.6 built by Wisp from `wisp/vendor/lua-5.3.6.tar.gz`).
No private build inputs were needed for these numbers.

### Modules, locals and bytecode

The emitted bundle `ts/build/perf.lua` (462 modules, the same map modules the
playable build compiles) listed with a 32-bit `luac -p -l`. A module's
locals are its chunk function's locals (the 200-local limit that #399 hit);
instructions are the module body plus every function nested in it.

| Modules | Count | Top-level locals | Instructions | Functions |
| --- | ---: | ---: | ---: | ---: |
| `sim.heroes.*Moves` (normals, throws, hurt poses) | 24 | 1,174 (max 79: Lich King, Warden) | 24,636 | 194 |
| `sim.heroes.*Specials` | 24 | 668 (max 59: Mountain King) | 8,468 | 99 |
| Kits total | 48 | 1,842 | 33,104 | 293 |
| `sim.step` | 1 | 187 | 2,835 | 13 |
| `sim.specials` (original kits' specials) | 1 | 160 | 3,408 | 43 |
| `sim.heroSpecialRules` (authored-special runner) | 1 | 105 | 2,803 | 46 |
| `presentation.specialCues` | 1 | 94 | 3,157 | 21 |
| `sim.ultimates` | 1 | 84 | 2,210 | 11 |
| `sim.attacks` | 1 | 84 | 1,256 | 15 |
| `sim.heroes.groundNormals` | 1 | 62 | 3,226 | 21 |
| `sim.hitRegions` | 1 | 56 | 1,187 | 12 |

Where the locals come from:

- `sim.step`: 166 of its 187 locals are import bindings (130 named imports,
  36 `require` results); 13 are its own functions. Move tables do not shrink
  step.ts by themselves: only the imports of move-specific helpers it stops
  needing go away. The #399 class is mostly an import-count problem there.
- `sim.heroes.chenMoves` (62 locals): 21 imports, 9 helper functions, and
  about 31 TypeScriptToLua temporaries (`____AttackStyle_jab_2`,
  `____reach_result_3`, `____array_0`) emitted for computed keys and spreads in
  the `CHEN_MOVES` literal. A kit's locals grow with every move it authors.
- Normals and specials are already authored as data (`AuthoredMove`,
  `AuthoredSpecial`) but as a nested object graph built by closures at load,
  with optional fields. The runner reads them through `move.motion ?? []`,
  which Lua compiles to `move.motion or ({})`: a new empty table each frame a
  move lacks that field (6 sites in heroSpecialRules.ts).

### Instructions and allocation per frame

Whole frames, `bun wisp perf playable-bot-four` (1,800 frames, four fighters,
playable build, rollback on), client p0:

| Per frame | Median | Mean | p95 | Max |
| --- | ---: | ---: | ---: | ---: |
| Lua instructions | 212,350 | 244,645 | 418,600 | 541,300 |
| Allocated KB | 34 | 76 | 261 | 565 |
| Predicted Warcraft ms | 5.17 | | 9.77 | 12.83 |

Per move, `bun wisp perf census --fighter NAME --functions` plays every normal,
throw, special and follow-up in a training match and reports the worst frame
over a standing baseline (instructions and KB are deterministic; the ms columns
were taken with other runs sharing the machine and are only indicative):

| Fighter | Entries | +instructions, typical move | +instructions, worst move | +KB, typical | +KB, worst move |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rifleman (original kit) | 39 | 21,000–47,200 | 47,200 (air up special, again) | 1–4 | 33 |
| Chen Stormstout | 39 | 17,050–47,700 | 47,700 (air up special, again) | 1–4 | 32 |
| Mountain King | 39 | 19,350–52,600 | 52,600 (side special, then attack) | 1–5 | 32 |

Each fighter also has three entries over the census's 2 ms rise (jab at the
start of the run, forward throw, air down special: +114,000 to +195,000
instructions, +26 KB). `--functions` attributes the throw and air-down-special frames to rollback
catch-up (`rollbackTick`, `ReplayHistoryPlayback.catchUp`,
`ReplayHistory.saveRow`) and the jab frames to work spread thin across the
camera, bot perception and record text; none is move code, so they are not
this issue's.
Inside a move frame the move code's own work is small: `sim.specials
advanceSpecials` 3k self instructions and `sim.step advanceFighterMotion`
13k–19k self in the profiled frames.

Missing numbers, stated plainly:

- **Moves-only instructions and KB per frame.** The Lua32 tools measure whole
  frames and per-move increments over a baseline; none splits a frame into move
  code and the rest. Box 3 gets this as a before/after difference on the same
  fighter, which needs no split.
- **Warcraft's native cost for moves.** `perf native` needs readings from a
  signed-in clone; this box has none. The predicted ms above come from the
  Lua32 model.

### Expected savings

Estimates, made before box 3; the measured numbers are in "Measured cost and roster decision" below:

- **Locals:** a kit becomes one data module with about 3 locals (`____exports`,
  the table, one import) instead of today's 15–79 per module, two modules per
  fighter: 1,842 → about 75 across 24 kits. step.ts loses only the move helper
  imports it no longer needs (a handful).
- **Load-time code:** 293 kit closures → 0; instructions fall to about one
  `LOADK` per stored number plus one `SETLIST` per 50 (Mountain King's kit:
  an estimated 1,000 numbers against today's 1,682 instructions).
- **Per frame:** no empty-table allocation for absent fields, and integer-indexed
  reads in place of field lookups on nested tables. Given the small self cost
  above, expect a few thousand instructions and the allocation of the empty
  tables per fighter-frame, not a large share of the 212,000 median.
- **Iteration:** a move changes by reloading its table, without a map rebuild,
  once the loader can read a table from outside the map (out of this issue).

The main win is structural (no new locals or closures per move); the frame-cost
win is real but small, which box 3 must confirm before a roster-wide go.

## Table format

One `MoveTable` per fighter: flat, read-only arrays of binary32 numbers with a
fixed stride per row kind, plus one string array for model paths. Rows refer to
other rows by index, never by reference. A field with no value holds the
sentinel `-1` (indices, frames) or a flag bit that is clear; there are no
optional fields.

```ts
interface MoveTable {
  readonly moves: readonly number[];      // MOVE_STRIDE per move id
  readonly hits: readonly number[];       // HIT_STRIDE per hitbox row
  readonly motion: readonly number[];     // MOTION_STRIDE per motion row
  readonly shots: readonly number[];      // SHOT_STRIDE per projectile row
  readonly follow: readonly number[];     // FOLLOW_STRIDE per follow-up row
  readonly hurt: readonly number[];       // HURT_STRIDE per hurt-pose row
  readonly cues: readonly number[];       // CUE_STRIDE per cue row (presentation only)
  readonly models: readonly string[];
}
```

Move ids are fixed: the `AttackStyle` values for normals, then throws by
`GrabAction`, then specials by slot × form (ground, air, follow-up forms in
authoring order). Frames are 0-based and windows inclusive, as `MoveRegion`
already stores them.

**Move row** (`moves`, one per move id):

| Field | Meaning |
| --- | --- |
| startup, active, total | today's `startupFrames`, `activeFrames`, `totalFrames` (specials: `endFrame` in total) |
| landingLag | frames; `-1` uses the shared aerial value |
| chainsFrom | jab chain frame, `-1` none |
| flags | bit field: helpless, oncePerAirtime, facesStick, recallsProjectiles, startupStopsAtBody, landingHit |
| startupTravelX | units over startup |
| hitFirst, hitCount | slice of `hits` |
| motionFirst, motionCount | slice of `motion` |
| shotFirst, shotCount | slice of `shots` |
| followFirst, followCount | slice of `follow` |
| hurtFirst, hurtCount | slice of `hurt` |
| cueFirst, cueCount | slice of `cues` |
| armorFirst, armorLast, armorMax | armor window and damage cap, `-1` none |
| contactFrame | throws: contact frame, `-1` otherwise |

**Hitbox row** (`hits`):
`first, last, x1, z1, x2, z2, radius, damage, growth, base, launchX, launchZ,
element, window, flags, groundedHit` — the capsule as `StrikeCapsule`, the
effect as `HitEffect`, `groundedHit` the index of the row whose effect applies
to grounded targets (`-1` none). `tipper`, `cleanLate` and `strongRegion` run in
the table generator, not at load: they emit extra rows.

**Motion row** (`motion`):
`first, last, velocityX, velocityZ, aimedSpeed, aimedTiltX, aimedTiltZ,
driftSpeed, liftSpeed, relocate, relocateReach, flags` (stopsAtBody,
stopsAtShield, throughEdge, aimed, tilted, drifts, lifts as bits, so an absent
speed is a clear bit, not a missing field).

**Projectile row** (`shots`):
`spawnFrame, offsetX, offsetZ, velocityX, velocityZ, gravity, activeFrom, life,
radius, limit, returnAge, returnSpeed, statusId, model, flags` plus the effect
fields of a hitbox row; `model` indexes `models`.

**Follow-up row** (`follow`): `first, last, input, targetMove, flags`.

**Hurt-pose row** (`hurt`): `first, last, x1, z1, x2, z2, radius`, one row per
part, so a pose of two parts is two rows with the same window.

**Cue row** (`cues`): `frame, kind, model, attach, scale, sound`. Cues are local
presentation: the interpreter hands them to presentation, which reads them and
never writes simulation state, so cue rows stay out of snapshots and checksums.

A generator script (host side, Bun) builds each table from today's authored
`FighterMoves` and `FighterSpecials`, so box 2 can prove the table equal to the
object graph before any runtime change, and emits one TypeScript module per
fighter with the numbers as literals already rounded to binary32.

## Interpreter

One module, `sim/moveTable.ts`, with no per-move branches. Each frame, for a
fighter in a move with id `m` on frame `t`:

```ts
const base = m * MOVE_STRIDE;
const first = at(table.moves, base + HIT_FIRST);
const last = first + at(table.moves, base + HIT_COUNT);
for (let row = first; row < last; row++) {
  const o = row * HIT_STRIDE;
  if (t < at(table.hits, o + FIRST) || t > at(table.hits, o + LAST)) continue;
  placeCapsuleFromRow(strike, table.hits, o, fighter.motion.x, fighter.motion.z, fighter.facing);
  // contact test, then copy the effect fields into the fighter's preallocated HitRegion
}
```

The same slice walk serves motion (velocity for frame `t`), projectiles
(spawn when `spawnFrame === t`), follow-ups (window and input test), armor,
hurt poses and cues. The interpreter's state per fighter is what the fighter
already snapshots: move id, frame, charge frames, aim, serial. It owns no
mutable state of its own, so replay and rollback need no new fields.

Order within a frame stays today's: motion, then projectile spawns, then hit
rows in row order (first contact wins, as `heroSpecialContact` does now), so
tapes stay identical.

Original kits (Rifleman, Demon Hunter) keep their code until a later box; the
interpreter covers authored kits first.

## Determinism rules

- **Binary32 values.** Every stored number is already a binary32 value
  (`f32()` applied by the generator); arithmetic on them goes through the same
  `f32`/`multiplyFloat32` helpers as today. Frames, counts, indices and flag
  bits are small integers, exact in binary32. Both Lua32 modes (stock and
  toward-zero) must give identical tapes.
- **No Lua truthiness on numbers or strings.** `0` and `""` are true in Lua:
  every test is an explicit comparison (`row >= 0`, `(flags & HELPLESS) !== 0`,
  `count > 0`). No `??`, `||` or `&&` over a table field; no optional fields.
- **No per-frame allocation.** Tables are built once at load and never
  written. The interpreter loops with integer indices (no `for...of` over
  fresh arrays, no spreads, no `?? []`, no closures) and writes into each
  fighter's preallocated `HitRegion` and capsule. Box 3 checks allocated KB per
  frame before and after.
- **Fixed order.** Rows run in stored order; nothing iterates a hash table.

## First fighter: Mountain King

Box 2 converts Mountain King because:

- **A tape already exercises it.** The Mountain King acceptance tape (600
  frames against Demon Hunter, scripts/wisp/acceptanceTapes.ts) gives box 2 its
  identical-replay check in both Lua32 modes with no new tape. Chen, the
  smallest kit, has no tape.
- **It covers the format's row kinds.** Normals with hurt poses, throws, and
  specials with charged-angle motion (Thunder Leap), body-stopping rush motion
  with its hurt pose (Storm Rush), returning and recalled projectiles (Storm
  Bolt), helpless fall (Hammerfall), multi-row hits and projectile waves (Thunder
  Clap) and timed follow-ups including a shield input (charged clap).
- **Its specials module is the largest:** 59 locals, 7 closures; its moves
  module 58 locals.
- **No simulation code special-cases it** beyond shared per-character tables
  (`ultimates.ts`, `strongHitTable.ts`), so a difference in its tape comes from
  the interpreter alone.

Lich King (79 locals in its moves module, also taped) is the second candidate
if Mountain King's charge or recall rows need interpreter work box 2 cannot
finish.

## Mountain King on the table

Mountain King's kit runs through the interpreter in `sim/moveTable.ts` (a pure
core: row layouts, readers and the load-time views, no fighter state).
`scripts/moveTables.ts` encodes the authored kit with `scripts/moveTableEncode.ts`
and writes `sim/heroes/mountainKingTable.ts` (literals only);
`test/move-tables.test.ts` fails when that module drifts from the kit, so an
edit to the kit is followed by `bun scripts/moveTables.ts` from `ts/`.
The hero definition gives the same `MoveTable` to `moves.table` and
`specials.table`; a kit without one runs the authored code as before.

What the simulation reads from the table for a fighter that has one: every
normal's startup, active, total, landing lag, jab chain, startup travel, hit
rows and hurt poses; every throw's contact frame, length and effect; every
special form, EX form and follow-up's form choice (air, recall while a bolt
flies), end frame, landing lag, flags, aim frames, cooldown, motion rows,
body-stop rows, hit rows (contact, guard threat, placed-object strikes),
projectile spawn frames and limits, follow-up windows and inputs, and hurt
poses. Kit scalars (`dashAttack`, smash charge, pummel count) stay fields of
`FighterMoves`.

Deliberate exceptions:

- **Projectile specs stay the kit's objects.** A projectile in flight holds its
  spec, and snapshots rebind it by identity (`replay/moment.ts`), so shot rows
  carry the spawn frame and limit the interpreter reads and `shotSpecs` binds
  each row to the kit's own spec, in the order `shotOrder` walks the kit.
- **Load-time views.** Contact code takes `HitRegion`, `HitEffect` and hurt part
  lists by reference, so `moveTable()` builds one read-only view per hit, effect
  and pose row at load; the per-frame walk is integer indexed over the rows.
- **Readers outside the simulation of the move** (bots, cues, names, canonical
  digests, the balance kit) still read the authored kit, which stays loaded.

The encoder refuses any authored field the interpreter does not run yet:
falls, landing hits, intangible, armor, guard, placement, companion commands,
command grabs, bursts, rituals, rehits, buffs, cleanses, strike statuses, marked
forms, aimed tilt, drift, lift, relocation, edge teleports and every optional
projectile field beyond returns and `activeFrom`. Each of those is interpreter
work before a kit that uses it can convert.

Replay identity, on the same 43 acceptance tapes (30,950 frames, Mountain
King's included) recorded before the change: `bun wisp parity tapes` reports 0
divergent frames for Bun/Lua32 and Bun/Lua32 toward zero, and every frame record
is byte-identical before and after in Bun, stock Lua32 and toward-zero Lua32.
Altering one effect row in the table changes the Mountain King tape, so the
table path is the one that ran.

## Measured cost and roster decision

Commit `2ec62de` before and the box 2 change after, Wisp pin `9f1d3fa`, stock
Lua32 built by Wisp. Instructions and KB are deterministic; ms columns are the
Lua32 model's prediction.

`bun wisp perf census --fighter mountain-king` (8,853 frames of Mountain King
playing every normal, throw, special and follow-up), client p0 per frame:

| | Before | After | Change |
| --- | ---: | ---: | ---: |
| Instructions, median | 127,400 | 127,800 | +400 |
| Instructions, mean | 130,136 | 130,545 | +409 (+0.31%) |
| Instructions, p95 | 146,000 | 146,100 | +100 |
| Instructions, max | 350,100 | 348,800 | -1,300 |
| Allocated KB, mean | 28.0 | 28.0 | 0 (7 KB less over the run) |
| Allocated KB, p95 / max | 43.1 / 222.5 | 43.1 / 218.7 | 0 / -3.8 |

Inside the census move windows the mean rises 434 instructions per frame
(+0.33%); per-entry increments move by at most ±400 and the same three entries
stay over the 2 ms rise (rollback catch-up, as before).

Whole matches, client p0 per frame:

| Run | Instructions mean before → after | Median | KB mean | Predicted ms p50 / p95 |
| --- | ---: | ---: | ---: | ---: |
| `perf bot-mountain-king` (Mountain King computer, 1,800 frames) | 331,539 → 334,397 (+0.86%) | 287,600 → 290,800 | 83 → 83 | 6.54 / 18.16 → 6.59 / 18.43 |
| `perf playable-bot-four` (no Mountain King) | 244,643 → 245,319 (+0.28%) | 212,650 → 212,850 | 76 → 76 | 5.17 / 9.79 → 5.18 / 9.80 |

Code, from a 32-bit `luac -l` of `build/perf.lua` (locals of the module chunk):

| Module | Locals before → after | Instructions before → after |
| --- | ---: | ---: |
| `sim.heroSpecialRules` | 105 → 142 | 2,803 → 3,908 |
| `sim.step` | 187 → 188 | 2,835 → 2,826 |
| `sim.specials` | 160 → 161 | 3,408 → 3,420 |
| `sim.moves`, `sim.hitRegions`, `sim.hurtboxes` | 13, 56, 32 → 21, 63, 39 | 3,011 → 3,488 |
| `sim.moveTable` (new) | 23 | 1,089 |
| `sim.heroes.mountainKingTable` (new) | 1 | 3,711 |
| Mountain King's moves and specials modules | 58, 59 → 58, 59 | 1,682 → 1,682 |

The bundle grows 89 KB (4.88 MB → 4.97 MB).

**Go/no-go: no-go for the roster.** The interpreter costs about 0.3% more
instructions per frame for the converted fighter and 0.3% more for fighters
that are not converted (each read site now tests for a table), allocates the
same, and adds 37 locals to the special runner instead of removing any from the
#399 modules; the authored kit stays loaded for bots, cues and names, so the
kit modules keep their locals too. The expected wins in "Expected savings" did
not appear: the per-frame move work was already allocation-free in steady state,
and a reader call per field (`moveField` → `at`) costs more than a field lookup.
Converting the roster would add a second runner and a generator step to every
kit for no frame-time gain. What would change this: dropping the authored kit
from the map (bots and cues reading the table too), which is the only route to
the locals saving, and a reason other than frame cost, such as reloading a kit
without a rebuild. Mountain King keeps running from its table as the measured
example; removing it again is a revert of one hero definition line pair.

## Commands

From `ts/`:

```sh
bun install
LUA=$(bun node_modules/wisp/scripts/wisp/lua32.ts stock)   # builds the stock Lua32
LUA=$LUA bun wisp perf playable-bot-four                    # whole-frame instructions and KB
LUA=$LUA bun wisp perf census --fighter rifleman --functions
LUA=$LUA bun wisp perf census --fighter chen-stormstout --functions
LUA=$LUA bun wisp perf census --fighter mountain-king --functions
LUA=$LUA bun wisp perf bot-mountain-king --samples          # a whole match with Mountain King
LUA=$LUA TOWARD_ZERO_LUA=$(bun node_modules/wisp/scripts/wisp/lua32.ts toward-zero) bun wisp parity tapes
bun scripts/moveTables.ts                                   # regenerate the move tables after a kit edit
# locals and instructions per module: a 32-bit luac (make posix MYCFLAGS=-DLUA_32BITS
# in the same Lua 5.3.6 source) listing build/perf.lua
luac -p -l build/perf.lua
```

The per-module table maps each `luac -l` function header (`function <file:A,B>
(N instructions)` and its `M locals` line) to the bundle's
`["module"] = function(...)` line A; instructions sum every function whose line
range lies inside the module's.
