import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character } from "../codes";
import { createFighter } from "../fighter";
import { createReferenceContactFighter } from "../referenceRig";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { attackStartupFrames, characterAttackActiveFrames, isAerialAttack } from "../moves";
import { testWorld } from "../testWorld";
import { PIT_LORD_MOVES } from "./pitLordMoves";
import { heroBody } from "./heroBodies";


const NORMALS = [
  AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt,
  AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash,
  AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.grab,
] as const;
const firstActive = (style: AttackStyle) => attackStartupFrames(style, PIT_LORD_MOVES) + 1;
const damageOf = (style: AttackStyle, region: number) => PIT_LORD_MOVES.normals[style]?.regions[region]?.hit.effect.damage ?? -1.0;
const hurtPose = (style: AttackStyle, pose: number) => PIT_LORD_MOVES.hurtboxes?.attacks[style]?.[pose];

function pair(style: AttackStyle, frame: number, x: number, facing = 1) {
  const owner = createFighter(Character.pitLord, 0.0, facing);
  owner.motion.grounded = !isAerialAttack(style);
  const target = createReferenceContactFighter(f32(x * facing), -facing);
  target.motion.grounded = true;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  owner.attack.frame = frame;
  return { owner, target, world };
}

test("Pit Lord has a live strike path on every authored active frame except the stomp turnaround, and none outside [spec docs/design/roster.md]", () => {
  const out = emptyHitRegion();
  const turnaround = (PIT_LORD_MOVES.normals[AttackStyle.downSmash]?.regions[2]?.lastFrame ?? -2) + 1;
  for (const style of NORMALS) {
    const first = firstActive(style);
    const active = characterAttackActiveFrames(Character.pitLord, style, PIT_LORD_MOVES);
    const count = authoredHitRegionCount(style, PIT_LORD_MOVES);
    for (let frame = first - 2; frame <= first + active - 1; frame++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.pitLord, style, frame, 0, index, PIT_LORD_MOVES);
        if (out.window > 0) live++;
      }

      const expected = frame >= first - 1 && frame < first - 1 + active && !(style === AttackStyle.downSmash && frame === turnaround);
      assertEquals(live > 0, expected);
    }
  }
});

test("Pit Lord is the roster's largest, heaviest and slowest body [spec docs/design/roster.md]", () => {
  const pitLord = heroBody(Character.pitLord);
  assertTrue(pitLord !== undefined);
  for (const character of [Character.mountainKing, Character.forsakenPaladin, Character.dreadlord]) {
    const other = heroBody(character);
    if (pitLord === undefined || other === undefined) return;
    assertGreaterThan(pitLord.weight, other.weight);
    assertGreaterThan(pitLord.width, other.width);
    assertLessThan(pitLord.air, other.air);
    assertGreaterThan(hurtCapsule(Character.pitLord).radius, hurtCapsule(character).radius);
  }
});

test("Annihilating Cleave's head hits harder than its inner blade; Cleaving Sweep claims XL range [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const [style, x, damage] of [
      [AttackStyle.forwardSmash, 165.0, damageOf(AttackStyle.forwardSmash, 0)],
      [AttackStyle.forwardSmash, 70.0, damageOf(AttackStyle.forwardSmash, 4)],
      [AttackStyle.forwardSmash, 240.0, 0.0],
      [AttackStyle.forwardTilt, 195.0, damageOf(AttackStyle.forwardTilt, 0)],
      [AttackStyle.forwardTilt, 235.0, 0.0],
      [AttackStyle.jab, 90.0, damageOf(AttackStyle.jab, 0)],
      [AttackStyle.jab, 160.0, 0.0],
      [AttackStyle.backAir, -120.0, damageOf(AttackStyle.backAir, 0)],
      [AttackStyle.backAir, 120.0, 0.0],
    ] as const) {
      const { target, world } = pair(style, firstActive(style), x, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
      if (style === AttackStyle.forwardSmash && x === 165.0) assertGreaterThan(damage, damageOf(AttackStyle.forwardSmash, 4));
      if (damage > 0.0) assertGreaterThan(f32(f32(target.launch.knockbackX * facing) * (x < 0 ? -1 : 1)), 0.0);
    }
  }
});

test("Pit Lord's tail lengthens with Tail Lash and his hoof is hittable while it kicks; the cleaver stays disjoint [spec docs/design/roster.md]", () => {
  const probe = (x: number, z: number) => ({ x1: x, z1: z, x2: x, z2: z, radius: 4.0 });
  for (const facing of [-1, 1]) {
    const f = createFighter(Character.pitLord, 0.0, facing);
    const touches = (style: AttackStyle | undefined, frame: number, x: number, z: number) => {
      f.attack.style = style;
      f.attack.frame = frame;
      return strikeHurtContact(probe(f32(x * facing), z), f) === HurtContact.hit;
    };
    assertTrue(!touches(undefined, 0, -100.0, 36.0));
    const tail = hurtPose(AttackStyle.backAir, 1);
    const hoof = hurtPose(AttackStyle.downTilt, 0);
    assertTrue(tail !== undefined && hoof !== undefined);
    if (tail === undefined || hoof === undefined) continue;
    for (let frame = tail.firstFrame - 4; frame <= tail.lastFrame + 3; frame++) assertEquals(touches(AttackStyle.backAir, frame, -100.0, 36.0), frame >= tail.firstFrame && frame <= tail.lastFrame);
    assertTrue(touches(AttackStyle.downTilt, hoof.firstFrame, 85.0, 18.0));
    assertTrue(!touches(AttackStyle.downTilt, hoof.lastFrame + 1, 85.0, 18.0));

    assertTrue(!touches(AttackStyle.forwardTilt, 13, 160.0, 80.0));
  }
});
