// The computer playing a fighter's declared gameplan (sim/gameplan.ts, #105):
// which plan it follows, where it stands, how much each move in reach weighs,
// how it answers a threat, how it holds a grab and how it returns. Every
// choice reads only the match state, the frame and static kit data, so
// rollback replays and every client derive the same decisions. A fighter
// without a gameplan never reaches this file's choices.
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { AttackStyle, Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type DefenseOption, type FighterGameplan, type GameplanMove, type GameplanSituation, GameplanSpecial, GameplanThrow } from "../sim/gameplan";
import { heroDefinition } from "../sim/heroes/registry";
import { ORIGINAL_GAMEPLANS } from "../sim/originalGameplans";
import { mainDeckLeft, mainDeckRight } from "../sim/stage";

/** The fighter's declared gameplan, or undefined for the general computer. */
export function gameplanOf(character: Character): FighterGameplan | undefined {
  return heroDefinition(character)?.gameplan ?? ORIGINAL_GAMEPLANS[character];
}

/** The plan that keeps the preferred range and throws spacing tools; approach plans are their option's index. */
export const SPACE_PLAN = -1;
/** Frames a gameplan plan lasts before the computer weighs another. */
const PLAN_FRAMES = 40;
/** Weight of keeping the preferred range against each approach's own (default 1). */
const SPACE_WEIGHT = 2;
/** A target this much higher stands over the fighter. */
const ABOVE = 110.0;
/** A fighter that avoids the edge keeps its spot this far inside the deck. */
const EDGE_INSET = 160.0;

/** The deterministic choice botMoves draws, passed in so this file stays below it. */
export type Choice = (first: number, second: number, count: number) => number;

/** The plan for this stretch: SPACE_PLAN, or the index of the approach option it follows. */
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

/** Whether the plan in force shoots: a decision with only a ranged special in reach may take it. */
export function plansRanged(plan: Readonly<FighterGameplan>, planIndex: number): boolean {
  return planIndex === SPACE_PLAN || plan.approach[planIndex]?.via === "shoot";
}

/** The gap the fighter keeps from its target under the plan in force. */
export function keptGap(plan: Readonly<FighterGameplan>, f: Readonly<Fighter>, target: Readonly<Fighter>, slot: number, planIndex: number, frame: number, choice: Choice): number {
  const { near, far } = plan.range;
  const via = planIndex === SPACE_PLAN ? undefined : plan.approach[planIndex]?.via;
  let gap: number;
  if (via === "shoot") gap = far;
  else if (via !== undefined) gap = avoids(plan, "close") ? near : 0.0;
  else {
    // Spacing wanders through the band, a fifth of it at a time, the near end when long range is avoided.
    const step = avoids(plan, "far") ? 0 : choice(floorDiv(frame, PLAN_FRAMES), slot * 7 + f.character, 5);
    gap = f32(near + f32(f32(far - near) * f32(step / 4)));
  }
  // Under a target overhead it keeps its range instead of standing beneath it.
  if (avoids(plan, "below") && f32(target.motion.z - f.motion.z) > ABOVE) gap = Math.max(gap, near, 120.0);
  // A shield on the ground is a grab away: a plan walks in to take it, unless
  // it avoids close range and pressures the shield with its spacing tools.
  if (target.shield.raised && target.motion.grounded && !avoids(plan, "close")) gap = 0.0;
  return gap;
}

/** Where the fighter heads: its kept gap on its own side of the target, inside the deck when it avoids the edge. */
export function gameplanGoal(plan: Readonly<FighterGameplan>, f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, gap: number): number {
  const dx = f32(target.motion.x - f.motion.x);
  const toward = dx < 0 ? -1 : 1;
  let goal = f32(target.motion.x - f32(toward * gap));
  if (avoids(plan, "edge")) goal = Math.min(f32(mainDeckRight(stage) - EDGE_INSET), Math.max(f32(mainDeckLeft(stage) + EDGE_INSET), goal));
  return goal;
}

