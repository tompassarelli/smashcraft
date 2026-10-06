// Journal input: the companion helper records each local player's controller
// rows for their original frames, the map admits them and relays them to
// every client. Ingress is edit box text, keyboard carrier keys or published
// files. A player whose edit box helper never reports ready plays the match on
// the keyboard, and the map journals their keys the same way. This module
// admits and sends rows and follows the helper's lifecycle, menus and end of
// match; journalPause.ts runs the pause rounds and chat.
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
import { probeClockMs, probeFileRead, probeInput, probePoll, probeSendFinished, probeTransportSend } from "./responseProbe";
import { type Journal, type Rollback, type ShellState, localSlot, playsOnKeyboard } from "./state";
import { recordSend, traceInput } from "./trace";
import { LASTING, setStatus } from "./view";

/** Synchronized prefix of input rows and helper readiness. */
export const INPUT_PREFIX = "SC_GP";

/**
 * Callbacks after a match starts before a human whose helper has not reported
 * ready plays it on the keyboard. In the 0.0.47 capture the helper took the
 * match 0.13 s after its Start press and every client started at 0.43 s.
 */
const HELPER_READY_CALLBACKS = 120;

/** How long a player who plays on the keyboard sees why, in seconds. */
const KEYBOARD_NOTICE_SECONDS = 4.0;

/** The rollback session while a journal epoch runs. */
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

/** Stops this client's journal for the epoch; the match cannot continue. */
export function failJournal(s: ShellState, rollback: Rollback, journal: Journal, reason: string): void {
  if (journal.failed) return;
  journal.failed = true;
  setStatus(s, "Controller input stopped. Restart the match.", LASTING);
  const sequence = journal.source?.sequenceNumber() ?? 0;
  const frame = journal.source?.expectedFrame() ?? 0;
  traceInput(s.trace, `journal stopped ${reason} sequence ${sequence} frame ${frame}`);
  if (s.build.responseProbe) writeJournalFile(failureFile(journalIdentity(s, rollback.epoch), reason, sequence, frame));
}

/** The edit box's next payload, failing the journal if its text broke. */
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

/** Marks the edit box payload applied; false after failing the journal. */
export function consumeEditbox(s: ShellState, rollback: Rollback, journal: Journal): boolean {
  const { editbox } = journal;
  if (editbox === undefined || editbox.consumed()) return true;
  failJournal(s, rollback, journal, editbox.failure() ?? "controller text changed during admission");
  return false;
}

/** The keyboard mailbox's complete message, when it starts with prefix. */
export function mailboxMessage(journal: Journal, prefix: string): string | undefined {
  const { mailbox } = journal;
  if (mailbox === undefined) return undefined;
  pollMailbox(mailbox);
  const message = mailbox.message();
  return message?.startsWith(prefix) === true ? message : undefined;
}

/** Sends the admitted rows not yet sent, at most one message per batch of callbacks, pauses included. */
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

/**
 * A human whose helper never reported ready plays the match on the keyboard:
 * every client learns it from "K4", and the edit box lets go of the keyboard.
 */
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

/** Before the match starts, relays the helper's readiness; an explicit-clock producer is ready with its first row. */
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

