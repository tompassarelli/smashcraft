




import { writeRepro } from "wisp/src/platform/repro";
import { reproFile } from "wisp/src/runtime/repro";
import { beginMomentSave, continueMomentSave, isMomentRequest, momentInput, momentRequest } from "../../game/replay/moment";
import { journalIngress } from "../../game/shell/build";
import { consumeEditbox, peekEditbox } from "./journal";
import { type Journal, type Rollback, type ShellState, localSlot } from "./state";

export const SAVE_MOMENT = "shell.saveMoment";


const NOTICE_SECONDS = 2.0;


function saveMoment(s: ShellState): void {
  if (s.moment.recorder.last !== s.runtime.simulationFrame) return;
  beginMomentSave(s.moment.recorder, momentInput(s.build), s.world, s.game, s.controls, s.runtime);
}

// Warcraft withholds F8 from map key events; use synchronized K for moment saves.




export function momentKey(s: ShellState): void {
  if (journalIngress(s.build) !== "keyboard" && GetPlayerId(GetTriggerPlayer()) === localSlot()) saveMoment(s);
}


export function serviceMomentRequest(s: ShellState, rollback: Rollback, journal: Journal): void {
  if (journal.editbox === undefined || journal.failed) return;
  const wire = peekEditbox(s, rollback, journal);
  if (wire === undefined || !isMomentRequest(wire)) return;
  if (consumeEditbox(s, rollback, journal) && wire === momentRequest(rollback.epoch)) saveMoment(s);
}


export function serviceMomentSave(s: ShellState): void {
  const { moment } = s;
  const saved = continueMomentSave(moment.recorder, s.diagnostic);
  if (saved === undefined) return;
  moment.saved++;
  writeRepro(reproFile(localSlot(), saved.frame, moment.saved, "smashcraft"), { build: s.build.id, frame: saved.frame, checksum: saved.checksum }, saved.lines);
  moment.notice = NOTICE_SECONDS;
}
