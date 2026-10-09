// The computer opponent: each frame it reads the match and fills its
// fighter's controls and attack commands as a player's input would, so
// rollback replays and every client derive the same decisions from the same
// state. Every choice is a function of that state and the frame number.
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type AttackBuffer, clearAttackBuffer, copyAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { DownState, GrabAction, ShieldBreak } from "../sim/codes";
import { heroStatusBlocksActions, heroStatusMashes } from "../sim/heroStatus";
import type { Fighter } from "../sim/fighter";
import { exSpecialAffordable } from "../sim/exSpecials";
import { Character, SpecialAction } from "../sim/codes";
import { isSmashAttack } from "../sim/moves";
import { type Controls, type Roster, copyControls, fighterAt, neutralControls } from "../sim/roster";
import { surfacePass } from "../sim/stage";
import { type FighterGameplan, GameplanThrow } from "../sim/gameplan";
import { SPACE_PLAN, avoids, gameplanGoal, gameplanOf, gameplanPlan, gameplanThrow, jumpsIn, keptGap, onAnotherDeck, plansRanged, spacingAerialAt } from "./botGameplan";
import { steerInAir, steerOnGround } from "./botFooting";
import { chooseAttack, lastChoicePassedForVariety, smashChargeGoal } from "./botMoves";
import { botChance, botChoice, useMatchSeed } from "./botRandom";
import { type CpuSkill, cpuSkill, cpuReactionFloor, cpuReactionFrames, perceivedCpuSkill } from "./cpuSkill";
import { FAST_BOT_HISTORY_FRAMES, BOT_HISTORY_FRAMES, type BotMemory, observeOpponents, perceivedOpponent, perceivedHeldFighter, commitBotDirection, samePerception } from "./botPerception";
import { chooseDefense } from "./botDefense";
import { choosePunish } from "./botPunish";
import { chooseRecoveryInput } from "./botRecovery";
import { pressHeroFollowUp } from "./botHeroKit";
import { dashIn, pressKitOption, pressUltimate, steerHeroBranches, steerRunningSpecial } from "./botKitOptions";
import { MATCH_TICKS_PER_SECOND, type MatchState, stageClock, computerActive } from "./rules";
import { trainingPartnerInput } from "./training";
import { sameFighterState } from "../replay/fighterState";
import { type BotStrategy, copyBotStrategy, learnBotHabit, prepareBotRead, pressBotRead, sameBotStrategy } from "./botStrategy";
import { applyAerialExecutionNoise, chooseHitlagInput } from "./botExecutionNoise";
import { executeBotTechnique, type TechnicalOutcome } from "./botTechnicalExecution";
import type { BotDecision } from "./pacingAndPresentation";

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

interface BotRuntime { botAttackDelays: Slots<number>; readonly botMemory: BotMemory; readonly botStrategies: Slots<BotStrategy> }

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
  const goal = plan === Plan.range && !onAnotherDeck(f, target) ? f32(target.motion.x - f32(toward * RANGE_SPACING)) : target.motion.x;
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
function approachByGameplan(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, gameplan: FighterGameplan, slot: number, planIndex: number, frame: number, input: Controls, skill: CpuSkill): void {
  const { motion } = f;
  const dx = f32(target.motion.x - motion.x);
  const dz = f32(target.motion.z - motion.z);
  const goal = gameplanGoal(gameplan, f, target, stage, keptGap(gameplan, f, target, slot, planIndex, frame, botChoice));
  if (!motion.grounded) {
    steerInAir(f, stage, f.down.state === DownState.tumble ? motion.x : goal, input);
    if (jumpsIn(gameplan, planIndex, f, target, dx, dz) && dz > ABOVE && motion.vz < 0 && f.jump.remaining > 0) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    }
    return;
  }
  steerOnGround(f, stage, goal, input);
  dashIn(f, target, stage, skill, frame, !avoids(gameplan, "close"), input);
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
  if (hop || jumpsIn(gameplan, planIndex, f, target, dx, dz)) {
    input.jumpPressed = true;
    input.jumpHeld = dz > ABOVE;
  }
}

function reactionDelay(game: Readonly<MatchState>, runtime: Readonly<BotRuntime>, fighter: Fighter, slot: ParticipantSlot, frame: number, skill: CpuSkill): number {
  const floor = cpuReactionFloor(fighter, skill);
  const cue = perceivedOpponent(runtime.botMemory, fighter, slot, frame, floor);
  // Only information old enough for this kind of answer may affect its seeded delay.
  const key = cue === undefined ? 0 : cue.attack.serial * 31 + cue.special.action * 17
    + (cue.motion.x < fighter.motion.x ? 1 : 2) + (cue.shield.raised ? 4 : 0)
    + (cue.motion.grounded ? 8 : 0) + cue.ledge.state * 64 + cue.down.state * 256;
  return cpuReactionFrames(fighter, skill, game.matchSeed, slot, key);
}

