import { sweep } from "../../runtime/sweep";
import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, DownState } from "./codes";
import { canAttack, isTumbling } from "./conditions";
import { createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "./heroes/registry";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { attackStartupFrames } from "./moves";
import { totalVelocityZ } from "./motion";
import { advanceFighter } from "./step";
import { controls, testWorld } from "./testWorld";

function checkDownSmash(character: Character, victims: readonly Character[], percents: readonly number[], facings: readonly number[]): void {
  for (const victim of victims) {
    for (const percent of percents) {
      for (const facing of facings) {
        for (const defense of ["tech", "toward", "away", "getup", "getupRoll", "getupAttack"] as const) {
          const owner = createFighter(character, -150.0 * facing, facing);
          const target = createFighter(victim, owner.motion.x + 70.0 * facing, -facing);
          const world = testWorld(owner, target);
          target.status.damage = percent;
          owner.motion.surface = 0;
          target.motion.surface = 0;
          beginFighterAttack(world, 0, AttackStyle.downSmash, false);
          owner.attack.frame = attackStartupFrames(AttackStyle.downSmash, owner.tuning.moves) - 1;
          owner.attack.cooldown -= owner.attack.frame;
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
            resolveAttacks(world);
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
}

for (const character of SELECTABLE_CHARACTERS) {
  // #208 measures the original thirteen-fighter field.
  if (character > Character.lichKing) continue;
  test(`${fighterName(character)} down smash gives every floor defense at 40 percent [spec #208]`, () => {
    checkDownSmash(character, [Character.rifleman], [40.0], [1]);
  });
  sweep(`${fighterName(character)} down smash gives floor defense at 20/40/60 percent in both facings against three bodies [spec #208]`, () => {
    checkDownSmash(character, [Character.demonHunter, Character.rifleman, Character.pitLord], [20.0, 40.0, 60.0], [-1, 1]);
  });
}
