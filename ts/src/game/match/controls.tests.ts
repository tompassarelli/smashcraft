import { assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { Phase } from "./rules";
import { createMatchControls, startKeyDown, startKeyUp } from "./controls";

test("yConfirmsSelectionStageAndRematch", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.characterMenu, false), "confirm");
  startKeyUp(controls, 0);
  assertEquals(startKeyDown(controls, 1, Phase.stageMenu, false), "confirm");
  startKeyUp(controls, 1);
  assertEquals(startKeyDown(controls, 0, Phase.result, false), "confirm");
  assertFalse(controls.paused);

});
test("yPausesAndResumesOnlyOnFreshPress", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.match, false), "togglePause");
  assertTrue(controls.paused);
  assertEquals(startKeyDown(controls, 0, Phase.match, false), undefined);
  assertTrue(controls.paused);
  startKeyUp(controls, 0);
  assertEquals(startKeyDown(controls, 0, Phase.match, false), "togglePause");
  assertFalse(controls.paused);

});
test("deferredJournalPauseChangesOnlyWhenTheAcknowledgmentCommits", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.match, false, true), "togglePause");
  assertFalse(controls.paused);
  controls.paused = true;
  assertTrue(controls.paused);
  startKeyUp(controls, 0);
  assertEquals(startKeyDown(controls, 0, Phase.match, false, true), "togglePause");
  assertTrue(controls.paused);
  controls.paused = false;
  assertFalse(controls.paused);

});
test("pauseIsSharedAndSimultaneousPlayerPressDoesNotUndoIt", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.match, false), "togglePause");
  assertEquals(startKeyDown(controls, 1, Phase.match, false), undefined);
  assertTrue(controls.paused);
  startKeyUp(controls, 0);
  startKeyUp(controls, 1);
  assertEquals(startKeyDown(controls, 1, Phase.match, false), "togglePause");
  assertFalse(controls.paused);

});
test("yInSettingsDoesNotConfirmOrPause", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.characterMenu, true), undefined);
  startKeyUp(controls, 0);
  assertEquals(startKeyDown(controls, 0, Phase.match, true), undefined);
  assertFalse(controls.paused);

});
test("overlappingMenuPressesCannotConfirmTwoPhasesAtOnce", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.characterMenu, false), "confirm");
  assertEquals(startKeyDown(controls, 1, Phase.stageMenu, false), undefined);
  startKeyUp(controls, 0);
  startKeyUp(controls, 1);
  assertEquals(startKeyDown(controls, 1, Phase.stageMenu, false), "confirm");

});
test("allFourSlotsShareOnePauseLatch", () => {
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
test("overlappingResultPressesConfirmEachPlayersRematch", () => {
  const controls = createMatchControls();
  assertEquals(startKeyDown(controls, 0, Phase.result, false), "confirm");
  assertEquals(startKeyDown(controls, 1, Phase.result, false), "confirm");
  assertEquals(startKeyDown(controls, 1, Phase.result, false), undefined);
  assertEquals(startKeyDown(controls, 2, Phase.characterMenu, false), undefined);
  assertFalse(controls.paused);

});
