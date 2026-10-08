import { mutableProjectile } from "../sim/fighterProjectiles";
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { attackBuffer, clearAttackBuffer, queueAttack, sameAttackBuffer } from "../input/attackBuffer";
import { firstStateDifference } from "../replay/difference";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { AttackStyle, Character, DownState, LedgeState } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { canShieldGrab } from "../sim/conditions";
import { attackStartupFrames } from "../sim/moves";
import { mainDeckRight, mainDeckZ } from "../sim/stage";
import { copyControls, createRoster, neutralControls, sameControls } from "../sim/roster";
import { chooseDefense } from "./botDefense";
import { HabitChoice } from "./botHabits";
import { pressKitOption } from "./botKitOptions";
import { comebackPressure, estimatedMoveValue, familiarOption, type MoveEstimate } from "./botMoveValue";
import { chooseAttack, moveReaches } from "./botMoves";
import { BOT_DIRECTION_FRAMES, clearBotMemory, commitBotDirection, observeOpponents, perceivedOpponent } from "./botPerception";
import { produceComputerInput } from "./botPlay";
import { choosePunish } from "./botPunish";
import { useMatchSeed } from "./botRandom";
import { chooseRecoveryInput } from "./botRecovery";
import { createBotStrategy, copyBotStrategy, learnBotHabit, prepareBotRead, pressBotRead } from "./botStrategy";
import { createFrameControls } from "./controls";
import { type CpuProfile } from "./cpuProfiles";
import { cpuSkill, perceivedCpuSkill } from "./cpuSkill";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { createMatchState, Phase } from "./rules";

export const CALIBRATION_SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const CALIBRATION_MINIMUM = 100;

export interface DecisionSample {
  eligible: number;
  outcomes: Record<string, number>;
}
export type CalibrationMeasure = "reaction" | "execution" | "judgment" | "spacing" | "adaptation" | "repetition" | "reads" | "riskAhead" | "riskBehind" | "proactive" | "defensive" | "kit" | "conversion" | "exploit";
export interface CalibrationRow {
  readonly opponent: CpuProfile["opponent"];
  readonly tier: CpuProfile["tier"];
  readonly samples: Record<CalibrationMeasure, DecisionSample>;
  earlyReactions: number;
  earlyReversals: number;
  reversals: number;
  replayCases: number;
  replayDifferences: number;
}

const sample = (): DecisionSample => ({ eligible: 0, outcomes: {} });
const record = (into: DecisionSample, outcome: string) => {
  into.eligible++;
  into.outcomes[outcome] = (into.outcomes[outcome] ?? 0) + 1;
};

function setup(profile: CpuProfile, seed: number, character: Character = Character.demonHunter, gap = 60.0) {
  const own = createFighter(character, 0.0, 1);
  const target = createFighter(Character.demonHunter, gap, -1);
  const match = createMatchState();
  match.phase = Phase.match;
  match.timeLimitMinutes = 0;
  match.matchSeed = seed;
  match.cpuOpponents[0] = profile.opponent;
  match.cpuResolvedOpponents[0] = profile.opponent;
  match.cpuTiers[0] = profile.tier;
  const state = { world: createRoster(3, [own, target]), match, controls: createFrameControls(), runtime: createPacingAndPresentation() };
  const produced = createFrameControls();
  const row = createMatchFrameInput();
  const run = (frames: number) => {
    for (let n = 0; n < frames; n++) {
      const frame = state.runtime.simulationFrame + 1;
      produceComputerInput(match, state.world, state.runtime, 0, frame, produced.inputs[0], produced.commands[0]);
      if (!captureFrame(row, frame, state.world.mask, produced, state.runtime)
        || !executeMatchFrame(row, match, state.world, state.controls, state.runtime, frame)) throw new Error("calibration frame rejected");
    }
  };
  return { own, target, state, run, produced };
}

