// Authored hurt volumes: poses follow the attack frame and facing, intangible
// parts pass strikes, invincible parts spend them, and kits carry their
// bodies through rollback.
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { stateChecksum } from "../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { createFighter } from "./fighter";
import { BLADEMASTER_MOVES } from "./heroes/blademasterMoves";
import { heroHurtPose } from "./heroMoves";
import { type FighterHurtboxes, HurtState, fighterHurtParts, hurtPart } from "./hurtboxes";
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
    return `${target.status.damage} ${attacker.attack.hit}`;
  };
  assertTrue(!outcome(1).startsWith("0 "));
  assertEquals(outcome(4), "0 false");
  assertEquals(outcome(7), "0 true");
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
