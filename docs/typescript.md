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
poll. Candidate 0.0.45 (`a5a0315`) polled 32 times a second while client A's
CustomMapData held 94,057 files and no `smashcraft-hot` folder. Listing them
takes 32–35 ms on this host, so the polls asked for about 1 s of lookups per
second of game, and both clients nearly stopped at fighter selection.
smashcraft:ts/test/selection-load.test.ts keeps file reads and effect
creation out of the playable entry's selection frames.

The profiles that do poll can't stall alike: `bun wisp fresh` and `bun wisp hot`
create each client's `smashcraft-hot` folder with Wisp's host marker before a
match starts or a reload publishes, and a map that has seen neither the marker
nor a manifest looks for them twice a second, at most 70 ms of lookups per
second of game even in that 94,057-file CustomMapData; the first reload to a
client that has seen no host can take up to 1 s longer. See Wisp's hot-reload
docs, "What polling costs".

The playable profile displays no runtime error text (`MapBuild.errorsOnScreen`,
Wisp's `errorsOnScreen`): a failing handler's `error in HANDLER: ...` line names
handlers, TypeScript lines and Lua messages, which players never read. Every
profile still writes the report to `smashcraft-error-p<slot>.txt`, which
`bun wisp hot --watch` and the playable capture gates read.
smashcraft:ts/test/player-text.test.ts keeps both halves.

Without the clients, `bun wisp headless [quick-match|desync] [--clients N]`
plays the development build (src/platform/devMain.ts) in Wisp's headless
runtime ([Wisp headless](https://github.com/tompassarelli/wisp/blob/main/docs/headless.md)):
start, `-dev quick`, Ctrl+T, a hot reload through the map's reloader at frame
480, 600 frames in all, in about a second. It prints each client's native calls
and checksum, the first desync, a reload not running, error reports and what
a player would see wrong in each client's scene report, and exits 1 on any.
`desync` adds `-dev desync` typed by the second player, which it must report.
smashcraft:ts/scripts/wisp/headless.ts declares the natives Smashcraft calls
on one client only; the desync guard, visual-lifecycle, player-view and
stack-trace tests run their clients with the same declaration. Its
`PREDICTED_HEADLESS` also declares the effect poses and camera of the
integrity and playable builds' predicted presentation local, for the
integrity capture and the tests of a player whose controller input is
missing (missing-input) or stops (input-stall).

A player who sees something wrong saves the moment
([Wisp repros](https://github.com/tompassarelli/wisp/blob/main/docs/repro.md)):
F8 in every build, or View held for a second on a controller, which the
companion helper types into the journal's edit box as `JM1` and the epoch. Every
client keeps the last ten to twelve seconds of its confirmed match
(smashcraft:ts/src/game/replay/moment.ts): a snapshot every 120 frames, six in
all, and each human's input row for every frame since the oldest. The asking
player's client alone saves the latest snapshot at least 600 frames back,
every row since and the checksums of the end, the start and each later
snapshot, as `smashcraft-repro-p<slot>-f<frame>-<n>.txt` in CustomMapData,
then shows "Moment saved". The shell changes the confirmed match between
frames only where a callback pause, a binding change or the match's end clears
attack buffers, a player leaves, or practice ends: the record keeps the match
as the last frame left it, so a moment ends there, and the next frame starts a
new record.
`bun wisp repro FILE` restores the snapshot and runs every row through the
frame executor the build ran (rollback builds as stepConfirmed runs accepted
rows, the development build as callbackMatchTick adapts keys and its
scenario's computers choose) in two simulated clients, to the recorded
checksum; `--test NAME` writes src/game/replay/repros/NAME.tests.ts, which
replays it in Bun and 32-bit Lua. smashcraft:ts/test/repro.test.ts saves
moments in headless development and playable matches, and
smashcraft:ts/src/game/replay/moment.tests.ts round-trips them in Lua32.

Measured in 32-bit Lua with two fighters (6 October 2026; Warcraft's own Lua
ran the frame-cost workload at 299 µs a frame, evidence/native-frame-cost-20261005,
and this interpreter ran the moment benchmark's match at 314 µs): keeping the
record costs about 4 µs a frame, a snapshot 0.16–0.30 ms every 120 frames, and
the larger heap about 10–15 µs a frame of collection. A save spreads its work
over eight frames: 3.4 ms when it begins (copies of the snapshot and the
match, and the rows), then one 6.5–8.6 ms step a frame (a checksum each, then
the snapshot's text). The file is about 36 KB.

`bun wisp soak` is the automatic playtester ([Wisp soak](https://github.com/tompassarelli/wisp/blob/main/docs/soak.md)):
200 headless matches of the playable build with the scene recorder
(smashcraft:ts/test/soak/game.ts), every ordered fighter pair on every stage
eleven times over, in at most four worker processes. Each one-stock,
one-minute match pairs two of: the fuzzed controller (`fuzz`), the game's
computer (`cpu`, its human's helper typing neutral rows) and a human whose
helper never runs (`absent`, #46). The players' helpers are the journal
stand-in (smashcraft:ts/test/rematch/journalHelper.ts), sending two frames
a packet as the companion does, on the soak's wall clock, so a lag spike or
a quiet helper leaves input waiting as it does natively. It reports stalls,
desyncs, error reports, scene problems, an invisible fighter, costly frames
and catch-ups that never recover, with a repro file per finding that
`bun wisp soak --repro FILE` replays exactly. Run it inside the machine's
capacity scope; it is not part of `bun run test`. `--fighter`, `--stage`
and `--policy` narrow a run. The 200-match run took 46 s with four workers
and 245 s of CPU on 6 October 2026.

With `SOAK_OUTCOMES=FILE` set, every match also appends its result to FILE
as one JSON line: the winner, whether time ran out, and for each player the
damage and hits taken and each stock lost (match frame, percent, frames since
the last hit taken). `bun scripts/soakOutcomes.ts FILE...` summarizes them
per fighter pair and policy pair: wins with a 95% Wilson interval, time-outs,
stock time, the percent stocks were lost at (a loss more than 3 s after the
last hit counts as a self-destruct) and damage per landed hit. The computer
has no randomness and only chases, jumps, recovers and jabs (neutral air when
airborne; smashcraft:ts/src/game/match/step.ts), so its matches against
itself repeat exactly whatever the seed, and the summary counts identical
results of one setup without a fuzzed player once. Its numbers describe that
jab, movement, weight and recovery, not a whole moveset.

`bun wisp soak --helper BIN [--matches N] [--seconds S]` plays matches through
the real input path instead (smashcraft:ts/test/soak/helper.ts): each player
a uinput pad the fuzzer drives about once a second, read by a persistent
wc3-journal helper built with `--text-out`, into headless clients in real
time, with the same detectors. It needs /dev/uinput, as `bun wisp parity
headless` does.

The development and integrity builds measure what each frame costs
(smashcraft:ts/src/platform/frameMeter.ts, [Wisp frame cost](https://github.com/tompassarelli/wisp/blob/main/docs/frame-cost.md)):
Lua time, native calls and the confirmed frames each 60 Hz callback caught up.
`-dev perf` shows the player who types it the medians and maxima of the last
120 frames. After each hot reload every client writes the 120 frames before
and after it to `smashcraft-perf-p<slot>.txt`, and `bun wisp hot --watch` and
`bun wisp dev --data` print the change and flag a rise over 20%. The playable
entry never imports the meter. `LUA=<32-bit lua> bun wisp perf [--out FILE]`
plays the headless quick match in 32-bit Lua and prints each client's Lua
instructions, Lua time and native calls per frame; `bun wisp perf compare A B`
fails when B's instructions or calls per frame exceed A's by more than 5%.
On 2f29ab3 with Wisp 1fe6d71 the quick match's first client ran a median
47,800 Lua instructions and 138 native calls a frame; the meter adds 2.0% to
its mean instructions a frame, and the playable bundle is the same bytes as
before the meter (smashcraft:ts/build/playable.lua SHA256 082a11b3).

`bun wisp parity headless --helper BIN --out DIR` runs issue #26's capture
without Warcraft (smashcraft:ts/scripts/integrity/headless.ts): the
integrity build's TypeScript in two headless clients at 60 frames a second of
wall time, with Battle.net's measured sync latency (Wisp's
docs/network-model.md), the native capture's journey and reconciler, and the
real input path. Each player has a uinput pad, a kernel observer and a
persistent wc3-journal helper started with `--text-out FILE` instead of
`--editbox-display`: the helper appends each typing to FILE, Wisp types it
into that client's focused edit box (or, at menus, as key presses), and the
helper reads the files the client writes in OUT/client-N/CustomMapData,
written as Warcraft writes them. Build the helper from smashcraft:companion
(`cargo build --locked --bin wc3-journal`). A game stall holds the clients
(no frame runs and the match loses the time); a helper stall stops the
helper process. Pad edges are written from their own thread
(smashcraft:ts/scripts/integrity/padWorker.ts): an edge is stamped just
before its write, and a pause between the two lets the helper publish that
frame first and stop on the late edge; it did once while the edges were
written from the thread that runs the clients. The pool-predicted presentation poses
effects and frames the camera from each client's prediction, so those
natives are local in this capture; a remaining difference in native calls
is printed and kept in capture.json, and the scene report's findings in
player-view-EPOCH.txt, since the confirmed checksums decide synchronization
and what reaches the screen keeps its native check. One run takes about
100 s.

Every receipt boundary samples the realtime clock between two monotonic
reads and keeps the tightest of eight brackets. Its midpoint places the
receipt on the pads' clock, so half the bracket's width shifts every expected
frame: a 31 µs bracket in a busy headless process put one edge 5 µs after a
frame boundary on the other side of it (1295/1296), and the tightest of
eight brackets is about 1 µs, as native captures measured with one.

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
adding pooling anywhere else. A reused record is still copied field by field
on those paths: TypeScriptToLua's `Object.assign` packs its arguments into a
new table and walks the source with `pairs` on every call, and in the
integrity build's rematch the input and control copies made with it were an
eighth of the match's Lua work (Lua32, 6 October 2026).
Presentation projects every pooled effect on every callback, so a hidden pose
is one shared constant and an empty impact slot is not projected at all: a
new table for each hidden pose was 82 of a solo match callback's 87 KB of
Lua allocation when it ran no frame, and 82 of 137 KB on average (Lua32,
6 October 2026). Lua's collector works in proportion to what is
allocated, in steps that land on whichever callback allocates next.

Native calls cost Warcraft more than Lua does. A renderer parks a pooled
effect once, when it stops showing it, and keeps a flag per effect so it does
not park it again until it has shown it (`parkOnce`,
smashcraft:ts/src/game/render/effects.ts). Re-parking every hidden impact,
missile, trap and special effect on every frame was about 530 of a match
frame's 766 native calls with two fighters.
The fighter HUD likewise sets a plate's visibility, damage text and stock
icons only when they change (smashcraft:ts/src/game/ui/matchHud.ts): setting
them on every callback was 60 of the 166–183 native calls of each callback in
a solo match against a computer.

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
- `bun wisp dev [--data A --data B]`: the loop to keep running while changing
  code ([Wisp dev loop](https://github.com/tompassarelli/wisp/blob/main/docs/dev.md)).
  Each save prints the saved files' type errors, the affected unit tests, the
  journeys (the quick match plus the affected tests that play simulated
  clients: the desync guard, the visual and player-view group, stack-trace,
  rematch-load, missing-input, input-stall, tune and lag-recovery) and the
  whole `bun run check`, each timed from the save.
  smashcraft:ts/scripts/wisp/commands/dev.ts declares the tests: the Bun test
  files, the registry modules game.test.ts runs, the files a test reads at run
  time (a test that reads files without declaring them runs on every save),
  the journey tests and scripts/test.ts's isolated groups. Under `wisp dev`
  the source-shape audit checks only the saved files; `bun run test` and CI
  check every file. Test processes share smashcraft:ts/scripts/testWorkers.ts's
  engine settings with the full suite.
- `bun wisp tune --data A --data B [--port N] [--profile main|integrity]`: a
  panel at http://127.0.0.1:7341/ that changes, in the running match, the
  values smashcraft:ts/scripts/wisp/tunables.ts declares: each fighter's run
  speed, full and short jump speeds, gravity, fall and fast-fall speeds and
  jump squat frames, and the ordinary hit's knockback growth, base knockback
  and hitstun frames per knockback
  ([Wisp live tuning](https://github.com/tompassarelli/wisp/blob/main/docs/tune.md)).
  Each change is a hot reload, so run it instead of `hot --watch` or
  `dev --data`, against a profile that polls for reloads (the playable
  profile doesn't). Fighters carry their tuning records, so every `install()`
  gives each fighter its authored tuning again
  (smashcraft:ts/src/platform/shell/tuning.ts): in the confirmed match and,
  under rollback, in the speculative match and every history snapshot, so a
  correction can't bring the old value back. Keep writes the running value
  into smashcraft:ts/src/game/sim/tuning.ts or knockback.ts and prints the
  diff; Reset puts back the session's starting value in the match and the
  source. smashcraft:ts/test/tune.test.ts applies tuned gravity in two
  headless clients: both install it on the same frame, and from that frame
  both matches change alike. The input helper's stick deadzone
  (`STICK_DEADZONE`, smashcraft:companion/src/stick.rs) is compiled into the
  helper, outside what a reload changes, so it is no tunable: rebuild and
  restart the helper to change it. A match with tuned values can't be
  replayed from its inputs alone.
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
are carried along unverified. A newly declared import goes into a copy of the
container with the packager, from the repository root:
`build/tools/map-pack replace CONTAINER.w3x FILE 'war3mapImported\NAME'`.

Repository-authored models are generated: each generator writes the models,
their textures and an import list under smashcraft:build/, and the models'
content-addressed import paths to a checked-in module under
smashcraft:ts/src/game/, which the map compiles. Regenerate instead of editing
those modules. smashcraft:ts/scripts/wisp/mapInputs.ts lists each family
(`GENERATED_MODELS`) with its import list and generator; the stage decks come
from smashcraft:tools/stage/package.ts, which draws the main deck from its
collision lines. The build fails unless each family's
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

A clip drops its fighter's light and effect nodes, and Warcraft does not read
a node's ObjectId as written: Illidan's standalone light, written alone as
ObjectId 155 beside his 276-entry pivot table, lit from the wrong place and
lit exactly once numbered 0 (2 October). So the export numbers every clip's
remaining nodes by their place in the file's node order, with parents, skin
matrices and pivots following (smashcraft:ts/scripts/clipNodes.ts), and fails
on a clip that does not.

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