function reaction(profile: CpuProfile, seed: number, trial: number, into: CalibrationRow): void {
  const changed = setup(profile, seed, Character.rifleman, 300.0);
  const quiet = setup(profile, seed, Character.rifleman, 300.0);
  const start = 45 + trial;
  let first = -1;
  for (let frame = 1; frame <= start + profile.reactionFrames + 30; frame++) {
    if (frame === start) {
      switch (floorMod(trial, 5)) {
        case 0: changed.target.motion.x = -300.0; break;
        case 1: changed.target.shield.raised = true; break;
        case 2: changed.target.motion.grounded = false; changed.target.motion.z = 220.0; changed.target.motion.vz = 8.0; break;
        case 3: changed.target.attack.style = AttackStyle.forwardSmash; changed.target.attack.serial++; break;
        case 4: {
          const shot = mutableProjectile(changed.target, 0);
          shot.life = 100; shot.x = 80.0; shot.z = 45.0; shot.direction = -1; shot.velocityX = -12.0; shot.serial++;
          break;
        }
      }
    }
    for (const game of [changed, quiet]) produceComputerInput(game.state.match, game.state.world, game.state.runtime, 0, frame, game.produced.inputs[0], game.produced.commands[0]);
    const differs = !sameControls(changed.produced.inputs[0], quiet.produced.inputs[0]) || !sameAttackBuffer(changed.produced.commands[0], quiet.produced.commands[0]);
    if (differs && first < 0) first = frame - start;
    if (differs && frame < start + profile.reactionFrames) into.earlyReactions++;
  }
  record(into.samples.reaction, first < 0 ? "no changed input within delay+30" : `${first} frames`);
  for (const game of [changed, quiet]) clearBotMemory(game.state.runtime.botMemory);
}

function reads(profile: CpuProfile, seed: number, trial: number, into: CalibrationRow): void {
  const game = setup(profile, seed, Character.rifleman);
  const strategy = createBotStrategy();
  // One event each 60 frames, identical public observations for every row.
  for (let event = 0; event < 20; event++) {
    const frame = event * 60;
    game.target.attack.style = AttackStyle.jab;
    game.target.attack.serial++;
    learnBotHabit(strategy, game.own, game.target, 1, frame, profile);
    game.target.attack.style = undefined;
    learnBotHabit(strategy, game.own, game.target, 1, frame + 8, profile);
  }
  useMatchSeed(seed);
  const frame = 1200 + trial;
  prepareBotRead(strategy, game.own, game.target, frame, profile.reactionFrames, profile);
  const expectedFrame = strategy.readExpectedFrame;
  const input = neutralControls();
  const commands = attackBuffer(6);
  const acted = strategy.readActive && pressBotRead(strategy, game.own, game.target, 0, frame, expectedFrame - 8, input, commands);
  if (!acted || !input.shield || !strategy.readActive) {
    record(into.samples.reads, "declined learned strike forecast");
    record(into.samples.reads, "declined switched grab forecast");
  } else for (const switched of [false, true]) {
    const played = setup(profile, seed, Character.rifleman);
    const runtime = played.state.runtime;
    const controls = createFrameControls();
    const row = createMatchFrameInput();
    const commitment = createBotStrategy();
    copyBotStrategy(commitment, strategy);
    commitment.readActed = false;
    runtime.simulationFrame = expectedFrame - profile.reactionFrames - 18;
    let grabbed = false;
    for (let frame = runtime.simulationFrame + 1; frame <= expectedFrame + 22; frame++) {
      copyControls(controls.inputs[0], neutralControls());
      clearAttackBuffer(controls.commands[0]); clearAttackBuffer(controls.commands[1]);
      observeOpponents(runtime.botMemory, played.state.world, frame);
      const target = perceivedOpponent(runtime.botMemory, played.own, 0, frame, profile.reactionFrames);
      if (target !== undefined) pressBotRead(commitment, played.own, target, 0, played.state.match.matchFrame, frame, controls.inputs[0], controls.commands[0]);
      if (frame === expectedFrame) {
        queueAttack(controls.commands[1], { style: switched ? AttackStyle.grab : AttackStyle.jab, facing: -1, frame, mayCharge: false });
      }
      if (!captureFrame(row, frame, played.state.world.mask, controls, runtime)
        || !executeMatchFrame(row, played.state.match, played.state.world, played.state.controls, runtime, frame)) throw new Error("calibration read frame rejected");
      if (played.own.grab.owner !== undefined) grabbed = true;
    }
    record(into.samples.reads, switched ? grabbed ? "wrong read punished by grab" : "switch escaped guard exposure"
      : played.own.visuals.shield > 0 ? "learned strike blocked" : played.own.status.damage > 0.0 ? "learned strike landed" : "learned strike missed");
    clearBotMemory(runtime.botMemory);
  }
  // Feed a real pattern switch; count observations until the committed read changes.
  let adapted = -1;
  for (let event = 0; event < 80; event++) {
    const observed = 1260 + event * 60;
    game.target.shield.raised = true;
    learnBotHabit(strategy, game.own, game.target, 1, observed, profile);
    game.target.shield.raised = false;
    learnBotHabit(strategy, game.own, game.target, 1, observed + 8, profile);
    prepareBotRead(strategy, game.own, game.target, observed + profile.reactionFrames + 9, profile.reactionFrames, profile);
    if (strategy.readActive && strategy.readChoice === HabitChoice.shield) { adapted = event + 1; break; }
  }
  record(into.samples.adaptation, adapted < 0 ? "no switch in 80 events" : `${adapted} observed events`);
  clearBotMemory(game.state.runtime.botMemory);
  useMatchSeed(0);
}

