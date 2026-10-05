import { AttackStyle } from "../sim/codes";
import type { Direction } from "./inputRow";

/** Ground requests select aerials relative to the fighter's facing. Grabs have no aerial form. */
export function attackStyleForGrounding(style: AttackStyle | undefined, grounded: boolean, facing: number, direction: number): AttackStyle | undefined {
  if (grounded || style === undefined || style === AttackStyle.shot) return style;
  switch (style) {
    case AttackStyle.jab: return AttackStyle.neutralAir;
    case AttackStyle.upSmash:
    case AttackStyle.upTilt:
    case AttackStyle.forwardTiltUp: return AttackStyle.upAir;
    case AttackStyle.downSmash:
    case AttackStyle.downTilt:
    case AttackStyle.forwardTiltDown: return AttackStyle.downAir;
    case AttackStyle.forwardSmash:
    case AttackStyle.forwardTilt:
      return direction !== 0 && direction !== facing ? AttackStyle.backAir : AttackStyle.forwardAir;
    default: return undefined;
  }
}

/** Fresh down wins over horizontal edges; opposing horizontal edges cancel. */
export function groundDodgeIntent(shielding: boolean, left: boolean, right: boolean, down: boolean): Direction | undefined {
  if (!shielding) return undefined;
  if (down) return 0;
  return left === right ? undefined : left ? -1 : 1;
}

export function normalAttackStyle(horizontal: number, vertical: number, walking: boolean, shieldGrab: boolean): AttackStyle {
  if (shieldGrab) return AttackStyle.grab;
  if (walking && horizontal !== 0) {
    if (vertical > 0) return AttackStyle.forwardTiltUp;
    if (vertical < 0) return AttackStyle.forwardTiltDown;
    return AttackStyle.forwardTilt;
  }
  if (vertical > 0) return walking ? AttackStyle.upTilt : AttackStyle.upSmash;
  if (vertical < 0) return walking ? AttackStyle.downTilt : AttackStyle.downSmash;
  if (horizontal !== 0) return walking ? AttackStyle.forwardTilt : AttackStyle.forwardSmash;
  return AttackStyle.jab;
}
