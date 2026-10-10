

import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { Character, ProjectileKind } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import { updateProjectiles } from "./projectiles";
import { type Controls, type Roster, createRoster } from "./roster";
import { advanceSpecials, startFighterSpecial } from "./specials";
import { advanceFighter } from "./step";
import { controls } from "./testWorld";

function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls(), world);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0, [first, second]);
  updateProjectiles(world);
  finishDamageContacts(world);
}

const run = (world: Roster, frames: number, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()) => {
  for (let f = 0; f < frames; f++) frame(world, first, second);
};

function airborne(character: Character, z: number, gap = 900.0, targetZ = 0.0): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, gap, -1);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  owner.motion.grounded = false;
  owner.motion.surface = undefined;
  owner.motion.z = z;
  owner.motion.vz = 0.0;
  if (targetZ !== 0.0) {
    target.motion.grounded = false;
    target.motion.surface = undefined;
    target.motion.z = targetZ;
  }
  return { world, owner, target };
}

const upB = controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 });
const recoils = (f: Fighter) => f.projectiles.filter((p) => p.life > 0 && p.kind === ProjectileKind.recoil);

function firstShot(stick: Readonly<Controls>): { vx: number; vz: number; shotX: number; shotZ: number } {
  const { world, owner } = airborne(Character.rifleman, 400.0);
  frame(world, upB);
  run(world, 3, stick);
  const shot = recoils(owner)[0];
  return { vx: owner.motion.vx, vz: owner.motion.vz, shotX: shot?.velocityX ?? 0.0, shotZ: shot?.velocityZ ?? 0.0 };
}

test("Recoil shot: the stick through frame 4 picks one of eight directions (up when neutral), and the shot fires the opposite way [k3 measure #127]", () => {
  const up = firstShot(controls());
  assertEquals(up.vx, 0.0);
  assertGreaterThan(up.vz, 25.0);
  assertLessThan(up.shotZ, 0.0);
  const down = firstShot(controls({ verticalDirection: -1, down: true }));
  assertEquals(down.vx, 0.0);
  assertLessThan(down.vz, -25.0);
  assertGreaterThan(down.shotZ, 0.0);
  for (const side of [-1, 1]) {
    for (const vertical of [1, 0, -1]) {
      const shot = firstShot(controls({ direction: side, verticalDirection: vertical, down: vertical < 0 }));
      assertGreaterThan(f32(shot.vx * side), 15.0);
      assertLessThan(f32(shot.shotX * side), 0.0);
      if (vertical === 0) {
        assertGreaterThan(f32(shot.vx * side), 25.0);
        assertLessThan(Math.abs(shot.vz), 3.0);
        assertEquals(shot.shotZ, 0.0);
      } else {
        assertGreaterThan(f32(shot.vz * vertical), 15.0);
        assertLessThan(f32(shot.shotZ * vertical), 0.0);
      }
    }
  }
});

