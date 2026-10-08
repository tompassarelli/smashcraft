import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, ContactKind, DownState, GrabAction } from "../sim/codes";
import { queueDamageContact } from "../sim/contacts";
import { type Fighter, createFighter } from "../sim/fighter";
import { resolveAttacks } from "../sim/attacks";
import { resolveGrabs } from "../sim/grabs";
import { resolveLedges } from "../sim/ledge";
import { GRAB_HOLD_MINIMUM_FRAMES, attackStartupFrames, grabContactFrame } from "../sim/moves";
import { neutralControls } from "../sim/roster";
import { surfaceLeft, surfaceZ } from "../sim/stage";
import { respawnFighter } from "../sim/stocks";
import { advanceSolo, contactBatch, hitEffect, testBeginAttacks, testGrabFrame, testWorld } from "../sim/testWorld";
import {
  ImpactLanding, JumpCue, type ImpactEvents, captureImpactEventsBefore, consumeImpactFrame, createImpactEvents,
  createImpactPresentationCursor, finishImpactEventsAfter, resetImpactPresentationCursor,
} from "./impactEvents";

/** One journaled frame: the change runs between the before and after halves. */
function journal(events: ImpactEvents, fighter: Readonly<Fighter>, change: () => void = () => {}): void {
  captureImpactEventsBefore(events, fighter);
  change();
  finishImpactEventsAfter(events, fighter);
}

test("impact cues tell a tech, a missed tech and an ordinary landing apart [spec docs/design/melee/hit-effects.md]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const events = createImpactEvents();
  for (const state of [DownState.tech, DownState.techRoll]) {
    fighter.down.state = DownState.tumble;
    journal(events, fighter, () => { fighter.down.state = state; });
    assertEquals(events.landing, ImpactLanding.tech);
    journal(events, fighter, () => { fighter.down.frame++; });
    assertEquals(events.landing, ImpactLanding.none);
  }
  fighter.down.state = DownState.tumble;
  journal(events, fighter, () => { fighter.down.state = DownState.bound; });
  assertEquals(events.landing, ImpactLanding.missedTech);
  journal(events, fighter, () => { fighter.down.state = DownState.wait; });
  assertEquals(events.landing, ImpactLanding.none);
  journal(events, fighter, () => {
    fighter.down.state = DownState.none;
    fighter.motion.grounded = true;
  });
  assertEquals(events.landing, ImpactLanding.none);
});

test("a hit flash does not repeat through hitlag or on a KO [spec docs/design/melee/hit-effects.md]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const attacker = createFighter(Character.rifleman, -100.0, 1);
  const world = testWorld(attacker, fighter);
  const events = createImpactEvents();
  journal(events, fighter, () => contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(7.0, 100.0, 20.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined)));
  assertTrue(events.hit);
  journal(events, fighter, () => { fighter.launch.hitlag--; });
  assertFalse(events.hit);
  journal(events, fighter, () => {
    fighter.status.damage = 0.0;
    fighter.status.out = true;
  });
  assertFalse(events.hit);
});

test("contact cues tell ordinary, electric and blocked hits apart [spec docs/design/melee/hit-effects.md]", () => {
  for (let mode = 0; mode <= 2; mode++) {
    const attacker = createFighter(Character.rifleman, -100.0, 1);
    const fighter = createFighter(Character.rifleman, 0.0, -1);
    const world = testWorld(attacker, fighter);
    const events = createImpactEvents();
    fighter.shield.raised = mode === 2;
    journal(events, fighter, () => contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(7.0, 100.0, 20.0, 1.0, 0.0, mode > 0), 1, ContactKind.launch, true, undefined)));
    assertEquals(events.hit, mode !== 2);
    assertEquals(events.electric, mode === 1);
    assertEquals(events.shieldHit, mode === 2);
    journal(events, fighter);
    assertFalse(events.hit);
    assertFalse(events.shieldHit);
  }
});

test("a presented impact frame cannot play twice [spec docs/design/melee/hit-effects.md]", () => {
  const cursor = createImpactPresentationCursor();
  assertTrue(consumeImpactFrame(cursor, 42));
  assertFalse(consumeImpactFrame(cursor, 42));
  assertFalse(consumeImpactFrame(cursor, 40));
  assertTrue(consumeImpactFrame(cursor, 43));
  resetImpactPresentationCursor(cursor);
  assertTrue(consumeImpactFrame(cursor, 1));
});

test("a shield reaction restarts only on a new contact [spec docs/design/melee/hit-effects.md]", () => {
  const fighter = createFighter(Character.demonHunter, 0.0, 1);
  const events = createImpactEvents();
  fighter.shield.raised = true;
  journal(events, fighter, () => { fighter.shield.energy = f32(fighter.shield.energy - f32(0.1)); });
  assertFalse(events.shieldHit);
  journal(events, fighter, () => {
    fighter.visuals.shield++;
    fighter.shield.energy -= 5.0;
    fighter.shield.stun = 10;
    fighter.launch.hitlag = 5;
  });
  assertTrue(events.shieldHit);
  for (let tick = 1; tick <= 4; tick++) {
    journal(events, fighter, () => { fighter.launch.hitlag--; });
    assertFalse(events.shieldHit);
  }
  journal(events, fighter, () => {
    fighter.visuals.shield++;
    fighter.shield.energy -= 3.0;
    fighter.launch.hitlag = 4;
  });
  assertTrue(events.shieldHit);
});

