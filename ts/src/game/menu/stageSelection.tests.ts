import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { stageTileAt, stageTileLeft, stageTileTop } from "./stageSelection";
import { STAGE_CATALOG, STAGE_CHOICES, randomStage } from "./stageCatalog";


const at = (thousandths: number) => f32(thousandths / 1000);

const cx = (choice: number) => stageTileLeft(choice) + at(47);
const cy = (choice: number) => stageTileTop(choice) - at(29);

test("random stage draws are reproducible and reach every available stage [k2 property]", () => {
  const drawn: number[] = [];
  for (let seed = 0; seed < 500; seed++) {
    const choice = randomStage(seed);
    assertEquals(choice, randomStage(seed));
    assertEquals(STAGE_CATALOG.some(stage => stage.id === choice), true);
    if (!drawn.includes(choice)) drawn.push(choice);
  }
  assertEquals(drawn.length, STAGE_CATALOG.length);
});
