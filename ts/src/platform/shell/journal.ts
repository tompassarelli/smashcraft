// Journal input: the companion helper records each local player's controller
// rows for their original frames, the map admits them and relays them to
// every client, and pauses, chat and match boundaries are barriers every
// human's helper acknowledges. Ingress is edit box text, keyboard carrier
// keys or published files.
import { isParticipantSlot } from "../../game/input/participants";
import { INPUT_LAST_FRAME, packetSizeInRange } from "../../game/input/wire";
import { Phase, fighterMask, humanActive } from "../../game/match/rules";
import { Capture } from "../../game/netcode/capture";
import { padDecimal } from "../../game/netcode/journal/decimal";
import { TEXT_WINDOW } from "../../game/netcode/journal/text";
import { readVocabularyControlAck, readVocabularyPacket } from "../../game/netcode/journal/vocabulary";
import { FUTURE_LIMIT } from "../../game/netcode/ledger";
import { type JournalIdentity, type MenuPhase, controlFile, failureFile, lifecycleFile, menuFile, quiescentFile, transportReadyFile } from "../../game/shell/journalFiles";
import { pausedMessage } from "../../game/shell/messages";
import { CONTROL_ACK_PREFIX, agreedFrame, encodeControlAck, pausing, preparedFrame, receiveControlAck, requestRound } from "../../game/shell/pauseBarrier";
import { readChunk, writeLines } from "waygate/src/platform/fileio";
import { pollMailbox, releaseMessage } from "../keyboardJournal";
import { startInputTrace } from "./diagnostics";
import { controlsAvailable } from "./inputs";
import { probeClockMs, probeFileRead, probeInput, probePoll, probeSendFinished, probeTransportSend } from "./responseProbe";
import { type Journal, type Rollback, type ShellState, localSlot } from "./state";
import { recordSend, traceInput } from "./trace";
import { LASTING, pauseMatchPresentation, setStatus, startControl } from "./view";

/** Synchronized prefixes: input rows and helper readiness, edit box pause requests, chat closes. */
export const INPUT_PREFIX = "SC_GP";
export const PAUSE_REQUEST_PREFIX = "SC_JP";
export const CHAT_CLOSED_PREFIX = "SC_JH";

/** Journal packets admitted per callback. */
const PACKETS_PER_CALLBACK = 1;

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

const writeFile = (file: { readonly name: string; readonly lines: readonly string[] }) => writeLines(file.name, file.lines);

/** Stops this client's journal for the epoch; the match cannot continue. */
export function failJournal(s: ShellState, rollback: Rollback, journal: Journal, reason: string): void {
  if (journal.failed) return;
  journal.failed = true;
  setStatus(s, "Controller input stopped. Restart the match.", LASTING);
  const sequence = journal.source?.sequenceNumber() ?? 0;
  const frame = journal.source?.expectedFrame() ?? 0;
  traceInput(s.trace, `journal stopped ${reason} sequence ${sequence} frame ${frame}`);
  if (s.build.responseProbe) writeFile(failureFile(journalIdentity(s, rollback.epoch), reason, sequence, frame));
}