function choices(profile: CpuProfile, seed: number, trial: number, into: CalibrationRow): void {
  const game = setup(profile, seed);
  const { own, target, state } = game;
  const skill = cpuSkill(profile.opponent, profile.tier);
  const seenSkill = perceivedCpuSkill(profile.opponent, profile.tier);
  const frame = 1800 + trial * 31;
  own.attack.serial = trial;
  own.visuals.hit = trial;
  const strategy = createBotStrategy();
  const decision = { strategy, policy: profile, game: state.match };
  const input = neutralControls();
  const commands = attackBuffer(6);
  const neutral = neutralControls();
  useMatchSeed(seed);
  const options = [AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.downTilt, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash];
  strategy.lastOption = AttackStyle.forwardTilt;
  record(into.samples.judgment, familiarOption(options, options.length, own, frame, decision) === undefined ? "context value" : "familiar answer");
  const pick = () => {
    copyControls(input, neutral); clearAttackBuffer(commands);
    if (!chooseAttack(own, target, 0, frame, frame, true, input, commands, 0, -1, skill, 0, decision)) return -1;
    return commands.pending?.style ?? (input.specialPressed ? 30 : -1);
  };
  const first = pick();
  const secondFrame = frame + 1;
  copyControls(input, neutral); clearAttackBuffer(commands);
  chooseAttack(own, target, 0, secondFrame, secondFrame, true, input, commands, 0, -1, skill, 0, decision);
  const second = commands.pending?.style ?? (input.specialPressed ? 30 : -1);
  record(into.samples.repetition, first === second ? "repeated" : "changed");
  // Distances vary across trials; actual queued normals are checked against authored reach.
  target.motion.x = trial < 5 ? 60.0 : 130.0;
  const spaced = pick();
  if (spaced >= 0) {
    const style = Object.values(AttackStyle).find(style => style === commands.pending?.style);
    const correct = commands.pending === undefined || (style !== undefined && moveReaches(own.character, style, target, target.motion.x, 0.0, own.tuning.moves));
    record(into.samples.spacing, correct ? "in reach" : "outside reach");
  }
  target.motion.x = 60.0;
  own.status.damage = 150.0; target.status.damage = 150.0;
  own.status.stocks = 3; target.status.stocks = 1;
  const gamble: MoveEstimate = { damage: 18.0, startup: 24, recovery: 40, effect: { damage: 18.0, growth: 120.0, base: 35.0, launchX: 1.0, launchZ: 0.0, electric: false }, travel: 80.0 };
  record(into.samples.riskAhead, `${estimatedMoveValue(gamble, own, target, 0, 60, profile, comebackPressure(own, target, state.match))} gamble value`);
  own.status.stocks = 1; target.status.stocks = 3;
  state.match.timeLimitMinutes = 4; state.match.remainingFrames = 600;
  record(into.samples.riskBehind, `${estimatedMoveValue(gamble, own, target, 0, 60, profile, comebackPressure(own, target, state.match))} gamble value`);
  own.status.damage = 0.0; target.status.damage = 0.0;
  own.status.stocks = 3; target.status.stocks = 3;
  own.motion.grounded = false; own.motion.z = 10.0; own.motion.deltaZ = -4.0;
  own.motion.vz = -4.0; own.down.state = DownState.tumble;
  copyControls(input, neutral);
  chooseRecoveryInput(own, 0, 0, input, target, skill);
  record(into.samples.execution, input.techPressed ? "tech press in landing window" : "missed tech");
  own.motion.grounded = true; own.motion.z = 0.0; own.motion.deltaZ = 0.0; own.motion.vz = 0.0; own.down.state = DownState.none;
  target.attack.style = AttackStyle.forwardSmash;
  target.attack.serial = trial;
  target.attack.frame = attackStartupFrames(AttackStyle.forwardSmash, target.tuning.moves) - 4;
  target.facing = -1;
  copyControls(input, neutral);
  record(into.samples.defensive, chooseDefense(own, target, 0, input, seenSkill) ? "answered visible strike" : "took visible strike");
  target.attack.style = undefined;
  // Independent legal neutral opportunity, with no ongoing attack/pause or trained read.
  produceComputerInput(state.match, state.world, state.runtime, 0, frame - profile.reactionFrames, game.produced.inputs[0], game.produced.commands[0]);
  state.runtime.botAttackDelays[0] = 0.0;
  produceComputerInput(state.match, state.world, state.runtime, 0, frame, game.produced.inputs[0], game.produced.commands[0]);
  const proactive = game.produced.commands[0].pending !== undefined || game.produced.inputs[0].specialPressed || game.produced.inputs[0].jumpPressed || game.produced.inputs[0].direction !== 0;
  record(into.samples.proactive, proactive ? "took initiative" : "waited in neutral");
  // Rifleman's short-hop blaster has a ready, level target inside its authored band.
  const rifle = createFighter(Character.rifleman, 0.0, 1);
  rifle.attack.serial = trial; target.motion.x = 300.0;
  copyControls(input, neutral); clearAttackBuffer(commands);
  useMatchSeed(seed);
  record(into.samples.kit, pressKitOption(rifle, target, 0, skill, frame, true, input, commands) ? "short-hop blaster option" : "declined kit option");
  useMatchSeed(0);
  clearBotMemory(state.runtime.botMemory);
}

