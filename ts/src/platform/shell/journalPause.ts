// Journal pauses and chat: a pause, a resume and a chat request are rounds every
// human's helper acknowledges, or the map for a player on the keyboard, and the
// match pauses or resumes exactly when the confirmed cursor reaches the frame
// they agreed on. Rows, lifecycle and menus are in journal.ts.
import { isParticipantSlot } from "../../game/input/participants";
import { Phase, humanActive } from "../../game/match/rules";
import { padDecimal, parseDecimal } from "../../game/netcode/journal/decimal";
import type { JournalInputSource } from "../../game/netcode/journal/source";
import { readVocabularyControlAck } from "../../game/netcode/journal/vocabulary";
import { controlFile } from "../../game/shell/journalFiles";
import { pausedMessage } from "../../game/shell/messages";
import { CONTROL_ACK_PREFIX, agreedFrame, encodeControlAck, paceResume, pausing, preparedFrame, receiveControlAck, requestRound } from "../../game/shell/pauseBarrier";
import { readChunk } from "wisp/src/platform/fileio";
import { releaseMessage } from "../keyboardJournal";
import { consumeEditbox, failJournal, journalEpoch, journalIdentity, mailboxMessage, peekEditbox, setAsideRows, writeJournalFile } from "./journal";
import { type Journal, type Rollback, type ShellState, localSlot, playsOnKeyboard } from "./state";
import { traceInput } from "./trace";
import { LASTING, pauseMatchPresentation, setStatus, startControl } from "./view";

/** Synchronized prefixes: edit box pause requests, chat closes. */
export const PAUSE_REQUEST_PREFIX = "SC_JP";
export const CHAT_CLOSED_PREFIX = "SC_JH";

export function chatBusy(journal: Readonly<Journal>): boolean {
  return journal.chatRequested.some(requested => requested);
}

/**
 * Asks every helper to pause at `startFrame`, the synchronized frame of a
 * controller's Start, or without one at a frame they choose; a resume
 * restarts every helper at the paused frame.
 */
export function requestPause(s: ShellState, rollback: Rollback, journal: Journal, wantPaused: boolean, startFrame?: number): void {
  const { source } = journal;
  if (source === undefined || journal.barrier.request !== undefined || (!wantPaused && chatBusy(journal))) return;
  // Paused, the confirmed cursor waits at the paused frame on every client.
  const target = wantPaused ? startFrame : rollback.schedule.nextConfirmedFrame();
  writeJournalFile(controlFile(journalIdentity(s, rollback.epoch), source.controlSequenceNumber(), wantPaused ? "PAUSE" : "RESUME", target ?? source.expectedFrame()));
  requestRound(journal.barrier, wantPaused ? "PREPARE" : "RESUME", target);
  if (startFrame !== undefined && !rollback.playback.rewind(rollback.schedule, rollback.epoch, startFrame, rollback.speculative)) {
    failJournal(s, rollback, journal, "prediction could not return to the pause frame");
    return;
  }
  setStatus(s, wantPaused ? "Pausing…" : "Resuming…", LASTING);
}

/**
 * What a helper would answer for the local keyboard, once per round: PREPARE
 * stops its rows at the next frame, PAUSE answers once its rows reach the
 * committed frame, and RESUME restarts its clock there.
 */
function keyboardAck(journal: Journal, source: JournalInputSource, request: NonNullable<Journal["barrier"]["request"]>): string | undefined {
  if (journal.keyAnswered === request) return undefined;
  let frame = source.expectedFrame();
  if (request.stage === "PREPARE") journal.keyStop = frame;
  else if (request.stage === "PAUSE") {
    if (journal.keyStop === undefined || frame < journal.keyStop) return undefined;
    frame = journal.keyStop;
  } else {
    // Rows already sent past the paused frame play first; the clock restarts level with the others.
    frame = request.target ?? frame;
    journal.keyStop = undefined;
    journal.keyClock = frame - 1;
  }
  journal.keyAnswered = request;
  return `ACK1|${source.controlSequenceNumber()}|${request.stage}|${frame}`;
}

/** Relays the local helper's acknowledgment of the current round to every client. */
export function serviceControlAck(s: ShellState, rollback: Rollback, journal: Journal): void {
  const { source, barrier } = journal;
  const request = barrier.request;
  if (source === undefined || request === undefined || agreedFrame(barrier) !== undefined) return;
  const sequence = source.controlSequenceNumber();
  const keyboard = playsOnKeyboard(journal, localSlot());
  let wire: string | undefined;
  if (keyboard) wire = keyboardAck(journal, source, request);
  else if (journal.ingress === "editbox") {
    setAsideRows(s, rollback, journal);
    wire = peekEditbox(s, rollback, journal);
  }
  else if (journal.ingress === "keyboard") wire = mailboxMessage(journal, "ACK1|");
  else {
    const read = readVocabularyControlAck(readChunk, source.controlAckBase());
    wire = read.kind === "text" ? read.text : undefined;
  }
  if (wire === undefined) return;
  const frame = source.acceptControlAck(wire, request.stage);
  if (frame === undefined) return;
  const ack = encodeControlAck({ epoch: rollback.epoch, slot: localSlot(), sequence, stage: request.stage, frame });
  if (!BlzSendSyncData(CONTROL_ACK_PREFIX, ack)) failJournal(s, rollback, journal, "pause acknowledgment could not be synchronized");
  else if (keyboard) return;
  else if (journal.ingress === "editbox") consumeEditbox(s, rollback, journal);
  else if (journal.mailbox !== undefined) releaseMessage(journal.mailbox);
}

