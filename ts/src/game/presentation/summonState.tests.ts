import { assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { f32 } from "../../sim/f32";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createSummonState, firstSummonDifference, advanceSummons, projectBear } from "./summonState";
import { SUMMON_BEAR_ATTACK, SUMMON_BEAR_WALK, summonClip } from "./summonClipInfo";

test("bear spawn, hit queue and original clip timing survive copied state", () => {
  const state = createSummonState();
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  fighter.bear.life = 500;
  fighter.bear.x = 123.0;
  fighter.bear.z = 42.0;
  fighter.bear.velocityX = -14.0;
  advanceSummons(state, fighter, 3);
  const spawn = projectBear(state, fighter, 3);
  assertTrue(spawn.visible);
  assertEquals(spawn.clipIndex, SUMMON_BEAR_WALK);
  assertEquals(spawn.seconds, 0.0);
  assertEquals(spawn.x, 123.0);
  assertEquals(spawn.z, 42.0);
  assertEquals(spawn.yaw, f32(3.141592654));
  advanceSummons(state, fighter, 3);
  fighter.bear.hitSerial++;
  advanceSummons(state, fighter, 3);
  assertEquals(state.bears[3]?.clipIndex, SUMMON_BEAR_ATTACK);
  assertEquals(state.bears[3]?.queuedClip, SUMMON_BEAR_WALK);
  assertEquals(state.bears[3]?.clipTime, 0.0);
  const saved = { bears: state.bears.map(pose => ({ ...pose })), bearHitSerial: state.bearHitSerial.slice() };
  const attack = summonClip(0, SUMMON_BEAR_ATTACK);
  const duration = attack.endSeconds - attack.startSeconds;
  let elapsed = 0.0;
  while (elapsed + 1.0 / 60.0 < duration) {
    advanceSummons(state, fighter, 3);
    elapsed += 1.0 / 60.0;
    assertEquals(state.bears[3]?.clipIndex, SUMMON_BEAR_ATTACK);
  }
  advanceSummons(state, fighter, 3);
  assertEquals(state.bears[3]?.clipIndex, SUMMON_BEAR_WALK);
  assertEquals(state.bears[3]?.queuedClip, undefined);
  assertEquals(firstSummonDifference(saved, state), "slot[3].clipIndex");
});

test("inactive bears remain hidden and do not alias other participant slots", () => {
  const state = createSummonState();
  const first = createFighter(Character.rifleman, 0.0, 1);
  first.bear.life = 500;
  advanceSummons(state, first, 0);
  advanceSummons(state, undefined, 3);
  assertFalse(projectBear(state, undefined, 3).visible);
  assertEquals(state.bears[3]?.active, false);
  assertTrue(state.bears[0]?.active ?? false);
});
