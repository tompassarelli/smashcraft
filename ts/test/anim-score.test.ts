import { expect, test } from "bun:test";
import { scoreMove, THRESHOLDS, type MoveSample, type ScoreFrame } from "../scripts/wisp/animScore";

function strike(armOnly = false, followThrough = true): MoveSample {
  const hands = [0.4, 0.1, -0.3, 0.075, 0.45, 0.825, 1.2, followThrough ? 1.3 : 1.2];
  const bodies = [0, -0.2, -0.4, -0.175, 0.05, 0.275, 0.5, followThrough ? 0.55 : 0.5];
  for (let frame = 8; frame <= 30; frame++) {
    const recovery = (frame - 7) / 23;
    hands.push(hands[7]! * (1 - recovery) + 0.4 * recovery);
    bodies.push(bodies[7]! * (1 - recovery));
  }
  hands.push(0.4, 0.4); bodies.push(0, 0);
  const pose = (frame: number, body: number, hand: number): ScoreFrame => ({
    frame,
    vertices: new Float32Array([body - 0.3, 0, body + 0.3, 0, body + 0.3, 2, body - 0.3, 2, hand - 0.1, 0.85, hand + 0.1, 0.85, hand + 0.1, 1.15, hand - 0.1, 1.15]),
    drawn: new Uint8Array(8).fill(1),
    faces: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]),
    nodes: new Float32Array([body, 0.6, body, 1, body, 1, hand, 1]),
  });
  return {
    moveClass: "jab", frames: hands.map((hand, frame) => pose(frame, armOnly ? 0 : bodies[frame]!, hand)),
    moveFrames: 31, ready: pose(0, 0, 0.4),
    skeleton: { names: ["pelvis", "chest", "shoulder", "hand"], pelvis: 0, chest: 1, limbs: [{ name: "arm", root: 2, end: 3 }] },
    firstActive: 6, lastActive: 7, strike: { x: 1.3, z: 1 }, pixelsPerUnit: 40,
  };
}

test("the scorer passes a driven strike and fails an arm-only strike and a direct return without follow-through [spec #367]", () => {
  const score = scoreMove(strike(), THRESHOLDS.jab);
  expect([score.line1.pass, score.line2.pass, score.line3.pass, score.line4.pass]).toEqual([true, true, true, true]);
  const armOnly = scoreMove(strike(true), THRESHOLDS.jab);
  expect(armOnly.line1.pass, `body share ${armOnly.line1.bodyShare}, want a failed whole-body line`).toBe(false);
  const direct = scoreMove(strike(false, false), THRESHOLDS.jab);
  expect(direct.line2.endError).toBe(0);
  expect(direct.line2.pass, `overshoot ${direct.line2.overshoot}, want a failed follow-through line`).toBe(false);
});
