// One-client native captures of pad scripts (clone-a and other single signed-in clients):
//   bun scripts/nativeCapture.ts build --out MAP.w3x [--name NAME] [--control] [PAD|DIR...]
//     bakes the scripts and their `capture` frames into a native-capture map
//     (smashcraft:ts/src/platform/nativeCaptureMain.ts) and writes MAP.captures.json;
//     --control plays the control fixtures (smashcraft:ts/src/platform/captureFixtures.ts)
//     first, and with no scripts the map plays only them;
//   bun scripts/nativeCapture.ts plan PAD|DIR...
//     plays the scripts headlessly on the capture map's schedule and checks each
//     `#! cue` line against the held frames (smashcraft:ts/scripts/nativeCapturePlan.ts);
//   bun scripts/nativeCapture.ts run --clients-file FILE --client NAME --manifest MAP.captures.json --out DIR [--audio-sink SINK | --no-audio]
//     with that map hosted on the client (`bun wisp fresh MAP --no-quick`), keeps
//     capturing the screen and saves each capture whose drawn stamp names a
//     requested fixture and frame (smashcraft:ts/src/runtime/drawnStamp.ts) as
//     DIR/FIXTURE/frame-N.ppm; every capture's stamp is logged in DIR/captures.json;
//     meanwhile it records the client's own PipeWire sink (`wisp-online-NAME`,
//     wisp:docs/lan.md) to DIR/audio.wav, its start on the same clock as each
//     capture's `ms` and `capturedMs`;
//   bun scripts/nativeCapture.ts compare DIR FIXTURE OTHER
//     prints, per shared frame, how far the two fixtures' captures differ, and
//     how far each fixture's first and last captures differ.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";
import { capture, loadClients } from "wisp/scripts/warcraft/desktop";
import { type Frame, decodePpm, encodePpm } from "wisp/scripts/wisp/frameProbe";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { dataDirectory } from "wisp/scripts/wisp/gameFiles";
import { parsePadScript } from "./integrity/padScript";
import { STAMP_CELL, STAMP_CELLS, type StampCell, readStamp } from "../src/runtime/drawnStamp";
import { CAPTURE_STATUS_FILE } from "../src/runtime/gameFiles";
import { CAPTURE_FIXTURES, type CaptureFixture } from "../src/platform/captureFixtures";