test("a grab cue needs an accepted capture and a throw cue the release contact [spec docs/design/melee/hit-effects.md]", () => {
  for (let rejected = 0; rejected <= 1; rejected++) {
    const owner = createFighter(Character.rifleman, 0.0, 1);
    const target = createFighter(Character.rifleman, 90.0, -1);
    const world = testWorld(owner, target);
    const ownerInput = neutralControls();
    const controls = [ownerInput, neutralControls()];
    const events = createImpactEvents();
    owner.motion.surface = 0;
    target.motion.surface = 0;
    target.status.invincible = rejected;
    testBeginAttacks(world, AttackStyle.grab, undefined);
    owner.attack.frame = attackStartupFrames(AttackStyle.grab);
    journal(events, target, () => {
      resolveAttacks(world);
      resolveGrabs(world);
    });
    assertEquals(events.grab, rejected === 0);
    assertFalse(events.throwRelease);
    if (rejected === 1) continue;
    journal(events, target, () => testGrabFrame(world, controls, false));
    assertFalse(events.grab);
    ownerInput.grabThrowX = 1;
    testGrabFrame(world, controls, false);
    ownerInput.grabThrowX = 0;
    for (let frame = 2; frame <= grabContactFrame(GrabAction.throwForward); frame++) {
      journal(events, target, () => testGrabFrame(world, controls, true));
      assertFalse(events.throwRelease);
      journal(events, target, () => testGrabFrame(world, controls, false));
      assertEquals(events.throwRelease, frame === grabContactFrame(GrabAction.throwForward));
      assertFalse(events.grab);
    }
    journal(events, target, () => testGrabFrame(world, controls, false));
    assertFalse(events.throwRelease);
  }
});

test("a grab escape and an interrupted throw raise no release cue [spec docs/design/melee/hit-effects.md]", () => {
  for (let interrupted = 0; interrupted <= 1; interrupted++) {
    const owner = createFighter(Character.rifleman, 0.0, 1);
    const target = createFighter(Character.rifleman, 90.0, -1);
    const world = testWorld(owner, target);
    const ownerInput = neutralControls();
    const controls = [ownerInput, neutralControls()];
    const events = createImpactEvents();
    testBeginAttacks(world, AttackStyle.grab, undefined);
    owner.attack.frame = attackStartupFrames(AttackStyle.grab);
    resolveAttacks(world);
    resolveGrabs(world);
    if (interrupted === 1) {
      ownerInput.grabThrowZ = 1;
      testGrabFrame(world, controls, false);
    } else {
      target.grab.grabbedFrames = 1;
      target.grab.heldFrames = GRAB_HOLD_MINIMUM_FRAMES;
    }
    journal(events, target, () => {
      if (interrupted === 1) respawnFighter(world, 0, 0.0);
      else testGrabFrame(world, controls, false);
    });
    assertEquals(target.grab.owner, undefined);
    assertFalse(events.throwRelease);
    assertFalse(events.grab);
  }
});

test("ledge cues follow an accepted catch and its options, at the actual lip [spec docs/design/melee/hit-effects.md]", () => {
  for (let option = 0; option <= 4; option++) {
    const fighter = createFighter(Character.rifleman, -620.0, 1);
    const other = createFighter(Character.rifleman, 0.0, 1);
    const input = neutralControls();
    const controls = [input, neutralControls()];
    const world = testWorld(fighter, other);
    const events = createImpactEvents();
    fighter.motion.grounded = false;
    fighter.motion.z = -80.0;
    fighter.motion.vz = -2.0;
    fighter.motion.deltaZ = -2.0;
    input.down = true;
    journal(events, fighter, () => resolveLedges(world, 0, controls));
    assertFalse(events.ledgeCatch);
    input.down = false;
    journal(events, fighter, () => resolveLedges(world, 0, controls));
    assertTrue(events.ledgeCatch);
    assertEquals(events.ledgeX, surfaceLeft(0, 0, 0));
    assertEquals(events.ledgeZ, surfaceZ(0, 0, 0));
    journal(events, fighter, () => advanceSolo(fighter, 0, input, 0.0));
    assertFalse(events.ledgeCatch);
    assertFalse(events.ledgeRecovery);
    input.jumpPressed = option === 0;
    input.ledgeVerticalPressed = option === 1 ? 1 : option === 4 ? -1 : 0;
    input.airDodgePressed = option === 2;
    input.getupAttackPressed = option === 3;
    journal(events, fighter, () => advanceSolo(fighter, 0, input, 0.0));
    assertEquals(events.ledgeRecovery, option !== 4);
    assertEquals(events.jump, JumpCue.none);
    if (option !== 4) {
      assertEquals(events.ledgeX, surfaceLeft(0, 0, 0));
      assertEquals(events.ledgeZ, surfaceZ(0, 0, 0));
    }
    journal(events, fighter);
    assertFalse(events.ledgeRecovery);
    assertFalse(events.ledgeCatch);
  }
});
