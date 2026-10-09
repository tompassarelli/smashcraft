import { Character } from "../src/game/sim/codes";
import { fighterName } from "../src/game/sim/heroes/registry";
import {
  DIS, type Defender, type Di, type Ending, Explorer, OPENERS, type Opener, Sim, TECH_OPTIONS,
  defenderMask, expand, landingSetup, measureCell, openerRoot,
} from "./comboExplorer";

export const ADVANTAGE_PERCENTS = [0, 20, 40, 60] as const;
export const GRAB_PERCENTS = [0, 20, 40] as const;

export const TARGETS = [
  { weight: "light", character: Character.lich },
  { weight: "medium", character: Character.rifleman },
  { weight: "heavy", character: Character.cairne },
] as const;
export type TargetWeight = (typeof TARGETS)[number]["weight"];

const THROW_OPENERS = OPENERS.filter((opener) => opener.throw !== undefined);
const KNOCKDOWN_OPENERS = ["down throw", "down smash", "down tilt", "forward throw", "back throw"].flatMap((name) => OPENERS.filter((opener) => opener.name === name));
const LAUNCHERS = OPENERS.filter((opener) => ["up throw", "up tilt", "up smash"].includes(opener.name));
const RELAUNCH = /(^|, )(up air|up tilt)$/;

export interface ThrowCell {
  readonly opener: string;
  readonly percent: number;

  readonly withoutDi: number;

  readonly withDi: number;
  readonly withDiDamage: number;
  readonly withDiMoves: readonly string[];

  readonly diMixup: { readonly in: string; readonly out: string } | undefined;
  readonly knockdown: boolean;
  readonly ko: boolean;
}

export interface TechChase {
  readonly opener: string;
  readonly percent: number;

  readonly covered: readonly { readonly option: string; readonly read: string | undefined }[];

  readonly trap: { readonly read: string; readonly options: readonly string[] } | undefined;
}

export interface Juggle {
  readonly launcher: string;
  readonly percent: number;
  readonly relaunch: string;

  readonly dis: number;
}

export interface AdvantageRow {
  readonly fighter: string;
  readonly target: TargetWeight;
  readonly opponent: string;
  readonly throws: readonly ThrowCell[];
  readonly techChase: TechChase | undefined;
  readonly juggle: Juggle | undefined;
  readonly targets: { readonly grabs: boolean; readonly techChasing: boolean; readonly juggling: boolean; readonly diMixups: boolean; readonly techTraps: boolean };

  readonly zeroToDeath: readonly string[];
}

const followUps = (moves: readonly string[]): number => Math.max(0, moves.length - 1);

export function throwCell(attacker: Character, defender: Character, opener: Opener, percent: number): ThrowCell {
  const cell = measureCell(attacker, defender, opener, percent, "centre");
  const none = cell.byDi.none;
  const into = cell.byDi.in;
  const out = cell.byDi.out;
  const first = (moves: readonly string[] | undefined): string | undefined => moves?.[1];
  const inMove = first(into?.moves);
  const outMove = first(out?.moves);
  const results = DIS.flatMap((di) => cell.byDi[di] ?? []);
  return {
    opener: opener.name, percent,
    withoutDi: followUps(none?.moves ?? []),
    withDi: cell.escape === undefined ? 0 : followUps(cell.escape.moves),
    withDiDamage: cell.escape?.damage ?? 0,
    withDiMoves: cell.escape?.moves ?? [],
    diMixup: inMove !== undefined && outMove !== undefined && inMove !== outMove ? { in: inMove, out: outMove } : undefined,
    knockdown: results.length === DIS.length && results.every((result) => result.situation === "tech chase"),
    ko: cell.escape?.ko === true,
  };
}


function covers(ending: Ending, option: (typeof TECH_OPTIONS)[number], landing: number, from: number, di: Di): boolean {
  const held = expand(ending.route.held);
  const sim = new Sim(ending.route.setup);
  const d: Defender = { name: option, di, tech: { option, landing: landing - from } };
  let start = 0;
  for (let n = 0; n < held.attacker.length; n++) {
    if (n === from) start = sim.b.status.damage;
    const bm = n < from ? held.defender[n] ?? 0 : defenderMask(d, n - from + 1, undefined, sim.b, sim.a);
    sim.step(held.attacker[n] ?? 0, bm);
  }
  return sim.b.status.damage > start;
}

