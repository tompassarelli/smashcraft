






import { commitEdges, resetKeys, sampleKeys } from "../../game/input/keyboardCapture";
import { isParticipantSlot } from "../../game/input/participants";
import { INPUT_LAST_FRAME, type InputPacket } from "../../game/input/wire";
import { Phase, fighterMask, humanActive } from "../../game/match/rules";
import { Capture } from "../../game/netcode/capture";
import type { JournalInputSource, JournalRead } from "../../game/netcode/journal/source";
import { TEXT_WINDOW } from "../../game/netcode/journal/text";
import { readVocabularyPacket } from "../../game/netcode/journal/vocabulary";
import { isMomentRequest } from "../../game/replay/moment";
import { FUTURE_LIMIT } from "../../game/netcode/ledger";
import { type JournalIdentity, type MenuPhase, endFile, failureFile, menuFile, quiescentFile, startFile, transportReadyFile } from "../../game/shell/journalFiles";
import { KEYBOARD_FALLBACK_MESSAGE } from "../../game/shell/messages";
import { CATCH_UP_FRAMES } from "../../game/shell/playback";
import { readChunk, writeLines } from "wisp/src/platform/fileio";
import { pollMailbox, releaseMessage } from "../keyboardJournal";
import { startInputTrace } from "./diagnostics";
import { controlsAvailable, pollLocalKeys } from "./inputs";
import { views } from "./ui";
import { probeClockMs, probeFileRead, probeInput, probeIntegrity, probePoll, probeSendFinished, probeTransportSend } from "./responseProbe";
import { type Journal, type Rollback, type ShellState, localSlot, playsOnKeyboard } from "./state";
import { recordSend, traceInput } from "./trace";
import { LASTING, setStatus } from "./view";


export const INPUT_PREFIX = "SC_GP";






const HELPER_READY_CALLBACKS = 120;


const KEYBOARD_NOTICE_SECONDS = 4.0;


interface JournalEpoch {
  readonly rollback: Rollback;
  readonly journal: Journal;
}

export function journalEpoch(s: Readonly<ShellState>): JournalEpoch | undefined {
  const rollback = s.rollback;
  const journal = rollback?.journal;
  return rollback?.active === true && journal !== undefined ? { rollback, journal } : undefined;
}

export function journalIdentity(s: Readonly<ShellState>, epoch: number): JournalIdentity {
  return { build: s.build.id, epoch, slot: localSlot() };
}

export const writeJournalFile = (file: { readonly name: string; readonly lines: readonly string[] }) => writeLines(file.name, file.lines);


export function failJournal(s: ShellState, rollback: Rollback, journal: Journal, reason: string): void {
  if (journal.failed) return;
  journal.failed = true;
  setStatus(s, "Controller input stopped. Restart the match.", LASTING);
  const sequence = journal.source?.sequenceNumber() ?? 0;
  const frame = journal.source?.expectedFrame() ?? 0;
  traceInput(s.trace, `journal stopped ${reason} sequence ${sequence} frame ${frame}`);
  if (s.build.responseProbe) writeJournalFile(failureFile(journalIdentity(s, rollback.epoch), reason, sequence, frame));
}


export function peekEditbox(s: ShellState, rollback: Rollback, journal: Journal): string | undefined {
  const { editbox } = journal;
  if (editbox === undefined) return undefined;
  const wire = editbox.peek() ?? "";
  const failure = editbox.failure();
  if (failure !== undefined) {
    failJournal(s, rollback, journal, failure);
    return undefined;
  }
  return wire;
}







export function setAsideRows(s: ShellState, rollback: Rollback, journal: Journal): void {
  for (let index = 0; index < TEXT_WINDOW; index++) {
    const wire = peekEditbox(s, rollback, journal);
    if (wire === undefined || !(wire.startsWith("I4") || wire.startsWith("I5"))) return;
    journal.setAside.push(wire);
    if (!consumeEditbox(s, rollback, journal)) return;
  }
}


export function consumeEditbox(s: ShellState, rollback: Rollback, journal: Journal): boolean {
  const { editbox } = journal;
  if (editbox === undefined || editbox.consumed()) return true;
  failJournal(s, rollback, journal, editbox.failure() ?? "controller text changed during admission");
  return false;
}


