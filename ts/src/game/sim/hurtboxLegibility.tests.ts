// The legible-hurtbox rules (smashcraft:docs/gameplay-design.md, "Legible
// hurtboxes", #97) checked on every fighter's authored bodies: the original
// three and each registered hero, normals and specials. A fighter that breaks
// a rule on purpose lists a named departure below and in that section.
import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { capsulesIntersect, placeCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character } from "./codes";
import { createFighter } from "./fighter";
import { HERO_ROSTER } from "./heroes/registry";
import type { FighterMoves } from "./heroMoves";
import { type AuthoredSpecial, specialKit } from "./heroSpecials";
import { type FighterHurtboxes, type HurtPart, type HurtPose, HurtContact, HurtState, fighterHurtParts, fighterHurtboxes, strikeHurtContact } from "./hurtboxes";
import { attackDurationFramesForGrounding } from "./moves";

/** Rule 3: frames every authored pose lasts at least. */
const MIN_POSE_FRAMES = 3;
/** Rule 4: world units one change may move the body's front, back, top or bottom. */
const MAX_BODY_STEP = 60.0;
/** Rule 6: a fully extended limb's reach, as fractions of the standing height: sideways from the feet, below the feet and above the head. */
const LIMB_REACH = f32(0.7);
const BELOW_FEET = 0.25;
const ABOVE_HEAD = f32(0.3);

/** Dreadlord's wings and claws are body (the roster keeps hurtboxes on attached body parts) and reach past an arm. */
const wings = (moves: readonly string[]): { [key: string]: string } => {
  const out: { [key: string]: string } = {};
  for (const move of moves) out[`Dreadlord ${move} rule 6`] = "wing or claw: attached body, hittable to its full reach";
  return out;
};

/**
 * Named departures, "fighter move rule N" to its reason; each must also be
 * named in gameplay-design.md. A listed departure that no longer occurs fails.
 */
const DEPARTURES: { readonly [key: string]: string | undefined } = {
  "Mountain King downAir rule 6": "Double Boot strikes with the boots themselves, so the leg volume follows the whole downward strike past a limb's reach",
  "Chen Stormstout downAir rule 6": "the downward boot is the strike, so the extended leg stays hittable to its full length",
  "Uther backAir rule 6": "a boot kick: the extended leg is the strike and stays hittable to its full length",
  "Pit Lord backAir rule 6": "Tail Lash strikes with the tail itself, which the roster makes body: it stays hittable to its full length",
  "Thrall forwardTiltDown rule 6": "the mounted wolf's paw is the strike and stays hittable to its measured 116-unit reach",
  "Thrall downTilt rule 6": "the mounted wolf's paw is the strike and stays hittable to its measured 116-unit reach",
  "Thrall downSmash rule 6": "the mounted wolf's paws are the strikes and stay hittable to their measured 116-unit reach",
  "Thrall downAir rule 6": "the mounted wolf's paw is the strike and stays hittable to its measured 116-unit reach",
  ...wings(["forwardTilt", "forwardTiltDown", "downSmash", "forwardSmash", "forwardAir", "backAir", "downAir"]),
};

/** One move's authored bodies, in its own frame numbering, with the frames it lasts. */
interface MoveBodies {
  readonly name: string;
  readonly poses: readonly HurtPose[];
  readonly firstFrame: number;
  readonly lastFrame: number;
}

interface FighterBodies {
  readonly name: string;
  readonly set: Readonly<FighterHurtboxes>;
  readonly moves: readonly MoveBodies[];
}

function attackBodies(set: Readonly<FighterHurtboxes>, moves: FighterMoves | undefined): MoveBodies[] {
  const out: MoveBodies[] = [];
  for (const key in AttackStyle) {
    const style = AttackStyle[key as keyof typeof AttackStyle];
    const poses = set.attacks[style];
    if (poses === undefined || poses.length === 0) continue;
    const total = Math.max(attackDurationFramesForGrounding(style, true, moves), attackDurationFramesForGrounding(style, false, moves));
    out.push({ name: key, poses, firstFrame: 0, lastFrame: total - 1 });
  }
  return out;
}

const SLOT_NAMES = ["neutral special", "side special", "up special", "down special"] as const;

function specialBodies(special: AuthoredSpecial | undefined, name: string, out: MoveBodies[]): void {
  if (special?.hurt === undefined || special.hurt.length === 0) return;
  out.push({ name, poses: special.hurt, firstFrame: 1, lastFrame: special.endFrame });
}

function everyFighter(): FighterBodies[] {
  const fighters: FighterBodies[] = [];
  const originals: readonly [Character, string][] = [[Character.archer, "Archer"], [Character.rifleman, "Rifleman"], [Character.demonHunter, "Illidan"]];
  for (const [character, name] of originals) {
    const set = fighterHurtboxes(createFighter(character, 0.0, 1));
    fighters.push({ name, set, moves: attackBodies(set, undefined) });
  }
  for (const hero of HERO_ROSTER) {
    const set = fighterHurtboxes(createFighter(hero.character, 0.0, 1));
    const moves = attackBodies(set, hero.moves);
    if (hero.specials !== undefined) {
      for (let slot = 0; slot < SLOT_NAMES.length; slot++) {
        const kit = specialKit(hero.specials, slot);
        specialBodies(kit.ground, SLOT_NAMES[slot] ?? "special", moves);
        if (kit.air !== undefined) specialBodies(kit.air, `${SLOT_NAMES[slot] ?? "special"} (air)`, moves);
        if (kit.free !== undefined) specialBodies(kit.free, `${SLOT_NAMES[slot] ?? "special"} (free)`, moves);
      }
    }
    fighters.push({ name: hero.name, set, moves });
  }
  return fighters;
}