export function techChase(attacker: Character, defender: Character, cells: readonly ThrowCell[]): TechChase | undefined {
  let best: TechChase | undefined;
  for (const percent of ADVANTAGE_PERCENTS) for (const opener of KNOCKDOWN_OPENERS) {
    const own = cells.find((cell) => cell.opener === opener.name && cell.percent === percent);
    const knockdown = own?.knockdown ?? throwCell(attacker, defender, opener, percent).knockdown;
    if (!knockdown) continue;
    const setup = landingSetup(attacker, defender, opener, percent, "centre");
    if (setup === undefined) continue;
    const played = openerRoot(setup, opener, { name: "none", di: "none" });
    if (played === undefined) continue;
    const explorer = new Explorer(played.sim);
    const { best: ending } = explorer.search(played.root, { name: "none", di: "none" }, percent);
    if (ending.situation !== "tech chase") continue;
    const reads = explorer.techReads(ending, "none", percent);
    const landing = expand(ending.route.held).attacker.length + 1;
    const from = Math.max(0, landing - 2 - 1);
    const covered = TECH_OPTIONS.map((option, index) => ({ option, read: reads[index]?.moves.slice(ending.moves.length + 1).join(", ") }));
    let trap: TechChase["trap"];
    for (const [index, read] of reads.entries()) {
      if (read === undefined) continue;
      const options = TECH_OPTIONS.filter((option, other) => other === index || covers(read, option, landing, from, "none"));
      if (options.length >= 2 && (trap === undefined || options.length > trap.options.length)) trap = { read: read.moves.slice(ending.moves.length + 1).join(", "), options };
    }
    const found: TechChase = { opener: opener.name, percent, covered, trap };
    const score = (chase: TechChase) => chase.covered.filter(({ read }) => read !== undefined).length * 10 + (chase.trap?.options.length ?? 0);
    if (best === undefined || score(found) > score(best)) best = found;
    if (score(best) >= TECH_OPTIONS.length * 10 + 2) return best;
  }
  return best;
}

export function juggle(attacker: Character, defender: Character): Juggle | undefined {
  let best: Juggle | undefined;
  for (const opener of LAUNCHERS) for (const percent of ADVANTAGE_PERCENTS) {
    const setup = landingSetup(attacker, defender, opener, percent, "centre");
    if (setup === undefined) continue;
    const found = new Map<string, number>();
    for (const di of DIS) {
      const d: Defender = { name: di, di };
      const played = openerRoot(setup, opener, d);
      if (played === undefined) continue;
      const hits = new Set<string>();
      const explorer = new Explorer(played.sim, (moves) => {
        const last = moves[1];
        if (moves.length === 2 && last !== undefined && RELAUNCH.test(last)) hits.add(last.replace(/^.*, /, ""));
      });
      explorer.search(played.root, d, percent);
      for (const hit of hits) found.set(hit, (found.get(hit) ?? 0) + 1);
    }
    for (const [relaunch, dis] of found) {
      if (best === undefined || dis > best.dis) best = { launcher: opener.name, percent, relaunch, dis };
    }
    if (best?.dis === DIS.length) return best;
  }
  return best;
}

export function advantageRow(attacker: Character, target: (typeof TARGETS)[number]): AdvantageRow {
  const defender = target.character;
  const throws = THROW_OPENERS.flatMap((opener) => ADVANTAGE_PERCENTS.map((percent) => throwCell(attacker, defender, opener, percent)));
  const chase = techChase(attacker, defender, throws);
  const lift = juggle(attacker, defender);
  const grabs = GRAB_PERCENTS.every((percent) => throws.some((cell) => cell.percent === percent && (cell.withDi >= 1 || cell.diMixup !== undefined || cell.knockdown)));
  const zeroToDeath = throws.flatMap((cell) => [
    ...(cell.ko && cell.percent === 0 ? [`${cell.opener} takes the stock from 0% whatever the DI`] : []),
    ...(cell.withDi > 2 ? [`${cell.opener} guarantees ${cell.withDi} follow-ups at ${cell.percent}%`] : []),
    ...(!cell.ko && cell.withDiDamage > 30 ? [`${cell.opener} guarantees ${Math.round(cell.withDiDamage)}% at ${cell.percent}%`] : []),
  ]);
  return {
    fighter: fighterName(attacker), target: target.weight, opponent: fighterName(defender), throws, techChase: chase, juggle: lift,
    targets: {
      grabs,
      techChasing: chase !== undefined && chase.covered.every(({ read }) => read !== undefined),
      juggling: lift !== undefined && lift.dis >= DIS.length - 1,
      diMixups: throws.some((cell) => cell.diMixup !== undefined),
      techTraps: chase?.trap !== undefined,
    },
    zeroToDeath,
  };
}

