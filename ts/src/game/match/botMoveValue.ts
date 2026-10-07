// Estimates over already eligible actions; the reach/legality owner still
// supplies the candidates. Value is deliberately fallible, not an oracle.
import { at } from "wisp/src/runtime/lookup";
import { floorDiv } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { authoredHitRegion, emptyHitRegion, type HitEffect } from "../sim/hitRegions";
import { attackDurationFramesForGrounding, attackStartupFrames, isSmashAttack } from "../sim/moves";
import { contactKnockback } from "../sim/knockback";
import { stageBounds } from "../sim/stageBounds";
import type { MatchState } from "./rules";
import { botChance, botChoice } from "./botRandom";
import { startableForm } from "./botHeroKit";
import type { BotStrategy } from "./botStrategy";
import { HabitChoice, habitContext } from "./botHabits";
import type { CpuDecisionPolicy } from "./cpuDecisionPolicy";

export interface AttackDecision {
  readonly strategy: BotStrategy;
  readonly policy: CpuDecisionPolicy;
  readonly game: Readonly<MatchState>;
}

export interface MoveEstimate {
  readonly damage: number;
  readonly startup: number;
  readonly recovery: number;
  readonly effect: Readonly<HitEffect>;
  readonly travel: number;
}

const hit = emptyHitRegion();
const NORMAL_STYLES = Object.values(AttackStyle);
const noEffect: Readonly<HitEffect> = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false };

/** Reads authored strike data; unpriced original specials retain their existing gameplan share. */
function estimate(own: Readonly<Fighter>, option: number): MoveEstimate | undefined {
  if (option >= 30) {
    const specials = own.tuning.specials;
    if (specials === undefined) return undefined;
    const slot = option === 30 ? 0 : option === 31 ? 1 : option === 32 ? 2 : 3;
    const move = startableForm(own, specials, slot);
    if (move === undefined) return undefined;
    let damage = 0.0;
    let effect = noEffect;
    let startup = move.endFrame;
    for (const region of move.regions ?? []) {
      startup = Math.min(startup, region.firstFrame);
      if (region.hit.effect.damage > damage) { damage = region.hit.effect.damage; effect = region.hit.effect; }
    }
    for (const projectile of move.projectiles ?? []) {
      startup = Math.min(startup, projectile.spawnFrame);
      if (projectile.effect.damage > damage) { damage = projectile.effect.damage; effect = projectile.effect; }
    }
    if (move.commandGrab !== undefined) {
      startup = Math.min(startup, move.commandGrab.first);
      damage = move.commandGrab.effect.damage;
      effect = move.commandGrab.effect;
    }
    let travel = 0.0;
    for (const motion of move.motion ?? []) travel = f32(travel + f32(motion.velocityX * (motion.last - motion.first + 1)));
    return { damage, effect, startup, recovery: Math.max(0, move.endFrame - startup), travel };
  }
  const style = NORMAL_STYLES.find(candidate => candidate === option);
  if (style === undefined) return undefined;
  const startup = attackStartupFrames(style, own.tuning.moves);
  const move = own.tuning.moves?.normals[style];
  let damage = 0.0;
  let effect = noEffect;
  if (move !== undefined) {
    for (const region of move.regions) {
      if (region.hit.effect.damage > damage) { damage = region.hit.effect.damage; effect = region.hit.effect; }
    }
  } else {
    authoredHitRegion(hit, own.character, style, startup, 0, 0, own.tuning.moves);
    damage = hit.effect.damage;
    effect = { ...hit.effect };
  }
  return { damage, effect, startup, recovery: Math.max(0, attackDurationFramesForGrounding(style, own.motion.grounded, own.tuning.moves) - startup), travel: move?.startupTravelX ?? 0.0 };
}

/** Own stocks/clock are public; opponent percent/stocks come from the delayed sample. */
export function comebackPressure(own: Readonly<Fighter>, target: Readonly<Fighter>, game: Readonly<MatchState>): number {
  const stocks = Math.max(0, target.status.stocks - own.status.stocks);
  const trailing = own.status.stocks < target.status.stocks || (own.status.stocks === target.status.stocks && own.status.damage > target.status.damage);
  const shortClock = game.timeLimitMinutes > 0 && game.remainingFrames <= 30 * 60;
  return Math.min(100, stocks * 25 + (trailing && shortClock ? 50 : 0));
}

