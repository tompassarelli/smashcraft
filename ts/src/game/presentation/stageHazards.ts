import { type MatchState, stageClock } from "../match/rules";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { BossKind } from "../classic/runState";
import { bossNotice } from "../classic/classicText";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { CARRIED_TEST_STAGE, TIMED_TEST_STAGE, surfaceWaitFrames } from "../sim/stage";
import { LAVA_CALM_FRAMES, LAVA_CYCLE_FRAMES, LAVA_SIDE_FRAMES, LAVA_WARNING_FRAMES, LavaPhase, framesUntilLava, lavaPhase, lavaSide } from "../sim/lava";
import { floorMod } from "wisp/src/sim/intMath";
import {
  CANNON_HOLD_FRAMES, CANNON_SHOT_FRAMES, WindPhase, cannonOn, framesUntilTideTurns, framesUntilWind, hasTide, tideNextDirection, windDirection, windOn, windPhase,
} from "../sim/stageHazards";

/** Classic Warcraft barrel, also listed in smashcraft:docs/design/stages.md. */
export const CANNON_MODEL = "Units\\Other\\TNTBarrel\\TNTBarrel.mdx";
/** Half a second's amber warning before a stationary platform departs. */
export const PLATFORM_CUE_FRAMES = 30;

export function framesUntilPlatformMoves(stage: number, frame: number): number | undefined {
  return stage === TIMED_TEST_STAGE || stage === CARRIED_TEST_STAGE ? surfaceWaitFrames(stage, 1, frame) : undefined;
}

/** A warning in the players' language, before wind, a turn of the tide, platform motion, a shot or lava. */
export function stageWarning(game: Readonly<MatchState>, world: Readonly<Roster>): string {
  if (game.run.active && game.run.boss.kind !== BossKind.none) return bossNotice(game);
  const stage = game.stageChoice;
  const frame = stageClock(game);
  if (windOn(stage, frame)) {
    const side = windDirection(frame) > 0 ? "right" : "left";
    if (windPhase(frame) === WindPhase.cue) return `Wind pushes ${side} in ${framesUntilWind(frame)} frames.`;
    if (windPhase(frame) === WindPhase.blowing) return `Wind pushes ${side}.`;
  }
  // The tide follows the match frame, hazards on or off.
  const turn = hasTide(stage) ? framesUntilTideTurns(game.matchFrame) : 0;
  if (turn > 0) return `Tide turns ${tideNextDirection(game.matchFrame) > 0 ? "right" : "left"} in ${turn} frames.`;
  const before = framesUntilPlatformMoves(stage, frame);
  if (before !== undefined && before <= PLATFORM_CUE_FRAMES) return `Platform moves in ${before} frames.`;
  if (cannonOn(stage, frame)) {
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      const { cannon } = fighterAt(world, slot);
      if (cannon.held === undefined) continue;
      if (cannon.firing !== undefined) return `Cannon fires in ${CANNON_SHOT_FRAMES - cannon.firing} frames.`;
      if (CANNON_HOLD_FRAMES - cannon.held <= PLATFORM_CUE_FRAMES) return "Cannon fires soon. Press Attack or Special to fire now.";
      return "In the cannon: press Attack or Special to fire.";
    }
  }
  const lava = lavaPhase(stage, frame);
  if (lava !== LavaPhase.calm) {
    const side = lavaSide(frame) > 0 ? "right" : "left";
    return lava === LavaPhase.warning ? `Lava erupts on the ${side} in ${framesUntilLava(frame)} frames.` : `Lava on the ${side}.`;
  }
  return "";
}

/** How Blackrock's lava patch shows on a frame: its opacity and tint. */
export interface LavaLook {
  alpha: number;
  red: number;
  green: number;
  blue: number;
}

// Preallocated: the view asks every callback.
const look: LavaLook = { alpha: 0, red: 255, green: 255, blue: 255 };
/** Frames of one swell of the warning's bubbling glow. */
const LAVA_BUBBLE_FRAMES = 20;

/**
 * Hidden while calm; through the warning the patch's own spot glows dark red,
 * bubbling and brightening toward the eruption; erupting, it is full lava.
 */
export function lavaLook(stage: number, frame: number): Readonly<LavaLook> {
  const phase = lavaPhase(stage, frame);
  look.red = 255;
  if (phase === LavaPhase.calm) {
    look.alpha = 0;
    return look;
  }
  if (phase === LavaPhase.erupting) {
    look.alpha = 255;
    look.green = 255;
    look.blue = 255;
    return look;
  }
  const into = floorMod(floorMod(frame - 1, LAVA_CYCLE_FRAMES), LAVA_SIDE_FRAMES) - LAVA_CALM_FRAMES;
  const swell = floorMod(into, LAVA_BUBBLE_FRAMES);
  const bubble = swell < LAVA_BUBBLE_FRAMES / 2 ? swell : LAVA_BUBBLE_FRAMES - swell;
  look.alpha = Math.floor(60 + (into * 120) / LAVA_WARNING_FRAMES) + bubble * 6;
  look.green = 110;
  look.blue = 40;
  return look;
}
