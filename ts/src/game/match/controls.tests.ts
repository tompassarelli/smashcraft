import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase } from "./rules";
import { createMatchControls, startKeyDown, startKeyUp } from "./controls";

test("yConfirmsSelectionStageAndRematch [spec docs/player-guide.md]", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.characterMenu, false), "confirm");
  startKeyUp(controls, 0);
  assertEquals(startKeyDown(controls, 1, Phase.stageMenu, false), "confirm");
  startKeyUp(controls, 1);
  assertEquals(startKeyDown(controls, 0, Phase.result, false), "confirm");
  assertFalse(controls.paused);

});
test("yPausesAndResumesOnlyOnFreshPress [spec docs/player-guide.md]", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.match, false), "togglePause");
  assertTrue(controls.paused);
  assertEquals(startKeyDown(controls, 0, Phase.match, false), undefined);
  assertTrue(controls.paused);
  startKeyUp(controls, 0);
  assertEquals(startKeyDown(controls, 0, Phase.match, false), "togglePause");
  assertFalse(controls.paused);

});
test("pauseIsSharedAndSimultaneousPlayerPressDoesNotUndoIt [spec docs/design/match-flow.md]", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.match, false), "togglePause");
  assertEquals(startKeyDown(controls, 1, Phase.match, false), undefined);
  assertTrue(controls.paused);
  startKeyUp(controls, 0);
  startKeyUp(controls, 1);
  assertEquals(startKeyDown(controls, 1, Phase.match, false), "togglePause");
  assertFalse(controls.paused);

});
test("allFourSlotsShareOnePauseLatch [spec docs/design/match-flow.md]", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 3, Phase.match, false), "togglePause");
  assertTrue(controls.paused);
  assertEquals(startKeyDown(controls, 2, Phase.match, false), undefined);
  startKeyUp(controls, 3);
  startKeyUp(controls, 2);
  assertEquals(startKeyDown(controls, 2, Phase.match, false), "togglePause");
  assertFalse(controls.paused);
  startKeyUp(controls, 2);
  assertEquals(startKeyDown(controls, 3, Phase.result, false), "confirm");
  assertEquals(startKeyDown(controls, 4, Phase.match, false), undefined);

});
