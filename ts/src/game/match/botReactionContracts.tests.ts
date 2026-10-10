import { reportTestLine } from "../../runtime/testReport";
import { mutableProjectile } from "../sim/fighterProjectiles";
import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { createRoster, fighterAt, neutralControls, sameControls } from "../sim/roster";
import { sameAttackBuffer } from "../input/attackBuffer";
import { produceComputerInput } from "./botPlay";
import { FAST_BOT_HISTORY_FRAMES, BOT_DIRECTION_MIN_FRAMES, BOT_HISTORY_FRAMES, type BotMemory, commitBotDirection, copyBotMemory, createBotMemory, clearBotMemory, observeOpponents, perceivedOpponent } from "./botPerception";
import { cpuSkill, cpuReactionFloor } from "./cpuSkill";
import { CPU_PROFILES, type CpuOpponentId, type CpuTier } from "./cpuProfiles";
import { createFrameControls } from "./controls";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { createMatchState, Phase } from "./rules";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { replayChecksum } from "../replay/matchReplay";
import { botObservationCanonical, canonicalState } from "../replay/canonical";
import { sweep, sweepSeed } from "../../runtime/sweep";

const SURPRISE_FRAME = 50;

function setup(opponent: CpuOpponentId = "wren", tier: CpuTier = "expert") {
  const own = createFighter(Character.rifleman, -150.0, 1);
  const target = createFighter(Character.rifleman, 150.0, -1);
  const world = createRoster(3, [own, target]);
  const game = createMatchState();
  game.phase = Phase.match;
  game.cpuOpponents[0] = opponent;
  game.cpuResolvedOpponents[0] = opponent;
  game.cpuTiers[0] = tier;
  return { own, target, world, game, runtime: createPacingAndPresentation(), controls: createFrameControls() };
}

const surprises: readonly ((target: Fighter) => void)[] = [
  target => { target.attack.style = AttackStyle.forwardSmash; target.attack.serial++; target.attack.frame = 0; },
  target => { target.shield.raised = true; },
  target => { target.motion.grounded = false; target.motion.z = 220.0; target.motion.vz = 8.0; },
  target => { target.motion.x = -300.0; target.motion.deltaX = -10.0; },
  target => { target.special.action = SpecialAction.riflemanBlaster; target.special.frame = 0;
    const p = mutableProjectile(target, 0); p.life = 100; p.x = 0.0; p.z = 45.0; p.direction = -1; p.velocityX = -12.0; p.serial++; },
];

sweep("150 surprise-action traces: no computer input responds before its authored observation delay [k3 measure #176]", () => {
  let early = 0;
  for (const profile of CPU_PROFILES) {
    const delay = cpuSkill(profile.opponent, profile.tier).reactionFrames;
    assertTrue(delay >= 14);
    for (const surprise of surprises) {
      const changed = setup(profile.opponent, profile.tier);
      const quiet = setup(profile.opponent, profile.tier);
      for (let frame = 1; frame < SURPRISE_FRAME + delay; frame++) {
        if (frame === SURPRISE_FRAME) surprise(changed.target);
        for (const game of [changed, quiet]) produceComputerInput(game.game, game.world, game.runtime, 0, frame, game.controls.inputs[0], game.controls.commands[0]);
        if (!sameControls(changed.controls.inputs[0], quiet.controls.inputs[0]) || !sameAttackBuffer(changed.controls.commands[0], quiet.controls.commands[0])) early++;
      }
      assertEquals(perceivedOpponent(changed.runtime.botMemory, changed.own, 0, SURPRISE_FRAME + delay - 1, delay)?.motion.z, 0.0);
      observeOpponents(changed.runtime.botMemory, changed.world, SURPRISE_FRAME + delay);
      const seen = assertDefined(perceivedOpponent(changed.runtime.botMemory, changed.own, 0, SURPRISE_FRAME + delay, delay));
      assertEquals(seen.motion.x, changed.target.motion.x);
      assertEquals(seen.motion.z, changed.target.motion.z);
      assertEquals(seen.shield.raised, changed.target.shield.raised);
      assertEquals(seen.attack.style, changed.target.attack.style);
      assertEquals(mutableProjectile(seen, 0).life, mutableProjectile(changed.target, 0).life);
    }
  }
  assertEquals(early, 0);
});

// The response precedes Rifleman's idle stretch and falls after his direction hold expires.
const RESPONSE_SURPRISE_FRAME = 39;

test("prepared guard and fresh run-in first inputs respect human reaction floors [k3 measure #354]", () => {
  for (const trained of [true, false]) {
    const changed = setup();
    const quiet = setup();
    for (const game of [changed, quiet]) game.own.shield.raised = trained;
    let first = -1;
    const floor = trained ? 14 : 19;
    for (let frame = 1; frame <= RESPONSE_SURPRISE_FRAME + 45 && first < 0; frame++) {
      if (frame === RESPONSE_SURPRISE_FRAME) changed.target.motion.x = -450.0;
      for (const game of [changed, quiet]) produceComputerInput(game.game, game.world, game.runtime, 0, frame, game.controls.inputs[0], game.controls.commands[0]);
      if (first < 0 && (!sameControls(changed.controls.inputs[0], quiet.controls.inputs[0]) || !sameAttackBuffer(changed.controls.commands[0], quiet.controls.commands[0]))) first = frame - RESPONSE_SURPRISE_FRAME;
    }
    assertTrue(first >= floor);
    for (const game of [changed, quiet]) clearBotMemory(game.runtime.botMemory);
  }
});

