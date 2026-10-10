import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { Action, maskOf } from "../input/actions";
import { queueAttack } from "../input/attackBuffer";
import { type InputRow, inputRow } from "../input/inputRow";
import { participantInputs } from "../input/participants";
import { firstFighterPoseDifference } from "../presentation/fighterPose";
import { firstImpactDifference } from "../presentation/impactState";
import { firstFighterDifference, firstStateDifference } from "../replay/difference";
import { type ReplayState, captureReplaySnapshot, copyReplayState, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { analogShieldStrength } from "../sim/shield";
import { Character } from "../sim/codes";
import { sameCameraSubjects, sameMatchCamera } from "../sim/matchCamera";
import { fighterAt } from "../sim/roster";
import { createFrameControls } from "./controls";
import { captureFrame, captureNetworkFrame, copyMatchFrameInput, createMatchFrameInput, executeMatchFrame, resetMatchFrameInput, sameMatchFrameInput } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { type TestMatch, executeNext, replayState, testMatch } from "./testMatch";

function row(fields: Parameters<typeof inputRow>[0]): InputRow {
  return assertDefined(inputRow(fields), "input row");
}


function assertSameMatch(expected: TestMatch, actual: TestMatch): void {
  for (const slot of [0, 1] as const) {
    assertEquals(firstFighterDifference(fighterAt(expected.world, slot), fighterAt(actual.world, slot), 3, 3), undefined);
    assertEquals(firstFighterPoseDifference(expected.runtime.poses[slot], actual.runtime.poses[slot], expected.world, actual.world), undefined);
  }
  assertEquals(firstImpactDifference(expected.runtime.impacts, actual.runtime.impacts), undefined);
}

test("a captured row is detached from the controls that produced it [k1 scenario]", () => {
  const recorded = testMatch(3, Character.rifleman);
  const expected = testMatch(3, Character.rifleman);
  const producer = recorded.inputs;
  queueAttack(producer.commands[0], { style: 0, facing: 0, frame: 1, mayCharge: false });
  producer.inputs[1].shield = true;
  assertTrue(captureFrame(recorded.row, 1, 3, producer, recorded.runtime));

  producer.inputs[0].shield = true;
  producer.inputs[1].shield = false;
  producer.commands[0].pending = undefined;
  assertFalse(captureFrame(recorded.row, 1, 3, producer, recorded.runtime));
  queueAttack(expected.inputs.commands[0], { style: 0, facing: 0, frame: 1, mayCharge: false });
  expected.inputs.inputs[1].shield = true;
  executeNext(expected);
  assertTrue(executeMatchFrame(recorded.row, recorded.game, recorded.world, recorded.inputs, recorded.runtime, 1));
  assertEquals(fighterAt(recorded.world, 0).attack.serial, 1);
  assertTrue(fighterAt(recorded.world, 1).shield.raised);
  assertSameMatch(expected, recorded);
});

test("a copied row executes as its source [k1 scenario]", () => {
  const original = testMatch(3, Character.rifleman);
  const copied = testMatch(3, Character.rifleman);
  const copy = createMatchFrameInput();
  for (let frame = 1; frame <= 22; frame++) {
    original.inputs.inputs[0].specialPressed = frame === 1;
    original.inputs.inputs[0].down = true;
    original.inputs.inputs[0].specialZ = -1;
    original.inputs.inputs[1].direction = frame < 6 ? -1 : 0;
    assertTrue(captureFrame(original.row, frame, 3, original.inputs, original.runtime));
    copyMatchFrameInput(copy, original.row);
    assertTrue(sameMatchFrameInput(copy, original.row));
    assertTrue(executeMatchFrame(original.row, original.game, original.world, original.inputs, original.runtime, frame));
    assertTrue(executeMatchFrame(copy, copied.game, copied.world, copied.inputs, copied.runtime, frame));
  }
  assertTrue(fighterAt(original.world, 0).freezeTrap.life > 0);
  assertSameMatch(original, copied);
});

test("a network row adapts again from the world it replays into [k1 scenario]", () => {
  const match = testMatch(3, Character.rifleman);
  const source = participantInputs();
  Object.assign(source[0], row({ held: maskOf(Action.moveRight), pressed: maskOf(Action.moveRight), axisX: 127 }));
  Object.assign(source[1], row({ held: maskOf(Action.leftTrigger), pressed: maskOf(Action.leftTrigger), triggerLeft: 255 }));
  const before = createReplaySnapshot();
  const after = createReplaySnapshot();
  captureReplaySnapshot(before, match.world, match.game, match.inputs, match.runtime);
  assertTrue(captureNetworkFrame(match.row, 1, source, match.world, 3));
  assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, 1));
  assertEquals(match.row.scratch.inputs[0].direction, 1);
  assertTrue(fighterAt(match.world, 1).shield.raised);
  captureReplaySnapshot(after, match.world, match.game, match.inputs, match.runtime);
  restoreReplaySnapshot(before, match.world, match.game, match.inputs, match.runtime);
  assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, 1));
  for (const slot of [0, 1] as const) {
    assertEquals(firstFighterDifference(fighterAt(after.world, slot), fighterAt(match.world, slot), 3, 3), undefined);
    assertEquals(firstFighterPoseDifference(after.runtime.poses[slot], match.runtime.poses[slot], after.world, match.world), undefined);
  }
});

