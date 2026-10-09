




import { readChunk, writeChunks, writeLines } from "wisp/src/platform/fileio";
import { PARTICIPANT_SLOTS, type Slots } from "../../game/input/participants";
import { matchRecordLines, nextSerial } from "../../game/shell/matchRecord";
import { MATCH_RECORD_INDEX_FILE, matchRecordFile } from "../../runtime/gameFiles";
import { type ShellState, localSlot } from "./state";
import { views } from "./ui";
import { exportPad } from "./analogPad";

declare global {

  var __smashcraftMatchSerial: number | undefined;
}





export function readMatchIndex(): void {
  globalThis.__smashcraftMatchSerial ??= nextSerial(readChunk(MATCH_RECORD_INDEX_FILE));
}


export function takeMatchSerial(): number {
  const serial = globalThis.__smashcraftMatchSerial ?? nextSerial(readChunk(MATCH_RECORD_INDEX_FILE));
  globalThis.__smashcraftMatchSerial = serial + 1;
  writeChunks(MATCH_RECORD_INDEX_FILE, [`${serial + 1}`]);
  return serial;
}


export function writeMatchRecord(s: ShellState): void {
  exportPad(s);
  const serial = s.replay.recordSerial ?? takeMatchSerial();
  s.replay.recordSerial = undefined;
  const players: Slots<string | undefined> = [undefined, undefined, undefined, undefined];
  for (const slot of PARTICIPANT_SLOTS) players[slot] = GetPlayerName(Player(slot));
  writeLines(matchRecordFile(serial), matchRecordLines({ build: s.build.id, serial, local: localSlot(), players }, s.game, s.world, views(s).match.tally));
}