class CaptureFailure extends Schema.TaggedError<CaptureFailure>()("CaptureFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}
const fail = (problem: string): never => { throw new CaptureFailure({ problem }); };
const attempt = <A>(operation: string, run: () => A) => Effect.try({ try: run, catch: cause => new CaptureFailure({ problem: `${operation}: ${String(cause)}` }) });

const FIXTURES_MODULE = join(import.meta.dir, "../src/platform/captureFixtures.ts");

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
/** Flags that take no value. */
const SWITCHES = new Set(["--control", "--no-audio"]);
const positional = (args: readonly string[]) => args.filter((value, index) => !value.startsWith("--") && !(args[index - 1]?.startsWith("--") === true && !SWITCHES.has(args[index - 1] ?? "")));

/** A pad script's capture frames, once each, in order. Chat lines are the native driver's own, so other lines go through the pad parser. */
export function fixtureOf(path: string, script: string): CaptureFixture {
  const chat = /^\s*\S+\s+[ab]\s+chat\s/;
  const lines = script.split("\n");
  if (lines.some(line => chat.test(line) && line.trim().startsWith("+"))) fail(`${path}: a chat line needs an absolute frame`);
  const frames = [...new Set(parsePadScript(lines.filter(line => !chat.test(line)).join("\n")).filter(step => step.kind === "capture").map(step => step.frame))].sort((a, b) => a - b);
  if (frames.length === 0) fail(`${path}: no capture lines`);
  if (frames[0] === 0) fail(`${path}: a capture at frame 0 can't be held`);
  const folder = basename(dirname(path));
  return { name: folder === "pads" || folder === "captures" ? basename(path, ".pad") : `${folder}-${basename(path, ".pad")}`, frames, script };
}

const build = (args: readonly string[]) => Effect.gen(function*() {
  const out = option(args, "--out");
  const name = option(args, "--name") ?? "Smashcraft native capture";
  const pads = positional(args).flatMap(path => statSync(path).isDirectory() ? readdirSync(path).filter(file => file.endsWith(".pad")).sort().map(file => join(path, file)) : [path]);
  if (out === undefined) return yield* new CaptureFailure({ problem: "usage: build --out MAP.w3x [--name NAME] [PAD|DIR...]; without scripts it builds the control" });
  // Without scripts the checked-in control fixtures are built as they are; --control runs them before the scripts.
  const scripts = yield* attempt("read pad scripts", () => pads.map(path => fixtureOf(path, readFileSync(path, "utf8"))));
  const fixtures = pads.length === 0 ? CAPTURE_FIXTURES : args.includes("--control") ? [...CAPTURE_FIXTURES, ...scripts] : scripts;
  if (new Set(fixtures.map(fixture => fixture.name)).size !== fixtures.length) return yield* new CaptureFailure({ problem: "two pad scripts share a fixture name" });
  if (fixtures.length >= 64) return yield* new CaptureFailure({ problem: "a capture map holds at most 63 scripts; split the batch" });
  const original = yield* attempt("read the checked-in fixtures", () => readFileSync(FIXTURES_MODULE, "utf8"));
  const generated = pads.length === 0 ? original : `${original.slice(0, original.indexOf("const WALK"))}export const CAPTURE_FIXTURES: readonly CaptureFixture[] = ${JSON.stringify(fixtures, null, 2)};\n`;
  const code = yield* Effect.acquireUseRelease(
    attempt("write this build's fixtures", () => writeFileSync(FIXTURES_MODULE, generated)),
    () => Effect.tryPromise({
      try: () => Bun.spawn(["bun", "scripts/wisp.ts", "map", "build", "--profile", "native-capture", "--name", name, "--out", out], { cwd: join(import.meta.dir, ".."), stdout: "inherit", stderr: "inherit" }).exited,
      catch: cause => new CaptureFailure({ problem: `map build: ${String(cause)}` }),
    }),
    () => Effect.sync(() => writeFileSync(FIXTURES_MODULE, original)),
  );
  if (code !== 0) return yield* new CaptureFailure({ problem: `map build exited ${code}` });
  const manifest = `${out.replace(/\.w3x$/, "")}.captures.json`;
  yield* attempt("write the manifest", () => writeFileSync(manifest, `${JSON.stringify({ map: out, fixtures: fixtures.map(({ name: fixture, frames }) => ({ name: fixture, frames })) }, null, 2)}\n`));
  console.log(`built ${out}: ${fixtures.length} scripts, ${fixtures.reduce((total, fixture) => total + fixture.frames.length, 0)} captures; manifest ${manifest}`);
});

/** The color class of a stamp cell's centre patch: red one, blue zero, green guard. */
function cellAt(frame: Frame, x: number, y: number): StampCell | "unclear" {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const px = Math.round(x) + dx;
    const py = Math.round(y) + dy;
    if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) return "unclear";
    const offset = (py * frame.width + px) * 3;
    red += frame.rgb[offset] ?? 0;
    green += frame.rgb[offset + 1] ?? 0;
    blue += frame.rgb[offset + 2] ?? 0;
    count++;
  }
  red /= count; green /= count; blue /= count;
  if (red > 140 && green < 90 && blue < 90) return "one";
  if (blue > 140 && red < 90) return "zero";
  if (green > 120 && red < 110 && blue < 90) return "guard";
  return "unclear";
}

