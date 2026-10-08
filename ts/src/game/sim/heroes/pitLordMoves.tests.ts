import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character } from "../codes";
import { createFighter } from "../fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { attackStartupFrames, characterAttackActiveFrames, isAerialAttack } from "../moves";
import { testWorld } from "../testWorld";
import { PIT_LORD_MOVES } from "./pitLordMoves";
import { heroBody } from "./heroBodies";

// Adopted F/A/R/L values from smashcraft:docs/design/roster.md, "Pit Lord".
const NORMALS = [
  [AttackStyle.jab, 7, 3, 19, 0],
  [AttackStyle.forwardTilt, 13, 4, 35, 0],
  [AttackStyle.forwardTiltUp, 13, 4, 35, 0],
  [AttackStyle.forwardTiltDown, 13, 4, 35, 0],
  [AttackStyle.upTilt, 12, 5, 27, 0],
  [AttackStyle.downTilt, 10, 3, 24, 0],
  [AttackStyle.dashAttack, 15, 6, 34, 0],
  [AttackStyle.forwardSmash, 27, 4, 43, 0],
  [AttackStyle.upSmash, 24, 5, 39, 0],
  [AttackStyle.downSmash, 22, 7, 28, 0],
  [AttackStyle.neutralAir, 12, 7, 29, 20],
  [AttackStyle.forwardAir, 19, 4, 36, 25],
  [AttackStyle.backAir, 14, 4, 31, 20],
  [AttackStyle.upAir, 11, 4, 28, 18],
  [AttackStyle.downAir, 20, 5, 38, 28],
  [AttackStyle.grab, 10, 3, 32, 0],
] as const;

function pair(style: AttackStyle, frame: number, x: number, facing = 1) {
  const owner = createFighter(Character.pitLord, 0.0, facing);
  owner.motion.grounded = !isAerialAttack(style);
  const target = createFighter(Character.archer, f32(x * facing), -facing);
  target.motion.grounded = true;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  owner.attack.frame = frame;
  return { owner, target, world };
}

test("Pit Lord's startup and active frames reach production, one live strike path per frame [spec docs/design/roster.md]", () => {
  const out = emptyHitRegion();
  for (const [style, first, active] of NORMALS) {
    assertEquals(attackStartupFrames(style, PIT_LORD_MOVES), first - 1);
    assertEquals(characterAttackActiveFrames(Character.pitLord, style, PIT_LORD_MOVES), active);
    const count = authoredHitRegionCount(style, PIT_LORD_MOVES);
    for (let frame = first - 2; frame <= first + active - 1; frame++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.pitLord, style, frame, 0, index, PIT_LORD_MOVES);
        if (out.window > 0) live++;
      }
      // Down smash's front and rear stomps leave its middle frame (f25) empty; the forward smash has a tip and an inner blade.
      const expected = frame >= first - 1 && frame < first - 1 + active && !(style === AttackStyle.downSmash && frame === 24);
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

test("Annihilating Cleave's head hits for 25 and its inner blade for 19; Cleaving Sweep claims XL range [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const [style, frame, x, damage] of [
      [AttackStyle.forwardSmash, 28, 165.0, 25.0],
      [AttackStyle.forwardSmash, 28, 70.0, 19.0],
      [AttackStyle.forwardSmash, 28, 240.0, 0.0],
      [AttackStyle.forwardTilt, 13, 195.0, 12.0],
      [AttackStyle.forwardTilt, 13, 235.0, 0.0],
      [AttackStyle.jab, 7, 90.0, 6.0],
      [AttackStyle.jab, 7, 160.0, 0.0],
      [AttackStyle.backAir, 14, -120.0, 15.0],
      [AttackStyle.backAir, 14, 120.0, 0.0],
    ] as const) {
      const { target, world } = pair(style, frame, x, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
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
    for (let frame = 9; frame <= 19; frame++) assertEquals(touches(AttackStyle.backAir, frame, -100.0, 36.0), frame >= 13 && frame <= 16);
    assertTrue(touches(AttackStyle.downTilt, 9, 85.0, 18.0));
    assertTrue(!touches(AttackStyle.downTilt, 20, 85.0, 18.0));
    // Cleaving Sweep's blade past the hands is not body.
    assertTrue(!touches(AttackStyle.forwardTilt, 13, 160.0, 80.0));
  }
});
