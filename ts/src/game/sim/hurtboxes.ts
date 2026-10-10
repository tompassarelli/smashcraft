


import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { type Capsule, capsulesIntersect, emptyCapsule, hurtCapsule, placeCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { specialForm, specialKit } from "./heroSpecials";
import { fighterPoseFacing } from "./conditions";
import type { Fighter } from "./fighter";
import type { FighterMoves } from "./heroMoves";
import { attackStartupFrames, characterAttackActiveFrames } from "./moves";
import { type MoveTable, NORMAL_COUNT, activePose, specialMove } from "./moveTable";


export const HurtState = { normal: 0, invincible: 1, intangible: 2 } as const;
export type HurtState = (typeof HurtState)[keyof typeof HurtState];


export interface HurtPart {
  readonly x1: number;
  readonly z1: number;
  readonly x2: number;
  readonly z2: number;
  readonly radius: number;

  readonly state?: HurtState | undefined;
}


export interface HurtPose {
  readonly firstFrame: number;
  readonly lastFrame: number;
  readonly parts: readonly HurtPart[];
}





export interface FighterHurtboxes {
  readonly stand: readonly HurtPart[];

  readonly crouch?: readonly HurtPart[] | undefined;
  readonly attacks: { readonly [style: number]: readonly HurtPose[] | undefined };
}


export const HurtContact = { none: 0, hit: 1, invincible: 2 } as const;
export type HurtContact = (typeof HurtContact)[keyof typeof HurtContact];

export function hurtPart(x1: number, z1: number, x2: number, z2: number, radius: number, state?: HurtState): HurtPart {
  return state === undefined ? { x1, z1, x2, z2, radius } : { x1, z1, x2, z2, radius, state };
}


export function hurtPose(firstFrame: number, lastFrame: number, parts: readonly HurtPart[]): HurtPose {
  return { firstFrame, lastFrame, parts };
}

const standingBody = (character: Character): readonly HurtPart[] => [hurtCapsule(character)];








export function shippedHurtboxes(character: Character, moves?: FighterMoves): FighterHurtboxes {
  const body = hurtCapsule(character);
  const top = body.z2;
  const r = body.radius;
  const h = (fraction: number) => f32(top * fraction);
  const startup = (style: AttackStyle) => attackStartupFrames(style, moves);
  const lastActive = (style: AttackStyle) => startup(style) + characterAttackActiveFrames(character, style, moves) - 1;

  const reaching = (style: AttackStyle, parts: readonly HurtPart[], before: readonly HurtPart[] = []) => [
    ...(before.length > 0 ? [hurtPose(0, startup(style) - 3, before)] : []),
    hurtPose(startup(style) - 2, lastActive(style) + 3, parts),
  ];
  const torso = (lean: number, low = 4.0, high = top, radius = r) => hurtPart(0.0, low, lean, high, radius);
  return {
    stand: [body],
    attacks: {

      [AttackStyle.jab]: reaching(AttackStyle.jab, [torso(4.0), hurtPart(8.0, h(f32(0.68)), 40.0, h(f32(0.6)), 9.0)]),

      ...(moves?.normals[AttackStyle.jab2] === undefined && character !== Character.demonHunter ? {} : {
        [AttackStyle.jab2]: reaching(AttackStyle.jab2,  [torso(4.0), hurtPart(8.0, h(f32(0.68)), 42.0, h(f32(0.62)), 9.0)]),
      }),
      ...(moves?.normals[AttackStyle.jab3] === undefined && character !== Character.demonHunter ? {} : {
        [AttackStyle.jab3]: reaching(AttackStyle.jab3, [torso(6.0), hurtPart(8.0, h(f32(0.66)), 46.0, h(f32(0.6)), 9.0)]),
      }),

      [AttackStyle.downTilt]: reaching(AttackStyle.downTilt, [torso(8.0, 4.0, h(f32(0.62)), r), hurtPart(10.0, 10.0, 52.0, 6.0, 10.0)]),

      [AttackStyle.forwardSmash]: reaching(AttackStyle.forwardSmash,
        [torso(14.0), hurtPart(10.0, h(f32(0.62)), 48.0, h(f32(0.55)), 10.0)],
        [torso(-12.0)]),

      [AttackStyle.forwardAir]: reaching(AttackStyle.forwardAir, [torso(0.0, h(f32(0.22)), h(f32(0.9))), hurtPart(10.0, h(f32(0.42)), 46.0, h(f32(0.32)), 10.0)]),

      [AttackStyle.downAir]: reaching(AttackStyle.downAir, [torso(0.0, h(f32(0.35))), hurtPart(0.0, h(f32(0.35)), 4.0, -18.0, 12.0)]),
    },
  };
}

const FALLBACK_HURTBOXES = shippedHurtboxes(Character.demonHunter);
const CHARACTER_HURTBOXES: Readonly<Record<number, FighterHurtboxes>> = {
  1: shippedHurtboxes(Character.rifleman),
  2: FALLBACK_HURTBOXES,
};


export function fighterHurtboxes(f: Readonly<Fighter>): Readonly<FighterHurtboxes> {
  const moves = f.tuning.moves;
  if (moves !== undefined) return moves.hurtboxes ?? defaultHurtboxes(f.character);
  return CHARACTER_HURTBOXES[f.character] ?? FALLBACK_HURTBOXES;
}

const DEFAULTS: FighterHurtboxes[] = [];


function defaultHurtboxes(character: Character): Readonly<FighterHurtboxes> {
  let set = DEFAULTS[character];
  if (set === undefined) {
    set = { stand: standingBody(character), attacks: {} };
    DEFAULTS[character] = set;
  }
  return set;
}





function specialHurtParts(f: Readonly<Fighter>): readonly HurtPart[] | undefined {
  const specials = f.tuning.specials;
  const { action, frame, form } = f.special;
  if (specials === undefined || action < SpecialAction.heroNeutral || action > SpecialAction.heroDown) return undefined;
  const poses = specialForm(specialKit(specials, action - SpecialAction.heroNeutral), form).hurt;
  if (poses === undefined) return undefined;
  for (const pose of poses) if (frame >= pose.firstFrame && frame <= pose.lastFrame) return pose.parts;
  return undefined;
}


function tableHurtParts(f: Readonly<Fighter>, table: Readonly<MoveTable>): readonly HurtPart[] {
  const { action, frame, form } = f.special;
  if (f.tuning.specials?.table !== table) {
    const special = specialHurtParts(f);
    if (special !== undefined) return special;
  } else if (action >= SpecialAction.heroNeutral && action <= SpecialAction.heroDown) {
    const row = activePose(table, specialMove(table, action - SpecialAction.heroNeutral, form, false), frame);
    if (row >= 0) return at(table.poseParts, row);
  }
  const style = f.attack.style;
  if (style !== undefined) {
    const row = style < NORMAL_COUNT ? activePose(table, style, f.attack.frame) : -1;
    return at(table.poseParts, row >= 0 ? row : table.standPose);
  }
  if (table.crouchPose >= 0 && f.motion.crouching && f.motion.grounded) return at(table.poseParts, table.crouchPose);
  return at(table.poseParts, table.standPose);
}


export function fighterHurtParts(f: Readonly<Fighter>): readonly HurtPart[] {
  const table = f.tuning.moves?.table;
  if (table !== undefined) return tableHurtParts(f, table);
  const set = fighterHurtboxes(f);
  const special = specialHurtParts(f);
  if (special !== undefined) return special;
  const style = f.attack.style;
  if (style !== undefined) {
    const poses = set.attacks[style];
    if (poses !== undefined) {
      const frame = f.attack.frame;
      for (const pose of poses) {
        if (frame >= pose.firstFrame && frame <= pose.lastFrame) return pose.parts;
      }
    }
    return set.stand;
  }
  if (set.crouch !== undefined && f.motion.crouching && f.motion.grounded) return set.crouch;
  return set.stand;
}


const placed = emptyCapsule();





export function strikeHurtContact(strike: Readonly<Capsule>, target: Readonly<Fighter>, z = target.motion.z): HurtContact {
  const parts = fighterHurtParts(target);
  const facing = fighterPoseFacing(target);
  let contact: HurtContact = HurtContact.none;
  for (const part of parts) {
    const state = part.state ?? HurtState.normal;
    if (state === HurtState.intangible || (state === HurtState.invincible && contact !== HurtContact.none)) continue;
    placeCapsule(placed, part, target.motion.x, z, facing);
    if (!capsulesIntersect(strike, placed)) continue;
    if (state === HurtState.normal) return HurtContact.hit;
    contact = HurtContact.invincible;
  }
  return contact;
}


export function grabTouchesBody(strike: Readonly<Capsule>, target: Readonly<Fighter>, z = target.motion.z): boolean {
  return strikeHurtContact(strike, target, z) !== HurtContact.none;
}


export const AUTHORED_SAMPLE_STYLES: readonly AttackStyle[] = [
  AttackStyle.jab, AttackStyle.downTilt, AttackStyle.forwardSmash, AttackStyle.forwardAir, AttackStyle.downAir,
];