for (const tier of ["expert", "advanced", "intermediate"] as const) sweep(`1000 recorded prepared answers and 1000 fresh choices report actual ${tier} input reaction distributions [k3 measure #354]`, () => {
  for (const trained of [true, false]) {
    const distribution: number[] = [];
    for (let frame = 0; frame <= 60; frame++) distribution.push(0);
    let early = 0;
    let measured = 0;
    let unanswered = 0;
    for (let seed = 0; seed < 2000 && measured < 1000; seed++) {
      const changed = setup("wren", tier);
      const quiet = setup("wren", tier);
      for (const game of [changed, quiet]) { game.game.matchSeed = sweepSeed(seed); game.own.shield.raised = trained; }
      const start = 39;
      const floor = cpuReactionFloor(changed.own, cpuSkill("wren", tier));
      let first = -1;
      for (let frame = 1; frame <= start + 40 && first < 0; frame++) {
        if (frame === start) changed.target.motion.x = -450.0;
        for (const game of [changed, quiet]) produceComputerInput(game.game, game.world, game.runtime, 0, frame, game.controls.inputs[0], game.controls.commands[0]);
        if (first < 0 && (!sameControls(changed.controls.inputs[0], quiet.controls.inputs[0]) || !sameAttackBuffer(changed.controls.commands[0], quiet.controls.commands[0]))) first = frame - start;
      }
      for (const game of [changed, quiet]) clearBotMemory(game.runtime.botMemory);
      if (first < 0) { unanswered++; continue; }
      if (first < floor) early++;
      distribution[first] = (distribution[first] ?? 0) + 1;
      measured++;
    }
    reportTestLine(`${tier} ${trained ? "trained recognition" : "new decision (guess)"}: ${measured} actual responses within 40 frames, ${unanswered} unanswered, ${early} early; ${distribution.map((count, frame) => count > 0 ? `${frame}:${count}` : "").filter(row => row !== "").join(" ")}`);
    assertEquals(measured, 1000);
    assertEquals(early, 0);
    let cumulative = 0;
    let median = 0;
    let total = 0;
    let squares = 0;
    for (let frame = 0; frame < distribution.length; frame++) {
      const count = at(distribution, frame);
      cumulative += count;
      if (median === 0 && cumulative >= 500) median = frame;
      total += count * frame;
      squares += count * frame * frame;
    }
    const mean = f32(total / measured);
    const variance = f32(f32(squares / measured) - f32(mean * mean));
    reportTestLine(`${tier} ${trained ? "trained recognition" : "new decision (guess)"}: median ${median}, mean ${mean}, sd ${Math.sqrt(variance)}`);
    const expectedMedian = tier === "expert" ? 21 : tier === "advanced" ? 22 : 23;
    assertTrue(median >= expectedMedian - 1 && median <= expectedMedian + 1);
    assertTrue(variance >= 25 && variance <= 49);
  }
});

test("rapid grounded and airborne requests, including neutral braking, have zero reversals before four frames [k2 property]", () => {
  const memory = createBotMemory();
  const input = neutralControls();
  let previous = 0;
  let chosen = 0;
  let reversals = 0;
  let early = 0;
  for (let frame = 1; frame <= 500; frame++) {
    input.direction = floorMod(frame, 3) === 0 ? 0 : floorMod(frame, 2) === 0 ? -1 : 1;
    const braking = input.direction === 0;
    commitBotDirection(memory, 0, frame, input);
    if (braking) assertEquals(input.direction, 0);
    if (input.direction !== 0 && input.direction !== previous) {
      if (previous !== 0) { reversals++; if (frame - chosen < BOT_DIRECTION_MIN_FRAMES) early++; }
      previous = input.direction;
      chosen = frame;
    }
  }
  assertTrue(reversals > 50);
  assertEquals(early, 0);
});

sweep("all fighters' approach, retreat, air steering and recovery traces have zero early direction reversals [k1 scenario]", () => {
  let frames = 0;
  let reversals = 0;
  let early = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const game = setup();
    game.world.fighters[0] = createFighter(character, -150.0, 1);
    const own = fighterAt(game.world, 0);
    const row = createMatchFrameInput();
    let previous = 0;
    let chosen = 0;
    for (let frame = 1; frame <= 360; frame++) {
      // An idle target crosses the computer, stands above it, then moves away.
      game.target.motion.x = frame < 120 ? 280.0 : frame < 240 ? -280.0 : 400.0;
      game.target.motion.z = frame >= 120 && frame < 240 ? 170.0 : 0.0;
      if (frame === 240) { own.motion.grounded = false; own.motion.x = 900.0; own.motion.z = 110.0; own.motion.vx = -4.0; own.motion.vz = -1.0; }
      produceComputerInput(game.game, game.world, game.runtime, 0, frame, game.controls.inputs[0], game.controls.commands[0]);
      const direction = game.controls.inputs[0].direction;
      if (own.launch.hitlag <= 0 && own.grab.owner === undefined && direction !== 0 && direction !== previous) {
        if (previous !== 0) { reversals++; if (frame - chosen < BOT_DIRECTION_MIN_FRAMES) early++; }
        previous = direction;
        chosen = frame;
      }
      assertTrue(captureFrame(row, frame, game.world.mask, game.controls, game.runtime));
      assertTrue(executeMatchFrame(row, game.game, game.world, game.controls, game.runtime, frame));
      frames++;
    }
  }
  assertEquals(frames, SELECTABLE_CHARACTERS.length * 360);
  assertTrue(reversals > 13);
  assertEquals(early, 0);
});
