





import { f32 } from "wisp/src/sim/f32";
import { type AttackBuffer, clearAttackBuffer, queueAttack } from "../src/game/input/attackBuffer";
import { moveReaches } from "../src/game/match/botMoves";
import { AttackStyle, GrabAction, SpecialAction } from "../src/game/sim/codes";
import { canAttack } from "../src/game/sim/conditions";
import type { Fighter } from "../src/game/sim/fighter";
import { GameplanSpecial } from "../src/game/sim/gameplan";
import { attackStartupFrames } from "../src/game/sim/moves";
import type { Controls } from "../src/game/sim/roster";
import { mainDeckLeft, mainDeckRight } from "../src/game/sim/stage";

const AERIALS: readonly number[] = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];
const SPECIALS: readonly number[] = [GameplanSpecial.neutral, GameplanSpecial.side, GameplanSpecial.up, GameplanSpecial.down];

const SPECIAL_GAP = 520.0;
const SPECIAL_HEIGHT = 140.0;

const JUMP_GAP = 220.0;


function chosenMove(f: Readonly<Fighter>, input: Readonly<Controls>, commands: Readonly<AttackBuffer>): number | undefined {
  if (input.specialPressed) {
    return input.specialZ > 0 ? GameplanSpecial.up : input.specialZ < 0 ? GameplanSpecial.down : input.specialX !== 0 ? GameplanSpecial.side : GameplanSpecial.neutral;
  }
  const request = commands.pending;
  if (request === undefined) return undefined;
  if (f.motion.grounded) return request.style === AttackStyle.jab && f.ground.dashFrame > 0 ? AttackStyle.dashAttack : request.style;
  if (request.style === AttackStyle.jab) return AttackStyle.neutralAir;
  if (request.style === AttackStyle.upTilt) return AttackStyle.upAir;
  if (request.style === AttackStyle.downTilt) return AttackStyle.downAir;
  return request.facing !== 0 && request.facing !== f.facing ? AttackStyle.backAir : AttackStyle.forwardAir;
}

const offstage = (f: Readonly<Fighter>, stage: number): boolean =>
  f.motion.z < 0.0 || f.motion.x < mainDeckLeft(stage) || f.motion.x > mainDeckRight(stage);

function drop(input: Controls, commands: AttackBuffer): void {
  clearAttackBuffer(commands);
  input.attackHeld = false;
  input.specialPressed = false;
  input.specialX = 0;
  input.specialZ = 0;
}


function reaches(f: Readonly<Fighter>, target: Readonly<Fighter>, move: number): boolean {
  const dx = f32(target.motion.x - f.motion.x);
  const dz = f32(target.motion.z - f.motion.z);
  if (SPECIALS.includes(move)) {
    const gap = move === GameplanSpecial.neutral || move === GameplanSpecial.side ? SPECIAL_GAP : 200.0;
    return Math.abs(dx) <= gap && Math.abs(dz) <= SPECIAL_HEIGHT;
  }
  if (AERIALS.includes(move) === f.motion.grounded) return false;

  if (move === AttackStyle.dashAttack && f.ground.dashFrame <= 0) return false;

  const facing = f.motion.grounded ? (dx < 0 ? -1 : 1) : f.facing;
  const style = move === AttackStyle.dashAttack ? f.tuning.moves?.dashAttack ?? AttackStyle.dashAttack : Object.values(AttackStyle).find((known) => known === move);
  if (style === undefined) return false;
  const ahead = f32(f32(dx + f32(target.motion.vx * attackStartupFrames(style, f.tuning.moves))) * facing);
  return moveReaches(f.character, style, target, ahead, dz, f.tuning.moves);
}

function press(f: Readonly<Fighter>, target: Readonly<Fighter>, move: number, frame: number, input: Controls, commands: AttackBuffer): void {
  const toward = target.motion.x < f.motion.x ? -1 : 1;
  if (SPECIALS.includes(move)) {
    input.specialPressed = true;
    input.specialX = move === GameplanSpecial.side ? toward : 0;
    input.specialZ = move === GameplanSpecial.up ? 1 : move === GameplanSpecial.down ? -1 : 0;
    input.verticalDirection = input.specialZ;
    return;
  }
  if (f.motion.grounded) {
    const style = move === AttackStyle.dashAttack ? AttackStyle.jab : move;
    queueAttack(commands, { style, facing: toward, frame, mayCharge: false });
    return;
  }
  const request = move === AttackStyle.neutralAir ? AttackStyle.jab : move === AttackStyle.upAir ? AttackStyle.upTilt
    : move === AttackStyle.downAir ? AttackStyle.downTilt : AttackStyle.forwardTilt;
  queueAttack(commands, { style: request, facing: move === AttackStyle.backAir ? (f.facing < 0 ? 1 : -1) : f.facing < 0 ? -1 : 1, frame, mayCharge: false });
}






export function spamOnly(f: Readonly<Fighter>, target: Readonly<Fighter>, move: number, stage: number, frame: number, input: Controls, commands: AttackBuffer): void {
  const holding = f.grab.action !== GrabAction.none;

  if (holding) {
    if (move !== AttackStyle.grab) {
      input.grabThrowX = 0;
      input.grabThrowZ = 0;
    }
    return;
  }

  if (move !== AttackStyle.getupAttack && move !== AttackStyle.ledgeAttack) input.getupAttackPressed = false;
  const chosen = chosenMove(f, input, commands);
  const recovering = chosen === GameplanSpecial.up && offstage(f, stage);
  if (chosen !== undefined && chosen !== move && !recovering) drop(input, commands);
  if (chosen === move || recovering || offstage(f, stage)) return;
  if (f.special.action !== SpecialAction.none || f.launch.hitstun > 0 || f.status.out) return;
  if (reaches(f, target, move)) {
    if (canAttack(f) || f.shield.raised) {
      input.shield = false;
      press(f, target, move, frame, input, commands);
    }
    return;
  }
  if (!f.motion.grounded) return;
  const dx = f32(target.motion.x - f.motion.x);
  input.direction = dx < 0 ? -1 : 1;
  input.walking = false;
  if (AERIALS.includes(move) && Math.abs(dx) <= JUMP_GAP) input.jumpPressed = true;
}