function observationFrames(game: Readonly<MatchState>, skill: CpuSkill): number {
  if (skill.tier === "rookie" || skill.tier === "beginner") return BOT_HISTORY_FRAMES;
  for (const slot of PARTICIPANT_SLOTS) {
    if (computerActive(game, slot) && (game.cpuTiers[slot] === "rookie" || game.cpuTiers[slot] === "beginner")) return BOT_HISTORY_FRAMES;
  }
  return FAST_BOT_HISTORY_FRAMES;
}

/**
 * The computer in `slot` plays its resolved identity and tier under the match seed. Correcting
 * human movement also corrects every computer decision derived from it.
 */
export function produceComputerInput(game: Readonly<MatchState>, world: Roster, runtime: BotRuntime, slot: ParticipantSlot, frame: number, input: Controls, commands: AttackBuffer, skillOverride?: CpuSkill): TechnicalOutcome {
  useMatchSeed(game.matchSeed);
  const opponent = game.cpuResolvedOpponents[slot];
  const tier = game.cpuTiers[slot];
  const skill = skillOverride ?? cpuSkill(opponent, tier);
  observeOpponents(runtime.botMemory, world, frame, observationFrames(game, skill));
  const fighter = fighterAt(world, slot);
  const reactionFrames = reactionDelay(game, runtime, fighter, slot, frame, skill);
  useMatchSeed(game.matchSeed);
  const target = fighter.grab.target === undefined ? perceivedOpponent(runtime.botMemory, fighter, slot, frame, reactionFrames)
    : perceivedHeldFighter(runtime.botMemory, fighter.grab.target, frame, reactionFrames);
  const strategy = runtime.botStrategies[slot];
  if (target !== undefined) {
    const ownObserved = perceivedHeldFighter(runtime.botMemory, slot, frame, reactionFrames);
    const opponent = PARTICIPANT_SLOTS.find(candidate => candidate !== slot && perceivedHeldFighter(runtime.botMemory, candidate, frame, reactionFrames) === target);
    if (ownObserved !== undefined && opponent !== undefined) learnBotHabit(strategy, ownObserved, target, opponent, frame - reactionFrames, skill.decision);
    prepareBotRead(strategy, fighter, target, frame, reactionFrames, skill.decision);
  }
  decide(game, world, runtime, slot, frame, input, commands, skillOverride === undefined ? perceivedCpuSkill(opponent, tier) : { ...skill, reactionFrames: 0 }, target, reactionFrames);
  const execution = executeBotTechnique(fighter, input, commands, frame, slot, skill.decision);
  upgradeThreatenedSpecial(fighter, target, input);
  if (fighter.launch.hitlag <= 0 && fighter.launch.hitstun > 0) chooseHitlagInput(fighter, slot, frame, skill, input);
  if (!game.training) applyAerialExecutionNoise(fighter, target, slot, skill, input);
  // DI and escape mashing are reactions to the fighter's own state, not steering.
  if (fighter.launch.hitlag <= 0 && fighter.grab.owner === undefined) commitBotDirection(runtime.botMemory, slot, frame, input, tier, skill.decision);
  useMatchSeed(0);
  return execution;
}

const negativeZero = (value: number): boolean => value === 0 && 1 / value < 0;

/**
 * Whether produceComputerInput for `slot` at `frame` reads the same state as
 * it did from `before`, so it decides the same. It reads the match seed, the
 * slot's identity and tier, training, the stage and its clock, the time
 * limit, the slot's own fighter, its perceived sample and committed
 * direction, its strategy and its attack delay; a new read joins this list.
 * `fighterSame` says the slot's fighter is known to equal the earlier one.
 */