function conversion(profile: CpuProfile, seed: number, trial: number, into: CalibrationRow): void {
  const game = setup(profile, seed);
  const row = createMatchFrameInput();
  const frame = 1800 + trial * 31;
  game.target.attack.style = AttackStyle.forwardSmash;
  game.target.attack.frame = 40;
  game.target.attack.cooldown = 35;
  game.target.attack.serial = trial;
  game.state.runtime.simulationFrame = frame - 1;
  useMatchSeed(seed);
  const chosen = choosePunish(game.own, game.target, 0, frame, frame, perceivedCpuSkill(profile.opponent, profile.tier), game.produced.inputs[0], game.produced.commands[0], 0);
  useMatchSeed(0);
  if (!chosen || game.produced.commands[0].pending === undefined) record(into.samples.conversion, "passed close punish");
  else {
    for (let elapsed = 0; elapsed < 60; elapsed++) {
      const next = frame + elapsed;
      if (!captureFrame(row, next, game.state.world.mask, game.produced, game.state.runtime)
        || !executeMatchFrame(row, game.state.match, game.state.world, game.state.controls, game.state.runtime, next)) throw new Error("calibration conversion frame rejected");
      clearAttackBuffer(game.produced.commands[0]);
      copyControls(game.produced.inputs[0], neutralControls());
    }
    record(into.samples.conversion, game.target.status.damage > 0.0 ? "close punish connected" : "close punish missed");
  }
  clearBotMemory(game.state.runtime.botMemory);
}

