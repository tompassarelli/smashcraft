import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character } from "../codes";
import { createFighter } from "../fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { attackStartupFrames, characterAttackActiveFrames, isAerialAttack } from "../moves";
import { testWorld } from "../testWorld";
import { BEASTMASTER_MOVES } from "./beastmasterMoves";


const NORMALS = [
  AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt,
  AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.neutralAir,
  AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.grab,
] as const;
const firstActive = (style: AttackStyle) => attackStartupFrames(style, BEASTMASTER_MOVES) + 1;

function pair(style: AttackStyle, frame: number, x: number, facing = 1) {
  const owner = createFighter(Character.beastmaster, 0.0, facing);
  owner.motion.grounded = !isAerialAttack(style);
  const target = createFighter(Character.rifleman, f32(x * facing), -facing);
  target.motion.grounded = true;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  owner.attack.frame = frame;
  return { owner, target, world };
}

test("Beastmaster has a live strike path on every authored active frame and none outside it [spec docs/design/roster.md]", () => {
  const out = emptyHitRegion();
  for (const style of NORMALS) {
    const first = firstActive(style);
    const active = characterAttackActiveFrames(Character.beastmaster, style, BEASTMASTER_MOVES);
    const count = authoredHitRegionCount(style, BEASTMASTER_MOVES);
    for (let frame = first - 2; frame <= first + active - 1; frame++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.beastmaster, style, frame, 0, index, BEASTMASTER_MOVES);
        if (out.window > 0) live++;
      }
      assertEquals(live > 0, frame >= first - 1 && frame < first - 1 + active);
    }
  }
});

test("Beastmaster's axe reaches L and his boot kicks behind, facing relative [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    for (const [style, x, hit] of [
      [AttackStyle.forwardTilt, 150.0, true],
      [AttackStyle.forwardTilt, 190.0, false],
      [AttackStyle.jab, 60.0, true],
      [AttackStyle.jab, 110.0, false],
      [AttackStyle.forwardSmash, 140.0, true],
      [AttackStyle.backAir, -100.0, true],
      [AttackStyle.backAir, 100.0, false],
    ] as const) {
      const { target, world } = pair(style, firstActive(style), x, facing);
      resolveAttacks(world);
      assertEquals(target.status.damage > 0.0, hit);
      if (hit) assertGreaterThan(f32(f32(target.launch.knockbackX * facing) * (x < 0 ? -1 : 1)), 0.0);
    }
  }
});

test("Hunter's Boot is an exposed leg behind him while the axe head stays disjoint [spec docs/design/roster.md]", () => {
  const probe = (x: number, z: number) => ({ x1: x, z1: z, x2: x, z2: z, radius: 4.0 });
  for (const facing of [-1, 1]) {
    const f = createFighter(Character.beastmaster, 0.0, facing);
    const touches = (style: AttackStyle | undefined, frame: number, x: number, z: number) => {
      f.attack.style = style;
      f.attack.frame = frame;
      return strikeHurtContact(probe(f32(x * facing), z), f) === HurtContact.hit;
    };
    assertTrue(!touches(undefined, 0, -70.0, 36.0));
    const boot = BEASTMASTER_MOVES.hurtboxes?.attacks[AttackStyle.backAir]?.[1];
    assertTrue(boot !== undefined);
    if (boot === undefined) continue;
    for (let frame = boot.firstFrame - 4; frame <= boot.lastFrame + 3; frame++) assertEquals(touches(AttackStyle.backAir, frame, -70.0, 36.0), frame >= boot.firstFrame && frame <= boot.lastFrame);
    assertTrue(!touches(AttackStyle.forwardTilt, 10, 120.0, 60.0));
  }
});
