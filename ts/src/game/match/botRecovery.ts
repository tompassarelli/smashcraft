// The computer's way back: off the stage it steers home, or to just outside a
// free ledge it then falls onto, and spends its jump and up special; on the
// ledge it takes a ledge option; knocked down it techs or gets up.
import { specialCooldownReady } from "../sim/heroSpecialRules";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { toInt } from "../../runtime/numbers";
import { TECH_REPEAT_MINIMUM_AGE_FRAMES } from "../physics/techInput";
import { Character, DownState, LedgeState, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { totalVelocityZ } from "../sim/motion";
import type { Controls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight, mainDeckZ, surfaceCount, surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { botChoice } from "./botMoves";

/** A tech pressed this many frames of fall above a deck lands inside its window. */
const TECH_LEAD_FRAMES = 6;
/** The ledge attack strikes a target this far in from the ledge it climbs. */
const LEDGE_ATTACK_NEAR = 30.0;
const LEDGE_ATTACK_FAR = 210.0;
/** Where a fighter falling to the ledge keeps itself, outside the edge, and how far out it starts. */
const LEDGE_LINE_NEAR = 25.0;
const LEDGE_LINE_FAR = 50.0;
const LEDGE_LINE_REACH = 60.0;
/** Fallen this far below the deck, the fighter missed the ledge and recovers as usual. */
const LEDGE_MISSED = 110.0;
/** Frames the computer may hang on the ledge waiting for its target. */
const LEDGE_WAIT_FRAMES = 90;
/** Within this distance outside the edge a return may spend its up special before its jump. */
const SPECIAL_FIRST_REACH = 200.0;
/** Frames a downed fighter may wait for its target before it gets up. */
const GETUP_WAIT_FRAMES = 60;
/** An opponent this close to a downed fighter meets its get-up attack. */
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
  // Mostly it hangs a while, waiting for the target to come where the ledge attack reaches.
  if (choice < 5 && f.ledge.frame < LEDGE_WAIT_FRAMES) return LedgeOption.hang;
  return choice === 3 ? LedgeOption.roll : choice === 4 ? LedgeOption.jump : choice === 5 ? LedgeOption.attack : LedgeOption.climb;
}

/** A hanging fighter climbs, rolls, jumps or attacks; the ledge attack when the target stands where it strikes. */
function chooseLedgeOption(f: Readonly<Fighter>, stage: number, input: Controls, target: Readonly<Fighter> | undefined): void {
  const { ledge } = f;
  input.direction = -ledge.side;
  if (ledge.state !== LedgeState.hang) return;
  switch (ledgeOption(f, stage, target)) {
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

/**
 * A fighter lying down (knocked down, or held by jab resets) gets up: with
 * the target in reach mostly a get-up attack, else a roll away; out of reach
 * a get-up attack, a roll toward the middle or a stand, or for a while it
 * waits for the target to come into reach. Chosen by the hit that put it
 * there; false while it isn't down.
 */
function chooseGetUp(f: Readonly<Fighter>, input: Controls, target: Readonly<Fighter> | undefined): boolean {
  const { state } = f.down;
  if (!f.motion.grounded || (state !== DownState.bound && state !== DownState.wait && state !== DownState.damage)) return false;
  const choice = botChoice(f.visuals.hit + toInt(f.status.damage), f.character * 11 + f.ledge.serial, 4);
  const near = target !== undefined && !target.status.out && Math.abs(f32(target.motion.x - f.motion.x)) <= GETUP_ATTACK_REACH
    && Math.abs(f32(target.motion.z - f.motion.z)) <= 100;
  const inward = f.motion.x < 0 ? 1 : -1;
  const away = target === undefined ? inward : target.motion.x < f.motion.x ? 1 : -1;
  // Lying still while it waits, it can be jab-reset; the reset puts the target in reach.
  const waits = choice === 1 && state === DownState.wait && f.down.frame < GETUP_WAIT_FRAMES;
  if (near && choice < 3) input.getupAttackPressed = true;
  else if (near) input.direction = away;
  else if (choice === 0) input.getupAttackPressed = true;
  else if (choice === 2) input.direction = inward;
  else if (!waits) input.getupStandPressed = true;
  return true;
}

/**
 * A tumbling fighter falling onto a deck presses tech once within reach of
 * its window, in place or rolling toward the middle; one landing in three it
 * misses the tech, as players do, and gets up from the floor instead.
 */
function techLanding(f: Readonly<Fighter>, stage: number, matchFrame: number, input: Controls): void {
  const { motion } = f;
  if (f.down.state !== DownState.tumble || motion.grounded || motion.deltaZ >= 0 || botChoice(f.visuals.hit + toInt(f.status.damage), f.character * 5 + 1, 3) === 0) return;
  const lead = f32(f32(-motion.deltaZ) * TECH_LEAD_FRAMES);
  for (let deck = 0; deck < surfaceCount(stage); deck++) {
    const height = f32(motion.z - surfaceZ(stage, deck, matchFrame));
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
    case Character.archer:
      return SpecialAction.archerRecovery;
    case Character.rifleman:
      return SpecialAction.riflemanRecovery;
    case Character.demonHunter:
      return SpecialAction.demonHunterWingAscent;
  }
}

/**
 * Whether a fighter returning on `side` aims for the ledge instead of the
 * deck: one return in two, facing the stage, its ledge free, with a jump or
 * up special left for a miss.
 */
function aimsForLedge(f: Readonly<Fighter>, side: number, target: Readonly<Fighter> | undefined): boolean {
  const taken = target !== undefined && target.ledge.state !== LedgeState.none && target.ledge.side === side;
  const spare = f.jump.remaining > 0 || specialCooldownReady(f, upSpecial(f.character));
  return f.facing === -side && !taken && spare && botChoice(f.visuals.hit + toInt(f.status.damage), f.character * 7 + 3, 2) === 0;
}

/**
 * Produces ordinary frame inputs: recovery never moves a fighter directly.
 * True when getting back to the stage, or onto its feet, took the frame.
 */
export function chooseRecoveryInput(fighter: Readonly<Fighter>, stage: number, matchFrame: number, input: Controls, target?: Readonly<Fighter>): boolean {
  input.specialPressed = false;
  input.specialX = 0;
  input.specialZ = 0;
  input.verticalDirection = 0;
  input.ledgeVerticalPressed = 0;
  if (fighter.status.out) return false;
  if (fighter.ledge.state !== LedgeState.none) {
    chooseLedgeOption(fighter, stage, input, target);
    return true;
  }
  if (chooseGetUp(fighter, input, target)) return true;
  techLanding(fighter, stage, matchFrame, input);
  const left = mainDeckLeft(stage);
  const right = mainDeckRight(stage);
  const floor = mainDeckZ(stage);
  const { x, z, grounded } = fighter.motion;
  if (grounded || (x >= left && x <= right && z >= floor)) return false;
  const side = x < 0 ? -1 : 1;
  const outside = f32(f32(x - (side < 0 ? left : right)) * side);
  const ledge = outside > 0 && aimsForLedge(fighter, side, target);
  // Aiming for the ledge it keeps just outside the edge; otherwise it heads for the deck.
  if (ledge) input.direction = outside < LEDGE_LINE_NEAR ? side : outside > LEDGE_LINE_FAR ? -side : 0;
  else input.direction = x < (side < 0 ? f32(left + 60) : f32(right - 60)) ? 1 : -1;
  // An up special that aims during its startup (Warden's Blink) goes up and toward the stage.
  if (fighter.special.action === SpecialAction.heroUp) {
    input.direction = -side;
    input.verticalDirection = 1;
  }
  if (fighter.launch.hitstun > 0 || fighter.launch.hitlag > 0 || fighter.special.action !== SpecialAction.none) return true;
  // Close outside the ledge and above where it catches, it falls onto the ledge.
  if (ledge && outside <= LEDGE_LINE_REACH && z >= f32(floor - LEDGE_MISSED)) return true;
  // Near the edge and still above the deck, one return in two spends the up special first and keeps the jump.
  const specialFirst = outside <= SPECIAL_FIRST_REACH && z >= floor && specialCooldownReady(fighter, upSpecial(fighter.character))
    && botChoice(fighter.visuals.hit + toInt(fighter.status.damage), fighter.character * 13 + 5, 2) === 0;
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
