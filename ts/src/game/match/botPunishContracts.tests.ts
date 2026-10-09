// The computer's whiff punish (botPunish.ts): a Pit Lord that whiffs a
// forward smash, misses a grab or lands in landing lag is hit or grabbed by a
// Wren Expert computer before it can act again, for every selectable fighter; a
// Wren Rookie computer usually lets the window pass. In ordinary computer matches
// the computer punishes windows as they come up.
import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep } from "../../runtime/sweep";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character, HeroStatusKind } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { copyFighterState } from "../replay/fighterState";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { attackLandingLag } from "../sim/moves";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { produceComputerInput } from "./botPlay";
import { PunishKind, type PunishWindow, punishWindow } from "./botPunish";
import { createFrameControls } from "./controls";
import { cpuSkill } from "./cpuSkill";
import type { CpuTier } from "./cpuProfiles";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState } from "./rules";

const TICK = f32(1.0 / MATCH_TICKS_PER_SECOND);

const NEUTRAL = neutralControls();

/** Compare a delayed visible commitment with its actual twelve neutral frames. */
function forecastRecovery(setup: (target: Fighter) => void): void {
  const target = createFighter(Character.lich, 0.0, 1);
  setup(target);
  const world = createRoster(3, [target, createFighter(Character.rifleman, -500.0, 1)]);
  const observed = createFighter(Character.lich, 0.0, 1);
  copyFighterState(observed, target, world.mask);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.timeLimitMinutes = 0;
  const runtime = createPacingAndPresentation();
  const produced = createFrameControls();
  const controls = createFrameControls();
  const row = createMatchFrameInput();
  for (let frame = 1; frame <= 12; frame++) {
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
  }
  const actual: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0 };
  const forecast: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0 };
  assertTrue(punishWindow(target, 13, actual));
  assertTrue(punishWindow(observed, 13, forecast, 12, 0, match.matchFrame));
  assertEquals(forecast.kind, actual.kind);
  assertEquals(forecast.frames, actual.frames);
}

test("a delayed punish forecast follows an attack through its observed hitlag into recovery [invariant]", () => {
  forecastRecovery(target => {
    // Hitlag's expiry frame advances the action; the preceding five frames stay frozen.
    target.attack.style = AttackStyle.forwardTiltDown;
    target.attack.frame = 8;
    target.attack.duration = 34;
    target.attack.cooldown = 26;
    target.launch.hitlag = 6;
  });
});

test("a delayed punish forecast recognizes an observed aerial's landing recovery [invariant]", () => {
  forecastRecovery(target => {
    target.motion.grounded = false;
    target.motion.surface = undefined;
    target.motion.z = 80.0;
    target.motion.vz = -8.0;
    target.motion.deltaZ = -8.0;
    target.attack.style = AttackStyle.neutralAir;
    target.attack.frame = 1;
    target.attack.duration = 40;
    target.attack.cooldown = 39;
  });
});

/** The committal states a scripted Pit Lord shows, and where the computer stands for each. */
const Whiff = { forwardSmash: 0, grab: 1, landing: 2 } as const;
type Whiff = (typeof Whiff)[keyof typeof Whiff];
const WHIFFS = [Whiff.forwardSmash, Whiff.grab, Whiff.landing] as const;
/**
 * Where the computer stands: behind a forward smash (it swings away), just past the grab's reach, in front of a landing.
 * #354's fresh 19–21-frame choice plus input and startup cannot hit a 20-frame landing.
 */
const COMPUTER_X = [-110.0, 150.0, 90.0] as const;

/**
 * Pit Lord at the middle of the first stage shows `whiff`; the computer in
 * slot 1 plays `character` at `tier` under `seed`, standing still until the
 * window opens. True when it hits or grabs Pit Lord while Pit Lord still can't act.
 */
