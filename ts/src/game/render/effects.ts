// Shared vocabulary of the native renderers. Renderers own special-effect
// handles created in the synchronized match lifecycle and only change them
// while presenting completed state; presenting never creates or destroys one.
import { f32 } from "wisp/src/sim/f32";
import { FLOOR_HEIGHT } from "../presentation/arenaCamera";
import { Character } from "../sim/codes";
import { EffectMotion } from "./motion";

/** The world point the simulation's origin maps to: stage center and floor height. */
export interface WorldOrigin {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Stock models from the game's own archives. */
export const STOCK_MODELS = {
  gyroCopterMissile: "Abilities\\Weapons\\GyroCopter\\GyroCopterMissile.mdx",
  immolationTarget: "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx",
  manaBurnTarget: "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx",
  silenceTarget: "Abilities\\Spells\\Other\\Silence\\SilenceTarget.mdx",
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
 * model's particle emitters. Stock emitters extend over 2000 units above
 * their pivot; the extra depth keeps those particles below every arena camera.
 */
export function hideEffect(model: effect, origin: Readonly<WorldOrigin>): void {
  effectMotion().release(model);
  BlzSetSpecialEffectScale(model, 0.0);
  BlzSetSpecialEffectPosition(model, origin.x, origin.y, origin.z - FLOOR_HEIGHT - 4096.0);
}

/**
 * Which of a renderer's effects are parked, by the renderer's own index.
 * Most pooled effects stay hidden for a whole match, and each native call
 * costs Warcraft far more than a Lua lookup, so a renderer parks an effect
 * when it stops showing it, not on every frame it stays hidden. Renderers
 * create their flags on first use, so flags are empty after construction or
 * a hot reload: whether an effect is parked is then unknown, and its next
 * hide parks it.
 */
export type ParkedFlags = boolean[];

/** Parks the effect unless its flag says it is parked; true when it parked it now. */
export function parkOnce(model: effect, origin: Readonly<WorldOrigin>, parked: ParkedFlags, index: number): boolean {
  if (parked[index] === true) return false;
  hideEffect(model, origin);
  parked[index] = true;
  return true;
}

declare global {
  /** Draws placed effects between simulation frames on fast displays (motion.ts); kept across hot reloads. */
  var __smashcraftEffectMotion: EffectMotion<effect> | undefined;
}

/** The match's effect motion, created on first use. */
export function effectMotion(): EffectMotion<effect> {
  return (globalThis.__smashcraftEffectMotion ??= new EffectMotion<effect>(BlzSetSpecialEffectPosition));
}

/** Puts a moving effect at this simulation frame's position; on fast displays it glides there from the last one (motion.ts). */
export function placeEffect(model: effect, x: number, y: number, z: number): void {
  effectMotion().place(model, x, y, z);
}
