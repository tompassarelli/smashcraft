// How busy the match camera is (#110, smashcraft:docs/melee-camera.md): fixed
// computer-against-computer matches, played in process as
// scripts/cpuField.ts plays them, read the canonical camera after every frame.
// The same fighter paths also drive a reference port of Melee's gameplay
// camera (melee:src/melee/cm/camera.c `Camera_8002B3D4`) in Melee units (world
// / 6), so each run reports ours beside Melee's. Movement is what the viewer
// sees: pan as a fraction of the visible width or height a frame, zoom as the
// relative change of eye distance a frame, travel as their sum a second, and
// reversals a second (a delta whose sign flips while both exceed 0.05% of the
// view).
// Usage (from ts/): bun scripts/cameraFeel.ts [--json FILE]
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { f32 } from "wisp/src/sim/f32";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS, type Slots } from "../src/game/input/participants";
import { produceComputerInput } from "../src/game/match/botPlay";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState, setParticipants } from "../src/game/match/rules";
import { initializeMatchFighters, matchSpawnX } from "../src/game/match/step";
import { createFighter } from "../src/game/sim/fighter";
import { selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { MATCH_CAMERA_ASPECT } from "../src/game/sim/matchCamera";
import { copyControls, createRoster, fighterAt, isActive, neutralControls, type Roster } from "../src/game/sim/roster";
import { stageBounds } from "../src/game/sim/stageBounds";

/** The fixed scenario set: fighter pairs on the main deck, the bridges and Frozen Throne. */
export const CAMERA_SCENARIOS: readonly { readonly a: string; readonly b: string; readonly stage: number; readonly shift: number }[] = [
  { a: "archer", b: "blademaster", stage: 0, shift: 0.0 },
  { a: "rifleman", b: "mountain-king", stage: 0, shift: -60.0 },
  { a: "illidan", b: "forsaken-paladin", stage: 1, shift: 0.0 },
  { a: "warden", b: "lich", stage: 1, shift: 60.0 },
  { a: "dreadlord", b: "shadow-hunter", stage: 2, shift: 0.0 },
  { a: "blademaster", b: "archer", stage: 2, shift: -60.0 },
];

const NEUTRAL = neutralControls();
const REVERSAL_FLOOR = 0.0005;
const radians = (degrees: number) => (degrees * Math.PI) / 180.0;

/** One frame of a camera as the viewer sees it: centre, eye distance and the visible size at the fighters' plane. */
interface View { readonly x: number; readonly z: number; readonly distance: number; readonly width: number; readonly height: number }

const box = () => ({ left: -1.0, right: 1.0, top: 1.0, bottom: -1.0 });

/**
 * Melee's standard camera on our fighter paths, in Melee units: subject boxes
 * (ftcamera.c, ftData +0x3C for Fox/Falco/Falcon), `Camera_800293E0` extent
 * easing, `Camera_8002958C` bounds, `Camera_80029CF8` fit with Final
 * Destination's angles, a corner clamp standing in for `Camera_8002A768`, and
 * `Camera_80029AAC`/`Camera_80029C88` easing, with cm_803BCCA0's constants.
 */
class MeleeCamera {
  private readonly ext: Slots<{ left: number; right: number; top: number; bottom: number }> = [box(), box(), box(), box()];
  private interest = { x: 0.0, y: 0.0 };
  private eye = { x: 0.0, y: 0.0, z: 0.0 };
  private fov = 30.0;
  private started = false;

  step(world: Readonly<Roster>, stage: number): View | undefined {
    const camera = stageBounds(stage).camera;
    const bounds = { left: camera.left / 6, right: camera.right / 6, bottom: camera.bottom / 6, top: camera.top / 6 };
    const live = PARTICIPANT_SLOTS.filter((slot) => isActive(world, slot) && !fighterAt(world, slot).status.out);
    if (live.length === 0) return undefined;
    const multiplier = (live.length === 1 ? 1.5 : live.length === 2 ? 1.32 : live.length === 3 ? 1.16 : 1.0) * 1.5;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const clampX = (x: number) => Math.min(bounds.right, Math.max(bounds.left, x));
    const clampY = (y: number) => Math.min(bounds.top, Math.max(bounds.bottom, y));
    for (const slot of live) {
      const fighter = fighterAt(world, slot);
      const ext = this.ext[slot];
      const target = fighter.facing > 0 ? { left: -9.0, right: 22.0 * 1.5 } : { left: -22.0 * 1.5, right: 9.0 };
      const ease = (current: number, goal: number) => (goal - current > 0.5 ? current + 0.5 : goal - current < -0.5 ? current - 0.5 : goal);
      ext.left = this.started ? ease(ext.left, target.left) : target.left;
      ext.right = this.started ? ease(ext.right, target.right) : target.right;
      ext.top = this.started ? ease(ext.top, 16.0) : 16.0;
      ext.bottom = this.started ? ease(ext.bottom, -9.0) : -9.0;
      const x = clampX(fighter.motion.x / 6);
      const y = clampY(fighter.motion.z / 6 + 10.0);
      minX = Math.min(minX, clampX(x + ext.left * multiplier));
      maxX = Math.max(maxX, clampX(x + ext.right * multiplier));
      minY = Math.min(minY, clampY(y + ext.bottom * multiplier));
      maxY = Math.max(maxY, clampY(y + ext.top * multiplier));
    }
    const depth = Math.abs(this.eye.z);
    minY -= 390.0 * Math.min(1.0, Math.max(0.0, (depth - 80.0) / 4920.0)) + 10.0;
    this.fov = this.started ? this.fov + (38.0 - this.fov) * 0.1 : 30.0;
    const spread = Math.max(maxX - minX, maxY - minY);
    const bias = spread > 120.0 ? 0.0682 : spread < 60.0 ? 0.0 : (0.0682 * (spread - 60.0)) / 60.0;
    const base = (minY - 12.0 + (maxY - 12.0)) * (0.5 - bias) + 12.0;
    const tilt = radians(Math.min(5.0, Math.max(-7.0, -(base - 30.0) * 0.05)) - 10.0);
    const half = radians(this.fov) * 0.5;
    const up = Math.tan(half + tilt);
    const down = Math.tan(half - tilt);
    const distanceY = (maxY - minY) / (up + down);
    const offsetY = distanceY * Math.tan(tilt);
    const pan = radians(Math.min(17.5, Math.max(-17.5, -((minX + maxX) * 0.5) * 0.05)));
    const right = 1.2173333 * Math.tan(half - pan);
    const left = 1.2173333 * Math.tan(half + pan);
    const distanceX = (maxX - minX) / (right + left);
    const offsetX = 1.2173333 * distanceX * Math.tan(pan);
    const target = { x: maxX - distanceX * right - offsetX, y: offsetY + (maxY - distanceY * up), z: Math.min(1000.0, Math.max(83.0, Math.max(distanceX, distanceY))) };
    // The view's corners stay inside the camera range, centred when both opposite sides overflow.
    const halfHeight = target.z * Math.tan(radians(38.0) * 0.5);
    const halfWidth = halfHeight * 1.2173333;
    const shift = (low: number, high: number, min: number, max: number) => {
      const under = Math.max(0.0, min - low);
      const over = Math.min(0.0, max - high);
      return under > 0.0 && over < 0.0 ? 0.5 * (under + over) : under > 0.0 ? under : over;
    };
    target.x += shift(target.x - halfWidth, target.x + halfWidth, bounds.left, bounds.right);
    target.y += shift(target.y - halfHeight, target.y + halfHeight, bounds.bottom, bounds.top);
    const follow = Math.min(1.0, Math.max(0.0001, (spread > 900.0 ? 0.1 : spread < 120.0 ? 0.05 : 0.05 + (0.05 * (spread - 120.0)) / 780.0) * 1.8));
    if (this.started) {
      this.interest = { x: this.interest.x + (target.x - this.interest.x) * follow, y: this.interest.y + (target.y - this.interest.y) * follow };
      this.eye = { x: this.eye.x + (target.x + offsetX - this.eye.x) * 0.27, y: this.eye.y + (target.y - offsetY - this.eye.y) * 0.27, z: this.eye.z + (target.z - this.eye.z) * 0.27 };
    } else {
      this.interest = { x: target.x, y: target.y };
      this.eye = { x: target.x + offsetX, y: target.y - offsetY, z: target.z };
    }
    this.started = true;
    const height = 2.0 * this.eye.z * Math.tan(radians(this.fov) * 0.5);
    return { x: this.interest.x, z: this.interest.y, distance: this.eye.z, width: height * 1.2173333, height };
  }
}

interface Samples { pan: number[]; zoom: number[]; jerk: number[]; reversals: [number, number, number]; frames: number }
const samples = (): Samples => ({ pan: [], zoom: [], jerk: [], reversals: [0, 0, 0], frames: 0 });

/** Adds one frame's movement from `before` to `now`; `last` holds each axis's last delta above the floor. */
function observe(into: Samples, before: View, now: View, last: [number, number, number], velocity: [number, number, number]): void {
  const deltas = [(now.x - before.x) / now.width, (now.z - before.z) / now.height, (now.distance - before.distance) / before.distance] as const;
  if (into.frames > 0) into.jerk.push(Math.hypot(deltas[0] - velocity[0], deltas[1] - velocity[1], deltas[2] - velocity[2]));
  velocity[0] = deltas[0];
  velocity[1] = deltas[1];
  velocity[2] = deltas[2];
  into.pan.push(Math.hypot(deltas[0], deltas[1]));
  into.zoom.push(Math.abs(deltas[2]));
  for (const axis of [0, 1, 2] as const) {
    const delta = deltas[axis];
    if (Math.abs(delta) <= REVERSAL_FLOOR) continue;
    if (Math.abs(last[axis]) > REVERSAL_FLOOR && Math.sign(delta) !== Math.sign(last[axis])) into.reversals[axis]++;
    last[axis] = delta;
  }
  into.frames++;
}

function playScenario(scenario: (typeof CAMERA_SCENARIOS)[number], ours: Samples, melee: Samples): void {
  const a = selectableCharacterBySlug(scenario.a);
  const b = selectableCharacterBySlug(scenario.b);
  if (a === undefined || b === undefined) throw new Error(`unknown fighter in ${scenario.a} ${scenario.b}`);
  const match = createMatchState();
  setParticipants(match, 0, 3);
  match.characterChoices[0] = a;
  match.characterChoices[1] = b;
  match.stageChoice = scenario.stage;
  match.stockCount = 2;
  match.timeLimitMinutes = 1;
  match.remainingFrames = 60 * MATCH_TICKS_PER_SECOND;
  match.phase = Phase.match;
  const world = createRoster(3, [createFighter(a, f32(matchSpawnX(0) + scenario.shift), 1), createFighter(b, f32(matchSpawnX(1) + scenario.shift), -1)]);
  const controls = createFrameControls();
  const produced = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  initializeMatchFighters(match, world);
  const camera = match.camera;
  const reference = new MeleeCamera();
  let previous: { ours: View; melee: View } | undefined;
  const lastOurs: [number, number, number] = [0, 0, 0];
  const lastMelee: [number, number, number] = [0, 0, 0];
  const velocityOurs: [number, number, number] = [0, 0, 0];
  const velocityMelee: [number, number, number] = [0, 0, 0];
  let frame = 0;
  while (match.phase === Phase.match && frame < 65 * MATCH_TICKS_PER_SECOND) {
    frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if (slot <= 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
    }
    if (!captureFrame(row, frame, world.mask, produced, runtime)) throw new Error(`capture refused frame ${frame}`);
    if (!executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`execution refused frame ${frame}`);
    const meleeView = reference.step(world, scenario.stage);
    if (!camera.initialized || meleeView === undefined) continue;
    const height = 2.0 * camera.distance * camera.tangent;
    const oursView = { x: camera.x, z: camera.z, distance: camera.distance, width: height * MATCH_CAMERA_ASPECT, height };
    if (previous !== undefined) {
      observe(ours, previous.ours, oursView, lastOurs, velocityOurs);
      observe(melee, previous.melee, meleeView, lastMelee, velocityMelee);
    }
    previous = { ours: oursView, melee: meleeView };
  }
}

const quantile = (sorted: readonly number[], q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;

function summarize(from: Samples) {
  const pan = [...from.pan].sort((x, y) => x - y);
  const zoom = [...from.zoom].sort((x, y) => x - y);
  const jerk = [...from.jerk].sort((x, y) => x - y);
  const perSecond = (n: number) => (n * MATCH_TICKS_PER_SECOND) / from.frames;
  return {
    frames: from.frames,
    pan: [quantile(pan, 0.5), quantile(pan, 0.95), quantile(pan, 0.99), pan.at(-1) ?? 0],
    zoom: [quantile(zoom, 0.5), quantile(zoom, 0.95), quantile(zoom, 0.99), zoom.at(-1) ?? 0],
    jerk: [quantile(jerk, 0.5), quantile(jerk, 0.95), quantile(jerk, 0.99), jerk.at(-1) ?? 0],
    snaps: from.pan.filter((value) => value > 0.03).length + from.zoom.filter((value) => value > 0.06).length,
    panTravel: perSecond(from.pan.reduce((sum, value) => sum + value, 0)),
    zoomTravel: perSecond(from.zoom.reduce((sum, value) => sum + value, 0)),
    reversals: from.reversals.map(perSecond),
  };
}

/** Ours and Melee's reference camera over the fixed scenarios. */
export function measureCameraFeel() {
  const ours = samples();
  const melee = samples();
  for (const scenario of CAMERA_SCENARIOS) playScenario(scenario, ours, melee);
  return { ours: summarize(ours), melee: summarize(melee) };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { json: { type: "string" } } });
  const result = measureCameraFeel();
  const percent = (values: readonly number[]) => values.map((value) => `${(value * 100).toFixed(2)}%`).join(" / ");
  console.log(`${result.ours.frames} frames over ${CAMERA_SCENARIOS.length} computer matches`);
  for (const [name, view] of [["ours ", result.ours], ["melee", result.melee]] as const) {
    console.log(`${name} pan/frame p50/p95/p99/max ${percent(view.pan)}; zoom/frame ${percent(view.zoom)}`);
    console.log(`${name} velocity change/frame p50/p95/p99/max ${percent(view.jerk)}; snap frames (pan > 3% or zoom > 6%) ${view.snaps}`);
    console.log(`${name} travel/s pan ${(view.panTravel * 100).toFixed(1)}% zoom ${(view.zoomTravel * 100).toFixed(1)}%; reversals/s x/z/zoom ${view.reversals.map((n) => n.toFixed(2)).join(" / ")}`);
  }
  if (values.json !== undefined) writeFileSync(values.json, JSON.stringify(result, null, 2));
}
