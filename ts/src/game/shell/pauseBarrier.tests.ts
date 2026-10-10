import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import type { ControlState } from "../netcode/journal/source";
import { RESUME_PACE_FRAMES, agreedFrame, encodeControlAck, paceResume, pacedStop, pauseBarrier, pausing, preparedFrame, receiveControlAck, requestRound, resetPauseBarrier, settlePace, stopFrame } from "./pauseBarrier";

const EPOCH = 3;
const HUMANS = 0b0101;
const ack = (slot: number, sequence: number, stage: ControlState, frame: number) => encodeControlAck({ epoch: EPOCH, slot, sequence, stage, frame });

test("a shared pause completes only when every human acknowledged each round in sequence [k3 measure docs/netcode-proposal.md]", () => {
  const barrier = pauseBarrier();
  requestRound(barrier, "PREPARE");
  assertTrue(pausing(barrier));
  assertEquals(receiveControlAck(barrier, HUMANS, EPOCH, 0, ack(0, 1, "PAUSE", 40)), "ignored");
  assertEquals(receiveControlAck(barrier, HUMANS, EPOCH + 1, 0, ack(0, 1, "PREPARE", 40)), "ignored");
  assertEquals(receiveControlAck(barrier, HUMANS, EPOCH, 2, ack(0, 1, "PREPARE", 40)), "ignored");
  assertEquals(receiveControlAck(barrier, HUMANS, EPOCH, 0, ack(0, 1, "PREPARE", 40)), "recorded");
  assertEquals(preparedFrame(barrier), undefined);
  assertEquals(receiveControlAck(barrier, HUMANS, EPOCH, 2, ack(2, 1, "PREPARE", 43)), "complete");

  assertEquals(preparedFrame(barrier), 43);
  assertEquals(agreedFrame(barrier), undefined);

  requestRound(barrier, "PAUSE");
  assertEquals(receiveControlAck(barrier, HUMANS, EPOCH, 2, ack(2, 2, "PAUSE", 43)), "recorded");
  assertEquals(receiveControlAck(barrier, HUMANS, EPOCH, 0, ack(0, 2, "PAUSE", 43)), "complete");
  assertEquals(agreedFrame(barrier), 43);

  requestRound(barrier, "RESUME");
  assertFalse(pausing(barrier));
  const skipped = receiveControlAck(barrier, HUMANS, EPOCH, 0, ack(0, 4, "RESUME", 43));
  assertEquals(typeof skipped === "object" ? skipped.failure : skipped, "pause acknowledgments arrived out of sequence");
});

test("players that acknowledge different pause frames stop the journal [k3 measure docs/netcode-proposal.md]", () => {
  const barrier = pauseBarrier();
  requestRound(barrier, "RESUME");
  assertEquals(receiveControlAck(barrier, HUMANS, EPOCH, 0, ack(0, 1, "RESUME", 50)), "recorded");
  const split = receiveControlAck(barrier, HUMANS, EPOCH, 2, ack(2, 1, "RESUME", 51));
  assertEquals(typeof split === "object" ? split.failure : split, "players acknowledged different pause frames");
  assertEquals(agreedFrame(barrier), undefined);
});
