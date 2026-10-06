// Authored hurt volumes: poses follow the attack frame and facing, intangible
// parts pass strikes, invincible parts spend them, and kits carry their
// bodies through rollback.
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { stateChecksum } from "../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../physics/contactGeometry";
import { attackStartupFrames, characterAttackActiveFrames } from "./moves";
import { BLADEMASTER_MOVES } from "./heroes/blademasterMoves";
import { heroHurtPose } from "./heroMoves";
import { type FighterHurtboxes, HurtContact, HurtState, fighterHurtParts, hurtPart, strikeHurtContact } from "./hurtboxes";
import { fighterAt } from "./roster";
import { testBeginAttacks, testWorld } from "./testWorld";

const KIT_BODY: FighterHurtboxes = {
  stand: [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0)],
  attacks: {
    [AttackStyle.jab]: [
      heroHurtPose(1, 3, [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0), hurtPart(10.0, 60.0, 90.0, 60.0, 10.0)]),
      heroHurtPose(4, 6, [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0, HurtState.intangible)]),
      heroHurtPose(7, 9, [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0, HurtState.invincible)]),
    ],
  },
};

test("a kit's authored body follows its attack frame and its facing decides the extended limb's side", () => {
  const f = createFighter(Character.archer, 0.0, -1);
  f.tuning.moves = { ...BLADEMASTER_MOVES, hurtboxes: KIT_BODY };
  assertEquals(fighterHurtParts(f), KIT_BODY.stand);
  f.attack.style = AttackStyle.jab;
  f.attack.frame = 1;
  assertEquals(fighterHurtParts(f).length, 2);
  f.attack.frame = 4;
  assertEquals(fighterHurtParts(f)[0]?.state, HurtState.intangible);
  f.attack.frame = 20;
  assertEquals(fighterHurtParts(f), KIT_BODY.stand);
  // An extended limb behind a left-facing fighter is out of reach; in front of it, a strike lands.
  const strike = (targetX: number, facing: number): number => {
    const attacker = createFighter(Character.rifleman, 0.0, 1);
    const target = createFighter(Character.archer, targetX, facing);
    target.tuning.moves = { ...BLADEMASTER_MOVES, hurtboxes: KIT_BODY };
    testBeginAttacks(testWorld(attacker, target), AttackStyle.jab, undefined);
    attacker.attack.frame = 4;
    target.attack.style = AttackStyle.jab;
    target.attack.frame = 1;
    resolveAttacks(testWorld(attacker, target));
    return target.status.damage;
  };
  assertTrue(strike(160.0, -1) > 0.0);
  assertEquals(strike(160.0, 1), 0.0);
});

test("intangible parts pass a strike and invincible parts spend it without damage", () => {
  const outcome = (frame: number) => {
    const attacker = createFighter(Character.rifleman, 0.0, 1);
    const target = createFighter(Character.archer, 60.0, -1);
    target.tuning.moves = { ...BLADEMASTER_MOVES, hurtboxes: KIT_BODY };
    const world = testWorld(attacker, target);
    testBeginAttacks(world, AttackStyle.jab, undefined);
    attacker.attack.frame = 4;
    target.attack.style = AttackStyle.jab;
    target.attack.frame = frame;
    resolveAttacks(world);
    return `${target.status.damage > 0.0 ? "hit" : "unhurt"} ${attacker.attack.hit ? "spent" : "free"}`;
  };
  assertEquals(outcome(1), "hit spent");
  assertEquals(outcome(4), "unhurt free");
  assertEquals(outcome(7), "unhurt spent");
});

test("a kit's hurt volumes are part of its rollback record", () => {
  const live = createReplaySnapshot();
  const saved = createReplaySnapshot();
  const f = fighterAt(live.world, 0);
  f.tuning.moves = BLADEMASTER_MOVES;
  const without = stateChecksum(live);
  f.tuning.moves = { ...BLADEMASTER_MOVES, hurtboxes: KIT_BODY };
  const authored = stateChecksum(live);
  assertTrue(authored !== without);
  copyReplayState(saved, live);
  f.tuning.moves = BLADEMASTER_MOVES;
  copyReplayState(live, saved);
  assertEquals(f.tuning.moves.hurtboxes, KIT_BODY);
  assertEquals(stateChecksum(live), authored);
});

const SHIPPED = [Character.archer, Character.rifleman, Character.demonHunter] as const;

