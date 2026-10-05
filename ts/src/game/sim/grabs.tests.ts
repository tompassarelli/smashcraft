// Grab links: what releases them, mash-out and stock loss.
import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, GrabAction, ProjectileKind } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { resolveGrabs } from "./grabs";
import { GRAB_HOLD_FRAMES, attackStartupFrames, grabContactFrame } from "./moves";
import { updateProjectiles } from "./projectiles";
import type { Roster } from "./roster";
import { advanceFighter } from "./step";
import { respawnFighter } from "./stocks";
import { advanceFreezeTraps } from "./summons";
import { controls, testBeginAttacks, testGrabFrame, testWorld } from "./testWorld";

/** Slot 0 grabs slot 1 on the ground and holds it. */
function catchTarget(world: Roster, owner: Fighter, target: Fighter): void {
  owner.motion.surface = 0;
  target.motion.surface = 0;
  testBeginAttacks(world, AttackStyle.grab, undefined);
  owner.attack.frame = attackStartupFrames(AttackStyle.grab);
  resolveAttacks(world);
  resolveGrabs(world);
  assertEquals(owner.grab.target, 1);
  assertEquals(target.grab.owner, 0);
}

function grabbedPair(): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 90.0, -1);
  const world = testWorld(owner, target);
  catchTarget(world, owner, target);
  return { world, owner, target };
}

test("only flinching projectiles release either end of a grab", () => {
  for (const victim of [0, 1]) {
    for (const kind of [ProjectileKind.blaster, ProjectileKind.arrow, ProjectileKind.fanArrow, ProjectileKind.recoil]) {
      const { world, owner, target } = grabbedPair();
      const shooter = victim === 0 ? target : owner;
      const hit = victim === 0 ? owner : target;
      const projectile = shooter.projectiles[0]!;
      projectile.life = 2;
      projectile.kind = kind;
      projectile.x = f32(hit.motion.x - 10);
      projectile.z = f32(hit.motion.z + 45);
      projectile.velocityX = 20.0;
      projectile.direction = 1;
      updateProjectiles(world);
      assertGreaterThan(hit.status.damage, 0.0);
      if (kind === ProjectileKind.arrow || kind === ProjectileKind.fanArrow) {
        assertEquals(hit.launch.hitstun, 0);
        assertEquals(hit.launch.hitlag, 0);
        assertEquals(owner.grab.target, 1);
        assertEquals(target.grab.owner, 0);
        assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES);
      } else {
        assertGreaterThan(hit.launch.hitstun, 0);
        assertEquals(owner.grab.target, undefined);
        assertEquals(target.grab.owner, undefined);
        assertEquals(target.grab.grabbedFrames, 0);
      }
    }
  }
});

test("a respawn releases reciprocal grab links", () => {
  for (const victim of [0, 1]) {
    const { world, owner, target } = grabbedPair();
    respawnFighter(world, victim, 0.0);
    assertEquals(owner.grab.target, undefined);
    assertEquals(target.grab.owner, undefined);
    assertEquals(target.grab.grabbedFrames, 0);
  }
});

test("a freeze trap releases reciprocal grab links", () => {
  const { world, owner, target } = grabbedPair();
  target.freezeTrap.life = 100;
  target.freezeTrap.x = owner.motion.x;
  target.freezeTrap.surface = 0;
  advanceFreezeTraps(world);
  assertGreaterThan(owner.status.frozenFrames, 0);
  assertEquals(owner.grab.target, undefined);
  assertEquals(target.grab.owner, undefined);
});

test("simultaneous grabs give neither slot ownership", () => {
  const first = createFighter(Character.archer, 0.0, 1);
  const second = createFighter(Character.rifleman, 90.0, -1);
  const world = testWorld(first, second);
  testBeginAttacks(world, AttackStyle.grab, AttackStyle.grab);
  first.attack.frame = attackStartupFrames(AttackStyle.grab);
  second.attack.frame = attackStartupFrames(AttackStyle.grab);
  resolveAttacks(world);
  assertEquals(first.grab.target, undefined);
  assertEquals(second.grab.target, undefined);
  assertEquals(first.grab.grabbedFrames, 0);
  assertEquals(second.grab.grabbedFrames, 0);
  first.launch.hitlag = 1;
  second.attack.frame++;
  resolveAttacks(world);
  assertEquals(second.grab.target, undefined);
  assertEquals(first.grab.grabbedFrames, 0);
});

test("grab mash uses one button and one remembered stick contribution", () => {
  const owner = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 90.0, -1);
  const world = testWorld(owner, target);
  target.status.damage = 50.0;
  catchTarget(world, owner, target);
  assertEquals(target.grab.grabbedFrames, 156);
  const held = controls();
  const mash = controls({ grabMashPressed: true, direction: 1, verticalDirection: 1 });
  testGrabFrame(world, [held, mash], false);
  assertEquals(target.grab.grabbedFrames, 143);
  mash.grabMashPressed = false;
  mash.direction = 0;
  mash.verticalDirection = 0;
  testGrabFrame(world, [held, mash], false);
  assertEquals(target.grab.grabbedFrames, 142);
  mash.direction = 1;
  mash.verticalDirection = 1;
  testGrabFrame(world, [held, mash], false);
  assertEquals(target.grab.grabbedFrames, 141);
  mash.direction = -1;
  mash.verticalDirection = -1;
  testGrabFrame(world, [held, mash], false);
  assertEquals(target.grab.grabbedFrames, 134);
});

test("stock loss clears a capture and post-throw recovery immediately", () => {
  for (const release of [false, true]) {
    const { world, owner, target } = grabbedPair();
    const input = controls();
    const other = controls();
    if (release) {
      input.grabThrowZ = 1;
      for (let frame = 1; frame <= grabContactFrame(GrabAction.throwUp); frame++) testGrabFrame(world, [input, other], false);
      assertEquals(owner.grab.target, undefined);
      assertEquals(owner.grab.action, GrabAction.throwUp);
    }
    owner.motion.x = 921.0;
    advanceFighter(world, 0, 0, input, -240.0);
    assertEquals(owner.status.out, true);
    assertEquals(owner.grab.action, GrabAction.none);
    assertEquals(owner.grab.frame, 0);
    assertEquals(owner.grab.target, undefined);
    assertEquals(target.grab.owner, undefined);
    assertEquals(target.grab.grabbedFrames, 0);
  }
});
