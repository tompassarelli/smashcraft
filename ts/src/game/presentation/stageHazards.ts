import { type MatchState, stageClock } from "../match/rules";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { CARRIED_TEST_STAGE, TIMED_TEST_STAGE, surfaceWaitFrames } from "../sim/stage";
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

/** A warning in the players' language, before wind, a turn of the tide, platform motion or a shot. */
export function stageWarning(game: Readonly<MatchState>, world: Readonly<Roster>): string {
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
  return "";
}
