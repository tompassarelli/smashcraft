import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { clearStageDrag, stageDrag, stageTileAt, updateStageDrag } from "./stageSelection";

/** UI frame units from thousandths, the same binary32 value in both runtimes. */
const at = (thousandths: number) => f32(thousandths / 1000);

test("the stage grid holds only the playable stages", () => {
  assertEquals(stageTileAt(at(480), at(401)), 2);
  assertEquals(stageTileAt(at(600), at(401)), 10);
  assertEquals(stageTileAt(at(700), at(401)), 11);
  assertEquals(stageTileAt(at(653), at(401)), undefined);
  assertEquals(stageTileAt(at(480), at(140)), undefined);
  assertEquals(stageTileAt(at(360), at(401)), undefined);
});

test("the shared stage chip drops onto real tiles only", () => {
  const drag = stageDrag();
  assertEquals(updateStageDrag(drag, true, at(501), at(401), 2), undefined);
  assertEquals(drag.gesture?.kind, "carry");
  assertEquals(updateStageDrag(drag, true, at(603), at(401), 2), undefined);
  assertEquals(updateStageDrag(drag, false, at(603), at(401), 2), 10);
  assertEquals(drag.gesture, undefined);
  updateStageDrag(drag, true, at(603), at(401), 10);
  assertEquals(updateStageDrag(drag, false, at(653), at(401), 10), undefined);
  updateStageDrag(drag, true, at(603), at(401), 10);
  clearStageDrag(drag);
  assertEquals(drag.gesture, undefined);
  assertEquals(updateStageDrag(drag, false, at(501), at(401), 10), undefined);
});

test("a click on a stage needs the press and the release on the same tile", () => {
  const drag = stageDrag();
  assertEquals(updateStageDrag(drag, true, at(638), at(420), 2), undefined);
  assertEquals(drag.gesture?.kind, "click");
  assertEquals(updateStageDrag(drag, false, at(638), at(420), 2), 10);
  assertEquals(updateStageDrag(drag, false, at(638), at(420), 2), undefined);
  updateStageDrag(drag, true, at(638), at(420), 2);
  assertEquals(updateStageDrag(drag, false, at(480), at(420), 2), undefined);
  updateStageDrag(drag, true, at(638), at(420), 2);
  clearStageDrag(drag);
  assertEquals(updateStageDrag(drag, false, at(638), at(420), 2), undefined);
});
