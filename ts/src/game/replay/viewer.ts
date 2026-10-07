// The replay viewer's simulation (smashcraft:docs/design/client.md, "Full-match
// replays"): a joined replay opened as a player that steps a frame at a time,
// seeks to any frame and describes the replayed state for drawing (fighters,
// their hurt volumes, active strikes, projectiles and the stage). The client
// builds this module into each version's simulation bundle and keeps the
// bundles of versions it has played, so VIEWER_API is the shape every client
// can call: add to it, never change it. The client also runs this module
// inside an older map's own simulation (viewerDriver.ts), so it calls only
// simulation functions whose shape has held since replays began.
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

/** Frames between the states a viewer keeps, so a seek runs at most this many frames. */
const KEYFRAME_FRAMES = 300;

export interface SceneCapsule {
  readonly x1: number;
  readonly z1: number;
  readonly x2: number;
  readonly z2: number;
  readonly radius: number;
}

export interface ScenePart extends SceneCapsule {
  /** 0 normal, 1 invincible, 2 intangible. */
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

/** A replay opened for watching. */
export interface ReplayViewer {
  readonly build: string;
  readonly version: string;
  readonly serial: number;
  /** The frame the replay starts after, and its last frame. */
  readonly first: number;
  readonly last: number;
  /** The frame the shown state is after. */
  readonly frame: number;
  /** Runs the next frame; false at the last frame or when a frame can't run. */
  step(): boolean;
  /** Shows the state after `frame`, clamped to the replay. */
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

/** What the replayed state looks like after `frame`. */
export function replayScene(state: Readonly<ReplayState>, frame: number): ReplayScene {
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
      // The shell changed the match between frames here; the next segment starts from the state it left.
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
      // Each step runs one saved frame.
    }
  }

  scene(): ReplayScene {
    return replayScene(this.state, this.frame);
  }
}

/** A joined replay opened for watching, or what is wrong with it. */
export function openReplay(lines: readonly string[]): ReplayViewer | string {
  const replay = parseReplay(lines);
  return typeof replay === "string" ? replay : new Viewer(replay);
}