export function sameComputerInputs(game: Readonly<MatchState>, world: Readonly<Roster>, runtime: Readonly<BotRuntime>, before: Readonly<MatchState>, beforeWorld: Readonly<Roster>, beforeRuntime: Readonly<BotRuntime>, slot: ParticipantSlot, frame: number, fighterSame = false): boolean {
  if (game.training || before.training || world.mask !== beforeWorld.mask) return false;
  const opponent = game.cpuResolvedOpponents[slot];
  const tier = game.cpuTiers[slot];
  if (opponent !== before.cpuResolvedOpponents[slot] || tier !== before.cpuTiers[slot] || game.matchSeed !== before.matchSeed) return false;
  if (game.stageChoice !== before.stageChoice || stageClock(game) !== stageClock(before)) return false;
  if (game.timeLimitMinutes !== before.timeLimitMinutes || game.remainingFrames !== before.remainingFrames) return false;
  const fighter = fighterAt(world, slot);
  const skill = cpuSkill(opponent, tier);
  if (observationFrames(game, skill) !== observationFrames(before, skill)) return false;
  const delay = reactionDelay(game, runtime, fighter, slot, frame, skill);
  // With no delay the computer sees this frame's observation, which a rollback rewrites.
  if (delay < 1) return false;
  const attackDelay = runtime.botAttackDelays[slot];
  const beforeDelay = beforeRuntime.botAttackDelays[slot];
  if (attackDelay !== beforeDelay || negativeZero(attackDelay) !== negativeZero(beforeDelay)) return false;
  if (!sameBotStrategy(runtime.botStrategies[slot], beforeRuntime.botStrategies[slot])) return false;
  if (!samePerception(runtime.botMemory, beforeRuntime.botMemory, slot, frame, cpuReactionFloor(fighter, cpuSkill(opponent, tier)))) return false;
  if (!samePerception(runtime.botMemory, beforeRuntime.botMemory, slot, frame, delay)) return false;
  if (fighterSame) return true;
  const earlier = fighterAt(beforeWorld, slot);
  return sameFighterState(fighter, earlier);
}

/**
 * As produceComputerInput, from a state sameComputerInputs matched with the
 * state before a step that decided `decision`: the computer observes this
 * frame and takes that step's decision and its strategy, delay and direction.
 */
export function repeatComputerInput(world: Readonly<Roster>, runtime: BotRuntime, after: Readonly<BotRuntime>, decision: Readonly<BotDecision>, slot: ParticipantSlot, frame: number, input: Controls, commands: AttackBuffer): void {
  observeOpponents(runtime.botMemory, world, frame, Math.max(FAST_BOT_HISTORY_FRAMES, after.botMemory.history.length));
  copyControls(input, decision.input);
  const grace = commands.graceFrames;
  clearAttackBuffer(commands);
  copyAttackBuffer(commands, decision.commands);
  commands.graceFrames = grace;
  runtime.botAttackDelays[slot] = after.botAttackDelays[slot];
  copyBotStrategy(runtime.botStrategies[slot], after.botStrategies[slot]);
  runtime.botMemory.directions[slot] = after.botMemory.directions[slot];
  runtime.botMemory.directionFrames[slot] = after.botMemory.directionFrames[slot];
}

/** The delayed opponent observation decides whether a cast needs startup armor. */
export function upgradeThreatenedSpecial(fighter: Readonly<Fighter>, target: Readonly<Fighter> | undefined, input: Controls): void {
  if (target === undefined || !input.specialPressed || fighter.special.action !== SpecialAction.none
    || target.attack.style === undefined || Math.abs(f32(target.motion.x - fighter.motion.x)) > 140.0
    || Math.abs(f32(target.motion.z - fighter.motion.z)) > 140.0 || !exSpecialAffordable(fighter)) return;
  if (fighter.character === Character.demonHunter && input.specialX === 0 && input.specialZ === 0) return;
  input.shield = true;
}

/** Half a second: a computer that idles stands still this long. */
const IDLE_FRAMES = 30;

