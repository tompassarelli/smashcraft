import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AttackStyle, GrabAction, type Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { authoredTuning } from "../src/game/sim/tuning";
import { attackDurationFramesForGrounding, attackLandingLag, attackStartupFrames, characterAttackActiveFrames, grabActionDuration, grabContactFrame, isAerialAttack } from "../src/game/sim/moves";
import { GROUND_ROLL_FRAMES, SPOT_DODGE_FRAMES } from "../src/game/sim/conditions";
import { SHIELD_RELEASE_LAG_FRAMES, shieldstunDuration } from "../src/game/sim/shield";
import { currentFeel } from "./balanceFeel";
import { type Envelope, type Field, type Measures, type MoveClass, type MoveRow, type Range, type Sample, type Tolerances, MOVE_CLASSES, buildEnvelope } from "./genreEnvelope";

const ROOT = join(import.meta.dir, "../..");
export const ENVELOPE_FILE = join(ROOT, "tools/move-data/genre-envelope.json");
export const MELEE_CORPUS = join(ROOT, "references/melee-frame-data/records.jsonl");

type Cell = number | null;
interface EnvelopeFile {
  readonly tolerance: Tolerances;
  readonly sources: Record<string, { readonly game: string; readonly url: string }>;
  readonly meleeClasses: Record<string, MoveClass>;
  readonly fixed: readonly { readonly source: string; readonly class: MoveClass; readonly total?: number; readonly killPercent?: readonly [number, number] }[];
  readonly samples: readonly (readonly [string, string, MoveClass, Cell, Cell, Cell, Cell, Cell])[];
}

const isClass = (value: string): value is MoveClass => MOVE_CLASSES.some((name) => name === value);
const defined = (entries: readonly (readonly [Field, Cell | undefined])[]): Measures =>
  Object.fromEntries(entries.filter((entry): entry is [Field, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])));

export function attackMeasures(startup: Cell, lastActive: Cell, total: Cell, landing: Cell, shield: Cell): Measures {
  return defined([
    ["startup", startup],
    ["active", startup !== null && lastActive !== null ? lastActive - startup + 1 : null],
    ["endLag", lastActive !== null && total !== null && total > lastActive ? total - lastActive : null],
    ["landingLag", landing],
    ["shieldAdvantage", shield],
  ]);
}

// Melee's digital shieldstun: multiplier 1 and the 200/201 frame scale, unlike Smashcraft's own multipliers.
const meleeShieldstun = (damage: number): number => Math.trunc(shieldstunDuration(damage, 1.0, 1.0) * 200 / 201);

const DODGE_CLASSES: readonly MoveClass[] = ["spot-dodge", "roll", "shield-drop", "jump-squat"];