export function mailboxMessage(journal: Journal, prefix: string): string | undefined {
  const { mailbox } = journal;
  if (mailbox === undefined) return undefined;
  pollMailbox(mailbox);
  const message = mailbox.message();
  return message?.startsWith(prefix) === true ? message : undefined;
}


export function flushTransport(s: ShellState, rollback: Rollback, journal: Journal): void {
  if (journal.failed) return;
  const message = journal.outgoing.ready(rollback.batch);
  if (message === undefined) return;
  const started = probeClockMs(s.probe);
  const sent = BlzSendSyncData(INPUT_PREFIX, message.wire);
  probeSendFinished(s.probe, started);
  if (!sent) {
    rollback.sendFailed = true;
    failJournal(s, rollback, journal, "synchronized input submission failed");
    return;
  }
  const { firstFrame, lastFrame } = message;
  for (let frame = firstFrame; frame <= lastFrame; frame++) probeTransportSend(s.probe, rollback.epoch, frame);
  if (s.trace.active) {
    const { window } = s.trace;
    window.localSends++;
    window.sentRows += lastFrame - firstFrame + 1;
    if (lastFrame === firstFrame) window.singletons++;
    for (let frame = firstFrame; frame <= lastFrame; frame++) recordSend(s.trace, rollback.epoch, frame);
    traceInput(s.trace, `journal sent frame ${firstFrame} count ${lastFrame - firstFrame + 1} bytes ${message.wire.length}`);
  }
  journal.outgoing.sent(message);
}





function startKeyboard(s: ShellState, rollback: Rollback, journal: Journal): void {
  if (!BlzSendSyncData(INPUT_PREFIX, `K4${rollback.epoch}`)) {
    failJournal(s, rollback, journal, "keyboard readiness could not be synchronized");
    return;
  }
  journal.startSent = true;
  journal.editbox?.endEpoch();
  resetKeys(journal.keys, pollLocalKeys(s));
  traceInput(s.trace, `journal helper not ready after ${journal.readyWait} callbacks; keyboard input`);
  setStatus(s, KEYBOARD_FALLBACK_MESSAGE, KEYBOARD_NOTICE_SECONDS);
}


function serviceReadiness(s: ShellState, rollback: Rollback, journal: Journal): void {
  if (journal.startSent) return;
  journal.readyWait++;
  const wire = peekEditbox(s, rollback, journal);
  if (wire === undefined) return;
  const ready = wire === `JR1${rollback.epoch}`;
  if (!(ready || wire.startsWith("I4"))) {
    if (journal.readyWait >= HELPER_READY_CALLBACKS) startKeyboard(s, rollback, journal);
    return;
  }
  if (!BlzSendSyncData(INPUT_PREFIX, `J4${rollback.epoch}`)) {
    failJournal(s, rollback, journal, "controller readiness could not be synchronized");
    return;
  }
  journal.startSent = true;
  if (ready) consumeEditbox(s, rollback, journal);
}


function nextPacketText(s: ShellState, rollback: Rollback, journal: Journal): string | undefined {
  const source = journal.source;
  if (source === undefined) return undefined;
  switch (journal.ingress) {
    case "editbox": {
      const held = journal.setAside[0];
      if (held !== undefined) return held;
      const wire = peekEditbox(s, rollback, journal);

      return wire === undefined || wire.startsWith("ACK1|") || wire.startsWith("JP1") || isMomentRequest(wire) ? undefined : wire;
    }
    case "keyboard":
      return mailboxMessage(journal, "I4");
    case "files": {
      const buffered = source.bufferedPacket();
      if (buffered !== undefined) return buffered;
      const started = probeClockMs(s.probe);
      const read = readVocabularyPacket(readChunk, source.packetBase());
      const wire = read.kind === "text" ? read.text : read.kind === "invalid" ? read.reason : "";
      probeFileRead(s.probe, started, wire.length);
      return wire;
    }
  }
}








