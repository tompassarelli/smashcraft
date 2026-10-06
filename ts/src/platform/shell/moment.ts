// Saving a moment of the confirmed match for `bun wisp repro`
// (smashcraft:ts/src/game/replay/moment.ts): K, or a controller helper's
// request typed into the journal's edit box. Only the asking player's client
// saves, over the next frames, writes the file and shows the confirmation;
// the match runs on undisturbed.
import { writeRepro } from "wisp/src/platform/repro";
import { reproFile } from "wisp/src/runtime/repro";
import { beginMomentSave, continueMomentSave, isMomentRequest, momentInput, momentRequest } from "../../game/replay/moment";
import { journalIngress } from "../../game/shell/build";
import { consumeEditbox, peekEditbox } from "./journal";
import { type Journal, type Rollback, type ShellState, localSlot } from "./state";

export const SAVE_MOMENT = "shell.saveMoment";

/** Seconds the confirmation stays. */
const NOTICE_SECONDS = 2.0;

/** Begins saving the moment ending on the confirmed match's last frame, on this client; nothing before the match ran a frame. */
function saveMoment(s: ShellState): void {
  if (s.moment.recorder.last !== s.runtime.simulationFrame) return;
  beginMomentSave(s.moment.recorder, momentInput(s.build), s.world, s.game, s.controls, s.runtime);
}

/**
 * K reaches every client as a synchronized key event, registered as Y is;
 * Warcraft keeps F8 from the map's key events. The player who pressed it
 * saves. The keyboard journal ingress carries its text on K.
 */
export function momentKey(s: ShellState): void {
  if (journalIngress(s.build) !== "keyboard" && GetPlayerId(GetTriggerPlayer()) === localSlot()) saveMoment(s);
}

/** The local helper's request, consumed in its turn among the edit box's records. */
export function serviceMomentRequest(s: ShellState, rollback: Rollback, journal: Journal): void {
  if (journal.editbox === undefined || journal.failed) return;
  const wire = peekEditbox(s, rollback, journal);
  if (wire === undefined || !isMomentRequest(wire)) return;
  if (consumeEditbox(s, rollback, journal) && wire === momentRequest(rollback.epoch)) saveMoment(s);
}

/** Every game callback: the save in progress takes its next step, and a finished one is written. */
export function serviceMomentSave(s: ShellState): void {
  const { moment } = s;
  const saved = continueMomentSave(moment.recorder, s.diagnostic);
  if (saved === undefined) return;
  moment.saved++;
  writeRepro(reproFile(localSlot(), saved.frame, moment.saved, "smashcraft"), { build: s.build.id, frame: saved.frame, checksum: saved.checksum }, saved.lines);
  moment.notice = NOTICE_SECONDS;
}
