
import { parseModelMDX } from "wisp/scripts/wisp/models";
import { Character, DownState, LedgeState } from "../../src/game/sim/codes";
import { createFighter } from "../../src/game/sim/fighter";
import { createRoster, neutralControls } from "../../src/game/sim/roster";
import { advanceFighter } from "../../src/game/sim/step";
import { TECH_IN_PLACE_FRAMES, TECH_ROLL_FRAMES } from "../../src/game/sim/down";
import { beginDownState } from "../../src/game/sim/transitions";
import { advanceFighterPose, createFighterPose } from "../../src/game/presentation/fighterPose";
import { groundLocomotionClip } from "../../src/game/presentation/fighterLocomotion";
import { IllidanLocomotion } from "../../src/game/presentation/illidanMotion";
import { type PoseFrame, DrawnModel, capture } from "./hurtboxView";

export const MOTION_STATES = ["walk", "dash", "run", "turn", "brake", "jump-squat", "roll-forward", "roll-back", "spot-dodge", "air-dodge", "tech", "tech-forward", "tech-back", "get-up", "get-up-forward", "get-up-back", "get-up-attack", "ledge-get-up", "ledge-roll", "ledge-attack"] as const;
type MotionState = (typeof MOTION_STATES)[number];


function sampleMotion(character: Character, state: MotionState): PoseFrame[] {
  const f = createFighter(character, 0.0, 1);
  const world = createRoster(1, [f]);
  const pose = createFighterPose();
  const input = neutralControls();
  const moving = ["walk", "dash", "run", "turn", "brake"].includes(state);
  if (moving) {
    input.direction = 1;
    input.walking = state === "walk";

    if (state !== "walk" && state !== "dash") {
      for (let tick = 0; tick < 15; tick++) {
        f.motion.x = 0.0;
        advanceFighter(world, 0, 0, input, 0.0);
        advanceFighterPose(pose, f, world, input, false, false, false, false);
      }
    }
    if (state === "turn") input.direction = -1;
    if (state === "brake") input.direction = 0;
  }
  const down = state === "tech" ? DownState.tech : state.startsWith("tech-") ? DownState.techRoll
    : state === "get-up" ? DownState.stand : state === "get-up-attack" ? DownState.attack
    : state.startsWith("get-up-") ? DownState.roll : undefined;
  if (down !== undefined) beginDownState(f, down, state.endsWith("back") ? -1 : 1);
  if (state.startsWith("ledge-")) {
    f.ledge.state = state === "ledge-get-up" ? LedgeState.climb : state === "ledge-roll" ? LedgeState.roll : LedgeState.attack;
    f.ledge.side = -1;
  }
  if (state === "roll-forward" || state === "roll-back" || state === "spot-dodge") {
    f.dodge.groundFrame = 1;
    f.dodge.groundDirection = state === "spot-dodge" ? 0 : state === "roll-back" ? -1 : 1;
    f.dodge.groundEntryFacing = 1;
  }
  if (state === "air-dodge") {
    f.motion.grounded = false;
    f.dodge.airDodging = true;
  }
  if (state === "jump-squat") f.jump.squat = f.tuning.physics.jumpSquatFrames;
  const groundDodge = state === "roll-forward" || state === "roll-back" || state === "spot-dodge";
  const ticks = state === "dash" ? 10 : state === "turn" || state === "brake" ? 8
    : state === "jump-squat" ? f.tuning.physics.jumpSquatFrames : state === "get-up-attack" ? 49
    : state === "air-dodge" ? 49 : state === "ledge-get-up" ? 25 : state === "ledge-roll" ? 36 : state === "ledge-attack" ? 40
    : state === "spot-dodge" ? 22 : state === "tech" ? TECH_IN_PLACE_FRAMES : state.startsWith("tech-") ? TECH_ROLL_FRAMES : state === "get-up" ? 30
    : state.startsWith("get-up-") ? 35 : moving ? 60 : 31;
  const frames: PoseFrame[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    if (moving) {

      f.motion.x = 0.0;
      advanceFighter(world, 0, 0, input, 0.0);
    } else {
      f.down.frame = tick + 1;
      if (groundDodge) f.dodge.groundFrame = tick + 1;
      f.ledge.frame = tick + 1;
      if (state === "get-up-attack") f.attack.frame = tick;
    }
    advanceFighterPose(pose, f, world, input, false, false, state === "get-up-attack" && tick === 0, false);
    frames.push({ ...capture(f, pose), frame: tick });
  }
  return frames;
}

export interface DrawnMotionRow {
  readonly character: Character;
  readonly state: MotionState;
  readonly model: string;
  readonly clips: readonly number[];
  readonly names: readonly string[];

  readonly motion: number;

  readonly body: number;
  readonly direction: "forward" | "back" | "up" | "down" | "both" | "in place";

  readonly toward: number;
  readonly against: number;
}