function sampleKeyboard(s: ShellState, rollback: Rollback, journal: Journal): void {
  if (journal.keyStop === undefined) journal.keyClock = rollback.schedule.othersThrough(localSlot(), journal.keyClock + 1);

  const chatting = journal.editbox?.chatOpen() === true;
  sampleKeys(journal.keys, chatting ? 0 : pollLocalKeys(s));
}


function keyboardPacket(rollback: Rollback, journal: Journal, source: JournalInputSource): InputPacket | undefined {
  const frame = source.expectedFrame();
  if (frame > (journal.keyStop === undefined ? journal.keyClock : journal.keyStop - 1)) return undefined;
  const packet = journal.keyPacket;
  packet.epoch = rollback.epoch;
  packet.firstFrame = frame;
  return packet;
}


export function serviceJournalInput(s: ShellState, rollback: Rollback, journal: Journal): void {
  if (journal.failed) return;
  const { source } = journal;
  const editbox = journal.ingress === "editbox";
  if (editbox && journal.lifecycle?.started() !== true) {
    serviceReadiness(s, rollback, journal);
    return;
  }
  if (!editbox && s.build.responseProbe) {
    if (!journal.startSent) journal.startSent = BlzSendSyncData(INPUT_PREFIX, `J4${rollback.epoch}`);
    if (journal.readyMask !== s.game.humanMask) return;
  }
  const slot = localSlot();


  if (source === undefined || !isParticipantSlot(slot) || !humanActive(s.game, slot)) return;
  const { schedule } = rollback;
  const keyboard = playsOnKeyboard(journal, slot);
  if (keyboard) sampleKeyboard(s, rollback, journal);


  for (let admitted = 0; admitted < CATCH_UP_FRAMES; ) {
    const latest = Math.min(INPUT_LAST_FRAME, schedule.nextConfirmedFrame() - 1 + FUTURE_LIMIT);
    if (source.expectedFrame() > latest) return;
    let result: JournalRead;
    if (keyboard) {
      const packet = keyboardPacket(rollback, journal, source);
      if (packet === undefined) return;
      result = source.offer(packet, latest);
    } else {
      const wire = nextPacketText(s, rollback, journal);
      if (wire === undefined || wire === "") return;
      result = source.read(wire, latest);
      if (result.kind === "invalid") {
        failJournal(s, rollback, journal, `invalid or noncontiguous I4 row: ${wire}`);
        return;
      }
    }
    if (result.kind === "wait") return;
    if (result.kind === "invalid") {
      failJournal(s, rollback, journal, "keyboard row out of order");
      return;
    }
    const { packet } = result;
    const rows = Math.min(packet.rows.length, CATCH_UP_FRAMES - admitted);
    if (s.build.responseProbe && source.sequenceNumber() === 1 && !s.trace.active) startInputTrace(s);
    for (let index = 0; index < rows; index++) {
      const row = packet.rows[index];
      if (row === undefined) return;
      const frame = packet.firstFrame + index;

      if (frame - schedule.remoteThrough(slot) > schedule.rollbackFrames()) rollback.predictionHeld = true;
      const captured = schedule.captureLocalAt(rollback.epoch, frame, row);
      if (captured === Capture.tooFarAhead || captured === Capture.pendingFull) return;
      if (captured !== Capture.captured && captured !== Capture.alreadyCaptured) {
        failJournal(s, rollback, journal, "original frame could not be admitted");
        return;
      }
      if (captured !== Capture.captured) continue;
      probePoll(s.probe, row.held, row.pressed, row.released, frame);
      probeInput(s.probe, "capture", rollback.epoch, slot, frame, row.held, row.pressed, row.released, schedule.speculativeFrame());
      if (rollback.predictionHeld && row.pressed !== 0) probeIntegrity(s.probe, `held ${rollback.epoch} ${slot} ${frame}`);
      if (s.trace.active) s.trace.window.localCaptures++;
    }
    for (let index = 0; index < rows; index++) {
      const row = packet.rows[index];
      if (row === undefined || !journal.outgoing.admit(packet.firstFrame + index, row)) {
        failJournal(s, rollback, journal, "controller input could not be queued");
        return;
      }
    }
    if (!source.sent(rows)) {
      rollback.sendFailed = true;
      failJournal(s, rollback, journal, "journal cursor could not advance after send");
      return;
    }
    admitted += rows;
    if (rows < packet.rows.length) return;
    if (keyboard) commitEdges(journal.keys);
    else if (editbox) {
      if (journal.setAside.length > 0) journal.setAside.shift();
      else if (!consumeEditbox(s, rollback, journal)) return;
    } else if (journal.mailbox !== undefined) releaseMessage(journal.mailbox);
  }
}






