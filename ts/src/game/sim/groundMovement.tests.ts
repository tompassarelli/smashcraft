import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, bit } from "../input/actions";
import { adaptInput } from "../input/adapter";
import { inputRow } from "../input/inputRow";
import { captureFrame, createMatchFrameInput } from "../match/frameInput";
import { stateChecksum } from "../replay/canonical";
import { firstPoseDifference, firstStateDifference } from "../replay/difference";
import { IllidanLocomotion } from "../presentation/illidanMotion";
import { ReplayHistory } from "../replay/history";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { captureTape, createTapeWorld, executeTapeRow } from "../replay/tapeWorld";
import { AttackStyle, Character, GroundAction } from "./codes";
import { createFighter, type Fighter } from "./fighter";
import { fighterAt } from "./roster";
import { createReferenceFighter } from "./referenceRig";
import { advanceSolo, controls } from "./testWorld";
import {
  type GroundMovementRules,
  INITIAL_DASH_FRAMES,
  NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES,
  NTSC_FALCO_GROUND_MOVEMENT_RULES,
  NTSC_FOX_GROUND_MOVEMENT_RULES,
} from "./tuning";

const NTSC_RIGS: readonly GroundMovementRules[] = [NTSC_FOX_GROUND_MOVEMENT_RULES, NTSC_FALCO_GROUND_MOVEMENT_RULES, NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES];


function groundActionFighter(x: number, facing: number, rules: GroundMovementRules, action: GroundAction, actionFrame: number, dashDirection: number, vx: number): Fighter {
  const fighter = createReferenceFighter(Character.sylvanas, x, facing);
  fighter.tuning.ground = rules;
  fighter.ground.action = action;
  fighter.ground.actionFrame = actionFrame;
  fighter.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  fighter.ground.dashDirection = dashDirection;
  fighter.motion.vx = vx;
  return fighter;
}

test("the retail dash-to-run command uses the actor's encoded enable frame [k4 reference melee]", () => {
  NTSC_RIGS.forEach((rules, rig) => {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const input = controls({ direction: 1 });
    fighter.tuning.ground = rules;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.dash);
    assertEquals(fighter.ground.actionFrame, 1);
    const enableFrame = rig === 2 ? 16 : 12;
    for (let frame = 2; frame <= enableFrame - 1; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.ground.action, GroundAction.dash);
      assertEquals(fighter.ground.actionFrame, frame);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.run);
    assertEquals(fighter.ground.actionFrame, 0);
  });
});

test("movement pivots: recorded reverse-neutral rows retain a slide and next-frame tilt smash and grab facing through rollback [k1 scenario]", () => {
  for (const facing of [-1, 1]) {
    for (const warmup of [5, 20]) {
      for (const move of [AttackStyle.forwardTilt, AttackStyle.forwardSmash, AttackStyle.grab]) {
        const make = () => createTapeWorld({ stocks: 1, humans: 2,
          first: createFighter(Character.rifleman, 0.0, facing), second: createFighter(Character.rifleman, f32(-facing * 600.0), -facing) });
        const canonical = make();
        const replayed = make();
        const history = new ReplayHistory();
        const row = createMatchFrameInput();
        assertTrue(history.beginEpoch(1, 1));
        const releaseFrame = warmup + 3;
        for (let frame = 1; frame <= releaseFrame + 1; frame++) {
          const sideSmash = facing === 1 ? Action.smashLeft : Action.smashRight;
          const pressed = frame !== releaseFrame + 1 ? 0 : bit(move === AttackStyle.grab ? Action.grab : sideSmash);
          const held = pressed | (frame === releaseFrame + 1 && move === AttackStyle.forwardTilt ? bit(Action.walk) : 0);
          const axisX = frame <= warmup ? facing * 127 : frame < releaseFrame ? -facing * 127 : 0;
          adaptInput(assertDefined(inputRow({ held, pressed, axisX })), fighterAt(canonical.live.world, 0), frame,
            canonical.live.controls.inputs[0], canonical.live.controls.commands[0]);
          assertTrue(captureFrame(row, frame, 3, canonical.live.controls, canonical.live.runtime));
          assertTrue(history.save(1, row, replayed.live));
          assertTrue(executeTapeRow(canonical, row));
          assertTrue(executeTapeRow(replayed, row));
          if (frame >= warmup + 2) assertTrue(history.replay(1, warmup + 1, frame, replayed.live));
          assertEquals(firstStateDifference(captureTape(canonical), captureTape(replayed)), undefined, `first differing frame ${frame}`);
          assertEquals(firstPoseDifference(canonical.live, replayed.live), undefined, `first differing pose frame ${frame}`);
          assertEquals(stateChecksum(canonical.live), stateChecksum(replayed.live), `checksum frame ${frame}`);
          const fighter = fighterAt(canonical.live.world, 0);
          if (frame === warmup + 1) {
            const omitted = createReplaySnapshot();
            copyReplayState(omitted, canonical.live);
            fighterAt(omitted.world, 0).ground.pivotEligible = false;
            assertTrue(firstStateDifference(canonical.live, omitted)?.includes("groundPivotEligible") === true);
            assertTrue(stateChecksum(canonical.live) !== stateChecksum(omitted));
          }
          if (frame === releaseFrame) {
            assertEquals(fighter.facing, -facing, `pivot release frame ${frame}`);
            assertEquals(fighter.ground.action, GroundAction.none);
            assertTrue(fighter.motion.vx * facing > 0 && Math.abs(fighter.motion.vx) < 2.0);
            assertEquals(fighter.attack.style, undefined);
            assertTrue(canonical.live.runtime.poses[0].motion.motion !== IllidanLocomotion.turn);
            assertEquals(canonical.live.runtime.poses[0].motion.transitionRemaining, 0);
          }
          if (frame === releaseFrame + 1) {
            assertEquals(fighter.attack.style, move, `next actionable frame ${frame}`);
            assertEquals(fighter.facing, -facing);
          }
        }
      }
    }
  }
});

