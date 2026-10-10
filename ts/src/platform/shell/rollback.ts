




import { clearAttackBuffer } from "../../game/input/attackBuffer";
import { type InputRow, copyInput, emptyInput } from "../../game/input/inputRow";
import { commitEdges, resetKeys } from "../../game/input/keyboardCapture";
import { PARTICIPANT_SLOTS, isParticipantSlot } from "../../game/input/participants";
import { type InputPacket, TransportDecoder, encodePacket, packetSizeInRange } from "../../game/input/wire";
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
import { captureReplaySnapshot, restoreReplaySnapshot } from "../../game/replay/snapshot";
import { pacedStop, resetPauseBarrier, settlePace, stopFrame } from "../../game/shell/pauseBarrier";
import { confirmedBudget, repairBudget, speculativeBudget } from "../../game/shell/playback";
import { REPAIR_WHOLE_COST } from "../../game/replay/history";
import { queueLocalRows } from "../../game/shell/localInput";
import { applyFrame } from "./frame";
import { ownConfirmedState } from "./confirmedState";
import { pollLocalKeys } from "./inputs";
import { INPUT_PREFIX, failJournal, flushTransport, receiveLifecycle, serviceJournalInput } from "./journal";
import { epochChecksumDue, probeAdvance, probeCapture, probeClockMs, probeInput, probeIntegrity, probePoll, probeRecording, probeSendFinished, probeTransportReceive, probeTransportSend } from "./responseProbe";
import { confirmedChecksum } from "./diagnostics";
import { type KeyboardRollback, type Rollback, type ShellState, localSlot, shell } from "./state";
import { recordBatchWait, recordEcho, recordSend, resetEchoRing, traceSeconds } from "./trace";
import { LASTING, resumePresentationHeld, setStatus } from "./view";
import { holdPresentedCapture } from "./visualCapture";
import { samplePad } from "../../game/input/padCapture";
import { pollPad, recordPadRow } from "./analogPad";
import { beginNetEpoch, matchDelay, noteDepth, noteEcho, noteSent } from "./netDelay";


const STALL_NOTICE_CALLBACKS = 20;

const START_NOTICE_CALLBACKS = 45;
const NEUTRAL: Readonly<InputRow> = emptyInput();
// Received packets are copied into the ledger before the next receive reuses these.
const TRANSPORT = new TransportDecoder();

const failControls = (s: ShellState) => setStatus(s, "Controls stopped responding. Restart the match.", LASTING);


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
  const devDelay = s.build.devConsole && s.dev.delay !== rollback.mode.delay;
  rollback.delay = rollback.keyboard === undefined || devDelay ? s.dev.delay : matchDelay(rollback.net, s.game, s.participants.map(participant => participant.bindings.delay));
  beginNetEpoch(rollback.net);
  rollback.window = s.dev.rollback;
  rollback.batch = s.dev.batch;
  if (!schedule.beginEpoch(rollback.epoch, rollback.delay, rollback.window, s.game.humanMask)) return false;
  if (!rollback.playback.beginEpoch(rollback.epoch, schedule.rollbackFrames())) return false;
  resetEchoRing(s.trace);
  rollback.sendFailed = false;
  rollback.stalled = 0;
  rollback.waitingFor = 0;
  rollback.predictionHeld = false;
  rollback.knownBefore = 0;
  rollback.repairedFrames = 0;
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
    journal.setAside.length = 0;
    journal.source = JournalInputSource.open(s.build.id, rollback.epoch, slot, rollback.delay);
    if (journal.source === undefined) failJournal(s, rollback, journal, "epoch could not be initialized");
    if (journal.editbox !== undefined) {

      for (const other of PARTICIPANT_SLOTS) startKeyUp(s.session, other);
      journal.editbox.beginEpoch(s.build.id, rollback.epoch, slot);
    }
    journal.mailbox = journal.ingress === "keyboard" ? new KeyboardMailbox(s.build.id, rollback.epoch, slot) : undefined;
  }
  resetMatchFrameInput(s.frameInput);
  return true;
}


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
  for (let row = 0; row < count; row++) {
    probeTransportSend(s.probe, rollback.epoch, packet.firstFrame + row);
    noteSent(rollback.net, packet.firstFrame + row);
  }
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


