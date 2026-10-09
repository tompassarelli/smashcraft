import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, DownState, ProjectileKind, SpecialAction } from "./codes";
import { createFighter, SHIELD_MAX } from "./fighter";
import { RIFLEMAN_BEAR_CAST_FRAMES, RIFLEMAN_BEAR_SUMMON_FRAMES, advanceSpecials, startFighterSpecial } from "./specials";
import { finishDamageContacts, openDamageContacts } from "./contacts";
import { applyAttackHit } from "./hits";
import { updateProjectiles } from "./projectiles";
import { fighterAt } from "./roster";
import { controls, testWorld } from "./testWorld";
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

test("a hit during the bear cast leaves no bear (#111) [spec #111]", () => {
  const owner = createFighter(Character.rifleman, -100.0, 1);
  const attacker = createFighter(Character.rifleman, -40.0, -1);
  const world = testWorld(owner, attacker);
  assertTrue(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialX: 1 })));
  for (let frame = 1; frame < RIFLEMAN_BEAR_CAST_FRAMES; frame++) advanceSpecials(world, 0, 0);
  const owns = openDamageContacts();
  applyAttackHit(world, 1, 0, AttackStyle.jab, -1, { damage: 6.0, growth: 90.0, base: 18.0, launchX: 1.0, launchZ: 0.5, electric: false }, true, false);
  if (owns) finishDamageContacts(world);
  assertEquals(owner.special.action, SpecialAction.none);
  for (let frame = 0; frame < RIFLEMAN_BEAR_SUMMON_FRAMES; frame++) advanceSpecials(world, 0, 0);
  assertEquals(owner.bear.life, 0);
});