/** The edit box's next payload, failing the journal if its text broke. */
function peekEditbox(s: ShellState, rollback: Rollback, journal: Journal): string | undefined {
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
function consumeEditbox(s: ShellState, rollback: Rollback, journal: Journal): boolean {
  const { editbox } = journal;
  if (editbox === undefined || editbox.consumed()) return true;
  failJournal(s, rollback, journal, editbox.failure() ?? "controller text changed during admission");
  return false;
}

/** The keyboard mailbox's complete message, when it starts with prefix. */
function mailboxMessage(journal: Journal, prefix: string): string | undefined {
  const { mailbox } = journal;
  if (mailbox === undefined) return undefined;
  pollMailbox(mailbox);
  const message = mailbox.message();
  return message?.startsWith(prefix) === true ? message : undefined;
}

export function chatBusy(journal: Readonly<Journal>): boolean {
  return journal.chatRequested.some(requested => requested);
}

/** Asks every helper to pause or resume at a frame it chooses. */
export function requestPause(s: ShellState, rollback: Rollback, journal: Journal, wantPaused: boolean): void {
  const { source } = journal;
  if (source === undefined || journal.barrier.request !== undefined || (!wantPaused && chatBusy(journal))) return;
  writeFile(controlFile(journalIdentity(s, rollback.epoch), source.controlSequenceNumber(), wantPaused ? "PAUSE" : "RESUME", source.expectedFrame()));
  requestRound(journal.barrier, wantPaused ? "PREPARE" : "RESUME");
  setStatus(s, wantPaused ? "Pausing…" : "Resuming…", LASTING);
}

/** Relays the local helper's acknowledgment of the current round to every client. */
export function serviceControlAck(s: ShellState, rollback: Rollback, journal: Journal): void {
  const { source, barrier } = journal;
  const request = barrier.request;
  if (source === undefined || request === undefined || agreedFrame(barrier) !== undefined) return;
  const sequence = source.controlSequenceNumber();
  let wire: string | undefined;
  if (journal.ingress === "editbox") wire = peekEditbox(s, rollback, journal);
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
  writeFile(controlFile(journalIdentity(s, rollback.epoch), journal.source.controlSequenceNumber(), "PAUSE_COMMIT", frame));
  requestRound(journal.barrier, "PAUSE");
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
  pauseMatchPresentation(s, paused);
  setStatus(s, paused ? pausedMessage(startControl(s)) : "Resumed.", paused ? LASTING : 1.0);
  journal.barrier.request = undefined;
}

/** Sends queued packets once a pair is ready, a lone packet has waited, or flush is set. */
export function flushTransport(s: ShellState, rollback: Rollback, journal: Journal, flush: boolean): void {
  if (journal.failed) return;
  const message = journal.outgoing.ready(flush);
  if (message === undefined) return;
  const started = probeClockMs(s.probe);
  const sent = BlzSendSyncData(INPUT_PREFIX, message.wire);
  probeSendFinished(s.probe, started);
  if (!sent) {
    rollback.sendFailed = true;
    failJournal(s, rollback, journal, "synchronized input submission failed");
    return;
  }
  for (let row = 0; row < message.rows; row++) probeTransportSend(s.probe, rollback.epoch, message.firstFrame + row);
  if (s.trace.active) {
    const { window } = s.trace;
    window.localSends++;
    window.sentRows += message.rows;
    if (message.rows === 1) window.singletons++;
    for (let row = 0; row < message.rows; row++) recordSend(s.trace, rollback.epoch, message.firstFrame + row);
    traceInput(s.trace, `journal sent frame ${message.firstFrame} count ${message.rows}`);
  }
  journal.outgoing.clear();
}

/** Before the match starts, relays the helper's readiness; an explicit-clock producer is ready with its first row. */
function serviceReadiness(s: ShellState, rollback: Rollback, journal: Journal): void {
  const wire = peekEditbox(s, rollback, journal);
  if (wire === undefined) return;
  const ready = wire === `JR1${rollback.epoch}`;
  if (journal.startSent || !(ready || wire.startsWith("I4"))) return;
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
      // Pause acknowledgments and requests are serviced in their own order.
      return wire === undefined || wire.startsWith("ACK1|") || wire.startsWith("JP1") ? undefined : wire;
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

/** Admits the local helper's next packet at its original frames and queues it for every client. */
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
  for (let read = 0; read < PACKETS_PER_CALLBACK; read++) {
    const latest = Math.min(INPUT_LAST_FRAME, schedule.nextConfirmedFrame() - 1 + FUTURE_LIMIT);
    if (source.expectedFrame() > latest) return;
    const wire = nextPacketText(s, rollback, journal);
    if (wire === undefined || wire === "") return;
    const result = source.read(wire, latest);
    if (result.kind === "wait") return;
    if (result.kind === "invalid") {
      failJournal(s, rollback, journal, `invalid or noncontiguous I4 row: ${wire}`);
      return;
    }
    const { packet } = result;
    if (s.build.responseProbe && source.sequenceNumber() === 1 && !s.trace.active) startInputTrace(s);
    for (let index = 0; index < packet.rows.length; index++) {
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
    if (!packetSizeInRange(wire.length, packet.rows.length)) {
      rollback.sendFailed = true;
      failJournal(s, rollback, journal, "synchronized input submission failed");
      return;
    }
    if (!journal.outgoing.append(wire)) {
      failJournal(s, rollback, journal, "controller input could not be queued");
      return;
    }
    if (!source.sent()) {
      rollback.sendFailed = true;
      failJournal(s, rollback, journal, "journal cursor could not advance after send");
      return;
    }
    if (editbox) {
      if (!consumeEditbox(s, rollback, journal)) return;
    } else if (journal.mailbox !== undefined) releaseMessage(journal.mailbox);
  }
}

/** A helper reported ready ("J4") or stopped ("E4") for this epoch. Returns false for any other message. */
export function receiveLifecycle(s: ShellState, rollback: Rollback, journal: Journal, sender: number, wire: string): boolean {
  if (wire === `E4${rollback.epoch}`) {
    journal.lifecycle?.stopped(rollback.epoch, sender);
    return true;
  }
  if (wire !== `J4${rollback.epoch}`) return false;
  const bit = 1 << sender;
  if (!humanActive(s.game, sender) || (journal.readyMask & bit) !== 0) return true;
  journal.readyMask |= bit;
  journal.lifecycle?.ready(rollback.epoch, sender);
  traceInput(s.trace, `journal transport start received sender ${sender}`);
  if (journal.readyMask !== s.game.humanMask) return true;
  const identity = journalIdentity(s, rollback.epoch);
  if (journal.ingress === "editbox") writeFile(lifecycleFile(identity, "start", 1 + rollback.delay));
  writeFile(transportReadyFile(identity, journal.readyMask));
  return true;
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
  if (BlzGetTriggerSyncData() === expected) requestPause(s, rollback, journal, !paused);
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
  writeFile(menuFile(journalIdentity(s, s.rollback.epoch), phase, {
    connected: game.humanMask, humanFighters: game.humanFighterMask, computers: game.computerMask, fighters: fighterMask(game),
  }));
}

/** After a match ends: tell the helper, drain its last rows, and relay when it has stopped. */
export function serviceJournalEnd(s: ShellState, rollback: Rollback, journal: Journal): void {
  const { editbox } = journal;
  if (editbox === undefined) return;
  const identity = journalIdentity(s, rollback.epoch);
  if (!journal.endSent) {
    writeFile(lifecycleFile(identity, "end", journal.source?.expectedFrame() ?? 0));
    journal.endSent = true;
    journal.barrier.request = undefined;
  }
  if (journal.quiescent) return;
  if (journal.endReceived && readChunk(quiescentFile(identity)) === "Q") {
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
