import { at } from "wisp/src/runtime/lookup";
import { HitElement } from "./codes";
import type { HitEffect, HitRegion } from "./hitRegions";
import type { HurtPart, HurtState } from "./hurtboxes";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, specialKit } from "./heroSpecials";

// A fighter's moves as flat binary32 rows read by one interpreter (docs/design/move-tables.md).
// Rows refer to other rows by index; an absent value is -1 or a clear flag bit, never a missing field.

export const MOVE_STRIDE = 22;
export const MoveField = {
  total: 0, startup: 1, active: 2, landingLag: 3, chainsFrom: 4, flags: 5, startupTravelX: 6,
  hitFirst: 7, hitCount: 8, motionFirst: 9, motionCount: 10, shotFirst: 11, shotCount: 12,
  followFirst: 13, followCount: 14, hurtFirst: 15, hurtCount: 16, aimFrames: 17, ex: 18,
  contactFrame: 19, throwEffect: 20, cooldown: 21,
} as const;
export const MoveFlag = {
  helpless: 1, oncePerAirtime: 2, facesStick: 4, recallsProjectiles: 8, startupStopsAtBody: 16,
  startupTravel: 32, recall: 64, groundOnly: 128,
} as const;

export const HIT_STRIDE = 15;
export const HitField = {
  first: 0, last: 1, x1: 2, z1: 3, x2: 4, z2: 5, radius: 6, minX: 7, maxX: 8, minZ: 9, maxZ: 10,
  effect: 11, grounded: 12, window: 13, flags: 14,
} as const;
export const HitFlag = { strike: 1 } as const;

export const EFFECT_STRIDE = 8;
export const EffectField = { damage: 0, growth: 1, base: 2, launchX: 3, launchZ: 4, element: 5, strong: 6, flags: 7 } as const;
export const EffectFlag = { electric: 1 } as const;

export const MOTION_STRIDE = 6;
export const MotionField = { first: 0, last: 1, velocityX: 2, velocityZ: 3, aimedSpeed: 4, flags: 5 } as const;
export const MotionFlag = { stopsAtBody: 1, stopsAtShield: 2, aimed: 4 } as const;

// A shot's limit stores limit + 1 when it is reflectable and -(limit + 1) when it is not.
export const SHOT_STRIDE = 13;
export const ShotField = {
  spawnFrame: 0, offsetX: 1, offsetZ: 2, velocityX: 3, velocityZ: 4, life: 5, radius: 6, activeFrom: 7,
  effect: 8, limit: 9, returnAge: 10, returnSpeed: 11, model: 12,
} as const;

export const FOLLOW_STRIDE = 5;
export const FollowField = { first: 0, last: 1, input: 2, target: 3, flags: 4 } as const;
export const FollowFlag = { facesStick: 1 } as const;

export const POSE_STRIDE = 4;
export const PoseField = { first: 0, last: 1, partFirst: 2, partCount: 3 } as const;
export const PART_STRIDE = 6;
export const PartField = { x1: 0, z1: 1, x2: 2, z2: 3, radius: 4, state: 5 } as const;

export const SLOT_STRIDE = 4;
export const SlotField = { air: 0, recall: 1, recallWhile: 2, recallGroundOnly: 3 } as const;
export const RecallWhile = { none: 0, projectile: 1, armor: 2 } as const;

// Move ids: AttackStyle for normals, then GrabAction for throws, then specials in the order the kit reaches them.
export const NORMAL_COUNT = 22;
export const THROW_BASE = NORMAL_COUNT;
export const THROW_COUNT = 8;
export const SPECIAL_SLOTS = 4;

export type MoveTableRowKey = "moves" | "hits" | "effects" | "motion" | "shots" | "moveShots" | "follow" | "poses" | "parts" | "slots" | "specials";

export interface MoveTableRows {
  readonly moves: readonly number[];
  readonly hits: readonly number[];
  readonly effects: readonly number[];
  readonly motion: readonly number[];
  readonly shots: readonly number[];
  readonly moveShots: readonly number[];
  readonly follow: readonly number[];
  readonly poses: readonly number[];
  readonly parts: readonly number[];
  readonly slots: readonly number[];
  // The special move id of (slot * formCount + form) * 2 + (ex ? 1 : 0).
  readonly specials: readonly number[];
  readonly formCount: number;
  readonly standPose: number;
  readonly crouchPose: number;
  readonly models: readonly string[];
}

// The rows plus read-only views built once at load, for the contact code that takes regions and parts by reference.
// Projectile specs stay the kit's own objects: a projectile in flight holds its spec, and snapshots rebind it by identity.
export interface MoveTable extends MoveTableRows {
  readonly regions: readonly Readonly<HitRegion>[];
  readonly hitEffects: readonly Readonly<HitEffect>[];
  readonly poseParts: readonly (readonly HurtPart[])[];
  readonly shotSpecs: readonly Readonly<SpecialProjectile>[];
}

