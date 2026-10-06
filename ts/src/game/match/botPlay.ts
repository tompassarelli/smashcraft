// The computer opponent: each frame it reads the match and fills its
// fighter's controls and attack commands as a player's input would, so
// rollback replays and every client derive the same decisions from the same
// state. Every choice is a function of that state and the frame number.
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type AttackBuffer, clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { DownState, GrabAction, ShieldBreak } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { isSmashAttack } from "../sim/moves";
import { type Controls, type Roster, copyControls, fighterAt, isActive, neutralControls } from "../sim/roster";
import { surfacePass } from "../sim/stage";
import { type FighterGameplan, GameplanThrow } from "../sim/gameplan";
import { SPACE_PLAN, gameplanGoal, gameplanOf, gameplanPlan, gameplanThrow, jumpsIn, keptGap, plansRanged, spacingAerialAt } from "./botGameplan";
import { steerInAir, steerOnGround } from "./botFooting";
import { botChoice, chooseAttack, smashChargeGoal } from "./botMoves";
import { chooseDefense } from "./botDefense";
import { chooseRecoveryInput } from "./botRecovery";
import { pressHeroFollowUp } from "./botHeroKit";
import { MATCH_TICKS_PER_SECOND, type MatchState } from "./rules";
import { trainingPartnerInput } from "./training";

const COMPUTER_NEUTRAL = neutralControls();
const TICK = f32(1.0 / MATCH_TICKS_PER_SECOND);
/** Frames each plan lasts before the computer weighs another. */
const PLAN_FRAMES = 40;
/** Plans: pressure on the ground, jump in with aerials, or keep away and shoot. */
const Plan = { ground: 0, air: 1, range: 2 } as const;
type Plan = (typeof Plan)[keyof typeof Plan];
/** The distance a ranged plan keeps. */
const RANGE_SPACING = 320.0;
/** A target this much higher is worth a full jump. */
const ABOVE = 110.0;

function nearestOpponent(world: Roster, slot: ParticipantSlot, fighter: Readonly<Fighter>): Fighter | undefined {
  let nearest: Fighter | undefined;
  let distance = 0.0;
  for (const candidate of PARTICIPANT_SLOTS) {
    if (!isActive(world, candidate) || candidate === slot) continue;
    const target = fighterAt(world, candidate);
    if (target.status.out || target.status.stocks <= 0) continue;
    const gap = Math.abs(f32(target.motion.x - fighter.motion.x));
    if (nearest === undefined || gap < distance) {
      nearest = target;
      distance = gap;
    }
  }
  return nearest;
}

function planFor(f: Readonly<Fighter>, slot: number, frame: number): Plan {
  const choice = botChoice(floorDiv(frame, PLAN_FRAMES), slot * 13 + f.character, 6);
  return choice < 3 ? Plan.ground : choice < 5 ? Plan.air : Plan.range;
}

/** Holding a grab: the gameplan's throw, or each hold frame pummels, throws one of four ways, or waits. */
function followUpGrab(f: Readonly<Fighter>, held: Readonly<Fighter>, gameplan: FighterGameplan | undefined, frame: number, input: Controls): void {
  if (f.grab.action !== GrabAction.hold) return;
  const planned = gameplan === undefined ? undefined : gameplanThrow(gameplan, held, f.grab.serial, botChoice);
  if (planned !== undefined) {
    if (planned === GameplanThrow.forward || planned === GameplanThrow.back) input.grabThrowX = planned === GameplanThrow.forward ? f.facing : -f.facing;
    else input.grabThrowZ = planned === GameplanThrow.up ? 1 : -1;
    return;
  }
  const choice = botChoice(frame, f.grab.serial * 3 + f.character, 8);
  if (choice <= 2) input.attackPressed = true;
  else if (choice <= 4) input.grabThrowX = choice === 3 ? f.facing : -f.facing;
  else if (choice <= 6) input.grabThrowZ = choice === 5 ? 1 : -1;
}

/** Moves toward the target, or the plan's spot by it, staying on the stage; jumps for a target above or an aerial plan. */
function approach(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, plan: Plan, frame: number, input: Controls): void {
  const { motion } = f;
  const dx = f32(target.motion.x - motion.x);
  const dz = f32(target.motion.z - motion.z);
  const toward = dx < 0 ? -1 : 1;
  const goal = plan === Plan.range ? f32(target.motion.x - f32(toward * RANGE_SPACING)) : target.motion.x;
  if (!motion.grounded) {
    // Tumbling, it lets itself land and techs or gets up there, steering only to stay over the deck.
    steerInAir(f, stage, f.down.state === DownState.tumble ? motion.x : goal, input);
    if (plan === Plan.air && dz > ABOVE && motion.vz < 0 && f.jump.remaining > 0 && Math.abs(dx) < 200) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    }
    return;
  }
  steerOnGround(f, stage, goal, input);
  if (f.jump.squat > 0) {
    input.jumpHeld = dz > ABOVE;
    return;
  }
  // A platform drops through on a fresh press of down.
  if (motion.surface !== undefined && surfacePass(stage, motion.surface) && dz < -80) {
    input.down = floorMod(frame, 8) < 4;
    return;
  }
  const close = Math.abs(dx) >= 60 && Math.abs(dx) <= 240 && Math.abs(dz) <= 120;
  if ((dz > ABOVE && Math.abs(dx) < 300) || (plan === Plan.air && close)) {
    input.jumpPressed = true;
    input.jumpHeld = dz > ABOVE;
  }
}

