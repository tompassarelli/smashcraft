import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, ItemKind } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import { createFighter } from "./fighter";
import { applyAttackHit } from "./hits";
import {
  LAVA_CALM_FRAMES, LAVA_CENTER_X, LAVA_HIT, LAVA_WARNING_FRAMES, LavaPhase, collectLavaContacts, framesUntilLava, lavaLeft, lavaPhase, lavaRight, lavaSide,
} from "./lava";
import { queueAttack } from "../input/attackBuffer";
import { CANNON_TEST_STAGE, STAGE_AT_REST, STRATHOLME_STAGE, mainDeckLeft, mainDeckRight, mainDeckZAt } from "./stage";
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

test("lava produces the same complete victim as an ordinary scripted fire hit [spec docs/stage-hazards.md] [invariant]", () => {
  for (const damage of [0.0, 80.0, 250.0]) {
    const lava = lavaWorld(); const scripted = lavaWorld();
    const first = fighterAt(lava, 0); const second = fighterAt(scripted, 0);
    first.status.damage = damage; second.status.damage = damage;
    beginDamageContacts(); collectLavaContacts(lava, CANNON_TEST_STAGE, FIRST_ERUPTION); finishDamageContacts(lava);
    beginDamageContacts(); applyAttackHit(scripted, 0, 0, AttackStyle.jab, 1, LAVA_HIT, false, false, undefined); finishDamageContacts(scripted);
    assertEquals(firstFighterDifference(first, second, 3, 3), undefined);
    assertEquals(first.status.damage, damage + 12.0);
    assertFalse(first.motion.grounded);
    assertGreaterThan(first.launch.knockbackZ, 0.0);
    assertEquals(first.launch.hitstun, 40);
  }
});




test("Blackrock's lava warns for five seconds, erupts on the right, then warns and erupts on the mirrored left spot, on a fixed timetable [spec #193]", () => {
  const at = (frame: number) => `${lavaPhase(CANNON_TEST_STAGE, frame)}${lavaSide(frame) > 0 ? "R" : "L"}`;
  const { calm, warning, erupting } = LavaPhase;
  const timetable: [number, string][] = [
    [1, `${calm}R`], [300, `${calm}R`], [301, `${warning}R`], [600, `${warning}R`], [601, `${erupting}R`], [1200, `${erupting}R`],
    [1201, `${calm}L`], [1500, `${calm}L`], [1501, `${warning}L`], [1800, `${warning}L`], [1801, `${erupting}L`], [2400, `${erupting}L`],
    [2401, `${calm}R`], [2701, `${warning}R`], [3001, `${erupting}R`],
  ];
  assertEquals(timetable.map(([frame]) => `${frame}:${at(frame)}`).join(" "), timetable.map(([frame, phase]) => `${frame}:${phase}`).join(" "));
  assertEquals(LAVA_WARNING_FRAMES, 300);
  assertEquals(framesUntilLava(301), 300);
  assertEquals(framesUntilLava(600), 1);
  assertEquals(framesUntilLava(601), 0);
  // The left spot mirrors the right.
  assertEquals(`${lavaLeft(1801)}..${lavaRight(1801)}`, `${-lavaRight(601)}..${-lavaLeft(601)}`);
  // Hazards off and other stages never warn or erupt.
  assertEquals(lavaPhase(CANNON_TEST_STAGE, STAGE_AT_REST + FIRST_ERUPTION), calm);
  assertEquals(lavaPhase(STRATHOLME_STAGE, FIRST_ERUPTION), calm);
});

/** How far a fighter travels in one initial dash from a standstill. */
function dashLength(character: Character): number {
  const fighter = createFighter(character, 0.0, 1);
  for (let frame = 0; frame < INITIAL_DASH_FRAMES; frame++) advanceSolo(fighter, 0, controls({ direction: 1 }), 0.0);
  return fighter.motion.x;
}

test("Blackrock's one lava patch stays off the centre and clear of each ledge by more than two of any fighter's initial dashes [spec #193]", () => {
  let longest = 0.0;
  for (const character of SELECTABLE_CHARACTERS) longest = Math.max(longest, dashLength(character));
  assertGreaterThan(longest, 100.0);
  for (const frame of [FIRST_ERUPTION, FIRST_ERUPTION + 1200]) {
    const left = lavaLeft(frame);
    const right = lavaRight(frame);
    assertGreaterThan(Math.min(left - mainDeckLeft(CANNON_TEST_STAGE), mainDeckRight(CANNON_TEST_STAGE) - right), 2 * longest);
    assertTrue(left > 0.0 || right < 0.0);
  }
});

test("lava burns only its erupting patch and respects hazards off and invincibility [spec #193]", () => {
  const scenarios = [
    { name: "another stage", stage: 0 },
    { name: "hazards off", frame: STAGE_AT_REST + FIRST_ERUPTION },
    { name: "warning", frame: FIRST_ERUPTION - 1 },
    { name: "inside its inner end", x: lavaLeft(FIRST_ERUPTION) - 1.0 },
    { name: "past its outer end", x: lavaRight(FIRST_ERUPTION) + 1.0 },
    { name: "the mirrored spot", x: -LAVA_CENTER_X },
    { name: "the right ledge", x: 590.0 },
    { name: "above the floor", z: 1.0 },
    { name: "invincible", invincible: 1 },
  ];
  for (const scenario of scenarios) {
    const world = lavaWorld(); const fighter = fighterAt(world, 0);
    if (scenario.x !== undefined) fighter.motion.x = scenario.x;
    if (scenario.z !== undefined) fighter.motion.z = scenario.z;
    if (scenario.invincible !== undefined) fighter.status.invincible = scenario.invincible;
    beginDamageContacts(); collectLavaContacts(world, scenario.stage ?? CANNON_TEST_STAGE, scenario.frame ?? FIRST_ERUPTION); finishDamageContacts(world);
    assertEquals(fighter.status.damage, 0.0, scenario.name);
  }
});

test("a lava launch survives rollback and 180 replayed match frames exactly [invariant]", () => {
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
