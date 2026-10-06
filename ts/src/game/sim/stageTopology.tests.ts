import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { SurfaceContact } from "./codes";
import { CANNON_TEST_STAGE, MAIN_DECK_BODY_SURFACES, mainDeckLeft, mainDeckRight, mainDeckUndersideZ, mainDeckZ, solidSurfaceAt, solidSurfaceCount } from "./stage";

// smashcraft:docs/design/stages.md, "Main-deck topology".
/** The ranked stages whose main deck has walls and an underside; Blackrock's is a floor, as Kongo Jungle's. */
const BODIED = STAGE_CATALOG.filter(({ id }) => id !== 0 && id !== CANNON_TEST_STAGE);

const outline = (stage: number): string => {
  const points: string[] = [];
  for (let index = 0; index < MAIN_DECK_BODY_SURFACES; index++) {
    const line = solidSurfaceAt(stage, index);
    points.push(`${line.startX},${line.startZ}`);
  }
  return points.join(" ");
};

test("each ranked stage's main deck has its own outline", () => {
  const seen: string[] = [outline(0)];
  for (const { id, name } of BODIED) {
    assertEquals(solidSurfaceCount(id) >= MAIN_DECK_BODY_SURFACES, true, `${name} has no main deck body`);
    const shape = outline(id);
    assertEquals(seen.includes(shape), false, `${name} shares another stage's main deck outline`);
    seen.push(shape);
  }
});

test("each main deck is mirror-symmetric, hangs from two ledges and stays under its ledges", () => {
  for (const { id, name } of [{ id: 0, name: "Sky Deck" }, ...BODIED]) {
    const lines = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index) => solidSurfaceAt(id, index));
    const center = (mainDeckLeft(id) + mainDeckRight(id)) / 2;
    for (const [index, line] of lines.entries()) {
      const twin = lines[lines.length - 1 - index];
      if (twin === undefined) throw new Error("missing twin line");
      assertEquals(line.startX - center, center - twin.endX, `${name}: line ${index} start x mirrors its twin's end`);
      assertEquals(line.startZ, twin.endZ, `${name}: line ${index} start z mirrors its twin's end`);
      assertEquals(line.kind, twin.kind, `${name}: line ${index} kind mirrors its twin's`);
    }
    const first = lines[0];
    const last = lines[lines.length - 1];
    if (first === undefined || last === undefined) throw new Error("empty body");
    // The body starts at the right ledge and ends at the left one, straight down from each: a grabbable corner.
    assertEquals(first.startX, mainDeckRight(id), `${name}: the body leaves the right ledge`);
    assertEquals(first.startZ, mainDeckZ(id), `${name}: the body leaves the right ledge`);
    assertEquals(last.endX, mainDeckLeft(id), `${name}: the body returns to the left ledge`);
    assertEquals(last.endZ, mainDeckZ(id), `${name}: the body returns to the left ledge`);
    assertEquals(first.endX, first.startX, `${name}: a wall drops straight from the right ledge`);
    assertEquals(first.kind, SurfaceContact.wall, `${name}: the ledge's first line is a wall`);
    // No overhang beyond the ledges and no pocket: every line of the right side descends inside the ledge.
    for (let index = 0; index * 2 + 1 < lines.length; index++) {
      const line = lines[index];
      if (line === undefined) continue;
      assertEquals(line.endX <= mainDeckRight(id) && line.endZ < line.startZ, true, `${name}: right line ${index} reaches past the ledge or rises`);
    }
    const bottom = lines.find((line) => line.startZ === line.endZ && line.kind === SurfaceContact.ceiling);
    assertEquals(bottom?.startZ, mainDeckUndersideZ(id), `${name}: level underside`);
  }
});
