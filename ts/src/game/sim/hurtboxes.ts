// Hurt volumes that follow each fighter's animation. A fighter's body is a few
// authored capsules chosen from its state and attack frame; the drawn model
// never decides contact. smashcraft:docs/hurtboxes.md describes the authoring.
import { at } from "wisp/src/runtime/lookup";
import { type Capsule, capsulesIntersect, emptyCapsule, hurtCapsule, placeCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character } from "./codes";
import { fighterPoseFacing } from "./conditions";
import type { Fighter } from "./fighter";

/** How a body part takes a strike: a hit, a strike spent without effect, or nothing at all. */
export const HurtState = { normal: 0, invincible: 1, intangible: 2 } as const;
export type HurtState = (typeof HurtState)[keyof typeof HurtState];

/** A facing-relative body capsule: the origin is the fighter's feet and positive x is in front. */
export interface HurtPart {
  readonly x1: number;
  readonly z1: number;
  readonly x2: number;
  readonly z2: number;
  readonly radius: number;
  /** Normal when absent. */
  readonly state?: HurtState | undefined;
}

/** The body over zero-based attack frames firstFrame..lastFrame, inclusive. */
export interface HurtPose {
  readonly firstFrame: number;
  readonly lastFrame: number;
  readonly parts: readonly HurtPart[];
}

/**
 * A fighter's authored body. An attack frame no pose covers, and every state
 * without its own body, uses the standing body.
 */
export interface FighterHurtboxes {
  readonly stand: readonly HurtPart[];
  /** Grounded and crouching, outside attacks. */
  readonly crouch?: readonly HurtPart[] | undefined;
  readonly attacks: { readonly [style: number]: readonly HurtPose[] | undefined };
}

/** What a strike touched: no part, a normal part, or only invincible parts. */
export const HurtContact = { none: 0, hit: 1, invincible: 2 } as const;
export type HurtContact = (typeof HurtContact)[keyof typeof HurtContact];

export function hurtPart(x1: number, z1: number, x2: number, z2: number, radius: number, state?: HurtState): HurtPart {
  return state === undefined ? { x1, z1, x2, z2, radius } : { x1, z1, x2, z2, radius, state };
}

/** A pose over zero-based attack frames, as the simulation counts them. */
export function hurtPose(firstFrame: number, lastFrame: number, parts: readonly HurtPart[]): HurtPose {
  return { firstFrame, lastFrame, parts };
}

const standingBody = (character: Character): readonly HurtPart[] => [hurtCapsule(character)];

// Provisional authored volumes for the shipped fighters, fitted to their drawn
// poses with `bun wisp view hurtboxes`. Weapons stay outside the body: only
// limbs and torso extend.
const CHARACTER_HURTBOXES: readonly FighterHurtboxes[] = [
  { stand: standingBody(Character.archer), attacks: {} },
  { stand: standingBody(Character.rifleman), attacks: {} },
  { stand: standingBody(Character.demonHunter), attacks: {} },
];

/** The authored body set a fighter uses: its hero kit's, or its character's. */
export function fighterHurtboxes(f: Readonly<Fighter>): Readonly<FighterHurtboxes> {
  const moves = f.tuning.moves;
  if (moves !== undefined) return moves.hurtboxes ?? defaultHurtboxes(f.character);
  return CHARACTER_HURTBOXES[f.character] ?? at(CHARACTER_HURTBOXES, CHARACTER_HURTBOXES.length - 1);
}

const DEFAULTS: FighterHurtboxes[] = [];

/** A kit without authored hurt volumes keeps its character's standing body in every state. */
function defaultHurtboxes(character: Character): Readonly<FighterHurtboxes> {
  let set = DEFAULTS[character];
  if (set === undefined) {
    set = { stand: standingBody(character), attacks: {} };
    DEFAULTS[character] = set;
  }
  return set;
}

/** The fighter's facing-relative body parts on its current frame. */
export function fighterHurtParts(f: Readonly<Fighter>): readonly HurtPart[] {
  const set = fighterHurtboxes(f);
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

// Preallocated: hit selection places every target part for every strike, replays included.
const placed = emptyCapsule();

/**
 * Whether a placed strike capsule touches the target's body: a normal part
 * hits, invincible parts alone spend the strike, intangible parts pass it.
 */
export function strikeHurtContact(strike: Readonly<Capsule>, target: Readonly<Fighter>): HurtContact {
  const parts = fighterHurtParts(target);
  const facing = fighterPoseFacing(target);
  let contact: HurtContact = HurtContact.none;
  for (const part of parts) {
    const state = part.state ?? HurtState.normal;
    if (state === HurtState.intangible || (state === HurtState.invincible && contact !== HurtContact.none)) continue;
    placeCapsule(placed, part, target.motion.x, target.motion.z, facing);
    if (!capsulesIntersect(strike, placed)) continue;
    if (state === HurtState.normal) return HurtContact.hit;
    contact = HurtContact.invincible;
  }
  return contact;
}

/** Grabs take any part a strike could touch, invincible ones included. */
export function grabTouchesBody(strike: Readonly<Capsule>, target: Readonly<Fighter>): boolean {
  return strikeHurtContact(strike, target) !== HurtContact.none;
}

/** Styles the shipped fighters author poses for; tests and captures iterate them. */
export const AUTHORED_SAMPLE_STYLES: readonly AttackStyle[] = [
  AttackStyle.jab, AttackStyle.downTilt, AttackStyle.forwardSmash, AttackStyle.forwardAir, AttackStyle.downAir,
];
