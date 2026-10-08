import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character, DownState, GrabAction } from "./codes";
import { canAttack, isTumbling } from "./conditions";
import { createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "./heroes/registry";
import { resolveGrabs } from "./grabs";
import { GRAB_HOLD_FRAMES, grabContactFrame } from "./moves";
import { totalVelocityZ } from "./motion";
import { advanceFighter } from "./step";
import { controls, testGrabFrame, testWorld } from "./testWorld";

for (const character of SELECTABLE_CHARACTERS) {
  // #208 measures the original thirteen-fighter field.
  if (character > Character.lichKing) continue;
  test(`${fighterName(character)} down throw gives floor defense at 20/40/60 percent [spec #208]`, () => {
    for (const victim of [Character.archer, Character.rifleman, Character.pitLord]) {
      for (const percent of [20.0, 40.0, 60.0]) {
        for (const facing of [-1, 1]) {
          for (const defense of ["tech", "toward", "away", "getup", "getupRoll", "getupAttack"] as const) {
            const owner = createFighter(character, -150.0 * facing, facing);
            const target = createFighter(victim, owner.motion.x + 70.0 * facing, -facing);
            const world = testWorld(owner, target);
            target.status.damage = percent;
            owner.motion.surface = 0;
            target.motion.surface = 0;
            owner.grab.action = GrabAction.throwDown;
            owner.grab.frame = grabContactFrame(GrabAction.throwDown, owner.tuning.moves) - 1;
            owner.grab.target = 1;
            target.grab.owner = 0;
            target.grab.grabbedFrames = GRAB_HOLD_FRAMES;
            const neutral = controls();
            const input = controls();
            let techPressed = false;
            let landed = false;
            let floorState: DownState = DownState.none;
            let ownerReady = -1;
            let victimReady = -1;
            for (let frame = 1; frame <= 220; frame++) {
              const tech = defense === "tech" || defense === "toward" || defense === "away";
              input.techPressed = tech && !techPressed && isTumbling(target) && target.launch.hitlag <= 0
                && totalVelocityZ(target) < 0 && target.motion.z < 50.0;
              techPressed = techPressed || input.techPressed;
              input.direction = techPressed && !landed ? defense === "toward" ? -facing : defense === "away" ? facing : 0 : 0;
              input.verticalDirection = defense === "getup" && target.down.state === DownState.wait ? 1 : 0;
              if (defense === "getupRoll" && target.down.state === DownState.wait) input.direction = facing;
              input.getupAttackPressed = defense === "getupAttack" && target.down.state === DownState.wait;
              advanceFighter(world, 0, 0, neutral, 0.0);
              advanceFighter(world, 1, 0, input, 0.0);
              testGrabFrame(world, [neutral, input], owner.launch.hitlag > 0 || target.launch.hitlag > 0);
              resolveGrabs(world);
              landed = landed || target.down.state === DownState.bound || target.down.state === DownState.tech || target.down.state === DownState.techRoll;
              if (floorState === DownState.none && landed) floorState = target.down.state;
              if (ownerReady < 0 && canAttack(owner)) ownerReady = frame;
              if (landed && canAttack(target)) { victimReady = frame; break; }
            }
            const label = `${fighterName(victim)} ${percent}% facing ${facing} ${defense}`;
            assertEquals(target.status.damage > percent, true, label + " contact");
            assertEquals(landed, true, label + " landed in tech or knockdown");
            const expected = defense === "tech" ? DownState.tech : defense === "toward" || defense === "away" ? DownState.techRoll : DownState.bound;
            assertEquals(floorState, expected, label + " chosen floor defense");
            assertEquals(ownerReady > 0, true, label + " attacker acts");
            assertEquals(victimReady > ownerReady, true, label + ` attacker ready ${ownerReady}, defense ends ${victimReady}`);
          }
        }
      }
    }
  });
}