export const moveField = (table: Readonly<MoveTableRows>, id: number, field: number): number => at(table.moves, id * MOVE_STRIDE + field);
export const hasMoveFlag = (table: Readonly<MoveTableRows>, id: number, flag: number): boolean => (moveField(table, id, MoveField.flags) & flag) !== 0;
export const hitField = (table: Readonly<MoveTableRows>, row: number, field: number): number => at(table.hits, row * HIT_STRIDE + field);
export const effectField = (table: Readonly<MoveTableRows>, row: number, field: number): number => at(table.effects, row * EFFECT_STRIDE + field);
export const motionField = (table: Readonly<MoveTableRows>, row: number, field: number): number => at(table.motion, row * MOTION_STRIDE + field);
export const shotField = (table: Readonly<MoveTableRows>, row: number, field: number): number => at(table.shots, row * SHOT_STRIDE + field);
export const followField = (table: Readonly<MoveTableRows>, row: number, field: number): number => at(table.follow, row * FOLLOW_STRIDE + field);
export const poseField = (table: Readonly<MoveTableRows>, row: number, field: number): number => at(table.poses, row * POSE_STRIDE + field);
export const partField = (table: Readonly<MoveTableRows>, row: number, field: number): number => at(table.parts, row * PART_STRIDE + field);
export const slotField = (table: Readonly<MoveTableRows>, slot: number, field: number): number => at(table.slots, slot * SLOT_STRIDE + field);
export const moveShot = (table: Readonly<MoveTableRows>, id: number, index: number): number => at(table.moveShots, moveField(table, id, MoveField.shotFirst) + index);
export const shotLimit = (table: Readonly<MoveTableRows>, row: number): number => Math.abs(shotField(table, row, ShotField.limit)) - 1;

// A normal the kit lacks stores total -1.
export const hasNormal = (table: Readonly<MoveTableRows>, style: number): boolean => style >= 0 && style < NORMAL_COUNT && moveField(table, style, MoveField.total) >= 0;

export function throwMove(table: Readonly<MoveTableRows>, action: number): number {
  const id = THROW_BASE + action;
  return action >= 0 && action < THROW_COUNT && moveField(table, id, MoveField.total) >= 0 ? id : -1;
}

export function specialMove(table: Readonly<MoveTableRows>, slot: number, form: number, ex: boolean): number {
  if (form < 0 || form >= table.formCount) throw new Error(`special form ${form} outside the move table`);
  return at(table.specials, (slot * table.formCount + form) * 2 + (ex ? 1 : 0));
}

// The index-th hit row of a move when the frame lies in its window, else -1.
export function activeHitRow(table: Readonly<MoveTableRows>, id: number, frame: number, index: number): number {
  if (index < 0 || index >= moveField(table, id, MoveField.hitCount)) return -1;
  const row = moveField(table, id, MoveField.hitFirst) + index;
  return frame >= hitField(table, row, HitField.first) && frame <= hitField(table, row, HitField.last) ? row : -1;
}

const startupTravel = { startupTravelX: 0.0, startupFrames: 0, startupStopsAtBody: false };

// A normal's startup travel in a reused record, or undefined when it has none.
export function startupTravelOf(table: Readonly<MoveTableRows>, style: number): Readonly<typeof startupTravel> | undefined {
  if (!hasNormal(table, style) || !hasMoveFlag(table, style, MoveFlag.startupTravel)) return undefined;
  startupTravel.startupTravelX = moveField(table, style, MoveField.startupTravelX);
  startupTravel.startupFrames = moveField(table, style, MoveField.startup);
  startupTravel.startupStopsAtBody = hasMoveFlag(table, style, MoveFlag.startupStopsAtBody);
  return startupTravel;
}

// The first hurt pose row of a move covering the frame, else -1.
export function activePose(table: Readonly<MoveTableRows>, id: number, frame: number): number {
  const first = moveField(table, id, MoveField.hurtFirst);
  const last = first + moveField(table, id, MoveField.hurtCount);
  for (let row = first; row < last; row++) {
    if (frame >= poseField(table, row, PoseField.first) && frame <= poseField(table, row, PoseField.last)) return row;
  }
  return -1;
}

// The first motion row of a move covering the frame whose flags include any of `flags` (0: any row), else -1.
export function activeMotion(table: Readonly<MoveTableRows>, id: number, frame: number, flags: number): number {
  const first = moveField(table, id, MoveField.motionFirst);
  const last = first + moveField(table, id, MoveField.motionCount);
  for (let row = first; row < last; row++) {
    if (frame < motionField(table, row, MotionField.first) || frame > motionField(table, row, MotionField.last)) continue;
    if (flags === 0 || (motionField(table, row, MotionField.flags) & flags) !== 0) return row;
  }
  return -1;
}

