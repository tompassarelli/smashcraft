import { FOLLOW_UP_FORM, FollowUpInput, type AuthoredSpecial, type FighterSpecials, type SpecialMotion, type SpecialProjectile, specialForm, specialKit } from "../src/game/sim/heroSpecials";
import type { AuthoredMove, FighterMoves, MoveRegion } from "../src/game/sim/heroMoves";
import type { HitEffect } from "../src/game/sim/hitRegions";
import type { HurtPart, HurtPose } from "../src/game/sim/hurtboxes";
import {
  EFFECT_STRIDE, FOLLOW_STRIDE, FollowFlag, HIT_STRIDE, HitFlag, EffectFlag, MOTION_STRIDE, MOVE_STRIDE, MotionFlag, MoveFlag,
  MoveField, NORMAL_COUNT, type MoveTableRowKey, type MoveTableRows, PART_STRIDE, POSE_STRIDE, RecallWhile, SHOT_STRIDE, SLOT_STRIDE, SPECIAL_SLOTS, THROW_BASE, THROW_COUNT, shotOrder, specialOrder,
} from "../src/game/sim/moveTable";

// Builds a fighter's move table from its authored kit (docs/design/move-tables.md). It refuses any authored
// field the interpreter does not run yet, so a kit converts only when the table carries all of it.

const refuse = (what: string): never => { throw new Error(`move table: ${what} is not in the table format yet`); };

const binary32 = (value: number, what: string): number => {
  if (Math.fround(value) !== value) throw new Error(`move table: ${what} ${value} is not a binary32 value`);
  return value;
};

const absent = (value: unknown, what: string): void => { if (value !== undefined) refuse(what); };

