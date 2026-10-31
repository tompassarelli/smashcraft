import { f32 } from "wisp/src/sim/f32";
import { Character, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { groundHit } from "../../sim/heroes/groundNormals";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { type AimByMotion, type AuthoredSpecial, type SpecialKit, type SpecialProjectile, frames } from "../../sim/specials/schema";
import type { StickMotion } from "../../sim/stickMotion";
import { standinCastBody, standinHit, strike } from "../standin/moves";

const h = (multiple: number): number => f32(HERO_REFERENCE_HEIGHT * f32(multiple));

export const RAZE_UNIT = h(f32(0.7));
export const RAZE_RADIUS = h(f32(0.35));
export const RAZE_FRONT = hurtCapsule(Character.firelord).radius;
export const RAZE_REACH: { readonly near: number; readonly mid: number; readonly far: number } = {
  near: f32(RAZE_FRONT + RAZE_UNIT), mid: f32(RAZE_FRONT + f32(2.0 * RAZE_UNIT)), far: f32(RAZE_FRONT + f32(3.0 * RAZE_UNIT)),
};
export const RAZE_READ_FRAME = 14;
export const RAZE_MOTION_WINDOW = 10;
export const RAZE_LAUNCH_ANGLE = 60;
export const RAZE_TELL_FRAMES = 10;
export const RAZE_ERUPT_FRAMES = 4;
export const RAZE_GLOW_FRAMES = 14;
export const RAZE_END_FRAME = 30;
export const RAZE_AIR_LANDING_LAG = 20;
export const RAZE_DAMAGE = 12.0;
const RAZE_FLOOR_REACH = h(f32(0.3));

const TELL_MODEL = "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeTarget.mdx";
const COLUMN_MODEL = "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx";
// FlameStrike1.mdx draws its column only in birth, fading in by 1.05 s and out by 5.1 s; the eruption and its glow play that stretch across their frames.
const COLUMN_FROM = f32(1.05);
const COLUMN_RATE = f32(f32(f32(5.1) - f32(1.05)) / f32((RAZE_ERUPT_FRAMES + RAZE_GLOW_FRAMES) / 60));
const COLUMN_ART_RADIUS = 155.0;

const column = (life: number, from: number): Pick<SpecialProjectile, "model" | "modelRadius" | "modelOffsetZ" | "modelAnimation" | "life"> => ({
  model: COLUMN_MODEL, modelRadius: COLUMN_ART_RADIUS, modelOffsetZ: f32(-RAZE_RADIUS), life,
  modelAnimation: { sequence: "birth", warningSeconds: from, activeSeconds: from, rate: COLUMN_RATE },
});

const base = { offsetX: 0.0, velocityX: 0.0, velocityZ: 0.0, radius: RAZE_RADIUS, reflectable: false, limit: 1 } as const;

export const CRATER_FRAMES = 180;
const CRATER_MODEL = "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx";

export const CRATER: SpecialProjectile = {
  ...base, model: CRATER_MODEL, modelRadius: COLUMN_ART_RADIUS, modelOffsetZ: f32(-2.0 * RAZE_RADIUS), life: CRATER_FRAMES,
  spawnFrame: 0, offsetZ: 0.0, activeFrom: CRATER_FRAMES + 1, effect: groundHit(0.0, 85, 0.0, 0.0, HitElement.fire),
};

const GLOW: SpecialProjectile = {
  ...base, ...column(RAZE_GLOW_FRAMES, f32(COLUMN_FROM + f32(COLUMN_RATE * f32(RAZE_ERUPT_FRAMES / 60)))),
  spawnFrame: 0, offsetZ: RAZE_RADIUS, activeFrom: RAZE_GLOW_FRAMES + 1, effect: groundHit(0.0, 85, 0.0, 0.0, HitElement.fire), expiresInto: CRATER,
};

const ERUPTION: SpecialProjectile = {
  ...base, ...column(RAZE_ERUPT_FRAMES, COLUMN_FROM),
  spawnFrame: 0, offsetZ: RAZE_RADIUS, effect: groundHit(RAZE_DAMAGE, RAZE_LAUNCH_ANGLE, 92.0, 30.0, HitElement.fire), launchesFromCentre: true, expiresInto: GLOW,
};

const TELL: SpecialProjectile = {
  ...base, model: TELL_MODEL, spawnFrame: RAZE_READ_FRAME, offsetZ: 0.0, life: RAZE_TELL_FRAMES, activeFrom: RAZE_TELL_FRAMES + 1,
  effect: groundHit(0.0, 85, 0.0, 0.0, HitElement.fire), aimedReach: RAZE_REACH, onlyOnFloor: { reach: RAZE_FLOOR_REACH }, dropsToFloor: true, expiresInto: ERUPTION,
};

export const QUARTER_CIRCLE_FORWARD: StickMotion = { window: RAZE_MOTION_WINDOW, steps: [{ x: 0, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 0 }] };
const DOWN_FORWARD: StickMotion = { window: 1, steps: [{ x: 1, z: -1 }] };

const AIM: AimByMotion = {
  motions: [{ motion: QUARTER_CIRCLE_FORWARD, aimX: 1, aimZ: 0 }, { motion: DOWN_FORWARD, aimX: 1, aimZ: -1 }],
  otherwise: { aimX: 0, aimZ: -1 },
};

const raze = (air: boolean): AuthoredSpecial => ({
  name: "Lava Raze", endFrame: RAZE_END_FRAME, landingLag: air ? RAZE_AIR_LANDING_LAG : undefined,
  aimByMotion: AIM, hurt: standinCastBody(Character.firelord, 8, RAZE_READ_FRAME + RAZE_TELL_FRAMES),
  projectiles: [TELL],
});

export const LAVA_RAZE: SpecialKit = {
  name: "Lava Raze", selectedByMotion: QUARTER_CIRCLE_FORWARD,
  description: "A glowing crack opens in the ground and erupts in lava. Down, or no direction, opens it one step ahead; down and forward, two; a quarter-circle from down through down and forward to forward, three. In the air it erupts on the ground below. The eruption throws foes away from its centre.",
  ground: raze(false), air: raze(true),
};

export const SUBMERGE_SINK_FRAMES = 6;
export const SUBMERGE_SURFACE_FRAME = 12;
export const SUBMERGE_INTANGIBLE = frames(SUBMERGE_SINK_FRAMES + 1, 17);
export const SUBMERGE_END_FRAME = 34;
export const SUBMERGE_COOLDOWN = 120;
export const SUBMERGE_FALLBACK_REACH = h(f32(0.9));

const DUST_MODEL = "Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx";

const dust = (spawnFrame: number): SpecialProjectile => ({
  ...base, model: DUST_MODEL, spawnFrame, offsetZ: 0.0, life: 20, activeFrom: 21, effect: groundHit(0.0, 85, 0.0, 0.0, HitElement.fire),
});

export const SUBMERGE: SpecialKit = {
  name: "Submerge",
  description: "He sinks into the ground and resurfaces at the newest crater his Lava Raze left in the last three seconds, or a short step ahead if there is none. Underground he cannot be hit, and he comes up with a small pop-up hit.",
  ground: {
    name: "Submerge", endFrame: SUBMERGE_END_FRAME, groundOnly: true, cooldownFrames: SUBMERGE_COOLDOWN, defensiveUse: true,
    intangible: SUBMERGE_INTANGIBLE, hurt: standinCastBody(Character.firelord, 0, SUBMERGE_SINK_FRAMES - 1),
    motion: [
      { ...frames(0, SUBMERGE_SURFACE_FRAME - 1), velocityX: 0.0, velocityZ: 0.0 },
      { ...frames(SUBMERGE_SURFACE_FRAME, SUBMERGE_INTANGIBLE.last), velocityX: 0.0, velocityZ: 0.0, resurface: { at: CRATER, fallbackReach: SUBMERGE_FALLBACK_REACH } },
    ],
    projectiles: [dust(SUBMERGE_SINK_FRAMES - 1), dust(SUBMERGE_SURFACE_FRAME + 1)],
    regions: [heroRegion(SUBMERGE_SURFACE_FRAME + 1, SUBMERGE_SURFACE_FRAME + 4, strike(-10.0, 30.0, 50.0, 60.0, 34.0), standinHit(5.0, 80, 60.0, 18.0))],
  },
};
