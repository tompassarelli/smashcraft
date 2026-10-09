import { join, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { runProcess } from "../../hostProcess";
import { decodePpm, encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { frameStamp } from "../../nativeCapture";
import { projectRoot } from "../project";
const Line = Schema.Struct({ name: Schema.NonEmptyString, metric: Schema.Literals(["pixels", "stamp", "contrast"]), frames: Schema.Array(Schema.Int), baseline: Schema.optionalKey(Schema.Int), region: Schema.optionalKey(Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite, Schema.Finite])), min: Schema.optionalKey(Schema.Finite), max: Schema.optionalKey(Schema.Finite), tolerance: Schema.optionalKey(Schema.Finite), borderline: Schema.optionalKey(Schema.Finite), mask: Schema.optionalKey(Schema.NonEmptyString), field: Schema.optionalKey(Schema.Literals(["absDL", "dE00", "localDL"])) });
interface Sample { readonly frame: number; readonly value: number; readonly stamped: boolean }
interface LineResult { readonly name: string; readonly metric: string; readonly pass: boolean; readonly needsLook: boolean; readonly value: number; readonly samples: readonly Sample[]; readonly crops: readonly string[] }
interface CaseResult { readonly name: string; readonly pass: boolean; readonly lines: readonly LineResult[] }
const Rubric = Schema.fromJsonString(Schema.Struct({ cases: Schema.Array(Schema.Struct({ name: Schema.NonEmptyString, fixture: Schema.NonEmptyString, script: Schema.Int, lines: Schema.Array(Line) })) }));
class JudgeFailure extends Schema.TaggedError<JudgeFailure>()("JudgeFailure", { problem: Schema.String }) { override get message(): string { return this.problem; } }
const attempt = <A>(problem: string, run: () => Promise<A>) => Effect.tryPromise({ try: run, catch: cause => new JudgeFailure({ problem: `${problem}: ${String(cause)}` }) });
const load = (path: string) => attempt(`read ${path}`, async () => { const frame = decodePpm(await Bun.file(path).bytes()); if (frame === undefined || frame.width <= 0 || frame.height <= 0) throw new Error("not an RGB PPM capture"); return frame; });
function bounds(frame: Frame, region: readonly number[]) { const [left = 0, top = 0, right = 1, bottom = 1] = region; if (left < 0 || top < 0 || right > 1 || bottom > 1 || left >= right || top >= bottom) throw new Error("region must be left,top,right,bottom fractions within 0..1"); return [Math.floor(left * frame.width), Math.floor(top * frame.height), Math.floor(right * frame.width), Math.floor(bottom * frame.height)] as const; }
export function changedPixels(frame: Frame, baseline: Frame, region: readonly number[], tolerance: number): number {
  if (frame.width !== baseline.width || frame.height !== baseline.height) throw new Error("capture dimensions differ");
  const [left, top, right, bottom] = bounds(frame, region); let count = 0;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) { const i = (y * frame.width + x) * 3; if ([0, 1, 2].some(channel => Math.abs((frame.rgb[i + channel] ?? 0) - (baseline.rgb[i + channel] ?? 0)) > tolerance)) count++; }
  return count;
}
function crop(frame: Frame, region: readonly number[]): Frame { const [left, top, right, bottom] = bounds(frame, region); const width = right - left, height = bottom - top, rgb = new Uint8Array(width * height * 3); for (let y = 0; y < height; y++) rgb.set(frame.rgb.subarray(((top + y) * frame.width + left) * 3, ((top + y) * frame.width + right) * 3), y * width * 3); return { width, height, rgb }; }
export const judge: Command = args => Effect.gen(function* () {
  const [directory, flag, rubricPath, ...extra] = args;
  if (directory === undefined || flag !== "--rubric" || rubricPath === undefined || extra.length > 0) return yield* new UsageFailure({ problem: "judge DIR --rubric FILE" });
  const rubric = yield* attempt("decode rubric", async () => Schema.decodeSync(Rubric)(await Bun.file(rubricPath).text()));
  const cases: CaseResult[] = [], model = new Set<string>(), captures = new Set<string>();
  for (const entry of rubric.cases) {
    if (entry.lines.length === 0) return yield* new JudgeFailure({ problem: `${entry.name}: no rubric lines` });
    const lines: LineResult[] = [];
    for (const line of entry.lines) {
      if (line.frames.length === 0 || (line.metric !== "stamp" && line.min === undefined && line.max === undefined)) return yield* new JudgeFailure({ problem: `${entry.name}/${line.name}: frames and a measurement threshold are required` });
      const samples: Sample[] = []; let valid = true; let baseline: Frame | undefined;
      if (line.metric === "pixels") {
        if (line.baseline === undefined) return yield* new JudgeFailure({ problem: `${entry.name}/${line.name}: pixels requires baseline` });
        const file = join(directory, entry.fixture, `frame-${line.baseline}.ppm`); baseline = yield* load(file); captures.add(file);
        const stamp = frameStamp(baseline); valid = stamp?.frame === line.baseline && stamp.script === entry.script;
      }
      for (const frameNumber of line.frames) {
        const file = join(directory, entry.fixture, `frame-${frameNumber}.ppm`); captures.add(file);
        const frame = yield* load(file), stamp = frameStamp(frame); const stamped = stamp?.frame === frameNumber && stamp.script === entry.script; valid &&= stamped;
        let value = stamped ? 1 : 0;
        if (line.metric === "pixels" && baseline !== undefined) {
          const reference = baseline;
          value = yield* Effect.try({ try: () => changedPixels(frame, reference, line.region ?? [0, 0, 1, 1], line.tolerance ?? 20), catch: cause => new JudgeFailure({ problem: String(cause) }) });
        }
        if (line.metric === "contrast") {
          if (line.mask === undefined) return yield* new JudgeFailure({ problem: `${entry.name}/${line.name}: contrast requires mask` });
          const output = yield* runProcess(ChildProcess.make(process.execPath, [join(projectRoot, "tools/stage/contrast.ts"), resolve(directory, line.mask), file]));
          const header = output.split("\n").find(row => row.startsWith("frame\t"))?.split("\t"), row = output.trim().split("\n").at(-1)?.split("\t");
          value = Number(row?.[header?.indexOf(line.field ?? "absDL") ?? -1]);
          if (!Number.isFinite(value)) return yield* new JudgeFailure({ problem: `${file}: contrast reader returned no ${line.field ?? "absDL"}` });
        }
        samples.push({ frame: frameNumber, value, stamped });
      }

      const value = Math.max(...samples.map(sample => sample.value)); const pass = valid && value >= (line.min ?? -Infinity) && value <= (line.max ?? Infinity);
      const margin = line.borderline ?? 0; const borderline = valid && margin > 0 && [line.min, line.max].some(limit => limit !== undefined && Math.abs(value - limit) <= margin); const crops = [];
      if (borderline) for (const sample of samples.filter(sample => sample.value === value)) {
        const original = join(directory, entry.fixture, `frame-${sample.frame}.ppm`), output = join(directory, "judge-crops", `${rubric.cases.indexOf(entry)}-${entry.lines.indexOf(line)}-${sample.frame}.ppm`); const frame = yield* load(original);
        yield* Effect.try({ try: () => { mkdirSync(join(directory, "judge-crops"), { recursive: true }); writeFileSync(output, encodePpm(crop(frame, line.region ?? [0, 0, 1, 1]))); }, catch: cause => new JudgeFailure({ problem: String(cause) }) });
        model.add(original); crops.push(output);
      }
      lines.push({ name: line.name, metric: line.metric, pass, needsLook: borderline, value, samples, crops });
    }
    const pass = lines.every(line => line.pass); cases.push({ name: entry.name, pass, lines });
    yield* Console.log(`${pass ? "PASS" : "FAIL"} ${entry.name}: ${lines.map(line => `${line.name}=${line.value}${line.needsLook ? " (borderline)" : ""}`).join(", ")}`);
  }
  const summary = { cases: cases.length, pass: cases.filter(entry => entry.pass).length, fail: cases.filter(entry => !entry.pass).length, measuredCaptures: captures.size, modelCaptures: model.size };
  yield* attempt("write judge.json", () => Bun.write(join(directory, "judge.json"), `${JSON.stringify({ summary, cases, modelCrops: cases.flatMap(entry => entry.lines.flatMap(line => line.crops)) }, null, 2)}\n`));
  yield* Console.log(`${summary.pass} pass, ${summary.fail} fail; model reads ${model.size}/${captures.size} measured captures; ${join(directory, "judge.json")}`);
}).pipe(Effect.provide(BunServices.layer));
