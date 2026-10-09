






import { padDecimal, parseDecimal } from "../netcode/journal/decimal";
import { pauseBarrierFrame } from "../netcode/journal/lifecycle";
import type { ControlState } from "../netcode/journal/source";
import { PARTICIPANT_SLOTS, type Slots, isParticipantSlot, participantActive } from "../input/participants";

export const CONTROL_ACK_PREFIX = "SC_JC";

export const PAUSE_REQUEST_PREFIX = "SC_JP";

interface BarrierRequest {

  readonly stage: ControlState;





  readonly target: number | undefined;

  frame: number | undefined;
}

export interface PauseBarrier {
  request: BarrierRequest | undefined;

  readonly sequences: Slots<number>;

  readonly frames: Slots<number | undefined>;

  paced: number | undefined;

  resumeQueued: boolean;
}






export const RESUME_PACE_FRAMES = 2;

export function pauseBarrier(): PauseBarrier {
  return { request: undefined, sequences: [0, 0, 0, 0], frames: [undefined, undefined, undefined, undefined], paced: undefined, resumeQueued: false };
}

export function resetPauseBarrier(barrier: PauseBarrier): void {
  barrier.request = undefined;
  barrier.sequences.fill(0);
  for (const slot of PARTICIPANT_SLOTS) barrier.frames[slot] = undefined;
  barrier.paced = undefined;
  barrier.resumeQueued = false;
}


export function paceResume(barrier: PauseBarrier, frame: number): void {
  barrier.paced = frame;
}


export function pacedStop(barrier: PauseBarrier): number | undefined {
  if (barrier.paced === undefined) return undefined;
  barrier.paced += RESUME_PACE_FRAMES;
  return barrier.paced;
}


export function settlePace(barrier: PauseBarrier, speculativeFrame: number): void {
  if (barrier.paced !== undefined && speculativeFrame < barrier.paced) barrier.paced = undefined;
}


export function requestRound(barrier: PauseBarrier, stage: ControlState, target?: number): void {
  barrier.request = { stage, target, frame: undefined };
  for (const slot of PARTICIPANT_SLOTS) barrier.frames[slot] = undefined;
}


export const pausing = (barrier: Readonly<PauseBarrier>): boolean => barrier.request !== undefined && barrier.request.stage !== "RESUME";


export function agreedFrame({ request }: Readonly<PauseBarrier>): number | undefined {
  return request !== undefined && request.stage !== "PREPARE" ? request.frame : undefined;
}





export function stopFrame(barrier: Readonly<PauseBarrier>): number | undefined {
  const { request } = barrier;
  if (request === undefined) return undefined;
  return agreedFrame(barrier) ?? (pausing(barrier) ? request.target : undefined);
}


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
  const common = request.target ?? pauseBarrierFrame([first, ...rest]);
  if (request.stage !== "PREPARE" && prepared.some(frame => frame !== common)) return { failure: "players acknowledged different pause frames" };
  request.frame = common;
  return "complete";
}
