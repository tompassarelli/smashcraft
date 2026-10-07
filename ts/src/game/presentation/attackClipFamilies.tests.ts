import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { attackClipFamilies, sharedAttackClips } from "./attackClipFamilies";

for (const character of SELECTABLE_CHARACTERS) test(`${fighterName(character)} has no clip shared by three attack families`, () => {
  const conflicts = sharedAttackClips(character);
  const listing = conflicts.map(conflict => `clip ${conflict.index}: ${conflict.families.join(", ")}`).join("; ");
  assertEquals(conflicts.length, 0, `${fighterName(character)} ${listing}`);
});

test("special ground and air variants count as one attack family", () => {
  const variants = attackClipFamilies(Character.lich).filter(c => c.family === "neutralSpecial");
  assertTrue(variants.length >= 2);
  assertTrue(variants.every(c => c.family === "neutralSpecial"));
});
