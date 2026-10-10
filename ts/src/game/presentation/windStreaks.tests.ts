import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { WIND_TEST_STAGE, CANNON_TEST_STAGE, STAGE_AT_REST } from "../sim/stage";
import { WIND_CALM_FRAMES, WIND_CUE_FRAMES, WIND_CYCLE_FRAMES, windPush } from "../sim/stageHazards";
import { windStreak } from "./stageHazards";

test("wind ribbons warn in the push direction for the whole cue before either gust without pushing fighters [k3 measure #348]", () => {
  for (const [start, direction] of [[WIND_CALM_FRAMES + 1, 1], [WIND_CYCLE_FRAMES + WIND_CALM_FRAMES + 1, -1]] as const) {
    assertEquals(windStreak(WIND_TEST_STAGE, start - 1, 0), undefined);
    for (let frame = start; frame < start + WIND_CUE_FRAMES; frame++) {
      const look = windStreak(WIND_TEST_STAGE, frame, 0);
      assertTrue(look !== undefined);
      assertEquals(look?.direction, direction);
      assertEquals(windPush(WIND_TEST_STAGE, frame, 0.0, 100.0), 0.0);
    }
    const before = windStreak(WIND_TEST_STAGE, start, 0)?.x ?? 0.0;
    const after = windStreak(WIND_TEST_STAGE, start + 1, 0)?.x ?? 0.0;
    assertEquals((after - before) * direction > 0.0, true, "the ribbons travel with the push");
    assertTrue(windPush(WIND_TEST_STAGE, start + WIND_CUE_FRAMES, 0.0, 100.0) * direction > 0.0);
  }
  assertEquals(windStreak(WIND_TEST_STAGE, STAGE_AT_REST, 0), undefined);
  assertEquals(windStreak(CANNON_TEST_STAGE, WIND_CALM_FRAMES + 1, 0), undefined);
});
