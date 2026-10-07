import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { analogShieldActive, analogShieldStrength } from "../sim/shield";
import { squareRoot } from "../sim/warcraftMath";
import { SHIELD_TILT_STICK_CAP, stickX, stickZ } from "../sim/stick";
import { Action, has, maskOf } from "./actions";
import { type AttackBuffer, clearAttackBuffer, queueAttack } from "./attackBuffer";
import { groundDodgeIntent, normalAttackStyle } from "./combat";
import type { Direction, InputRow } from "./inputRow";

const GRAB_MASH_ACTIONS = maskOf(Action.attack, Action.special, Action.jump, Action.grab, Action.leftTrigger, Action.rightTrigger, Action.lightShield);
const MOVEMENT_ACTIONS = maskOf(Action.moveLeft, Action.moveRight, Action.moveDown, Action.moveUp);
const TRIGGERS = maskOf(Action.leftTrigger, Action.rightTrigger, Action.lightShield);

const sign = (value: number): Direction => value < 0 ? -1 : value > 0 ? 1 : 0;

function edgePair(pressed: number, negative: Action, positive: Action): Direction {
  const left = has(pressed, negative);
  const right = has(pressed, positive);
  return left === right ? 0 : right ? 1 : -1;
}

function movementAxis(row: Readonly<InputRow>, negative: Action, positive: Action, axis: number): Direction {
  // Held directions own the axis, even when opposing holds cancel it. A short
  // tap is preserved only when neither direction remains held.
  if (has(row.held, negative) || has(row.held, positive) || axis !== 0) return sign(axis);
  return edgePair(row.pressed, negative, positive);
}