function meleeSamples(classes: Record<string, MoveClass>): Sample[] {
  const samples: Sample[] = [];
  for (const line of readFileSync(MELEE_CORPUS, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    const record = JSON.parse(line) as { category: string; action: string | null; values: Record<string, number | null> };
    const value = (key: string): Cell => typeof record.values[key] === "number" ? record.values[key] : null;
    if (record.category === "misc") {
      const squat = value("jump_squat");
      if (squat !== null) samples.push({ source: "melee", moveClass: "jump-squat", measures: { total: squat } });
      continue;
    }
    const moveClass = record.action === null ? undefined : classes[record.action];
    if (moveClass === undefined) continue;
    if (DODGE_CLASSES.includes(moveClass)) {
      const total = value("total");
      if (total !== null) samples.push({ source: "melee", moveClass, measures: { total } });
      continue;
    }
    const total = value("iasa") ?? value("total");
    const start = value("start"), damage = value("percent");
    const landing = moveClass === "aerial" ? value("cancel_lag") : null;
    const recovery = moveClass === "aerial" ? landing : start !== null && total !== null ? total - start : null;
    const shield = damage === null || recovery === null || moveClass === "grab" || moveClass === "throw" ? null : meleeShieldstun(damage) - recovery;
    samples.push({ source: "melee", moveClass, measures: attackMeasures(start, value("end"), total, landing, shield) });
  }
  return samples;
}

export interface GenreReference { readonly envelope: Envelope; readonly tolerances: Tolerances; readonly sources: EnvelopeFile["sources"]; readonly samples: readonly Sample[] }

export function genreReference(): GenreReference {
  const file = JSON.parse(readFileSync(ENVELOPE_FILE, "utf8")) as EnvelopeFile;
  const samples: Sample[] = meleeSamples(file.meleeClasses);
  for (const [source, , moveClass, startup, lastActive, total, landing, shield] of file.samples) {
    if (!isClass(moveClass)) throw new Error(`genre-envelope.json: unknown class ${moveClass}`);
    samples.push({ source, moveClass, measures: DODGE_CLASSES.includes(moveClass) ? defined([["total", total]]) : attackMeasures(startup, lastActive, total, landing, shield) });
  }
  const fixed: { moveClass: MoveClass; field: Field; range: Range }[] = [];
  for (const entry of file.fixed) {
    if (entry.total !== undefined) fixed.push({ moveClass: entry.class, field: "total", range: { low: entry.total, high: entry.total } });
    if (entry.killPercent !== undefined) fixed.push({ moveClass: entry.class, field: "killPercent", range: { low: entry.killPercent[0], high: entry.killPercent[1] } });
  }
  return { envelope: buildEnvelope(samples, fixed), tolerances: file.tolerance, sources: file.sources, samples };
}

const styleName = (style: number): string => Object.entries(AttackStyle).find(([, code]) => code === style)?.[0] ?? `style${style}`;

interface Region { readonly firstFrame: number; readonly lastFrame: number }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const numberAt = (row: Record<string, unknown>, key: string): number | undefined => typeof row[key] === "number" ? row[key] : undefined;

function specialRows(fighter: string, specials: unknown, feel: ReturnType<typeof currentFeel>): MoveRow[] {
  const rows: MoveRow[] = [];
  const visit = (node: unknown, path: string): void => {
    if (!isRecord(node)) return;
    const end = numberAt(node, "endFrame");
    const regions = Array.isArray(node.regions) ? node.regions.filter((region): region is Region => isRecord(region) && typeof region.firstFrame === "number" && typeof region.lastFrame === "number" && isRecord(region.hit)) : [];
    const spawns = Array.isArray(node.projectiles) ? node.projectiles.flatMap((projectile) => isRecord(projectile) && typeof projectile.spawnFrame === "number" ? [projectile.spawnFrame] : []) : [];
    if (end !== undefined && (regions.length > 0 || spawns.length > 0)) {
      const first = Math.min(...regions.map((region) => region.firstFrame), ...spawns);
      const last = regions.length > 0 ? Math.max(...regions.map((region) => region.lastFrame)) : Math.min(...spawns);
      const samples = Object.entries(feel).filter(([key]) => key.startsWith(`special.${path}.regions.`) || key.startsWith(`special.${path}.projectiles.`)).map(([, sample]) => sample);
      const kills = samples.flatMap((sample) => sample.killPercent === undefined ? [] : [sample.killPercent]);
      rows.push({ fighter, move: `special.${path}`, measures: defined([
        ["startup", first + 1],
        ["active", regions.length > 0 ? last - first + 1 : null],
        ["endLag", end > last ? end - last - 1 : null],
        ["landingLag", numberAt(node, "landingLag") ?? null],
        ["shieldAdvantage", samples.length > 0 ? Math.max(...samples.map((sample) => sample.advantage)) : null],
        ["killPercent", kills.length > 0 ? Math.min(...kills) : null],
      ]) });
    }
    for (const [key, child] of Object.entries(node)) if (key !== "regions" && key !== "projectiles" && key !== "table") visit(child, `${path}.${key}`);
  };
  if (isRecord(specials)) for (const [slot, child] of Object.entries(specials)) visit(child, slot);
  return rows;
}

export function fighterRows(character: Character): MoveRow[] {
  const fighter = fighterSlug(character);
  const tuning = authoredTuning(character);
  const feel = currentFeel(character);
  const rows: MoveRow[] = [];
  const styles = tuning.moves === undefined
    ? Object.values(AttackStyle).filter((style) => Object.keys(feel).some((path) => path.startsWith(`normal.${style}.hit.`)))
    : Object.keys(tuning.moves.normals).map((key) => Number(key) as AttackStyle);
  for (const style of styles) {
    const aerial = isAerialAttack(style);
    const startup = attackStartupFrames(style, tuning.moves);
    const active = characterAttackActiveFrames(character, style, tuning.moves);
    const total = attackDurationFramesForGrounding(style, !aerial, tuning.moves);
    const hits = Object.entries(feel).filter(([path]) => path.startsWith(`normal.${style}.hit.`)).map(([, sample]) => sample);
    const kills = hits.flatMap((sample) => sample.killPercent === undefined ? [] : [sample.killPercent]);
    rows.push({ fighter, move: `normal.${styleName(style)}`, measures: defined([
      ["startup", startup + 1], ["active", active], ["endLag", total - startup - active],
      ["landingLag", aerial ? attackLandingLag(style, tuning.moves) : null],
      ["shieldAdvantage", hits.length > 0 ? Math.max(...hits.map((sample) => sample.advantage)) : null],
      ["killPercent", kills.length > 0 ? Math.min(...kills) : null],
    ]) });
  }
  const dash = tuning.dashGrab;
  if (dash !== undefined) rows.push({ fighter, move: "grab.dash", measures: { startup: dash.startupFrames + 1, active: dash.activeFrames, endLag: dash.totalFrames - dash.startupFrames - dash.activeFrames } });
  for (const [name, action] of [["forward", GrabAction.throwForward], ["back", GrabAction.throwBack], ["up", GrabAction.throwUp], ["down", GrabAction.throwDown]] as const) {
    const contact = grabContactFrame(action, tuning.moves);
    const kill = feel[`throw.${action}`]?.killPercent;
    rows.push({ fighter, move: `throw.${name}`, measures: defined([["startup", contact + 1], ["active", 1], ["endLag", grabActionDuration(action, tuning.moves) - contact - 1], ["killPercent", kill ?? null]]) });
  }
  rows.push(...specialRows(fighter, tuning.specials, feel));
  for (const [key, sample] of Object.entries(feel)) {
    if (!key.startsWith("special.") || key.includes(".regions.") || key.includes(".projectiles.")) continue;
    if (rows.some((row) => row.move === key)) continue;
    rows.push({ fighter, move: key, measures: defined([["shieldAdvantage", sample.advantage], ["killPercent", sample.killPercent ?? null]]) });
  }
  rows.push({ fighter, move: "jump-squat", measures: { total: tuning.physics.jumpSquatFrames } });
  return rows;
}

export function universalRows(): MoveRow[] {
  return [
    { fighter: "all", move: "spot-dodge", measures: { total: SPOT_DODGE_FRAMES } },
    { fighter: "all", move: "roll", measures: { total: GROUND_ROLL_FRAMES } },
    { fighter: "all", move: "shield-drop", measures: { total: SHIELD_RELEASE_LAG_FRAMES } },
  ];
}

export function rosterRows(): MoveRow[] {
  return [...universalRows(), ...SELECTABLE_CHARACTERS.flatMap(fighterRows)];
}
