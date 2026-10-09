import { assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "./codes";
import { createFighter, placedObject } from "./fighter";
import { runningHeroSpecial } from "./heroSpecialRules";
import { SpecialSlot, SpecialForm } from "./heroSpecials";
import { advancePlacedObjects } from "./placedObjects";
import { updateProjectiles } from "./projectiles";
import { advanceSpecials, startFighterSpecial } from "./specials";
import { advanceFighter } from "./step";
import { controls, testWorld } from "./testWorld";
import { PEON_SPECIALS } from "./heroes/peonSpecials";
import { SYLVANAS_SPECIALS } from "./heroes/sylvanasSpecials";

function cast(character: Character, slot: SpecialSlot, ex: boolean, air = false) {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, 1000.0, -1);
  const world = testWorld(owner, target);
  owner.motion.grounded = !air;
  if (air) { owner.motion.surface = undefined; owner.motion.z = 1000.0; }
  owner.mana.points = 100;
  assertTrue(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, shield: ex,
    specialX: slot === SpecialSlot.side ? 1 : 0, specialZ: slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0 }), world));
  assertEquals(owner.special.ex, ex);
  return { owner, target, world };
}

test("Black Arrow Shockwave and Lumber Toss EX deal 25% more through body contacts in ground and air [spec docs/design/mana.md]", () => {
  for (const character of [Character.sylvanas, Character.cairne, Character.peon]) for (const air of [false, true]) {
    const damage: number[] = [];
    for (const ex of [false, true]) {
      const { owner, target, world } = cast(character, SpecialSlot.neutral, ex, air);
      const spec = runningHeroSpecial(owner)?.projectiles?.[0];
      assertTrue(spec !== undefined);
      if (spec === undefined) continue;
      for (let frame = 0; frame < spec.spawnFrame; frame++) advanceSpecials(world, 0, frame);
      const shot = owner.projectiles.find(projectile => projectile.life > 0 && projectile.spec === spec);
      assertTrue(shot !== undefined);
      if (shot === undefined) continue;
      target.motion.x = f32(shot.x + shot.velocityX);
      target.motion.z = f32(f32(shot.z + shot.velocityZ) - 45.0);
      target.motion.grounded = false;
      updateProjectiles(world);
      assertGreaterThan(target.status.damage, 0.0);
      damage.push(target.status.damage);
    }
    assertNear(damage[1] ?? 0.0, f32((damage[0] ?? 0.0) * 1.25), f32(0.0001));
  }
});

test("Life Drain EX releases 25% more damage while keeping its three point heal and hold duration [spec docs/design/mana.md]", () => {
  const damage: number[] = [];
  for (const ex of [false, true]) {
    const { owner, target, world } = cast(Character.sylvanas, SpecialSlot.down, ex);
    owner.status.damage = 30.0;
    target.motion.x = 40.0;
    owner.special.frame = 16;
    advanceSpecials(world, 0, 0);
    assertEquals(owner.grab.target, 1);
    owner.special.frame = 32;
    advanceSpecials(world, 0, 0);
    assertEquals(owner.status.damage, f32(30.0 - (SYLVANAS_SPECIALS.down.ground.commandGrab?.heal?.heal ?? 0.0)));
    assertGreaterThan(target.status.damage, 0.0);
    damage.push(target.status.damage);
  }
  assertEquals(damage[1], f32((damage[0] ?? 0.0) * 1.25));
});

test("support heroes' EX recoveries rise and steer 25% farther on the same helpless timeline [spec docs/design/mana.md]", () => {
  for (const character of [Character.sylvanas, Character.cairne, Character.chen, Character.peon]) {
    const travel: number[][] = [];
    for (const ex of [false, true]) {
      const { owner, world } = cast(character, SpecialSlot.up, ex, true);
      const move = runningHeroSpecial(owner);
      let x = 0.0;
      let z = 0.0;
      for (let frame = 1; frame <= (move?.endFrame ?? 0); frame++) {
        advanceSpecials(world, 0, frame, [controls({ direction: 1 })]);
        if (move?.motion?.some(segment => frame >= segment.first && frame <= segment.last)) {
          x = f32(x + owner.motion.vx);
          z = f32(z + owner.motion.vz);
        }
      }
      assertTrue(owner.special.fall);
      travel.push([x, z, move?.endFrame ?? 0]);
    }
    assertNear(travel[1]?.[0] ?? 0.0, f32((travel[0]?.[0] ?? 0.0) * 1.25), f32(0.001));
    assertNear(travel[1]?.[1] ?? 0.0, f32((travel[0]?.[1] ?? 0.0) * 1.25), f32(0.001));
    assertEquals(travel[1]?.[2], travel[0]?.[2]);
  }
});

test("Reincarnation and Repair EX extend guard and intangibility by four frames with the same heal [spec docs/design/mana.md]", () => {
  for (const character of [Character.cairne, Character.peon]) {
    const normal = cast(character, SpecialSlot.down, false);
    const ex = cast(character, SpecialSlot.down, true);
    const baseMove = runningHeroSpecial(normal.owner);
    const exMove = runningHeroSpecial(ex.owner);
    assertEquals(exMove?.guard?.last, (baseMove?.guard?.last ?? 0) + 4);
    assertEquals(exMove?.guard?.heal, baseMove?.guard?.heal);
    assertEquals(exMove?.intangible?.last, (baseMove?.intangible?.last ?? 0) + 4);
    normal.owner.special.frame = baseMove?.guard?.last ?? 0;
    ex.owner.special.frame = baseMove?.guard?.last ?? 0;
    normal.owner.status.invincible = 0;
    ex.owner.status.invincible = 0;
    advanceSpecials(normal.world, 0, 0);
    advanceSpecials(ex.world, 0, 0);
    assertEquals(normal.owner.status.invincible, 0);
    assertGreaterThan(ex.owner.status.invincible, 0);
  }
});

test("EX Burrow keeps 25% more physical durability and stronger spears after its cast ends; Pack Up protects four entry frames [spec docs/design/mana.md]", () => {
  const { owner, world } = cast(Character.peon, SpecialSlot.side, true);
  const placement = runningHeroSpecial(owner)?.placement;
  for (let frame = 0; frame < 52; frame++) advanceSpecials(world, 0, frame);
  const burrow = placedObject(owner);
  assertEquals(owner.special.action, SpecialAction.none);
  const base = PEON_SPECIALS.side.ground.placement;
  assertEquals(burrow.durability, f32((base?.durability ?? 0.0) * 1.25));
  assertEquals(burrow.spec, placement);
  assertEquals(placement?.shot?.effect.damage, f32((base?.shot?.effect.damage ?? 0.0) * 1.25));
  burrow.age = (placement?.fireAges[0] ?? 0) - 1;
  advancePlacedObjects(world);
  assertTrue(owner.projectiles.some(projectile => projectile.life > 0 && projectile.spec === placement?.shot));
  owner.attack.cooldown = 0;
  owner.special.lockFrames = 0;
  owner.mana.points = 100;
  assertTrue(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialX: 1, shield: true }), world));
  assertEquals(owner.special.form, SpecialForm.recall);
  for (let frame = 0; frame < 5; frame++) {
    advanceFighter(world, 0, 0, controls(), 0.0);
    assertEquals(owner.status.invincible > 0, frame < 4);
    advanceSpecials(world, 0, frame);
  }
});