/** A two-unit probe strike at a point relative to the fighter, along its facing. */
function probe(f: Fighter, ahead: number, height: number): HurtContact {
  const x = f32(f.motion.x + f32(ahead * f.facing));
  const z = f32(f.motion.z + height);
  return strikeHurtContact({ x1: x, z1: z, x2: x, z2: z, radius: 2.0 }, f);
}

function attackingAt(character: Character, style: AttackStyle, frame: number, facing: number): Fighter {
  const f = createFighter(character, 100.0, facing);
  f.attack.style = style;
  f.attack.frame = frame;
  return f;
}

test("each shipped fighter's body changes across a move's startup, active and recovery frames", () => {
  for (const character of SHIPPED) {
    const style = AttackStyle.forwardSmash;
    const first = attackStartupFrames(style);
    const stand = fighterHurtParts(createFighter(character, 0.0, 1));
    const windup = fighterHurtParts(attackingAt(character, style, 0, 1));
    const active = fighterHurtParts(attackingAt(character, style, first, 1));
    const late = fighterHurtParts(attackingAt(character, style, first + characterAttackActiveFrames(character, style) + 20, 1));
    assertTrue(windup !== stand && active !== windup && active !== stand);
    assertEquals(active.length, 2);
    assertEquals(late, stand);
  }
});

test("each shipped fighter's extended jab arm is hit where its standing body is not, on the side it faces", () => {
  for (const character of SHIPPED) {
    const stand = createFighter(character, 100.0, 1);
    const height = f32(hurtCapsule(character).z2 * f32(0.62));
    assertEquals(probe(stand, 46.0, height), HurtContact.none);
    for (const facing of [1, -1]) {
      const jabbing = attackingAt(character, AttackStyle.jab, attackStartupFrames(AttackStyle.jab), facing);
      assertEquals(probe(jabbing, 46.0, height), HurtContact.hit);
      assertEquals(probe(jabbing, -46.0, height), HurtContact.none);
    }
  }
});

test("every shipped fighter's down-air legs are hit below its feet while they extend", () => {
  const legs = (character: Character, frame: number) => probe(attackingAt(character, AttackStyle.downAir, frame, 1), 0.0, -26.0);
  const active = attackStartupFrames(AttackStyle.downAir);
  for (const character of SHIPPED) {
    assertEquals(legs(character, active), HurtContact.hit);
    assertEquals(legs(character, 0), HurtContact.none);
  }
});

test("every shipped fighter's forward-smash arm is hit", () => {
  const frame = attackStartupFrames(AttackStyle.forwardSmash);
  for (const character of SHIPPED) {
    const f = attackingAt(character, AttackStyle.forwardSmash, frame, -1);
    assertEquals(probe(f, 52.0, f32(hurtCapsule(character).z2 * f32(0.58))), HurtContact.hit);
  }
});

test("a strike that reaches only an extended down-air leg counter-hits it, and a restored snapshot selects the same body", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.archer, 0.0, -1);
  attacker.motion.z = 0.0;
  target.motion.grounded = false;
  target.motion.z = 75.0;
  const world = testWorld(attacker, target);
  testBeginAttacks(world, AttackStyle.jab, undefined);
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  target.attack.style = AttackStyle.downAir;
  target.attack.frame = 0;
  resolveAttacks(world);
  const hitWhileStanding = target.status.damage;
  const fresh = createFighter(Character.archer, 0.0, -1);
  fresh.motion.grounded = false;
  fresh.motion.z = 75.0;
  fresh.attack.style = AttackStyle.downAir;
  fresh.attack.frame = attackStartupFrames(AttackStyle.downAir);
  const second = createFighter(Character.archer, 0.0, 1);
  const legsWorld = testWorld(second, fresh);
  testBeginAttacks(legsWorld, AttackStyle.jab, undefined);
  second.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(legsWorld);
  assertTrue(hitWhileStanding > 0.0);
  assertTrue(fresh.status.damage > 0.0);
  const live = createReplaySnapshot();
  const saved = createReplaySnapshot();
  const f = fighterAt(live.world, 0);
  f.attack.style = AttackStyle.downAir;
  f.attack.frame = attackStartupFrames(AttackStyle.downAir);
  const parts = fighterHurtParts(f);
  copyReplayState(saved, live);
  f.attack.style = undefined;
  copyReplayState(live, saved);
  assertEquals(fighterHurtParts(fighterAt(live.world, 0)), parts);
});