export function receiveLifecycle(s: ShellState, rollback: Rollback, journal: Journal, sender: number, wire: string): boolean {
  if (wire === `E4${rollback.epoch}`) {
    journal.lifecycle?.stopped(rollback.epoch, sender);
    return true;
  }
  const keyboard = wire === `K4${rollback.epoch}`;
  if (!keyboard && wire !== `J4${rollback.epoch}`) return false;
  const bit = 1 << sender;
  if (!humanActive(s.game, sender) || (journal.readyMask & bit) !== 0) return true;
  journal.readyMask |= bit;
  if (keyboard) journal.keyboardMask |= bit;
  journal.lifecycle?.ready(rollback.epoch, sender);
  traceInput(s.trace, `journal transport start received sender ${sender}`);
  if (journal.readyMask !== s.game.humanMask) return true;
  const identity = journalIdentity(s, rollback.epoch);

  if (journal.ingress === "editbox" && !playsOnKeyboard(journal, localSlot())) writeJournalFile(startFile(identity, 1 + rollback.delay));
  writeJournalFile(transportReadyFile(identity, journal.readyMask));
  return true;
}

const MENU_PHASES: Partial<Readonly<Record<Phase, MenuPhase>>> = {
  [Phase.characterMenu]: "CHARACTER",
  [Phase.stageMenu]: "STAGE",
  [Phase.result]: "RESULT",
};


export function publishMenu(s: ShellState): void {
  const journal = s.rollback?.journal;
  if (journal?.editbox === undefined && s.build.input.kind !== "keyboard" && s.build.input.kind !== "callback") return;
  const slot = localSlot();
  const menu = isParticipantSlot(slot) && views(s).selections[slot].cpuSettingsOpen() ? "CPU" : MENU_PHASES[s.game.phase];
  const live = journal !== undefined && s.rollback?.active === true && journal.lifecycle?.quiescent() !== true;
  const phase: MenuPhase = isParticipantSlot(slot) && controlsAvailable(s, slot) && menu !== undefined && !live ? menu : "BLOCKED";
  const previous = s.menuPublication;
  if (previous !== undefined) previous.ticks++;
  if (phase === previous?.phase && (phase === "BLOCKED" || previous.ticks < 15)) return;
  s.menuPublication = { phase, ticks: 0 };
  const { game } = s;
  writeJournalFile(menuFile(journalIdentity(s, s.rollback?.epoch ?? 0), phase, {
    connected: game.humanMask, humanFighters: game.humanFighterMask, computers: game.computerMask, fighters: fighterMask(game),
  }));
}


export function serviceJournalEnd(s: ShellState, rollback: Rollback, journal: Journal): void {
  const { editbox } = journal;
  if (editbox === undefined) return;
  const identity = journalIdentity(s, rollback.epoch);
  if (!journal.endSent) {
    writeJournalFile(endFile(identity, journal.source?.expectedFrame() ?? 0, s.game.winner));
    journal.endSent = true;
    journal.barrier.request = undefined;
  }
  if (journal.quiescent) return;
  if (playsOnKeyboard(journal, localSlot()) || (journal.endReceived && readChunk(quiescentFile(identity)) === "Q")) {
    if (!BlzSendSyncData(INPUT_PREFIX, `E4${rollback.epoch}`)) {
      failJournal(s, rollback, journal, "controller stop could not be synchronized");
      return;
    }
    journal.quiescent = true;
    editbox.endEpoch();
    return;
  }

  for (let index = 0; index < TEXT_WINDOW; index++) {
    const wire = editbox.peek() ?? "";
    if (wire === "") return;
    const ended = wire === `JE1${rollback.epoch}`;
    if (!consumeEditbox(s, rollback, journal)) return;
    if (ended) {
      journal.endReceived = true;
      editbox.flushReceipt();
      return;
    }
  }
}
