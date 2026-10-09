import { clearAttackBuffer, queueAttack, type AttackBuffer } from "../input/attackBuffer";
import { AttackStyle } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { botChoice } from "./botRandom";
import type { CpuDecisionPolicy } from "./cpuDecisionPolicy";

export type TechnicalOutcome = "none" | "executed" | "dropped" | "wrongOption";
/** Frame-tight presses (aerial landings, wavedash air dodges) miss 9 points more often than Execute. */
export const FRAME_TIGHT_EXTRA_MISS = 9;
export function isFrameTight(fighter: Readonly<Fighter>, input: Readonly<Controls>, commands: Readonly<AttackBuffer>): boolean {
  return (!fighter.motion.grounded && commands.pending !== undefined) || input.airDodgePressed;
}

/** Technical presses can be dropped or replaced by a legal simpler option. */
export function executeBotTechnique(fighter: Readonly<Fighter>, input: Controls, commands: AttackBuffer, frame: number, slot: number, policy: CpuDecisionPolicy): TechnicalOutcome {
  const aerial = !fighter.motion.grounded && commands.pending !== undefined;
  const jump = input.jumpPressed || input.airDodgePressed;
  const special = input.specialPressed;
  if (!aerial && !jump && !special) return "none";
  if (botChoice(frame, slot * 41 + fighter.character * 7 + 887, 100) < policy.executionPercent - (aerial || input.airDodgePressed ? FRAME_TIGHT_EXTRA_MISS : 0)) return "executed";
  const substitute = botChoice(frame, slot * 41 + 907, 2) === 0;
  if (jump) {
    input.jumpPressed = false;
    input.shortHopPressed = false;
    input.jumpHeld = false;
    input.airDodgePressed = false;
    if (substitute && fighter.motion.grounded) {
      input.specialPressed = false;
      clearAttackBuffer(commands);
      input.shield = true;
      input.groundDodgePressed = true;
      input.groundDodgeDirection = input.direction !== 0 ? input.direction : -fighter.facing;
      return "wrongOption";
    }
  }
  if (aerial) {
    const command = commands.pending;
    if (substitute && command !== undefined && command.style !== AttackStyle.neutralAir) {
      queueAttack(commands, { style: AttackStyle.neutralAir, facing: command.facing, frame: command.frame, mayCharge: false });
      return "wrongOption";
    }
    clearAttackBuffer(commands);
  }
  if (special) {
    input.specialPressed = false;
    if (substitute && !aerial) {
      queueAttack(commands, { style: fighter.motion.grounded ? AttackStyle.jab : AttackStyle.neutralAir, facing: fighter.facing < 0 ? -1 : 1, frame, mayCharge: false });
      return "wrongOption";
    }
  }
  return "dropped";
}