function stepConfirmed(s: ShellState, rollback: Rollback): boolean {
  const { schedule, epoch, accepted } = rollback;
  const frame = schedule.nextConfirmedFrame();
  if (!schedule.readConfirmed(epoch, accepted)) return false;
  if (!captureNetworkFrame(s.frameInput, frame, accepted, s.world, s.game.humanMask)) return false;
  applyFrame(s);
  if (s.build.epochProbe === true && epochChecksumDue(s.probe, frame)) probeIntegrity(s.probe, `checksum ${epoch} ${frame} ${confirmedChecksum(s)} ${s.game.phase}`);
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


function noteWaiting(rollback: Rollback, waiting: number, notice: number): void {
  rollback.stalled = waiting === 0 ? 0 : rollback.stalled + 1;
  rollback.waitingFor = rollback.stalled >= notice ? waiting : 0;
}


export function rollbackTick(s: ShellState, rollback: Rollback): void {
  const { schedule, epoch, keyboard, journal, speculative } = rollback;
  const { trace, probe } = s;
  const known = rollback.knownBefore;
  rollback.knownBefore = schedule.knownThrough();
  rollback.repairedFrames = 0;
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
    noteDepth(rollback.net, depth);
    if (trace.active) {
      trace.window.corrections++;
      trace.window.replayedFrames += depth;
      trace.window.maxReplayDepth = Math.max(trace.window.maxReplayDepth, depth);
    }
    probeIntegrity(probe, `rollback ${epoch} ${depth}`);
  }
  const confirmable = Math.min(schedule.confirmedFrame(), known);
  const confirmSteps = confirmedBudget(confirmable - schedule.nextConfirmedFrame() + 1);



  const lastConfirmed = Math.min(confirmable, schedule.nextConfirmedFrame() + confirmSteps - 1, stopAt === undefined ? Number.POSITIVE_INFINITY : stopAt - 1);
  const pending = rollback.playback.pendingRepair(epoch);
  const behind = pending === undefined ? 0 : lastConfirmed + 2 - pending;
  const repair = repairBudget(speculativeBudget(journal !== undefined), pending === undefined ? 0 : schedule.speculativeFrame() - pending);
  const repaired = rollback.playback.repair(epoch, speculative, Math.max(repair.frames, behind), Math.max(repair.cost, behind * REPAIR_WHOLE_COST));
  if (repaired === "rejected") {
    setStatus(s, "The match could not catch up. Restart the match.", LASTING);
    return;
  }
  rollback.repairedFrames = repaired;
  let steps = 0;
  while (s.game.phase === Phase.match && schedule.mayAdvanceConfirmed() && schedule.nextConfirmedFrame() <= known && steps < confirmSteps && (stopAt === undefined || schedule.nextConfirmedFrame() < stopAt)) {
    if (!stepConfirmed(s, rollback)) {
      ownConfirmedState(s);
      setStatus(s, "The match could not advance. Restart the match.", LASTING);
      return;
    }
    steps++;
    if (trace.active) trace.window.confirmedSteps++;
  }
  if (s.game.phase !== Phase.match && keyboard !== undefined) sendBatch(s, rollback, keyboard);
  if (trace.active && steps === 0 && s.game.phase === Phase.match) trace.window.waitTicks++;



  if (s.game.phase === Phase.match) {
    const before = schedule.speculativeFrame();

    const paced = journal === undefined ? undefined : resumePresentationHeld(s) ? journal.barrier.paced : pacedStop(journal.barrier);
    const speculativeStop = stopAt === undefined ? paced : paced === undefined ? stopAt : Math.min(stopAt, paced);
    const advanced = rollback.playback.catchUp(schedule, epoch, slot, speculative, speculativeBudget(journal !== undefined), speculativeStop, observeSpeculativeFrame);
    const after = schedule.speculativeFrame();
    if (journal !== undefined) settlePace(journal.barrier, after);
    const halted = schedule.windowHalted(slot);
    const blocked = halted && after === before;
    if (halted) rollback.predictionHeld = true;


    else if (keyboard !== undefined ? keyboard.capture.row.pressed === 0 : !schedule.hasLocalRow(slot)) rollback.predictionHeld = false;
    if (trace.active) {
      trace.window.speculativeSteps += after - before;
      if (!advanced) trace.window.speculativeFailures++;
      else if (blocked) trace.window.windowBlocks++;
    }
    if (blocked) probeIntegrity(probe, `stall ${epoch} ${after} ${schedule.remoteThrough(slot)}`);

    const holding = stopAt !== undefined || journal?.barrier.request !== undefined;
    noteWaiting(rollback, after > before || holding ? 0 : schedule.awaitedSlots(), STALL_NOTICE_CALLBACKS);
  } else noteWaiting(rollback, 0, 0);
  probeAdvance(probe, s.runtime.simulationFrame, schedule.speculativeFrame(), correction);
}


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
    if (local && receipt === "accepted" && packet.epoch === rollback.epoch) noteEcho(rollback.net, frame);
    if (trace.active && local) recordEcho(trace, packet.epoch, frame, receivedCallback, receivedSeconds);
  }
  if (receipt !== "accepted" && receipt !== "wrongEpoch") setStatus(s, "The players could not stay connected. Restart the match.", LASTING);
  if (!trace.active) return;
  if (receipt === "accepted" && isParticipantSlot(sender)) {
    trace.window.accepted[sender]++;
    trace.window.receivedRows[sender] += packet.rows.length;
  } else trace.window.rejected++;
}


export function receiveInput(s: ShellState): void {
  if (s.pad !== undefined) s.pad.syncEvents++;
  const rollback = s.rollback;
  s.trace.rawSyncEvents++;
  if (rollback === undefined) return;
  const sender = GetPlayerId(GetTriggerPlayer());
  const wire = BlzGetTriggerSyncData();
  if (rollback.journal !== undefined && receiveLifecycle(s, rollback, rollback.journal, sender, wire)) return;
  if (!rollback.active || !humanActive(s.game, sender)) return;
  const packets = TRANSPORT.decode(wire);
  if (packets < 0) {
    setStatus(s, "The players could not stay connected. Restart the match.", LASTING);
    if (s.trace.active) s.trace.window.rejected++;
    return;
  }
  for (let index = 0; index < packets; index++) receivePacket(s, rollback, sender, TRANSPORT.at(index));
}