/** The stamp's cells sit along the top of the 4:3 UI area, centred in the frame. */
export function frameStamp(frame: Frame): { readonly script: number; readonly frame: number } | undefined {
  const scale = frame.height / 0.6;
  const left = (frame.width - 0.8 * scale) / 2;
  const cells: (StampCell | "unclear")[] = [];
  for (let index = 0; index < STAMP_CELLS; index++) cells.push(cellAt(frame, left + (index + 0.5) * STAMP_CELL * scale, 0.5 * STAMP_CELL * scale));
  return readStamp(cells);
}

const Manifest = Schema.fromJsonString(Schema.Struct({ map: Schema.String, fixtures: Schema.Array(Schema.Struct({ name: Schema.String, frames: Schema.Array(Schema.Finite) })) }));

const PipeWireObjects = Schema.fromJsonString(Schema.Array(Schema.Struct({
  id: Schema.Finite,
  type: Schema.String,
  info: Schema.optional(Schema.NullOr(Schema.Struct({
    props: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
    "input-node-id": Schema.optional(Schema.Finite),
  }))),
})));

/** The sink's serial: a stopped client's sink can linger beside its new one, so the one a stream plays into wins, else the newest. */
const sinkSerial = (sink: string) => Effect.gen(function*() {
  const dump = yield* runProcess(ChildProcess.make("pw-dump", [])).pipe(Effect.mapError(failure => new CaptureFailure({ problem: failure.message })));
  const objects = yield* Schema.decodeEffect(PipeWireObjects)(dump).pipe(Effect.mapError(cause => new CaptureFailure({ problem: `pw-dump: ${String(cause)}` })));
  const fed = new Set(objects.filter(row => row.type === "PipeWire:Interface:Link").map(row => row.info?.["input-node-id"]));
  const sinks = objects.filter(row => row.type === "PipeWire:Interface:Node" && row.info?.props?.["node.name"] === sink && row.info.props["media.class"] === "Audio/Sink")
    .map(row => ({ fed: fed.has(row.id), serial: Number(row.info?.props?.["object.serial"]) }))
    .sort((a, b) => Number(b.fed) - Number(a.fed) || b.serial - a.serial);
  const chosen = sinks[0];
  if (chosen === undefined || !Number.isInteger(chosen.serial)) return yield* new CaptureFailure({ problem: `no PipeWire sink ${sink}; pass --audio-sink SINK or --no-audio` });
  return chosen;
});

/** Records the sink until the run's scope closes; SIGINT lets pw-record finish the WAV header. */
const recordAudio = (sink: string, file: string, started: number) => Effect.gen(function*() {
  const chosen = yield* sinkSerial(sink);
  const startedMs = Date.now() - started;
  yield* ChildProcess.make("pw-record", ["--target", String(chosen.serial), "-P", "{ stream.capture.sink=true }", "--rate", "48000", "--channels", "2", "--format", "s16", file], { stdin: "ignore", stdout: "ignore", stderr: "inherit", killSignal: "SIGINT", forceKillAfter: "3 seconds" })
    .pipe(Effect.mapError(cause => new CaptureFailure({ problem: `pw-record: ${cause.message}` })));
  console.log(`recording ${sink} (serial ${chosen.serial}${chosen.fed ? ", playing" : ", silent so far"}) to ${file}`);
  return { file: basename(file), sink, serial: chosen.serial, startedMs };
});

