import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { BEAR_PLACEMENT } from "../sim/heroes/beastmasterSpecials";
import { CompanionMode } from "../sim/heroSpecials";
import { advanceBearFeedback, bearState, createBearFeedbackCursor } from "./bearFeedback";

test("Beastmaster Bear marker shows all four states through one command and disappears on loss [spec docs/design/beastmaster.md]", () => {
  const fighter = createFighter(Character.beastmaster, 0.0, 1);
  const bear = fighter.placed;
  assertEquals(bearState(fighter), undefined);
  bear.spec = BEAR_PLACEMENT;
  bear.life = 600;
  assertEquals(bearState(fighter), "FOLLOWING");
  bear.mode = CompanionMode.lunge;
  const lunge = BEAR_PLACEMENT.companion!;
  let charging = 0, attacking = 0, resting = 0;
  for (let frame = 1; frame <= lunge.lungeStartup + lunge.lungeActive + lunge.lungeRecovery; frame++) {
    bear.modeFrame = frame;
    const state = bearState(fighter);
    if (state === "CHARGING") charging++;
    if (state === "ATTACKING") attacking++;
    if (state === "RESTING") resting++;
  }
  assertEquals(charging, lunge.lungeStartup);
  assertEquals(attacking, lunge.lungeActive);
  assertEquals(resting, lunge.lungeRecovery);
  bear.mode = CompanionMode.stunned;
  assertEquals(bearState(fighter), "RESTING");
  bear.life = 0;
  assertEquals(bearState(fighter), undefined);
});

test("Beastmaster Bear roars once per command and sounds only connected bites, with repeated frames ignored [spec docs/design/beastmaster.md]", () => {
  const fighter = createFighter(Character.beastmaster, 0.0, 1);
  const bear = fighter.placed;
  bear.spec = BEAR_PLACEMENT;
  bear.life = 600;
  const cursor = createBearFeedbackCursor();
  let roars = 0, hits = 0;
  for (let command = 0; command < 3; command++) {
    bear.mode = CompanionMode.lunge;
    bear.bitten = 0;
    for (let frame = 1; frame <= 44; frame++) {
      bear.age = command * 50 + frame;
      bear.modeFrame = frame;
      if (command !== 1 && frame === BEAR_PLACEMENT.companion!.lungeStartup + 1) bear.bitten = 2;
      const cues = advanceBearFeedback(cursor, fighter, bear.age);
      if (cues.roar) roars++;
      if (cues.hit) hits++;
      const repeat = advanceBearFeedback(cursor, fighter, bear.age);
      assertEquals(repeat.roar, false);
      assertEquals(repeat.hit, false);
    }
    bear.mode = CompanionMode.follow;
    advanceBearFeedback(cursor, fighter, command * 50 + 45);
  }
  assertEquals(roars, 3);
  assertEquals(hits, 2);
  assertEquals(cursor.impactFrame, 100 + BEAR_PLACEMENT.companion!.lungeStartup + 1);
});
