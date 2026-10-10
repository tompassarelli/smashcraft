import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "./codes";
import { RIFLEMAN_BEAR_CAST_FRAMES, RIFLEMAN_BEAR_SUMMON_FRAMES, startFighterSpecial } from "./specials";
import { fighterAt } from "./roster";
import { controls } from "./testWorld";
import { executeNext, testMatch } from "../match/testMatch";
import { originalClipNamed } from "../assets/fighterOriginalClipInfo";

test("Rifleman casts in his Spell pose for 24 frames before the bear appears (#111) [spec #111]", () => {
  const match = testMatch(3, Character.rifleman);
  const owner = fighterAt(match.world, 0);
  owner.motion.surface = 0;
  assertTrue(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialX: 1 })));
  assertEquals(owner.bear.life, 0);
  for (let frame = 1; frame < RIFLEMAN_BEAR_SUMMON_FRAMES; frame++) {
    executeNext(match);
    assertEquals(owner.special.frame, frame);
    assertEquals(match.runtime.poses[0].clipIndex, originalClipNamed(Character.rifleman, "spell"));
    assertEquals(owner.bear.life > 0, frame >= RIFLEMAN_BEAR_CAST_FRAMES);
  }
  assertGreaterThan(owner.bear.x, owner.motion.x);
  executeNext(match);
  assertEquals(owner.special.action, SpecialAction.none);
});

