// Journal input: the companion helper records each local player's controller
// rows for their original frames, the map admits them and relays them to
// every client. Ingress is edit box text, keyboard carrier keys or published
// files. This module admits and sends rows and follows the helper's lifecycle,
// menus and end of match; journalPause.ts runs the pause rounds and chat.
import { isParticipantSlot } from "../../game/input/participants";
import { INPUT_LAST_FRAME } from "../../game/input/wire";
import { Phase, fighterMask, humanActive } from "../../game/match/rules";
import { Capture } from "../../game/netcode/capture";
import { TEXT_WINDOW } from "../../game/netcode/journal/text";
import { readVocabularyPacket } from "../../game/netcode/journal/vocabulary";
import { FUTURE_LIMIT } from "../../game/netcode/ledger";
import { type JournalIdentity, type MenuPhase, endFile, failureFile, menuFile, quiescentFile, startFile, transportReadyFile } from "../../game/shell/journalFiles";
import { CATCH_UP_FRAMES } from "../../game/shell/playback";
import { readChunk, writeLines } from "wisp/src/platform/fileio";
import { pollMailbox, releaseMessage } from "../keyboardJournal";
import { startInputTrace } from "./diagnostics";
import { controlsAvailable } from "./inputs";
import { probeClockMs, probeFileRead, probeInput, probePoll, probeSendFinished, probeTransportSend } from "./responseProbe";
import { type Journal, type Rollback, type ShellState, localSlot } from "./state";
import { recordSend, traceInput } from "./trace";
import { LASTING, setStatus } from "./view";

/** Synchronized prefix of input rows and helper readiness. */
export const INPUT_PREFIX = "SC_GP";

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
  for (let admitted = 0; admitted < CATCH_UP_FRAMES; ) {
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
    for (let index = 0; index < packet.rows.length; index++) {
      const row = packet.rows[index];
      if (row === undefined || !journal.outgoing.admit(packet.firstFrame + index, row)) {
        failJournal(s, rollback, journal, "controller input could not be queued");
        return;
      }
    }
    if (!source.sent()) {
      rollback.sendFailed = true;
      failJournal(s, rollback, journal, "journal cursor could not advance after send");
      return;
    }
    if (editbox) {
      if (!consumeEditbox(s, rollback, journal)) return;
    } else if (journal.mailbox !== undefined) releaseMessage(journal.mailbox);
    admitted += packet.rows.length;
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
  if (journal.ingress === "editbox") writeJournalFile(startFile(identity, 1 + rollback.delay));
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
