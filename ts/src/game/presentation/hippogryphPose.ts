import { f32 } from "wisp/src/sim/f32";
import { Character, HippogryphKind, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { ARCHER_RIDE_HOVER_FRAMES, ARCHER_RIDE_MAX_X } from "../sim/specials";

export const HIPPOGRYPH_MODEL = "Units\\NightElf\\HippoGryph\\HippoGryph.mdx";
// Warcraft's ehpr entry names RiddenHippoGryph, rather than HippoGryphRider.
export const HIPPOGRYPH_RIDER_MODEL = "Units\\NightElf\\RiddenHippoGryph\\RiddenHippoGryph.mdx";
const DEPART_FRAMES = 12;
const RIDE_OFFSET = 60.0;

export function archerMounted(fighter: Readonly<Fighter>): boolean {
  return fighter.character === Character.archer && !fighter.status.out && fighter.special.action === SpecialAction.archerRecovery
    && fighter.hippogryph.kind === HippogryphKind.mount && fighter.hippogryph.life > 0;
}

export interface HippogryphPose {
  visible: boolean;
  mounted: boolean;
  model: string;
  clip: string;
  seconds: number;
  x: number;
  z: number;
  facing: number;
  pitch: number;
  roll: number;
}

export interface HippogryphPresentationState {
  readonly pose: HippogryphPose;
  frame: number;
  entered: number;
  kind: HippogryphKind;
  velocityX: number;
  departed: number;
  departureX: number;
  departureZ: number;
}

export function createHippogryphPresentationState(): HippogryphPresentationState {
  return { pose: { visible: false, mounted: false, model: HIPPOGRYPH_MODEL, clip: "Stand", seconds: 0.0, x: 0.0, z: 0.0, facing: 1, pitch: 0.0, roll: 0.0 },
    frame: 0, entered: 0, kind: HippogryphKind.none, velocityX: 0.0, departed: 0, departureX: 0.0, departureZ: 0.0 };
}

/** Pure presentation: an interrupted mount flies away without adding a simulation summon or hit. */
export function projectHippogryph(state: HippogryphPresentationState, fighter: Readonly<Fighter> | undefined, frame: number): Readonly<HippogryphPose> {
  const pose = state.pose;
  if (fighter === undefined || fighter.status.out || frame < state.frame) {
    pose.visible = false;
    pose.mounted = false;
    state.kind = HippogryphKind.none;
    state.departed = 0;
  }
  state.frame = frame;
  if (fighter === undefined || fighter.status.out) return pose;
  const bird = fighter.hippogryph;
  const mounted = archerMounted(fighter);
  const kind = bird.life > 0 ? bird.kind : HippogryphKind.none;
  if (state.kind === HippogryphKind.mount && kind === HippogryphKind.none) {
    state.departed = frame;
    state.departureX = pose.x;
    state.departureZ = pose.z;
  }
  if (kind !== state.kind) state.entered = frame;
  if (kind !== HippogryphKind.none) state.departed = 0;
  state.kind = kind;
  pose.mounted = mounted;
  pose.model = mounted ? HIPPOGRYPH_RIDER_MODEL : HIPPOGRYPH_MODEL;
  pose.visible = bird.life > 0 || state.departed > 0 && frame - state.departed < DEPART_FRAMES;
  if (!pose.visible) return pose;
  const departing = kind === HippogryphKind.none;
  const age = frame - state.departed;
  pose.x = departing ? f32(state.departureX + f32(state.velocityX * age)) : bird.x;
  pose.z = departing ? f32(state.departureZ + age * 10.0) : f32(bird.z - (mounted || kind === HippogryphKind.released ? RIDE_OFFSET : 0.0));
  pose.facing = mounted ? fighter.facing : departing ? pose.facing : bird.velocityX === 0 ? fighter.facing : bird.velocityX < 0 ? -1 : 1;
  pose.clip = mounted ? fighter.special.frame < ARCHER_RIDE_HOVER_FRAMES ? "Stand" : "Walk"
    : kind === HippogryphKind.perch ? "Stand" : kind === HippogryphKind.dive || kind === HippogryphKind.released || departing ? "Attack" : "Walk";
  pose.seconds = f32((mounted ? fighter.special.frame : frame - state.entered) / 60.0);
  pose.pitch = mounted ? f32(-f32(Math.abs(bird.velocityX) / ARCHER_RIDE_MAX_X) * f32(0.2)) : 0.0;
  pose.roll = mounted ? f32(f32(bird.velocityX / ARCHER_RIDE_MAX_X) * f32(0.3)) : 0.0;
  if (!departing) state.velocityX = bird.velocityX;
  return pose;
}
