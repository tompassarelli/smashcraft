// Shared vocabulary of the native renderers. Renderers own special-effect
// handles created in the synchronized match lifecycle and only change them
// while presenting completed state; presenting never creates or destroys one.
import { f32 } from "wisp/src/sim/f32";
import { FLOOR_HEIGHT } from "../presentation/arenaCamera";
import { Character } from "../sim/codes";

/** The world point the simulation's origin maps to: stage center and floor height. */
export interface WorldOrigin {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Stock models from the game's own archives. */
export const STOCK_MODELS = {
  arrowMissile: "Abilities\\Weapons\\Arrow\\ArrowMissile.mdx",
  gyroCopterMissile: "Abilities\\Weapons\\GyroCopter\\GyroCopterMissile.mdx",
  manaFlareMissile: "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareMissile.mdx",
  immolationTarget: "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx",
  manaBurnTarget: "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx",
  hippogryph: "Units\\NightElf\\HippoGryph\\HippoGryph.mdx",
} as const;

const HALF_TURN = f32(3.141592654);

/** Models face +x at yaw 0; facing -1 turns them around. */
export function facingYaw(facing: number): number {
  return facing > 0 ? 0.0 : HALF_TURN;
}


/**
 * Hidden effects stay allocated and collapsed, parked on the ground beneath
 * the floor, until presented again. Alpha, scale and time scale do not stop a
 * model's particle emitters, and the arena camera never sees that ground.
 */
export function hideEffect(model: effect, origin: Readonly<WorldOrigin>): void {
  BlzSetSpecialEffectScale(model, 0.0);
  BlzSetSpecialEffectPosition(model, origin.x, origin.y, origin.z - FLOOR_HEIGHT);
}