interface Extent { front: number; back: number; top: number; bottom: number }

function extent(parts: readonly HurtPart[]): Extent {
  const e: Extent = { front: -1e9, back: 1e9, top: -1e9, bottom: 1e9 };
  for (const p of parts) {
    e.front = Math.max(e.front, Math.max(p.x1, p.x2) + p.radius);
    e.back = Math.min(e.back, Math.min(p.x1, p.x2) - p.radius);
    e.top = Math.max(e.top, Math.max(p.z1, p.z2) + p.radius);
    e.bottom = Math.min(e.bottom, Math.min(p.z1, p.z2) - p.radius);
  }
  return e;
}

function step(a: readonly HurtPart[], b: readonly HurtPart[]): number {
  const x = extent(a);
  const y = extent(b);
  return Math.max(Math.abs(x.front - y.front), Math.abs(x.back - y.back), Math.abs(x.top - y.top), Math.abs(x.bottom - y.bottom));
}

/** Rule 2: every part reaches the first through touching parts. */
function connected(parts: readonly HurtPart[]): boolean {
  const reached: boolean[] = [];
  for (let i = 0; i < parts.length; i++) reached.push(i === 0);
  let grew = true;
  while (grew) {
    grew = false;
    for (let i = 0; i < parts.length; i++) {
      if (reached[i] === true) continue;
      for (let j = 0; j < parts.length; j++) {
        const a = parts[i];
        const b = parts[j];
        if (reached[j] === true && a !== undefined && b !== undefined && capsulesIntersect(a, b)) {
          reached[i] = true;
          grew = true;
          break;
        }
      }
    }
  }
  for (const r of reached) if (!r) return false;
  return true;
}

/** Every rule a fighter's authored bodies break, as "fighter move rule N: detail". */
function violations(fighter: FighterBodies): string[] {
  const found: string[] = [];
  const add = (move: string, rule: number, detail: string): void => {
    found.push(`${fighter.name} ${move} rule ${rule}: ${detail}`);
  };
  const { stand, crouch } = fighter.set;
  const standing = extent(stand);
  const height = standing.top - standing.bottom;
  const beyondReach = (parts: readonly HurtPart[]): string | undefined => {
    const e = extent(parts);
    const side = Math.max(e.front, -e.back);
    if (side > LIMB_REACH * height) return `reaches ${side} sideways, past ${LIMB_REACH * height}`;
    if (e.bottom < standing.bottom - BELOW_FEET * height) return `reaches ${e.bottom} below, past ${standing.bottom - BELOW_FEET * height}`;
    if (e.top > standing.top + ABOVE_HEAD * height) return `reaches ${e.top} above, past ${standing.top + ABOVE_HEAD * height}`;
    return undefined;
  };
  if (!connected(stand)) add("stand", 2, "a part is not connected");
  if (crouch !== undefined) {
    if (!connected(crouch)) add("crouch", 2, "a part is not connected");
    const crouchStep = step(stand, crouch);
    if (crouchStep > MAX_BODY_STEP) add("crouch", 4, `step ${crouchStep}`);
  }
  for (const move of fighter.moves) {
    const sorted = [...move.poses].sort((a, b) => a.firstFrame - b.firstFrame);
    let body: readonly HurtPart[] = stand;
    let previousLast = move.firstFrame - 1;
    for (const pose of sorted) {
      const label = `frames ${pose.firstFrame}-${pose.lastFrame}`;
      if (!connected(pose.parts)) add(move.name, 2, `${label}: a part is not connected`);
      const reach = beyondReach(pose.parts);
      if (reach !== undefined) add(move.name, 6, `${label}: ${reach}`);
      if (pose.lastFrame - pose.firstFrame + 1 < MIN_POSE_FRAMES) add(move.name, 3, `${label}: shorter than ${MIN_POSE_FRAMES} frames`);
      if (pose.firstFrame <= previousLast) add(move.name, 3, `${label}: overlaps the previous pose`);
      if (pose.firstFrame < move.firstFrame || pose.lastFrame > move.lastFrame) add(move.name, 3, `${label}: outside the move's frames ${move.firstFrame}-${move.lastFrame}`);
      if (pose.firstFrame > previousLast + 1 && body !== stand) {
        const back = step(body, stand);
        if (back > MAX_BODY_STEP) add(move.name, 4, `gap before ${label}: step ${back}`);
        body = stand;
      }
      const into = step(body, pose.parts);
      if (into > MAX_BODY_STEP) add(move.name, 4, `${label}: step ${into}`);
      for (const part of pose.parts) {
        if ((part.state ?? HurtState.normal) !== HurtState.normal) add(move.name, 5, `${label}: an intangible or invincible part`);
      }
      body = pose.parts;
      previousLast = Math.max(previousLast, pose.lastFrame);
    }
    const out = step(body, stand);
    if (out > MAX_BODY_STEP) add(move.name, 4, `return to standing: step ${out}`);
  }
  return found;
}

