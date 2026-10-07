// Drawing between simulation frames on fast displays (#169,
// smashcraft:docs/high-refresh.md). The simulation runs on the 60 Hz tick
// timer; once started, a zero-period timer draws placed effects part of the way
// to their latest positions (game/render/motion.ts). It reads only this
// client's clocks and changes only existing effects' positions, so it is local
// presentation: no handle is made or freed and no simulation state is read or
// written.
//
// Off until `-dev smooth-draw` starts it: a zero-period timer is not a measured
// render-rate hook (its callbacks can far outnumber rendered frames), so it
// stays off in players' builds until #169's native cadence result selects it.
import { trampoline } from "wisp/src/platform/dispatch";
import { FRAME_SECONDS } from "../../game/presentation/fighterPose";
import { effectMotion } from "../../game/render/effects";

/** The dispatch name of the draw timer's callback. */
export const DRAW_EVENT = "shell.draw";
/** The draw timer's period: zero, so it runs as often as Warcraft runs timers. */
const DRAW_PERIOD = 0.0;
/** Smoothing starts at 1.5 drawn frames a simulation frame: displays drawing 90 frames a second or more. */
const SMOOTHING_FRAMES = 1.5;
/** Weight of the latest simulation frame in the drawn-frames average. */
const AVERAGE_WEIGHT = 0.125;

interface BetweenFrames {
  /** The 60 Hz tick timer, read for how far the game is toward the next simulation frame. */
  tick: timer | undefined;
  drawing: boolean;
  drawsSinceTick: number;
  /** Drawn frames a simulation frame, averaged. */
  drawsPerTick: number;
}

declare global {
  var __smashcraftBetweenFrames: BetweenFrames | undefined;
}

function state(): BetweenFrames {
  return (globalThis.__smashcraftBetweenFrames ??= { tick: undefined, drawing: false, drawsSinceTick: 0, drawsPerTick: 0.0 });
}

/** Remembers the tick timer, made at setup. */
export function startFrameClock(tick: timer): void {
  state().tick = tick;
}

/** Starts drawing between simulation frames (`-dev smooth-draw`); returns false when already started. */
export function startDrawingBetweenFrames(): boolean {
  const frames = state();
  if (frames.drawing) return false;
  frames.drawing = true;
  effectMotion().tracking = true;
  TimerStart(CreateTimer(), DRAW_PERIOD, true, trampoline(DRAW_EVENT));
  return true;
}

/** Drawn frames a simulation frame, averaged over the last few dozen. */
export function drawnFramesPerTick(): number {
  return state().drawsPerTick;
}

/** Once per simulation callback, before presentation places effects: smooths only on fast displays while `moving`. */
export function beginPresentedFrame(moving: boolean): void {
  const frames = state();
  const motion = effectMotion();
  if (!motion.tracking) return;
  frames.drawsPerTick += (frames.drawsSinceTick - frames.drawsPerTick) * AVERAGE_WEIGHT;
  frames.drawsSinceTick = 0;
  motion.smoothing = moving && frames.drawsPerTick >= SMOOTHING_FRAMES;
  motion.beginFrame();
}

/** Once per draw-timer callback. */
export function drawBetweenFrames(): void {
  const frames = state();
  frames.drawsSinceTick++;
  const { tick } = frames;
  if (tick === undefined) return;
  const ticks = TimerGetElapsed(tick) / FRAME_SECONDS;
  effectMotion().draw(ticks - Math.floor(ticks));
}