export function encodeMoveTable(moves: Readonly<FighterMoves>, specials: Readonly<FighterSpecials>): MoveTableRows {
  const rows: { [key in MoveTableRowKey]: number[] } = { moves: [], hits: [], effects: [], motion: [], shots: [], moveShots: [], follow: [], poses: [], parts: [], slots: [], specials: [] };
  const models: string[] = [];
  const effectIds = new Map<Readonly<HitEffect>, number>();
  const shotIds = new Map<Readonly<SpecialProjectile>, number>();

  const effect = (hit: Readonly<HitEffect>): number => {
    const known = effectIds.get(hit);
    if (known !== undefined) return known;
    absent(hit.manaDrain, "manaDrain");
    absent(hit.manaSteal, "manaSteal");
    absent(hit.carry, "carry");
    const id = rows.effects.length / EFFECT_STRIDE;
    rows.effects.push(binary32(hit.damage, "damage"), binary32(hit.growth, "growth"), binary32(hit.base, "base"),
      binary32(hit.launchX, "launchX"), binary32(hit.launchZ, "launchZ"), hit.element ?? -1,
      hit.strong === undefined ? -1 : hit.strong ? 1 : 0, hit.electric ? EffectFlag.electric : 0);
    effectIds.set(hit, id);
    return id;
  };

  const hitRows = (regions: readonly MoveRegion[]): [number, number] => {
    const first = rows.hits.length / HIT_STRIDE;
    for (const region of regions) {
      const { strike, minX, maxX, minZ, maxZ, groundedEffect, window } = region.hit;
      rows.hits.push(region.firstFrame, region.lastFrame,
        binary32(strike?.x1 ?? 0.0, "x1"), binary32(strike?.z1 ?? 0.0, "z1"), binary32(strike?.x2 ?? 0.0, "x2"),
        binary32(strike?.z2 ?? 0.0, "z2"), binary32(strike?.radius ?? 0.0, "radius"),
        binary32(minX, "minX"), binary32(maxX, "maxX"), binary32(minZ, "minZ"), binary32(maxZ, "maxZ"),
        effect(region.hit.effect), groundedEffect === undefined ? -1 : effect(groundedEffect), window, strike === undefined ? 0 : HitFlag.strike);
    }
    return [first, regions.length];
  };

  const part = (each: Readonly<HurtPart>): void => {
    rows.parts.push(binary32(each.x1, "x1"), binary32(each.z1, "z1"), binary32(each.x2, "x2"), binary32(each.z2, "z2"),
      binary32(each.radius, "radius"), each.state ?? -1);
  };
  const pose = (first: number, last: number, parts: readonly HurtPart[]): void => {
    rows.poses.push(first, last, rows.parts.length / PART_STRIDE, parts.length);
    for (const each of parts) part(each);
  };
  const poseRows = (poses: readonly HurtPose[] | undefined): [number, number] => {
    const first = rows.poses.length / POSE_STRIDE;
    for (const each of poses ?? []) pose(each.firstFrame, each.lastFrame, each.parts);
    return [first, poses?.length ?? 0];
  };

  const motionRows = (segments: readonly SpecialMotion[] | undefined): [number, number] => {
    const first = rows.motion.length / MOTION_STRIDE;
    for (const segment of segments ?? []) {
      absent(segment.aimedTilt, "aimedTilt");
      absent(segment.driftSpeed, "driftSpeed");
      absent(segment.liftSpeed, "liftSpeed");
      absent(segment.relocate, "relocate");
      absent(segment.relocateReach, "relocateReach");
      absent(segment.throughEdge, "throughEdge");
      const flags = (segment.stopsAtBody === true ? MotionFlag.stopsAtBody : 0) | (segment.stopsAtShield === true ? MotionFlag.stopsAtShield : 0)
        | (segment.aimedSpeed === undefined ? 0 : MotionFlag.aimed);
      rows.motion.push(segment.first, segment.last, binary32(segment.velocityX, "velocityX"), binary32(segment.velocityZ, "velocityZ"),
        binary32(segment.aimedSpeed ?? 0.0, "aimedSpeed"), flags);
    }
    return [first, segments?.length ?? 0];
  };

  const shot = (spec: Readonly<SpecialProjectile>): number => {
    const known = shotIds.get(spec);
    if (known !== undefined) return known;
    if (shotOrder(specials)[rows.shots.length / SHOT_STRIDE] !== spec) refuse("a projectile out of shot order");
    for (const name of ["upVelocityX", "upVelocityZ", "gravity", "status", "cancelOnInterrupt", "returnEffect", "catchHeal", "needsLineOfSight",
      "modelRadius", "modelAnimation", "pool", "atFoe", "expiresInto", "homing", "burstInto"] as const) absent(spec[name], name);
    let model = -1;
    if (spec.model !== undefined) {
      model = models.indexOf(spec.model);
      if (model < 0) model = models.push(spec.model) - 1;
    }
    const id = rows.shots.length / SHOT_STRIDE;
    rows.shots.push(spec.spawnFrame, binary32(spec.offsetX, "offsetX"), binary32(spec.offsetZ, "offsetZ"), binary32(spec.velocityX, "velocityX"),
      binary32(spec.velocityZ, "velocityZ"), spec.life, binary32(spec.radius, "radius"), spec.activeFrom ?? -1, effect(spec.effect),
      spec.reflectable ? spec.limit + 1 : -(spec.limit + 1), spec.returns?.age ?? -1, binary32(spec.returns?.speed ?? 0.0, "returnSpeed"), model);
    shotIds.set(spec, id);
    return id;
  };

  const row = (): number[] => new Array<number>(MOVE_STRIDE).fill(-1);
  const put = (values: number[]): void => { rows.moves.push(...values); };
  const slice = (values: number[], at: number, [first, count]: [number, number]): void => {
    values[at] = first;
    values[at + 1] = count;
  };
  const empty = (values: number[]): number[] => {
    for (const at of [MoveField.hitFirst, MoveField.motionFirst, MoveField.shotFirst, MoveField.followFirst, MoveField.hurtFirst]) {
      values[at] = 0;
      values[at + 1] = 0;
    }
    values[MoveField.flags] = 0;
    return values;
  };

  const hurtboxes = moves.hurtboxes ?? refuse("a kit without authored hurtboxes");
  for (let style = 0; style < NORMAL_COUNT; style++) {
    const move: AuthoredMove | undefined = moves.normals[style];
    const values = empty(row());
    slice(values, MoveField.hurtFirst, poseRows(hurtboxes.attacks[style]));
    if (move !== undefined) {
      absent(move.fall, "fall");
      absent(move.landingHit, "landingHit");
      values[MoveField.total] = move.totalFrames;
      values[MoveField.startup] = move.startupFrames;
      values[MoveField.active] = move.activeFrames;
      values[MoveField.landingLag] = move.landingLag;
      values[MoveField.chainsFrom] = move.chainsFrom ?? -1;
      values[MoveField.flags] = (move.startupStopsAtBody === true ? MoveFlag.startupStopsAtBody : 0) | (move.startupTravelX === undefined ? 0 : MoveFlag.startupTravel);
      values[MoveField.startupTravelX] = binary32(move.startupTravelX ?? 0.0, "startupTravelX");
      slice(values, MoveField.hitFirst, hitRows(move.regions));
    }
    put(values);
  }
  for (let action = 0; action < THROW_COUNT; action++) {
    const authored = moves.throws[action];
    const values = empty(row());
    if (authored !== undefined) {
      values[MoveField.total] = authored.totalFrames;
      values[MoveField.contactFrame] = authored.contactFrame;
      values[MoveField.throwEffect] = effect(authored.effect);
    }
    put(values);
  }

  // Special ids follow the throws, in the order the kit reaches them.
  const order = specialOrder(specials);
  const ids = new Map<Readonly<AuthoredSpecial>, number>(order.map((move, index) => [move, THROW_BASE + THROW_COUNT + index]));
  const kits = [0, 1, 2, 3].map(slot => specialKit(specials, slot));
  for (const kit of kits) absent(kit.marked, "marked");
  let followUps = 0;
  for (const move of order) followUps = Math.max(followUps, move.followUps?.length ?? 0);
  const formCount = FOLLOW_UP_FORM * (followUps + 1);
  const idOf = (move: Readonly<AuthoredSpecial>): number => ids.get(move) ?? refuse("a special the kit does not reach");

  for (const move of order) {
    for (const name of ["intangible", "armor", "guard", "placement", "command", "commandGrab", "burst", "ritual", "rehits", "buff",
      "cleanseFrame", "strikeStatus"] as const) absent(move[name], name);
    const values = empty(row());
    values[MoveField.total] = move.endFrame;
    values[MoveField.landingLag] = move.landingLag ?? -1;
    values[MoveField.flags] = (move.helpless === true ? MoveFlag.helpless : 0) | (move.oncePerAirtime === true ? MoveFlag.oncePerAirtime : 0)
      | (move.facesStick === true ? MoveFlag.facesStick : 0) | (move.recallsProjectiles === true ? MoveFlag.recallsProjectiles : 0)
      | (move.recall === true ? MoveFlag.recall : 0) | (move.groundOnly === true ? MoveFlag.groundOnly : 0);
    slice(values, MoveField.hitFirst, hitRows(move.regions ?? []));
    slice(values, MoveField.motionFirst, motionRows(move.motion));
    const shots = move.projectiles ?? [];
    values[MoveField.shotFirst] = rows.moveShots.length;
    values[MoveField.shotCount] = shots.length;
    for (const spec of shots) rows.moveShots.push(shot(spec));
    values[MoveField.followFirst] = rows.follow.length / FOLLOW_STRIDE;
    values[MoveField.followCount] = move.followUps?.length ?? 0;
    for (const followUp of move.followUps ?? []) {
      rows.follow.push(followUp.window.first, followUp.window.last, followUp.input ?? FollowUpInput.special, idOf(followUp.special),
        followUp.facesStick === true ? FollowFlag.facesStick : 0);
    }
    slice(values, MoveField.hurtFirst, poseRows(move.hurt));
    values[MoveField.aimFrames] = move.aimFrames ?? -1;
    values[MoveField.ex] = move.ex === undefined ? -1 : idOf(move.ex);
    values[MoveField.cooldown] = move.cooldownFrames ?? 0;
    put(values);
  }

  for (const kit of kits) {
    rows.slots.push(kit.air === undefined ? -1 : idOf(kit.air), kit.recall === undefined ? -1 : idOf(kit.recall),
      kit.recallWhile === "projectile" ? RecallWhile.projectile : kit.recallWhile === "armor" ? RecallWhile.armor : RecallWhile.none,
      kit.recallGroundOnly === true ? 1 : 0);
  }
  if (rows.slots.length !== SPECIAL_SLOTS * SLOT_STRIDE) refuse("a kit without four slots");
  for (const kit of kits) {
    for (let form = 0; form < formCount; form++) {
      rows.specials.push(idOf(specialForm(kit, form, false)), idOf(specialForm(kit, form, true)));
    }
  }

  const standPose = rows.poses.length / POSE_STRIDE;
  pose(-1, -1, hurtboxes.stand);
  let crouchPose = -1;
  if (hurtboxes.crouch !== undefined) {
    crouchPose = rows.poses.length / POSE_STRIDE;
    pose(-1, -1, hurtboxes.crouch);
  }
  return { ...rows, formCount, standPose, crouchPose, models };
}