function decide(game: Readonly<MatchState>, world: Roster, runtime: BotRuntime, slot: ParticipantSlot, frame: number, input: Controls, commands: AttackBuffer, skill: CpuSkill, target: Readonly<Fighter> | undefined, observationAge: number): void {
  const fighter = fighterAt(world, slot);
  copyControls(input, COMPUTER_NEUTRAL);
  clearAttackBuffer(commands);
  if (fighter.status.out) return;
  if (game.training && trainingPartnerInput(game.trainer, world, slot, game.stageChoice, stageClock(game), frame, input, commands)) return;
  const delay = f32(runtime.botAttackDelays[slot] - TICK);
  runtime.botAttackDelays[slot] = delay;
  const stage = game.stageChoice;
  const stageFrame = stageClock(game);
  const gameplan = gameplanOf(fighter.character, skill.basicMoves);
  if (fighter.launch.hitlag > 0) {
    chooseHitlagInput(fighter, slot, frame, skill, input);
    return;
  }
  if (fighter.status.frozenFrames > 0 || heroStatusMashes(fighter)) {
    // A human-paced mash, 10 presses a second, so a trap, a Sleep or a Hex still rewards its user.
    input.grabMashPressed = floorMod(frame, skill.freezeMashFrames) === 0;
    // A Hex leaves movement, shields and jumps: the computer keeps playing between presses.
    if (fighter.status.frozenFrames > 0 || heroStatusBlocksActions(fighter)) return;
  }
  if (fighter.grab.owner !== undefined) {
    input.grabMashPressed = floorMod(frame, skill.grabMashFrames) === 0;
    input.direction = floorMod(frame, 4) < 2 ? 1 : -1;
    return;
  }
  if (fighter.grab.target !== undefined) {
    if (skill.basicMoves !== undefined) input.grabThrowX = fighter.facing;
    else if (target !== undefined) followUpGrab(fighter, target, gameplan, frame, input);
    return;
  }
  if (fighter.shield.breakState !== ShieldBreak.none) {
    input.mashPressed = floorMod(frame, skill.grabMashFrames) === 0;
    return;
  }
  if (skill.basicMoves === undefined && target !== undefined && (steerHeroBranches(fighter, target, skill, input) || pressHeroFollowUp(fighter, target, stage, input))) return;
  const recovering = chooseRecoveryInput(fighter, stage, stageFrame, input, target, skill);
  if (steerRunningSpecial(fighter, target, stage, skill, input) || recovering) return;
  if (isSmashAttack(fighter.attack.style) && fighter.attack.smashChargeAllowed) input.attackHeld = fighter.attack.smashChargeFrames < smashChargeGoal(fighter);
  if (target === undefined) return;
  if (chooseDefense(fighter, target, stage, input, skill, observationAge)) return;
  // An opponent that can't act yet is punished before any pause or idle stretch.
  if (skill.basicMoves === undefined && choosePunish(fighter, target, stage, stageFrame, frame, skill, input, commands, observationAge)) {

    runtime.botAttackDelays[slot] = f32(f32(skill.attackPause + botChoice(frame, fighter.attack.serial, skill.attackSpread)) * TICK);
    return;
  }
  if (skill.basicMoves === undefined && pressBotRead(runtime.botStrategies[slot], fighter, target, stage, stageFrame, frame, input, commands)) return;
  // An idle stretch stands where it is: no approach, no attack.
  if (botChance(floorDiv(frame, IDLE_FRAMES), slot * 17 + fighter.character, skill.idle, 100)) return;
  if (skill.basicMoves === undefined && !game.ultimatesOff && pressUltimate(fighter, target, skill, frame, input)) return;
  if (skill.basicMoves === undefined && pressKitOption(fighter, target, stage, skill, frame, delay <= 0, input, commands)) {
    if (input.specialPressed || input.attackHeld) runtime.botAttackDelays[slot] = f32(f32(skill.attackPause + botChoice(frame, fighter.attack.serial, skill.attackSpread)) * TICK);
    return;
  }
  if (gameplan === undefined) {
    const plan = planFor(fighter, slot, frame);
    if (delay <= 0 && chooseAttack(fighter, target, stage, stageFrame, frame, plan === Plan.range, input, commands, slot, SPACE_PLAN, skill, observationAge, { strategy: runtime.botStrategies[slot], policy: skill.decision, game })) {
      runtime.botAttackDelays[slot] = f32(f32(skill.attackPause + botChoice(frame, fighter.attack.serial, skill.attackSpread)) * TICK);
      if (!fighter.motion.grounded) steerInAir(fighter, stage, target.motion.x, input);
      return;
    }
    approach(fighter, target, stage, plan, frame, input);
    return;
  }
  const planIndex = gameplanPlan(gameplan, fighter, slot, frame, botChoice);
  if (delay <= 0 && chooseAttack(fighter, target, stage, stageFrame, frame, plansRanged(gameplan, planIndex), input, commands, slot, planIndex, skill, observationAge, { strategy: runtime.botStrategies[slot], policy: skill.decision, game })) {
    runtime.botAttackDelays[slot] = f32(f32(skill.attackPause + botChoice(frame, fighter.attack.serial, skill.attackSpread)) * TICK);
    if (!fighter.motion.grounded) steerInAir(fighter, stage, gameplanGoal(gameplan, fighter, target, stage, gameplan.range.near), input);
    return;
  }
  if (delay <= 0 && lastChoicePassedForVariety()) approach(fighter, target, stage, Plan.ground, frame, input);
  else approachByGameplan(fighter, target, stage, gameplan, slot, planIndex, frame, input, skill);
}