const HIT_ELEMENTS: readonly HitElement[] = [HitElement.normal, HitElement.fire, HitElement.electric, HitElement.slash, HitElement.ice,
  HitElement.dark, HitElement.holy, HitElement.poison, HitElement.arcane];
const HURT_STATES: readonly HurtState[] = [0, 1, 2];

function hitElement(code: number): HitElement | undefined {
  for (const element of HIT_ELEMENTS) if (element === code) return element;
  if (code >= 0) throw new Error(`move table: no hit element ${code}`);
  return undefined;
}

function hurtState(code: number): HurtState {
  for (const state of HURT_STATES) if (state === code) return state;
  throw new Error(`move table: no hurt state ${code}`);
}

function effectView(rows: Readonly<MoveTableRows>, row: number): HitEffect {
  const element = effectField(rows, row, EffectField.element);
  const strong = effectField(rows, row, EffectField.strong);
  return {
    damage: effectField(rows, row, EffectField.damage), growth: effectField(rows, row, EffectField.growth), base: effectField(rows, row, EffectField.base),
    launchX: effectField(rows, row, EffectField.launchX), launchZ: effectField(rows, row, EffectField.launchZ),
    electric: (effectField(rows, row, EffectField.flags) & EffectFlag.electric) !== 0,
    element: hitElement(element), strong: strong < 0 ? undefined : strong === 1,
  };
}

// Builds the views once at load; `shotSpecs` are the kit's projectile specs in shot-row order.
export function moveTable(rows: Readonly<MoveTableRows>, shotSpecs: readonly Readonly<SpecialProjectile>[]): MoveTable {
  const hitEffects: HitEffect[] = [];
  for (let row = 0; row < rows.effects.length / EFFECT_STRIDE; row++) hitEffects.push(effectView(rows, row));
  const regions: HitRegion[] = [];
  for (let row = 0; row < rows.hits.length / HIT_STRIDE; row++) {
    const grounded = hitField(rows, row, HitField.grounded);
    regions.push({
      strike: (hitField(rows, row, HitField.flags) & HitFlag.strike) === 0 ? undefined : {
        x1: hitField(rows, row, HitField.x1), z1: hitField(rows, row, HitField.z1), x2: hitField(rows, row, HitField.x2),
        z2: hitField(rows, row, HitField.z2), radius: hitField(rows, row, HitField.radius),
      },
      groundedEffect: grounded < 0 ? undefined : at(hitEffects, grounded),
      minX: hitField(rows, row, HitField.minX), maxX: hitField(rows, row, HitField.maxX),
      minZ: hitField(rows, row, HitField.minZ), maxZ: hitField(rows, row, HitField.maxZ),
      effect: at(hitEffects, hitField(rows, row, HitField.effect)), window: hitField(rows, row, HitField.window),
    });
  }
  const poseParts: HurtPart[][] = [];
  for (let row = 0; row < rows.poses.length / POSE_STRIDE; row++) {
    const parts: HurtPart[] = [];
    const first = poseField(rows, row, PoseField.partFirst);
    for (let part = first; part < first + poseField(rows, row, PoseField.partCount); part++) {
      const state = partField(rows, part, PartField.state);
      const x1 = partField(rows, part, PartField.x1), z1 = partField(rows, part, PartField.z1);
      const x2 = partField(rows, part, PartField.x2), z2 = partField(rows, part, PartField.z2), radius = partField(rows, part, PartField.radius);
      parts.push(state < 0 ? { x1, z1, x2, z2, radius } : { x1, z1, x2, z2, radius, state: hurtState(state) });
    }
    poseParts.push(parts);
  }
  if (shotSpecs.length !== rows.shots.length / SHOT_STRIDE) throw new Error("move table: one projectile spec per shot row");
  return { ...rows, regions, hitEffects, poseParts, shotSpecs };
}

// The kit's specials in id order: each slot's ground, air and recall forms, each followed by its EX form and follow-ups.
export function specialOrder(specials: Readonly<FighterSpecials>): Readonly<AuthoredSpecial>[] {
  const order: Readonly<AuthoredSpecial>[] = [];
  const reach = (move: Readonly<AuthoredSpecial> | undefined): void => {
    if (move === undefined || order.includes(move)) return;
    order.push(move);
    reach(move.ex);
    for (const followUp of move.followUps ?? []) reach(followUp.special);
  };
  for (let slot = 0; slot < SPECIAL_SLOTS; slot++) {
    const kit = specialKit(specials, slot);
    reach(kit.ground);
    reach(kit.air);
    reach(kit.recall);
  }
  return order;
}

// The kit's projectile specs in shot-row order.
export function shotOrder(specials: Readonly<FighterSpecials>): Readonly<SpecialProjectile>[] {
  const order: Readonly<SpecialProjectile>[] = [];
  for (const move of specialOrder(specials)) for (const spec of move.projectiles ?? []) if (!order.includes(spec)) order.push(spec);
  return order;
}