function timingViolation(fighter: Fighter, facing: number, reversedFrames: number, running: boolean): string | undefined {
  if (reversedFrames <= 2) {
    if (fighter.facing !== -facing || fighter.ground.action !== GroundAction.none) return "short reversal failed to pivot";
    if (fighter.motion.vx * facing <= 0 || Math.abs(fighter.motion.vx) >= 2.0) return "pivot lost its small forward slide";
  } else if (running) {
    if (fighter.ground.action !== GroundAction.turnRun || fighter.facing !== facing) return "long reversal bypassed the turnaround";
  } else if (fighter.ground.action !== GroundAction.dash || fighter.facing !== -facing) return "long early-dash reversal lost dash dancing";
  return undefined;
}

test("movement pivots: release after one or two reverse samples pivots; longer run reversals turn and early dash reversals keep dash dancing [k2 property]", () => {
  for (const running of [false, true]) {
    for (const amplitude of [1.0, 0.8500000238418579]) {
      for (let reversedFrames = 1; reversedFrames <= 5; reversedFrames++) {
        const right = createFighter(Character.rifleman, 0.0, 1);
        const left = createFighter(Character.rifleman, 0.0, -1);
        const warmup = running ? 20 : reversedFrames + 2;
        for (let frame = 0; frame < warmup + reversedFrames + 1; frame++) {
          const direction = frame < warmup ? 1 : frame < warmup + reversedFrames ? -1 : 0;
          for (const fighter of [right, left]) {
            const sign = fighter === right ? 1 : -1;
            advanceSolo(fighter, 0, controls({ direction: direction * sign, diStickValid: true,
              diStickX: f32(f32(direction * sign) * amplitude) }), 0.0);
          }
          assertEquals(right.facing, -left.facing, `reflection frame ${frame}`);
          assertEquals(right.motion.vx, -left.motion.vx, `reflected momentum frame ${frame}`);
          assertTrue(Math.abs(right.motion.vx) <= right.tuning.physics.groundSpeedCap);
        }
        for (const fighter of [right, left]) {
          assertEquals(timingViolation(fighter, fighter === right ? 1 : -1, reversedFrames, running), undefined,
            `warmup ${warmup}, reverse samples ${reversedFrames}, amplitude ${amplitude}`);
        }
        if (running && reversedFrames === 3) {
          right.ground.action = GroundAction.none;
          right.facing = -1;
          assertEquals(timingViolation(right, 1, reversedFrames, true), "long reversal bypassed the turnaround");
        }
      }
    }
  }
});

