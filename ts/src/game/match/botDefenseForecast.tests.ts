import { mutableProjectile } from "../sim/fighterProjectiles";
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { chooseDefense } from "./botDefense";
import { cpuSkill } from "./cpuSkill";
import { useMatchSeed } from "./botRandom";

test("a delayed visible shot is defended at its predicted position without seeing a newer sample, across match seeds [invariant]", () => {
  const own = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.rifleman, 700.0, -1);
  own.motion.grounded = true;
  target.motion.grounded = true;
  const projectile = mutableProjectile(target, 0);
  projectile.life = 60;
  projectile.serial = 8;
  projectile.direction = -1;
  projectile.velocityX = -36.0;
  projectile.velocityZ = 0.0;
  projectile.z = 75.0;
  const skill = { ...cpuSkill("wren", "expert"), reactionFrames: 0 };
  const seeds = 12;
  let defended = 0;
  for (let seed = 0; seed < seeds; seed++) {
    useMatchSeed(seed * 101 + 3);
    projectile.serial = 8 + seed;
    projectile.x = 500.0;
    assertFalse(chooseDefense(own, target, 0, neutralControls(), skill));
    const predicted = neutralControls();
    const predictedDefends = chooseDefense(own, target, 0, predicted, skill, 12);
    assertEquals(projectile.x, 500.0);
    assertEquals(projectile.life, 60);
    projectile.x = 68.0;
    const current = neutralControls();
    assertEquals(predictedDefends, chooseDefense(own, target, 0, current, skill));
    assertEquals(predicted.shield, current.shield);
    assertEquals(predicted.groundDodgePressed, current.groundDodgePressed);
    assertEquals(predicted.groundDodgeDirection, current.groundDodgeDirection);
    if (predictedDefends) defended++;
  }
  useMatchSeed(0);
  // Expert defends 7 in 10; fewer than a third of 12 seeds has probability below 0.2%.
  assertTrue(defended >= seeds / 3);
});
