import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep } from "../../runtime/sweep";
import { Character, AttackStyle } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { copyFighterState } from "../replay/fighterState";
import { advanceFighter } from "../sim/step";
import { applyDirectionalInfluence } from "../sim/knockback";
import { applySmashDirectionalInfluence } from "../sim/smashDirectionalInfluence";
import { attackStartupFrames } from "../sim/moves";
import { beginFighterAttack } from "../sim/attacks";
import { queueAttack } from "../input/attackBuffer";
import { createRoster, fighterAt, copyControls } from "../sim/roster";
import { createBufferedFrameControls } from "./controls";
import { createMatchState, Phase } from "./rules";
import { stepMatch } from "./step";
import { contactBatch, controls, hitEffect, soloWorld, testWorld } from "../sim/testWorld";
import { applyAttackHit } from "../sim/hits";
import { CPU_OPPONENT_IDS, CPU_TIERS, type CpuOpponentId, type CpuTier } from "./cpuProfiles";
import { applyAerialExecutionNoise, chooseHitlagInput } from "./botExecutionNoise";
import { melee } from "../sim/tuning";
import { cpuSkill } from "./cpuSkill";
import { useMatchSeed } from "./botRandom";

declare const console: { log(line: string): void };

/** Every count follows an executed input, rather than a random draw or an authored rate. */
export function measureDefenceExecution(opponent: CpuOpponentId, tier: CpuTier, events: number) {
  const skill = cpuSkill(opponent, tier);
  const base = createFighter(Character.rifleman, -100.0, 1);
  const f = createFighter(Character.rifleman, -100.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  const world = soloWorld(f);
  const input = controls();
  const result = { noDi: 0, wrongDi: 0, strongSdi: 0, followupSdi: 0, wrongSdi: 0, fullHop: 0, aerial: 0 };
  for (let event = 0; event < events; event++) {
    useMatchSeed(event);
    copyFighterState(f, base, 1);
    f.visuals.hit = event + 1;
    f.status.damage = 100.0;
    f.motion.grounded = false;
    f.motion.surface = undefined;
    f.motion.z = 200.0;
    f.launch.hitlag = 9;
    f.launch.hitlagFrames = 9;
    f.launch.diLaunchSpeed = melee(3.0);
    f.launch.hitstun = 30;
    f.launch.diPending = true;
    f.launch.knockbackX = 100.0;
    f.launch.knockbackZ = 40.0;
    chooseHitlagInput(f, 0, 2, skill, input);
    applyDirectionalInfluence(f, input);
    if (input.direction === 0 && input.verticalDirection === 0) result.noDi++;
    else if (f.launch.diAngleDegrees < 0) result.wrongDi++;
    for (const followup of [false, true]) {
      copyFighterState(f, base, 1);
      f.visuals.hit = event + 1;
      f.status.damage = 100.0;
      f.motion.grounded = false;
      f.motion.surface = undefined;
      f.motion.z = 200.0;
      f.launch.diPending = true;
      f.launch.hitlag = followup ? 3 : 9;
      f.launch.hitlagFrames = f.launch.hitlag;
      f.launch.sdiFollowup = followup;
      f.launch.knockbackX = 100.0;
      f.launch.knockbackZ = 40.0;
      const before = f.motion.x;
      for (let tick = 0; tick < f.launch.hitlagFrames; tick++) {
        const sdi = controls();
        chooseHitlagInput(f, 0, tick + 1, skill, sdi);
        applySmashDirectionalInfluence(world, 0, 0, tick + 1, sdi);
      }
      if (f.motion.x === before) {
        if (followup) result.followupSdi++;
        else result.strongSdi++;
      } else if (!followup && f.motion.x > before) result.wrongSdi++;
    }
    copyFighterState(f, base, 1);
    f.jump.serial = event;
    for (let frame = 0; frame < 8; frame++) {
      const jump = controls({ jumpPressed: frame === 0 });
      applyAerialExecutionNoise(f, target, 0, skill, jump);
      advanceFighter(world, 0, 0, jump, -100.0);
      if (!f.motion.grounded) break;
    }
    if (f.motion.vz === f.tuning.physics.fullJumpSpeed) result.fullHop++;
    copyFighterState(f, base, 1);
    f.motion.grounded = false;
    f.motion.surface = undefined;
    f.motion.z = 400.0;
    f.motion.vz = -1.0;
    f.attack.style = AttackStyle.forwardAir;
    f.attack.serial = event + 1;
    f.attack.duration = 60;
    f.attack.frame = attackStartupFrames(AttackStyle.forwardAir, f.tuning.moves);
    for (let frame = 0; frame < 12; frame++) {
      const drift = controls({ direction: -1 });
      applyAerialExecutionNoise(f, target, 0, skill, drift);
      advanceFighter(world, 0, 0, drift, -100.0);
    }
    if (f.motion.x > -115.0) result.aerial++;
  }
  useMatchSeed(0);
  return result;
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
    assertEquals(target.launch.hitlagFrames, 9);
    assertEquals(target.launch.sdiFollowup, age === 15);
    assertEquals(target.launch.sdiStringTravel, 0);
  }
});

for (const opponent of CPU_OPPONENT_IDS) {
  sweep(`${opponent} defence executes 2000 opportunities per tier with monotonic human slips [spec #357]`, () => {
    let previous = { noDi: 2000, wrongDi: 2000, strongSdi: 2000, followupSdi: 2000, wrongSdi: 2000, fullHop: 2000, aerial: 2000 };
    for (const tier of CPU_TIERS) {
      const counts = measureDefenceExecution(opponent, tier, 2000);
      console.log(`${opponent} ${tier} /2000 noDI=${counts.noDi} wrongDI=${counts.wrongDi} strongSDImissed=${counts.strongSdi} followupSDImissed=${counts.followupSdi} wrongSDI=${counts.wrongSdi}/${2000 - counts.strongSdi} attempts fullHop=${counts.fullHop} aerial=${counts.aerial}`);
      for (const key of ["noDi", "wrongDi", "strongSdi", "followupSdi", "fullHop", "aerial"] as const) assertEquals(counts[key] <= previous[key], true, `${opponent} ${tier} ${key}: ${counts[key]} <= ${previous[key]}`);
      if (tier === "expert") {
        assertEquals(counts.noDi >= 240 && counts.noDi <= 320, true, `no DI ${counts.noDi}/2000`);
        assertEquals(counts.wrongDi >= 60 && counts.wrongDi <= 120, true, `wrong DI ${counts.wrongDi}/2000`);
        assertEquals(counts.strongSdi >= 1160 && counts.strongSdi <= 1320, true, `strong SDI ${counts.strongSdi}/2000`);
        assertEquals(counts.followupSdi >= 1700 && counts.followupSdi <= 1820, true, `followup SDI ${counts.followupSdi}/2000`);
        assertEquals(counts.fullHop >= 12 && counts.fullHop <= 24, true, `fullHop ${counts.fullHop}/2000`);
        assertEquals(counts.aerial >= 40 && counts.aerial <= 100, true, `aerial ${counts.aerial}/2000`);
      }
      previous = counts;
    }
  });
}


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
  // Search shared seeds for the first actual inward drift, then record both executed cases.
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
  console.log(`spacing seed=${seed} proper x=${proper.landingX} shieldTicks=${proper.shieldHits} grabbed=${proper.grabbed}; miss x=${miss.landingX} shieldTicks=${miss.shieldHits} grabbed=${miss.grabbed}`);
  assertEquals(proper.grabbed, false);
  assertEquals(miss.grabbed, true);
  assertGreaterThan(miss.shieldHits, 0);
});
