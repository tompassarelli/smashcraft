import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { stageScenery } from "./stageScenery";

// smashcraft:docs/design/stage-art.md, rules 2 and 7.
/**
 * Every unit model is a figure, even posed or parked: the Obsidian Statue
 * reads as a winged creature with a staff and the Dwarf Car carries a dwarf.
 * A doodad named for a figure fails too.
 */
const FIGURE_WORDS = ["statue", "totem", "idol", "effigy", "corpse", "skeleton"];

test("each selectable stage has its own sky and fog beyond the fight [spec #170]", () => {
  const skies: string[] = [];
  const fogs: string[] = [];
  for (const { id, name } of STAGE_CATALOG) {
    const { sky, fog, heightFog } = stageScenery(id);
    assertEquals(sky.length > 0, true, `${name}: missing sky`);
    assertEquals(skies.includes(sky), false, `${name}: shares another stage's sky`);
    skies.push(sky);
    assertEquals(fog !== undefined, true, `${name}: missing fog`);
    if (fog === undefined) continue;
    const color = `${fog.red}/${fog.green}/${fog.blue}`;
    assertEquals(fogs.includes(color), false, `${name}: shares another stage's fog colour`);
    fogs.push(color);
    assertEquals(fog.start >= 5000 && fog.end > fog.start, true, `${name}: fog reaches the fighting plane or has no range`);
    for (const channel of [fog.red, fog.green, fog.blue]) {
      assertEquals(channel >= 0 && channel <= 1, true, `${name}: fog colour ${channel} is outside [0, 1]`);
    }
    if (heightFog === undefined) continue;
    assertEquals(heightFog.heightStart < heightFog.heightEnd && heightFog.heightEnd < 0, true, `${name}: height fog reaches the deck`);
    assertEquals(heightFog.start >= 5000 && heightFog.end > heightFog.start, true, `${name}: height fog reaches the fighting plane or has no range`);
  }
});

test("no stage's scenery pairs a piece with its mirror twin [spec docs/design/stage-art.md]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    const pieces = stageScenery(id).pieces;
    for (const [index, a] of pieces.entries()) {
      for (const b of pieces.slice(index + 1)) {
        const mirrored = a.model === b.model && Math.abs(a.x) >= 200.0 && Math.abs(a.x + b.x) < 400.0
          && Math.abs(a.y - b.y) < 600.0 && Math.abs(a.z - b.z) < 300.0
          && Math.max(a.scale, b.scale) < 1.25 * Math.min(a.scale, b.scale);
        assertEquals(mirrored, false, `${name}: ${a.model} at x ${a.x} mirrors x ${b.x}`);
      }
    }
  }
});

test("stage scenery shows no creatures [spec docs/design/stage-art.md]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    for (const { model } of stageScenery(id).pieces) {
      const creature = model.toLowerCase().startsWith("units\\") || FIGURE_WORDS.some((word) => model.toLowerCase().includes(word));
      assertEquals(creature, false, `${name}: ${model} is a creature`);
    }
  }
});