/** Under a gameplan: keeps the plan's gap on the stage, short-hops into a spacing aerial, jumps in when the plan does. */
function approachByGameplan(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, gameplan: FighterGameplan, slot: number, planIndex: number, frame: number, input: Controls): void {
  const { motion } = f;
  const dx = f32(target.motion.x - motion.x);
  const dz = f32(target.motion.z - motion.z);
  const goal = gameplanGoal(gameplan, f, target, stage, keptGap(gameplan, f, target, slot, planIndex, frame, botChoice));
  if (!motion.grounded) {
    steerInAir(f, stage, f.down.state === DownState.tumble ? motion.x : goal, input);
    if (jumpsIn(gameplan, planIndex, target, dx, dz) && dz > ABOVE && motion.vz < 0 && f.jump.remaining > 0) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    }
    return;
  }
  steerOnGround(f, stage, goal, input);
  if (f.jump.squat > 0) {
    input.jumpHeld = dz > ABOVE;
    return;
  }
  if (motion.surface !== undefined && surfacePass(stage, motion.surface) && dz < -80) {
    input.down = floorMod(frame, 8) < 4;
    return;
  }
  // Under the spacing plan a spacing aerial at its gap is a short hop away, one frame in four.
  const hop = planIndex === SPACE_PLAN && spacingAerialAt(gameplan, Math.abs(dx)) && botChoice(frame, slot * 5 + f.character, 4) === 0;
  if (hop || jumpsIn(gameplan, planIndex, target, dx, dz)) {
    input.jumpPressed = true;
    input.jumpHeld = dz > ABOVE;
  }
}

/** Correcting human movement also corrects every computer decision derived from it. */
export function produceComputerInput(game: Readonly<MatchState>, world: Roster, runtime: { botAttackDelays: Slots<number> }, slot: ParticipantSlot, frame: number, input: Controls, commands: AttackBuffer): void {
  const fighter = fighterAt(world, slot);
  copyControls(input, COMPUTER_NEUTRAL);
  clearAttackBuffer(commands);
  if (fighter.status.out) return;
  if (game.training && trainingPartnerInput(game.trainer, world, slot, game.stageChoice, game.matchFrame, frame, input, commands)) return;
  const delay = f32(runtime.botAttackDelays[slot] - TICK);
  runtime.botAttackDelays[slot] = delay;
  const stage = game.stageChoice;
  const target = nearestOpponent(world, slot, fighter);
  const gameplan = gameplanOf(fighter.character);
  if (fighter.launch.hitlag > 0) {
    // Hitlag's last frame reads the stick for directional influence: in toward the middle.
    if (fighter.launch.diPending) input.direction = fighter.motion.x < 0 ? 1 : -1;
    return;
  }
  if (fighter.status.frozenFrames > 0) {
    // A human-paced mash, 10 presses a second, so a trap still rewards Rifleman.
    input.grabMashPressed = floorMod(frame, 6) === 0;
    return;
  }
  if (fighter.grab.owner !== undefined) {
    input.grabMashPressed = floorMod(frame, 2) === 0;
    input.direction = floorMod(frame, 4) < 2 ? 1 : -1;
    return;
  }
  if (fighter.grab.target !== undefined) {
    followUpGrab(fighter, fighterAt(world, fighter.grab.target), gameplan, frame, input);
    return;
  }
  if (fighter.shield.breakState !== ShieldBreak.none) {
    input.mashPressed = floorMod(frame, 2) === 0;
    return;
  }
  if (target !== undefined && pressHeroFollowUp(fighter, target, input)) return;
  if (chooseRecoveryInput(fighter, stage, game.matchFrame, input, target)) return;
  if (isSmashAttack(fighter.attack.style) && fighter.attack.smashChargeAllowed) input.attackHeld = fighter.attack.smashChargeFrames < smashChargeGoal(fighter);
  if (target === undefined) return;
  if (chooseDefense(fighter, target, stage, input)) return;
  if (gameplan === undefined) {
    const plan = planFor(fighter, slot, frame);
    if (delay <= 0 && chooseAttack(fighter, target, stage, game.matchFrame, frame, plan === Plan.range, input, commands)) {
      runtime.botAttackDelays[slot] = f32(f32(6 + botChoice(frame, fighter.attack.serial, 18)) * TICK);
      if (!fighter.motion.grounded) steerInAir(fighter, stage, target.motion.x, input);
      return;
    }
    approach(fighter, target, stage, plan, frame, input);
    return;
  }
  const planIndex = gameplanPlan(gameplan, fighter, slot, frame, botChoice);
  if (delay <= 0 && chooseAttack(fighter, target, stage, game.matchFrame, frame, plansRanged(gameplan, planIndex), input, commands, slot, planIndex)) {
    runtime.botAttackDelays[slot] = f32(f32(6 + botChoice(frame, fighter.attack.serial, 18)) * TICK);
    if (!fighter.motion.grounded) steerInAir(fighter, stage, gameplanGoal(gameplan, fighter, target, stage, 0.0), input);
    return;
  }
  approachByGameplan(fighter, target, stage, gameplan, slot, planIndex, frame, input);
}
