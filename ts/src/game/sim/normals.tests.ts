import { assertEquals, test } from "wisp/src/runtime/testing";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { fighterSlug, SELECTABLE_CHARACTERS } from "./heroes/registry";
import { attackStartupFrames, isAerialAttack } from "./moves";
import type { Roster } from "./roster";
import { testBeginAttacks, testWorld } from "./testWorld";

const LINGERING_AERIALS = [AttackStyle.neutralAir, AttackStyle.backAir] as const;

test("every fighter has a grounded close strike against an overlapping standing foe in both facings [spec #279]", () => {
  for (const character of SELECTABLE_CHARACTERS) for (const facing of [-1, 1]) {
    let connects = false;
    for (const style of [AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt]) {
      const owner = createFighter(character, 0.0, facing);
      const target = createFighter(Character.rifleman, 0.0, -facing);
      owner.motion.grounded = true;
      target.motion.grounded = true;
      const world = testWorld(owner, target);
      beginFighterAttack(world, 0, style, false);
      owner.attack.frame = attackStartupFrames(style, owner.tuning.moves);
      resolveAttacks(world);
      if (target.status.damage > 0.0) connects = true;
    }
    assertEquals(connects, true, `${fighterSlug(character)}, facing ${facing}, gap 0: standing foe untouched`);
  }
});

function prepareHitRegionAttack(world: Roster, attacker: Fighter, style: AttackStyle, frame: number): void {
  if (isAerialAttack(style)) attacker.motion.grounded = false;
  testBeginAttacks(world, style, undefined);
  assertEquals(attacker.attack.style, style);
  attacker.attack.frame = frame;
  attacker.attack.cooldown = attacker.attack.duration - frame;
}

test("aerial lingering windows match the reference frame boundaries [reference]", () => {
  for (const style of LINGERING_AERIALS) {
    const neutral = style === AttackStyle.neutralAir;
    const lastActive = neutral ? 31 : 19;
    const interruptible = neutral ? 42 : 38;
    for (let referenceFrame = 1; referenceFrame <= interruptible - 1; referenceFrame++) {
      const attacker = createFighter(Character.rifleman, 0.0, 1);
      const target = createFighter(Character.rifleman, -60.0, -1);
      const world = testWorld(attacker, target);
      prepareHitRegionAttack(world, attacker, style, referenceFrame - 1);
      resolveAttacks(world);
      const expected = referenceFrame < 4 || referenceFrame > lastActive ? 0.0 : referenceFrame < 8 ? (neutral ? 7.0 : 8.0) : 5.0;
      assertEquals(target.status.damage, expected);
    }
  }
});
