// Rollback input for one match epoch. Every client runs the confirmed match
// only on rows every human sent through the synchronized channel, at most up
// to the speculative frontier; a speculative match runs ahead on the local
// player's rows and predictions of the others for presentation, and replays
// when accepted rows differ from what it ran.
import { clearAttackBuffer } from "../../game/input/attackBuffer";
import { type InputRow, copyInput, emptyInput } from "../../game/input/inputRow";
import { commitEdges, resetKeys } from "../../game/input/keyboardCapture";
import { PARTICIPANT_SLOTS, isParticipantSlot } from "../../game/input/participants";
import { type InputPacket, encodePacket, packetSizeInRange } from "../../game/input/wire";
import { startKeyUp } from "../../game/match/controls";
import { captureNetworkFrame, resetMatchFrameInput } from "../../game/match/frameInput";
import { Phase, humanActive } from "../../game/match/rules";
import { observedFrameLegalActions, observedFrameStartedActions } from "../../game/match/step";
import { Capture } from "../../game/netcode/capture";
import { PENDING_CAPACITY } from "../../game/netcode/shadowSchedule";
import { floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { InputBatch } from "../../game/netcode/inputBatch";
import { KeyboardMailbox } from "../../game/netcode/journal/keyboard";
import { MatchLifecycle } from "../../game/netcode/journal/lifecycle";
import { JournalInputSource } from "../../game/netcode/journal/source";
import { decodeTransport } from "../../game/netcode/journal/transport";
import { captureReplaySnapshot, restoreReplaySnapshot } from "../../game/replay/snapshot";
import { resetPauseBarrier, stopFrame } from "../../game/shell/pauseBarrier";
import { REPAIR_FRAMES, confirmedBudget, speculativeBudget } from "../../game/shell/playback";
import { queueLocalRows } from "../../game/shell/localInput";
import { applyFrame, finishConfirmedFrames } from "./frame";
import { pollLocalKeys } from "./inputs";
import { INPUT_PREFIX, failJournal, flushTransport, receiveLifecycle, serviceJournalInput } from "./journal";
import { probeAdvance, probeCapture, probeClockMs, probeInput, probeIntegrity, probePoll, probeRecording, probeSendFinished, probeTransportReceive, probeTransportSend } from "./responseProbe";
import { type KeyboardRollback, type Rollback, type ShellState, localSlot, shell } from "./state";
import { recordBatchWait, recordEcho, recordSend, resetEchoRing, traceSeconds } from "./trace";
import { LASTING, setStatus } from "./view";
import { holdPresentedCapture } from "./visualCapture";
import { samplePad } from "../../game/input/padCapture";
import { pollPad, recordPadRow } from "./analogPad";

/** Callbacks without a new predicted frame before every client names the players a running match waits for. */
const STALL_NOTICE_CALLBACKS = 20;
/** At the start every helper's readiness crosses the network first; the 0.0.47 capture's clients started 0.43 s after Start. */
const START_NOTICE_CALLBACKS = 45;
const NEUTRAL: Readonly<InputRow> = emptyInput();

const failControls = (s: ShellState) => setStatus(s, "Controls stopped responding. Restart the match.", LASTING);

/** Starts a match epoch with the dev settings, seeded from the confirmed match; false when the schedule refuses them. */
export function beginRollbackEpoch(s: ShellState, rollback: Rollback): boolean {
  if (s.pad !== undefined) {
    s.pad.rows.length = 0;
    s.pad.mouse.length = 0;
    s.pad.mouseEvents = 0;
    s.pad.syncEvents = 0;
    s.pad.startedAt = s.trace.clockPeriods * 1000.0 + TimerGetElapsed(s.trace.clock);
  }
  const { schedule, speculative } = rollback;
  rollback.epoch++;
  rollback.delay = s.dev.delay;
  rollback.window = s.dev.rollback;
  rollback.batch = s.dev.batch;
  if (!schedule.beginEpoch(rollback.epoch, rollback.delay, rollback.window, s.game.humanMask)) return false;
  if (!rollback.playback.beginEpoch(rollback.epoch, schedule.rollbackFrames())) return false;
  resetEchoRing(s.trace);
  rollback.sendFailed = false;
  rollback.stalled = 0;
  rollback.waitingFor = 0;
  rollback.predictionHeld = false;
  speculative.world.mask = s.world.mask;
  captureReplaySnapshot(rollback.seed, s.world, s.game, s.controls, s.runtime);
  restoreReplaySnapshot(rollback.seed, speculative.world, speculative.game, speculative.controls, speculative.runtime);
  for (const slot of PARTICIPANT_SLOTS) {
    clearAttackBuffer(speculative.controls.commands[slot]);
    copyInput(rollback.accepted[slot], NEUTRAL);
    speculative.runtime.botAttackDelays[slot] = 0.0;
  }
  speculative.runtime.simulationFrame = 0;
  const { keyboard, journal } = rollback;
  if (keyboard !== undefined) {
    keyboard.lastTarget = undefined;
    keyboard.outgoing = new InputBatch(rollback.epoch);
    keyboard.nextSend = rollback.delay + 1;
    resetKeys(keyboard.capture, pollLocalKeys(s));
  }
  if (journal !== undefined) {
    const slot = localSlot();
    journal.failed = false;
    journal.outgoing.begin(rollback.epoch, rollback.delay + 1);
    journal.readyMask = 0;
    journal.keyboardMask = 0;
    journal.readyWait = 0;
    journal.keyClock = rollback.delay;
    journal.keyStop = undefined;
    journal.keyAnswered = undefined;
    journal.startSent = false;
    journal.lifecycle = new MatchLifecycle(rollback.epoch, s.game.humanMask);
    journal.endSent = false;
    journal.endReceived = false;
    journal.quiescent = false;
    journal.chatRequested.fill(false);
    journal.chatSerial.fill(0);
    resetPauseBarrier(journal.barrier);
    journal.source = JournalInputSource.open(s.build.id, rollback.epoch, slot, rollback.delay);
    if (journal.source === undefined) failJournal(s, rollback, journal, "epoch could not be initialized");
    if (journal.editbox !== undefined) {
      // Text focus can consume the release of the menu key that started the match.
      for (const other of PARTICIPANT_SLOTS) startKeyUp(s.session, other);
      journal.editbox.beginEpoch(s.build.id, rollback.epoch, slot);
    }
    journal.mailbox = journal.ingress === "keyboard" ? new KeyboardMailbox(s.build.id, rollback.epoch, slot) : undefined;
  }
  resetMatchFrameInput(s.frameInput);
  return true;
}

/** A refused send keeps the original rows for the next callback. */
function sendBatch(s: ShellState, rollback: Rollback, keyboard: KeyboardRollback): boolean {
  const count = keyboard.outgoing.size();
  if (count === 0) return true;
  if (rollback.sendFailed) return false;
  const packet = keyboard.outgoing.packet();
  const wire = packet === undefined ? undefined : encodePacket(packet);
  if (packet === undefined || wire === undefined || !packetSizeInRange(wire.length, count)) {
    rollback.sendFailed = true;
    failControls(s);
    return false;
  }
  const started = probeClockMs(s.probe);
  const sent = BlzSendSyncData(INPUT_PREFIX, wire);
  probeSendFinished(s.probe, started);
  if (!sent) return false;
  for (let row = 0; row < count; row++) probeTransportSend(s.probe, rollback.epoch, packet.firstFrame + row);
  const { trace } = s;
  if (trace.active) {
    trace.window.localSends++;
    trace.window.sentRows += count;
    if (count === 1) trace.window.singletons++;
    for (let row = 0; row < count; row++) {
      recordSend(trace, rollback.epoch, packet.firstFrame + row);
      const stamp = at(keyboard.stamps, floorMod(packet.firstFrame + row, PENDING_CAPACITY));
      if (stamp.traced) recordBatchWait(trace, trace.ticks - stamp.callback, traceSeconds(trace) - stamp.seconds);
    }
  }
  keyboard.nextSend = packet.firstFrame + count;
  keyboard.outgoing.sent();
  return true;
}

/**
 * Polls the local keys into the next row and assigns it to its frame. Neutral
 * while paused or inactive: that latches releases, which the sampler keeps
 * until a frame not yet assigned can carry them.
 */
function captureKeyboard(s: ShellState, rollback: Rollback, keyboard: KeyboardRollback): void {
  const { trace, probe } = s;
  const { schedule, epoch } = rollback;
  if (trace.active) trace.window.localPolls++;
  const held = s.session.paused ? 0 : pollLocalKeys(s);
  samplePad(keyboard.capture, held, pollPad(s));
  if (probeRecording(probe)) probePoll(probe, held, keyboard.capture.row.pressed, keyboard.capture.row.released, schedule.captureTarget());
  const target = schedule.captureTarget();
  if (s.session.paused || rollback.sendFailed || target === undefined) {
    sendBatch(s, rollback, keyboard);
    return;
  }
  if (target === keyboard.lastTarget) {
    if (trace.active) trace.window.sameTargetSkips++;
    // A stalled cursor must never strand the row needed to unblock it.
    queueKeyboardRows(s, rollback, keyboard, true);
    return;
  }
  const result = schedule.captureLocal(epoch, keyboard.capture.row);
  probeCapture(probe, result);
  if (result === Capture.alreadyCaptured) {
    keyboard.lastTarget = target;
    return;
  }
  if (result !== Capture.captured) {
    failControls(s);
    return;
  }
  recordPadRow(s, epoch, target, keyboard.capture.row);
  if (probeRecording(probe)) {
    const row = keyboard.capture.row;
    const slot = localSlot();
    probeInput(probe, "capture", epoch, slot, target, row.held, row.pressed, row.released, schedule.speculativeFrame());
    if (rollback.predictionHeld && row.pressed !== 0) probeIntegrity(probe, `held ${epoch} ${slot} ${target}`);
  }
  if (trace.active) trace.window.localCaptures++;
  commitEdges(keyboard.capture);
  keyboard.lastTarget = target;
  const stamp = at(keyboard.stamps, floorMod(target, PENDING_CAPACITY));
  stamp.traced = trace.active;
  if (trace.active) {
    stamp.callback = trace.ticks;
    stamp.seconds = traceSeconds(trace);
  }
  queueKeyboardRows(s, rollback, keyboard, false);
}

function queueKeyboardRows(s: ShellState, rollback: Rollback, keyboard: KeyboardRollback, flush: boolean): void {
  const { schedule, epoch } = rollback;
  const added = queueLocalRows(keyboard.outgoing, schedule, epoch, keyboard.nextSend);
  if (added === false) {
    rollback.sendFailed = true;
    failControls(s);
    return;
  }
  if (flush || !keyboard.pairedSends || keyboard.outgoing.size() === 2) sendBatch(s, rollback, keyboard);
}

/** Runs the next confirmed frame on every human's accepted row. */
function stepConfirmed(s: ShellState, rollback: Rollback): boolean {
  const { schedule, epoch, accepted } = rollback;
  const frame = schedule.nextConfirmedFrame();
  if (!schedule.readConfirmed(epoch, accepted)) return false;
  if (!captureNetworkFrame(s.frameInput, frame, accepted, s.world, s.game.humanMask)) return false;
  applyFrame(s);
  if (probeRecording(s.probe)) {
    for (const slot of PARTICIPANT_SLOTS) {
      if (!humanActive(s.game, slot)) continue;
      const row = accepted[slot];
      probeInput(s.probe, "confirmed", epoch, slot, frame, row.held, row.pressed, row.released, schedule.speculativeFrame());
      if (row.pressed !== 0) probeIntegrity(s.probe, `legal ${epoch} ${slot} ${frame} ${row.pressed} ${row.pressed & observedFrameLegalActions[slot]} ${row.pressed & observedFrameStartedActions[slot]}`);
    }
  }
  return s.runtime.simulationFrame === frame && schedule.completeConfirmed(epoch, frame);
}

/** The response probe's view of each speculative frame, before the schedule completes it. */
function observeSpeculativeFrame(frame: number, local: Readonly<InputRow>): void {
  const s = shell();
  holdPresentedCapture(s);
  const rollback = s.rollback;
  const slot = localSlot();
  if (rollback === undefined || !isParticipantSlot(slot) || !probeRecording(s.probe)) return;
  const { epoch, schedule } = rollback;
  probeInput(s.probe, "predict", epoch, slot, frame, local.held, local.pressed, local.released, schedule.speculativeFrame());
  if (local.pressed !== 0) probeIntegrity(s.probe, `action ${epoch} ${slot} ${frame} ${local.pressed} ${local.pressed & observedFrameLegalActions[slot]} ${local.pressed & observedFrameStartedActions[slot]}`);
}

/** Counts the callbacks the match has waited for the players in `waiting`, and names them once it has waited `notice`. */
function noteWaiting(rollback: Rollback, waiting: number, notice: number): void {
  rollback.stalled = waiting === 0 ? 0 : rollback.stalled + 1;
  rollback.waitingFor = rollback.stalled >= notice ? waiting : 0;
}

/** One game callback of a rollback match: local input, confirmed catch-up, reconciliation and prediction. */
export function rollbackTick(s: ShellState, rollback: Rollback): void {
  const { schedule, epoch, keyboard, journal, speculative } = rollback;
  const { trace, probe } = s;
  if (s.game.phase !== Phase.match) {
    if (keyboard !== undefined) sendBatch(s, rollback, keyboard);
    noteWaiting(rollback, 0, 0);
    return;
  }
  if (journal !== undefined) {
    journal.outgoing.tick();
    if (!s.session.paused) serviceJournalInput(s, rollback, journal);
    flushTransport(s, rollback, journal);
  } else if (keyboard !== undefined) captureKeyboard(s, rollback, keyboard);
  if (s.session.paused) {
    noteWaiting(rollback, 0, 0);
    return;
  }
  if (journal?.editbox !== undefined && journal.lifecycle?.started() !== true) {
    noteWaiting(rollback, s.game.humanMask & ~journal.readyMask, START_NOTICE_CALLBACKS);
    return;
  }
  const stopAt = journal === undefined ? undefined : stopFrame(journal.barrier);
  const slot = localSlot();
  const reconciled = rollback.playback.reconcile(schedule, epoch, slot, speculative);
  if (reconciled === "rejected") {
    setStatus(s, "The match could not catch up. Restart the match.", LASTING);
    return;
  }
  const correction = reconciled === "unchanged" ? 0 : reconciled.replayedFrom;
  if (reconciled !== "unchanged") {
    const depth = speculative.runtime.simulationFrame - reconciled.replayedFrom + 1;
    if (trace.active) {
      trace.window.corrections++;
      trace.window.replayedFrames += depth;
      trace.window.maxReplayDepth = Math.max(trace.window.maxReplayDepth, depth);
    }
    probeIntegrity(probe, `rollback ${epoch} ${depth}`);
  }
  const repaired = rollback.playback.repair(epoch, speculative, REPAIR_FRAMES);
  if (repaired === "rejected") {
    setStatus(s, "The match could not catch up. Restart the match.", LASTING);
    return;
  }
  // Confirmation can reuse history only after accepted corrections have repaired it.
  let steps = 0;
  const confirmSteps = confirmedBudget(schedule.confirmedFrame() - schedule.nextConfirmedFrame() + 1);
  while (s.game.phase === Phase.match && schedule.mayAdvanceConfirmed() && steps < confirmSteps && (stopAt === undefined || schedule.nextConfirmedFrame() < stopAt)) {
    if (!stepConfirmed(s, rollback)) {
      finishConfirmedFrames(s);
      setStatus(s, "The match could not advance. Restart the match.", LASTING);
      return;
    }
    steps++;
    if (trace.active) trace.window.confirmedSteps++;
  }
  finishConfirmedFrames(s);
  if (s.game.phase !== Phase.match && keyboard !== undefined) sendBatch(s, rollback, keyboard);
  if (trace.active && steps === 0 && s.game.phase === Phase.match) trace.window.waitTicks++;
  // Replay stays numerical: persistent visuals show only the completed state;
  // event effects, audio, results and HUD stay confirmed. A deep correction
  // replays over several callbacks while local rows keep running.
  if (s.game.phase === Phase.match) {
    const before = schedule.speculativeFrame();
    const advanced = rollback.playback.catchUp(schedule, epoch, slot, speculative, speculativeBudget(journal !== undefined), stopAt, observeSpeculativeFrame);
    const after = schedule.speculativeFrame();
    const halted = schedule.windowHalted(slot);
    const blocked = halted && after === before;
    if (halted) rollback.predictionHeld = true;
    // The keyboard always queues D future rows. Only uncommitted presses can
    // still belong to its stall; journal rows must drain their own backlog.
    else if (keyboard !== undefined ? keyboard.capture.row.pressed === 0 : !schedule.hasLocalRow(slot)) rollback.predictionHeld = false;
    if (trace.active) {
      trace.window.speculativeSteps += after - before;
      if (!advanced) trace.window.speculativeFailures++;
      else if (blocked) trace.window.windowBlocks++;
    }
    if (blocked) probeIntegrity(probe, `stall ${epoch} ${after} ${schedule.remoteThrough(slot)}`);
    // A pause round holds every helper's rows on purpose.
    const holding = stopAt !== undefined || journal?.barrier.request !== undefined;
    noteWaiting(rollback, after > before || holding ? 0 : schedule.awaitedSlots(), STALL_NOTICE_CALLBACKS);
  } else noteWaiting(rollback, 0, 0);
  probeAdvance(probe, s.runtime.simulationFrame, schedule.speculativeFrame(), correction);
}

/** One sender's packet from a synchronized message. */
function receivePacket(s: ShellState, rollback: Rollback, sender: number, packet: InputPacket): void {
  const { trace, probe } = s;
  const { schedule } = rollback;
  const receivedCallback = trace.ticks;
  const receivedSeconds = trace.active ? traceSeconds(trace) : 0.0;
  const receipt = schedule.acceptSynchronized(sender, packet);
  const local = sender === localSlot();
  for (let index = 0; index < packet.rows.length; index++) {
    const row = packet.rows[index];
    if (row === undefined) continue;
    const frame = packet.firstFrame + index;
    if (receipt === "accepted") {
      probeInput(probe, "receive", packet.epoch, sender, frame, row.held, row.pressed, row.released, schedule.speculativeFrame());
      if (local) probeTransportReceive(probe, packet.epoch, frame);
    }
    if (trace.active && local) recordEcho(trace, packet.epoch, frame, receivedCallback, receivedSeconds);
  }
  if (receipt !== "accepted" && receipt !== "wrongEpoch") setStatus(s, "The players could not stay connected. Restart the match.", LASTING);
  if (!trace.active) return;
  if (receipt === "accepted" && isParticipantSlot(sender)) {
    trace.window.accepted[sender]++;
    trace.window.receivedRows[sender] += packet.rows.length;
  } else trace.window.rejected++;
}

/** A synchronized input message: helper lifecycle, or a run of one sender's consecutive rows. */
export function receiveInput(s: ShellState): void {
  if (s.pad !== undefined) s.pad.syncEvents++;
  const rollback = s.rollback;
  s.trace.rawSyncEvents++;
  if (rollback === undefined) return;
  const sender = GetPlayerId(GetTriggerPlayer());
  const wire = BlzGetTriggerSyncData();
  if (rollback.journal !== undefined && receiveLifecycle(s, rollback, rollback.journal, sender, wire)) return;
  if (!rollback.active || !humanActive(s.game, sender)) return;
  const packets = decodeTransport(wire);
  if (packets === undefined) {
    setStatus(s, "The players could not stay connected. Restart the match.", LASTING);
    if (s.trace.active) s.trace.window.rejected++;
    return;
  }
  for (const packet of packets) receivePacket(s, rollback, sender, packet);
}