function punishes(whiff: Whiff, character: Character, tier: CpuTier, seed: number): boolean {
  const world = createRoster(3, [createFighter(Character.pitLord, 0.0, 1), createFighter(character, COMPUTER_X[whiff], COMPUTER_X[whiff] < 0 ? 1 : -1)]);
  const match = createMatchState();
  match.phase = Phase.match;
  for (const slot of [0, 1] as const) {
    match.cpuOpponents[slot] = "wren";
    match.cpuResolvedOpponents[slot] = "wren";
    match.cpuTiers[slot] = "expert";
  }
  match.stageChoice = 0;
  match.timeLimitMinutes = 0;
  match.cpuTiers[1] = tier;
  match.matchSeed = seed;
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const pitLord = fighterAt(world, 0);
  const computer = fighterAt(world, 1);
  const window: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0 };
  if (whiff === Whiff.landing) pitLord.landing.lag = attackLandingLag(AttackStyle.neutralAir, pitLord.tuning.moves);
  const skill = cpuSkill("wren", tier);
  let opened = false;
  for (let n = 1; n <= 90; n++) {
    const frame = runtime.simulationFrame + 1;
    const open = punishWindow(pitLord, frame, window);
    if (opened && !open) return false;
    // The computer has just thrown its last attack: the window finds it in its level's pause between attacks.
    if (open && !opened) runtime.botAttackDelays[1] = f32(f32(skill.attackPause + floorDiv(skill.attackSpread, 2)) * TICK);
    opened = opened || open;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
    }
    if (n === 1 && whiff !== Whiff.landing) {
      queueAttack(produced.commands[0], { style: whiff === Whiff.grab ? AttackStyle.grab : AttackStyle.forwardSmash, facing: 1, frame, mayCharge: false });
    }
    if (opened) produceComputerInput(match, world, runtime, 1, frame, produced.inputs[1], produced.commands[1]);
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
    // The scripted move whiffs: Pit Lord never touches the computer.
    assertEquals(computer.status.damage, 0.0);
    if (open && (pitLord.status.damage > 0.0 || pitLord.grab.owner !== undefined)) return true;
  }
  return false;
}

/** Every fighter's Wren Expert computer punishes each seed's window; a Wren Rookie computer is drawn on more seeds. */
const HARD_SEEDS = 4;
const EASY_SEEDS = 8;

/** Of `seeds` seeds, how many a `character` computer at `level` punishes `whiff` in. */
function punishCount(whiff: Whiff, character: Character, tier: CpuTier, seeds: number): number {
  let count = 0;
  for (let seed = 0; seed < seeds; seed++) if (punishes(whiff, character, tier, seed)) count++;
  return count;
}

for (const whiff of WHIFFS) {
  const name = whiff === Whiff.forwardSmash ? "whiffed forward smash" : whiff === Whiff.grab ? "missed grab" : "landing lag";
  const expected = whiff === Whiff.landing ? 0 : whiff === Whiff.grab ? 2 : HARD_SEEDS;
  const answer = whiff === Whiff.landing ? "cannot react and hit before Pit Lord's 20-frame landing ends" : `punishes Pit Lord's ${name} within the window`;
  test(`a Wren Expert Rifleman computer ${answer} [spec #157] [spec #354]`, () => {
    assertEquals(punishCount(whiff, Character.rifleman, "expert", HARD_SEEDS), expected);
  });
  sweep(`Wren Expert computers punish Pit Lord's ${name} more often than Rookie when human reaction permits [spec #157] [spec #354] [spec #356] [spec #357]`, () => {
    let easy = 0;
    let hard = 0;
    for (const character of SELECTABLE_CHARACTERS) {
      const punished = punishCount(whiff, character, "expert", HARD_SEEDS);
      if (whiff === Whiff.landing) assertEquals(punished, expected);
      hard += punished;
      easy += punishCount(whiff, character, "rookie", EASY_SEEDS);
    }
    if (whiff !== Whiff.landing) {
      assertGreaterThan(hard * EASY_SEEDS, easy * HARD_SEEDS);
      assertLessThan(hard, SELECTABLE_CHARACTERS.length * HARD_SEEDS);
    }
    // Measured 6, 0 and 6 of 96 at the change; a quarter is the bound.
    assertLessThan(easy, floorDiv(SELECTABLE_CHARACTERS.length * EASY_SEEDS, 4));
  });
}

/** Level-9 computers on both sides of these pairings, MATCH_SEEDS seeded matches each. */
const PAIRS = [
  [Character.pitLord, Character.blademaster], [Character.mountainKing, Character.lich], [Character.rifleman, Character.forsakenPaladin],
  [Character.dreadlord, Character.warden], [Character.shadowHunter, Character.beastmaster], [Character.demonHunter, Character.rifleman],
] as const;
const MATCH_FRAMES = 1800;
const MATCH_SEEDS = 5;