const runCaptures = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const clientsFile = option(args, "--clients-file");
  const clientName = option(args, "--client");
  const manifestPath = option(args, "--manifest");
  const out = option(args, "--out");
  const minutes = Number(option(args, "--minutes") ?? "60");
  if (clientsFile === undefined || clientName === undefined || manifestPath === undefined || out === undefined) return yield* new CaptureFailure({ problem: "usage: run --clients-file FILE --client NAME --manifest MAP.captures.json --out DIR [--minutes M] [--audio-sink SINK | --no-audio]" });
  const text = yield* attempt("read the manifest", () => readFileSync(manifestPath, "utf8"));
  const manifest = yield* Schema.decodeEffect(Manifest)(text).pipe(Effect.mapError(cause => new CaptureFailure({ problem: `${manifestPath}: ${String(cause)}` })));
  const client = (yield* loadClients(clientsFile).pipe(Effect.mapError(failure => new CaptureFailure({ problem: `${failure.operation}: ${failure.cause}` })))).find(row => row.name === clientName);
  if (client === undefined) return yield* new CaptureFailure({ problem: `${clientName} isn't in ${clientsFile}` });
  yield* attempt("create the result folder", () => mkdirSync(out, { recursive: true }));
  const statusPath = join(dataDirectory(client.documents), CAPTURE_STATUS_FILE);
  const started = Date.now();
  const audio = args.includes("--no-audio") ? undefined : yield* recordAudio(option(args, "--audio-sink") ?? `wisp-online-${client.name}`, join(out, "audio.wav"), started);
  const wanted = manifest.fixtures.reduce((total, fixture) => total + fixture.frames.length, 0);
  const saved = new Map<string, { fixture: string; frame: number; file: string; capturedMs: number }>();
  const log: { ms: number; captureMs: number; stamp: string }[] = [];
  let lastScript = 0;
  let idleSince = Date.now();
  let lastStatus = "";
  while (saved.size < wanted && Date.now() - started < minutes * 60000) {
    const status = existsSync(statusPath) && statSync(statusPath).mtimeMs >= started ? preloadLines(readFileSync(statusPath, "latin1"))?.[0] ?? "" : "";
    if (status !== lastStatus) { lastStatus = status; console.log(status); }
    const before = Date.now();
    const shot = yield* capture(client).pipe(Effect.mapError(failure => new CaptureFailure({ problem: `${failure.operation}: ${failure.cause}` })));
    const stamp = frameStamp(shot);
    log.push({ ms: before - started, captureMs: Date.now() - before, stamp: stamp === undefined ? "unreadable" : `${stamp.script}/${stamp.frame}` });
    const fixture = stamp === undefined ? undefined : manifest.fixtures[stamp.script - 1];
    if (stamp !== undefined && stamp.script > lastScript) { lastScript = stamp.script; idleSince = Date.now(); }
    if (stamp !== undefined && fixture !== undefined && fixture.frames.includes(stamp.frame) && !saved.has(`${fixture.name}/${stamp.frame}`)) {
      const file = join(fixture.name, `frame-${stamp.frame}.ppm`);
      yield* attempt("save the capture", () => {
        mkdirSync(join(out, fixture.name), { recursive: true });
        writeFileSync(join(out, file), encodePpm(shot));
      });
      saved.set(`${fixture.name}/${stamp.frame}`, { fixture: fixture.name, frame: stamp.frame, file, capturedMs: before - started });
      idleSince = Date.now();
      console.log(`captured ${fixture.name} ${stamp.frame} (${saved.size}/${wanted})`);
    }
    if (lastScript >= manifest.fixtures.length && Date.now() - idleSince > 30000) break;
  }
  const missed = manifest.fixtures.flatMap(fixture => fixture.frames.filter(frame => !saved.has(`${fixture.name}/${frame}`)).map(frame => ({ fixture: fixture.name, frame })));
  const result = { map: manifest.map, captured: saved.size, wanted, missed, audio, captures: [...saved.values()], log };
  yield* attempt("write captures.json", () => writeFileSync(join(out, "captures.json"), `${JSON.stringify(result, null, 1)}\n`));
  const unreadable = log.filter(row => row.stamp === "unreadable").length;
  console.log(JSON.stringify({ captured: saved.size, wanted, missed: missed.length, screenCaptures: log.length, unreadable, medianCaptureMs: [...log.map(row => row.captureMs)].sort((a, b) => a - b)[Math.floor(log.length / 2)] ?? 0 }));
  if (missed.length > 0) return yield* new CaptureFailure({ problem: `missed ${missed.map(row => `${row.fixture}@${row.frame}`).join(", ")}` });
}));

