import { stageBounds } from "./stageBounds";
// Grab links: what releases them, mash-out and stock loss.
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { HERO_ROSTER } from "./heroes/registry";
import { AttackStyle, Character, ContactKind, GrabAction, ProjectileKind } from "./codes";
import { queueDamageContact } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import { resolveGrabs } from "./grabs";
import { GRAB_HOLD_FRAMES, GRAB_HOLD_MINIMUM_FRAMES, PUMMEL_CONTACT_FRAME, PUMMEL_DAMAGE, PUMMEL_TOTAL_FRAMES, attackStartupFrames, grabContactFrame } from "./moves";
import { updateProjectiles } from "./projectiles";
import type { Controls, Roster } from "./roster";
import { advanceFighter } from "./step";
import { respawnFighter } from "./stocks";
import { advanceFreezeTraps } from "./summons";
import { contactBatch, controls, hitEffect, testBeginAttacks, testGrabFrame, testWorld } from "./testWorld";
import { MASH_FRAMES } from "./mash";

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
    for (const kind of [ProjectileKind.blaster, ProjectileKind.arrow, ProjectileKind.homingArrow, ProjectileKind.recoil]) {
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
      if (kind === ProjectileKind.arrow || kind === ProjectileKind.homingArrow) {
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
  assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES);
  const held = controls();
  const mash = controls({ grabMashPressed: true, direction: 1, verticalDirection: 1 });
  testGrabFrame(world, [held, mash], false);
  assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES - 1 - 2 * MASH_FRAMES);
  mash.grabMashPressed = false;
  mash.direction = 0;
  mash.verticalDirection = 0;
  testGrabFrame(world, [held, mash], false);
  assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES - 2 - 2 * MASH_FRAMES);
  mash.direction = 1;
  mash.verticalDirection = 1;
  testGrabFrame(world, [held, mash], false);
  assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES - 3 - 2 * MASH_FRAMES);
  mash.direction = -1;
  mash.verticalDirection = -1;
  testGrabFrame(world, [held, mash], false);
  assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES - 4 - 3 * MASH_FRAMES);
});

// ------------------------------------------------------------------ legible holds (#101)

const GRABBERS = [Character.archer, Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)];

type Mash = "none" | "slow" | "human" | "quick" | "fastest";

/**
 * The victim's input on held frame `frame` (one-based): "human" presses the
 * button 8 times a second from the catch, "slow" 6 and "quick" 10; "fastest" presses every other frame
 * and flips the stick every frame.
 */
function mashInput(mash: Mash, frame: number): Controls {
  if (mash === "none") return controls();
  if (mash === "human" || mash === "quick" || mash === "slow") {
    const rate = mash === "human" ? 8 : mash === "quick" ? 10 : 6;
    return controls({ grabMashPressed: floorDiv(frame * rate, 60) !== floorDiv((frame - 1) * rate, 60) || frame === 1 });
  }
  return controls({ grabMashPressed: floorMod(frame, 2) === 1, direction: floorMod(frame, 2) === 1 ? 1 : -1 });
}

/** `character` grabs a Rifleman at `percent`: the real catch, through the grabber's own grab timing. */
function heldBy(character: Character, percent: number): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, 50.0, -1);
  target.status.damage = percent;
  const world = testWorld(owner, target);
  owner.motion.surface = 0;
  target.motion.surface = 0;
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  owner.attack.frame = attackStartupFrames(AttackStyle.grab, owner.tuning.moves);
  resolveAttacks(world);
  resolveGrabs(world);
  assertEquals(owner.grab.target, 1, `${character} catches`);
  assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES);
  return { world, owner, target };
}

/** The held frame each mash frees the victim on from a 120-frame hold. */
const MASH_ESCAPE = { none: GRAB_HOLD_FRAMES, slow: 64, human: 56, quick: 48, fastest: GRAB_HOLD_MINIMUM_FRAMES };

/** Runs held frames until the victim is free; the frame it went free on, or undefined. */
function holdUntilFree(world: Roster, target: Fighter, mash: Mash, owner: (frame: number) => Controls, frames = GRAB_HOLD_FRAMES + 30): number | undefined {
  for (let frame = 1; frame <= frames; frame++) {
    testGrabFrame(world, [owner(frame), mashInput(mash, frame)], false);
    if (target.grab.owner === undefined) return frame;
  }
  return undefined;
}

