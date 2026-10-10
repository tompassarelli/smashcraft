





import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { AttackStyle, Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type DefenseOption, type FighterGameplan, type GameplanMove, type GameplanSituation, GameplanSpecial, GameplanThrow } from "../sim/gameplan";
import { heroDefinition } from "../sim/heroes/registry";
import { ORIGINAL_GAMEPLANS } from "../sim/originalGameplans";
import { mainDeckLeft, mainDeckRight } from "../sim/stage";


export function gameplanOf(character: Character, basicMoves?: readonly number[]): FighterGameplan | undefined {
  const plan = heroDefinition(character)?.gameplan ?? ORIGINAL_GAMEPLANS[character];
  if (plan === undefined || basicMoves === undefined) return plan;
  const approach = plan.approach.find(option => option.moves.some(move => basicMoves.includes(move)));
  return { ...plan, spacing: plan.spacing.filter(spaced => basicMoves.includes(spaced.move)),
    approach: approach === undefined ? [] : [{ ...approach, moves: approach.moves.filter(move => basicMoves.includes(move)) }],
    combos: [], kills: [], defense: ["shield"], recovery: { aim: "deck", upSpecial: "last" } };
}


export const SPACE_PLAN = -1;

const PLAN_FRAMES = 40;

const SPACE_WEIGHT = 2;

const ABOVE = 110.0;

const EDGE_INSET = 160.0;


type Choice = (first: number, second: number, count: number) => number;


export function gameplanPlan(plan: Readonly<FighterGameplan>, f: Readonly<Fighter>, slot: number, frame: number, choice: Choice): number {
  const avoidsFar = avoids(plan, "far");
  const avoidsAir = avoids(plan, "air");
  let total = avoidsFar ? 1 : SPACE_WEIGHT;
  for (const option of plan.approach) if (!(avoidsAir && option.via === "jump")) total += option.weight ?? 1;
  let pick = choice(floorDiv(frame, PLAN_FRAMES), slot * 13 + f.character, total) - (avoidsFar ? 1 : SPACE_WEIGHT);
  if (pick < 0) return SPACE_PLAN;
  for (let index = 0; index < plan.approach.length; index++) {
    const option = at(plan.approach, index);
    if (avoidsAir && option.via === "jump") continue;
    pick -= option.weight ?? 1;
    if (pick < 0) return index;
  }
  return SPACE_PLAN;
}

export function avoids(plan: Readonly<FighterGameplan>, situation: GameplanSituation): boolean {
  for (const avoided of plan.avoid) if (avoided === situation) return true;
  return false;
}


export function plansRanged(plan: Readonly<FighterGameplan>, planIndex: number): boolean {
  return planIndex === SPACE_PLAN || plan.approach[planIndex]?.via === "shoot";
}


export function keptGap(plan: Readonly<FighterGameplan>, f: Readonly<Fighter>, target: Readonly<Fighter>, slot: number, planIndex: number, frame: number, choice: Choice): number {
  const { near, far } = plan.range;
  const via = planIndex === SPACE_PLAN ? undefined : plan.approach[planIndex]?.via;
  let gap: number;
  if (via === "shoot") gap = far;
  else if (via !== undefined) gap = avoids(plan, "close") ? near : 0.0;
  else {

    const step = avoids(plan, "far") ? 0 : choice(floorDiv(frame, PLAN_FRAMES), slot * 7 + f.character, 5);
    gap = f32(near + f32(f32(far - near) * f32(step / 4)));
  }

  if (avoids(plan, "below") && f32(target.motion.z - f.motion.z) > ABOVE) gap = Math.max(gap, near, 120.0);


  if (target.shield.raised && target.motion.grounded && !avoids(plan, "close")) gap = 0.0;

  if (onAnotherDeck(f, target)) gap = 0.0;
  return gap;
}







export function onAnotherDeck(f: Readonly<Fighter>, target: Readonly<Fighter>): boolean {
  return target.motion.grounded && target.motion.surface !== f.motion.surface
    && (Math.abs(f32(target.motion.z - f.motion.z)) > ABOVE
      || (!f.motion.grounded && target.motion.surface !== undefined && target.motion.surface > 0));
}


export function gameplanGoal(plan: Readonly<FighterGameplan>, f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, gap: number): number {
  const dx = f32(target.motion.x - f.motion.x);
  const toward = dx < 0 ? -1 : 1;
  let goal = f32(target.motion.x - f32(toward * gap));
  if (avoids(plan, "edge")) goal = Math.min(f32(mainDeckRight(stage) - EDGE_INSET), Math.max(f32(mainDeckLeft(stage) + EDGE_INSET), goal));
  return goal;
}


