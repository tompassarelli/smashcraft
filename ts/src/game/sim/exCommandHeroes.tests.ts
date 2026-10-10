import { assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { createFighter, type Fighter } from "./fighter";
import { mutableProjectile } from "./fighterProjectiles";
import { runningHeroSpecial } from "./heroSpecialRules";
import { SpecialSlot } from "./heroSpecials";
import { updateProjectiles } from "./projectiles";
import { type Roster } from "./roster";
import { advanceSpecials, startFighterSpecial } from "./specials";
import { controls, testWorld } from "./testWorld";

function scene(character: Character) {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, 1000.0, -1);
  const world = testWorld(owner, target);
  owner.motion.grounded = true;
  owner.mana.points = 100;
  return { owner, target, world };
}

function cast(owner: Fighter, world: Roster, slot: number, ex: boolean): void {
  const input = controls({ specialPressed: true, specialX: slot === SpecialSlot.side ? 1 : 0,
    specialZ: slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0, shield: ex });
  assertTrue(startFighterSpecial(owner, 0, 0, input, world));
  assertEquals(owner.special.ex, ex);
}

function timeline(world: Roster, frames: number): void {
  for (let frame = 0; frame < frames; frame++) advanceSpecials(world, 0, frame);
}

test("command heroes' projectile EX casts and air forms deal 25% more through body contacts [spec #329]", () => {
  const cases = [
    [Character.beastmaster, SpecialSlot.neutral, false],
    [Character.beastmaster, SpecialSlot.side, false],
    [Character.lichKing, SpecialSlot.neutral, false],
    [Character.lichKing, SpecialSlot.neutral, true],
    [Character.lichKing, SpecialSlot.side, false],
    [Character.lichKing, SpecialSlot.side, true],
    [Character.thrall, SpecialSlot.neutral, false],
    [Character.thrall, SpecialSlot.side, true],
    [Character.jaina, SpecialSlot.neutral, true],
    [Character.jaina, SpecialSlot.side, false],
  ] as const;
  for (const [character, slot, air] of cases) {
    const damage: number[] = [];
    for (const ex of [false, true]) {
      const { owner, target, world } = scene(character);
      owner.motion.grounded = !air;
      owner.motion.z = air ? 200.0 : 0.0;
      if (character === Character.beastmaster && slot === SpecialSlot.side) {
        cast(owner, world, slot, false);
        timeline(world, 70);
        owner.attack.cooldown = 0;
        owner.special.lockFrames = 0;
      }
      cast(owner, world, slot, ex);
      const move = runningHeroSpecial(owner);
      const spec = move?.projectiles?.[0];
      assertTrue(spec !== undefined);
      if (spec === undefined) continue;
      timeline(world, spec.spawnFrame);
      const index = owner.projectiles.findIndex(projectile => projectile.life > 0 && projectile.spec === spec);
      assertTrue(index >= 0);
      const projectile = mutableProjectile(owner, index);
      projectile.life = spec.life - (spec.activeFrom ?? 0);
      target.motion.x = f32(projectile.x + projectile.velocityX);
      target.motion.z = f32(f32(projectile.z + projectile.velocityZ) - 45.0);
      target.motion.grounded = false;
      updateProjectiles(world);
      assertGreaterThan(target.status.damage, 0.0);
      damage.push(target.status.damage);
    }
    assertNear(damage[1] ?? 0.0, f32((damage[0] ?? 0.0) * 1.25), f32(0.0001));
  }
});

test("command heroes' EX recovery motion rises and steers 25% farther with the same timeline [spec #329]", () => {
  for (const character of [Character.beastmaster, Character.lichKing, Character.thrall, Character.jaina]) {
    const travel: number[][] = [];
    for (const ex of [false, true]) {
      const { owner, world } = scene(character);
      owner.motion.grounded = false;
      owner.motion.z = 1000.0;
      cast(owner, world, SpecialSlot.up, ex);
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