function enduringFlaw(profile: CpuProfile, seed: number, trial: number, into: CalibrationRow): void {
  const game = setup(profile, seed, profile.opponent === "wren" ? Character.rifleman : Character.demonHunter);
  const frame = 1800 + trial * 31;
  const row = createMatchFrameInput();
  const { own, target, state, produced } = game;
  const input = produced.inputs[0];
  const commands = produced.commands[0];
  own.attack.serial = trial;
  own.visuals.hit = trial;
  let exposed = false;
  let flaw = "";
  if (profile.opponent === "kite") {
    own.motion.x = mainDeckRight(0);
    own.motion.z = f32(mainDeckZ(0) - 40.0);
    own.motion.grounded = false;
    own.facing = -1;
    own.ledge.state = LedgeState.hang;
    own.ledge.side = 1;
    own.ledge.frame = 1;
    own.ledge.serial = trial;
    target.motion.x = f32(mainDeckRight(0) - 100.0);
    target.shield.raised = true;
    useMatchSeed(seed);
    chooseRecoveryInput(own, 0, 0, input, target, cpuSkill(profile.opponent, profile.tier));
    exposed = input.getupAttackPressed;
    flaw = "bold ledge attack caught by guard counter";
  } else if (profile.opponent === "flint") {
    const strategy = createBotStrategy();
    strategy.lastOption = AttackStyle.forwardTilt;
    useMatchSeed(seed);
    chooseAttack(own, target, 0, frame, frame, true, input, commands, 0, -1, cpuSkill(profile.opponent, profile.tier), 0, { strategy, policy: profile, game: state.match });
    exposed = commands.pending?.style === AttackStyle.forwardTilt;
    flaw = "conditioned forward tilt caught by guard counter";
  } else {
    if (profile.opponent === "rook" || profile.opponent === "ember") own.status.damage = 150.0;
    produceComputerInput(state.match, state.world, state.runtime, 0, frame - profile.reactionFrames, input, commands);
    state.runtime.botAttackDelays[0] = profile.opponent === "wren" ? f32(12.0 / 60.0) : 0.0;
    produceComputerInput(state.match, state.world, state.runtime, 0, frame, input, commands);
    const acted = commands.pending !== undefined || input.specialPressed || input.jumpPressed || input.direction !== 0;
    if (profile.opponent === "rook" || profile.opponent === "vale") {
      exposed = !acted;
      flaw = profile.opponent === "rook" ? "passed speculative opening caught by jab" : "wait after feint caught by jab";
    } else if (profile.opponent === "ember") {
      exposed = commands.pending !== undefined && commands.pending.style !== AttackStyle.grab;
      flaw = "extra pressure attack caught by guard counter";
    } else {
      exposed = input.direction < 0 && commands.pending === undefined && !input.specialPressed;
      flaw = "comfortable neutral retreat caught by chase";
    }
  }
  useMatchSeed(0);
  state.runtime.simulationFrame = frame - 1;
  const guarded = profile.opponent === "ember" || profile.opponent === "flint" || profile.opponent === "kite";
  let countered = false;
  let counterFrame = -1;
  for (let elapsed = 0; elapsed < 60; elapsed++) {
    const next = frame + elapsed;
    if (elapsed > 0) produceComputerInput(state.match, state.world, state.runtime, 0, next, input, commands);
    const response = produced.inputs[1];
    copyControls(response, neutralControls());
    clearAttackBuffer(produced.commands[1]);
    if (guarded && counterFrame < 0) {
      response.shield = true;
      if (target.visuals.shield > 0 && canShieldGrab(target)) counterFrame = next;
    }
    if (guarded ? next === counterFrame : elapsed === 0) {
      response.shield = guarded;
      if (!guarded && profile.opponent === "wren") response.direction = -1;
      queueAttack(produced.commands[1], { style: guarded ? AttackStyle.grab : AttackStyle.jab, facing: profile.opponent === "kite" ? 1 : -1, frame: next, mayCharge: false });
    }
    if (!captureFrame(row, next, state.world.mask, produced, state.runtime)
      || !executeMatchFrame(row, state.match, state.world, state.controls, state.runtime, next)) throw new Error("calibration enduring-flaw frame rejected");
    if (own.status.damage > (profile.opponent === "rook" || profile.opponent === "ember" ? 150.0 : 0.0) || own.grab.owner !== undefined) countered = true;
    clearAttackBuffer(commands);
    copyControls(input, neutralControls());
  }
  record(into.samples.exploit, exposed && countered ? flaw : exposed ? "baited choice escaped counter" : "changed or declined baited choice");
  clearBotMemory(state.runtime.botMemory);
}

