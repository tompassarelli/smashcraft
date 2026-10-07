// Writing each finished match's record into this client's CustomMapData for
// the Smashcraft client (smashcraft:ts/src/game/shell/matchRecord.ts). Local:
// every client writes its own player's copy and nothing is synchronized.
// Serials continue across sessions through an index file, read once a
// session because Preloader keeps the first content it read from a name.
import { readChunk, writeChunks, writeLines } from "wisp/src/platform/fileio";
import { PARTICIPANT_SLOTS, type Slots } from "../../game/input/participants";
import { matchRecordLines, nextSerial } from "../../game/shell/matchRecord";
import { MATCH_RECORD_INDEX_FILE, matchRecordFile } from "../../runtime/gameFiles";
import { type ShellState, localSlot } from "./state";
import { views } from "./ui";

declare global {
  /** The next record's serial once this session read the index; kept across hot reloads. */
  var __smashcraftMatchSerial: number | undefined;
}

/**
 * Reads the index at map start, so no match frame reads a file: a callback
 * match takes its first serial on its first frame.
 */
export function readMatchIndex(): void {
  globalThis.__smashcraftMatchSerial ??= nextSerial(readChunk(MATCH_RECORD_INDEX_FILE));
}

/** The next serial, its successor written to the index first so a serial is never reused. */
export function takeMatchSerial(): number {
  const serial = globalThis.__smashcraftMatchSerial ?? nextSerial(readChunk(MATCH_RECORD_INDEX_FILE));
  globalThis.__smashcraftMatchSerial = serial + 1;
  writeChunks(MATCH_RECORD_INDEX_FILE, [`${serial + 1}`]);
  return serial;
}

/** Writes the record of the match that just reached its result, under the serial its replay took at its start. */
export function writeMatchRecord(s: ShellState): void {
  const serial = s.replay.recordSerial ?? takeMatchSerial();
  s.replay.recordSerial = undefined;
  const players: Slots<string | undefined> = [undefined, undefined, undefined, undefined];
  for (const slot of PARTICIPANT_SLOTS) players[slot] = GetPlayerName(Player(slot));
  writeLines(matchRecordFile(serial), matchRecordLines({ build: s.build.id, serial, local: localSlot(), players }, s.game, s.world, views(s).match.tally));
}
