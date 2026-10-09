import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { AttackStyle, Character, GrabAction } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { authoredTuning } from "../src/game/sim/tuning";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../src/game/sim/hitRegions";
import { attackStartupFrames, attackDurationFramesForGrounding, characterAttackActiveFrames, attackLandingLag, isAerialAttack } from "../src/game/sim/moves";
import { authoredThrowEffect } from "../src/game/sim/grabs";
import { grabContactFrame, grabActionDuration } from "../src/game/sim/moves";
import { gameplanOf } from "../src/game/match/botGameplan";
import * as originalSpecials from "../src/game/sim/specials";
import * as originalProjectiles from "../src/game/sim/projectiles";
import * as originalSummons from "../src/game/sim/summons";
import * as originalMoves from "../src/game/sim/moves";

export type KitValues = Readonly<Record<string, number>>;
export interface KitSnapshot { readonly values: KitValues; readonly play: string }

function numericLeaves(value: unknown, path: string, out: Record<string, number>): void {
  if (typeof value === "number") out[path] = value;
  else if (value !== null && typeof value === "object") for (const [key, child] of Object.entries(value)) numericLeaves(child, `${path}.${key}`, out);
}

/** Effective authored values, including the original fighters' shared normal tables. */
const originalNumericSources = ["specials.ts", "projectiles.ts", "summons.ts", "grabs.ts", "moves.ts", "hitRegions.ts", "exSpecials.ts"];
function originalNumbers(out: Record<string, number>): void {
  for (const file of originalNumericSources) {
    const source = ts.createSourceFile(file, readFileSync(`${import.meta.dir}/../src/game/sim/${file}`, "utf8"), ts.ScriptTarget.Latest, true);
    const counts = new Map<string, number>();
    const visit = (node: ts.Node): void => {
      if (ts.isNumericLiteral(node)) {
        let parent: ts.Node | undefined = node.parent;
        let label = "fixed";
        while (parent !== undefined) {
          if (ts.isPropertyAssignment(parent)) { label = parent.name.getText(source); break; }
          if (ts.isVariableDeclaration(parent)) { label = parent.name.getText(source); break; }
          if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) { label = parent.left.getText(source).split(".").at(-1) ?? "fixed"; break; }
          parent = parent.parent;
        }
        const index = counts.get(label) ?? 0;
        counts.set(label, index + 1);
        out[`original.source.${file}.${index}.${label}`] = Number(node.text) * (ts.isPrefixUnaryExpression(node.parent) && node.parent.operator === ts.SyntaxKind.MinusToken ? -1 : 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

export function currentKit(character: Character): KitSnapshot {
  const tuning = authoredTuning(character);
  const values: Record<string, number> = {};
  numericLeaves(tuning.moves, "authored.moves", values);
  numericLeaves(tuning.specials, "authored.specials", values);
  for (const style of Object.values(AttackStyle)) {
    const aerial = isAerialAttack(style);
    const startup = attackStartupFrames(style, tuning.moves);
    const active = characterAttackActiveFrames(character, style, tuning.moves);
    const total = attackDurationFramesForGrounding(style, !aerial, tuning.moves);
    const root = `normal.${style}`;
    values[`${root}.startupFrames`] = startup;
    values[`${root}.activeFrames`] = active;
    values[`${root}.endingFrames`] = total - startup - active;
    values[`${root}.landingLag`] = attackLandingLag(style, tuning.moves);
    for (let index = 0; index < authoredHitRegionCount(style, tuning.moves); index++) {
      for (let frame = startup; frame < total; frame++) {
        const hit = authoredHitRegion(emptyHitRegion(), character, style, frame, 0, index, tuning.moves);
        if (hit.effect.damage > 0) { numericLeaves(hit.effect, `${root}.hit.${index}`, values); break; }
      }
    }
  }
  for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    numericLeaves(authoredThrowEffect(action, tuning.moves), `throw.${action}.effect`, values);
    values[`throw.${action}.contactFrame`] = grabContactFrame(action, tuning.moves);
    values[`throw.${action}.totalFrames`] = grabActionDuration(action, tuning.moves);
  }
  if (character === Character.rifleman || character === Character.demonHunter) {
    originalNumbers(values);
    for (const [name, module] of Object.entries({ specials: originalSpecials, projectiles: originalProjectiles, summons: originalSummons, moves: originalMoves })) {
      for (const [key, value] of Object.entries(module)) if (typeof value === "number") values[`original.${name}.${key}`] = value;
    }
  }
  const retained = Object.fromEntries(Object.entries(values).filter(([path]) => parameterKind(path) !== "fixed" || /\.(launchX|launchZ)$/.test(path)));
  return { values: retained, play: JSON.stringify(gameplanOf(character)) };
}

export function currentRosterKits(): Record<string, KitSnapshot> {
  return Object.fromEntries(SELECTABLE_CHARACTERS.map(character => [fighterSlug(character), currentKit(character)]));
}

export type KitParameter = "proportional" | "frames" | "fixed";
/** Only authored damage, launch strength, timing, mana cost and cooldown can change. */
export function parameterKind(path: string): KitParameter {
  if (path.includes(".hurtboxes.")) return "fixed";
  const key = path.split(".").at(-1) ?? "";
  if (/^(damage|growth|base|manaCost|cooldownFrames)$/.test(key) || /(?:DAMAGE|KNOCKBACK|COOLDOWN)$/.test(key)) return "proportional";
  if (/^(startupFrames|activeFrames|endingFrames|totalFrames|contactFrame|endFrame|landingLag|firstFrame|lastFrame)$/.test(key) || /(?:STARTUP|ACTIVE|RECOVERY|FRAMES|SHOT_FRAME|LANDING_LAG)$/.test(key)) return "frames";
  return "fixed";
}

export interface FeelSample { readonly advantage: number; readonly killPercent?: number }
export type FeelValues = Readonly<Record<string, FeelSample>>;


/** Captured after profile calibration, then compared on every kit round. */
export function currentComputerCode(): string {
  const folder = `${import.meta.dir}/../src/game/match`;
  return readdirSync(folder).filter(name => name.startsWith("bot") || name === "cpuSkill.ts" || name === "cpuProfiles.ts").filter(name => name.endsWith(".ts") && !name.endsWith(".tests.ts")).sort().map(name => `${name}\n${readFileSync(`${folder}/${name}`, "utf8")}`).join("\n");
}