const list = (values: readonly number[], stride: number): string => {
  const lines: string[] = [];
  for (let at = 0; at < values.length; at += stride) lines.push(`    ${values.slice(at, at + stride).join(", ")},`);
  return lines.join("\n");
};

// The checked-in module for one fighter: literals only, so loading it runs no move code.
export function moveTableModule(name: string, rows: Readonly<MoveTableRows>): string {
  const array = (key: MoveTableRowKey, stride: number) => `  ${key}: [\n${list(rows[key], stride)}\n  ],`;
  return [
    "// Generated by scripts/moveTables.ts from the authored kit; edit the kit and rerun it.",
    "import type { MoveTableRows } from \"../moveTable\";",
    "",
    `export const ${name}: MoveTableRows = {`,
    array("moves", MOVE_STRIDE),
    array("hits", HIT_STRIDE),
    array("effects", EFFECT_STRIDE),
    array("motion", MOTION_STRIDE),
    array("shots", SHOT_STRIDE),
    array("moveShots", 16),
    array("follow", FOLLOW_STRIDE),
    array("poses", POSE_STRIDE),
    array("parts", PART_STRIDE),
    array("slots", SLOT_STRIDE),
    array("specials", 12),
    `  formCount: ${rows.formCount},`,
    `  standPose: ${rows.standPose},`,
    `  crouchPose: ${rows.crouchPose},`,
    `  models: [${rows.models.map(model => JSON.stringify(model)).join(", ")}],`,
    "};",
    "",
  ].join("\n");
}
