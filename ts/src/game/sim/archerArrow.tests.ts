// Swift Arrow's repeat and defense contracts (#172), through recorded-match frames.
import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { executeNext, testMatch } from "../match/testMatch";
import { queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { canAttack } from "./conditions";
import { copyControls, fighterAt } from "./roster";
import { controls } from "./testWorld";

const shield = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });

test("Swift Arrow repeats no sooner than 30 frames and cannot jump out of its draw or recovery", () => {
  const match = testMatch(3, Character.archer);
  const archer = fighterAt(match.world, 0);
  archer.facing = -1;
  const starts: number[] = [];
  let emitted = false;
  for (let frame = 1; frame <= 180; frame++) {
    copyControls(match.inputs.inputs[0], controls({ specialPressed: (frame & 1) === 0, jumpPressed: frame === 18 }));
    executeNext(match);
    if (archer.special.action === SpecialAction.archerArrow && archer.special.frame === 1) starts.push(frame);
    if (frame < 17) assertTrue(archer.projectiles.every(projectile => projectile.life === 0));
    if (frame === 17) {
      const arrow = archer.projectiles.find(projectile => projectile.life > 0);
      assertTrue(arrow !== undefined);
      if (arrow !== undefined) {
        assertEquals(arrow.life, 44);
        assertEquals(arrow.velocityX, -28.0);
        assertEquals(arrow.z, 45.0);
      }
      emitted = true;
    }
    if (frame === 18) {
      assertTrue(archer.motion.grounded);
      assertEquals(archer.jump.squat, 0);
      assertFalse(canAttack(archer));
    }
  }
  assertTrue(emitted);
  assertEquals(starts.join(","), "2,32,62,92,122,152");
});

test("a held shield stops six repeated Swift Arrows at 240 without shieldstun or body damage", () => {
  const match = testMatch(3, Character.archer);
  const archer = fighterAt(match.world, 0);
  const defender = fighterAt(match.world, 1);
  archer.motion.x = -240.0;
  defender.motion.x = 0.0;
  for (let frame = 1; frame <= 180; frame++) {
    copyControls(match.inputs.inputs[0], controls({ specialPressed: (frame & 1) === 0 }));
    copyControls(match.inputs.inputs[1], shield);
    executeNext(match);
    assertEquals(defender.status.damage, 0.0);
    assertEquals(defender.shield.stun, 0);
    assertEquals(defender.launch.hitlag, 0);
  }
  assertGreaterThan(defender.shield.energy, 0.0);
});

test("Swift Arrow deals 5 percent without interrupting the defender; a jump during the draw clears it", () => {
  for (const jump of [false, true]) {
    const match = testMatch(3, Character.archer);
    const archer = fighterAt(match.world, 0);
    const defender = fighterAt(match.world, 1);
    archer.motion.x = -240.0;
    defender.motion.x = 0.0;
    for (let frame = 1; frame <= 30; frame++) {
      copyControls(match.inputs.inputs[0], controls({ specialPressed: frame === 2 }));
      copyControls(match.inputs.inputs[1], controls({ jumpPressed: jump && frame === 4, jumpHeld: jump && frame < 24 }));
      executeNext(match);
      assertEquals(defender.launch.hitlag, 0);
      assertEquals(defender.launch.hitstun, 0);
    }
    assertEquals(defender.status.damage, jump ? 0.0 : 5.0);
  }
});

test("at 60 units a shield grab after blocking Swift Arrow catches Archer during her recovery", () => {
  const match = testMatch(3, Character.archer);
  const archer = fighterAt(match.world, 0);
  const defender = fighterAt(match.world, 1);
  archer.motion.x = -30.0;
  defender.motion.x = 30.0;
  defender.facing = -1;
  for (let frame = 1; frame <= 23; frame++) {
    copyControls(match.inputs.inputs[0], controls({ specialPressed: frame === 2 }));
    copyControls(match.inputs.inputs[1], shield);
    if (frame === 18) queueAttack(match.inputs.commands[1], { style: AttackStyle.grab, facing: -1, frame, mayCharge: false });
    executeNext(match);
    assertEquals(defender.status.damage, 0.0);
  }
  assertEquals(archer.grab.owner, 1);
  assertEquals(defender.grab.target, 0);
});