export function measureDrawnMotion(drawn: DrawnModel, character: Character, state: MotionState, model: string): DrawnMotionRow {
  const frames = sampleMotion(character, state);
  const first = frames[0];
  if (first?.clip === undefined) throw new Error(`${character}/${state}: no clip`);
  const initial = drawn.triangles(first.clip, first.seconds, first.facing);
  const distances = new Float32Array(initial.length / 2);
  const direction = state.endsWith("back") || state === "turn" ? "back"
    : state === "jump-squat" ? "down" : state === "get-up" || state === "ledge-get-up" ? "up"
    : state.endsWith("attack") ? "both" : state === "walk" || state === "dash" || state === "run" || state.includes("forward") || state === "ledge-roll" ? "forward" : "in place";
  const axis = direction === "up" || direction === "down" ? 1 : 0;
  const sign = direction === "back" || direction === "down" ? -1 : 1;
  let toward = 0;
  let against = 0;
  for (const frame of frames) {
    if (frame.clip === undefined) throw new Error(`${character}/${state}: no clip`);
    const vertices = drawn.triangles(frame.clip, frame.seconds, frame.facing);

    for (let index = 0; index < Math.min(initial.length, vertices.length); index += 2) {
      distances[index / 2] = Math.max(distances[index / 2] ?? 0, Math.hypot((vertices[index] ?? 0) - (initial[index] ?? 0), (vertices[index + 1] ?? 0) - (initial[index + 1] ?? 0)));
      const projected = sign * ((vertices[index + axis] ?? 0) - (initial[index + axis] ?? 0));
      toward = Math.max(toward, projected);
      against = Math.max(against, -projected);
    }
  }
  const clips = [...new Set(frames.map((frame) => frame.clip ?? -1))];
  return { character, state, model, clips, names: clips.map((clip) => drawn.sequenceName(clip) ?? "missing"), motion: Math.max(0, ...distances), body: distances.reduce((sum, distance) => sum + distance, 0) / Math.max(1, distances.length), direction, toward, against };
}

export interface DrawnStride {
  readonly character: Character;
  readonly motion: "walk" | "run";
  readonly clip: number;
  readonly model: string;

  readonly speed: number;
}


export function measureDrawnStride(bytes: ArrayBuffer, drawn: DrawnModel, character: Character, motion: "walk" | "run", model: string): DrawnStride {
  const clip = groundLocomotionClip(character, motion === "walk" ? IllidanLocomotion.walk : IllidanLocomotion.run);
  const sequence = clip === undefined ? undefined : parseModelMDX(bytes).Sequences[clip.index];
  if (clip === undefined || sequence === undefined) throw new Error(`${character}/${motion}: no sequence`);
  const seconds = ((sequence.Interval[1] ?? 0) - (sequence.Interval[0] ?? 0)) / 1000;
  const samples = Array.from({ length: 61 }, (_, frame) => drawn.triangles(clip.index, seconds * frame / 60, 1));
  const first = samples[0];
  if (first === undefined) throw new Error("no stride samples");
  const floor = Math.min(...first.filter((_, index) => index % 2 === 1));
  let sum = 0;
  let count = 0;
  for (let index = 0; index < first.length; index += 2) {
    let low = 0;
    let left = Infinity;
    let right = -Infinity;
    for (const vertices of samples) {
      if ((vertices[index + 1] ?? Infinity) < floor + 15) low++;
      left = Math.min(left, vertices[index] ?? Infinity);
      right = Math.max(right, vertices[index] ?? -Infinity);
    }
    if (low > 10) { sum += 2 * (right - left) / seconds; count++; }
  }
  const stride = sum / Math.max(1, count);

  const speed = character === Character.lich ? sequence.MoveSpeed : stride;
  if (!Number.isFinite(speed) || speed <= 0) throw new Error(`${character}/${motion}: no drawn stride`);
  return { character, motion, clip: clip.index, model, speed };
}

export function drawnStrideSource(rows: readonly DrawnStride[]): string {
  return [
    "// Generated by `bun wisp view motion --assets DIR`; regenerate instead of editing.",
    'import { f32 } from "wisp/src/sim/f32";',
    "/** Drawn foot travel in world units per second at 1x clip speed (#171). */",
    "export const DRAWN_STRIDES: { readonly [character: number]: { readonly walk: { readonly clip: number; readonly model: string; readonly speed: number }; readonly run: { readonly clip: number; readonly model: string; readonly speed: number } } | undefined } = {",
    ...[...new Set(rows.map((row) => row.character))].map((character) => `  ${character}: { ${rows.filter((row) => row.character === character).map((row) => `${row.motion}: { clip: ${row.clip}, model: ${JSON.stringify(row.model)}, speed: f32(${row.speed.toFixed(3)}) }`).join(", ")} },`),
    "};", "",
  ].join("\n");
}