/** The next journal text for the local player, or undefined to wait. */
function nextPacketText(s: ShellState, rollback: Rollback, journal: Journal): string | undefined {
  const source = journal.source;
  if (source === undefined) return undefined;
  switch (journal.ingress) {
    case "editbox": {
      const wire = peekEditbox(s, rollback, journal);
      // Pause acknowledgments and requests, and moment requests, are serviced in their own order.
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

/**
 * Polls the local keyboard once per running callback and advances its clock,
 * which a pause holds: from a prepared pause the rows stop before keyStop.
 * The clock counts callbacks, so time the game lost, as in a lag spike, is
 * lost from it too while another player's helper journals on: the clock
 * follows the frames other players have already sent.
 */
function sampleKeyboard(s: ShellState, rollback: Rollback, journal: Journal): void {
  if (journal.keyStop === undefined) journal.keyClock = rollback.schedule.othersThrough(localSlot(), journal.keyClock + 1);
  // Typing into Warcraft's chat entry is not play.
  const chatting = journal.editbox?.chatOpen() === true;
  sampleKeys(journal.keys, chatting ? 0 : pollLocalKeys(s));
}

/** The local keyboard's row for the next frame, once its clock has reached that frame. */
function keyboardPacket(rollback: Rollback, journal: Journal, source: JournalInputSource): InputPacket | undefined {
  const frame = source.expectedFrame();
  if (frame > (journal.keyStop === undefined ? journal.keyClock : journal.keyStop - 1)) return undefined;
  const packet = journal.keyPacket;
  packet.epoch = rollback.epoch;
  packet.firstFrame = frame;
  return packet;
}

/** Admits the local helper's or keyboard's next rows at their original frames and queues them for every client. */
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
  // Connected controllers keep a journal even when their fighter is a computer
  // or empty: frame input selects that behavior, and every sender must advance.
  if (source === undefined || !isParticipantSlot(slot) || !humanActive(s.game, slot)) return;
  const { schedule } = rollback;
  const keyboard = playsOnKeyboard(journal, slot);
  if (keyboard) sampleKeyboard(s, rollback, journal);
  // Rows behind their clock, a helper's or a keyboard's after a stall, catch up within the callback budget;
  // a helper's record that joins several packets may take more than one callback.
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
      const captured = schedule.captureLocalAt(rollback.epoch, frame, row);
      if (captured === Capture.tooFarAhead || captured === Capture.pendingFull) return;
      if (captured !== Capture.captured && captured !== Capture.alreadyCaptured) {
        failJournal(s, rollback, journal, "original frame could not be admitted");
        return;
      }
      if (captured !== Capture.captured) continue;
      probePoll(s.probe, row.held, row.pressed, row.released, frame);
      probeInput(s.probe, "capture", rollback.epoch, slot, frame, row.held, row.pressed, row.released, schedule.speculativeFrame());
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
      if (!consumeEditbox(s, rollback, journal)) return;
    } else if (journal.mailbox !== undefined) releaseMessage(journal.mailbox);
  }
}

/**
 * A helper reported ready ("J4"), a player without one will play on the
 * keyboard ("K4"), or a helper stopped ("E4"), for this epoch. Returns false
 * for any other message.
 */
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
  // A helper that reports ready late waits for the next match; the keyboard plays this one.
  if (journal.ingress === "editbox" && !playsOnKeyboard(journal, localSlot())) writeJournalFile(startFile(identity, 1 + rollback.delay));
  writeJournalFile(transportReadyFile(identity, journal.readyMask));
  return true;
}

const MENU_PHASES: Partial<Readonly<Record<Phase, MenuPhase>>> = {
  [Phase.characterMenu]: "CHARACTER",
  [Phase.stageMenu]: "STAGE",
  [Phase.result]: "RESULT",
};

/** Tells the helper which menu its controller may drive; refreshed every 15 callbacks, BLOCKED once. */
export function publishMenu(s: ShellState): void {
  const journal = s.rollback?.journal;
  if (journal?.editbox === undefined || s.rollback === undefined) return;
  const slot = localSlot();
  const menu = MENU_PHASES[s.game.phase];
  const live = s.rollback.active && journal.lifecycle?.quiescent() !== true;
  const phase: MenuPhase = isParticipantSlot(slot) && controlsAvailable(s, slot) && menu !== undefined && !live ? menu : "BLOCKED";
  journal.menuTicks++;
  if (phase === journal.menuPhase && (phase === "BLOCKED" || journal.menuTicks < 15)) return;
  journal.menuPhase = phase;
  journal.menuTicks = 0;
  const { game } = s;
  writeJournalFile(menuFile(journalIdentity(s, s.rollback.epoch), phase, {
    connected: game.humanMask, humanFighters: game.humanFighterMask, computers: game.computerMask, fighters: fighterMask(game),
  }));
}

/** After a match ends: tell the helper, drain its last rows, and relay when it has stopped. */
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
  // Ordered rows of the ended epoch are terminal data now; consume them without combat.
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