test("a frame handed an earlier run's camera reaches the state recomputing the camera does [invariant]", () => {
  const frames = 600;
  const earlier = testMatch(15, Character.rifleman);
  const rows = Array.from({ length: frames + 1 }, () => createMatchFrameInput());
  const snapshots = Array.from({ length: frames + 1 }, () => createReplaySnapshot());
  captureReplaySnapshot(at(snapshots, 0), earlier.world, earlier.game, earlier.inputs, earlier.runtime);
  for (let frame = 1; frame <= frames; frame++) {
    for (const slot of [0, 1, 2, 3] as const) {
      const input = earlier.inputs.inputs[slot];
      const phase = floorMod(frame + slot * 37, 120);
      input.direction = phase < 30 ? 1 : phase >= 60 && phase < 90 ? -1 : 0;
      input.jumpPressed = phase === 45;
      input.jumpHeld = phase >= 45 && phase < 55;
      if (floorMod(phase, 20) === 10) queueAttack(earlier.inputs.commands[slot], { style: floorMod(phase, 3), facing: 0, frame, mayCharge: false });
    }
    assertTrue(captureFrame(at(rows, frame), frame, 15, earlier.inputs, earlier.runtime));
    assertTrue(executeMatchFrame(at(rows, frame), earlier.game, earlier.world, earlier.inputs, earlier.runtime, frame));
    captureReplaySnapshot(at(snapshots, frame), earlier.world, earlier.game, earlier.inputs, earlier.runtime);
  }

  // A corrected run: the same rows, but slot 3 carries more damage, so it moves alike until a hit launches it farther.
  const corrected: ReplayState = createReplaySnapshot();
  copyReplayState(corrected, at(snapshots, 0));
  fighterAt(corrected.world, 3).status.damage = 120.0;
  const copied = testMatch(15, Character.rifleman);
  const recomputed = testMatch(15, Character.rifleman);
  let reused = 0;
  let declined = 0;
  for (let frame = 1; frame <= frames; frame++) {
    const before = at(snapshots, frame - 1);
    const after = at(snapshots, frame);
    const framed = sameMatchCamera(corrected.match.camera, before.match.camera);
    copyReplayState(replayState(copied), corrected);
    copyReplayState(replayState(recomputed), corrected);
    assertTrue(executeMatchFrame(at(rows, frame), copied.game, copied.world, copied.inputs, copied.runtime, frame, undefined, undefined, framed ? after : undefined));
    assertTrue(executeMatchFrame(at(rows, frame), recomputed.game, recomputed.world, recomputed.inputs, recomputed.runtime, frame));
    assertEquals(firstStateDifference(replayState(recomputed), replayState(copied)), undefined);
    if (framed && sameCameraSubjects(copied.world, after.world)) reused++;
    else declined++;
    copyReplayState(corrected, replayState(recomputed));
  }
  assertTrue(reused > 0);
  assertTrue(declined > 0);
});
