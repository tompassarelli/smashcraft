





import { Action } from "../src/game/input/actions";
import { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { surfaceLeft, surfaceRight, surfaceZ } from "../src/game/sim/stage";
import { fighter, frameRows, scene } from "../src/game/match/padScene";


const STAGE = 1;
const DECK = 1;
const LIMIT = 60;
const LATEST_AERIAL = 40;

type Held = readonly Action[];
type Plan = (n: number) => Held;
type RecordedPlan = readonly Held[];

const UP_AIR: Held = [Action.moveUp, Action.attack];
const DOWN_AIR: Held = [Action.moveDown, Action.attack];
const NEUTRAL_AIR: Held = [Action.attack];
const NEUTRAL: Held = [];


function belowPlans(): Plan[] {
  const plans: Plan[] = [(n) => (n === 1 ? [Action.smashUp] : []), (n) => (n === 1 ? [Action.walk, Action.moveUp, Action.attack] : [])];
  for (const full of [true, false]) {
    for (const aerial of [UP_AIR, NEUTRAL_AIR]) {
      for (let at = 2; at <= LATEST_AERIAL; at++) {
        plans.push((n) => [...(n === 1 || (full && n <= 12) ? [Action.jump] : []), ...(n === at ? aerial : [])]);
      }
    }
  }
  return plans;
}


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

const recordPlan = (plan: Plan): RecordedPlan => Array.from({ length: LIMIT }, (_, index) => plan(index + 1));
const BELOW_PLANS = belowPlans().map(recordPlan);
const ABOVE_PLANS = abovePlans().map(recordPlan);


function firstHit(attacker: Character, victim: Character, attackerAbove: boolean, plan: RecordedPlan): number | undefined {
  const x = Math.fround((surfaceLeft(STAGE, DECK, 0) + surfaceRight(STAGE, DECK, 0)) / 2);
  const s = scene(STAGE, [{ character: attacker, x, facing: 1 }, { character: victim, x, facing: -1 }]);
  const above = fighter(s, attackerAbove ? 0 : 1);
  above.motion.surface = DECK;
  above.motion.z = surfaceZ(STAGE, DECK, 0);
  const target = fighter(s, 1);
  const held: [Held, Held] = [NEUTRAL, NEUTRAL];
  for (let n = 1; n <= LIMIT; n++) {
    held[0] = plan[n - 1] ?? NEUTRAL;
    frameRows(s, held);
    if (target.status.damage > 0) return n;
  }
  return undefined;
}

function earliest(attacker: Character, victim: Character, attackerAbove: boolean): number | undefined {
  let best: number | undefined;
  for (const plan of attackerAbove ? ABOVE_PLANS : BELOW_PLANS) {
    const hit = firstHit(attacker, victim, attackerAbove, plan);
    if (hit !== undefined && (best === undefined || hit < best)) best = hit;
  }
  return best;
}

export interface PlatformAdvantage {
  readonly above: Character;
  readonly below: Character;

  readonly aboveFirst: number | undefined;
  readonly belowFirst: number | undefined;
}


export function platformAdvantages(characters: readonly Character[] = SELECTABLE_CHARACTERS): PlatformAdvantage[] {
  const rows: PlatformAdvantage[] = [];
  for (const above of characters) {
    for (const below of characters) {
      rows.push({ above, below, aboveFirst: earliest(above, below, true), belowFirst: earliest(below, above, false) });
    }
  }
  return rows;
}


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
