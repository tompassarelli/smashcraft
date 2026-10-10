




import { DownState } from "../src/game/sim/codes";
import { canAttack } from "../src/game/sim/conditions";
import { fighterAt } from "../src/game/sim/roster";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { type FighterEntry, type Move, VICTIM_CHOICES, comboRow, openingState } from "./comboTrees";
import { Timeline } from "./interactions";


const ROLE_PERCENTS: readonly number[] = [0, 30, 60];

const REPORT_PERCENTS: readonly number[] = [...ROLE_PERCENTS, 90];
const UP_THROW: Move = { name: "up throw", throw: "up" };
const DOWN_THROW: Move = { name: "down throw", throw: "down" };
const TECH_OPTIONS = ["tech in place", "tech left", "tech right", "missed tech"] as const;
const DI_NAMES = [...new Set(VICTIM_CHOICES.map((choice) => choice.di.name))];
const HORIZON = 120;

export const THROW_FIGHTERS: readonly FighterEntry[] = SELECTABLE_CHARACTERS.map((character) => {
  const name = fighterName(character);
  return { character, name, slug: name.toLowerCase().replaceAll(" ", "-") };
});

export const throwFighterNamed = (name: string): FighterEntry | undefined =>
  THROW_FIGHTERS.find((entry) => entry.name.toLowerCase() === name.toLowerCase() || entry.slug === name.toLowerCase());

interface UpThrowRow {
  readonly kind: "up throw";
  readonly fighter: string;
  readonly percent: number;
  readonly guaranteedFollowups: number;
  readonly string: readonly string[];
  readonly guaranteedDamage: number;
  readonly problems: readonly string[];
}


interface Landing {
  readonly di: string;

  readonly tumbles: boolean;

  readonly actsFirst: boolean;
  readonly frame: number | undefined;
}

interface DownThrowRow {
  readonly kind: "down throw";
  readonly fighter: string;
  readonly percent: number;
  readonly guaranteedFollowups: number;

  readonly forcedTech: number;
  readonly landingFrames: readonly number[];

  readonly coverage: readonly { readonly option: string; readonly uncovered: readonly string[]; readonly best: readonly string[] }[];
  readonly problems: readonly string[];
}

export type ThrowRoleRow = UpThrowRow | DownThrowRow;

function landing(entry: FighterEntry, percent: number, di: (typeof VICTIM_CHOICES)[number]["di"]): Landing {
  const root = openingState(entry, DOWN_THROW, percent, di);
  if (root === undefined) throw new Error(`${entry.name}'s down throw does not land`);
  const line = new Timeline({
    placements: [{ character: entry.character, x: 0, facing: 1 }, { character: entry.character, x: 40, facing: -1 }],
    initial: root.state, previous: root.previous, policies: [() => [], () => []],
  }, HORIZON, "first");
  let tumbles = false;
  let actsFirst = false;
  let frame: number | undefined;
  let wasTumbling = fighterAt(root.state.world, 1).down.state === DownState.tumble;
  line.play([[], []], HORIZON, (n, _a, b) => {
    if (b.motion.grounded || b.down.state === DownState.bound || b.down.state === DownState.tech) {
      tumbles = wasTumbling;
      frame = n;
      return true;
    }
    if (canAttack(b)) actsFirst = true;
    wasTumbling = b.down.state === DownState.tumble;
    return false;
  }, true);
  line.release();
  return { di: di.name, tumbles, actsFirst, frame };
}

function upThrowRow(entry: FighterEntry, percent: number): UpThrowRow {
  const row = comboRow(entry, UP_THROW, percent, false);
  const role = ROLE_PERCENTS.includes(percent);
  const problems = [
    ...(!row.openingLands ? ["the up throw does not land"] : []),
    ...(role && row.guaranteed.followups < 1 ? ["no guaranteed follow-up at low to mid percent"] : []),
    ...(row.guaranteed.followups > 2 ? ["more than 2 guaranteed follow-ups"] : []),
  ];
  return { kind: "up throw", fighter: entry.name, percent, guaranteedFollowups: row.guaranteed.followups, string: row.guaranteed.moves, guaranteedDamage: row.guaranteed.damage, problems };
}

