// The legible-hurtbox rules (smashcraft:docs/gameplay-design.md, "Legible
// hurtboxes", #97) checked on every fighter's authored bodies: the original
// three and each registered hero, normals and specials. A fighter that breaks
// a rule on purpose lists a named departure below and in that section.
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { type Capsule, capsulesIntersect, placeCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character } from "./codes";
import { createFighter } from "./fighter";
import { HERO_ROSTER } from "./heroes/registry";
import type { FighterMoves, MoveRegion } from "./heroMoves";
import { type AuthoredSpecial, specialKit } from "./heroSpecials";
import { type HitRegion, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { type FighterHurtboxes, type HurtPart, type HurtPose, HurtContact, HurtState, fighterHurtParts, fighterHurtboxes, strikeHurtContact } from "./hurtboxes";
import { attackDurationFramesForGrounding } from "./moves";

/** Rule 3: frames every authored pose lasts at least. */
const MIN_POSE_FRAMES = 3;
/** Rule 4: world units one change may move the body's front, back, top or bottom. */
const MAX_BODY_STEP = 60.0;

/**
 * Named departures, "fighter move rule N" to its reason; each must also be
 * named in gameplay-design.md. A listed departure that no longer occurs fails.
 */
const DEPARTURES: { readonly [key: string]: string | undefined } = {};

interface Region { readonly strike?: Readonly<Capsule> | undefined; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }

/** One move's authored bodies, in its own frame numbering, with the frames it lasts. */
interface MoveBodies {
  readonly name: string;
  readonly poses: readonly HurtPose[];
  readonly firstFrame: number;
  readonly lastFrame: number;
  readonly regions: readonly Region[];
}

interface FighterBodies {
  readonly name: string;
  readonly set: Readonly<FighterHurtboxes>;
  readonly moves: readonly MoveBodies[];
}

const STYLE_NAMES: { [style: number]: string } = {};
for (const key in AttackStyle) STYLE_NAMES[AttackStyle[key as keyof typeof AttackStyle]] = key;

function originalRegions(character: Character, style: AttackStyle, total: number): Region[] {
  const regions: Region[] = [];
  const count = authoredHitRegionCount(style);
  for (let frame = 0; frame < total; frame++) {
    for (let index = 0; index < count; index++) {
      const region: HitRegion = authoredHitRegion(emptyHitRegion(), character, style, frame, 0, index);
      if (region.window > 0) regions.push(region);
    }
  }
  return regions;
}

const heroRegions = (regions: readonly MoveRegion[] | undefined): Region[] => {
  const out: Region[] = [];
  for (const region of regions ?? []) out.push(region.hit);
  return out;
};

function attackBodies(set: Readonly<FighterHurtboxes>, character: Character, moves: FighterMoves | undefined): MoveBodies[] {
  const out: MoveBodies[] = [];
  for (const key in AttackStyle) {
    const style = AttackStyle[key as keyof typeof AttackStyle];
    const poses = set.attacks[style];
    if (poses === undefined || poses.length === 0) continue;
    const total = Math.max(attackDurationFramesForGrounding(style, true, moves), attackDurationFramesForGrounding(style, false, moves));
    const regions = moves === undefined ? originalRegions(character, style, total) : heroRegions(moves.normals[style]?.regions);
    out.push({ name: key, poses, firstFrame: 0, lastFrame: total - 1, regions });
  }
  return out;
}

const SLOT_NAMES = ["neutral special", "side special", "up special", "down special"] as const;

function specialBodies(special: AuthoredSpecial | undefined, name: string, out: MoveBodies[]): void {
  if (special?.hurt === undefined || special.hurt.length === 0) return;
  out.push({ name, poses: special.hurt, firstFrame: 1, lastFrame: special.endFrame, regions: heroRegions(special.regions) });
}

function everyFighter(): FighterBodies[] {
  const fighters: FighterBodies[] = [];
  const originals: readonly [Character, string][] = [[Character.archer, "Archer"], [Character.rifleman, "Rifleman"], [Character.demonHunter, "Illidan"]];
  for (const [character, name] of originals) {
    const set = fighterHurtboxes(createFighter(character, 0.0, 1));
    fighters.push({ name, set, moves: attackBodies(set, character, undefined) });
  }
  for (const hero of HERO_ROSTER) {
    const set = fighterHurtboxes(createFighter(hero.character, 0.0, 1));
    const moves = attackBodies(set, hero.character, hero.moves);
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

/** Distance from point to an axis-aligned box. */
function pointBox(x: number, z: number, r: Region): number {
  const dx = Math.max(r.minX - x, 0.0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0.0, z - r.maxZ);
  return Math.sqrt(dx * dx + dz * dz);
}

function pointSegment(x: number, z: number, p: HurtPart): number {
  const vx = p.x2 - p.x1;
  const vz = p.z2 - p.z1;
  const length = vx * vx + vz * vz;
  const t = length === 0.0 ? 0.0 : Math.max(0.0, Math.min(1.0, ((x - p.x1) * vx + (z - p.z1) * vz) / length));
  const dx = p.x1 + t * vx - x;
  const dz = p.z1 + t * vz - z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Whether the segment crosses the box (Liang–Barsky clip). */
function segmentCrossesBox(p: HurtPart, r: Region): boolean {
  let low = 0.0;
  let high = 1.0;
  const checks: readonly [number, number][] = [
    [-(p.x2 - p.x1), p.x1 - r.minX], [p.x2 - p.x1, r.maxX - p.x1],
    [-(p.z2 - p.z1), p.z1 - r.minZ], [p.z2 - p.z1, r.maxZ - p.z1],
  ];
  for (const [direction, room] of checks) {
    if (direction === 0.0) {
      if (room < 0.0) return false;
    } else if (direction < 0.0) {
      low = Math.max(low, room / direction);
    } else {
      high = Math.min(high, room / direction);
    }
  }
  return low <= high;
}

/** Rule 5: a protected part touches the region's strike capsule, or its envelope when it has none. */
function touchesRegion(part: HurtPart, region: Region): boolean {
  if (region.strike !== undefined) return capsulesIntersect(part, region.strike);
  if (segmentCrossesBox(part, region)) return true;
  let distance = Math.min(pointBox(part.x1, part.z1, region), pointBox(part.x2, part.z2, region));
  for (const [x, z] of [[region.minX, region.minZ], [region.minX, region.maxZ], [region.maxX, region.minZ], [region.maxX, region.maxZ]] as const) {
    distance = Math.min(distance, pointSegment(x, z, part));
  }
  return distance <= part.radius;
}

/** Every rule a fighter's authored bodies break, as "fighter move rule N: detail". */
function violations(fighter: FighterBodies): string[] {
  const found: string[] = [];
  const add = (move: string, rule: number, detail: string): void => {
    found.push(`${fighter.name} ${move} rule ${rule}: ${detail}`);
  };
  const { stand, crouch } = fighter.set;
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
        if ((part.state ?? HurtState.normal) === HurtState.normal) continue;
        let touches = false;
        for (const region of move.regions) if (touchesRegion(part, region)) touches = true;
        if (!touches) add(move.name, 5, `${label}: a protected part touches none of the move's hit regions`);
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
  const rules = (poses: readonly HurtPose[], regions: readonly Region[] = []): string => violations({
    name: "Probe",
    set: { stand: [torso], attacks: {} },
    moves: [{ name: "jab", poses, firstFrame: 0, lastFrame: 20, regions }],
  }).map((v) => v.substring(v.indexOf("rule"), v.indexOf(":"))).join(",");
  const floating: HurtPart = { x1: 80.0, z1: 60.0, x2: 100.0, z2: 60.0, radius: 5.0 };
  const arm = (reach: number, state?: HurtState): HurtPart => ({ x1: 10.0, z1: 60.0, x2: reach, z2: 60.0, radius: 9.0, state });
  assertEquals(rules([pose(2, 8, [torso, arm(50.0)])]), "");
  assertEquals(rules([pose(2, 8, [torso, floating])]), "rule 2,rule 4,rule 4");
  assertEquals(rules([pose(2, 3, [torso, arm(50.0)])]), "rule 3");
  assertEquals(rules([pose(2, 8, [torso, arm(50.0)]), pose(6, 12, [torso])]), "rule 3");
  assertEquals(rules([pose(15, 22, [torso])]), "rule 3");
  assertEquals(rules([pose(2, 8, [torso, arm(110.0)])]), "rule 4,rule 4");
  assertEquals(rules([pose(2, 5, [torso, arm(50.0)]), pose(6, 9, [torso, arm(100.0)]), pose(10, 13, [torso, arm(50.0)])]), "");
  const strikeRegion: Region = { minX: 40.0, maxX: 70.0, minZ: 50.0, maxZ: 70.0 };
  assertEquals(rules([pose(2, 8, [torso, arm(50.0, HurtState.intangible)])], [strikeRegion]), "");
  assertEquals(rules([pose(2, 8, [{ ...torso, state: HurtState.invincible }, arm(50.0)])], [strikeRegion]), "rule 5");
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
