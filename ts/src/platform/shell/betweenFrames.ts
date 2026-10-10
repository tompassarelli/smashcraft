










import { trampoline } from "wisp/src/platform/dispatch";
import { FRAME_SECONDS } from "../../game/presentation/fighterPose";
import { effectMotion } from "../../game/render/effects";


export const DRAW_EVENT = "shell.draw";

const DRAW_PERIOD = 0.0;

const SMOOTHING_FRAMES = 1.5;

const AVERAGE_WEIGHT = 0.125;

interface BetweenFrames {

  tick: timer | undefined;
  drawing: boolean;
  drawsSinceTick: number;

  drawsPerTick: number;
}

declare global {
  var __smashcraftBetweenFrames: BetweenFrames | undefined;
}

function state(): BetweenFrames {
  return (globalThis.__smashcraftBetweenFrames ??= { tick: undefined, drawing: false, drawsSinceTick: 0, drawsPerTick: 0.0 });
}


export function startFrameClock(tick: timer): void {
  state().tick = tick;
}


export function startDrawingBetweenFrames(): boolean {
  const frames = state();
  if (frames.drawing) return false;
  frames.drawing = true;
  effectMotion().tracking = true;
  TimerStart(CreateTimer(), DRAW_PERIOD, true, trampoline(DRAW_EVENT));
  return true;
}



export function beginPresentedFrame(moving: boolean): void {
  const frames = state();
  const motion = effectMotion();
  if (!motion.tracking) return;
  frames.drawsPerTick += (frames.drawsSinceTick - frames.drawsPerTick) * AVERAGE_WEIGHT;
  frames.drawsSinceTick = 0;
  motion.smoothing = moving && frames.drawsPerTick >= SMOOTHING_FRAMES;
  motion.beginFrame();
}


export function drawBetweenFrames(): void {
  const frames = state();
  frames.drawsSinceTick++;
  const { tick } = frames;
  if (tick === undefined) return;
  const ticks = TimerGetElapsed(tick) / FRAME_SECONDS;
  effectMotion().draw(ticks - Math.floor(ticks));
}