const plan = (args: readonly string[]) => Effect.gen(function*() {
  const pads = positional(args).flatMap(path => statSync(path).isDirectory() ? readdirSync(path).filter(file => file.endsWith(".pad")).sort().map(file => join(path, file)) : [path]);
  if (pads.length === 0) return yield* new CaptureFailure({ problem: "usage: plan PAD|DIR..." });
  const fixtures = yield* attempt("read pad scripts", () => pads.map(path => fixtureOf(path, readFileSync(path, "utf8"))));
  const { planFixture } = yield* Effect.promise(() => import("./nativeCapturePlan"));
  let cues = 0;
  let passed = 0;
  for (const fixture of fixtures) {
    const row = yield* planFixture(fixture).pipe(Effect.mapError(failure => new CaptureFailure({ problem: failure.problem })));
    cues += row.cues;
    passed += row.passed;
  }
  console.log(`plan: ${passed}/${cues} cues shown on a capture frame, ${fixtures.length} scripts`);
  if (passed !== cues) return yield* new CaptureFailure({ problem: `${cues - passed} cues aren't shown on a capture frame` });
});

/** Root-mean-square difference of two captures over the frame, on a 0..1 scale, skipping the stamp row. */
export function rmse(a: Frame, b: Frame): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  const skip = Math.ceil(STAMP_CELL * (a.height / 0.6)) + 2;
  let total = 0;
  let count = 0;
  for (let y = skip; y < a.height; y += 2) for (let x = 0; x < a.width; x += 2) {
    const offset = (y * a.width + x) * 3;
    for (let channel = 0; channel < 3; channel++) {
      const difference = ((a.rgb[offset + channel] ?? 0) - (b.rgb[offset + channel] ?? 0)) / 255;
      total += difference * difference;
      count++;
    }
  }
  return Math.sqrt(total / count);
}

const compare = (args: readonly string[]) => Effect.gen(function*() {
  const [directory, first, second] = positional(args);
  if (directory === undefined || first === undefined || second === undefined) return yield* new CaptureFailure({ problem: "usage: compare DIR FIXTURE OTHER" });
  const frames = (fixture: string) => readdirSync(join(directory, fixture)).map(file => /^frame-(\d+)\.ppm$/.exec(file)?.[1]).filter((value): value is string => value !== undefined).map(Number).sort((a, b) => a - b);
  const load = (fixture: string, frame: number) => decodePpm(readFileSync(join(directory, fixture, `frame-${frame}.ppm`))) ?? fail(`${fixture} frame ${frame} isn't a PPM image`);
  const rows = yield* attempt("compare captures", () => {
    const shared = frames(first).filter(frame => frames(second).includes(frame));
    const twin = shared.map(frame => ({ frame, rmse: rmse(load(first, frame), load(second, frame)) }));
    const spread = [first, second].map(fixture => {
      const own = frames(fixture);
      return { fixture, from: own[0], to: own.at(-1), rmse: rmse(load(fixture, own[0] ?? 0), load(fixture, own.at(-1) ?? 0)) };
    });
    return { twin, spread };
  });
  for (const row of rows.twin) console.log(`frame ${row.frame}: ${first} vs ${second} rmse ${row.rmse.toFixed(4)}`);
  for (const row of rows.spread) console.log(`${row.fixture}: frame ${row.from} vs ${row.to} rmse ${row.rmse.toFixed(4)}`);
});

if (import.meta.main) {
  const [verb, ...args] = Bun.argv.slice(2);
  const program = verb === "build" ? build(args) : verb === "plan" ? plan(args) : verb === "run" ? runCaptures(args) : verb === "compare" ? compare(args) : Effect.fail(new CaptureFailure({ problem: "usage: nativeCapture.ts build|plan|run|compare ..." }));
  BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
}
