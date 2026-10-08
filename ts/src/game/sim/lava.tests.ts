import { assertEquals, assertFalse, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, ItemKind } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import { createFighter } from "./fighter";
import { applyAttackHit } from "./hits";
import { collectLavaContacts, LAVA_HIT, LAVA_INNER_X } from "./lava";
import { queueAttack } from "../input/attackBuffer";
import { CANNON_TEST_STAGE, STRATHOLME_STAGE, mainDeckZAt } from "./stage";
import { testWorld } from "./testWorld";
import { firstFighterDifference, firstStateDifference } from "../replay/difference";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { stateChecksum } from "../replay/canonical";
import { Phase } from "../match/rules";
import { stepMatch } from "../match/step";
import { fighterAt } from "./roster";

function lavaWorld() {
  return testWorld(createFighter(Character.archer, 510.0, -1), createFighter(Character.rifleman, 0.0, 1));
}

test("lava produces the same complete victim as an ordinary scripted fire hit [spec docs/stage-hazards.md] [invariant]", () => {
  for (const damage of [0.0, 80.0, 250.0]) {
    const lava = lavaWorld(); const scripted = lavaWorld();
    const first = fighterAt(lava, 0); const second = fighterAt(scripted, 0);
    first.status.damage = damage; second.status.damage = damage;
    beginDamageContacts(); collectLavaContacts(lava, CANNON_TEST_STAGE, true); finishDamageContacts(lava);
    beginDamageContacts(); applyAttackHit(scripted, 1, 0, AttackStyle.jab, 1, LAVA_HIT, false, false, undefined); finishDamageContacts(scripted);
    assertEquals(firstFighterDifference(first, second, 3, 3), undefined);
    assertEquals(first.status.damage, damage + 12.0);
    assertFalse(first.motion.grounded);
    assertGreaterThan(first.launch.knockbackZ, 0.0);
    assertEquals(first.launch.hitstun, 40);
  }
});

test("lava is confined to Blackrock's molten ends and respects hazards off and invincibility [spec docs/stage-hazards.md]", () => {
  for (const scenario of [0, 1, 2, 3, 4, 5]) {
    const world = lavaWorld(); const fighter = fighterAt(world, 0);
    if (scenario === 2) fighter.motion.x = LAVA_INNER_X - 1.0;
    if (scenario === 3) fighter.motion.x = 601.0;
    if (scenario === 4) fighter.motion.z = 1.0;
    if (scenario === 5) fighter.status.invincible = 1;
    beginDamageContacts(); collectLavaContacts(world, scenario === 0 ? 0 : CANNON_TEST_STAGE, scenario !== 1); finishDamageContacts(world);
    assertEquals(fighter.status.damage, 0.0);
  }
});

test("a lava launch survives rollback and 180 replayed match frames exactly [invariant]", () => {
  const live = createReplaySnapshot(); const saved = createReplaySnapshot(); const replay = createReplaySnapshot();
  live.match.phase = Phase.match; live.match.stageChoice = CANNON_TEST_STAGE;
  live.match.humanMask = 3; live.match.humanFighterMask = 3; live.match.practice = true;
  fighterAt(live.world, 0).motion.x = 510.0;
  copyReplayState(saved, live);
  for (let frame = 1; frame <= 180; frame++) stepMatch(live.match, live.world, live.controls, frame);
  copyReplayState(replay, saved);
  for (let frame = 1; frame <= 180; frame++) stepMatch(replay.match, replay.world, replay.controls, frame);
  assertEquals(firstStateDifference(live, replay), undefined);
  assertEquals(stateChecksum(live), stateChecksum(replay));
  assertGreaterThan(fighterAt(live.world, 0).visuals.hit, 0);
});

test("an ordinary attack picks up the centre item on Stratholme's raised floor [spec docs/gameplay-design.md]", () => {
  const state = createReplaySnapshot();
  state.match.phase = Phase.match; state.match.stageChoice = STRATHOLME_STAGE;
  state.match.items.kind = ItemKind.speed;
  const fighter = fighterAt(state.world, 0);
  fighter.motion.x = 0.0; fighter.motion.z = mainDeckZAt(STRATHOLME_STAGE, 0.0); fighter.motion.surface = 0;
  fighterAt(state.world, 1).motion.x = 300.0;
  queueAttack(state.controls.commands[0], { style: AttackStyle.jab, facing: 1, frame: 1, mayCharge: false });
  stepMatch(state.match, state.world, state.controls, 1);
  assertEquals(state.match.items.kind, ItemKind.none);
  assertEquals(state.match.items.lastTaker, 0);
  assertEquals(fighter.status.buff, ItemKind.speed);
  assertGreaterThan(fighter.status.buffFrames, 0);
});
