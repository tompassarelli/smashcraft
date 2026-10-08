import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { WIND_TEST_STAGE, CANNON_TEST_STAGE, STAGE_AT_REST } from "../sim/stage";
import { windPush } from "../sim/stageHazards";
import { windStreak } from "./stageHazards";

test("wind ribbons warn in the push direction for 45 frames before either gust without pushing fighters [spec #348] [spec #194]", () => {
  for (const [start, direction] of [[601, 1], [1520, -1]] as const) {
    assertEquals(windStreak(WIND_TEST_STAGE, start - 1, 0), undefined);
    for (let frame = start; frame < start + 45; frame++) {
      const look = windStreak(WIND_TEST_STAGE, frame, 0);
      assertTrue(look !== undefined);
      assertEquals(look?.direction, direction);
      assertEquals(windPush(WIND_TEST_STAGE, frame, 0.0, 100.0), 0.0);
    }
    const before = windStreak(WIND_TEST_STAGE, start, 0)?.x ?? 0.0;
    const after = windStreak(WIND_TEST_STAGE, start + 1, 0)?.x ?? 0.0;
    assertEquals(after - before, direction * 12);
    assertTrue(windPush(WIND_TEST_STAGE, start + 45, 0.0, 100.0) * direction > 0.0);
  }
  assertEquals(windStreak(WIND_TEST_STAGE, STAGE_AT_REST, 0), undefined);
  assertEquals(windStreak(CANNON_TEST_STAGE, 601, 0), undefined);
});
