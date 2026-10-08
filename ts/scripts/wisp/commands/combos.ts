// `wisp combos [--fighter NAME]... [--jobs N]`: the combo explorer
// (smashcraft:ts/scripts/comboExplorer.ts, smashcraft:docs/design/balance.md,
// "Combo potential"). Measures each named fighter (every selectable one by
// default) against three opponent bodies at two stage positions, one worker
// thread per fighter, opponent and position; replays every opener's best
// route from its setup to check it deals the same damage; prints the table;
// writes every cell to smashcraft:tools/move-data/combos/ (Git ignores it)
// and the per-fighter measure, with each fighter's best routes, to
// smashcraft:tools/move-data/combo-potential.json and .md, which the balance
// score reads. Run locally it admits itself through the capacity helper.
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
import { admit } from "../../heavyCapacity";

const moveData = join(import.meta.dir, "../../../../tools/move-data");
const unitsFile = join(moveData, "combos/units.jsonl");
const summaryFile = join(moveData, "combo-potential.json");
const pageFile = join(moveData, "combo-potential.md");

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

/** Every unit on `jobs` scoped worker threads, in the order given. */
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

/** Each route replayed from its setup in a new match: the damage and the stock must match what the search recorded. */
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

/** The attacker's inputs as runs: "A ×1, — ×9, right+jump ×1". */
export function describeInputs(held: readonly number[]): string {
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

/** `combos [--fighter NAME]... [--jobs N]`. */
export const combos: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], options: { fighter: { type: "string", multiple: true }, jobs: { type: "string" } }, strict: true }).values,
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
