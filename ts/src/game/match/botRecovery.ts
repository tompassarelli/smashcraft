


import { lavaLeft, lavaRight, overLava } from "../sim/lava";
import { runningHeroSpecial, specialCooldownReady } from "../sim/heroSpecialRules";
import { upSpecialStartable } from "./botHeroKit";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { toInt } from "../../runtime/numbers";
import { TECH_REPEAT_MINIMUM_AGE_FRAMES } from "../physics/techInput";
import { Character, DownState, LedgeState, PlatformMove, SpecialAction } from "../sim/codes";
import { isTumbling } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { totalVelocityZ } from "../sim/motion";
import { RIFLEMAN_RECOVERY_STARTUP_FRAMES } from "../sim/specials";
import type { Controls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight, mainDeckZ, surfaceCount, surfaceLeft, surfacePass, surfaceRight, surfaceZ, surfaceZAt } from "../sim/stage";
import { botChance, botChoice } from "./botRandom";
import { type CpuSkill, FULL_SKILL } from "./cpuSkill";
import { aimsLedge, gameplanOf, upSpecialFirst } from "./botGameplan";


const TECH_LEAD_FRAMES = 6;

const LEDGE_ATTACK_NEAR = 30.0;
const LEDGE_ATTACK_FAR = 210.0;

const LEDGE_LINE_NEAR = 25.0;
const LEDGE_LINE_FAR = 50.0;
const LEDGE_LINE_REACH = 60.0;

const LEDGE_MISSED = 110.0;

const LEDGE_WAIT_FRAMES = 90;

const SPECIAL_FIRST_REACH = 200.0;

const GETUP_WAIT_FRAMES = 60;

const GETUP_ATTACK_REACH = 150.0;

const LedgeOption = { hang: 0, climb: 1, roll: 2, jump: 3, attack: 4 } as const;
type LedgeOption = (typeof LedgeOption)[keyof typeof LedgeOption];

function ledgeOption(f: Readonly<Fighter>, stage: number, target: Readonly<Fighter> | undefined): LedgeOption {
  if (target === undefined) return LedgeOption.climb;
  const { side } = f.ledge;
  const edge = side < 0 ? mainDeckLeft(stage) : mainDeckRight(stage);
  const inward = f32(f32(edge - target.motion.x) * side);
  const near = !target.status.out && inward >= LEDGE_ATTACK_NEAR && inward <= LEDGE_ATTACK_FAR && Math.abs(f32(target.motion.z - mainDeckZ(stage))) <= 90;
  const choice = botChoice(f.ledge.serial + toInt(f.status.damage), f.visuals.hit * 3 + f.character, 6);
  if (near && choice < 5) return LedgeOption.attack;

  if (choice < 5 && f.ledge.frame < LEDGE_WAIT_FRAMES) return LedgeOption.hang;
  return choice === 3 ? LedgeOption.roll : choice === 4 ? LedgeOption.jump : choice === 5 ? LedgeOption.attack : LedgeOption.climb;
}


function chooseLedgeOption(f: Readonly<Fighter>, stage: number, input: Controls, target: Readonly<Fighter> | undefined, mixesUp: boolean): void {
  const { ledge } = f;
  input.direction = -ledge.side;
  if (ledge.state !== LedgeState.hang) return;
  switch (mixesUp ? ledgeOption(f, stage, target) : LedgeOption.climb) {
    case LedgeOption.hang:
      return;
    case LedgeOption.climb:
      input.ledgeVerticalPressed = 1;
      return;
    case LedgeOption.roll:
      input.airDodgePressed = true;
      return;
    case LedgeOption.jump:
      input.jumpPressed = true;
      input.jumpHeld = true;
      return;
    case LedgeOption.attack:
      input.getupAttackPressed = true;
      return;
  }
}








function chooseGetUp(f: Readonly<Fighter>, input: Controls, target: Readonly<Fighter> | undefined, mixesUp: boolean): boolean {
  const { state } = f.down;
  if (!f.motion.grounded || (state !== DownState.bound && state !== DownState.wait && state !== DownState.damage)) return false;
  const choice = botChoice(f.visuals.hit + toInt(f.status.damage), f.character * 11 + f.ledge.serial, 4);
  const near = target !== undefined && !target.status.out && Math.abs(f32(target.motion.x - f.motion.x)) <= GETUP_ATTACK_REACH
    && Math.abs(f32(target.motion.z - f.motion.z)) <= 100;
  const inward = f.motion.x < 0 ? 1 : -1;
  const away = target === undefined ? inward : target.motion.x < f.motion.x ? 1 : -1;

  const waits = choice === 1 && state === DownState.wait && f.down.frame < GETUP_WAIT_FRAMES;
  if (!mixesUp) input.getupStandPressed = true;
  else if (near && choice < 3) input.getupAttackPressed = true;
  else if (near) input.direction = away;
  else if (choice === 0) input.getupAttackPressed = true;
  else if (choice === 2) input.direction = inward;
  else if (!waits) input.getupStandPressed = true;
  return true;
}






