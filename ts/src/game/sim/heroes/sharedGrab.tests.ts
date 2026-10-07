import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction } from "../codes";
import { createFighter } from "../fighter";
import { PUMMEL_CONTACT_FRAME, PUMMEL_DAMAGE, PUMMEL_TOTAL_FRAMES, attackStartupFrames, grabContactFrame } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { BLADEMASTER_MOVES } from "./blademasterMoves";
import { HERO_ROSTER } from "./registry";

test("expansion grabs deal their authored pummel once, then a buffered throw", () => {
  for (const hero of HERO_ROSTER) {
    const { moves } = hero;
    const owner = createFighter(Character.archer, 0.0, 1);
    owner.tuning.moves = moves;
    const target = createFighter(Character.rifleman, 50.0, -1);
    target.status.damage = 100.0;
    const world = testWorld(owner, target);
    beginFighterAttack(world, 0, AttackStyle.grab, false);
    owner.attack.frame = attackStartupFrames(AttackStyle.grab, moves);
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
    const pummel = moves.throws[GrabAction.pummel]?.effect;
    assertTrue(pummel !== undefined);
    if (pummel === undefined) continue;
    assertEquals(pummel.growth, 0.0);
    assertEquals(pummel.base, 0.0);
    const expectedPummel = hero.character === Character.blademaster ? 2.865000009536743
      : hero.character === Character.mountainKing ? 3.31499981880188
        : hero.character === Character.dreadlord ? 2.7150001525878906
          : hero.character === Character.beastmaster ? 3.179999828338623 : PUMMEL_DAMAGE;
    assertEquals(pummel.damage, expectedPummel);
    for (let frame = 1; frame <= PUMMEL_CONTACT_FRAME; frame++) testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
    assertEquals(target.status.damage, f32(100.0 + pummel.damage));
    assertEquals(owner.grab.pummels, 1);
    for (let frame = PUMMEL_CONTACT_FRAME + 1; frame <= PUMMEL_TOTAL_FRAMES; frame++) {
      testGrabFrame(world, [controls({ attackPressed: true, grabThrowX: frame === PUMMEL_TOTAL_FRAMES ? 1 : 0 }), controls()], false);
    }
    testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
    assertEquals(owner.grab.action, GrabAction.throwForward);
    assertEquals(owner.grab.frame, 1);
    assertEquals(owner.grab.pummels, 1);
    const release = grabContactFrame(GrabAction.throwForward, moves);
    for (let frame = 2; frame <= release; frame++) testGrabFrame(world, [controls(), controls()], false);
    assertEquals(target.grab.owner, undefined);
    assertTrue(target.launch.throwHitstun);
  }
});

test("Blademaster standing grab can catch on either of its separately authored active poses", () => {
  for (const facing of [-1, 1]) {
    for (const attackFrame of [6, 7]) {
      const owner = createFighter(Character.archer, 0.0, facing);
      owner.tuning.moves = BLADEMASTER_MOVES;
      const target = createFighter(Character.rifleman, 50.0 * facing, -facing);
      const world = testWorld(owner, target);
      beginFighterAttack(world, 0, AttackStyle.grab, false);
      owner.attack.frame = attackFrame;
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      assertEquals(target.grab.owner, 0);
    }
  }
});
