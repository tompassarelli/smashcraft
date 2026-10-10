import { assertEquals, test } from "wisp/src/runtime/testing";
import { createFighter } from "./fighter";
import { fighterSlug, SELECTABLE_CHARACTERS } from "./heroes/registry";
import { advanceSolo, controls } from "./testWorld";
import { melee } from "./tuning";

test("every fighter's entry dash and run stay within Captain Falcon's speed ceiling [spec #333]", () => {
  const failures: string[] = [];
  // NTSC 1.02 PlCa.dat +0x01C/+0x028, docs/smash-melee-reference/retail-roster.json.
  const dashCeiling = melee(2.0);
  const runCeiling = melee(2.299999952316284);
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 0.0, 1);
    const input = controls({ direction: 1 });
    advanceSolo(fighter, 0, input, 0.0);
    if (fighter.motion.vx > dashCeiling) failures.push(`${fighterSlug(character)} dash got ${fighter.motion.vx}, want <= ${dashCeiling}`);
    for (let frame = 2; frame <= 35; frame++) advanceSolo(fighter, 0, input, 0.0);
    if (fighter.motion.vx > runCeiling) failures.push(`${fighterSlug(character)} run got ${fighter.motion.vx}, want <= ${runCeiling}`);
  }
  assertEquals(failures.join("; "), "");
});
