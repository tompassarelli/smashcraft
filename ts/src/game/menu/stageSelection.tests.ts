import { assertEquals, test } from "waygate/src/runtime/testing";
import { f32 } from "waygate/src/sim/f32";
import { clearStageDrag, stageDrag, stageTileAt, updateStageDrag } from "./stageSelection";

/** UI frame units from thousandths, the same binary32 value in both runtimes. */
const at = (thousandths: number) => f32(thousandths / 1000);

test("the stage grid holds only the playable stages", () => {
  assertEquals(stageTileAt(at(480), at(350)), 0);
  assertEquals(stageTileAt(at(660), at(350)), 1);
  assertEquals(stageTileAt(at(603), at(350)), undefined);
  assertEquals(stageTileAt(at(480), at(270)), undefined);
  assertEquals(stageTileAt(at(360), at(350)), undefined);
});

test("the shared stage chip drops onto real tiles only", () => {
  const drag = stageDrag();
  assertEquals(updateStageDrag(drag, true, at(525), at(357), 0), undefined);
  assertEquals(drag.gesture?.kind, "carry");
  assertEquals(updateStageDrag(drag, true, at(683), at(357), 0), undefined);
  assertEquals(updateStageDrag(drag, false, at(683), at(357), 0), 1);
  assertEquals(drag.gesture, undefined);
  updateStageDrag(drag, true, at(683), at(357), 1);
  assertEquals(updateStageDrag(drag, false, at(603), at(350), 1), undefined);
  updateStageDrag(drag, true, at(683), at(357), 1);
  clearStageDrag(drag);
  assertEquals(drag.gesture, undefined);
  assertEquals(updateStageDrag(drag, false, at(525), at(357), 1), undefined);
});

test("a click on a stage needs the press and the release on the same tile", () => {
  const drag = stageDrag();
  assertEquals(updateStageDrag(drag, true, at(720), at(390), 0), undefined);
  assertEquals(drag.gesture?.kind, "click");
  assertEquals(updateStageDrag(drag, false, at(720), at(390), 0), 1);
  assertEquals(updateStageDrag(drag, false, at(720), at(390), 0), undefined);
  updateStageDrag(drag, true, at(720), at(390), 0);
  assertEquals(updateStageDrag(drag, false, at(480), at(390), 0), undefined);
  updateStageDrag(drag, true, at(720), at(390), 0);
  clearStageDrag(drag);
  assertEquals(updateStageDrag(drag, false, at(720), at(390), 0), undefined);
});
