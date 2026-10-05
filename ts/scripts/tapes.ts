// The replay acceptance oracle: recorded tapes must give identical canonical
// replay states, hence identical checksums, after every frame in Wurst's Lua,
// TypeScript under Bun and TypeScript under 32-bit Lua. Prints the totals, or
// each runtime pair's first divergent frame and field.
// Usage (from ts/): LUA=<LUA_32BITS lua> bun scripts/tapes.ts
import "../test/host-natives";
import { dirname, join } from "node:path";
import { adaptInput } from "../src/game/input/adapter";
import { ACTION_COUNT, Action, bit } from "../src/game/input/actions";
import { type AttackBuffer, attackBuffer } from "../src/game/input/attackBuffer";
import { commitEdges, keyboardCapture, sampleKeys } from "../src/game/input/keyboardCapture";
import { actionFor, keyLabel, presetBindings } from "../src/game/input/keyBindings";
import { matchSpawnX } from "../src/game/match/step";
import { decodeTape } from "../src/game/replay/tape";
import { runTape } from "../src/game/replay/tapeRunner";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { type Controls, neutralControls } from "../src/game/sim/roster";

const ts = join(import.meta.dir, "..");
const project = join(ts, "..");
const build = join(ts, "build", "tapes");

// ---------------------------------------------------------------- tapes

const bindings = presetBindings("standard");
/** Every bound key of the standard layout, by label, plus the controller stick's jump. */
const SOURCES = new Map<string, Action>();
for (const key of bindings.keys) {
  const action = actionFor(bindings, key);
  if (key !== 0 && action !== undefined) SOURCES.set(keyLabel(key), action);
}
const STICK_JUMP = "stick-up";
SOURCES.set(STICK_JUMP, Action.jump);

const LEFT = "W", RIGHT = "R", DOWN = "E", UP = "SPACE", JUMP = "I", JUMP_ALT = "8", ATTACK = "N", SPECIAL = "U",
  GRAB = "O", SHIELD_LEFT = "Q", SHIELD_RIGHT = "7", C_LEFT = "B", C_LEFT_ALT = "/", C_RIGHT = "M", C_UP = "J",
  C_DOWN = "H", WALK = "P";

/** Hold these sources from frame `at` for `frames` frames. */
type Hold = readonly [at: number, frames: number, ...sources: string[]];

interface MatchScript {
  readonly characters: readonly [Character, Character];
  readonly stage: number;
  readonly stocks: number;
  readonly minutes: number;
  readonly frames: number;
  readonly holds: readonly [readonly Hold[], readonly Hold[]];
  /** Replay `[first, last]` after frame `last`. */
  readonly rollbacks: readonly (readonly [number, number])[];
}

const NEUTRAL = Object.entries(neutralControls());

function formatControls(controls: Controls, attacks: AttackBuffer): string {
  const words: string[] = [];
  for (const [index, [field, value]] of Object.entries(controls).entries()) {
    if (value === NEUTRAL[index]?.[1]) continue;
    words.push(`${field}=${typeof value === "boolean" ? (value ? 1 : 0) : value}`);
  }
  const attack = attacks.pending;
  if (attack !== undefined) words.push(`attack=${attack.style},${attack.facing},${attack.frame},${attack.mayCharge ? 1 : 0}`);
  return words.join(" ");
}