function downThrowRow(entry: FighterEntry, percent: number): DownThrowRow {
  const row = comboRow(entry, DOWN_THROW, percent, false);
  const landings = DI_NAMES.map((name) => {
    const di = VICTIM_CHOICES.find((choice) => choice.di.name === name)?.di;
    if (di === undefined) throw new Error(`no DI ${name}`);
    return landing(entry, percent, di);
  });
  const forcedTech = landings.filter(({ tumbles, actsFirst }) => tumbles && !actsFirst).length;
  const coverage = TECH_OPTIONS.map((option) => {
    const scripts = row.choices.filter((choice) => choice.victim.endsWith(`; ${option}`));
    return {
      option,
      uncovered: scripts.filter((choice) => choice.best === undefined).map((choice) => choice.victim.split(";")[0] ?? choice.victim),
      best: [...new Set(scripts.flatMap((choice) => (choice.best === undefined ? [] : [choice.best.move])))],
    };
  });
  const role = ROLE_PERCENTS.includes(percent);
  const problems = [
    ...(!row.openingLands ? ["the down throw does not land"] : []),
    ...(role && forcedTech < landings.length ? [`the victim escapes the tech after ${landings.length - forcedTech} DI directions`] : []),
    ...(role ? coverage.filter(({ uncovered }) => uncovered.length > 0).map(({ option, uncovered }) => `${option} uncovered after DI ${uncovered.join(", ")}`) : []),
    ...(row.guaranteed.followups > 2 ? ["more than 2 guaranteed follow-ups"] : []),
  ];
  return {
    kind: "down throw", fighter: entry.name, percent, guaranteedFollowups: row.guaranteed.followups, forcedTech,
    landingFrames: landings.map(({ frame }) => frame ?? -1), coverage, problems,
  };
}


export function throwRoleRows(entry: FighterEntry, progress?: (line: string) => void): ThrowRoleRow[] {
  const rows: ThrowRoleRow[] = [];
  for (const percent of REPORT_PERCENTS) {
    rows.push(upThrowRow(entry, percent));
    rows.push(downThrowRow(entry, percent));
    progress?.(`${entry.name} throw roles at ${percent}%`);
  }
  return rows;
}

export function throwRolePage(rows: readonly ThrowRoleRow[]): string {
  const table = (head: readonly string[], body: readonly (readonly string[])[]) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...body.map((row) => `| ${row.join(" | ")} |`)];
  const up = rows.filter((row): row is UpThrowRow => row.kind === "up throw");
  const down = rows.filter((row): row is DownThrowRow => row.kind === "down throw");
  const number = (value: number) => String(Math.round(value * 100) / 100);
  return [
    "# Throw roles", "",
    "Generated by `bun wisp interactions` from the match frame executor; do not edit. Rows: smashcraft:tools/move-data/interactions/throws.jsonl. Roles: [throw roles](../../../docs/gameplay-design.md#throw-roles).", "",
    `Every selectable fighter in a mirror match on the flat stage, 40 units apart, thrown at once. The victim scripts and follow-up menu are the combo trees' (${VICTIM_CHOICES.length} scripts: nine DI directions, each with hold, SDI, four tech choices, jump, air dodge and mash). Low to mid percent is ${ROLE_PERCENTS.join("/")}%; ${REPORT_PERCENTS[REPORT_PERCENTS.length - 1]}% is reported beyond it.`, "",
    "## Up throw: a guaranteed short juggle", "",
    "A guaranteed follow-up lands against every victim script, as in the combo trees; the string is the chosen common follow-up's.", "",
    ...table(["Fighter", "Victim %", "Guaranteed follow-ups", "String", "Guaranteed damage", "Findings"],
      up.map((row) => [row.fighter, String(row.percent), String(row.guaranteedFollowups), row.string.join(" → "), number(row.guaranteedDamage), row.problems.join("; ") || "within the role"])), "",
    "## Down throw: a tech chase", "",
    `Forced tech counts the nine DI directions after which the victim, pressing nothing, lands tumbling without having been free to act in the air: it must tech in place, tech left or right, or miss the tech. Covered means some follow-up in the menu lands against that tech choice; a follow-up that lands against one choice and not another is a read.`, "",
    ...table(["Fighter", "Victim %", "Forced tech", "Lands (frames after release)", "Guaranteed follow-ups", ...["tech in place", "tech left", "tech right", "missed tech"], "Findings"],
      down.map((row) => [
        row.fighter, String(row.percent), `${row.forcedTech}/${DI_NAMES.length}`, `${Math.min(...row.landingFrames)}–${Math.max(...row.landingFrames)}`, String(row.guaranteedFollowups),
        ...row.coverage.map(({ uncovered, best }) => (uncovered.length === 0 ? `covered (${best.join(", ")})` : `uncovered after DI ${uncovered.join(", ")}`)),
        row.problems.join("; ") || "within the role",
      ])), "",
  ].join("\n");
}
