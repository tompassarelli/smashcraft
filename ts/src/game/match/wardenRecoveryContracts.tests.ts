

import { assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { setWorldMotionValue } from "../sim/motion";
import { copyControls, createRoster, neutralControls } from "../sim/roster";
import { chooseRecoveryInput } from "./botRecovery";
import { createFrameControls } from "./controls";
import { Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

test("the computer's Warden blinks back to the stage from every spot in reach [spec #184]", () => {
  const spots = [
    [700.0, 100.0, 0], [700.0, -40.0, 0], [700.0, -150.0, 0], [800.0, 100.0, 0], [800.0, -40.0, 0], [800.0, -150.0, 0],
    [700.0, -300.0, 1], [800.0, -150.0, 1], [950.0, -40.0, 1], [950.0, -150.0, 1], [950.0, -300.0, 1],
  ] as const;
  for (const side of [-1, 1]) {
    for (const [out, z, jumps] of spots) {
      const x = f32(out * side);
      const warden = createFighter(Character.warden, x, -side);
      const opponent = createFighter(Character.rifleman, f32(-300.0 * side), side);
      warden.motion.z = z;
      setWorldMotionValue(warden.motion.meleeZ, z);
      warden.motion.grounded = false;
      warden.motion.surface = undefined;
      warden.jump.remaining = jumps;
      const game = createMatchState();
      game.phase = Phase.match;
      game.stageChoice = 0;
      const roster = createRoster(3, [warden, opponent]);
      const input = neutralControls();
      const controls = createFrameControls();
      for (let frame = 1; frame <= 300; frame++) {
        input.direction = 0;
        input.jumpPressed = false;
        input.jumpHeld = false;
        chooseRecoveryInput(warden, 0, 0, input);
        copyControls(controls.inputs[0], input);
        stepMatch(game, roster, controls, frame);
        if (warden.status.out || warden.status.stocks < 3 || (warden.motion.grounded && Math.abs(warden.motion.x) <= 600.0)) break;
      }
      assertFalse(warden.status.out);
      assertTrue(warden.status.stocks === 3 && warden.motion.grounded && Math.abs(warden.motion.x) <= 600.0);
    }
  }
});
