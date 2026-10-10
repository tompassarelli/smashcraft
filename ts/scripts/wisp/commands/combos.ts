









import { join } from "node:path";
import { parseArgs } from "node:util";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { Action } from "../../../src/game/input/actions";
import { playComboRoute } from "../../../src/game/match/comboRoute";
import { Character } from "../../../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../../../src/game/sim/heroes/registry";
import { type FighterSummary, MAX_CONVERSIONS, OPPONENTS, PERCENTS, POSITIONS, type RouteRecord, type UnitReport, fighterNamed, summarize } from "../../comboExplorer";
import { type AdvantageRow, TARGETS, advantagePage, unmet } from "../../advantageState";
import { admit } from "../../heavyCapacity";

const moveData = join(import.meta.dir, "../../../../tools/move-data");
const unitsFile = join(moveData, "combos/units.jsonl");
const summaryFile = join(moveData, "combo-potential.json");
const pageFile = join(moveData, "combo-potential.md");
const advantageFile = join(moveData, "advantage-state.jsonl");
const advantagePageFile = join(moveData, "advantage-state.md");

class CombosFailure extends Schema.TaggedError<CombosFailure>()("CombosFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const failure = (cause: unknown) => new CombosFailure({ problem: describeCause(cause) });

interface Unit {
  readonly attacker: number;
  readonly opponent: number;
  readonly position: (typeof POSITIONS)[number];
}

const ComboSetupSchema = Schema.Struct({
  stage: Schema.Finite, attacker: Schema.Enum(Character), defender: Schema.Enum(Character),
  attackerX: Schema.Finite, defenderX: Schema.Finite, facing: Schema.Finite,
  attackerZ: Schema.Finite, defenderZ: Schema.Finite, percent: Schema.Finite,
});
const DiSchema = Schema.Literals(["out", "up", "down", "in", "none"]);
const RouteRecordSchema = Schema.Struct({
  opener: Schema.String, percent: Schema.Finite, moves: Schema.Array(Schema.String),
  damage: Schema.Finite, ko: Schema.Boolean, di: DiSchema,
  route: Schema.Struct({ setup: ComboSetupSchema, held: Schema.Array(Schema.Finite) }),
});
const UnitReportSchema = Schema.Struct({
  attacker: Schema.String, opponent: Schema.String, position: Schema.Literals(POSITIONS),
  cells: Schema.Array(Schema.Struct({
    opener: Schema.String, percent: Schema.Finite, damage: Schema.Finite, ko: Schema.Boolean,
    hits: Schema.Finite, di: DiSchema, situation: Schema.Literals(["none", "tech chase", "ledge"]),
    moves: Schema.Array(Schema.String),
  })),
  killPercent: Schema.optionalKey(Schema.Finite),
  conversions: Schema.Array(Schema.Struct({
    percent: Schema.Finite, moves: Schema.Array(Schema.String), damage: Schema.Finite,
    hits: Schema.Finite, reads: Schema.Finite, ko: Schema.Boolean,
  })),
  kills: Schema.Boolean, routes: Schema.Array(RouteRecordSchema), frames: Schema.Finite,
});


const measureUnits = (units: readonly Unit[], jobs: number) => Effect.gen(function* () {
  let done = 0;
  const started = performance.now();
  return yield* Effect.forEach(units, (unit) => Effect.scoped(Effect.gen(function* () {
    const worker = yield* Effect.acquireRelease(
      Effect.sync(() => new Worker(new URL("../../comboExplorerWorker.ts", import.meta.url).href)),
      (thread) => Effect.sync(() => thread.terminate()),
    );
    const report = yield* Effect.callback<UnitReport, CombosFailure>((resume) => {
      worker.onmessage = (event: MessageEvent<UnitReport>) => resume(Effect.succeed(event.data));
      worker.onerror = (event) => resume(Effect.fail(failure(new Error(`${fighterName(unit.attacker)} on ${fighterName(unit.opponent)} at ${unit.position}: ${event.message}`))));
      worker.postMessage(unit);
    });
    done++;
    yield* Console.error(`combos: ${done}/${units.length} ${fighterName(unit.attacker)} on ${fighterName(unit.opponent)} at ${unit.position}, ${((performance.now() - started) / 1000).toFixed(0)} s`);
    return report;
  })), { concurrency: jobs });
});


function replayProblems(routes: readonly (RouteRecord & { readonly fighter: string; readonly opponent: string; readonly position: string })[]): string[] {
  const problems: string[] = [];
  for (const record of routes) {
    const played = playComboRoute(record.route);
    if (played.damage !== record.damage || (played.stocksLost > 0) !== record.ko) {
      problems.push(`${record.fighter} ${record.opener} at ${record.percent}% on ${record.opponent} (${record.position}): replay dealt ${played.damage}${played.stocksLost > 0 ? " and took the stock" : ""}, the search ${record.damage}${record.ko ? " and the stock" : ""}`);
    }
  }
  return problems;
}

const NAMES: Readonly<Record<number, string>> = {
  [Action.moveLeft]: "left", [Action.moveRight]: "right", [Action.moveDown]: "down", [Action.moveUp]: "up", [Action.jump]: "jump",
  [Action.attack]: "A", [Action.special]: "B", [Action.grab]: "Z", [Action.rightTrigger]: "R", [Action.smashLeft]: "C-left",
  [Action.smashRight]: "C-right", [Action.smashUp]: "C-up", [Action.smashDown]: "C-down", [Action.walk]: "walk",
};


function describeInputs(held: readonly number[]): string {
  const runs: string[] = [];
  for (let run = 0; run + 2 < held.length; run += 3) {
    const mask = held[run] ?? 0;
    const count = held[run + 2] ?? 0;
    const names = Object.entries(NAMES).filter(([bit]) => (mask & (1 << Number(bit))) !== 0).map(([, name]) => name);
    const text = names.length === 0 ? "—" : names.join("+");
    const last = runs.length - 1;
    const previous = runs[last];
    const match = previous?.match(/^(.*) ×(\d+)$/);
    if (match !== null && match !== undefined && match[1] === text) runs[last] = `${text} ×${Number(match[2]) + count}`;
    else runs.push(`${text} ×${count}`);
  }
  return runs.join(", ");
}

const number = (value: number): string => String(Math.round(value * 10) / 10);
const percentText = (value: number | undefined): string => (value === undefined ? `>${PERCENTS.at(-1)}%` : `${value}%`);
const openingsText = (summary: FighterSummary, value: number): string => `${number(value)}${summary.complete ? "" : "+"}`;

function table(summaries: readonly FighterSummary[]): string[] {
  return [
    "| Fighter | Max true combo | Typical punish | Kill confirm | Openings per kill | Multi-hit openings | With reads as openings | Damage per opening | Best route |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...summaries.map((summary) => `| ${summary.fighter} | ${number(summary.maxDamage)}% | ${number(summary.typicalDamage)}% | ${percentText(summary.killPercent)} | ${openingsText(summary, summary.openingsPerKill)} | ${openingsText(summary, summary.multiHitOpeningsPerKill)} | ${openingsText(summary, summary.openingsWithReads)} | ${number(summary.damagePerOpening)}% | ${summary.bestRoute === undefined ? "—" : `${summary.bestRoute.moves.join(" → ")} (${number(summary.bestRoute.damage)}% at ${summary.bestRoute.percent}%)`} |`),
  ];
}

function page(summaries: readonly FighterSummary[], units: readonly UnitReport[]): string {
  return [
    "# Combo potential", "",
    `Generated by \`bun wisp combos\`; do not edit. The measure is defined in [balance](../../docs/design/balance.md#combo-potential). Openers at ${PERCENTS[0]}–${PERCENTS.at(-1)}% in ${PERCENTS[1] - PERCENTS[0]}% steps, against ${OPPONENTS.map(fighterName).join(", ")} at the stage's centre and ledge, each against its escape-optimal DI; a "+" means a chain hadn't killed after ${MAX_CONVERSIONS} conversions.`, "",
    ...table(summaries), "",
    "## Best routes", "",
    "Each fighter's most damaging true combo and every opener's first kill, with the attacker's inputs frame by frame from the setup (A attack, B special, Z grab, R shield, C the attack stick).", "",
    ...summaries.flatMap((summary) => {
      const own = units.filter((unit) => unit.attacker === summary.fighter);
      const kills = own.flatMap((unit) => unit.routes.filter((route) => route.ko).map((route) => ({ unit, route })));
      const firstKills = summary.openers.flatMap((opener) => {
        const found = kills.filter(({ route }) => route.opener === opener.opener).sort((x, y) => x.route.percent - y.route.percent)[0];
        return found === undefined ? [] : [found];
      });
      const best = summary.bestRoute;
      return [
        `### ${summary.fighter}`, "",
        ...(best === undefined ? [] : [`- Most damage: ${best.moves.join(" → ")}, ${number(best.damage)}% from ${best.percent}% (DI ${best.di}). Inputs: ${describeInputs(best.route.held)}.`]),
        ...firstKills.map(({ unit, route }) => `- ${route.opener} kills ${unit.opponent} from ${route.percent}% at the ${unit.position}: ${route.moves.join(" → ")} (DI ${route.di}).`),
        "",
      ];
    }),
  ].join("\n");
}


const AdvantageRowSchema = Schema.Struct({
  fighter: Schema.String, target: Schema.Literals(["light", "medium", "heavy"]), opponent: Schema.String,
  throws: Schema.Array(Schema.Struct({
    opener: Schema.String, percent: Schema.Finite, withoutDi: Schema.Finite, withDi: Schema.Finite, withDiDamage: Schema.Finite,
    withDiMoves: Schema.Array(Schema.String), diMixup: Schema.optionalKey(Schema.Struct({ in: Schema.String, out: Schema.String })),
    knockdown: Schema.Boolean, ko: Schema.Boolean,
  })),
  techChase: Schema.optionalKey(Schema.Struct({
    opener: Schema.String, percent: Schema.Finite,
    covered: Schema.Array(Schema.Struct({ option: Schema.String, read: Schema.optionalKey(Schema.String) })),
    trap: Schema.optionalKey(Schema.Struct({ read: Schema.String, options: Schema.Array(Schema.String) })),
  })),
  juggle: Schema.optionalKey(Schema.Struct({ launcher: Schema.String, percent: Schema.Finite, relaunch: Schema.String, dis: Schema.Finite })),
  targets: Schema.Struct({ grabs: Schema.Boolean, techChasing: Schema.Boolean, juggling: Schema.Boolean, diMixups: Schema.Boolean, techTraps: Schema.Boolean }),
  zeroToDeath: Schema.Array(Schema.String),
});

const measureAdvantage = (attackers: readonly Character[], jobs: number) => Effect.gen(function* () {
  const units = attackers.flatMap((attacker) => TARGETS.map((_, target) => ({ attacker, target })));
  let done = 0;
  const started = performance.now();
  return yield* Effect.forEach(units, (unit) => Effect.scoped(Effect.gen(function* () {
    const worker = yield* Effect.acquireRelease(
      Effect.sync(() => new Worker(new URL("../../advantageStateWorker.ts", import.meta.url).href)),
      (thread) => Effect.sync(() => thread.terminate()),
    );
    const row = yield* Effect.callback<AdvantageRow, CombosFailure>((resume) => {
      worker.onmessage = (event: MessageEvent<AdvantageRow>) => resume(Effect.succeed(event.data));
      worker.onerror = (event) => resume(Effect.fail(failure(new Error(`${fighterName(unit.attacker)} advantage state: ${event.message}`))));
      worker.postMessage(unit);
    });
    done++;
    yield* Console.error(`combos: ${done}/${units.length} ${row.fighter} against the ${row.target} target, ${((performance.now() - started) / 1000).toFixed(0)} s`);
    return row;
  })), { concurrency: jobs });
});

const advantage = (attackers: readonly Character[], jobs: number, partial: boolean) => Effect.gen(function* () {
  const rows = yield* measureAdvantage(attackers, jobs).pipe(step(`${attackers.length * TARGETS.length} fighter and target advantage rows on ${jobs} threads`));
  const previous = yield* Effect.tryPromise({
    try: async () => !partial || !(await Bun.file(advantageFile).exists()) ? "" : await Bun.file(advantageFile).text(),
    catch: failure,
  });
  const decoded = yield* Effect.forEach(previous.split("\n").filter((line) => line !== ""),
    (line) => Schema.decodeEffect(Schema.fromJsonString(AdvantageRowSchema))(line).pipe(Effect.mapError(failure)));
  const kept: AdvantageRow[] = decoded.filter((row) => !rows.some((own) => own.fighter === row.fighter)).map((row) => ({
    ...row, juggle: row.juggle,
    throws: row.throws.map((cell) => ({ ...cell, diMixup: cell.diMixup })),
    techChase: row.techChase === undefined ? undefined : { ...row.techChase, trap: row.techChase.trap, covered: row.techChase.covered.map(({ option, read }) => ({ option, read })) },
  }));
  const order = SELECTABLE_CHARACTERS.map(fighterName);
  const weight = (row: AdvantageRow) => TARGETS.findIndex((target) => target.weight === row.target);
  const all = [...kept, ...rows].sort((x, y) => order.indexOf(x.fighter) - order.indexOf(y.fighter) || weight(x) - weight(y));
  yield* Effect.tryPromise({
    try: async () => {
      await Bun.write(advantageFile, all.map((row) => JSON.stringify(row)).join("\n") + "\n");
      await Bun.write(advantagePageFile, advantagePage(all) + "\n");
    },
    catch: failure,
  }).pipe(step("writing tools/move-data/advantage-state.jsonl and .md"));
  const misses = rows.flatMap((row) => unmet(row).map((problem) => `${row.fighter}: ${problem}`));
  yield* Console.log([`advantage state: ${rows.filter((row) => unmet(row).length === 0).length} of ${rows.length} fighter and target rows meet every target`, ...misses.map((miss) => `  ${miss}`)].join("\n"));
});

export const combos: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], options: { fighter: { type: "string", multiple: true }, jobs: { type: "string" }, advantage: { type: "boolean" } }, strict: true }).values,
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const names = parsed.fighter ?? [];
  const attackers = names.length === 0 ? SELECTABLE_CHARACTERS : names.map(fighterNamed);
  const unknown = names.filter((_, index) => attackers[index] === undefined);
  if (unknown.length > 0) return yield* new UsageFailure({ problem: `--fighter takes ${SELECTABLE_CHARACTERS.map(fighterName).join(", ")}; not ${unknown.join(", ")}` });
  const jobs = Number(parsed.jobs ?? "6");
  if (!Number.isInteger(jobs) || jobs < 1) return yield* new UsageFailure({ problem: "--jobs takes a whole number of worker threads" });
  const code = yield* admit("heavy", "smashcraft:combos", 3600);
  if (code !== undefined) {
    if (code !== 0) return yield* new CombosFailure({ problem: `the admitted run exited ${code}` });
    return;
  }
  if (parsed.advantage === true) return yield* advantage(attackers.filter((attacker): attacker is Character => attacker !== undefined), jobs, names.length > 0);
  const units: Unit[] = attackers.flatMap((attacker) => attacker === undefined ? [] : OPPONENTS.flatMap((opponent) => POSITIONS.map((position) => ({ attacker, opponent, position }))));
  const reports = yield* measureUnits(units, jobs).pipe(step(`${units.length} fighter, opponent and position cells on ${jobs} threads`));
  const summaries = [...new Set(reports.map((report) => report.attacker))].map((fighter) => summarize(fighter, reports.filter((report) => report.attacker === fighter)));
  const routes = reports.flatMap((report) => report.routes.map((route) => ({ ...route, fighter: report.attacker, opponent: report.opponent, position: report.position })));
  const problems = yield* Effect.sync(() => replayProblems(routes)).pipe(step(`replaying ${routes.length} routes from their setups`));
  const previous = yield* Effect.tryPromise({
    try: async () => names.length === 0 || !(await Bun.file(unitsFile).exists()) ? "" : await Bun.file(unitsFile).text(),
    catch: failure,
  });
  const decoded = yield* Effect.forEach(previous.split("\n").filter(line => line !== ""),
    line => Schema.decodeEffect(Schema.fromJsonString(UnitReportSchema))(line).pipe(Effect.mapError(failure)));
  const kept: UnitReport[] = decoded.filter(unit => !summaries.some(summary => summary.fighter === unit.attacker)).map(unit => ({ ...unit, killPercent: unit.killPercent }));
  yield* Effect.tryPromise({
    try: async () => {
      const allUnits = [...kept, ...reports];
      await Bun.write(unitsFile, allUnits.map((unit) => JSON.stringify(unit)).join("\n") + "\n");
      const all = [...new Set(allUnits.map((unit) => unit.attacker))].map((fighter) => summarize(fighter, allUnits.filter((unit) => unit.attacker === fighter)));
      const order = SELECTABLE_CHARACTERS.map(fighterName);
      all.sort((x, y) => order.indexOf(x.fighter) - order.indexOf(y.fighter));
      const compact = Object.fromEntries(all.map((summary) => [summary.fighter, {
        openingsPerKill: summary.openingsPerKill, multiHitOpeningsPerKill: summary.multiHitOpeningsPerKill, openingsWithReads: summary.openingsWithReads,
        killPercent: summary.killPercent ?? null, maxDamage: summary.maxDamage, typicalDamage: summary.typicalDamage, damagePerOpening: summary.damagePerOpening, complete: summary.complete,
        openers: summary.openers.map((opener) => ({ ...opener, killPercent: opener.killPercent ?? null })),
      }]));
      await Bun.write(summaryFile, JSON.stringify({ measure: "docs/design/balance.md#combo-potential", fighters: compact }, null, 2) + "\n");
      await Bun.write(pageFile, page(all, allUnits) + "\n");
    },
    catch: failure,
  }).pipe(step("writing tools/move-data/combo-potential.json and .md"));
  yield* Console.log([...table(summaries), "", `route replay: ${routes.length - problems.length} of ${routes.length} routes reproduce their damage from a new match`, ...problems.map((problem) => `  ${problem}`)].join("\n"));
  if (problems.length > 0) return yield* new CombosFailure({ problem: `${problems.length} routes replayed to a different result` });
});
