


import { f32 } from "wisp/src/sim/f32";
import { FLOOR_HEIGHT, HIDDEN_EFFECT_DEPTH } from "../presentation/arenaCamera";
import { Character } from "../sim/codes";
import { EffectMotion } from "./motion";


export interface WorldOrigin {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}


export const STOCK_MODELS = {
  silenceTarget: "Abilities\\Spells\\Other\\Silence\\SilenceTarget.mdx",
  flyingMachineMissile: "Abilities\\Weapons\\FlyingMachine\\FlyingMachineMissile.mdx",
  immolationTarget: "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx",
  manaBurnTarget: "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx",
  greenDragonMissile: "Abilities\\Weapons\\GreenDragonMissile\\GreenDragonMissile.mdx",
  massTeleportTarget: "Abilities\\Spells\\Human\\MassTeleport\\MassTeleportTarget.mdx",
  frostWyrmMissile: "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx",
} as const;

const HALF_TURN = f32(3.141592654);


export function facingYaw(facing: number): number {
  return facing > 0 ? 0.0 : HALF_TURN;
}


// Alpha, scale and time scale leave particle emitters running; park their full reach below the camera.





export function hideEffect(model: effect, origin: Readonly<WorldOrigin>): void {
  effectMotion().release(model);
  BlzSetSpecialEffectScale(model, 0.0);
  BlzSetSpecialEffectPosition(model, origin.x, origin.y, origin.z - FLOOR_HEIGHT - HIDDEN_EFFECT_DEPTH);
}










export type ParkedFlags = boolean[];


export function parkOnce(model: effect, origin: Readonly<WorldOrigin>, parked: ParkedFlags, index: number): boolean {
  if (parked[index] === true) return false;
  hideEffect(model, origin);
  parked[index] = true;
  return true;
}

export const PARKED_CUE_TIME_SCALE = 16.0;

export function parkCue(model: effect, origin: Readonly<WorldOrigin>, parked: ParkedFlags, index: number): boolean {
  if (!parkOnce(model, origin, parked, index)) return false;
  BlzSetSpecialEffectTimeScale(model, PARKED_CUE_TIME_SCALE);
  return true;
}

declare global {

  var __smashcraftEffectMotion: EffectMotion<effect> | undefined;
}


export function effectMotion(): EffectMotion<effect> {
  return (globalThis.__smashcraftEffectMotion ??= new EffectMotion<effect>((model, x, y, z) => BlzSetSpecialEffectPosition(model, x, y, z)));
}


export function placeEffect(model: effect, x: number, y: number, z: number): void {
  effectMotion().place(model, x, y, z);
}