export function jumpsIn(plan: Readonly<FighterGameplan>, planIndex: number, f: Readonly<Fighter>, target: Readonly<Fighter>, dx: number, dz: number): boolean {
  const gap = Math.abs(dx);
  if (dz > ABOVE) return gap < 300 && (onAnotherDeck(f, target) || (!avoids(plan, "below") && !avoids(plan, "air")));
  if (avoids(plan, "above") && target.motion.grounded) return false;
  return plan.approach[planIndex]?.via === "jump" && gap >= 60 && gap <= 240 && Math.abs(dz) <= 120;
}


export function spacingAerialAt(plan: Readonly<FighterGameplan>, gap: number): boolean {
  for (const spaced of plan.spacing) {
    if (spaced.move < AttackStyle.neutralAir || spaced.move > AttackStyle.downAir) continue;
    if (gap >= spaced.near && gap <= spaced.far) return true;
  }
  return false;
}


export function spacedAt(plan: Readonly<FighterGameplan>, move: GameplanMove, gap: number): boolean {
  for (const spaced of plan.spacing) if (spaced.move === move && gap >= spaced.near && gap <= spaced.far) return true;
  return false;
}

const named = (moves: readonly GameplanMove[], move: GameplanMove): boolean => {
  for (const known of moves) if (known === move) return true;
  return false;
};


const SPACING_WEIGHT = 4;
const APPROACH_WEIGHT = 3;
const STARTER_WEIGHT = 2;
const FOLLOW_UP_WEIGHT = 4;
const KILL_WEIGHT = 6;







export function moveWeight(plan: Readonly<FighterGameplan>, planIndex: number, f: Readonly<Fighter>, slot: number, target: Readonly<Fighter>, move: GameplanMove): number {
  const gap = Math.abs(f32(target.motion.x - f.motion.x));
  let weight = 1;
  if (spacedAt(plan, move, gap)) weight *= SPACING_WEIGHT;
  const approach = plan.approach[planIndex];
  if (approach !== undefined && named(approach.moves, move)) weight *= APPROACH_WEIGHT;
  const stunned = target.launch.hitstun > 0 && target.hits.lastAttacker === slot;
  for (const route of plan.combos) {
    if (stunned && named(route.followUps, move)) {
      weight *= FOLLOW_UP_WEIGHT;
      break;
    }
    if (!stunned && (route.starter === move || (move === AttackStyle.grab && isThrow(route.starter)))) {
      weight *= STARTER_WEIGHT;
      break;
    }
  }
  const percent = target.status.damage;
  for (const kill of plan.kills) {
    if (kill.move === move && percent >= kill.fromPercent && (kill.toPercent === undefined || percent <= kill.toPercent)) {
      weight *= KILL_WEIGHT;
      break;
    }
  }
  return weight;
}


export function defenseOption(plan: Readonly<FighterGameplan>, pick: Choice, seed: number, salt: number): DefenseOption | undefined {
  if (plan.defense.length === 0) return undefined;
  return at(plan.defense, pick(seed, salt, plan.defense.length));
}


export function aimsLedge(plan: Readonly<FighterGameplan>, coin: boolean): boolean {
  return plan.recovery.aim === "ledge" ? true : plan.recovery.aim === "deck" ? false : coin;
}


export function upSpecialFirst(plan: Readonly<FighterGameplan>, coin: boolean): boolean {
  return plan.recovery.upSpecial === "first" ? true : plan.recovery.upSpecial === "last" ? false : coin;
}

const isThrow = (move: GameplanMove): move is GameplanThrow => move >= GameplanThrow.forward && move <= GameplanThrow.down;






export function gameplanThrow(plan: Readonly<FighterGameplan>, target: Readonly<Fighter>, serial: number, pick: Choice): GameplanThrow | undefined {
  const percent = target.status.damage;
  for (const kill of plan.kills) {
    if (isThrow(kill.move) && percent >= kill.fromPercent && (kill.toPercent === undefined || percent <= kill.toPercent)) return kill.move;
  }
  let starters = 0;
  for (const route of plan.combos) if (isThrow(route.starter)) starters++;
  if (starters === 0) return undefined;
  let index = pick(serial, target.character, starters);
  for (const route of plan.combos) {
    if (!isThrow(route.starter)) continue;
    if (index-- === 0) return route.starter;
  }
  return undefined;
}


export function toGameplanMove(option: number): GameplanMove {
  return isOption(option) ? option : AttackStyle.jab;
}

const isOption = (option: number): option is AttackStyle | GameplanSpecial =>
  (option >= AttackStyle.jab && option <= AttackStyle.dashAttack) || (option >= GameplanSpecial.neutral && option <= GameplanSpecial.down);