sweep("computers punish in ordinary Wren Expert matches: they attack into open windows and land in more of them than without the punish [spec #157] [spec #354] [spec #356] [spec #357]", () => {
  // Windows each computer saw open, the ones it attacked into, and the ones it hit or grabbed in.
  let windowsSeen = 0;
  let attempts = 0;
  let landed = 0;
  for (let index = 0; index < PAIRS.length * MATCH_SEEDS; index++) {
    const pair = PAIRS[floorMod(index, PAIRS.length)] ?? PAIRS[0];
    const world = createRoster(3, [createFighter(pair[0], -200.0, 1), createFighter(pair[1], 200.0, -1)]);
    const match = createMatchState();
    match.phase = Phase.match;
    for (const slot of [0, 1] as const) {
      match.cpuOpponents[slot] = "wren";
      match.cpuResolvedOpponents[slot] = "wren";
      match.cpuTiers[slot] = "expert";
    }
    match.stageChoice = 0;
    match.timeLimitMinutes = 0;
    match.matchSeed = index;
    const produced = createFrameControls();
    const controls = createFrameControls();
    const runtime = createPacingAndPresentation();
    const row = createMatchFrameInput();
    const windows: PunishWindow[] = [
      { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0 }, { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0 },
    ];
    const open = [false, false];
    const wasOpen = [false, false];
    const tried = [false, false];
    const scored = [false, false];
    const serials = [0, 0];
    const damage = [0.0, 0.0];
    for (let n = 0; n < MATCH_FRAMES; n++) {
      const frame = runtime.simulationFrame + 1;
      for (const slot of [0, 1] as const) {
        const other = fighterAt(world, slot === 0 ? 1 : 0);
        wasOpen[slot] = open[slot] === true;
        open[slot] = punishWindow(other, frame, windows[slot] ?? windows[0]);
        if (open[slot] === true && !wasOpen[slot]) {
          windowsSeen++;
          tried[slot] = false;
          scored[slot] = false;
        }
        serials[slot] = fighterAt(world, slot).attack.serial;
        damage[slot] = other.status.damage;
      }
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        copyControls(produced.inputs[slot], NEUTRAL);
        clearAttackBuffer(produced.commands[slot]);
        produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
      }
      assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
      assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
      for (const slot of [0, 1] as const) {
        if (open[slot] !== true) continue;
        const other = fighterAt(world, slot === 0 ? 1 : 0);
        if (tried[slot] !== true && fighterAt(world, slot).attack.serial !== serials[slot]) {
          tried[slot] = true;
          attempts++;
        }
        if (scored[slot] !== true && (other.status.damage > (damage[slot] ?? 0.0) || other.grab.owner === slot)) {
          scored[slot] = true;
          landed++;
        }
      }
    }
  }
  // Measured over 1127 windows: 251 attacked into, 188 landed in (16.7%); without the punish 150 and 123 of 1038 (11.9%).
  assertGreaterThan(attempts, 0);
  assertGreaterThan(landed * 100, windowsSeen * 14);
});

test("a grounded sleeper is a punish window for its frames left, and a Wren Expert Dreadlord beside it hits it before it wakes (#105) [spec #146]", () => {
  for (let seed = 0; seed < HARD_SEEDS; seed++) {
    const world = createRoster(3, [createFighter(Character.pitLord, 0.0, 1), createFighter(Character.dreadlord, 140.0, -1)]);
    const match = createMatchState();
    match.phase = Phase.match;
    for (const slot of [0, 1] as const) {
      match.cpuOpponents[slot] = "wren";
      match.cpuResolvedOpponents[slot] = "wren";
      match.cpuTiers[slot] = "expert";
    }
    match.stageChoice = 0;
    match.timeLimitMinutes = 0;
    match.matchSeed = seed;
    const produced = createFrameControls();
    const controls = createFrameControls();
    const runtime = createPacingAndPresentation();
    const row = createMatchFrameInput();
    const sleeper = fighterAt(world, 0);
    sleeper.status.condition = HeroStatusKind.sleep;
    sleeper.status.conditionFrames = 100;
    const window: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0 };
    assertTrue(punishWindow(sleeper, 1, window));
    assertEquals(window.kind, PunishKind.status);
    assertEquals(window.frames, 100);
    let hit = false;
    for (let n = 1; n <= 100 && !hit; n++) {
      const frame = runtime.simulationFrame + 1;
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        copyControls(produced.inputs[slot], NEUTRAL);
        clearAttackBuffer(produced.commands[slot]);
      }
      produceComputerInput(match, world, runtime, 1, frame, produced.inputs[1], produced.commands[1]);
      assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
      assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
      hit = sleeper.status.damage > 0.0 || sleeper.grab.owner !== undefined;
    }
    assertTrue(hit);
  }
});
