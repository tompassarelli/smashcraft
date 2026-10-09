import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { queueAttack } from "../input/attackBuffer";
import { beginFighterAttack, resolveAttacks } from "../sim/attacks";
import { AttackStyle, Character, DASH_GRAB_REQUEST, GroundAction } from "../sim/codes";
import { attackActive, attackStartup } from "../sim/conditions";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { authoredHitRegion, emptyHitRegion } from "../sim/hitRegions";
import { attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import { copyControls, createRoster, fighterAt } from "../sim/roster";
import { controls } from "../sim/testWorld";
import { createBufferedFrameControls } from "./controls";
import { Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

function duel(character: Character) {
  const game = createMatchState();
  game.phase = Phase.match;
  const world = createRoster(3, [createFighter(character, -40.0, 1), createFighter(character, 40.0, -1)]);
  return { game, world, inputs: createBufferedFrameControls() };
}

test("standing grabs across the roster meet scaled Melee reach, height and active frames within ten percent [spec #337]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 0.0, 1);
    const hit = emptyHitRegion();
    authoredHitRegion(hit, character, AttackStyle.grab, attackStartupFrames(AttackStyle.grab, fighter.tuning.moves), 0, 0, fighter.tuning.moves);
    assertTrue(Math.abs(hit.maxX - 96.0) <= f32(9.6));
    assertTrue(Math.abs(f32(hit.maxZ - hit.minZ) - 50.0) <= 5.0);
    assertEquals(characterAttackActiveFrames(character, AttackStyle.grab, fighter.tuning.moves), 3, fighterName(character));
  }
});

test("grab on every jump squat frame starts a grounded standing grab without takeoff [spec #337]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const count = createFighter(character, 0.0, 1).tuning.physics.jumpSquatFrames;
    for (let squatFrame = 0; squatFrame < count; squatFrame++) {
      const d = duel(character);
      const f = fighterAt(d.world, 0);
      for (let frame = 0; frame <= squatFrame; frame++) {
        copyControls(d.inputs.inputs[0], controls({ jumpPressed: frame === 0, jumpHeld: true, direction: 1 }));
        if (frame === squatFrame) queueAttack(d.inputs.commands[0], { style: AttackStyle.grab, facing: 0, frame: frame + 1, mayCharge: false });
        stepMatch(d.game, d.world, d.inputs, frame + 1);
      }
      const name = `${fighterName(character)} squat frame ${squatFrame}`;
      assertEquals(f.attack.style, AttackStyle.grab, name);
      assertEquals(f.attack.dashGrab, false, name);
      assertEquals(f.jump.squat, 0, name);
      assertEquals(f.jump.serial, 0, name);
      assertTrue(f.motion.grounded);
    }
  }
});

test("standing dash and pivot grabs catch Rifleman at their scaled limit for three frames and miss beyond it [spec #337]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const kind of [0, 1, 2]) {
      const reach = kind === 0 ? 96.0 : kind === 1 ? 120.0 : 144.0;
      for (const facing of [-1, 1]) {
        for (const caught of [false, true]) {
          for (let active = 0; active < 3; active++) {
            const d = duel(character);
            d.world.fighters[1] = createFighter(Character.rifleman, 0.0, -facing);
            const owner = fighterAt(d.world, 0);
            const target = fighterAt(d.world, 1);
            owner.motion.x = 0.0;
            owner.facing = facing;
            target.motion.x = f32((caught ? reach : f32(reach + 1.0)) * facing);
            if (kind === 1) owner.ground.dashFrame = 1;
            if (kind === 2) owner.ground.action = GroundAction.turnRun;
            beginFighterAttack(d.world, 0, kind === 1 ? DASH_GRAB_REQUEST : AttackStyle.grab, false);
            assertEquals(owner.attack.pivotGrab, kind === 2);
            assertEquals(attackActive(owner, AttackStyle.grab), 3);
            owner.attack.frame = attackStartup(owner, AttackStyle.grab) + active;
            resolveAttacks(d.world);
            assertEquals(owner.grab.target !== undefined, caught, `${fighterName(character)} kind ${kind} active ${active}`);
          }
        }
      }
    }
  }
});

test("a grab buffered during ordinary shield stun starts with jump out of shield, after the drain-resume frame, and catches before attack recovery [repro #337]", () => {
  const d = duel(Character.rifleman);
  const defender = fighterAt(d.world, 0);
  const attacker = fighterAt(d.world, 1);
  defender.shield.raised = true;
  defender.shield.heldFrames = 20;
  copyControls(d.inputs.inputs[0], controls({ shield: true, shieldStrength: 1.0 }));
  defender.motion.x = -20.0;
  attacker.motion.x = 20.0;
  beginFighterAttack(d.world, 1, AttackStyle.jab, false);
  let frame = 0;
  while (frame < 40 && defender.shield.stun === 0) stepMatch(d.game, d.world, d.inputs, ++frame);
  assertTrue(defender.shield.stun > 0);
  queueAttack(d.inputs.commands[0], { style: AttackStyle.grab, facing: 0, frame: frame + 1, mayCharge: false });

  let free = -1;
  while (frame < 80 && defender.attack.style !== AttackStyle.grab) {
    stepMatch(d.game, d.world, d.inputs, ++frame);
    if (free < 0 && defender.launch.hitlag === 0 && defender.shield.stun === 0) free = frame + 1;
    if (frame < free || free < 0) assertEquals(defender.attack.style, undefined, "grab waits for shield stun and the drain resume");
  }
  assertEquals(frame, free, "first free frame after the drain resume");
  assertEquals(defender.attack.style, AttackStyle.grab);
  while (frame < 100 && defender.grab.target === undefined && attacker.attack.cooldown > 0) stepMatch(d.game, d.world, d.inputs, ++frame);
  assertEquals(defender.grab.target, 1, "recovering attacker caught");
});
