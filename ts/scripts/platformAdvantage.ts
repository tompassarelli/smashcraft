// Who strikes first between a fighter standing on a platform and one directly
// below it (#103; smashcraft:docs/gameplay-design.md, "Positions are used, not
// camped"). Each side, from rest, tries every hop or descent with each aerial
// pressed on each frame against an idle opponent; its first strike is the
// earliest frame any of those damages the opponent. Played through the match
// frame executor from controller rows (frameScene.ts).
import { Action } from "../src/game/input/actions";
import { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { surfaceLeft, surfaceRight, surfaceZ } from "../src/game/sim/stage";
import { fighter, frame, scene } from "./frameScene";

/** Stage 1's left raised deck, the Battlefield-style platform at z 170. */
const STAGE = 1;
const DECK = 1;
const LIMIT = 60;
const LATEST_AERIAL = 40;

type Held = readonly Action[];
type Plan = (n: number) => Held;

const UP_AIR: Held = [Action.moveUp, Action.attack];
const DOWN_AIR: Held = [Action.moveDown, Action.attack];
const NEUTRAL_AIR: Held = [Action.attack];

/** The below fighter's options: a full or short hop, then an up or neutral air pressed on frame `at`. */
function belowPlans(): Plan[] {
  const plans: Plan[] = [];
  for (const full of [true, false]) {
    for (const aerial of [UP_AIR, NEUTRAL_AIR]) {
      for (let at = 2; at <= LATEST_AERIAL; at++) {
        plans.push((n) => [...(n === 1 || (full && n <= 12) ? [Action.jump] : []), ...(n === at ? aerial : [])]);
      }
    }
  }
  return plans;
}

/** The above fighter's options: a descent, then a down or neutral air pressed on frame `at`, with or without a fast fall after it. */
function abovePlans(): Plan[] {
  const plans: Plan[] = [];
  for (const fastFall of [false, true]) {
    for (const aerial of [DOWN_AIR, NEUTRAL_AIR]) {
      for (let at = 2; at <= LATEST_AERIAL; at++) {
        plans.push((n) => n === 1 ? [Action.moveDown] : n === at ? aerial : fastFall && n > at + 1 && n % 2 === 0 ? [Action.moveDown] : []);
      }
    }
  }
  return plans;
}

/** The frame on which `plan` first damages the idle victim, or undefined. */
function firstHit(attacker: Character, victim: Character, attackerAbove: boolean, plan: Plan): number | undefined {
  const x = Math.fround((surfaceLeft(STAGE, DECK, 0) + surfaceRight(STAGE, DECK, 0)) / 2);
  const s = scene(STAGE, [{ character: attacker, x, facing: 1 }, { character: victim, x, facing: -1 }]);
  const above = fighter(s, attackerAbove ? 0 : 1);
  above.motion.surface = DECK;
  above.motion.z = surfaceZ(STAGE, DECK, 0);
  const target = fighter(s, 1);
  for (let n = 1; n <= LIMIT; n++) {
    frame(s, plan(n), []);
    if (target.status.damage > 0) return n;
  }
  return undefined;
}

function earliest(attacker: Character, victim: Character, attackerAbove: boolean): number | undefined {
  let best: number | undefined;
  for (const plan of attackerAbove ? abovePlans() : belowPlans()) {
    const hit = firstHit(attacker, victim, attackerAbove, plan);
    if (hit !== undefined && (best === undefined || hit < best)) best = hit;
  }
  return best;
}

export interface PlatformAdvantage {
  readonly above: Character;
  readonly below: Character;
  /** Earliest frame each side's strike lands from rest. */
  readonly aboveFirst: number | undefined;
  readonly belowFirst: number | undefined;
}

/** Every pair of selectable fighters, each on the platform with the other below. */
export function platformAdvantages(characters: readonly Character[] = SELECTABLE_CHARACTERS): PlatformAdvantage[] {
  const rows: PlatformAdvantage[] = [];
  for (const above of characters) {
    for (const below of characters) {
      rows.push({ above, below, aboveFirst: earliest(above, below, true), belowFirst: earliest(below, above, false) });
    }
  }
  return rows;
}

/** The below fighter's lead in frames: positive when it strikes first. */
export const belowLead = (row: PlatformAdvantage): number => (row.aboveFirst ?? LIMIT + 1) - (row.belowFirst ?? LIMIT + 1);

export function platformAdvantageTable(rows: readonly PlatformAdvantage[]): string {
  const lines = ["above        below        above's first hit  below's first hit  below's lead"];
  for (const row of rows) {
    const cell = (value: number | undefined) => (value === undefined ? "none" : String(value)).padEnd(19);
    lines.push(`${fighterName(row.above).padEnd(13)}${fighterName(row.below).padEnd(13)}${cell(row.aboveFirst)}${cell(row.belowFirst)}${belowLead(row)}`);
  }
  return lines.join("\n");
}

if (import.meta.main) console.log(platformAdvantageTable(platformAdvantages()));
