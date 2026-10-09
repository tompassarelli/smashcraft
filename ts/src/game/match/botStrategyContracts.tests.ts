import { HabitChoice } from "./botHabits";
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { assertDefined, assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { attackBuffer, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster, neutralControls } from "../sim/roster";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { createBufferedFrameControls, createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { createMatchState, Phase } from "./rules";
import { createBotStrategy, copyBotStrategy, learnBotHabit, prepareBotRead, pressBotRead, botStrategyValues, restoredBotStrategy, savedBotStrategy } from "./botStrategy";
import type { CpuDecisionPolicy } from "./cpuDecisionPolicy";
import { cpuProfile } from "./cpuProfiles";
import { VARIETY_FRAMES, VARIETY_PASS_STARTS, chooseAttack } from "./botMoves";
import { useMatchSeed } from "./botRandom";
import { cpuSkill } from "./cpuSkill";
import { produceComputerInput } from "./botPlay";
import { estimatedMoveValue, comebackPressure, type MoveEstimate } from "./botMoveValue";
import { observeOpponents, perceivedOpponent } from "./botPerception";

const EXPERT = cpuProfile("wren", "expert");

test("Thrall saves Chain Lightning for a retreat beyond hammer range [repro #279]", () => {
  const own = createFighter(Character.thrall, 0.0, 1);
  const target = createFighter(Character.rifleman, 300.0, -1);
  const casts = (gap: number, drift: number): number => {
    target.motion.x = gap;
    target.motion.deltaX = drift;
    let lightning = 0;
    for (let frame = 1; frame <= 120; frame++) {
      const input = neutralControls();
      chooseAttack(own, target, 0, frame, frame, true, input, attackBuffer(6), 0, -1, cpuSkill("wren", "expert"));
      if (input.specialPressed && input.specialX === 0 && input.specialZ === 0) lightning++;
    }
    return lightning;
  };
  assertEquals(casts(300.0, -2.0), 0, "approaching target");
  assertEquals(casts(300.0, 0.0), 0, "standing target");
  assertEquals(casts(80.0, 2.0), 0, "target in hammer range");
  assertEquals(casts(520.0, 2.0), 0, "retreat beyond the spacing band");
  assertGreaterThan(casts(300.0, 2.0), 0);
});

function trained(choice: number, policy: CpuDecisionPolicy = EXPERT, cycles = 8) {
  const own = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.rifleman, 60.0, -1);
  const strategy = createBotStrategy();
  for (let frame = 0; frame < cycles * 60; frame++) {
    const action = floorMod(frame, 60) < 8;
    target.shield.raised = action && choice === HabitChoice.shield;
    target.attack.style = action && choice === HabitChoice.attack ? AttackStyle.jab : undefined;
    if (action && floorMod(frame, 60) === 0) target.attack.serial++;
    learnBotHabit(strategy, own, target, 1, frame, policy);
  }
  target.attack.style = undefined;
  target.shield.raised = false;
  return { own, target, strategy };
}

function readyRead(choice: number) {
  const game = trained(choice);
  for (let seed = 0; seed < 100; seed++) {
    useMatchSeed(seed);
    prepareBotRead(game.strategy, game.own, game.target, 491, 12, EXPERT);
    if (game.strategy.readActive) break;
  }
  useMatchSeed(0);
  assertTrue(game.strategy.readActive);
  const read = assertDefined(savedBotStrategy(game.strategy).read);
  assertEquals(read.choice, choice);
  assertEquals(read.expectedFrame, 540);
  return game;
}

test("delayed habit history is bounded by context, switches opponents and adapts to a changed repeated pattern [spec #182]", () => {
  const game = trained(HabitChoice.shield, { ...EXPERT, historyCapacity: 6 }, 20);
  assertEquals(savedBotStrategy(game.strategy).history.length, 6);
  assertTrue(savedBotStrategy(game.strategy).history.every(habit => habit.choice === HabitChoice.shield));
  for (let frame = 1200; frame < 1620; frame++) {
    const action = floorMod(frame, 60) < 8;
    game.target.attack.style = action ? AttackStyle.jab : undefined;
    if (action && floorMod(frame, 60) === 0) game.target.attack.serial++;
    learnBotHabit(game.strategy, game.own, game.target, 1, frame, { ...EXPERT, historyCapacity: 6 });
  }
  assertEquals(savedBotStrategy(game.strategy).history.length, 6);
  assertTrue(savedBotStrategy(game.strategy).history.every(habit => habit.choice === HabitChoice.attack));
  learnBotHabit(game.strategy, game.own, game.target, 2, 1621, EXPERT);
  assertEquals(game.strategy.opponent, 2);
  assertLessThan(savedBotStrategy(game.strategy).history.length, 2);
});

test("bot habit snapshots retain owned scalar storage and exact replay values through learning and restore [invariant]", () => {
  const game = trained(HabitChoice.shield);
  const snapshot = createBotStrategy();
  copyBotStrategy(snapshot, game.strategy);
  const values = botStrategyValues(snapshot).join(",");
  const saved = savedBotStrategy(snapshot);
  const restored = restoredBotStrategy(saved);
  assertEquals(botStrategyValues(restored).join(","), values);
  game.target.attack.style = AttackStyle.jab;
  game.target.attack.serial++;
  learnBotHabit(game.strategy, game.own, game.target, 1, 501, EXPERT);
  assertEquals(botStrategyValues(snapshot).join(","), values);
  copyBotStrategy(snapshot, game.strategy);
  assertEquals(botStrategyValues(snapshot).join(","), botStrategyValues(game.strategy).join(","));
  copyBotStrategy(snapshot, restored);
  assertEquals(botStrategyValues(snapshot).join(","), values);
});

test("a learned shield read positions and buffers a grab before the next shield is observable [spec #182]", () => {
  const game = readyRead(HabitChoice.shield);
  const input = neutralControls();
  const commands = attackBuffer(6);
  assertEquals(game.target.shield.raised, false);
  game.own.motion.x = -60.0;
  assertTrue(pressBotRead(game.strategy, game.own, game.target, 0, 500, 500, input, commands));
  assertTrue(input.direction !== 0);
  game.own.motion.x = 0.0;
  input.direction = 0;
  assertTrue(pressBotRead(game.strategy, game.own, game.target, 0, 534, 534, input, commands));
  assertTrue(input.attackHeld);
  assertTrue(game.strategy.readActed);
});

test("an anticipatory grab remains buffered through four frames of own recovery [spec #182]", () => {
  const game = readyRead(HabitChoice.shield);
  const world = createRoster(3, [game.own, game.target]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.cpuOpponents[0] = "wren";
  match.cpuResolvedOpponents[0] = "wren";
  match.cpuTiers[0] = "expert";
  const runtime = createPacingAndPresentation();
  runtime.simulationFrame = 533;
  runtime.botStrategies[0] = game.strategy;
  for (let frame = 510; frame <= 533; frame++) observeOpponents(runtime.botMemory, world, frame);
  game.own.attack.cooldown = 4;
  const controls = createBufferedFrameControls();
  const produced = createFrameControls();
  const row = createMatchFrameInput();
  let started = -1;
  for (let frame = 534; frame <= 539; frame++) {
    produceComputerInput(match, world, runtime, 0, frame, produced.inputs[0], produced.commands[0]);
    if (frame === 534) assertEquals(assertDefined(produced.commands[0].pending).style, AttackStyle.grab);
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
    if (game.own.attack.style === AttackStyle.grab && started < 0) started = frame;
  }
  assertEquals(started, 537);
});

function guardRead(opponentOption: AttackStyle) {
  const trainedGame = readyRead(HabitChoice.attack);
  const world = createRoster(3, [trainedGame.own, trainedGame.target]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.timeLimitMinutes = 0;
  const runtime = createPacingAndPresentation();
  runtime.simulationFrame = 510;
  const controls = createFrameControls();
  const row = createMatchFrameInput();
  let firstGuard = -1;
  let grabbed = false;
  for (let frame = 511; frame <= 562; frame++) {
    const input = controls.inputs[0];
    input.shield = false;
    clearAttackBuffer(controls.commands[0]);
    clearAttackBuffer(controls.commands[1]);
    observeOpponents(runtime.botMemory, world, frame);
    const seen = perceivedOpponent(runtime.botMemory, trainedGame.own, 0, frame, 12);
    if (seen !== undefined) pressBotRead(trainedGame.strategy, trainedGame.own, seen, 0, match.matchFrame, frame, input, controls.commands[0]);
    if (firstGuard < 0 && input.shield) firstGuard = frame;
    if (frame === 540) queueAttack(controls.commands[1], { style: opponentOption, facing: -1, frame, mayCharge: false });
    assertTrue(captureFrame(row, frame, world.mask, controls, runtime));
    assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
    if (trainedGame.own.grab.owner !== undefined) grabbed = true;
  }
  return { firstGuard, grabbed, damage: trainedGame.own.status.damage };
}

test("an anticipatory guard blocks the learned strike; an unexpected grab punishes the committed wrong read [spec #182]", () => {
  const expected = guardRead(AttackStyle.jab);
  const baited = guardRead(AttackStyle.grab);
  assertEquals(expected.damage, 0.0);
  assertEquals(expected.grabbed, false);
  assertTrue(baited.grabbed);
});

test("seeded read mix-ups sometimes decline a reliable pattern, and detached replay retains its commitment [spec #182] [invariant]", () => {
  let reads = 0;
  for (let seed = 0; seed < 100; seed++) {
    const game = trained(HabitChoice.shield);
    useMatchSeed(seed);
    prepareBotRead(game.strategy, game.own, game.target, 491, 12, EXPERT);
    if (game.strategy.readActive) reads++;
  }
  useMatchSeed(0);
  assertGreaterThan(reads, 50);
  assertLessThan(reads, 100);
  const game = readyRead(HabitChoice.shield);
  const state = createReplaySnapshot();
  state.runtime.botStrategies[0] = game.strategy;
  const saved = createReplaySnapshot();
  copyReplayState(saved, state);
  const original = stateChecksum(saved);
  game.strategy.readActed = true;
  assertTrue(stateChecksum(state) !== original);
  assertEquals(stateChecksum(saved), original);
  copyReplayState(state, saved);
  assertEquals(firstStateDifference(state, saved), undefined);
  assertEquals(botStrategyValues(state.runtime.botStrategies[0]).join(","), botStrategyValues(saved.runtime.botStrategies[0]).join(","));
});

const QUICK: MoveEstimate = { damage: 6.0, startup: 4, recovery: 10, effect: { damage: 6.0, growth: 40.0, base: 12.0, launchX: 1.0, launchZ: 0.0, electric: false }, travel: 0.0 };
const KILL: MoveEstimate = { damage: 18.0, startup: 24, recovery: 40, effect: { damage: 18.0, growth: 120.0, base: 35.0, launchX: 1.0, launchZ: 0.0, electric: false }, travel: 80.0 };

test("move value distinguishes percent, punishment and stage position; stock/clock deficit favors a comeback read [spec #182]", () => {
  const own = createFighter(Character.rifleman, 900.0, 1);
  const target = createFighter(Character.rifleman, 960.0, -1);
  const match = createMatchState();
  const value = (move: MoveEstimate, pressure = 0) => estimatedMoveValue(move, own, target, 0, 60, EXPERT, pressure);
  const atZero = value(KILL) - value(QUICK);
  target.status.damage = 150.0;
  const atKillPercent = value(KILL) - value(QUICK);
  assertGreaterThan(atKillPercent, atZero);
  const exposed = value(KILL);
  own.status.damage = 150.0;
  assertLessThan(value(KILL), exposed);
  own.status.stocks = 1;
  target.status.stocks = 2;
  match.remainingFrames = 600;
  const pressure = comebackPressure(own, target, match);
  assertGreaterThan(pressure, 25);
  assertGreaterThan(value(KILL, pressure) - value(QUICK, pressure), value(KILL) - value(QUICK));
  const inward = { ...KILL, travel: -80.0 };
  assertGreaterThan(value(inward), value(KILL));
});

test("independent decision profiles change observed smash repetition and variety without changing reaction timing [spec #182]", () => {
  const own = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(Character.rifleman, 60.0, -1);
  const game = createMatchState();
  const report = (policy: CpuDecisionPolicy) => {
    const strategy = createBotStrategy();
    const input = neutralControls();
    const commands = attackBuffer(6);
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let repeats = 0;
    let previous = -1;
    for (let frame = 1; frame <= 500; frame++) {
      clearAttackBuffer(commands);
      assertTrue(chooseAttack(own, target, 0, frame, frame, true, input, commands, 0, -1, { ...cpuSkill("wren", "expert"), decision: policy }, 12, { strategy, policy, game }));
      const option = strategy.lastOption;
      if (option === previous) repeats++;
      previous = option;
      if (option < counts.length) counts[option] = at(counts, option) + 1;
    }
    return { repeats, smashes: at(counts, AttackStyle.forwardSmash) + at(counts, AttackStyle.upSmash) + at(counts, AttackStyle.downSmash), variety: counts.filter(count => count > 0).length };
  };
  const simple = report(cpuProfile("wren", "rookie"));
  const thoughtful = report(EXPERT);
  assertGreaterThan(simple.repeats, thoughtful.repeats);
  assertGreaterThan(simple.smashes, thoughtful.smashes);
  assertGreaterThan(thoughtful.variety, 5);
});

test("a computer whose every option in reach was started within the variety span passes, then repeats once the span lapses [spec #279]", () => {
  const policy = EXPERT;
  const skill = cpuSkill("wren", "expert");
  const game = createMatchState();
  const startsAt = (character: Character) => {
    const own = createFighter(character, 0.0, 1);

    const target = createFighter(Character.rifleman, 300.0, -1);
    const strategy = createBotStrategy();
    const input = neutralControls();
    const commands = attackBuffer(6);
    const starts: { readonly frame: number; readonly option: number }[] = [];
    for (let frame = 1; frame <= 2 * VARIETY_FRAMES + 1; frame++) {
      clearAttackBuffer(commands);
      if (chooseAttack(own, target, 0, frame, frame, true, input, commands, 0, -1, skill, 0, { strategy, policy, game })) starts.push({ frame, option: strategy.lastOption });
    }
    return starts;
  };

  const shots = startsAt(Character.sylvanas);
  assertEquals(shots.filter(start => start.frame <= VARIETY_FRAMES).length, VARIETY_PASS_STARTS);
  assertEquals(shots.find(start => start.frame > VARIETY_FRAMES)?.frame, 1 + VARIETY_FRAMES);
  assertEquals(new Set(shots.map(start => start.option)).size, 1);

  const spells = startsAt(Character.jaina).filter(start => start.frame <= VARIETY_FRAMES).map(start => start.option);
  assertEquals(new Set(spells).size, 3);
});
