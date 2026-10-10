import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { Character, AttackStyle } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { copyFighterState } from "../replay/fighterState";
import { attackStartupFrames } from "../sim/moves";
import { beginFighterAttack } from "../sim/attacks";
import { queueAttack } from "../input/attackBuffer";
import { createRoster, copyControls } from "../sim/roster";
import { createBufferedFrameControls } from "./controls";
import { createMatchState, Phase } from "./rules";
import { stepMatch } from "./step";
import { contactBatch, controls, hitEffect, testWorld } from "../sim/testWorld";
import { applyAttackHit } from "../sim/hits";
import { applyAerialExecutionNoise, chooseHitlagInput } from "./botExecutionNoise";
import { cpuSkill } from "./cpuSkill";
import { useMatchSeed } from "./botRandom";

declare const console: { log(line: string): void };
declare const print: (this: void, line: string) => void;

function report(line: string): void {
  if (typeof console === "undefined") print(line);
  else console.log(line);
}


function spacingPunishCase(seed: number, noise: boolean) {
  const game = createMatchState();
  game.phase = Phase.match;
  const attacker = createFighter(Character.rifleman, -85.0, 1);
  const defender = createFighter(Character.rifleman, 0.0, -1);
  const world = createRoster(3, [attacker, defender]);
  const inputs = createBufferedFrameControls();
  attacker.motion.grounded = false;
  attacker.motion.surface = undefined;
  attacker.motion.z = 45.0;
  attacker.motion.vz = -1.0;
  defender.shield.raised = true;
  defender.shield.heldFrames = 20;
  beginFighterAttack(world, 0, AttackStyle.forwardAir, false);
  attacker.attack.serial = seed + 1;
  attacker.attack.frame = attackStartupFrames(AttackStyle.forwardAir, attacker.tuning.moves);
  let shieldHits = 0, landingX = 0.0, landed = false;
  let grabQueued = false;

  for (let frame = 1; frame <= 60; frame++) {
    const drift = controls({ direction: attacker.motion.grounded ? 0 : -1 });
    useMatchSeed(seed);
    if (noise) applyAerialExecutionNoise(attacker, defender, 0, cpuSkill("wren", "expert"), drift);
    useMatchSeed(0);
    copyControls(inputs.inputs[0], drift);
    copyControls(inputs.inputs[1], controls({ shield: true, shieldStrength: 1.0 }));
    if (landed && !grabQueued && defender.shield.stun === 0 && defender.launch.hitlag === 0) {
      queueAttack(inputs.commands[1], { style: AttackStyle.grab, facing: -1, frame, mayCharge: false });
      grabQueued = true;
    }
    stepMatch(game, world, inputs, frame);
    if (defender.shield.stun > 0) shieldHits++;
    if (!landed && attacker.motion.grounded) { landed = true; landingX = attacker.motion.x; }
    if (defender.grab.target !== undefined) break;
  }
  return { grabbed: defender.grab.target === 0, shieldHits, landingX };
}

test("executed Expert aerial drift errors give a shield grab that proper spacing avoids, across seeds [k1 scenario]", () => {
  const f = createFighter(Character.rifleman, -85.0, 1);
  f.motion.grounded = false;
  f.attack.style = AttackStyle.forwardAir;
  const target = createFighter(Character.rifleman, 0.0, -1);
  const errors = 4;
  let found = 0, grabbed = 0;
  for (let event = 0; event < 4000 && found < errors; event++) {
    f.attack.serial = event + 1;
    for (let frame = 0; frame < 8; frame++) {
      f.attack.frame = attackStartupFrames(AttackStyle.forwardAir, f.tuning.moves) + frame;
      const input = controls({ direction: -1 });
      useMatchSeed(event);
      applyAerialExecutionNoise(f, target, 0, cpuSkill("wren", "expert"), input);
      useMatchSeed(0);
      if (input.direction !== 1) continue;
      found++;
      const proper = spacingPunishCase(event, false);
      const miss = spacingPunishCase(event, true);
      assertEquals(proper.grabbed, false, `seed ${event}`);
      assertGreaterThan(miss.shieldHits, 0);
      if (miss.grabbed) grabbed++;
      break;
    }
  }
  report(`spacing errors=${found} grabbed=${grabbed}`);
  assertEquals(found, errors);
  // 14 of the first 16 errors are grabbed, including the first four; an error landing late in the drift window can stay safe.
  assertGreaterThan(grabbed, errors / 2);
});
