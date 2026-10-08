import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { SurfaceContact } from "./codes";
import { MAIN_DECK_BODY_SURFACES, mainDeckLeft, mainDeckRight, mainDeckUndersideZ, mainDeckZ, solidSurfaceAt, solidSurfaceCount, surfaceCount, surfaceLeft, surfaceMoves, surfaceRight, surfaceZ } from "./stage";
import { type Character } from "./codes";
import { createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { advanceSolo, controls } from "./testWorld";

// smashcraft:docs/design/stages.md, "Main-deck topology".
/** The ranked stages besides Sky Deck: every main deck has walls and an underside. */
const BODIED = STAGE_CATALOG.filter(({ id }) => id !== 0);

const outline = (stage: number): string => {
  const points: string[] = [];
  for (let index = 0; index < MAIN_DECK_BODY_SURFACES; index++) {
    const line = solidSurfaceAt(stage, index);
    points.push(`${line.startX},${line.startZ}`);
  }
  return points.join(" ");
};

test("each ranked stage's main deck has its own outline [spec docs/design/stages.md]", () => {
  const seen: string[] = [outline(0)];
  for (const { id, name } of BODIED) {
    assertEquals(solidSurfaceCount(id) >= MAIN_DECK_BODY_SURFACES, true, `${name} has no main deck body`);
    const shape = outline(id);
    assertEquals(seen.includes(shape), false, `${name} shares another stage's main deck outline`);
    seen.push(shape);
  }
});

test("each main deck is mirror-symmetric, hangs from two ledges and stays under its ledges [spec docs/design/stages.md]", () => {
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

// smashcraft:docs/design/stages.md, "Layout archetypes".
/** A stage's platforms by span and height; a moving one at two moments of its path. */
const platformLayout = (stage: number): string => {
  const parts: string[] = [];
  const at = (index: number, frame: number) => `${surfaceLeft(stage, index, frame)}..${surfaceRight(stage, index, frame)}@${surfaceZ(stage, index, frame)}`;
  for (let index = 1; index < surfaceCount(stage); index++) {
    parts.push(surfaceMoves(stage, index) ? `moving ${at(index, 0)} then ${at(index, 150)}` : at(index, 0));
  }
  return parts.join(" ");
};

test("each ranked stage has its own platform layout [spec #154]", () => {
  const seen: string[] = [platformLayout(0)];
  for (const { id, name } of STAGE_CATALOG.filter(stage => stage.id !== 0)) {
    const layout = platformLayout(id);
    assertEquals(seen.includes(layout), false, `${name} repeats another stage's platforms: ${layout}`);
    seen.push(layout);
  }
});

/** The highest a fighter's feet reach from the floor: a full hop, then its double jump at the top. */
function doubleJumpApex(character: Character): number {
  const fighter = createFighter(character, 0.0, 1);
  let apex = 0.0;
  let doubled = false;
  for (let frame = 0; frame < 160; frame++) {
    let input = controls(frame < 20 ? { jumpPressed: frame === 0, jumpHeld: true } : {});
    if (!doubled && frame > 3 && !fighter.motion.grounded && fighter.motion.vz <= 0) {
      input = controls({ jumpPressed: true, jumpHeld: true });
      doubled = true;
    }
    advanceSolo(fighter, 0, input, 0.0);
    apex = Math.max(apex, fighter.motion.z);
  }
  return apex;
}

test("every fighter reaches every ranked stage's static platforms with a jump and a double jump [spec #154]", () => {
  let lowest = Number.POSITIVE_INFINITY;
  for (const character of SELECTABLE_CHARACTERS) lowest = Math.min(lowest, doubleJumpApex(character));
  for (const { id, name } of STAGE_CATALOG) {
    for (let index = 1; index < surfaceCount(id); index++) {
      if (surfaceMoves(id, index)) continue;
      assertEquals(surfaceZ(id, index, 0) < lowest, true, `${name} platform ${index} at ${surfaceZ(id, index, 0)} is beyond ${lowest}`);
    }
  }
});
