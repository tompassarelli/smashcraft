// `waygate tapes`, the replay acceptance oracle: recorded tapes must give
// identical canonical replay states, hence identical checksums, after every
// frame in Wurst's Lua, TypeScript under Bun and TypeScript under 32-bit Lua.
// Prints the totals, or each runtime pair's first divergent frame and field.
// The tapes are recorded fresh each run by two scripted keyboard players
// reacting to the TypeScript simulation; every runtime then replays the same
// recorded rows. Environment: LUA, a LUA_32BITS lua.
import "../../../test/host-natives";
import { dirname, join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { adaptInput } from "../../../src/game/input/adapter";
import { ACTION_COUNT, Action, bit } from "../../../src/game/input/actions";
import { type AttackBuffer, attackBuffer } from "../../../src/game/input/attackBuffer";
import { commitEdges, keyboardCapture, sampleKeys } from "../../../src/game/input/keyboardCapture";
import { actionFor, keyLabel, presetBindings } from "../../../src/game/input/keyBindings";
import { TAPE_HEADER, decodeTape } from "../../../src/game/replay/tape";
import { type TapeSession, createTapeSession, performTapeOperation, runTape } from "../../../src/game/replay/tapeRunner";
import { Character } from "../../../src/game/sim/codes";
import { type Controls, fighterAt, neutralControls } from "../../../src/game/sim/roster";
import { type Command, UsageFailure, describeCause } from "../command";
import { step } from "../timings";

const ts = join(import.meta.dir, "../../..");
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

/** Pseudo-sources: the direction key toward or away from the opponent on this frame. */
const TOWARD = "toward", AWAY = "away";

/** Hold these sources from frame `at` for `frames` frames. */
type Hold = readonly [at: number, frames: number, ...sources: string[]];
/**
 * From frame `at`, close on the opponent until within `within` units, for at
 * most APPROACH_FRAMES: dashing while far, walking for the last WALK_RANGE.
 */
type Approach = readonly [at: number, within: number];
const APPROACH_FRAMES = 40;
const WALK_RANGE = 120;

interface MatchScript {
  readonly characters: readonly [Character, Character];
  readonly stage: number;
  readonly stocks: number;
  readonly minutes: number;
  readonly frames: number;
  readonly holds: readonly [readonly Hold[], readonly Hold[]];
  readonly approaches: readonly [readonly Approach[], readonly Approach[]];
  /** Replay `[first, last]` after frame `last`. */
  readonly rollbacks: readonly (readonly [number, number])[];
  /**
   * Run `[first, last]` as predictions that slot 1 is idle, then correct each
   * frame with the inputs actually recorded, oldest first, after frame `last`.
   */
  readonly predictions?: readonly (readonly [number, number])[];
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

function menuLines(script: MatchScript): string[] {
  return [
    `character 0 ${script.characters[0]}`, `character 1 ${script.characters[1]}`, "stage-select 0",
    `stage 0 ${script.stage}`, `stocks 0 ${script.stocks}`, `time 0 ${script.minutes}`, "start 0",
  ];
}

/**
 * Plays one match as two keyboard players reacting to the TypeScript
 * simulation: each frame samples the held keys and adapts them for the
 * fighter as it stands, as the game does with network rows. The recorded
 * rows are what every runtime replays.
 */
function playMatch(script: MatchScript, session: TapeSession, play: (...lines: string[]) => void, pressed: Set<string>[]): void {
  const players = ([0, 1] as const).map(slot => ({
    slot, capture: keyboardCapture(), controls: neutralControls(), attacks: attackBuffer(0), held: new Set<string>(),
    approaches: script.approaches[slot].map(([at, within]) => ({ at, within, done: false })), holds: script.holds[slot],
  }));
  const rollbacks = new Map(script.rollbacks.map(([first, last]) => [last, first]));
  /** Recorded input lines of the predicted frames still to correct. */
  const actual: string[][] = [];
  for (let frame = 1; frame <= script.frames; frame++) {
    const inputs = players.map(player => {
      const self = fighterAt(session.live.world, player.slot);
      const dx = fighterAt(session.live.world, 1 - player.slot).motion.x - self.motion.x;
      const toward = dx < 0 ? LEFT : RIGHT;
      const resolve = (source: string) => source === TOWARD ? toward : source === AWAY ? (toward === LEFT ? RIGHT : LEFT) : source;
      const held = new Set<string>();
      for (const [at, frames, ...sources] of player.holds) {
        if (frame >= at && frame < at + frames) for (const source of sources) held.add(resolve(source));
      }
      for (const approach of player.approaches) {
        if (approach.done || frame < approach.at) continue;
        if (Math.abs(dx) <= approach.within || frame >= approach.at + APPROACH_FRAMES) approach.done = true;
        else {
          held.add(toward);
          if (Math.abs(dx) <= approach.within + WALK_RANGE) held.add(WALK);
        }
      }
      let mask = 0;
      for (const source of held) {
        const action = SOURCES.get(source);
        if (action === undefined) throw new Error(`unbound source ${source}`);
        mask |= bit(action);
        if (!player.held.has(source)) pressed[player.slot]?.add(source);
      }
      player.held = held;
      sampleKeys(player.capture, mask);
      adaptInput(player.capture.row, self, frame, player.controls, player.attacks);
      commitEdges(player.capture);
      return `input ${player.slot} ${formatControls(player.controls, player.attacks)}`.trimEnd();
    });
    const first = rollbacks.get(frame);
    const prediction = script.predictions?.find(([from, to]) => frame >= from && frame <= to);
    if (prediction === undefined) play(...inputs, `frame ${frame}`);
    else {
      actual.push(inputs);
      play(...inputs.slice(0, 1), "input 1", `predict ${frame}`);
      if (frame === prediction[1]) actual.splice(0).forEach((recorded, index) => play(...recorded, `correct ${prediction[0] + index}`));
    }
    if (first !== undefined) play(`rollback ${first} ${frame}`);
  }
}

/** Records a tape by playing its matches, a rematch between consecutive ones. */
function recordTape(title: string, scripts: readonly MatchScript[], pressed: Set<string>[] = []): string {
  const session = createTapeSession();
  const lines = [TAPE_HEADER, `# ${title}`];
  let replayedCorrections = 0;
  const checkCorrection = (record: string) => {
    const result = record.split(" ", 3)[2];
    if (result === "rejected") throw new Error(`${title}: the history rejected a correction`);
    if (result !== "unchanged") replayedCorrections++;
  };
  const play = (...added: string[]) => {
    const decoded = decodeTape([TAPE_HEADER, ...added].join("\n"));
    if (!decoded.ok) throw new Error(`generated "${added[decoded.line - 2]}": ${decoded.message}`);
    for (const operation of decoded.value) {
      const refused = performTapeOperation(session, operation, operation.kind === "correct" ? checkCorrection : undefined);
      if (refused !== undefined) throw new Error(`${title}: ${refused}`);
    }
    lines.push(...added);
  };
  play("participants 3 0");
  scripts.forEach((script, index) => {
    if (index > 0) play("rematch 0", "rematch 1");
    play(...menuLines(script));
    playMatch(script, session, play, pressed);
  });
  if (scripts.some(script => (script.predictions?.length ?? 0) > 0) && replayedCorrections === 0) throw new Error(`${title}: no correction changed a prediction`);
  return [...lines, ""].join("\n");
}

const every = (from: number, to: number, stride: number, length: number) => {
  const windows: [number, number][] = [];
  for (let last = from; last <= to; last += stride) windows.push([last - length + 1, last]);
  return windows;
};

/** Each slot presses every bound source, the three jump sources overlapping, mostly within reach of the other. */
const ACTIONS: MatchScript = {
  characters: [Character.archer, Character.rifleman], stage: 0, stocks: 3, minutes: 0, frames: 410,
  holds: [[
    [30, 2, ATTACK], [40, 10, DOWN], [42, 2, ATTACK], [70, 6, WALK, TOWARD], [72, 2, ATTACK], [86, 4, UP],
    [87, 2, ATTACK], [100, 3, JUMP], [106, 2, ATTACK], [130, 14, JUMP_ALT], [134, 16, STICK_JUMP], [140, 2, ATTACK],
    [144, 2, DOWN], [165, 2, SPECIAL], [190, 2, GRAB], [200, 2, TOWARD], [215, 8, TOWARD], [217, 2, SPECIAL],
    [235, 20, SHIELD_LEFT], [241, 2, AWAY], [270, 12, SHIELD_RIGHT], [274, 2, DOWN], [290, 3, JUMP], [296, 6, UP],
    [298, 2, SHIELD_RIGHT], [315, 2, C_LEFT], [328, 2, C_RIGHT], [340, 2, C_LEFT_ALT], [352, 2, C_UP],
    [364, 2, C_DOWN], [378, 16, ATTACK], [380, 2, TOWARD], [396, 6, UP], [398, 2, SPECIAL],
  ], [
    [20, 24, SHIELD_RIGHT], [50, 2, ATTACK], [60, 2, GRAB], [84, 2, SHIELD_LEFT], [95, 4, JUMP], [101, 2, C_DOWN],
    [112, 2, SPECIAL], [126, 2, C_RIGHT], [150, 16, SHIELD_LEFT, SHIELD_RIGHT], [168, 14, STICK_JUMP],
    [170, 8, JUMP_ALT], [174, 2, ATTACK], [186, 2, UP], [192, 2, ATTACK], [194, 2, SPECIAL], [196, 2, JUMP],
    [210, 10, DOWN], [212, 2, SPECIAL], [230, 10, WALK, TOWARD], [232, 2, ATTACK], [250, 2, C_LEFT],
    [262, 2, C_LEFT_ALT], [274, 2, C_UP], [286, 10, TOWARD], [288, 2, GRAB], [300, 6, AWAY], [320, 6, SHIELD_LEFT],
    [322, 2, DOWN], [334, 3, JUMP], [338, 2, SHIELD_LEFT], [350, 2, C_RIGHT], [372, 2, UP],
  ]],
  approaches: [
    [[1, 45], [56, 45], [118, 50], [175, 35], [258, 45], [305, 50], [370, 45]],
    [[1, 60], [120, 40], [182, 40], [245, 50]],
  ],
  rollbacks: [...every(40, 400, 40, 6), [347, 410]],
};

/** Close combat, replayed one frame every frame, in short windows and over the whole retained history. */
const ROLLBACK: MatchScript = {
  characters: [Character.rifleman, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 220,
  holds: [[
    [20, 2, ATTACK], [48, 2, GRAB], [56, 2, TOWARD], [78, 2, ATTACK], [86, 8, DOWN], [88, 2, ATTACK], [108, 3, JUMP],
    [112, 2, ATTACK], [138, 2, SPECIAL], [168, 8, TOWARD], [170, 2, SPECIAL], [198, 2, ATTACK],
  ], [
    [26, 14, SHIELD_RIGHT], [52, 2, ATTACK], [64, 2, ATTACK], [82, 2, GRAB], [92, 2, AWAY], [118, 2, C_DOWN],
    [146, 2, ATTACK], [176, 16, SHIELD_LEFT], [200, 2, SPECIAL], [210, 2, ATTACK],
  ]],
  approaches: [
    [[1, 45], [30, 45], [60, 45], [90, 45], [120, 45], [150, 45], [180, 45]],
    [[10, 45], [40, 45], [70, 45], [100, 45], [130, 45], [160, 45], [190, 45]],
  ],
  rollbacks: [...every(60, 90, 1, 1), ...every(97, 130, 7, 6), [73, 136], [157, 220]],
  predictions: [[24, 45], [140, 151], [196, 214]],
};

/** A one-stock match ends when the Rifleman runs off the stage; one replay crosses the end. */
const FIRST_MATCH: MatchScript = {
  characters: [Character.demonHunter, Character.rifleman], stage: 0, stocks: 1, minutes: 0, frames: 90,
  holds: [[[20, 2, ATTACK], [40, 3, JUMP], [60, 2, SPECIAL]], [[1, 90, RIGHT]]],
  approaches: [[], []],
  rollbacks: [[62, 80]],
};

/** The rematch, configured through the menus: other fighters, the raised decks, two stocks and a clock. */
const SECOND_MATCH: MatchScript = {
  characters: [Character.archer, Character.demonHunter], stage: 1, stocks: 2, minutes: 1, frames: 140,
  holds: [[
    [20, 2, ATTACK], [30, 3, JUMP_ALT], [36, 2, DOWN], [60, 2, GRAB], [68, 2, UP], [86, 2, SPECIAL],
    [100, 14, SHIELD_LEFT], [126, 2, C_RIGHT],
  ], [
    [24, 2, ATTACK], [40, 4, JUMP], [46, 6, DOWN], [72, 2, ATTACK], [90, 2, C_LEFT], [104, 2, ATTACK], [118, 2, GRAB],
  ]],
  approaches: [[[1, 45], [45, 45], [116, 45]], [[1, 60], [95, 45]]],
  rollbacks: [[30, 34], [77, 140]],
};

function generateTapes(): Map<string, string> {
  const pressed = [new Set<string>(), new Set<string>()];
  const tapes = new Map([
    ["actions", recordTape("Every bound source pressed by both players, with short replays.", [ACTIONS], pressed)],
    ["rollback", recordTape("Combat replayed from one frame up to the whole retained history.", [ROLLBACK])],
    ["rematch", recordTape("A one-stock match ends, both players confirm the rematch, a new match runs.", [FIRST_MATCH, SECOND_MATCH])],
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

/** The locked Wurst compiler, standard library and Lua test runtime (smashcraft:wurst-toolchain.lock). */
interface WurstToolchain {
  readonly lockValue: (name: string) => string;
  readonly compilerPin: string;
  readonly stdlibPin: string;
  readonly luaRuntime: string;
}

async function wurstToolchain(): Promise<WurstToolchain> {
  const lock = await Bun.file(join(project, "wurst-toolchain.lock")).text();
  const lockValue = (name: string) => new RegExp(`^${name} = "(.*)"$`, "m").exec(lock)?.[1] ?? "";
  return {
    lockValue,
    compilerPin: `/home/tom/code/wurst-compiler/pins/${lockValue("compilerCommit")}`,
    stdlibPin: `/home/tom/code/wurst-stdlib/pins/${lockValue("stdlibCommit").slice(0, 12)}`,
    luaRuntime: `/home/tom/code/wurst-compiler/pins/${lockValue("luaTestRuntimeCommit")}/de.peeeq.wurstscript/src/test/resources/luaruntime`,
  };
}

async function compileWurstLua({ lockValue, compilerPin, stdlibPin }: WurstToolchain): Promise<number> {
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

const runInWurst = ({ luaRuntime }: WurstToolchain, file: string) => runLua([join(project, "tools", "tape-oracle", "run.lua"), oracleLua, luaRuntime, file]);

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

// ---------------------------------------------------------------- command

/** The runtimes disagree, one stopped, or the check couldn't run. */
export class TapesFailure extends Schema.TaggedError<TapesFailure>()("TapesFailure", {
  problem: Schema.String,
}) {
  override get message(): string {
    return this.problem;
  }
}

const attempt = <A>(what: string, run: () => A | PromiseLike<A>) =>
  Effect.tryPromise({ try: async () => run(), catch: (cause) => new TapesFailure({ problem: `${what}: ${describeCause(cause)}` }) });

/** Executed frames, run on recorded or on predicted rows. */
const isFrame = (operation: string | undefined) => operation === "frame" || operation === "predict";
const frameCount = (run: Run) => run.records.filter(record => isFrame(record.split(" ", 2)[1])).length;

export const tapes: Command = (args) => Effect.gen(function*() {
  if (args.length > 0) return yield* new UsageFailure({ problem: "tapes takes no arguments; set LUA to a 32-bit Lua" });
  if (command([lua, "-e", "io.write(math.maxinteger)"]).output !== "2147483647") {
    return yield* new TapesFailure({ problem: `LUA=${lua} is not a 32-bit Lua (LUA_32BITS); point LUA at one.` });
  }
  const tapes = yield* attempt("record tapes", async () => {
    await Bun.$`mkdir -p ${build}`;
    const recorded = [...generateTapes()].map(([name, text]) => ({ name, text, file: join(build, `${name}.tape`) }));
    for (const { file, text } of recorded) await Bun.write(file, text);
    return recorded;
  }).pipe(step("record tapes"));
  const toolchain = yield* attempt("read wurst-toolchain.lock", wurstToolchain);
  yield* attempt("compile Wurst Lua", () => compileWurstLua(toolchain)).pipe(step("compile Wurst Lua"));
  yield* attempt("compile TypeScript Lua", compileTypeScriptLua).pipe(step("compile TypeScript Lua"));
  // Every Lua process starts before the in-process Bun runs occupy this thread.
  const replays = yield* Effect.all({
    "wurst-lua": attempt("replay in Wurst Lua", () => Promise.all(tapes.map(({ file }) => runInWurst(toolchain, file)))).pipe(step("replay in wurst-lua")),
    "ts-lua32": attempt("replay in 32-bit Lua", () => Promise.all(tapes.map(({ file }) => runInLua(file)))).pipe(step("replay in ts-lua32")),
    "bun": attempt("replay in Bun", () => tapes.map(({ text }) => runInBun(text))).pipe(step("replay in bun")),
  }, { concurrency: "unbounded" });
  const runs = new Map(tapes.map(({ name }, index): [string, Record<RuntimeName, Run>] => {
    const byRuntime = (runtime: RuntimeName): Run => replays[runtime][index] ?? { records: [], error: "no run" };
    return [name, { "wurst-lua": byRuntime("wurst-lua"), bun: byRuntime("bun"), "ts-lua32": byRuntime("ts-lua32") }];
  }));

  const perTape = [...runs].map(([name, byRuntime]) => `${name} ${frameCount(byRuntime["wurst-lua"])}`);
  const totalFrames = [...runs.values()].reduce((sum, byRuntime) => sum + frameCount(byRuntime["wurst-lua"]), 0);
  yield* Console.log(`${runs.size} tapes, ${totalFrames} frames (${perTape.join(", ")})`);

  let failed = false;
  for (const [name, byRuntime] of runs) {
    for (const runtime of RUNTIMES) {
      const { error } = byRuntime[runtime];
      if (error === undefined) continue;
      failed = true;
      yield* Console.log(`${runtime} stopped on ${name}: ${error.split("\n").slice(0, 3).join(" | ")}`);
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
        if (isFrame(label.split(" ")[1])) divergentFrames++;
        else divergentOther++;
        first ??= `${name} line ${label}: ${describeDivergence(a[index], b[index], pair)}`;
      }
    }
    if (first !== undefined) failed = true;
    const other = divergentOther > 0 ? ` and ${divergentOther} other records` : "";
    yield* Console.log(`${pair.join("/")}: ${divergentFrames} divergent frames${other}${first === undefined ? "" : `; first at ${first}`}`);
  }
  if (failed) return yield* new TapesFailure({ problem: "the runtimes disagree or one stopped" });
});