test("a turn-run waits for the retail facing command boundary [k4 reference melee]", () => {
  for (const rules of [NTSC_FOX_GROUND_MOVEMENT_RULES, NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES]) {
    const fighter = groundActionFighter(0.0, 1, rules, GroundAction.run, 4, 1, 13.199999809265137);
    const input = controls({ direction: -1 });
    const turnRunEndFrame = rules === NTSC_FOX_GROUND_MOVEMENT_RULES ? 20 : 22;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.turnRun);
    assertEquals(fighter.ground.actionFrame, 0);
    assertEquals(fighter.facing, 1);
    for (let frame = 1; frame <= 9; frame++) advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.facing, 1);
    assertEquals(fighter.ground.actionFrame, 9);


    for (let frame = 1; frame <= 9; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.facing, 1);
      assertEquals(fighter.ground.actionFrame, 9);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.facing, -1);
    assertEquals(fighter.ground.action, GroundAction.turnRun);
    assertEquals(fighter.ground.actionFrame, 9);
    for (let frame = 10; frame <= turnRunEndFrame - 1; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.ground.action, GroundAction.turnRun);
      assertEquals(fighter.ground.actionFrame, frame);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.run);
    assertEquals(fighter.ground.actionFrame, 0);
    assertEquals(fighter.facing, -1);
  }
});

test("a run-brake turn input closes at the actor's frame-fifteen command [k4 reference melee]", () => {
  const allowed = groundActionFighter(0.0, 1, NTSC_FOX_GROUND_MOVEMENT_RULES, GroundAction.runBrake, 13, 1, 9.0);
  const denied = groundActionFighter(100.0, 1, NTSC_FOX_GROUND_MOVEMENT_RULES, GroundAction.runBrake, 14, 1, 9.0);
  const input = controls({ direction: -1 });
  advanceSolo(allowed, 0, input, 0.0);
  assertEquals(allowed.ground.action, GroundAction.turnRun);
  assertEquals(allowed.ground.actionFrame, 14);
  for (let frame = 1; frame <= 15; frame++) {
    advanceSolo(allowed, 0, input, 0.0);
    if (allowed.facing === 1) assertEquals(allowed.ground.actionFrame, 15);
  }
  assertEquals(allowed.facing, -1);
  for (let frame = 1; frame <= 20; frame++) {
    if (allowed.ground.action === GroundAction.turnRun) advanceSolo(allowed, 0, input, 0.0);
  }
  assertEquals(allowed.ground.action, GroundAction.run);
  assertEquals(allowed.ground.actionFrame, 0);
  advanceSolo(denied, 0, input, 0.0);
  assertEquals(denied.ground.action, GroundAction.runBrake);
  assertEquals(denied.ground.actionFrame, 15);
  assertEquals(denied.facing, 1);
});

test("a turn-run uses the retail velocity threshold in world units [k4 reference melee]", () => {
  const input = controls({ direction: -1 });


  for (const [vx, turns] of [[0.029999999329447746, true], [0.05999999865889549, true], [0.07000000029802322, false]] as const) {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    fighter.ground.action = GroundAction.turnRun;
    fighter.ground.actionFrame = 9;
    fighter.ground.turnRunEntryFacing = 1;
    fighter.ground.turnRunFacingCommandLatched = true;
    fighter.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
    fighter.ground.dashDirection = 1;
    fighter.motion.vx = vx;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.facing, turns ? -1 : 1);
    assertEquals(fighter.ground.actionFrame, 9);
  }
});

test("a retail run-brake ends at its clip or its maximum frame count [k4 reference melee]", () => {
  NTSC_RIGS.forEach((rules, rig) => {
    const fighter = groundActionFighter(0.0, 1, rules, GroundAction.runBrake, 0, 1, 0.4000000059604645);
    fighter.ground.runBrakeFramesRemaining = rules.runBrakeMaximumFrames;
    const input = controls({ direction: 1 });
    const clipEnd = rig === 2 ? 28 : 18;
    for (let frame = 1; frame <= clipEnd - 1; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.ground.action, GroundAction.runBrake);
      assertEquals(fighter.ground.runBrakeFramesRemaining, 30 - frame);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.none);
    assertEquals(fighter.ground.runBrakeFramesRemaining, 0);
  });
  const capped = groundActionFighter(0.0, 1, { ...NTSC_FOX_GROUND_MOVEMENT_RULES, runBrakeAnimationEndFrame: 40 }, GroundAction.runBrake, 0, 1, 0.4000000059604645);
  capped.ground.runBrakeFramesRemaining = 30;
  const capInput = controls({ direction: 1 });
  for (let frame = 1; frame <= 29; frame++) {
    advanceSolo(capped, 0, capInput, 0.0);
    assertEquals(capped.ground.action, GroundAction.runBrake);
  }
  advanceSolo(capped, 0, capInput, 0.0);
  assertEquals(capped.ground.action, GroundAction.none);
  assertEquals(capped.ground.runBrakeFramesRemaining, 0);
});
