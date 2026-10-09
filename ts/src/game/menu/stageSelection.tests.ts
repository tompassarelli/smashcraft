import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { stageTileAt, stageTileLeft, stageTileTop } from "./stageSelection";
import { STAGE_CATALOG, STAGE_CHOICES, randomStage } from "./stageCatalog";


const at = (thousandths: number) => f32(thousandths / 1000);

const cx = (choice: number) => stageTileLeft(choice) + at(47);
const cy = (choice: number) => stageTileTop(choice) - at(29);

test("the stage grid includes Random alongside every playable stage [spec #173]", () => {
  for (const stage of STAGE_CHOICES) assertEquals(stageTileAt(cx(stage.id), cy(stage.id)), stage.id);
  assertEquals(stageTileAt(at(92), at(516)), undefined);
  assertEquals(stageTileAt(at(653), at(401)), undefined);
  assertEquals(stageTileAt(at(360), at(401)), undefined);
});

test("random stage draws are reproducible and reach every available stage [spec #173] [invariant]", () => {
  const drawn: number[] = [];
  for (let seed = 0; seed < 500; seed++) {
    const choice = randomStage(seed);
    assertEquals(choice, randomStage(seed));
    assertEquals(STAGE_CATALOG.some(stage => stage.id === choice), true);
    if (!drawn.includes(choice)) drawn.push(choice);
  }
  assertEquals(drawn.length, STAGE_CATALOG.length);
});