/** A relayed acknowledgment arrived from the triggering player. */
export function receiveControlAckEvent(s: ShellState): void {
  const epoch = journalEpoch(s);
  if (epoch === undefined) return;
  const { rollback, journal } = epoch;
  const receipt = receiveControlAck(journal.barrier, s.game.humanMask, rollback.epoch, GetPlayerId(GetTriggerPlayer()), BlzGetTriggerSyncData());
  if (typeof receipt === "object") failJournal(s, rollback, journal, receipt.failure);
  else if (receipt === "complete") {
    const request = journal.barrier.request;
    traceInput(s.trace, `all journal controllers acknowledged state ${request?.stage ?? ""} frame ${request?.frame ?? 0}`);
  }
}

/** After every helper prepared, asks them to pause at the agreed frame. */
export function sendPauseCommit(s: ShellState, rollback: Rollback, journal: Journal): void {
  const frame = preparedFrame(journal.barrier);
  if (journal.source === undefined || frame === undefined) return;
  if (playsOnKeyboard(journal, localSlot())) journal.keyStop = frame;
  writeJournalFile(controlFile(journalIdentity(s, rollback.epoch), journal.source.controlSequenceNumber(), "PAUSE_COMMIT", frame));
  requestRound(journal.barrier, "PAUSE", frame);
}

/** Pauses or resumes exactly when the confirmed cursor reaches the agreed frame. */
export function commitPauseAtFrame(s: ShellState, rollback: Rollback, journal: Journal): void {
  const frame = agreedFrame(journal.barrier);
  if (frame === undefined) return;
  const next = rollback.schedule.nextConfirmedFrame();
  if (next < frame) return;
  if (next > frame) {
    failJournal(s, rollback, journal, "pause acknowledgment arrived after its frame boundary");
    return;
  }
  const paused = pausing(journal.barrier);
  s.session.paused = paused;
  if (!paused) paceResume(journal.barrier, rollback.schedule.speculativeFrame());
  pauseMatchPresentation(s, paused);
  setStatus(s, paused ? pausedMessage(startControl(s)) : "Resumed.", paused ? LASTING : 1.0);
  journal.barrier.request = undefined;
}

/** Custom frame events synchronize the triggering player: Enter in the edit box asks to chat. */
export function chatEntered(s: ShellState): void {
  const epoch = journalEpoch(s);
  const slot = GetPlayerId(GetTriggerPlayer());
  if (epoch === undefined || !isParticipantSlot(slot)) return;
  const { journal } = epoch;
  if (s.game.phase !== Phase.match || journal.failed || !humanActive(s.game, slot) || journal.chatRequested[slot]) return;
  journal.chatRequested[slot] = true;
  journal.chatSerial[slot]++;
  if (GetTriggerPlayer() === GetLocalPlayer()) journal.editbox?.requestChat(journal.chatSerial[slot]);
}

export function chatClosedEvent(s: ShellState): void {
  const epoch = journalEpoch(s);
  const slot = GetPlayerId(GetTriggerPlayer());
  if (epoch === undefined || !isParticipantSlot(slot)) return;
  const { rollback, journal } = epoch;
  if (BlzGetTriggerSyncData() === `${rollback.epoch}|${journal.chatSerial[slot]}`) journal.chatRequested[slot] = false;
}

/** A chat request pauses the match, then hands the keyboard to Warcraft's chat until it closes. */
export function serviceChat(s: ShellState, rollback: Rollback, journal: Journal): void {
  const { editbox } = journal;
  if (editbox === undefined || s.game.phase !== Phase.match || journal.failed) return;
  const idle = journal.barrier.request === undefined;
  if (chatBusy(journal) && !s.session.paused && idle) requestPause(s, rollback, journal, true);
  if (editbox.serviceChat(s.session.paused && idle) && !BlzSendSyncData(CHAT_CLOSED_PREFIX, `${rollback.epoch}|${editbox.chatSerial() ?? 0}`)) {
    failJournal(s, rollback, journal, "chat close could not be synchronized");
  }
}

/** The controller's Start shares the ordered text with its rows; it crosses a sync event before the pause barrier starts. */
export function servicePauseRequest(s: ShellState, rollback: Rollback, journal: Journal): void {
  if (journal.editbox === undefined || s.game.phase !== Phase.match || journal.failed) return;
  const wire = peekEditbox(s, rollback, journal);
  if (wire === undefined || !wire.startsWith("JP1")) return;
  if (!BlzSendSyncData(PAUSE_REQUEST_PREFIX, wire)) failJournal(s, rollback, journal, "pause request could not be synchronized");
  else consumeEditbox(s, rollback, journal);
}

export function pauseRequestEvent(s: ShellState): void {
  const epoch = journalEpoch(s);
  if (epoch === undefined) return;
  const { rollback, journal } = epoch;
  if (s.game.phase !== Phase.match || journal.barrier.request !== undefined || journal.failed || journal.source === undefined) return;
  if (!humanActive(s.game, GetPlayerId(GetTriggerPlayer()))) return;
  const paused = s.session.paused;
  // The epoch and control sequence discard delayed or simultaneous requests.
  const expected = `JP1${padDecimal(rollback.epoch, 10)}${padDecimal(journal.source.controlSequenceNumber(), 10)}${paused ? "R" : "P"}`;
  const wire = BlzGetTriggerSyncData();
  if (paused) {
    if (wire === expected) requestPause(s, rollback, journal, false);
    return;
  }
  // A pause names the frame Start was pressed in; one the match already confirmed past pauses where the helpers stop.
  const frame = wire.length === expected.length + 10 && wire.startsWith(expected) ? parseDecimal(wire.substring(expected.length)) : undefined;
  if (frame === undefined) return;
  requestPause(s, rollback, journal, true, frame >= rollback.schedule.nextConfirmedFrame() ? frame : undefined);
}
