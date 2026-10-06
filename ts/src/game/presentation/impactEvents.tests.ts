import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, ContactKind, DownState, GrabAction, SurfaceContact } from "../sim/codes";
import { queueDamageContact } from "../sim/contacts";
import { type Fighter, createFighter } from "../sim/fighter";
import { resolveAttacks } from "../sim/attacks";
import { resolveGrabs } from "../sim/grabs";
import { resolveLedges } from "../sim/ledge";
import { SMASH_MAX_CHARGE_FRAMES, attackStartupFrames, grabContactFrame } from "../sim/moves";
import { neutralControls } from "../sim/roster";
import { surfaceLeft, surfaceZ } from "../sim/stage";
import { respawnFighter } from "../sim/stocks";
import { advanceSolo, contactBatch, hitEffect, testBeginAttacks, testGrabFrame, testWorld } from "../sim/testWorld";
import {
  DodgeCue, ImpactLanding, JumpCue, type ImpactEvents, captureImpactEventsBefore, consumeImpactFrame, createImpactEvents,
  createImpactPresentationCursor, finishImpactEventsAfter, resetImpactPresentationCursor,
} from "./impactEvents";

/** One journaled frame: the change runs between the before and after halves. */
function journal(events: ImpactEvents, fighter: Readonly<Fighter>, change: () => void = () => {}): void {
  captureImpactEventsBefore(events, fighter);
  change();
  finishImpactEventsAfter(events, fighter);
}

test("impact cues tell a tech, a missed tech and an ordinary landing apart", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
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

test("a hit flash does not repeat through hitlag or on a KO", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
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

test("contact cues tell ordinary, electric and blocked hits apart", () => {
  for (let mode = 0; mode <= 2; mode++) {
    const attacker = createFighter(Character.archer, -100.0, 1);
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

test("the hit cue follows the strongest contact, not the last contact or the damage", () => {
  const attacker = createFighter(Character.archer, -100.0, 1);
  const fighter = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(attacker, fighter);
  const events = createImpactEvents();
  journal(events, fighter, () => contactBatch(world, () => {
    queueDamageContact(world, 0, 1, hitEffect(7.0, 100.0, 100.0, 1.0, 0.0, true), 1, ContactKind.launch, true, undefined);
    queueDamageContact(world, 0, 1, hitEffect(20.0, 0.0, 1.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined);
  }));
  assertTrue(events.hit);
  assertTrue(events.electric);
  journal(events, fighter, () => { fighter.status.damage += 1.0; });
  assertFalse(events.hit);
});

test("a damage-only contact still raises one hit cue without hitstun", () => {
  const attacker = createFighter(Character.archer, -100.0, 1);
  const fighter = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(attacker, fighter);
  const events = createImpactEvents();
  journal(events, fighter, () => contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(3.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.damageOnly, false, undefined)));
  assertTrue(events.hit);
  assertEquals(fighter.launch.hitstun, 0);
});

test("a presented impact frame cannot play twice", () => {
  const cursor = createImpactPresentationCursor();
  assertTrue(consumeImpactFrame(cursor, 42));
  assertFalse(consumeImpactFrame(cursor, 42));
  assertFalse(consumeImpactFrame(cursor, 40));
  assertTrue(consumeImpactFrame(cursor, 43));
  resetImpactPresentationCursor(cursor);
  assertTrue(consumeImpactFrame(cursor, 1));
});

test("a solid surface contact publishes its position and inward normal once", () => {
  const fighter = createFighter(Character.archer, -240.0, 1);
  const events = createImpactEvents();
  journal(events, fighter, () => {
    const contact = fighter.surfaceRecovery;
    contact.contactSerial++;
    contact.contactKind = SurfaceContact.wall;
    contact.contactX = -240.0;
    contact.contactZ = 72.0;
    contact.contactNormalX = 1.0;
    contact.contactNormalZ = 0.0;
  });
  assertEquals(events.surface, SurfaceContact.wall);
  assertEquals(events.contactX, -240.0);
  assertEquals(events.contactZ, 72.0);
  assertEquals(events.normalX, 1.0);
  assertEquals(events.normalZ, 0.0);
  journal(events, fighter);
  assertEquals(events.surface, SurfaceContact.none);
});

test("dodge dust appears on entry and keeps the roll direction", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const events = createImpactEvents();
  for (let direction = -1; direction <= 1; direction++) {
    fighter.dodge.groundFrame = 0;
    journal(events, fighter, () => {
      fighter.dodge.groundFrame = 1;
      fighter.dodge.groundDirection = direction;
    });
    assertEquals(events.dodge, direction === 0 ? DodgeCue.spot : DodgeCue.roll);
    assertEquals(events.direction, direction);
    journal(events, fighter, () => { fighter.dodge.groundFrame++; });
    assertEquals(events.dodge, DodgeCue.none);
  }
  fighter.dodge.groundFrame = 0;
  fighter.down.state = DownState.tumble;
  journal(events, fighter, () => {
    fighter.down.state = DownState.techRoll;
    fighter.down.direction = -1;
  });
  assertEquals(events.landing, ImpactLanding.tech);
  assertEquals(events.dodge, DodgeCue.roll);
  assertEquals(events.direction, -1);
});

test("a shield reaction restarts only on a new contact", () => {
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

test("a grab cue needs an accepted capture and a throw cue the release contact", () => {
  for (let rejected = 0; rejected <= 1; rejected++) {
    const owner = createFighter(Character.archer, 0.0, 1);
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

test("a grab escape and an interrupted throw raise no release cue", () => {
  for (let interrupted = 0; interrupted <= 1; interrupted++) {
    const owner = createFighter(Character.archer, 0.0, 1);
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
    } else target.grab.grabbedFrames = 1;
    journal(events, target, () => {
      if (interrupted === 1) respawnFighter(world, 0, 0.0);
      else testGrabFrame(world, controls, false);
    });
    assertEquals(target.grab.owner, undefined);
    assertFalse(events.throwRelease);
    assertFalse(events.grab);
  }
});

test("charge cues follow the charge's entry and full charge, not hitlag", () => {
  for (const mayCharge of [false, true]) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    const other = createFighter(Character.rifleman, 300.0, -1);
    const input = neutralControls();
    const events = createImpactEvents();
    const step = () => journal(events, fighter, () => advanceSolo(fighter, 0, input, 0.0));
    fighter.motion.surface = 0;
    input.attackHeld = true;
    testBeginAttacks(testWorld(fighter, other), AttackStyle.upSmash, undefined, mayCharge);
    for (let tick = 1; tick <= attackStartupFrames(AttackStyle.upSmash); tick++) {
      step();
      assertEquals(events.charge, mayCharge && tick === attackStartupFrames(AttackStyle.upSmash));
      assertFalse(events.ready);
    }
    if (!mayCharge) continue;
    fighter.launch.hitlag = 2;
    step();
    assertFalse(events.charge);
    assertFalse(events.ready);
    assertEquals(fighter.attack.smashChargeFrames, 1);
    for (let tick = 2; tick <= SMASH_MAX_CHARGE_FRAMES; tick++) {
      step();
      assertFalse(events.charge);
      assertEquals(events.ready, tick === SMASH_MAX_CHARGE_FRAMES);
    }
    step();
    assertFalse(events.ready);
    assertFalse(events.charge);
  }
});

test("ledge cues follow an accepted catch and its options, at the actual lip", () => {
  for (let option = 0; option <= 4; option++) {
    const fighter = createFighter(Character.archer, -620.0, 1);
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