test("every grab holds the same time at any percent, and mashing shortens it within its bounds", () => {
  const freedOn: string[] = [];
  for (const character of GRABBERS) {
    for (const percent of [0.0, 150.0]) {
      for (const mash of ["none", "slow", "human", "quick", "fastest"] as const) {
        const { world, owner, target } = heldBy(character, percent);
        const frame = holdUntilFree(world, target, mash, () => controls());
        const label = `${character} at ${percent}% with ${mash} mashing`;
        assertEquals(frame, MASH_ESCAPE[mash], label);
        assertEquals(owner.grab.action, GrabAction.escape, label);
        assertEquals(target.status.damage, percent, label);
        freedOn.push(`${frame}`);
      }
    }
  }
  assertEquals(freedOn.length, GRABBERS.length * 10);
});


test("a victim mashing 8 or more times a second escapes the pummel; 6 a second or caught off guard takes it", () => {
  assertTrue(MASH_ESCAPE.human < PUMMEL_CONTACT_FRAME);
  assertTrue(MASH_ESCAPE.slow > PUMMEL_CONTACT_FRAME);
  for (const character of GRABBERS) {
    for (const percent of [0.0, 150.0]) {
      for (const mash of ["none", "slow", "human", "quick", "fastest"] as const) {
        const { world, owner, target } = heldBy(character, percent);
        const pummel = owner.tuning.moves?.throws[GrabAction.pummel]?.effect.damage ?? PUMMEL_DAMAGE;
        const expectedPummel = character === Character.blademaster ? 2.865000009536743
          : character === Character.mountainKing ? 3.31499981880188
            : character === Character.dreadlord ? 2.7150001525878906
              : character === Character.beastmaster ? 2.861999750137329 : PUMMEL_DAMAGE;
        assertEquals(pummel, expectedPummel, `${character} pummels for its authored damage`);
        // The grabber pummels on the first held frame and keeps pressing attack.
        const frame = holdUntilFree(world, target, mash, () => controls({ attackPressed: true }));
        const label = `${character} at ${percent}% with ${mash} mashing`;
        assertEquals(owner.grab.pummels, 1, label);
        if (mash === "none" || mash === "slow") {
          const damage = character === Character.forsakenPaladin ? f32(pummel * f32(0.8)) : pummel;
          assertEquals(target.status.damage, f32(percent + damage), label);
          // No throw input: the pummel's end lets the victim go.
          assertEquals(frame, mash === "none" ? PUMMEL_TOTAL_FRAMES + 1 : MASH_ESCAPE.slow, label);
        } else {
          assertEquals(target.status.damage, percent, label);
          assertEquals(frame !== undefined && frame < PUMMEL_CONTACT_FRAME, true, label);
        }
        assertEquals(owner.grab.action, GrabAction.escape, label);
        assertEquals(target.launch.throwHitstun, false, label);
      }
    }
  }
});

test("a throw pressed during the pummel starts when it ends; a prompt throw always starts", () => {
  for (const character of GRABBERS) {
    const buffered = heldBy(character, 150.0);
    for (let frame = 1; frame <= PUMMEL_TOTAL_FRAMES; frame++) {
      testGrabFrame(buffered.world, [controls({ attackPressed: frame === 1, grabThrowX: frame === 20 ? 1 : 0 }), controls()], false);
      assertEquals(buffered.owner.grab.action, GrabAction.pummel, `${character} pummel frame ${frame}`);
    }
    testGrabFrame(buffered.world, [controls(), controls()], false);
    assertEquals(buffered.owner.grab.action, GrabAction.throwForward, `${character} buffered throw`);
    // A second pummel is refused: with no throw it is the hold's end.
    const refused = heldBy(character, 0.0);
    for (let frame = 1; frame <= PUMMEL_TOTAL_FRAMES + 1; frame++) testGrabFrame(refused.world, [controls({ attackPressed: true }), controls()], false);
    assertEquals(refused.target.grab.owner, undefined, `${character} one pummel`);
    // Against the fastest mashing, a throw input on the last frame before the
    // shortest hold ends still throws.
    for (const percent of [0.0, 150.0]) {
      const { world, owner, target } = heldBy(character, percent);
      const throwFrame = GRAB_HOLD_MINIMUM_FRAMES - 1;
      for (let frame = 1; frame <= throwFrame; frame++) {
        testGrabFrame(world, [controls({ grabThrowZ: frame === throwFrame ? 1 : 0 }), mashInput("fastest", frame)], false);
      }
      assertEquals(owner.grab.action, GrabAction.throwUp, `${character} at ${percent}% prompt throw`);
      for (let frame = 2; frame <= grabContactFrame(GrabAction.throwUp, owner.tuning.moves); frame++) {
        testGrabFrame(world, [controls(), mashInput("fastest", throwFrame + frame)], false);
      }
      assertEquals(target.grab.owner, undefined);
      assertEquals(target.launch.throwHitstun, true, `${character} at ${percent}% thrown`);
    }
  }
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
    owner.motion.x = (stageBounds(0).blast.right + 1.0);
    advanceFighter(world, 0, 0, input, -240.0);
    assertEquals(owner.status.out, true);
    assertEquals(owner.grab.action, GrabAction.none);
    assertEquals(owner.grab.frame, 0);
    assertEquals(owner.grab.target, undefined);
    assertEquals(target.grab.owner, undefined);
    assertEquals(target.grab.grabbedFrames, 0);
  }
});

