// Rifleman's aimed two-stage recoil shot (#127) and Illidan's jump-cancellable
// Immolate and glide out of Wing Ascent (#128), through the production special,
// contact and projectile steps (smashcraft:docs/design/kit-review-1.md).
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { Character, ProjectileKind, SpecialAction } from "./codes";
import { isIntangible } from "./conditions";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import { updateProjectiles } from "./projectiles";
import { type Controls, type Roster, createRoster } from "./roster";
import { DEMONHUNTER_GLIDE_FORM, advanceSpecials, startFighterSpecial } from "./specials";
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

/** The owner airborne at `z`, the target `gap` ahead of it on the deck (or at `targetZ`). */
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

/** Velocity right after the first shot (frame 5), holding `stick` through frame 4. */
function firstShot(stick: Readonly<Controls>): { vx: number; vz: number; shotX: number; shotZ: number } {
  const { world, owner } = airborne(Character.rifleman, 400.0);
  frame(world, upB);
  run(world, 3, stick);
  const shot = recoils(owner)[0];
  return { vx: owner.motion.vx, vz: owner.motion.vz, shotX: shot?.velocityX ?? 0.0, shotZ: shot?.velocityZ ?? 0.0 };
}

test("Recoil shot: the stick through frame 4 picks one of eight directions (up when neutral), and the shot fires the opposite way [spec #127]", () => {
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

test("Recoil shot: one second shot on a special press in frames 12-24 changes the route; earlier, again or later it is refused [spec #127]", () => {
  const { world, owner } = airborne(Character.rifleman, 400.0);
  frame(world, upB);
  run(world, 3, controls({ direction: 1 }));
  run(world, 5);
  frame(world, controls({ specialPressed: true, direction: -1 }));
  assertEquals(recoils(owner).length, 1);
  run(world, 1);
  frame(world, controls({ specialPressed: true, direction: -1 }));
  assertLessThan(owner.motion.vx, -10.0);
  const second = recoils(owner).length;
  run(world, 1);
  frame(world, controls({ specialPressed: true, direction: 1 }));
  assertLessThan(owner.motion.vx, 0.0);
  assertEquals(recoils(owner).length, second);
  const late = airborne(Character.rifleman, 400.0);
  frame(late.world, upB);
  run(late.world, 24);
  frame(late.world, controls({ specialPressed: true, direction: 1 }));
  assertEquals(late.owner.special.form, 0);
});

test("Recoil shot counterplay: intangible only through frame 10, and it still ends helpless [spec #127]", () => {
  const { world, owner } = airborne(Character.rifleman, 400.0);
  frame(world, upB);
  run(world, 8);
  assertTrue(isIntangible(owner));
  run(world, 3);
  assertFalse(isIntangible(owner));
  run(world, 25);
  assertEquals(owner.special.action, SpecialAction.none);
  assertTrue(owner.special.fall);
});

test("Recoil shot: the shot is the edge-guard answer, striking the fighter it is fired at [spec #127]", () => {
  const { world, owner, target } = airborne(Character.rifleman, 400.0, -70.0, 380.0);
  frame(world, upB);
  for (let f = 0; f < 12 && target.status.damage === 0.0; f++) {
    target.motion.z = 380.0;
    target.motion.vz = 0.0;
    frame(world, controls({ direction: 1, verticalDirection: 1 }));
  }
  assertGreaterThan(owner.motion.x, 0.0);
  assertGreaterThan(target.status.damage, 0.0);
});

const downB = controls({ specialPressed: true, specialZ: -1 });
const jump = controls({ jumpPressed: true, jumpHeld: true });

/** Grounded Illidan with the target `gap` ahead. */
function grounded(gap: number): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(Character.rifleman, gap, -1);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

test("Immolate: a jump from its first active frame cancels it into a jump with the hit dealt; earlier it does not [spec #128]", () => {
  const { world, owner, target } = grounded(60.0);
  frame(world, downB);
  run(world, 3);
  assertGreaterThan(target.status.damage, 0.0);
  for (let f = 0; f < 10 && owner.launch.hitlag > 0; f++) frame(world);
  frame(world, jump);
  assertEquals(owner.special.action, SpecialAction.none);
  run(world, 8, controls({ jumpHeld: true }));
  assertFalse(owner.motion.grounded);
  const early = grounded(900.0);
  frame(early.world, downB);
  frame(early.world, jump);
  assertEquals(early.owner.special.action, SpecialAction.demonHunterImmolate);
  run(early.world, 8);
  assertTrue(early.owner.motion.grounded);
});

test("Immolate counterplay: after a jump cancel the next Immolate waits its 24-frame cooldown [spec #128]", () => {
  const { world, owner } = grounded(900.0);
  frame(world, downB);
  run(world, 4);
  frame(world, jump);
  run(world, 4);
  frame(world, downB);
  assertFalse(owner.special.action === SpecialAction.demonHunterImmolate && owner.special.frame <= 1);
});

test("Wing Ascent glide: a jump in frames 16-28 glides forward, and the stick pitches its line [spec #128]", () => {
  const line = (pitch: number): { vx: number; vz: number; form: number } => {
    const { world, owner } = airborne(Character.demonHunter, 300.0);
    frame(world, upB);
    run(world, 14);
    frame(world, jump);
    run(world, 3, controls({ verticalDirection: pitch, down: pitch < 0 }));
    return { vx: owner.motion.vx, vz: owner.motion.vz, form: owner.special.form };
  };
  const level = line(0);
  assertEquals(level.form, DEMONHUNTER_GLIDE_FORM);
  assertEquals(level.vx, 9.0);
  assertEquals(level.vz, -1.5);
  assertEquals(line(1).vz, -0.5);
  assertEquals(line(-1).vz, -4.0);
  const early = airborne(Character.demonHunter, 300.0);
  frame(early.world, upB);
  run(early.world, 8);
  frame(early.world, jump);
  assertEquals(early.owner.special.form, 0);
});

test("Wing Ascent glide: an attack slashes for 8 and ends helpless; running out ends helpless [spec #128]", () => {
  const { world, owner, target } = airborne(Character.demonHunter, 300.0, 900.0);
  frame(world, upB);
  run(world, 14);
  frame(world, jump);
  run(world, 2);
  target.motion.x = f32(owner.motion.x + 60.0);
  target.motion.grounded = false;
  target.motion.surface = undefined;
  target.motion.z = owner.motion.z;
  frame(world, controls({ attackPressed: true }));
  for (let f = 0; f < 8; f++) {
    if (target.status.damage === 0.0) {
      target.motion.z = owner.motion.z;
      target.motion.vz = 0.0;
      target.motion.x = f32(owner.motion.x + 60.0);
    }
    frame(world);
  }
  assertEquals(target.status.damage, 8.0);
  run(world, 20);
  assertTrue(owner.special.fall);
  const out = airborne(Character.demonHunter, 700.0);
  frame(out.world, upB);
  run(out.world, 14);
  frame(out.world, jump);
  run(out.world, 88);
  assertEquals(out.owner.special.action, SpecialAction.demonHunterWingAscent);
  run(out.world, 2);
  assertEquals(out.owner.special.action, SpecialAction.none);
  assertTrue(out.owner.special.fall);
});

test("A special starts in its plain form: after a glide slash, Immolate still jump-cancels [repro #128]", () => {
  const { world, owner } = airborne(Character.demonHunter, 300.0);
  frame(world, upB);
  run(world, 14);
  frame(world, jump);
  run(world, 2);
  frame(world, controls({ attackPressed: true }));
  for (let f = 0; f < 240 && !(owner.motion.grounded && owner.special.action === SpecialAction.none && owner.landing.lag === 0); f++) frame(world);
  run(world, 30);
  frame(world, downB);
  assertEquals(owner.special.form, 0);
  run(world, 4);
  frame(world, jump);
  assertEquals(owner.special.action, SpecialAction.none);
});
