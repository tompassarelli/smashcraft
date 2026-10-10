








import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type Capsule, attackCapsule, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { AttackStyle } from "../sim/codes";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { HurtState, fighterHurtParts } from "../sim/hurtboxes";
import { stageClock } from "../match/rules";
import { fighterAt, isActive } from "../sim/roster";
import { surfaceCount, surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { stageBounds } from "../sim/stageBounds";
import { type FrameScratch } from "./moment";
import { type ParsedReplay, createFrameScratch, parseReplay, runReplayFrame } from "./matchReplay";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";

export const VIEWER_API = 1;


const KEYFRAME_FRAMES = 300;

interface SceneCapsule {
  readonly x1: number;
  readonly z1: number;
  readonly x2: number;
  readonly z2: number;
  readonly radius: number;
}

interface ScenePart extends SceneCapsule {

  readonly state: number;
}

export interface SceneFighter {
  readonly slot: number;
  readonly character: number;
  readonly x: number;
  readonly z: number;
  readonly facing: number;
  readonly damage: number;
  readonly stocks: number;
  readonly out: boolean;
  readonly parts: readonly ScenePart[];
  readonly strikes: readonly SceneCapsule[];
  readonly projectiles: readonly { readonly x: number; readonly z: number }[];
}

export interface ReplayScene {
  readonly frame: number;
  readonly stage: number;
  readonly surfaces: readonly { readonly left: number; readonly right: number; readonly z: number }[];
  readonly blast: { readonly left: number; readonly right: number; readonly bottom: number; readonly top: number };
  readonly fighters: readonly SceneFighter[];
}


export interface ReplayViewer {
  readonly build: string;
  readonly version: string;
  readonly serial: number;

  readonly first: number;
  readonly last: number;

  readonly frame: number;

  step(): boolean;

  seek(frame: number): void;
  scene(): ReplayScene;
}

const copyCapsule = (capsule: Readonly<Capsule>): SceneCapsule => ({ x1: capsule.x1, z1: capsule.z1, x2: capsule.x2, z2: capsule.z2, radius: capsule.radius });

function sceneFighter(slot: number, f: Readonly<Fighter>): SceneFighter {
  const facing = fighterPoseFacing(f);
  const placed = emptyCapsule();
  const parts = fighterHurtParts(f).map((part): ScenePart => ({
    ...copyCapsule(placeCapsule(placed, part, f.motion.x, f.motion.z, facing)), state: part.state ?? HurtState.normal,
  }));
  const strikes: SceneCapsule[] = [];
  const style = f.attack.style;
  if (style !== undefined && style !== AttackStyle.shot) {
    const region = emptyHitRegion();
    for (let index = 0; index < authoredHitRegionCount(style, f.tuning.moves); index++) {
      authoredHitRegion(region, f.character, style, f.attack.frame, f.attack.smashChargeFrames, index, f.tuning.moves);
      if (region.window <= 0) continue;
      const strike = attackCapsule(emptyCapsule(), style, region);
      strikes.push(copyCapsule(placeCapsule(strike, strike, f.motion.x, f.motion.z, f.facing)));
    }
  }
  const projectiles: { x: number; z: number }[] = [];
  for (const projectile of f.projectiles) if (projectile.life > 0) projectiles.push({ x: projectile.x, z: projectile.z });
  return {
    slot, character: f.character, x: f.motion.x, z: f.motion.z, facing, damage: f.status.damage, stocks: f.status.stocks, out: f.status.out,
    parts, strikes, projectiles,
  };
}


function replayScene(state: Readonly<ReplayState>, frame: number): ReplayScene {
  const stage = state.match.stageChoice;
  const surfaces: { left: number; right: number; z: number }[] = [];
  for (let index = 0; index < surfaceCount(stage); index++) {
    const matchFrame = stageClock(state.match);
    surfaces.push({ left: surfaceLeft(stage, index, matchFrame), right: surfaceRight(stage, index, matchFrame), z: surfaceZ(stage, index, matchFrame) });
  }
  const fighters: SceneFighter[] = [];
  for (const slot of PARTICIPANT_SLOTS) if (isActive(state.world, slot)) fighters.push(sceneFighter(slot, fighterAt(state.world, slot)));
  const { blast } = stageBounds(stage);
  return { frame, stage, surfaces, blast: { left: blast.left, right: blast.right, bottom: blast.bottom, top: blast.top }, fighters };
}

interface Keyframe {
  readonly state: ReplayState;
  readonly segment: number;
}

class Viewer implements ReplayViewer {
  readonly build: string;
  readonly version: string;
  readonly serial: number;
  readonly first: number;
  readonly last: number;
  frame: number;
  private segment = 0;
  private readonly state = createReplaySnapshot();
  private readonly scratch: FrameScratch = createFrameScratch();
  private readonly keyframes = new Map<number, Keyframe>();

  constructor(private readonly replay: ParsedReplay) {
    this.build = replay.build;
    this.version = replay.version;
    this.serial = replay.serial;
    const start = at(replay.segments, 0);
    this.first = start.start;
    this.last = replay.frame;
    this.frame = this.first;
    copyReplayState(this.state, start.state);
  }

  step(): boolean {
    if (this.frame >= this.last) return false;
    let segment = at(this.replay.segments, this.segment);
    const next = this.frame + 1;
    if (next > segment.start + segment.frames.length) {

      this.segment++;
      segment = at(this.replay.segments, this.segment);
      copyReplayState(this.state, segment.state);
    }
    if (!runReplayFrame(this.state, this.replay.input, this.scratch, at(segment.frames, next - segment.start - 1), next)) return false;
    this.frame = next;
    if (floorMod(next, KEYFRAME_FRAMES) === 0 && !this.keyframes.has(next)) {
      const state = createReplaySnapshot();
      copyReplayState(state, this.state);
      this.keyframes.set(next, { state, segment: this.segment });
    }
    return true;
  }

  seek(frame: number): void {
    const target = Math.max(this.first, Math.min(this.last, frame));
    let base: number | undefined;
    for (const keyframe of this.keyframes.keys()) if (keyframe <= target && (base === undefined || keyframe > base)) base = keyframe;
    if (target < this.frame || (base !== undefined && base > this.frame)) {
      const keyframe = base === undefined ? undefined : this.keyframes.get(base);
      if (base === undefined || keyframe === undefined) {
        this.segment = 0;
        copyReplayState(this.state, at(this.replay.segments, 0).state);
        this.frame = this.first;
      } else {
        this.segment = keyframe.segment;
        copyReplayState(this.state, keyframe.state);
        this.frame = base;
      }
    }
    while (this.frame < target && this.step()) {

    }
  }

  scene(): ReplayScene {
    return replayScene(this.state, this.frame);
  }
}


export function openReplay(lines: readonly string[]): ReplayViewer | string {
  const replay = parseReplay(lines);
  return typeof replay === "string" ? replay : new Viewer(replay);
}