function replayAndDirection(profile: CpuProfile, seed: number, trial: number, into: CalibrationRow): void {
  const game = setup(profile, seed, Character.rifleman, 300.0);
  game.run(40 + trial);
  const saved = createReplaySnapshot();
  const ahead = createReplaySnapshot();
  copyReplayState(saved, game.state);
  game.run(12);
  copyReplayState(ahead, game.state);
  copyReplayState(game.state, saved);
  game.run(12);
  into.replayCases++;
  if (firstStateDifference(ahead, game.state) !== undefined) into.replayDifferences++;
  let previous = 0;
  let chosen = 0;
  const input = neutralControls();
  clearBotMemory(game.state.runtime.botMemory);
  for (let frame = 1; frame <= 60; frame++) {
    input.direction = floorMod(frame + trial + seed, 3) === 0 ? 0 : floorMod(frame, 2) === 0 ? -1 : 1;
    commitBotDirection(game.state.runtime.botMemory, 0, frame, input);
    if (input.direction !== 0 && previous !== input.direction) {
      if (previous !== 0) { into.reversals++; if (frame - chosen < BOT_DIRECTION_FRAMES) into.earlyReversals++; }
      chosen = frame; previous = input.direction;
    }
  }
  clearBotMemory(game.state.runtime.botMemory);
  clearBotMemory(saved.runtime.botMemory);
  clearBotMemory(ahead.runtime.botMemory);
}

/** Controlled decisions, rather than passive match frames, supply each denominator. */
export function collectCalibrationRow(profile: CpuProfile, trialsPerSeed = 10): CalibrationRow {
  const samples = { reaction: sample(), execution: sample(), judgment: sample(), spacing: sample(), adaptation: sample(), repetition: sample(), reads: sample(), riskAhead: sample(), riskBehind: sample(), proactive: sample(), defensive: sample(), kit: sample(), conversion: sample(), exploit: sample() };
  const row: CalibrationRow = { opponent: profile.opponent, tier: profile.tier, samples, earlyReactions: 0, earlyReversals: 0, reversals: 0, replayCases: 0, replayDifferences: 0 };
  for (const seed of CALIBRATION_SEEDS) for (let trial = 0; trial < trialsPerSeed; trial++) {
    reaction(profile, seed, trial, row);
    reads(profile, seed, trial, row);
    choices(profile, seed, trial, row);
    conversion(profile, seed, trial, row);
    enduringFlaw(profile, seed, trial, row);
    replayAndDirection(profile, seed, trial, row);
  }
  return row;
}

export function calibrationFailures(row: CalibrationRow): string[] {
  const failures: string[] = [];
  for (const [name, measure] of Object.entries(row.samples)) {
    if (measure.eligible < CALIBRATION_MINIMUM) failures.push(`${name}: ${measure.eligible}/${CALIBRATION_MINIMUM} eligible decisions`);
  }
  if (row.earlyReactions !== 0) failures.push(`${row.earlyReactions} early reactions`);
  if (row.earlyReversals !== 0) failures.push(`${row.earlyReversals} early reversals`);
  if (row.replayDifferences !== 0 || row.replayCases < CALIBRATION_MINIMUM) failures.push(`${row.replayDifferences} differences across ${row.replayCases} replay cases`);
  return failures;
}