function techLanding(f: Readonly<Fighter>, stage: number, matchFrame: number, input: Controls, skill: CpuSkill): void {
  const { motion } = f;
  if (f.down.state !== DownState.tumble || motion.grounded || motion.deltaZ >= 0
    || botChance(f.visuals.hit + toInt(f.status.damage), f.character * 5 + 1, skill.techMiss, skill.techOutOf)) return;
  const lead = f32(f32(-motion.deltaZ) * TECH_LEAD_FRAMES);
  for (let deck = 0; deck < surfaceCount(stage); deck++) {
    const height = f32(motion.z - surfaceZAt(stage, deck, matchFrame, motion.x));
    if (height < 0 || height > lead || motion.x < surfaceLeft(stage, deck, matchFrame) || motion.x > surfaceRight(stage, deck, matchFrame)) continue;
    input.direction = botChoice(f.visuals.hit, f.character, 2) === 0 ? 0 : motion.x < 0 ? 1 : -1;
    input.techPressed = f.tech.pressAge >= TECH_REPEAT_MINIMUM_AGE_FRAMES;
    return;
  }
}

function upSpecial(character: Character): SpecialAction {
  switch (character) {
    default:
      return SpecialAction.heroUp;
    case Character.rifleman:
      return SpecialAction.riflemanRecovery;
    case Character.demonHunter:
      return SpecialAction.demonHunterWingAscent;
  }
}






function aimsForLedge(f: Readonly<Fighter>, side: number, target: Readonly<Fighter> | undefined, mixesUp: boolean): boolean {
  const taken = target !== undefined && target.ledge.state !== LedgeState.none && target.ledge.side === side;
  const spare = f.jump.remaining > 0 || upSpecialStartable(f, specialCooldownReady(f, upSpecial(f.character)));
  const coin = botChoice(f.visuals.hit + toInt(f.status.damage), f.character * 7 + 3, 2) === 0;
  const gameplan = gameplanOf(f.character);
  return mixesUp && f.facing === -side && !taken && spare && (gameplan === undefined ? coin : aimsLedge(gameplan, coin));
}


const AIM_INSIDE = 40.0;
const AIM_ABOVE = 30.0;
const AIM_SAMPLES = 8;

const AIM_UNDER_DECK = 1000000.0;
const DIAGONAL = 0.7071067690849304;







function aimUpSpecial(f: Readonly<Fighter>, stage: number, side: number, input: Controls): void {
  if (f.special.action === SpecialAction.riflemanRecovery) {
    if (f.special.frame < RIFLEMAN_RECOVERY_STARTUP_FRAMES) input.verticalDirection = 1;
    return;
  }
  if (f.special.action !== SpecialAction.heroUp) return;
  const move = runningHeroSpecial(f);
  if (move?.aimFrames === undefined || f.special.frame >= move.aimFrames) return;
  let reach = 0.0;
  for (const segment of move.motion ?? []) {
    if (segment.aimedSpeed !== undefined) reach = f32(reach + f32(segment.aimedSpeed * (segment.last - segment.first + 1)));
  }
  if (reach <= 0.0) return;
  const left = mainDeckLeft(stage);
  const right = mainDeckRight(stage);
  const floor = mainDeckZ(stage);
  const targetX = f32(f32(side < 0 ? left : right) - f32(side * AIM_INSIDE));
  const targetZ = f32(floor + AIM_ABOVE);
  const { x, z } = f.motion;
  let best = -1.0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (dx === 0 && dz === 0) continue;
    const step = dx !== 0 && dz !== 0 ? f32(reach * DIAGONAL) : reach;
    const endX = f32(x + f32(dx * step));
    const endZ = f32(z + f32(dz * step));
    let score = f32(f32(f32(endX - targetX) * f32(endX - targetX)) + f32(f32(endZ - targetZ) * f32(endZ - targetZ)));
    for (let sample = 1; sample <= AIM_SAMPLES; sample++) {
      const sx = f32(x + f32(f32(dx * step) * f32(sample / AIM_SAMPLES)));
      const sz = f32(z + f32(f32(dz * step) * f32(sample / AIM_SAMPLES)));
      if (sx > left && sx < right && sz < floor) {
        score = f32(score + AIM_UNDER_DECK);
        break;
      }
    }
    if (best < 0.0 || score < best) {
      best = score;
      input.direction = dx;
      input.verticalDirection = dz;
    }
  }
}





const PLATFORM_TARGET_BELOW = 80.0;
const PLATFORM_CONTACT_LEAD_FRAMES = 12;

function platformBelow(f: Readonly<Fighter>, stage: number, matchFrame: number): number | undefined {
  const { x, z, vz } = f.motion;
  const reach = f32(-vz * PLATFORM_CONTACT_LEAD_FRAMES);
  for (let i = 0; i < surfaceCount(stage); i++) {
    if (!surfacePass(stage, i) || x < surfaceLeft(stage, i, matchFrame) || x > surfaceRight(stage, i, matchFrame)) continue;
    const gap = f32(z - surfaceZ(stage, i, matchFrame));
    if (gap >= 0 && gap <= reach) return i;
  }
  return undefined;
}

