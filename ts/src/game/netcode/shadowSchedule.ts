// Rollback input on top of the fixed schedule. A speculative cursor F runs on
// the local row and predictions of late remote rows, up to R frames past the
// last frame every remote row has arrived through: the local row is final once
// captured, so its own echo never holds prediction back. A confirmed cursor
// runs only on accepted rows, through min(K, F - 1), where K is the common
// frontier. The common ledger owns synchronized rows and the confirmed cursor;
// local samples and predictions stay private to this client.
import { type InputRow, copyInput, emptyInput, predictInto, sameInput } from "../input/inputRow";
import { PARTICIPANT_CAPACITY, type ParticipantInputs, participantInputs } from "../input/participants";
import { INPUT_LAST_FRAME, type InputPacket } from "../input/wire";
import { REPLAY_HISTORY_CAPACITY, REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";
import { Capture } from "./capture";
import { type FixedDelay, FixedInputSchedule, fixedCaptureTarget } from "./fixedSchedule";
import { FrameRing } from "./frameRing";
import { FUTURE_LIMIT, type Receipt } from "./ledger";
import { at } from "wisp/src/runtime/lookup";

export const DEFAULT_ROLLBACK_WINDOW = 6;
export const PENDING_CAPACITY = 256;

/** Whether a resolved row used only accepted and captured local input, or predicted some remote row. */
type Resolution = "accepted" | "speculative";

const NEUTRAL: Readonly<InputRow> = emptyInput();

export class ShadowInputSchedule {
  private readonly schedule = new FixedInputSchedule();
  private readonly pendingRows = new FrameRing(PENDING_CAPACITY);
  // Preallocated, rewritten every speculative frame: each slot's last resolved row, its prediction basis.
  private readonly previous = participantInputs();
  private current: number | undefined;
  private fixedDelay: FixedDelay = 0;
  private window = 0;
  private nextSpeculative = 1;
  private nextConfirmed = 1;
  private preparedSpeculative: number | undefined;
  private preparedConfirmed: number | undefined;
  private acceptedCount = 0;

  /** D and R hold for the whole epoch; the replay history bounds R. */
  beginEpoch(epoch: number, delay: FixedDelay, window: number, participants: number): boolean {
    if ((this.current !== undefined && epoch <= this.current) || window < 1 || window > REPLAY_MAX_CORRECTION_FRAMES) return false;
    if (!this.schedule.beginEpoch(epoch, delay, participants)) return false;
    this.current = epoch;
    this.fixedDelay = delay;
    this.window = window;
    this.nextSpeculative = 1;
    this.nextConfirmed = 1;
    this.preparedSpeculative = undefined;
    this.preparedConfirmed = undefined;
    this.pendingRows.clear();
    for (const row of this.previous) copyInput(row, NEUTRAL);
    return true;
  }

  participantMask(): number {
    return this.schedule.participantMask();
  }

  isActive(slot: number): boolean {
    return this.schedule.isActive(slot);
  }

  epoch(): number | undefined {
    return this.current;
  }

  delay(): FixedDelay {
    return this.fixedDelay;
  }

  rollbackFrames(): number {
    return this.window;
  }

  knownThrough(): number {
    return this.schedule.knownThrough();
  }

  /** The active slots whose row for K + 1 has not arrived: the players the confirmed match waits for. */
  awaitedSlots(): number {
    const epoch = this.current;
    if (epoch === undefined) return 0;
    const frame = this.schedule.knownThrough() + 1;
    let slots = 0;
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      if (this.isActive(slot) && this.schedule.accepted(epoch, slot, frame) === undefined) slots |= 1 << slot;
    }
    return slots;
  }

  /** From `frame`, the last frame through which some active slot other than `localPlayer` has rows accepted. */
  othersThrough(localPlayer: number, frame: number): number {
    const epoch = this.current;
    let through = frame;
    if (epoch === undefined) return through;
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      if (slot === localPlayer || !this.isActive(slot)) continue;
      while (through < INPUT_LAST_FRAME && this.schedule.accepted(epoch, slot, through + 1) !== undefined) through++;
    }
    return through;
  }

  /** The last frame through which every active slot but `localPlayer` has rows accepted: what a prediction can't have to correct. */
  remoteThrough(localPlayer: number): number {
    let through = INPUT_LAST_FRAME;
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      if (slot !== localPlayer && this.isActive(slot)) through = Math.min(through, this.schedule.acceptedThrough(slot));
    }
    return through;
  }

  firstAcceptedFrame(): number {
    return this.schedule.firstRetained();
  }

  speculativeFrame(): number {
    return this.nextSpeculative;
  }

  /** The last frame the confirmed cursor may run: min(K, F - 1). */
  confirmedFrame(): number {
    return Math.min(this.schedule.knownThrough(), this.nextSpeculative - 1);
  }

  nextConfirmedFrame(): number {
    return this.nextConfirmed;
  }

  captureTarget(): number | undefined {
    return this.current === undefined ? undefined : fixedCaptureTarget(this.nextSpeculative, this.fixedDelay);
  }

  /**
   * Assigns a polled sample to F + D. Capture never moves K or either cursor,
   * and a repeated poll cannot rewrite an assigned row.
   */
  captureLocal(epoch: number, sample: Readonly<InputRow>): Capture {
    if (epoch !== this.current) return Capture.wrongEpoch;
    const target = this.captureTarget();
    if (target === undefined) return Capture.frameExhausted;
    if (this.pendingRows.row(target) !== undefined) return Capture.alreadyCaptured;
    if (!this.pendingRows.vacant(target)) return Capture.pendingFull;
    this.pendingRows.store(target, sample);
    return Capture.captured;
  }

  /**
   * Assigns a sample to the frame its producer chose, delay included. Capture
   * never retargets to the service cursor or advances common state; storage
   * is bounded by the retained history and the future limit.
   */
  captureLocalAt(epoch: number, frame: number, sample: Readonly<InputRow>): Capture {
    if (epoch !== this.current) return Capture.wrongEpoch;
    if (frame < 1 || frame > INPUT_LAST_FRAME) return Capture.frameExhausted;
    const firstRetained = this.schedule.firstRetained();
    if (frame < firstRetained) return Capture.outOfHistory;
    if (frame - (this.nextConfirmed - 1) > FUTURE_LIMIT) return Capture.tooFarAhead;
    if (frame - firstRetained >= PENDING_CAPACITY) return Capture.pendingFull;
    const assigned = this.pendingRows.row(frame);
    if (assigned !== undefined) return sameInput(assigned, sample) ? Capture.alreadyCaptured : Capture.conflict;
    if (!this.pendingRows.vacant(frame)) return Capture.pendingFull;
    this.pendingRows.store(frame, sample);
    return Capture.captured;
  }

  acceptSynchronized(sender: number, packet: InputPacket): Receipt {
    return this.counted(this.schedule.acceptSynchronized(sender, packet));
  }

  receiveSynchronized(sender: number, wire: string): Receipt {
    return this.counted(this.schedule.receiveSynchronized(sender, wire));
  }

  /** Packets accepted so far: the rows speculative frames ran can differ from accepted rows only after it changes. */
  acceptedPackets(): number {
    return this.acceptedCount;
  }

  private counted(receipt: Receipt): Receipt {
    if (receipt === "accepted") this.acceptedCount++;
    return receipt;
  }

  /** F may run while it is within R frames past the last frame every remote row has arrived through. */
  mayAdvanceSpeculative(localPlayer: number): boolean {
    return this.current !== undefined && this.nextSpeculative <= INPUT_LAST_FRAME
      && this.nextSpeculative - this.window <= this.remoteThrough(localPlayer);
  }

  /** As mayAdvanceSpeculative, and the local player's row for F is accepted or captured. */
  mayAdvanceSpeculativeFor(localPlayer: number): boolean {
    return this.isActive(localPlayer) && this.mayAdvanceSpeculative(localPlayer) && this.hasLocalRow(localPlayer);
  }

  /** Whether the local row for F is ready and prediction waits only for a remote row R frames behind it. */
  windowHalted(localPlayer: number): boolean {
    return this.current !== undefined && this.isActive(localPlayer) && this.nextSpeculative <= INPUT_LAST_FRAME
      && this.hasLocalRow(localPlayer) && !this.mayAdvanceSpeculative(localPlayer);
  }

  /** Whether the local player's row for F is accepted or captured: prediction has local rows it hasn't run. */
  hasLocalRow(localPlayer: number): boolean {
    const epoch = this.current;
    const frame = this.nextSpeculative;
    return epoch !== undefined && (this.schedule.accepted(epoch, localPlayer, frame) !== undefined || this.pendingRows.row(frame) !== undefined);
  }

  /**
   * Fills every active slot for F. Accepted input wins; otherwise the local
   * player uses its captured row and remote players are predicted from their
   * previous row, holds kept and edges and press data dropped. Only a
   * prediction makes the frame speculative.
   */
  resolveSpeculative(epoch: number, localPlayer: number, inputs: ParticipantInputs): Resolution | undefined {
    if (epoch !== this.current || this.preparedSpeculative !== undefined || !this.mayAdvanceSpeculativeFor(localPlayer)) return undefined;
    const frame = this.nextSpeculative;
    let resolution: Resolution = "accepted";
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      if (!this.isActive(slot)) continue;
      const target = at(inputs, slot);
      const previous = at(this.previous, slot);
      const accepted = this.schedule.accepted(epoch, slot, frame);
      if (accepted !== undefined) {
        copyInput(target, accepted);
      } else if (slot === localPlayer) {
        copyInput(target, this.capturedRow(frame));
      } else {
        resolution = "speculative";
        predictInto(target, previous);
      }
      copyInput(previous, target);
    }
    this.preparedSpeculative = frame;
    return resolution;
  }

  /** Call after the resolved row is recorded and executed. The local row stays until K confirms it. */
  completeSpeculative(epoch: number, frame: number): boolean {
    if (epoch !== this.current || frame !== this.nextSpeculative || frame !== this.preparedSpeculative) return false;
    this.preparedSpeculative = undefined;
    this.nextSpeculative++;
    return true;
  }

  mayAdvanceConfirmed(): boolean {
    return this.current !== undefined && this.nextConfirmed <= this.confirmedFrame();
  }

  readConfirmed(epoch: number, inputs: ParticipantInputs): boolean {
    if (epoch !== this.current || this.preparedConfirmed !== undefined || !this.mayAdvanceConfirmed()) return false;
    const frame = this.nextConfirmed;
    if (!this.schedule.readNext(epoch, inputs)) return false;
    this.preparedConfirmed = frame;
    return true;
  }

  /**
   * Call after the accepted rows ran in a confirmed world distinct from the
   * speculative one. Completion advances the common ledger's cursor.
   */
  completeConfirmed(epoch: number, frame: number): boolean {
    if (epoch !== this.current || frame !== this.nextConfirmed || frame !== this.preparedConfirmed) return false;
    if (!this.schedule.complete(epoch, frame)) return false;
    this.preparedConfirmed = undefined;
    this.nextConfirmed++;
    const expired = frame - REPLAY_HISTORY_CAPACITY;
    if (expired >= 1) this.pendingRows.release(expired);
    return true;
  }

  /** The accepted row, valid while the frame is retained. */
  accepted(epoch: number, slot: number, frame: number): Readonly<InputRow> | undefined {
    return this.schedule.accepted(epoch, slot, frame);
  }

  /** mayAdvanceSpeculativeFor proved the local row is captured whenever it is not yet accepted. */
  private capturedRow(frame: number): Readonly<InputRow> {
    const row = this.pendingRows.row(frame);
    if (row === undefined) throw new Error(`local input for frame ${frame} was never captured`);
    return row;
  }

  /** Replaces a slot's prediction basis after a correction rebuilt its rows. */
  rememberResolvedInput(slot: number, row: Readonly<InputRow>): boolean {
    if (!this.isActive(slot)) return false;
    copyInput(at(this.previous, slot), row);
    return true;
  }

  /** The local sample assigned to frame, kept until its frame leaves the replay history. */
  pending(epoch: number, frame: number): Readonly<InputRow> | undefined {
    if (epoch !== this.current || frame < 1 || frame > INPUT_LAST_FRAME) return undefined;
    return this.pendingRows.row(frame);
  }
}
