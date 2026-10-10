import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Schema } from "effect";
import { CPU_TIERS, isCpuTier } from "../src/game/match/cpuProfiles";
import { SELECTABLE_CHARACTERS, fighterSlug, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { FIELD_STAGES, moveName, playCpuMatch } from "./cpuField";
import { DEFAULT_CONFIG, FINDING_KINDS, classify, describeIssueAction, issueBody, planIssueActions, planMatches, renderReport, runPlaytest, shardRanges, shardsFor, type Config, type Finding, type MatchSpec, type Observation, type Play, type Run } from "./playtestCore";

const CHECKSUM_EVERY = 600;

const SpecSchema = Schema.Struct({ index: Schema.Finite, seed: Schema.Finite, a: Schema.String, b: Schema.String, stage: Schema.String, tier: Schema.String });
const FindingsSchema = Schema.Array(Schema.Struct({
  kind: Schema.Literals(FINDING_KINDS), subject: Schema.String, detail: Schema.String, spec: Schema.optional(SpecSchema), frame: Schema.optional(Schema.Finite),
}));
const OpenIssuesSchema = Schema.Array(Schema.Struct({ number: Schema.Finite, title: Schema.String }));
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const ObservationSchema = Schema.Struct({
  frames: Schema.Finite, ended: Schema.Boolean, winner: Schema.NullOr(Schema.Finite), timedOut: Schema.Boolean, stockLosses: Schema.Finite,
  strings: Schema.Array(Schema.Struct({ victim: Schema.Finite, frame: Schema.Finite, hits: Schema.Finite, damage: Schema.Finite })),
  checksums: Schema.Array(Schema.Tuple([Schema.Finite, Schema.String])),
  kos: Schema.Array(Schema.Struct({ fighter: Schema.String, move: Schema.String, count: Schema.Finite })),
});
const RunsSchema = Schema.Array(Schema.Struct({
  spec: SpecSchema,
  first: ObservationSchema, second: Schema.optional(ObservationSchema), wallMs: Schema.Finite,
}));
const readRuns = (file: string): Run[] => Schema.decodeUnknownSync(RunsSchema)(JSON.parse(readFileSync(file, "utf8"))).map((run) => ({ ...run, second: run.second }));

export const ROSTER = {
  fighters: SELECTABLE_CHARACTERS.map(fighterSlug),
  stages: Object.keys(FIELD_STAGES),
  tiers: CPU_TIERS.map((tier): string => tier),
};

export const playReal: Play = (spec: MatchSpec, frameCap: number): Observation => {
  const a = selectableCharacterBySlug(spec.a);
  const b = selectableCharacterBySlug(spec.b);
  if (a === undefined || b === undefined || !isCpuTier(spec.tier)) throw new Error(`cannot play ${spec.a} against ${spec.b} at ${spec.tier}`);
  const record = playCpuMatch(a, b, spec.stage, 0, { tiers: [spec.tier, spec.tier], frameCap, checksumEvery: CHECKSUM_EVERY }, spec.seed);
  if (record === undefined) throw new Error(`no spawn for ${spec.stage}`);
  const kos: { fighter: string; move: string; count: number }[] = [];
  for (const side of record.sides) {
    for (const [move, count] of Object.entries(side.kosByMove)) kos.push({ fighter: side.fighter, move: moveName(Number(move)), count });
  }
  return {
    frames: record.frames, ended: record.ended ?? false, winner: record.winner, timedOut: record.timedOut,
    stockLosses: record.sides[0].stockLosses.length + record.sides[1].stockLosses.length,
    strings: record.strings ?? [], checksums: record.checksums ?? [], kos,
  };
};

const configFrom = (values: Record<string, string | boolean | undefined>): Config => {
  const number = (key: string, fallback: number) => (values[key] === undefined ? fallback : Number(values[key]));
  return {
    frameCap: number("cap", DEFAULT_CONFIG.frameCap), minStringHits: number("min-string-hits", DEFAULT_CONFIG.minStringHits),
    winLow: number("win-low", DEFAULT_CONFIG.winLow), winHigh: number("win-high", DEFAULT_CONFIG.winHigh), minDecisive: number("min-decisive", DEFAULT_CONFIG.minDecisive),
    moveShareMax: number("move-share", DEFAULT_CONFIG.moveShareMax), minMoveKos: number("min-move-kos", DEFAULT_CONFIG.minMoveKos), minStageMatches: number("min-stage-matches", DEFAULT_CONFIG.minStageMatches),
  };
};

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      first: { type: "string" }, count: { type: "string" }, out: { type: "string" }, repro: { type: "string" }, "no-repeat": { type: "boolean" },
      merge: { type: "string" }, "report-dir": { type: "string" }, header: { type: "string" }, plan: { type: "string" }, "target-minutes": { type: "string" }, cores: { type: "string" }, "ms-per-match": { type: "string" }, "max-shards": { type: "string" },
      issues: { type: "string" }, "open-issues": { type: "string" }, "dry-run": { type: "boolean" },
      cap: { type: "string" }, "min-string-hits": { type: "string" }, "win-low": { type: "string" }, "win-high": { type: "string" }, "min-decisive": { type: "string" },
      "move-share": { type: "string" }, "min-move-kos": { type: "string" }, "min-stage-matches": { type: "string" },
    },
    strict: true,
  });
  const config = configFrom(values);
  if (values.plan !== undefined) {
    const total = Number(values.plan);
    // The account runs 20 jobs at once across every repository (docs/ci.md).
    const shards = Math.min(Number(values["max-shards"] ?? 8), shardsFor(total, Number(values["ms-per-match"] ?? 0), Number(values.cores ?? 4), Number(values["target-minutes"] ?? 20)));
    console.log(JSON.stringify(shardRanges(total, shards)));
  } else if (values.issues !== undefined) {
    const findings = Schema.decodeUnknownSync(FindingsSchema)(readJson(values.issues)).map(({ spec, frame, ...rest }): Finding => ({
      ...rest, ...(spec === undefined ? {} : { spec }), ...(frame === undefined ? {} : { frame }),
    }));
    const open = values["open-issues"] === undefined ? [] : Schema.decodeUnknownSync(OpenIssuesSchema)(readJson(values["open-issues"]));
    const actions = planIssueActions(findings, open, values.header ?? "");
    for (const action of actions) console.log(values["dry-run"] === true ? describeIssueAction(action) : JSON.stringify(action));
  } else if (values.merge !== undefined) {
    const runs: Run[] = values.merge.split(",").filter(Boolean).flatMap(readRuns);
    const findings = classify(runs, config);
    const header = values.header ?? "";
    const dir = values["report-dir"] ?? "playtest";
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "report.md"), `${renderReport(runs, findings, config, header)}\n`);
    writeFileSync(join(dir, "findings.json"), `${JSON.stringify(findings, null, 1)}\n`);
    for (const kind of FINDING_KINDS) writeFileSync(join(dir, `${kind}.md`), `${issueBody(kind, findings, header)}\n`);
    console.log(readFileSync(join(dir, "report.md"), "utf8"));
  } else {
    const specs = values.repro === undefined ? planMatches(ROSTER, Number(values.first ?? 0), Number(values.count ?? 40)) : planMatches(ROSTER, Number(values.repro), 1);
    const runs = runPlaytest(specs, playReal, config.frameCap, values["no-repeat"] !== true, () => performance.now());
    if (values.out !== undefined) writeFileSync(values.out, JSON.stringify(runs));
    else console.log(JSON.stringify(runs, null, 1));
    const ms = runs.reduce((sum, run) => sum + run.wallMs, 0);
    console.error(`${runs.length} matches, ${(ms / 1000).toFixed(1)} s, ${(ms / Math.max(1, runs.length)).toFixed(0)} ms a match`);
  }
}
