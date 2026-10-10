import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, HeroStatusKind } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import { createFighter } from "./fighter";
import { applyAttackHit } from "./hits";
import { createRoster } from "./roster";

for (const character of [Character.blademaster, Character.mountainKing, Character.warden, Character.lich, Character.forsakenPaladin,
  Character.dreadlord, Character.shadowHunter, Character.pitLord, Character.beastmaster, Character.lichKing, Character.thrall,
  Character.cairne, Character.chen, Character.peon, Character.tinker]) {
  test(`fighter ${character} repeated ordinary contacts add no counted damage, healing, chill or jump refund [k3 measure #148]`, () => {
    const source = createFighter(character === Character.forsakenPaladin ? Character.rifleman : character, 0.0, 1);
    const target = createFighter(character, 40.0, -1);
    const world = createRoster(3, [source, target]);
    source.status.damage = 40.0;
    source.attack.style = AttackStyle.jab;
    source.motion.grounded = false;
    source.jump.remaining = 0;
    for (let hit = 1; hit <= 5; hit++) {
      source.attack.serial = hit;
      beginDamageContacts();
      applyAttackHit(world, 0, 1, AttackStyle.jab, 1, { damage: 8.0, growth: 0.0, base: 0.0, launchX: 1.0, launchZ: 0.0, electric: false }, true, false);
      finishDamageContacts(world);
      assertEquals(target.status.damage, hit * 8.0);
      assertEquals(source.status.damage, 40.0);
      assertEquals(source.status.condition, HeroStatusKind.none);
      assertEquals(source.jump.remaining, 0);
    }
  });
}
