import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import { createFighter } from "./fighter";
import { applyAttackHit } from "./hits";
import { LAVA_CALM_FRAMES, LAVA_CENTER_X, LAVA_HIT, LAVA_SIDE_FRAMES, LAVA_WARNING_FRAMES, LavaPhase, collectLavaContacts, framesUntilLava, lavaLeft, lavaPhase, lavaRight, lavaSide } from "./lava";
import { CANNON_TEST_STAGE, STAGE_AT_REST, STRATHOLME_STAGE, mainDeckLeft, mainDeckRight } from "./stage";
import { advanceSolo, controls, testWorld } from "./testWorld";
import { firstFighterDifference, firstStateDifference } from "../replay/difference";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { stateChecksum } from "../replay/canonical";
import { Phase } from "../match/rules";
import { stepMatch } from "../match/step";
import { fighterAt } from "./roster";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { INITIAL_DASH_FRAMES } from "./tuning";

const FIRST_ERUPTION = LAVA_CALM_FRAMES + LAVA_WARNING_FRAMES + 1;

function lavaWorld() {
  return testWorld(createFighter(Character.rifleman, LAVA_CENTER_X, -1), createFighter(Character.rifleman, -500.0, 1));
}

test("lava produces the same complete victim as an ordinary scripted fire hit [k3 measure docs/stage-hazards.md]", () => {
  for (const damage of [0.0, 80.0, 250.0]) {
    const lava = lavaWorld(); const scripted = lavaWorld();
    const first = fighterAt(lava, 0); const second = fighterAt(scripted, 0);
    first.status.damage = damage; second.status.damage = damage;
    beginDamageContacts(); collectLavaContacts(lava, CANNON_TEST_STAGE, FIRST_ERUPTION); finishDamageContacts(lava);
    beginDamageContacts(); applyAttackHit(scripted, 0, 0, AttackStyle.jab, 1, LAVA_HIT, false, false, undefined); finishDamageContacts(scripted);
    assertEquals(firstFighterDifference(first, second, 3, 3), undefined);
    assertEquals(first.status.damage, damage + LAVA_HIT.damage);
    assertFalse(first.motion.grounded);
    assertGreaterThan(first.launch.knockbackZ, 0.0);
    assertGreaterThan(first.launch.hitstun, 0);
  }
});

/** How far a fighter travels in one initial dash from a standstill. */
function dashLength(character: Character): number {
  const fighter = createFighter(character, 0.0, 1);
  for (let frame = 0; frame < INITIAL_DASH_FRAMES; frame++) advanceSolo(fighter, 0, controls({ direction: 1 }), 0.0);
  return fighter.motion.x;
}

test("Blackrock's one lava patch stays off the centre and clear of each ledge by more than two of any fighter's initial dashes [k3 measure #193]", () => {
  let longest = 0.0;
  for (const character of SELECTABLE_CHARACTERS) longest = Math.max(longest, dashLength(character));
  assertGreaterThan(longest, 100.0);
  for (const frame of [FIRST_ERUPTION, FIRST_ERUPTION + LAVA_SIDE_FRAMES]) {
    const left = lavaLeft(frame);
    const right = lavaRight(frame);
    assertGreaterThan(Math.min(left - mainDeckLeft(CANNON_TEST_STAGE), mainDeckRight(CANNON_TEST_STAGE) - right), 2 * longest);
    assertTrue(left > 0.0 || right < 0.0);
  }
});

test("a lava launch survives rollback and 180 replayed match frames exactly [k1 scenario]", () => {
  const live = createReplaySnapshot(); const saved = createReplaySnapshot(); const replay = createReplaySnapshot();
  live.match.phase = Phase.match; live.match.stageChoice = CANNON_TEST_STAGE;
  live.match.humanMask = 3; live.match.humanFighterMask = 3; live.match.practice = true;
  live.match.matchFrame = FIRST_ERUPTION - 60;
  fighterAt(live.world, 0).motion.x = LAVA_CENTER_X;
  copyReplayState(saved, live);
  for (let frame = 1; frame <= 180; frame++) stepMatch(live.match, live.world, live.controls, frame);
  copyReplayState(replay, saved);
  for (let frame = 1; frame <= 180; frame++) stepMatch(replay.match, replay.world, replay.controls, frame);
  assertEquals(firstStateDifference(live, replay), undefined);
  assertEquals(stateChecksum(live), stateChecksum(replay));
  assertGreaterThan(fighterAt(live.world, 0).visuals.hit, 0);
});