/** Reward, punish exposure and stage position are compared at the observed percent. */
export function estimatedMoveValue(move: MoveEstimate, own: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, success: number, policy: CpuDecisionPolicy, pressure: number): number {
  const afterDamage = f32(target.status.damage + move.damage);
  const knockback = contactKnockback(afterDamage, move.damage, target.tuning.physics.weight, move.effect.growth, move.effect.base, 1.0);
  const blast = stageBounds(stage).blast;
  const outward = target.motion.x >= 0.0 ? 1 : -1;
  const facing = target.motion.x >= own.motion.x ? 1 : -1;
  const horizontal = Math.max(0.0, f32(f32(move.effect.launchX * facing) * outward));
  const vertical = Math.max(0.0, move.effect.launchZ);
  const distance = horizontal > vertical ? f32((outward > 0 ? blast.right : f32(-blast.left)) - Math.abs(target.motion.x)) : f32(blast.top - target.motion.z);
  // The launch model estimates a useful trajectory; recoveries and DI can invalidate it.
  const projected = f32(f32(knockback * Math.max(horizontal, vertical)) * 4.0);
  const kill = Math.max(0, Math.min(100, Math.floor(f32(f32(projected - distance) + 100.0))));
  const reward = Math.floor(f32(move.damage * 6.0)) + floorDiv(kill * 2, 1);
  const punish = move.recovery + floorDiv(Math.floor(own.status.damage) * move.recovery, 100);
  const risk = floorDiv(punish * policy.punishWeight, 100);
  const endX = f32(own.motion.x + f32(move.travel * facing));
  const position = Math.min(20, Math.floor(f32(f32(Math.abs(own.motion.x) - Math.abs(endX)) * f32(0.1))));
  const varianceReward = floorDiv((pressure + policy.variancePercent) * (kill + move.startup), 100);
  return floorDiv(success * reward, 100) - floorDiv((100 - success) * risk, 100) + position + varianceReward;
}

function successEstimate(own: Readonly<Fighter>, target: Readonly<Fighter>, option: number, move: MoveEstimate, decision: AttackDecision): number {
  const context = habitContext(own, target);
  let samples = 0;
  let shields = 0;
  let jumps = 0;
  for (const habit of decision.strategy.history) {
    if (habit.context !== context) continue;
    samples++;
    if (habit.choice === HabitChoice.shield) shields++;
    if (habit.choice === HabitChoice.jump) jumps++;
  }
  const shieldShare = target.shield.raised ? 100 : samples === 0 ? 0 : floorDiv(shields * 100, samples);
  const jumpShare = samples === 0 ? 0 : floorDiv(jumps * 100, samples);
  const grabbing = option === AttackStyle.grab;
  const antiAir = option === AttackStyle.upTilt || option === AttackStyle.upSmash || option === AttackStyle.upAir;
  const chance = grabbing ? 45 + floorDiv(shieldShare * 45, 100)
    : 88 - floorDiv(shieldShare * 60, 100) - floorDiv(jumpShare * (antiAir ? 0 : 25), 100);
  return Math.max(10, Math.min(95, chance - floorDiv(move.startup, 3)));
}

/** Weights stay positive, retaining mix-ups and the fighter's existing kit/gameplan. */
export function moveValueMultiplier(own: Readonly<Fighter>, target: Readonly<Fighter>, option: number, decision: AttackDecision): number {
  const move = estimate(own, option);
  if (move === undefined) return 4;
  const pressure = comebackPressure(own, target, decision.game);
  const value = estimatedMoveValue(move, own, target, decision.game.stageChoice, successEstimate(own, target, option, move, decision), decision.policy, pressure);
  return Math.max(1, Math.min(12, 4 + floorDiv(value, 25)));
}

/** A familiar answer remains legal/eligible; low judgment also overvalues smashes. */
export function familiarOption(options: readonly number[], count: number, own: Readonly<Fighter>, frame: number, decision: AttackDecision): number | undefined {
  const policy = decision.policy;
  if (botChance(frame, own.character * 43 + own.attack.serial, policy.judgmentPercent, 100)) return undefined;
  if (botChance(frame, own.character * 23 + own.attack.serial, policy.repeatPercent, 100)) {
    for (let index = 0; index < count; index++) if (at(options, index) === decision.strategy.lastOption) return decision.strategy.lastOption;
  }
  const smashes: number[] = [];
  for (let index = 0; index < count; index++) {
    const option = at(options, index);
    const style = NORMAL_STYLES.find(candidate => candidate === option);
    if (style !== undefined && isSmashAttack(style)) smashes.push(option);
  }
  if (smashes.length > 0 && botChance(frame, own.character * 19 + own.attack.serial, 100 - policy.judgmentPercent, 100)) return at(smashes, botChoice(frame, own.character * 7, smashes.length));
  return at(options, botChoice(frame, own.attack.serial * 7 + own.character, count));
}