/** One match's input lines: keyboard holds sampled each frame and adapted for a fighter standing at its spawn. */
function matchLines(script: MatchScript, pressed: Set<string>[]): string[] {
  const lines: string[] = [];
  const participants = script.holds.map((holds, slot) => {
    const x = matchSpawnX(slot);
    for (const [, , ...sources] of holds) {
      for (const source of sources) if (!SOURCES.has(source)) throw new Error(`unbound source ${source}`);
    }
    return { holds, capture: keyboardCapture(), fighter: createFighter(script.characters[slot] ?? Character.archer, x, x < 0 ? 1 : -1), controls: neutralControls(), attacks: attackBuffer(0), held: new Set<string>() };
  });
  const rollbacks = new Map(script.rollbacks.map(([first, last]) => [last, first]));
  for (let frame = 1; frame <= script.frames; frame++) {
    participants.forEach((participant, slot) => {
      const held = new Set<string>();
      for (const [at, frames, ...sources] of participant.holds) {
        if (frame >= at && frame < at + frames) for (const source of sources) held.add(source);
      }
      for (const source of held) if (!participant.held.has(source)) pressed[slot]?.add(source);
      participant.held = held;
      let mask = 0;
      for (const source of held) mask |= bit(SOURCES.get(source) ?? 0);
      sampleKeys(participant.capture, mask);
      adaptInput(participant.capture.row, participant.fighter, frame, participant.controls, participant.attacks);
      commitEdges(participant.capture);
      lines.push(`input ${slot} ${formatControls(participant.controls, participant.attacks)}`.trimEnd());
    });
    lines.push(`frame ${frame}`);
    const first = rollbacks.get(frame);
    if (first !== undefined) lines.push(`rollback ${first} ${frame}`);
  }
  return lines;
}

function menuLines(script: MatchScript): string[] {
  return [
    `character 0 ${script.characters[0]}`, `character 1 ${script.characters[1]}`, "stage-select 0",
    `stage 0 ${script.stage}`, `stocks 0 ${script.stocks}`, `time 0 ${script.minutes}`, "start 0",
  ];
}

const every = (from: number, to: number, stride: number, length: number) => {
  const windows: [number, number][] = [];
  for (let last = from; last <= to; last += stride) windows.push([last - length + 1, last]);
  return windows;
};

/** Each slot presses every bound source, the three jump sources overlapping, with short replays. */
const ACTIONS: MatchScript = {
  characters: [Character.archer, Character.rifleman], stage: 0, stocks: 3, minutes: 0, frames: 380,
  holds: [[
    [1, 24, RIGHT], [28, 10, WALK, RIGHT], [40, 2, ATTACK], [50, 14, DOWN], [52, 2, ATTACK], [68, 2, UP],
    [76, 3, JUMP], [82, 2, ATTACK], [100, 14, JUMP_ALT], [104, 16, STICK_JUMP], [110, 2, DOWN], [130, 2, SPECIAL],
    [146, 8, RIGHT], [148, 2, SPECIAL], [166, 2, GRAB], [176, 2, LEFT], [190, 20, SHIELD_LEFT], [196, 2, LEFT],
    [218, 12, SHIELD_RIGHT], [220, 2, DOWN], [240, 3, JUMP], [246, 6, UP], [248, 2, SHIELD_RIGHT], [266, 2, C_LEFT],
    [280, 2, C_LEFT_ALT], [294, 2, C_RIGHT], [308, 2, C_UP], [322, 2, C_DOWN], [334, 10, WALK, LEFT],
    [336, 2, ATTACK], [348, 16, ATTACK], [350, 2, RIGHT], [368, 6, UP], [370, 2, SPECIAL],
  ], [
    [1, 20, LEFT], [24, 2, ATTACK], [34, 16, SHIELD_RIGHT], [38, 2, RIGHT], [56, 2, C_RIGHT], [66, 3, JUMP_ALT],
    [70, 2, C_DOWN], [84, 14, STICK_JUMP], [86, 8, JUMP], [104, 2, SHIELD_LEFT], [116, 2, GRAB], [124, 2, UP],
    [136, 10, WALK, LEFT], [138, 2, ATTACK], [152, 12, DOWN], [154, 2, SPECIAL], [172, 2, SHIELD_LEFT],
    [174, 4, DOWN], [186, 2, C_LEFT], [198, 2, C_LEFT_ALT], [210, 2, C_UP], [224, 4, JUMP], [228, 2, ATTACK],
    [240, 8, RIGHT], [244, 2, SPECIAL], [260, 24, SHIELD_LEFT, SHIELD_RIGHT], [266, 2, LEFT], [290, 2, ATTACK],
    [300, 14, RIGHT], [304, 2, GRAB], [312, 2, DOWN], [330, 8, UP], [332, 2, ATTACK], [350, 2, C_UP],
  ]],
  rollbacks: [...every(40, 360, 40, 6), [317, 380]],
};