test("every fighter's authored bodies follow the legible-hurtbox rules or name a departure", () => {
  const unexpected: string[] = [];
  const seen: { [key: string]: boolean } = {};
  for (const fighter of everyFighter()) {
    for (const violation of violations(fighter)) {
      const key = violation.substring(0, violation.indexOf(":"));
      seen[key] = true;
      if (DEPARTURES[key] === undefined) unexpected.push(violation);
    }
  }
  assertEquals(unexpected.join("\n"), "");
  const stale: string[] = [];
  for (const key in DEPARTURES) if (seen[key] !== true) stale.push(key);
  assertEquals(stale.join("\n"), "");
});

test("the original fighters' sampled moves are checked", () => {
  const archer = everyFighter()[0];
  assertEquals(archer?.name, "Archer");
  assertTrue((archer?.moves.length ?? 0) >= 5);
});

test("the checker catches each rule it enforces", () => {
  const torso: HurtPart = { x1: 0.0, z1: 4.0, x2: 0.0, z2: 88.0, radius: 24.0 };
  const pose = (first: number, last: number, parts: readonly HurtPart[]): HurtPose => ({ firstFrame: first, lastFrame: last, parts });
  const rules = (poses: readonly HurtPose[]): string => violations({
    name: "Probe",
    set: { stand: [torso], attacks: {} },
    moves: [{ name: "jab", poses, firstFrame: 0, lastFrame: 20 }],
  }).map((v) => v.substring(v.indexOf("rule"), v.indexOf(":"))).join(",");
  const floating: HurtPart = { x1: 80.0, z1: 60.0, x2: 100.0, z2: 60.0, radius: 5.0 };
  const arm = (reach: number, state?: HurtState): HurtPart => ({ x1: 10.0, z1: 60.0, x2: reach, z2: 60.0, radius: 9.0, state });
  assertEquals(rules([pose(2, 8, [torso, arm(50.0)])]), "");
  assertEquals(rules([pose(2, 8, [torso, floating])]), "rule 2,rule 6,rule 4,rule 4");
  assertEquals(rules([pose(2, 3, [torso, arm(50.0)])]), "rule 3");
  assertEquals(rules([pose(2, 8, [torso, arm(50.0)]), pose(6, 12, [torso])]), "rule 3");
  assertEquals(rules([pose(15, 22, [torso])]), "rule 3");
  assertEquals(rules([pose(2, 8, [{ ...torso, z2: 20.0 }])]), "rule 4,rule 4");
  assertEquals(rules([pose(2, 5, [torso, arm(30.0)]), pose(6, 9, [torso, arm(55.0)])]), "");
  assertEquals(rules([pose(2, 8, [torso, arm(88.0)])]), "rule 6,rule 4,rule 4");
  assertEquals(rules([pose(2, 8, [torso, { x1: 0.0, z1: 80.0, x2: 0.0, z2: 160.0, radius: 9.0 }])]), "rule 6");
  assertEquals(rules([pose(2, 8, [torso, arm(50.0, HurtState.intangible)])]), "rule 5");
  assertEquals(rules([pose(2, 8, [{ ...torso, state: HurtState.invincible }, arm(50.0)])]), "rule 5");
});

test("rule 1: outside attacks and specials only crouch changes the body, and selection is a function of state", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const f = createFighter(character, 0.0, 1);
    const set = fighterHurtboxes(f);
    assertEquals(fighterHurtParts(f), set.stand);
    f.motion.grounded = false;
    f.motion.vx = 9.0;
    f.motion.vz = -4.0;
    assertEquals(fighterHurtParts(f), set.stand);
    f.motion.grounded = true;
    f.shield.raised = true;
    assertEquals(fighterHurtParts(f), set.stand);
    f.shield.raised = false;
    f.motion.crouching = true;
    assertEquals(fighterHurtParts(f), set.crouch ?? set.stand);
    assertEquals(fighterHurtParts(f), fighterHurtParts(f));
  }
});

test("rule 6: a strike tangent to a normal part hits", () => {
  const target = createFighter(Character.archer, 0.0, 1);
  const body = fighterHurtboxes(target).stand[0];
  assertTrue(body !== undefined);
  if (body === undefined) return;
  const radius = 8.0;
  const x = body.x1 + body.radius + radius;
  const strike = placeCapsule({ x1: 0.0, z1: 0.0, x2: 0.0, z2: 0.0, radius: 0.0 }, { x1: x, z1: body.z1, x2: x, z2: body.z2, radius }, target.motion.x, target.motion.z, 1);
  assertEquals(strikeHurtContact(strike, target), HurtContact.hit);
  strike.x1 += 1.0;
  strike.x2 += 1.0;
  assertEquals(strikeHurtContact(strike, target), HurtContact.none);
});
