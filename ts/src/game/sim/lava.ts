



import { floorMod } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { collectTerrainContact } from "./contacts";
import { HitElement, type HitEffect } from "./hitRegions";
import { isIntangible } from "./conditions";
import { type Roster, fighterAt, isActive } from "./roster";
import { CANNON_TEST_STAGE, mainDeckZ, stageAtRest } from "./stage";

export const LAVA_HIT: Readonly<HitEffect> = {
  damage: 12.0, growth: 0.0, base: 100.0, launchX: 0.0, launchZ: 1.0,
  electric: false, element: HitElement.fire,
};


export const LavaPhase = { calm: 0, warning: 1, erupting: 2 } as const;
export type LavaPhase = (typeof LavaPhase)[keyof typeof LavaPhase];


export const LAVA_CALM_FRAMES = 300;
export const LAVA_WARNING_FRAMES = 300;
const LAVA_ERUPTION_FRAMES = 600;
export const LAVA_SIDE_FRAMES = LAVA_CALM_FRAMES + LAVA_WARNING_FRAMES + LAVA_ERUPTION_FRAMES;

export const LAVA_CYCLE_FRAMES = 2 * LAVA_SIDE_FRAMES;

export const LAVA_CENTER_X = 180.0;
export const LAVA_HALF_WIDTH = 70.0;

const LAVA_DEPTH = 8.0;

export const hasLava = (stage: number): boolean => stage === CANNON_TEST_STAGE;

const lavaCycle = (frame: number): number => floorMod(frame - 1, LAVA_CYCLE_FRAMES);


export function lavaSide(frame: number): -1 | 1 {
  return lavaCycle(frame) < LAVA_SIDE_FRAMES ? 1 : -1;
}


export function lavaPhase(stage: number, frame: number): LavaPhase {
  if (!hasLava(stage) || stageAtRest(frame)) return LavaPhase.calm;
  const turn = floorMod(lavaCycle(frame), LAVA_SIDE_FRAMES);
  if (turn < LAVA_CALM_FRAMES) return LavaPhase.calm;
  return turn < LAVA_CALM_FRAMES + LAVA_WARNING_FRAMES ? LavaPhase.warning : LavaPhase.erupting;
}


export function framesUntilLava(frame: number): number {
  const turn = floorMod(lavaCycle(frame), LAVA_SIDE_FRAMES);
  return turn >= LAVA_CALM_FRAMES + LAVA_WARNING_FRAMES ? 0 : LAVA_CALM_FRAMES + LAVA_WARNING_FRAMES - turn;
}


export const lavaLeft = (frame: number): number => f32(f32(lavaSide(frame) * LAVA_CENTER_X) - LAVA_HALF_WIDTH);
export const lavaRight = (frame: number): number => f32(f32(lavaSide(frame) * LAVA_CENTER_X) + LAVA_HALF_WIDTH);


export function overLava(stage: number, frame: number, x: number): boolean {
  return lavaPhase(stage, frame) !== LavaPhase.calm && x >= lavaLeft(frame) && x <= lavaRight(frame);
}


export function collectLavaContacts(world: Roster, stage: number, frame: number): void {
  if (lavaPhase(stage, frame) !== LavaPhase.erupting) return;
  const left = lavaLeft(frame);
  const right = lavaRight(frame);
  const top = mainDeckZ(stage);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    const { motion, status, launch } = fighter;
    if (status.out || isIntangible(fighter) || launch.hitlag > 0) continue;
    if (motion.x < left || motion.x > right || motion.z > top || motion.z < top - LAVA_DEPTH) continue;
    collectTerrainContact(world, slot, LAVA_HIT);
  }
}
