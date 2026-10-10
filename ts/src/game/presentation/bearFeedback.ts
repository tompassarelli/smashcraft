import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { CompanionMode } from "../sim/heroSpecials";

type BearState = "FOLLOWING" | "CHARGING" | "ATTACKING" | "RESTING";

export function bearState(fighter: Readonly<Fighter> | undefined): BearState | undefined {
  if (fighter === undefined || fighter.character !== Character.beastmaster || fighter.status.out || fighter.placed.life <= 0) return undefined;
  const bear = fighter.placed;
  const move = bear.spec?.companion;
  if (move === undefined) return undefined;
  if (bear.mode === CompanionMode.stunned) return "RESTING";
  if (bear.mode !== CompanionMode.lunge) return "FOLLOWING";
  if (bear.modeFrame <= move.lungeStartup) return "CHARGING";
  if (bear.modeFrame <= move.lungeStartup + move.lungeActive) return "ATTACKING";
  return "RESTING";
}

export interface BearFeedbackCursor {
  frame: number;
  placement: number;
  command: number;
  bitten: number;
  impactFrame: number;
  impactX: number;
  impactZ: number;
}

export const createBearFeedbackCursor = (): BearFeedbackCursor => ({ frame: -1, placement: -1, command: -1, bitten: 0, impactFrame: -100, impactX: 0.0, impactZ: 0.0 });


export function advanceBearFeedback(cursor: BearFeedbackCursor, fighter: Readonly<Fighter>, frame: number): { roar: boolean; hit: boolean } {
  if (frame <= cursor.frame) return { roar: false, hit: false };
  cursor.frame = frame;
  const state = bearState(fighter);
  const bear = fighter.placed;
  if (state === undefined || bear.mode !== CompanionMode.lunge) {
    cursor.command = -1;
    cursor.bitten = 0;
    return { roar: false, hit: false };
  }
  const command = bear.age - bear.modeFrame;
  const entered = cursor.placement !== bear.serial || cursor.command !== command;
  if (entered) cursor.bitten = 0;
  const hit = (bear.bitten & ~cursor.bitten) !== 0;
  cursor.placement = bear.serial;
  cursor.command = command;
  cursor.bitten = bear.bitten;
  if (hit) {
    cursor.impactFrame = frame;
    cursor.impactX = bear.x + bear.direction * 45.0;
    cursor.impactZ = bear.z + 45.0;
  }
  return { roar: entered && state === "CHARGING", hit };
}

export const BEAR_ROAR_MODEL = "Abilities\\Spells\\NightElf\\BattleRoar\\RoarTarget.mdx";
export const BEAR_IMPACT_MODEL = "Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx";
