// The computer's whiff punish (botPunish.ts): a Pit Lord that whiffs a
// forward smash, misses a grab or lands in landing lag is hit or grabbed by a
// level-9 computer before it can act again, for every selectable fighter; a
// level-1 computer usually lets the window pass. In ordinary computer matches
// the computer punishes windows as they come up.
import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character, HeroStatusKind } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { attackLandingLag } from "../sim/moves";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { produceComputerInput } from "./botPlay";
import { PunishKind, type PunishWindow, punishWindow } from "./botPunish";
import { createFrameControls } from "./controls";
import { cpuSkill } from "./cpuLevel";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState } from "./rules";

const TICK = f32(1.0 / MATCH_TICKS_PER_SECOND);

const NEUTRAL = neutralControls();

/** The committal states a scripted Pit Lord shows, and where the computer stands for each. */
const Whiff = { forwardSmash: 0, grab: 1, landing: 2 } as const;
type Whiff = (typeof Whiff)[keyof typeof Whiff];
const WHIFFS = [Whiff.forwardSmash, Whiff.grab, Whiff.landing] as const;
/** Where the computer stands: behind a forward smash (it swings away), just past the grab's reach, in front of a landing. */
const COMPUTER_X = [-110.0, 150.0, 130.0] as const;

/**
 * Pit Lord at the middle of the first stage shows `whiff`; the computer in
 * slot 1 plays `character` at `level` under `seed`, standing still until the
 * window opens. True when it hits or grabs Pit Lord while Pit Lord still can't act.
 */
function punishes(whiff: Whiff, character: Character, level: number, seed: number): boolean {
  const world = createRoster(3, [createFighter(Character.pitLord, 0.0, 1), createFighter(character, COMPUTER_X[whiff], COMPUTER_X[whiff] < 0 ? 1 : -1)]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.timeLimitMinutes = 0;
  match.cpuLevels[1] = level;
  match.matchSeed = seed;
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const pitLord = fighterAt(world, 0);
  const computer = fighterAt(world, 1);
  const window: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0 };
  if (whiff === Whiff.landing) pitLord.landing.lag = attackLandingLag(AttackStyle.neutralAir, pitLord.tuning.moves);
  const skill = cpuSkill(level);
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

/** Every fighter's level-9 computer punishes each seed's window; a level-1 computer is drawn on more seeds. */
const HARD_SEEDS = 4;
const EASY_SEEDS = 8;

/** Of `seeds` seeds, how many a `character` computer at `level` punishes `whiff` in. */
function punishCount(whiff: Whiff, character: Character, level: number, seeds: number): number {
  let count = 0;
  for (let seed = 0; seed < seeds; seed++) if (punishes(whiff, character, level, seed)) count++;
  return count;
}

for (const whiff of WHIFFS) {
  const name = whiff === Whiff.forwardSmash ? "whiffed forward smash" : whiff === Whiff.grab ? "missed grab" : "landing lag";
  test(`a level-9 computer of every fighter punishes Pit Lord's ${name} within the window; a level-1 computer usually doesn't`, () => {
    let easy = 0;
    for (const character of SELECTABLE_CHARACTERS) {
      assertEquals(punishCount(whiff, character, 9, HARD_SEEDS), HARD_SEEDS);
      easy += punishCount(whiff, character, 1, EASY_SEEDS);
    }
    // Measured 6, 0 and 6 of 96 at the change; a quarter is the bound.
    assertLessThan(easy, floorDiv(SELECTABLE_CHARACTERS.length * EASY_SEEDS, 4));
  });
}

/** Level-9 computers on both sides of these pairings, MATCH_SEEDS seeded matches each. */
const PAIRS = [
  [Character.pitLord, Character.blademaster], [Character.mountainKing, Character.lich], [Character.archer, Character.uther],
  [Character.dreadlord, Character.warden], [Character.shadowHunter, Character.beastmaster], [Character.demonHunter, Character.rifleman],
] as const;
const MATCH_FRAMES = 1800;
const MATCH_SEEDS = 4;

test("computers punish in ordinary level-9 matches: they attack into open windows and land in more of them than without the punish", () => {
  // Windows each computer saw open, the ones it attacked into, and the ones it hit or grabbed in.
  let windowsSeen = 0;
  let attempts = 0;
  let landed = 0;
  for (let index = 0; index < PAIRS.length * MATCH_SEEDS; index++) {
    const pair = PAIRS[floorMod(index, PAIRS.length)] ?? PAIRS[0];
    const world = createRoster(3, [createFighter(pair[0], -200.0, 1), createFighter(pair[1], 200.0, -1)]);
    const match = createMatchState();
    match.phase = Phase.match;
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
  assertGreaterThan(attempts, 200);
  assertGreaterThan(landed * 100, windowsSeen * 14);
});

test("a grounded sleeper is a punish window for its frames left, and a level-9 Dreadlord beside it hits it before it wakes (#105)", () => {
  for (let seed = 0; seed < HARD_SEEDS; seed++) {
    const world = createRoster(3, [createFighter(Character.pitLord, 0.0, 1), createFighter(Character.dreadlord, 140.0, -1)]);
    const match = createMatchState();
    match.phase = Phase.match;
    match.stageChoice = 0;
    match.timeLimitMinutes = 0;
    match.cpuLevels[1] = 9;
    match.matchSeed = seed;
    const produced = createFrameControls();
    const controls = createFrameControls();
    const runtime = createPacingAndPresentation();
    const row = createMatchFrameInput();
    const sleeper = fighterAt(world, 0);
    sleeper.status.condition = HeroStatusKind.sleep;
    sleeper.status.conditionFrames = 40;
    const window: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0 };
    assertTrue(punishWindow(sleeper, 1, window));
    assertEquals(window.kind, PunishKind.status);
    assertEquals(window.frames, 40);
    let hit = false;
    for (let n = 1; n <= 40 && !hit; n++) {
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