const TARGET_NAMES = ["grabs", "techChasing", "juggling", "diMixups", "techTraps"] as const;
const TARGET_TITLES: Readonly<Record<(typeof TARGET_NAMES)[number], string>> = { grabs: "Grabs", techChasing: "Tech chase", juggling: "Juggle", diMixups: "DI mix-up", techTraps: "Tech trap" };

export const unmet = (row: AdvantageRow): string[] => [
  ...TARGET_NAMES.filter((name) => !row.targets[name]).map((name) => `${TARGET_TITLES[name].toLowerCase()} against the ${row.target} target`),
  ...row.zeroToDeath,
];

export function advantagePage(rows: readonly AdvantageRow[]): string {
  const table = (head: readonly string[], body: readonly (readonly string[])[]) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...body.map((row) => `| ${row.join(" | ")} |`)];
  const mark = (value: boolean) => (value ? "yes" : "**no**");
  return [
    "# Advantage state", "",
    "Generated by `bun wisp combos --advantage`; do not edit. Targets: [advantage state](../../docs/gameplay-design.md#advantage-state). Rows: smashcraft:tools/move-data/advantage-state.jsonl.", "",
    `Each fighter against a light (${fighterName(TARGETS[0].character)}), medium (${fighterName(TARGETS[1].character)}) and heavy (${fighterName(TARGETS[2].character)}) target at the flat stage's centre, through the combo explorer: every throw at ${ADVANTAGE_PERCENTS.join("/")}%, with no DI and against each of DI ${DIS.filter((di) => di !== "none").join(", ")} and none (with DI is the escape-optimal DI's string).`, "",
    "## Targets met", "",
    ...table(["Fighter", "Target", ...TARGET_NAMES.map((name) => TARGET_TITLES[name]), "Tech chase", "Juggle"], rows.map((row) => [
      row.fighter, row.target, ...TARGET_NAMES.map((name) => mark(row.targets[name])),
      row.techChase === undefined ? "no knockdown" : `${row.techChase.opener} at ${row.techChase.percent}%: ${row.techChase.covered.map(({ option, read }) => `${option} ${read ?? "uncovered"}`).join("; ")}${row.techChase.trap === undefined ? "" : `; trap ${row.techChase.trap.read} covers ${row.techChase.trap.options.join(", ")}`}`,
      row.juggle === undefined ? "none" : `${row.juggle.launcher} at ${row.juggle.percent}% → ${row.juggle.relaunch} against ${row.juggle.dis}/${DIS.length} DI`,
    ])), "",
    "## True combos from each throw", "",
    "Follow-ups that land without a read: without DI / with the escape-optimal DI. A DI mix-up names the first follow-up against DI in and DI out when they differ; KD marks a forced knockdown under every DI.", "",
    ...table(["Fighter", "Target", "Throw", ...ADVANTAGE_PERCENTS.map((percent) => `${percent}%`)], rows.flatMap((row) => THROW_OPENERS.map((opener) => [
      row.fighter, row.target, opener.name,
      ...ADVANTAGE_PERCENTS.map((percent) => {
        const cell = row.throws.find((own) => own.opener === opener.name && own.percent === percent);
        if (cell === undefined) return "—";
        return [`${cell.withoutDi}/${cell.withDi}`, ...(cell.knockdown ? ["KD"] : []), ...(cell.diMixup === undefined ? [] : [`in ${cell.diMixup.in}, out ${cell.diMixup.out}`]), ...(cell.ko ? ["KO"] : [])].join(" ");
      }),
    ]))), "",
  ].join("\n");
}