/** Whether the plan in force jumps in at a target this far ahead and above. */
export function jumpsIn(plan: Readonly<FighterGameplan>, planIndex: number, target: Readonly<Fighter>, dx: number, dz: number): boolean {
  const gap = Math.abs(dx);
  if (dz > ABOVE) return gap < 300 && !avoids(plan, "below") && !avoids(plan, "air");
  if (avoids(plan, "above") && target.motion.grounded) return false;
  return plan.approach[planIndex]?.via === "jump" && gap >= 60 && gap <= 240 && Math.abs(dz) <= 120;
}

/** A spacing aerial whose band holds the gap: worth a short hop under the spacing plan. */
export function spacingAerialAt(plan: Readonly<FighterGameplan>, gap: number): boolean {
  for (const spaced of plan.spacing) {
    if (spaced.move < AttackStyle.neutralAir || spaced.move > AttackStyle.downAir) continue;
    if (gap >= spaced.near && gap <= spaced.far) return true;
  }
  return false;
}

/** Whether the move is a spacing tool for this gap. */
export function spacedAt(plan: Readonly<FighterGameplan>, move: GameplanMove, gap: number): boolean {
  for (const spaced of plan.spacing) if (spaced.move === move && gap >= spaced.near && gap <= spaced.far) return true;
  return false;
}

const named = (moves: readonly GameplanMove[], move: GameplanMove): boolean => {
  for (const known of moves) if (known === move) return true;
  return false;
};

/** Spacing tools weigh this many times an unnamed move in reach, and so on. */
const SPACING_WEIGHT = 4;
const APPROACH_WEIGHT = 3;
const STARTER_WEIGHT = 2;
const FOLLOW_UP_WEIGHT = 4;
const KILL_WEIGHT = 6;

/**
 * How much a move in reach weighs in the computer's choice: an unnamed move
 * 1, more for a spacing tool at its spacing, a move of the approach in force,
 * a combo starter in neutral, a follow-up while the fighter's own hit stuns
 * the target, and a finisher inside its percent window. The factors multiply.
 */
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
    if (!stunned && route.starter === move) {
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

/** The answer the gameplan gives to a threat, chosen by `pick` among its listed answers; undefined when it lists none. */
export function defenseOption(plan: Readonly<FighterGameplan>, pick: Choice, seed: number, salt: number): DefenseOption | undefined {
  if (plan.defense.length === 0) return undefined;
  return at(plan.defense, pick(seed, salt, plan.defense.length));
}

/** Whether a return aims for the ledge: always, never, or the general computer's coin when mixed. */
export function aimsLedge(plan: Readonly<FighterGameplan>, coin: boolean): boolean {
  return plan.recovery.aim === "ledge" ? true : plan.recovery.aim === "deck" ? false : coin;
}

/** Whether a return near the edge spends its up special before its jump. */
export function upSpecialFirst(plan: Readonly<FighterGameplan>, coin: boolean): boolean {
  return plan.recovery.upSpecial === "first" ? true : plan.recovery.upSpecial === "last" ? false : coin;
}

const isThrow = (move: GameplanMove): move is GameplanThrow => move >= GameplanThrow.forward && move <= GameplanThrow.down;

/**
 * The throw a held grab takes: a finisher inside its window, else a throw
 * that starts a combo, chosen by the grab; undefined when the gameplan names
 * neither, which leaves the general choice.
 */
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

/** A computer option (an attack style, or a special numbered as GameplanSpecial) as the move a gameplan names. */
export function toGameplanMove(option: number): GameplanMove {
  return isOption(option) ? option : AttackStyle.jab;
}

const isOption = (option: number): option is AttackStyle | GameplanSpecial =>
  (option >= AttackStyle.jab && option <= AttackStyle.dashAttack) || (option >= GameplanSpecial.neutral && option <= GameplanSpecial.down);
