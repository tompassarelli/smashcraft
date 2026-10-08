import { assertEquals, test } from "wisp/src/runtime/testing";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { sharedAttackClips } from "./attackClipFamilies";

for (const character of SELECTABLE_CHARACTERS) test(`${fighterName(character)} has no clip shared by three attack families [spec #236]`, () => {
  const conflicts = sharedAttackClips(character);
  const listing = conflicts.map(conflict => `clip ${conflict.index}: ${conflict.families.join(", ")}`).join("; ");
  assertEquals(conflicts.length, 0, `${fighterName(character)} ${listing}`);
});

