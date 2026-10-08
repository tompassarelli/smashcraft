import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference, firstStateDifference } from "../replay/difference";
import { ReplayHistory } from "../replay/history";
import { captureTape, createTapeWorld, executeTapeRow } from "../replay/tapeWorld";
import { Action, bit } from "../input/actions";
import { adaptInput } from "../input/adapter";
import { attackBuffer } from "../input/attackBuffer";
import { type InputRow, inputRow } from "../input/inputRow";
import { type KeyboardCapture, commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";
import { captureFrame, createMatchFrameInput } from "../match/frameInput";
import { fighterAt } from "./roster";
import { Character, GroundAction } from "./codes";
import { createFighter, type Fighter } from "./fighter";
import { advanceSolo, controls } from "./testWorld";

function sample(fighter: Fighter, direction: number, amplitude = 1.0, walking = false): void {
  advanceSolo(fighter, 0, controls({ direction, diStickValid: true, diStickX: f32(direction * amplitude), walking }), 0.0);
}

function dashFor(fighter: Fighter, facing: number, frames: number): void {
  for (let frame = 0; frame < frames; frame++) sample(fighter, facing);
}

test("dash dancing: authored window accepts thirteen held frames and rejects fourteen", () => {
  for (const facing of [-1, 1]) {
    for (const hold of [13, 14]) {
      const fighter = createFighter(Character.archer, 0.0, facing);
      dashFor(fighter, facing, hold);
      sample(fighter, -facing);
      assertEquals(fighter.ground.action, hold === 13 ? GroundAction.dash : GroundAction.turnRun);
      assertEquals(fighter.facing, hold === 13 ? -facing : facing);
    }
  }
});

test("dash dancing: weak travel gets a second and third sample at the last dash frame", () => {
  for (const facing of [-1, 1]) {
    const fighter = createFighter(Character.archer, 0.0, facing);
    dashFor(fighter, facing, 13);
    sample(fighter, -facing, f32(0.79));
    assertEquals(fighter.facing, facing);
    assertEquals(fighter.ground.action, GroundAction.dash);
    sample(fighter, -facing, f32(0.5));
    assertEquals(fighter.facing, facing);
    assertEquals(fighter.ground.action, GroundAction.dash);
    sample(fighter, -facing, f32(0.81));
    assertEquals(fighter.facing, -facing);
    assertEquals(fighter.ground.action, GroundAction.dash);
    assertEquals(fighter.ground.dashFrame, 1);
  }
});

test("dash dancing: deliberate walking and slow stick turns stay walks", () => {
  for (const facing of [-1, 1]) {
    const fighter = createFighter(Character.archer, 0.0, facing);
    dashFor(fighter, facing, 5);
    sample(fighter, -facing, 1.0, true);
    assertEquals(fighter.ground.action, GroundAction.none);
    const slow = createFighter(Character.archer, 0.0, facing);
    dashFor(slow, facing, 5);
    sample(slow, -facing, f32(0.79));
    sample(slow, -facing, f32(0.79));
    assertEquals(slow.ground.action, GroundAction.dash);
    assertEquals(slow.facing, facing);
    sample(slow, -facing, f32(0.79));
    assertEquals(slow.ground.action, GroundAction.none);
    assertEquals(slow.facing, -facing);
    // Weak travel beginning after the initial frames walks at once, as from standing.
    const late = createFighter(Character.archer, 0.0, facing);
    dashFor(late, facing, 13);
    for (let frame = 0; frame < 3; frame++) sample(late, 0);
    sample(late, -facing, f32(0.79));
    assertEquals(late.ground.action, GroundAction.none);
    assertEquals(late.facing, -facing);
  }
});

test("dash dancing: 512 analog and digital timelines have zero transition or rollback mismatches", () => {
  let cases = 0;
  for (const character of [Character.archer, Character.rifleman]) {
    for (const facing of [-1, 1]) {
      for (let hold = 1; hold <= 16; hold++) {
        for (const travel of [0, 1]) {
          for (const amplitude of [f32(0.79), f32(0.8), f32(0.81), 1.0]) {
            // Digital direction is a full-strength sample, with no analog row.
            const digital = amplitude === 1.0;
            const fighter = createFighter(character, 0.0, facing);
            dashFor(fighter, facing, hold);
            if (travel === 1) sample(fighter, -facing, f32(0.79));
            const rollback = createFighter(character, 0.0, facing);
            copyFighterState(rollback, fighter, 1);
            const input = digital ? controls({ direction: -facing }) : controls({ direction: -facing, diStickValid: true, diStickX: f32(-facing * amplitude) });
            advanceSolo(fighter, 0, input, 0.0);
            advanceSolo(rollback, 0, input, 0.0);
            assertEquals(rollback.ground.action, fighter.ground.action);
            assertEquals(rollback.ground.actionFrame, fighter.ground.actionFrame);
            assertEquals(rollback.motion.x, fighter.motion.x);
            assertEquals(rollback.motion.vx, fighter.motion.vx);
            assertEquals(rollback.motion.stickSideAge, fighter.motion.stickSideAge);
            assertEquals(rollback.facing, fighter.facing);
            assertEquals(firstFighterDifference(fighter, rollback, 1, 1), undefined);
            const accepted = hold <= 13 && amplitude >= f32(0.8);
            assertEquals(fighter.ground.action === GroundAction.dash && fighter.ground.dashFrame === 1, accepted);
            if (accepted) assertEquals(fighter.facing, -facing);
            cases++;
          }
        }
      }
    }
  }
  assertEquals(cases, 512);
});

test("dash dancing: recorded analog reversal rows replay through the two-sample boundary", () => {
  for (const facing of [-1, 1]) {
    const make = () => createTapeWorld({ stocks: 1, humans: 2, first: createFighter(Character.archer, -240.0, facing), second: createFighter(Character.rifleman, 240.0, -facing) });
    const canonical = make();
    const replayed = make();
    const history = new ReplayHistory();
    assertTrue(history.beginEpoch(1, 1));
    const row = createMatchFrameInput();
    for (let frame = 1; frame <= 28; frame++) {
      const axis = frame <= 13 ? facing * 127 : frame === 14 ? -facing * 101 : frame <= 20 ? -facing * 102 : facing * 127;
      const recorded = assertDefined(inputRow({ axisX: axis }));
      adaptInput(recorded, fighterAt(canonical.live.world, 0), frame, canonical.live.controls.inputs[0], canonical.live.controls.commands[0]);
      assertTrue(captureFrame(row, frame, 3, canonical.live.controls, canonical.live.runtime));
      assertTrue(history.save(1, row, replayed.live));
      assertTrue(executeTapeRow(canonical, row));
      assertTrue(executeTapeRow(replayed, row));
      if (frame >= 15) assertTrue(history.replay(1, 14, frame, replayed.live));
      assertEquals(firstStateDifference(captureTape(canonical), captureTape(replayed)), undefined);
      if (frame === 15) assertEquals(fighterAt(canonical.live.world, 0).facing, -facing);
    }
  }
});

// #188 scripted dash dance: alternating flicks through the real input adapter.
const HELPER_DEADZONE = f32(0.28);
// The helper holds a digital direction beyond 7000 of 32767 raw.
const HELPER_DIGITAL = 7000 / 32767;
const ROSTER: readonly Character[] = [
  Character.archer, Character.rifleman, Character.demonHunter, Character.blademaster, Character.mountainKing, Character.warden,
  Character.lich, Character.forsakenPaladin, Character.dreadlord, Character.shadowHunter, Character.pitLord, Character.beastmaster, Character.lichKing,
];
const DanceInput = { stick: 0, keyOverlap: 1, keyGap: 2 } as const;
type DanceInput = (typeof DanceInput)[keyof typeof DanceInput];
// Holds before each flick, from a one-frame tap to a flick whose travel reaches the last dash frame.
const DANCE_HOLDS = [1, 3, 6, 9, 2, 5, 10, 4];
// Stick sample phases within a frame (tenths); keyboard samples have no phase.
const DANCE_INPUTS: readonly (readonly [DanceInput, number])[] = [
  [DanceInput.stick, 0], [DanceInput.stick, 1], [DanceInput.stick, 2], [DanceInput.stick, 3], [DanceInput.stick, 4],
  [DanceInput.stick, 5], [DanceInput.stick, 6], [DanceInput.stick, 7], [DanceInput.stick, 8], [DanceInput.stick, 9],
  [DanceInput.keyOverlap, 0], [DanceInput.keyGap, 0],
];

interface DanceDriver {
  readonly fighter: Fighter;
  readonly keys: KeyboardCapture;
  readonly controls: ReturnType<typeof controls>;
  readonly attacks: ReturnType<typeof attackBuffer>;
  frame: number;
}

function danceDriver(character: Character, facing: number): DanceDriver {
  return { fighter: createFighter(character, 0.0, facing), keys: keyboardCapture(), controls: controls(), attacks: attackBuffer(0), frame: 0 };
}

function adaptAndAdvance(driver: DanceDriver, row: Readonly<InputRow>): void {
  driver.frame++;
  adaptInput(row, driver.fighter, driver.frame, driver.controls, driver.attacks);
  advanceSolo(driver.fighter, 0, driver.controls, 0.0);
}

/** One stick sample as the helper quantizes it: Melee's axial deadzone, then the journal's axis byte and digital holds. */
function stickSample(driver: DanceDriver, x: number): void {
  const kept = Math.abs(x) <= HELPER_DEADZONE ? 0 : x;
  const axis = kept < 0 ? -Math.floor(-kept * 127) : Math.floor(kept * 127);
  const held = kept < -HELPER_DIGITAL ? bit(Action.moveLeft) : kept > HELPER_DIGITAL ? bit(Action.moveRight) : 0;
  adaptAndAdvance(driver, assertDefined(inputRow({ held, axisX: axis })));
}

/** One keyboard sample: the held Warcraft keys reach the row through the keyboard sampler. */
function keySample(driver: DanceDriver, left: boolean, right: boolean): void {
  sampleKeys(driver.keys, (left ? bit(Action.moveLeft) : 0) | (right ? bit(Action.moveRight) : 0));
  adaptAndAdvance(driver, driver.keys.row);
  commitEdges(driver.keys);
}

/** Full hold toward `to`. */
function holdToward(driver: DanceDriver, input: DanceInput, to: number): void {
  if (input === DanceInput.stick) stickSample(driver, to);
  else keySample(driver, to < 0, to > 0);
}

/**
 * The samples a flick from -to to `to` takes over `transition` frames, ending
 * with the first full sample. A stick travels linearly between gates, sampled
 * at `phase` within each frame; keys overlap (both held) or gap (none held).
 */
function travelSample(driver: DanceDriver, input: DanceInput, to: number, transition: number, phase: number, step: number): boolean {
  if (input === DanceInput.stick) {
    const t = step + phase / 10;
    if (t >= transition) {
      stickSample(driver, to);
      return true;
    }
    stickSample(driver, f32(-to + (2 * to * t) / transition));
    return false;
  }
  if (step >= transition - 1) {
    holdToward(driver, input, to);
    return true;
  }
  const both = input === DanceInput.keyOverlap;
  keySample(driver, both, both);
  return false;
}

test("dash dancing: 9,984 scripted dash-backs over the roster, stick and keyboard, 1-4 frame flicks: 0 misreads", () => {
  let dashbacks = 0;
  let misreads = 0;
  const failures: string[] = [];
  for (const character of ROSTER) {
    for (const facing of [-1, 1]) {
      for (const [input, phase] of DANCE_INPUTS) {
        for (let transition = 1; transition <= 4; transition++) {
          const driver = danceDriver(character, facing);
          const { fighter } = driver;
          let toward = facing;
          holdToward(driver, input, toward);
          for (const hold of DANCE_HOLDS) {
            for (let frame = 1; frame < hold; frame++) holdToward(driver, input, toward);
            toward = -toward;
            let misread = false;
            let reversed = false;
            for (let step = 0; ; step++) {
              const done = travelSample(driver, input, toward, transition, phase, step);
              if (fighter.ground.action !== GroundAction.dash) misread = true;
              if (fighter.ground.dashFrame === 1 && fighter.ground.dashDirection === toward && fighter.facing === toward) reversed = true;
              if (done) {
                if (!reversed || fighter.facing !== toward || fighter.ground.dashDirection !== toward) misread = true;
                break;
              }
            }
            dashbacks++;
            if (misread) {
              misreads++;

              if (failures.length < 8) failures.push(`${character} facing ${facing} input ${input} phase ${phase} transition ${transition} hold ${hold}: action ${fighter.ground.action} facing ${fighter.facing}`);
            }
          }
        }
      }
    }
  }
  assertEquals(dashbacks, 9984);
  assertEquals(failures.join("\n"), "");
  assertEquals(misreads, 0);
});

test("dash dancing: a dash released to neutral late in its window turns into a dash, never a run turn", () => {
  let dashbacks = 0;
  for (const character of ROSTER) {
    for (const facing of [-1, 1]) {
      for (const input of [DanceInput.stick, DanceInput.keyOverlap, DanceInput.keyGap]) {
        for (let hold = 10; hold <= 13; hold++) {
          for (let neutral = 1; neutral <= 3; neutral++) {
            const driver = danceDriver(character, facing);
            for (let frame = 0; frame < hold; frame++) holdToward(driver, input, facing);
            for (let frame = 0; frame < neutral; frame++) {
              if (input === DanceInput.stick) stickSample(driver, f32(facing * f32(0.2)));
              else keySample(driver, input === DanceInput.keyOverlap, input === DanceInput.keyOverlap);
            }
            holdToward(driver, input, -facing);
            assertEquals(driver.fighter.ground.action, GroundAction.dash);
            assertEquals(driver.fighter.ground.dashFrame, 1);
            assertEquals(driver.fighter.facing, -facing);
            dashbacks++;
          }
        }
      }
    }
  }
  assertEquals(dashbacks, 936);
});