test("throw hitstun blocks standing and dash regrabs until it ends", () => {
  for (const dash of [false, true]) {
    const { world, owner, target } = grabbedPair();
    const input = controls({ grabThrowZ: 1 });
    for (let frame = 1; frame <= grabContactFrame(GrabAction.throwUp); frame++) testGrabFrame(world, [input, controls()], false);
    assertGreaterThan(target.launch.hitstun, 0);
    assertEquals(target.launch.throwHitstun, true);
    owner.grab.action = GrabAction.none;
    owner.grab.frame = 0;
    target.motion.x = 90.0;
    target.motion.z = 65.0;
    testBeginAttacks(world, AttackStyle.grab, undefined);
    owner.attack.dashGrab = dash;
    owner.attack.frame = dash ? owner.tuning.dashGrab.startupFrames : attackStartupFrames(AttackStyle.grab);
    resolveAttacks(world);
    assertEquals(target.grab.owner, undefined);
    // The same grab contact is eligible once the throw's hitstun ends.
    target.launch.hitstun = 1;
    advanceFighter(world, 1, 0, controls(), 240.0);
    assertEquals(target.launch.throwHitstun, false);
    target.motion.x = 90.0;
    target.motion.z = 65.0;
    resolveAttacks(world);
    assertEquals(target.grab.owner, 0, dash ? "dash regrab" : "standing regrab");
  }
});

test("throw follow-up attacks replace throw hitstun and permit attack-to-grab reads", () => {
  for (const kind of [ContactKind.launch, ContactKind.flinch, ContactKind.damageOnly]) {
    const { world, owner, target } = grabbedPair();
    const input = controls({ grabThrowZ: 1 });
    for (let frame = 1; frame <= grabContactFrame(GrabAction.throwUp); frame++) testGrabFrame(world, [input, controls()], false);
    const damage = target.status.damage;
    contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(5.0, 100.0, 18.0, 0.0, 1.0), 1, kind, false, undefined));
    assertEquals(target.status.damage, f32(damage + 5.0));
    assertGreaterThan(target.launch.hitstun, 0);
    assertEquals(target.launch.throwHitstun, kind === ContactKind.damageOnly);
    owner.grab.action = GrabAction.none;
    owner.grab.frame = 0;
    target.motion.x = 90.0;
    target.motion.z = 65.0;
    testBeginAttacks(world, AttackStyle.grab, undefined);
    owner.attack.frame = attackStartupFrames(AttackStyle.grab);
    resolveAttacks(world);
    assertEquals(target.grab.owner, kind === ContactKind.damageOnly ? undefined : 0);
  }
});

test("a gentle throw landing retains the remaining throw hitstun", () => {
  const { world, owner, target } = grabbedPair();
  target.status.damage = 20.0;
  const input = controls({ grabThrowZ: 1 });
  for (let frame = 1; frame <= grabContactFrame(GrabAction.throwUp); frame++) testGrabFrame(world, [input, controls()], false);
  for (let frame = 0; frame < 120 && !target.motion.grounded; frame++) advanceFighter(world, 1, 0, controls(), 240.0);
  assertEquals(target.motion.grounded, true);
  assertGreaterThan(target.launch.hitstun, 0);
  assertEquals(target.launch.throwHitstun, true);
  assertGreaterThan(target.landing.lag, 0);
  owner.grab.action = GrabAction.none;
  owner.grab.frame = 0;
  target.motion.x = 90.0;
  testBeginAttacks(world, AttackStyle.grab, undefined);
  owner.attack.frame = attackStartupFrames(AttackStyle.grab);
  resolveAttacks(world);
  assertEquals(target.grab.owner, undefined);
});
