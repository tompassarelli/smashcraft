import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { clearStageDrag, stageDrag, stageTileAt, stageTileLeft, stageTileTop, updateStageDrag } from "./stageSelection";
import { RANDOM_STAGE, STAGE_CATALOG, STAGE_CHOICES, randomStage } from "./stageCatalog";

/** UI frame units from thousandths, the same binary32 value in both runtimes. */
const at = (thousandths: number) => f32(thousandths / 1000);

const cx = (choice: number) => stageTileLeft(choice) + at(47);
const cy = (choice: number) => stageTileTop(choice) - at(29);

test("the stage grid includes Random alongside every playable stage", () => {
  for (const stage of STAGE_CHOICES) assertEquals(stageTileAt(cx(stage.id), cy(stage.id)), stage.id);
  assertEquals(stageTileAt(at(92), at(516)), undefined);
  assertEquals(stageTileAt(at(653), at(401)), undefined);
  assertEquals(stageTileAt(at(360), at(401)), undefined);
});

test("random stage draws are reproducible and reach every available stage", () => {
  const drawn: number[] = [];
  for (let seed = 0; seed < 500; seed++) {
    const choice = randomStage(seed);
    assertEquals(choice, randomStage(seed));
    assertEquals(STAGE_CATALOG.some(stage => stage.id === choice), true);
    if (!drawn.includes(choice)) drawn.push(choice);
  }
  assertEquals(drawn.length, STAGE_CATALOG.length);
});

test("the shared stage chip drops onto grid tiles only", () => {
  const drag = stageDrag();
  assertEquals(updateStageDrag(drag, true, cx(2), cy(2), 2), undefined);
  assertEquals(drag.gesture?.kind, "carry");
  assertEquals(updateStageDrag(drag, true, cx(10), cy(10), 2), undefined);
  assertEquals(updateStageDrag(drag, false, cx(10), cy(10), 2), 10);
  assertEquals(drag.gesture, undefined);
  updateStageDrag(drag, true, cx(10), cy(10), 10);
  assertEquals(updateStageDrag(drag, false, at(360), at(401), 10), undefined);
  updateStageDrag(drag, true, cx(10), cy(10), 10);
  clearStageDrag(drag);
  assertEquals(drag.gesture, undefined);
  assertEquals(updateStageDrag(drag, false, cx(2), cy(2), 10), undefined);
});

test("a click on a stage needs the press and the release on the same tile", () => {
  const drag = stageDrag();
  assertEquals(updateStageDrag(drag, true, cx(10), cy(10), 2), undefined);
  assertEquals(drag.gesture?.kind, "click");
  assertEquals(updateStageDrag(drag, false, cx(10), cy(10), 2), 10);
  assertEquals(updateStageDrag(drag, false, cx(10), cy(10), 2), undefined);
  updateStageDrag(drag, true, cx(10), cy(10), 2);
  assertEquals(updateStageDrag(drag, false, cx(2), cy(2), 2), undefined);
  updateStageDrag(drag, true, cx(10), cy(10), 2);
  clearStageDrag(drag);
  assertEquals(updateStageDrag(drag, false, cx(10), cy(10), 2), undefined);
});
