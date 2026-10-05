// A journal match pauses and resumes only at a frame every human's helper
// acknowledged. A pause takes two rounds: each helper first acknowledges
// PREPARE with the next frame it can stop at, then PAUSE at the highest of
// those; a resume takes one RESUME round. Each client relays its helper's
// acknowledgment to every client in a synchronized SC_JC message, so all
// clients complete each round on the same message.
import { padDecimal, parseDecimal } from "../netcode/journal/decimal";
import { pauseBarrierFrame } from "../netcode/journal/lifecycle";
import type { ControlState } from "../netcode/journal/source";
import { PARTICIPANT_SLOTS, type Slots, isParticipantSlot, participantActive } from "../input/participants";

export const CONTROL_ACK_PREFIX = "SC_JC";

interface BarrierRequest {
  /** The acknowledgment each helper owes this round. */
  readonly stage: ControlState;
  /** The common frame, once every human acknowledged this round. */
  frame: number | undefined;
}

export interface PauseBarrier {
  request: BarrierRequest | undefined;
  /** Each slot's last relayed control sequence; sequences rise by one across the epoch. */
  readonly sequences: Slots<number>;
  /** Each slot's frame in the current round. */
  readonly frames: Slots<number | undefined>;
}

export function pauseBarrier(): PauseBarrier {
  return { request: undefined, sequences: [0, 0, 0, 0], frames: [undefined, undefined, undefined, undefined] };
}

export function resetPauseBarrier(barrier: PauseBarrier): void {
  barrier.request = undefined;
  barrier.sequences.fill(0);
  barrier.frames.fill(undefined);
}

/** Starts a round; the caller has written the control request the helpers answer. */
export function requestRound(barrier: PauseBarrier, stage: ControlState): void {
  barrier.request = { stage, frame: undefined };
  barrier.frames.fill(undefined);
}

/** Whether the request in flight pauses (PREPARE or PAUSE) rather than resumes. */
export const pausing = (barrier: Readonly<PauseBarrier>): boolean => barrier.request !== undefined && barrier.request.stage !== "RESUME";

/** The frame a completed PAUSE or RESUME round takes effect at. */
export function agreedFrame({ request }: Readonly<PauseBarrier>): number | undefined {
  return request !== undefined && request.stage !== "PREPARE" ? request.frame : undefined;
}

/** The frame a completed PREPARE round asks every helper to pause at. */
export function preparedFrame({ request }: Readonly<PauseBarrier>): number | undefined {
  return request?.stage === "PREPARE" ? request.frame : undefined;
}

interface ControlAck {
  readonly epoch: number;
  readonly slot: number;
  readonly sequence: number;
  readonly stage: ControlState;
  readonly frame: number;
}

const STAGE_CODES: Readonly<Record<ControlState, string>> = { PREPARE: "Q", PAUSE: "P", RESUME: "R" };

function stageOf(code: string): ControlState | undefined {
  if (code === "Q") return "PREPARE";
  if (code === "P") return "PAUSE";
  return code === "R" ? "RESUME" : undefined;
}

/** "JC1", epoch, slot, sequence, stage code, frame: decimals zero-padded to ten digits, the slot one. */
export function encodeControlAck({ epoch, slot, sequence, stage, frame }: ControlAck): string {
  return `JC1${padDecimal(epoch, 10)}${slot}${padDecimal(sequence, 10)}${STAGE_CODES[stage]}${padDecimal(frame, 10)}`;
}

function decodeControlAck(wire: string): ControlAck | undefined {
  if (wire.length !== 35 || !wire.startsWith("JC1")) return undefined;
  const epoch = parseDecimal(wire.substring(3, 13));
  const slot = parseDecimal(wire.substring(13, 14));
  const sequence = parseDecimal(wire.substring(14, 24));
  const stage = stageOf(wire.substring(24, 25));
  const frame = parseDecimal(wire.substring(25, 35));
  if (epoch === undefined || slot === undefined || sequence === undefined || stage === undefined || frame === undefined || frame <= 0) return undefined;
  return { epoch, slot, sequence, stage, frame };
}

type BarrierReceipt = "ignored" | "recorded" | "complete" | { readonly failure: string };

/**
 * Records a relayed acknowledgment from sender. Messages for another epoch,
 * another round or a slot that is not the sender are ignored; a skipped or
 * repeated sequence, or PAUSE and RESUME frames that differ, stop the journal.
 */
export function receiveControlAck(barrier: PauseBarrier, humans: number, epoch: number, sender: number, wire: string): BarrierReceipt {
  const ack = decodeControlAck(wire);
  const { request } = barrier;
  if (ack === undefined || ack.epoch !== epoch || ack.slot !== sender || !isParticipantSlot(sender)) return "ignored";
  if (request === undefined || ack.stage !== request.stage) return "ignored";
  if (ack.sequence !== barrier.sequences[sender] + 1) return { failure: "pause acknowledgments arrived out of sequence" };
  barrier.sequences[sender] = ack.sequence;
  barrier.frames[sender] = ack.frame;
  const prepared: number[] = [];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!participantActive(humans, slot)) continue;
    const frame = barrier.frames[slot];
    if (frame === undefined) return "recorded";
    prepared.push(frame);
  }
  const [first, ...rest] = prepared;
  if (first === undefined) return "recorded";
  const common = pauseBarrierFrame([first, ...rest]);
  if (request.stage !== "PREPARE" && prepared.some(frame => frame !== common)) return { failure: "players acknowledged different pause frames" };
  request.frame = common;
  return "complete";
}
