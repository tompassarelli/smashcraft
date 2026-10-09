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

test("defence uses the observed launch angle and combo or survival goal [spec #357]", () => {
  const f = createFighter(Character.rifleman, -100.0, 1);
  f.launch.diPending = true;
  f.launch.hitlag = 4;
  f.launch.knockbackX = 100.0;
  f.launch.knockbackZ = 40.0;
  const input = controls();
  const skill = { ...cpuSkill("wren", "expert"), executionMistakes: false };
  let survival = 0, combo = 0;
  for (let hit = 0; hit < 100; hit++) {
    f.visuals.hit = hit;
    f.status.damage = 100.0;
    chooseHitlagInput(f, 0, 2, skill, input);
    if (input.verticalDirection === 1) survival++;
    f.status.damage = 0.0;
    chooseHitlagInput(f, 0, 2, skill, input);
    if (input.verticalDirection === -1) combo++;
  }
  assertGreaterThan(survival, 90);
  assertGreaterThan(combo, 90);
});

test("SDI follow-ups use the previous hitlag end even when no SDI was attempted [spec #357]", () => {
  const attacker = createFighter(Character.rifleman, -100.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  const base = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(attacker, target);
  for (const age of [15, 16]) {
    copyFighterState(target, base, 1);
    target.launch.hitlagEndAge = age;
    contactBatch(world, () => applyAttackHit(world, 0, 1, AttackStyle.jab, 1, hitEffect(18.0, 100.0, 20.0, 1.0, 1.0), true, false));
    assertEquals(target.launch.sdiFollowup, age === 15);
    assertEquals(target.launch.sdiStringTravel, 0);
  }
});


export function spacingPunishCase(seed: number, noise: boolean) {
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

test("an executed Expert aerial drift error gives a shield grab that proper spacing avoids [spec #357]", () => {

  let seed = -1;
  const f = createFighter(Character.rifleman, -85.0, 1);
  f.motion.grounded = false;
  f.attack.style = AttackStyle.forwardAir;
  const target = createFighter(Character.rifleman, 0.0, -1);
  for (let event = 0; event < 2000 && seed < 0; event++) {
    f.attack.serial = event + 1;
    for (let frame = 0; frame < 8 && seed < 0; frame++) {
      f.attack.frame = attackStartupFrames(AttackStyle.forwardAir, f.tuning.moves) + frame;
      const input = controls({ direction: -1 });
      useMatchSeed(event);
      applyAerialExecutionNoise(f, target, 0, cpuSkill("wren", "expert"), input);
      if (input.direction === 1) seed = event;
    }
  }
  useMatchSeed(0);
  assertGreaterThan(seed, -1);
  const proper = spacingPunishCase(seed, false);
  const miss = spacingPunishCase(seed, true);
  report(`spacing seed=${seed} proper x=${proper.landingX} shieldTicks=${proper.shieldHits} grabbed=${proper.grabbed}; miss x=${miss.landingX} shieldTicks=${miss.shieldHits} grabbed=${miss.grabbed}`);
  assertEquals(proper.grabbed, false);
  assertEquals(miss.grabbed, true);
  assertGreaterThan(miss.shieldHits, 0);
});
