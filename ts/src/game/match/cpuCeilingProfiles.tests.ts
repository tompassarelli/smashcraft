import { test, assertEquals, assertTrue } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { cpuSkill } from "./cpuSkill";
import { ceilingSkill } from "./cpuCeilingProfiles";
import { chooseHitlagInput, applyAerialExecutionNoise } from "./botExecutionNoise";

test("perfect execution keeps correct DI and short hops in 500 opportunities [spec #358]", () => {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const skill = ceilingSkill(cpuSkill("wren", "expert"), "execution");
  f.launch.diPending = true;
  f.launch.knockbackX = 20.0;
  f.launch.knockbackZ = 0.0;
  f.launch.diLaunchSpeed = 30.0;
  f.launch.hitstun = 30;
  for (let index = 0; index < 500; index++) {
    f.visuals.hit = index;
    const input = neutralControls();
    chooseHitlagInput(f, 0, 2, skill, input);
    assertEquals(input.direction, 0);
    assertEquals(input.verticalDirection, 1);
    assertTrue(input.sdiPulse);
    f.launch.hitstun = 0;
    f.motion.grounded = true;
    f.jump.serial = index;
    input.jumpPressed = true;
    input.jumpHeld = false;
    applyAerialExecutionNoise(f, undefined, 0, skill, input);
    assertTrue(input.shortHopPressed);
    assertEquals(input.jumpHeld, false);
    f.launch.hitstun = 30;
  }
});