/** Fills reused frame scratch; the caller records the requests beside this exact row for replay. */
export function adaptInput(row: Readonly<InputRow>, fighter: Readonly<Fighter>, frame: number, destination: Controls, attacks: AttackBuffer): void {
  const { held, pressed } = row;
  clearAttackBuffer(attacks);
  destination.attackRequested = false;
  destination.direction = movementAxis(row, Action.moveLeft, Action.moveRight, row.axisX);
  destination.verticalDirection = movementAxis(row, Action.moveDown, Action.moveUp, row.axisZ);
  destination.diStickValid = true;
  destination.diStickX = f32(row.axisX / 127.0);
  destination.driftStickX = destination.diStickX;
  destination.diStickZ = f32(row.axisZ / 127.0);
  const length = squareRoot(f32(f32(destination.diStickX * destination.diStickX) + f32(destination.diStickZ * destination.diStickZ)));
  if (length > 1) {
    destination.diStickX = f32(destination.diStickX / length);
    destination.diStickZ = f32(destination.diStickZ / length);
  }
  destination.sdiPulse = row.sdi;
  destination.sdiX = row.sdiX;
  destination.sdiZ = row.sdiZ;
  destination.cStickX = (has(held, Action.smashRight) ? 1 : 0) - (has(held, Action.smashLeft) ? 1 : 0);
  destination.cStickZ = (has(held, Action.smashUp) ? 1 : 0) - (has(held, Action.smashDown) ? 1 : 0);
  destination.specialPressed = has(pressed, Action.special);
  destination.specialX = destination.specialPressed ? row.specialX : 0;
  destination.specialZ = destination.specialPressed ? row.specialZ : 0;
  destination.down = has(held, Action.moveDown);
  destination.shieldPressed = (pressed & TRIGGERS) !== 0;
  const leftPressure = row.triggerLeft > 0 ? row.triggerLeft : has(held | pressed, Action.leftTrigger) ? 255 : has(held | pressed, Action.lightShield) ? 77 : 0;
  const rightPressure = row.triggerRight > 0 ? row.triggerRight : has(held | pressed, Action.rightTrigger) ? 255 : 0;
  const pressure = Math.max(leftPressure, rightPressure);
  destination.shieldTriggerActive = pressure > 0;
  destination.shield = pressure === 255 || analogShieldActive(pressure);
  destination.shieldStrength = pressure === 255 ? 1.0 : analogShieldStrength(pressure);
  destination.walking = has(held, Action.walk);
  if (destination.walking && destination.shield) {
    destination.diStickX = Math.max(-SHIELD_TILT_STICK_CAP, Math.min(SHIELD_TILT_STICK_CAP, destination.diStickX));
    destination.diStickZ = Math.max(-SHIELD_TILT_STICK_CAP, Math.min(SHIELD_TILT_STICK_CAP, destination.diStickZ));
  }
  destination.jumpPressed = has(pressed, Action.jump);
  destination.jumpHeld = has(held, Action.jump);
  destination.airDodgePressed = destination.shieldPressed;
  destination.dodgeX = destination.airDodgePressed ? row.dodgeX : 0;
  destination.dodgeZ = destination.airDodgePressed ? row.dodgeZ : 0;
  destination.techPressed = destination.airDodgePressed;
  destination.mashPressed = pressed !== 0;
  destination.attackPressed = has(pressed, Action.attack);
  destination.grabMashPressed = (pressed & GRAB_MASH_ACTIONS) !== 0;
  destination.grabThrowX = sign(row.throwX);
  destination.grabThrowZ = sign(row.throwZ);
  destination.ledgeVerticalPressed = row.ledgeVertical;
  destination.getupAttackPressed = destination.attackPressed || destination.specialPressed;
  destination.getupStandPressed = has(pressed, Action.moveUp) || destination.jumpPressed || destination.airDodgePressed;
  destination.getupDirection = edgePair(pressed, Action.moveLeft, Action.moveRight);
  destination.getupDirectionPressed = destination.getupDirection !== 0;
  destination.cStickUpFlick = has(pressed, Action.smashUp);
  destination.cStickSideFlick = edgePair(pressed, Action.smashLeft, Action.smashRight);
  destination.attackHeld = has(held, Action.attack);
  const leftShield = has(held, Action.leftTrigger) || analogShieldActive(row.triggerLeft);
  const rightShield = has(held, Action.rightTrigger) || analogShieldActive(row.triggerRight);
  destination.resetPressed = leftShield && rightShield && destination.attackPressed;
  // Melee's escape stick thresholds: common +0x31C/+0x314, ftCo_Escape.c.
  const dodge = groundDodgeIntent(destination.shield,
    has(pressed, Action.moveLeft) && stickX(destination) <= -0.699999988079071,
    has(pressed, Action.moveRight) && stickX(destination) >= 0.699999988079071,
    has(pressed, Action.moveDown) && stickZ(destination) <= -0.699999988079071);
  destination.groundDodgePressed = dodge !== undefined;
  destination.groundDodgeDirection = dodge ?? 0;

  if (destination.attackPressed || (destination.attackHeld && (pressed & MOVEMENT_ACTIONS) !== 0)) {
    const shieldGrab = fighter.motion.grounded && (fighter.shield.raised || destination.shield);
    queueAttack(attacks, {
      style: normalAttackStyle(destination.direction, destination.verticalDirection, destination.walking, shieldGrab),
      facing: sign(destination.direction), frame, mayCharge: true,
    });
  }
  if (has(pressed, Action.grab)) queueAttack(attacks, { style: AttackStyle.grab, facing: 0, frame, mayCharge: false });
  if (has(pressed, Action.smashLeft)) queueAttack(attacks, { style: AttackStyle.forwardSmash, facing: -1, frame, mayCharge: false });
  if (has(pressed, Action.smashRight)) queueAttack(attacks, { style: AttackStyle.forwardSmash, facing: 1, frame, mayCharge: false });
  if (has(pressed, Action.smashUp)) queueAttack(attacks, { style: AttackStyle.upSmash, facing: 0, frame, mayCharge: false });
  if (has(pressed, Action.smashDown)) queueAttack(attacks, { style: AttackStyle.downSmash, facing: 0, frame, mayCharge: false });
}