/** Close combat, replayed one frame every frame, in short windows and over the whole retained history. */
const ROLLBACK: MatchScript = {
  characters: [Character.rifleman, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 200,
  holds: [[
    [1, 24, RIGHT], [30, 2, ATTACK], [44, 2, ATTACK], [58, 2, C_RIGHT], [72, 3, JUMP], [78, 2, ATTACK],
    [92, 2, SPECIAL], [108, 2, GRAB], [118, 2, RIGHT], [132, 16, SHIELD_LEFT], [152, 2, C_UP], [166, 2, ATTACK],
    [178, 8, RIGHT], [180, 2, SPECIAL], [192, 2, GRAB],
  ], [
    [1, 24, LEFT], [34, 2, C_LEFT], [48, 14, SHIELD_RIGHT], [66, 2, ATTACK], [80, 4, JUMP], [86, 2, SPECIAL],
    [100, 2, ATTACK], [114, 2, GRAB], [124, 2, UP], [140, 2, C_DOWN], [156, 8, LEFT], [158, 2, SPECIAL],
    [174, 2, ATTACK], [186, 16, SHIELD_LEFT], [190, 2, LEFT],
  ]],
  rollbacks: [...every(60, 90, 1, 1), ...every(97, 130, 7, 6), [73, 136], [137, 200]],
};

/** A one-stock match ends when the Rifleman runs off the stage; one replay crosses the end. */
const FIRST_MATCH: MatchScript = {
  characters: [Character.demonHunter, Character.rifleman], stage: 0, stocks: 1, minutes: 0, frames: 90,
  holds: [[[20, 2, ATTACK], [40, 3, JUMP], [60, 2, SPECIAL]], [[1, 90, RIGHT]]],
  rollbacks: [[62, 80]],
};

/** The rematch, configured through the menus: other fighters, the raised decks, two stocks and a clock. */
const SECOND_MATCH: MatchScript = {
  characters: [Character.archer, Character.demonHunter], stage: 1, stocks: 2, minutes: 1, frames: 120,
  holds: [[
    [1, 12, RIGHT], [20, 3, JUMP_ALT], [34, 2, DOWN], [46, 2, ATTACK], [60, 2, SPECIAL], [74, 14, SHIELD_LEFT],
    [94, 2, GRAB], [108, 2, C_RIGHT],
  ], [
    [1, 12, LEFT], [24, 4, JUMP], [40, 6, DOWN], [52, 2, ATTACK], [66, 2, C_LEFT], [80, 2, SPECIAL],
    [96, 2, SHIELD_RIGHT], [110, 2, GRAB],
  ]],
  rollbacks: [[30, 34], [57, 120]],
};

function tape(title: string, body: string[]): string {
  return ["smashcraft-tape 1", `# ${title}`, "participants 3 0", ...body, ""].join("\n");
}

function generateTapes(): Map<string, string> {
  const pressed = [new Set<string>(), new Set<string>()];
  const tapes = new Map([
    ["actions", tape("Every bound source pressed by both players, with short replays.", [...menuLines(ACTIONS), ...matchLines(ACTIONS, pressed)])],
    ["rollback", tape("Combat replayed from one frame up to the whole retained history.", [...menuLines(ROLLBACK), ...matchLines(ROLLBACK, [])])],
    ["rematch", tape("A one-stock match ends, both players confirm the rematch, a new match runs.", [
      ...menuLines(FIRST_MATCH), ...matchLines(FIRST_MATCH, []), "rematch 0", "rematch 1",
      ...menuLines(SECOND_MATCH), ...matchLines(SECOND_MATCH, []),
    ])],
  ]);
  pressed.forEach((sources, slot) => {
    const missing = [...SOURCES.keys()].filter(source => !sources.has(source));
    if (missing.length > 0) throw new Error(`the actions tape never presses ${missing.join(", ")} for slot ${slot}`);
  });
  if (SOURCES.size !== 18 || new Set(SOURCES.values()).size !== ACTION_COUNT) throw new Error("the standard layout no longer binds the sources the tapes press");
  return tapes;
}

// ---------------------------------------------------------------- runtimes

/** One runtime's records for one tape: "LINE OPERATION RESULT CANONICAL-STATE". */
interface Run {
  readonly records: string[];
  readonly error: string | undefined;
}

function command(argv: string[], cwd = ts): { output: string; error: string | undefined } {
  const result = Bun.spawnSync(argv, { cwd, stdout: "pipe", stderr: "pipe" });
  const stderr = result.stderr.toString().trim();
  return { output: result.stdout.toString(), error: result.exitCode === 0 ? undefined : stderr || `exit ${result.exitCode}` };
}

const recordsOf = (output: string) => output.split("\n").filter(line => line.length > 0);

function runInBun(text: string): Run {
  const decoded = decodeTape(text);
  if (!decoded.ok) return { records: [], error: `line ${decoded.line}: ${decoded.message}` };
  const records: string[] = [];
  const result = runTape(decoded.value, record => records.push(record));
  return { records, error: result.ok ? undefined : `line ${result.line}: ${result.message}` };
}

const lua = process.env.LUA ?? "lua";

async function inputsHash(paths: readonly string[], extra: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(extra);
  for (const path of paths) {
    hasher.update(path);
    hasher.update(await Bun.file(path).bytes());
  }
  return hasher.digest("hex");
}

/** Rebuilds `output` only when the hash of its inputs changed. Returns build seconds, 0 when cached. */
async function cachedBuild(output: string, hash: string, buildIt: () => string | undefined): Promise<number> {
  const stamp = Bun.file(`${output}.inputs`);
  if (await Bun.file(output).exists() && await stamp.exists() && await stamp.text() === hash) return 0;
  const started = performance.now();
  const failure = buildIt();
  if (failure !== undefined) throw new Error(failure);
  await Bun.write(stamp, hash);
  return (performance.now() - started) / 1000;
}

const tapesLua = join(ts, "build", "lua-tapes", "tapes.lua");

async function compileTypeScriptLua(): Promise<number> {
  const sources = ["src", "test/tapes", "plugins"].flatMap(dir => [...new Bun.Glob(`${dir}/**/*.ts`).scanSync(ts)]).sort().map(path => join(ts, path));
  const config = join(ts, "tsconfig.lua-tapes.json");
  return cachedBuild(tapesLua, await inputsHash([...sources, config], "tstl"), () =>
    command(["bun", "--bun", join(ts, "node_modules/typescript-to-lua/dist/tstl.js"), "-p", config]).error);
}

/** Runs a 32-bit Lua process; the tapes run concurrently, each in its own process. */
async function runLua(argv: string[], env: Record<string, string> = {}): Promise<Run> {
  const child = Bun.spawn([lua, ...argv], { env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  const [output, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { records: recordsOf(output), error: exitCode === 0 ? undefined : stderr.trim() || `exit ${exitCode}` };
}

const runInLua = (file: string) => runLua([tapesLua], { TAPE_FILE: file });

// The Wurst side compiles the oracle package with the game's own replay code,
// using the locked compiler and the map build's flags, then runs that Lua in
// 32-bit Lua with stubbed natives.
const lock = await Bun.file(join(project, "wurst-toolchain.lock")).text();
const lockValue = (name: string) => new RegExp(`^${name} = "(.*)"$`, "m").exec(lock)?.[1] ?? "";
const compilerPin = `/home/tom/code/wurst-compiler/pins/${lockValue("compilerCommit")}`;
const stdlibPin = `/home/tom/code/wurst-stdlib/pins/${lockValue("stdlibCommit").slice(0, 12)}`;
const luaRuntime = `/home/tom/code/wurst-compiler/pins/${lockValue("luaTestRuntimeCommit")}/de.peeeq.wurstscript/src/test/resources/luaruntime`;
const java = "/home/tom/.wurst/wurst-runtime/bin/java";
const compilerJar = join(project, "toolchain", "wurstscript.jar");
const oracleDir = join(project, "build", "tape-oracle");
const oracleLua = join(oracleDir, "oracle.lua");
const WURST_SOURCES = [
  "wurst/Simulation.wurst", "wurst/TechInput.wurst", "wurst/MeleeContactGeometry.wurst", "wurst/MeleeScalarMath.wurst",
  "wurst/RollTravel.wurst", "wurst/IllidanMotion.wurst", "build/animation-assets/FighterAssetInfo.wurst",
  "build/illidan-animation/DemonHunterAssetInfo.wurst", "wurst/FighterPose.wurst", "wurst/DamagePose.wurst",
  "build/summon-original-clips/wurst/SummonOriginalClipInfo.wurst", "wurst/SummonPose.wurst", "wurst/SummonState.wurst",
  "wurst/SpecialEffectState.wurst", "wurst/ImpactEvents.wurst", "wurst/ImpactState.wurst", "wurst/MatchRules.wurst",
  "wurst/MatchStep.wurst", "wurst/CommandBuffer.wurst", "wurst/CombatInput.wurst", "wurst/NetworkInput.wurst",
  "wurst/InputAdapter.wurst", "wurst/ParticipantInputs.wurst", "wurst/KeyBindings.wurst", "wurst/BotRecovery.wurst",
  "wurst/ReplayState.wurst", "wurst/ReplayHistory.wurst", "tools/tape-oracle/TapeOracle.wurst",
].map(path => join(project, path));

async function compileWurstLua(): Promise<number> {
  const jarHash = new Bun.CryptoHasher("sha256").update(await Bun.file(compilerJar).bytes()).digest("hex");
  if (jarHash !== lockValue("compilerArtifactSha256")) throw new Error(`${compilerJar} does not match wurst-toolchain.lock`);
  const commonJ = join(compilerPin, "de.peeeq.wurstscript/src/main/resources/common.j");
  const blizzardJ = join(compilerPin, "de.peeeq.wurstscript/src/main/resources/blizzard.j");
  const workspace = join(oracleDir, "workspace");
  const hash = await inputsHash([commonJ, blizzardJ, ...WURST_SOURCES], `${jarHash} ${stdlibPin}`);
  return cachedBuild(oracleLua, hash, () => {
    command(["mkdir", "-p", workspace]);
    command(["cp", join(project, "wurst.build"), join(project, "wurst_run.args"), workspace]);
    // The JVM compile is heavy work, admitted by the machine's capacity helper. The compiler
    // also writes compiled.lua.txt into its working directory.
    const capacity = join(dirname(command(["agents", "path", "machine-capacity-distilled"]).output.trim()), "scripts", "machine-capacity.mjs");
    const { output, error } = command([
      "bun", capacity, "run", "--class", "heavy", "--owner", process.env.CAPACITY_OWNER ?? "smashcraft/tapes", "--timeout-seconds", "900", "--",
      java, "-Xmx2048m", "-XX:ActiveProcessorCount=2", "-jar", compilerJar, "-lua", "-runcompiletimefunctions", "-stacktraces",
      "-workspaceroot", workspace, "-lib", stdlibPin, "-out", oracleLua, commonJ, blizzardJ, ...WURST_SOURCES,
    ], workspace);
    return error ?? (/errors: [1-9]/.test(output) ? output : undefined);
  });
}

const runInWurst = (file: string) => runLua([join(project, "tools", "tape-oracle", "run.lua"), oracleLua, luaRuntime, file]);

// ---------------------------------------------------------------- comparison

type RuntimeName = "wurst-lua" | "bun" | "ts-lua32";
const RUNTIMES: readonly RuntimeName[] = ["wurst-lua", "bun", "ts-lua32"];
const PAIRS: readonly (readonly [RuntimeName, RuntimeName])[] = [["wurst-lua", "bun"], ["wurst-lua", "ts-lua32"], ["bun", "ts-lua32"]];

/** Splits a record into its label ("LINE OPERATION RESULT") and its canonical fields. */
function parseRecord(record: string | undefined): { label: string; fields: string[] } {
  const words = (record ?? "").split(" ");
  return { label: words.slice(0, 3).join(" "), fields: words.slice(3).join(" ").split("|") };
}

/** The first canonical field that differs, with both values, and how many differ. */
function describeDivergence(a: string | undefined, b: string | undefined, names: readonly [RuntimeName, RuntimeName]): string {
  const left = parseRecord(a);
  const right = parseRecord(b);
  if (a === undefined || b === undefined || left.label !== right.label) return `records differ: "${left.label || "none"}" in ${names[0]}, "${right.label || "none"}" in ${names[1]}`;
  let first: string | undefined;
  let count = 0;
  for (let index = 0; index < Math.max(left.fields.length, right.fields.length); index++) {
    if (left.fields[index] === right.fields[index]) continue;
    count++;
    first ??= `${left.fields[index] ?? "(missing)"} in ${names[0]}, ${right.fields[index] ?? "(missing)"} in ${names[1]}`;
  }
  return `${first ?? "no field"} (${count} fields differ)`;
}

// ---------------------------------------------------------------- main

if (command([lua, "-e", "io.write(math.maxinteger)"]).output !== "2147483647") {
  console.error(`LUA=${lua} is not a 32-bit Lua (LUA_32BITS); point LUA at one.`);
  process.exit(2);
}
await Bun.$`mkdir -p ${build}`;
const texts = generateTapes();
for (const [name, text] of texts) await Bun.write(join(build, `${name}.tape`), text);

const seconds: Record<RuntimeName, { compile: number; run: number }> = {
  "wurst-lua": { compile: await compileWurstLua(), run: 0 },
  "bun": { compile: 0, run: 0 },
  "ts-lua32": { compile: await compileTypeScriptLua(), run: 0 },
};
// Seconds per runtime are summed over its tapes; the Lua processes overlap.
async function timed(runtime: RuntimeName, go: () => Run | Promise<Run>): Promise<Run> {
  const started = performance.now();
  const run = await go();
  seconds[runtime].run += (performance.now() - started) / 1000;
  return run;
}
// Start every Lua process before the in-process Bun runs occupy this thread.
const started = [...texts].map(([name, text]) => {
  const file = join(build, `${name}.tape`);
  return { name, text, wurst: timed("wurst-lua", () => runInWurst(file)), lua32: timed("ts-lua32", () => runInLua(file)) };
});
const runs = new Map<string, Record<RuntimeName, Run>>();
for (const { name, text, wurst, lua32 } of started) {
  const bun = await timed("bun", () => runInBun(text));
  runs.set(name, { "wurst-lua": await wurst, bun, "ts-lua32": await lua32 });
}

const frameCount = (run: Run) => run.records.filter(record => record.split(" ", 2)[1] === "frame").length;
const perTape = [...runs].map(([name, byRuntime]) => `${name} ${frameCount(byRuntime["wurst-lua"])}`);
const totalFrames = [...runs.values()].reduce((sum, byRuntime) => sum + frameCount(byRuntime["wurst-lua"]), 0);
console.log(`${runs.size} tapes, ${totalFrames} frames (${perTape.join(", ")})`);
console.log(RUNTIMES.map(runtime => {
  const { compile, run } = seconds[runtime];
  return `${runtime} ${compile > 0 ? `compile ${compile.toFixed(1)} s + ` : ""}run ${run.toFixed(1)} s`;
}).join("; "));

let failed = false;
for (const [name, byRuntime] of runs) {
  for (const runtime of RUNTIMES) {
    const { error } = byRuntime[runtime];
    if (error === undefined) continue;
    failed = true;
    console.log(`${runtime} stopped on ${name}: ${error.split("\n").slice(0, 3).join(" | ")}`);
  }
}
for (const pair of PAIRS) {
  let divergentFrames = 0;
  let divergentOther = 0;
  let first: string | undefined;
  for (const [name, byRuntime] of runs) {
    const a = byRuntime[pair[0]].records;
    const b = byRuntime[pair[1]].records;
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
      if (a[index] === b[index]) continue;
      const { label } = parseRecord(a[index] ?? b[index]);
      if (label.split(" ")[1] === "frame") divergentFrames++;
      else divergentOther++;
      first ??= `${name} line ${label}: ${describeDivergence(a[index], b[index], pair)}`;
    }
  }
  if (first !== undefined) failed = true;
  const other = divergentOther > 0 ? ` and ${divergentOther} other records` : "";
  console.log(`${pair.join("/")}: ${divergentFrames} divergent frames${other}${first === undefined ? "" : `; first at ${first}`}`);
}
process.exit(failed ? 1 : 0);
