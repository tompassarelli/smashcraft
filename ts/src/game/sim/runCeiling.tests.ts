import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { Character } from "./codes";
import { createFighter } from "./fighter";
import { fighterSlug, SELECTABLE_CHARACTERS } from "./heroes/registry";
import { advanceSolo, controls } from "./testWorld";
import { authoredPhysics, melee } from "./tuning";

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

test("capped fighters keep their run and dash ranking above unchanged Shadow Hunter [spec #333]", () => {
  const ranking = [Character.shadowHunter, Character.blademaster, Character.dreadlord, Character.murloc, Character.warden];
  let previous = authoredPhysics(Character.shadowHunter);
  for (let index = 1; index < ranking.length; index++) {
    const character = ranking[index];
    if (character === undefined) continue;
    const current = authoredPhysics(character);
    assertGreaterThan(current.runSpeed, previous.runSpeed);
    assertGreaterThan(current.dashSpeed, previous.dashSpeed);
    previous = current;
  }
});