/** Below the higher tiers it stands on every platform it climbs; above, it climbs on toward a target above it and otherwise stands. */
function choosePlatformClimb(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, stage: number, matchFrame: number, input: Controls, skill: CpuSkill): void {
  const deck = f.platform.deck ?? 0;
  if (skill.platformCancels && target !== undefined && target.motion.z > surfaceZ(stage, deck, matchFrame) && !target.motion.grounded) return;
  input.down = true;
  input.verticalDirection = -1;
}

/** Falling onto a platform: a target below is reached by dropping through it (ending any aerial). */
function choosePlatformContact(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, stage: number, matchFrame: number, input: Controls): void {
  if (target === undefined || f.motion.grounded || f.motion.vz >= 0 || f.launch.hitstun > 0 || f.dodge.airDodging) return;
  const deck = platformBelow(f, stage, matchFrame);
  if (deck === undefined) return;
  if (target.motion.z < f32(surfaceZ(stage, deck, matchFrame) - PLATFORM_TARGET_BELOW)) {
    input.down = true;
    input.verticalDirection = -1;
  }
}

export function chooseRecoveryInput(fighter: Readonly<Fighter>, stage: number, matchFrame: number, input: Controls, target?: Readonly<Fighter>, skill: CpuSkill = FULL_SKILL): boolean {
  input.specialPressed = false;
  input.specialX = 0;
  input.specialZ = 0;
  input.verticalDirection = 0;
  input.ledgeVerticalPressed = 0;
  if (fighter.status.out) return false;
  if (fighter.ledge.state !== LedgeState.none) {
    chooseLedgeOption(fighter, stage, input, target, skill.mixesUp);
    return true;
  }
  if (fighter.platform.move === PlatformMove.ascent) {
    choosePlatformClimb(fighter, target, stage, matchFrame, input, skill);
    return true;
  }
  if (chooseGetUp(fighter, input, target, skill.mixesUp)) return true;
  techLanding(fighter, stage, matchFrame, input, skill);
  const left = mainDeckLeft(stage);
  const right = mainDeckRight(stage);
  const floor = mainDeckZ(stage);
  const { x, z, grounded } = fighter.motion;
  if (!grounded && overLava(stage, matchFrame, x) && z >= floor) {

    input.direction = f32(x - lavaLeft(matchFrame)) < f32(lavaRight(matchFrame) - x) ? -1 : 1;
    return true;
  }
  if (skill.platformCancels) choosePlatformContact(fighter, target, stage, matchFrame, input);
  if (grounded || (x >= left && x <= right && z >= floor)) {
    const move = fighter.special.action === SpecialAction.heroUp ? runningHeroSpecial(fighter) : undefined;
    if (move?.aimFrames !== undefined && fighter.special.frame < move.aimFrames) {

      input.direction = 0;
      input.verticalDirection = 1;
      return true;
    }
    return false;
  }
  const side = x < 0 ? -1 : 1;
  const outside = f32(f32(x - (side < 0 ? left : right)) * side);
  const ledge = outside > 0 && aimsForLedge(fighter, side, target, skill.mixesUp);

  if (ledge) input.direction = outside < LEDGE_LINE_NEAR ? side : outside > LEDGE_LINE_FAR ? -side : 0;
  else if (z < floor && outside < LEDGE_LINE_NEAR) input.direction = side;
  else input.direction = x < (side < 0 ? f32(left + 60) : f32(right - 60)) ? 1 : -1;
  aimUpSpecial(fighter, stage, side, input);


  if (isTumbling(fighter) && fighter.launch.hitstun <= 0 && input.direction !== 0 && fighter.motion.previousStickSide === input.direction
    && f32(fighter.motion.vx * input.direction) < fighter.tuning.physics.airSpeed) input.direction = 0;
  if (fighter.launch.hitstun > 0 || fighter.launch.hitlag > 0 || fighter.special.action !== SpecialAction.none) return true;

  if (ledge && outside <= LEDGE_LINE_REACH && z >= f32(floor - LEDGE_MISSED)) return true;

  const coin = botChoice(fighter.visuals.hit + toInt(fighter.status.damage), fighter.character * 13 + 5, 2) === 0;
  const gameplan = gameplanOf(fighter.character, skill.basicMoves);
  const specialFirst = outside <= SPECIAL_FIRST_REACH && z >= floor && upSpecialStartable(fighter, specialCooldownReady(fighter, upSpecial(fighter.character)))
    && (gameplan === undefined ? coin : upSpecialFirst(gameplan, coin));
  if (totalVelocityZ(fighter) <= 0 && z < f32(floor + 100)) {
    if (fighter.jump.remaining > 0 && fighter.attack.cooldown === 0 && !specialFirst) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    } else if (z < f32(floor + 50)) {
      input.specialPressed = true;
      input.specialX = input.direction;
      input.specialZ = 1;
      input.verticalDirection = 1;
    }
  }
  return true;
}
