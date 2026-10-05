// Text exchanged with host tools through Preload files in CustomMapData. A
// file a tool wrote is JASS: each line stores one chunk in a tooltip level of
// the FileIO ability, which Preloader executes and the map reads back. Local to
// this client; never use a result in synchronized code without a sync message.
import { CHUNKS_PER_FILE, FILE_IO_ABILITY } from "../runtime/hotFiles";
const EMPTY = " ";

export function readChunks(filename: string): string[] {
  for (let level = 0; level < CHUNKS_PER_FILE; level++) BlzSetAbilityTooltip(FILE_IO_ABILITY, EMPTY, level);
  Preloader(filename);
  const chunks: string[] = [];
  for (let level = 0; level < CHUNKS_PER_FILE; level++) {
    const chunk = BlzGetAbilityTooltip(FILE_IO_ABILITY, level);
    if (chunk === EMPTY) break;
    chunks.push(chunk);
    BlzSetAbilityTooltip(FILE_IO_ABILITY, EMPTY, level);
  }
  return chunks;
}

/** The text of a file holding one chunk; undefined while it is missing or empty. Touches only the first level, for polling. */
export function readChunk(filename: string): string | undefined {
  BlzSetAbilityTooltip(FILE_IO_ABILITY, EMPTY, 0);
  Preloader(filename);
  const chunk = BlzGetAbilityTooltip(FILE_IO_ABILITY, 0);
  BlzSetAbilityTooltip(FILE_IO_ABILITY, EMPTY, 0);
  return chunk === EMPTY || chunk === "" ? undefined : chunk;
}

/** Writes a one-line file for a host tool to poll. */
export function writeLine(filename: string, line: string): void {
  PreloadGenClear();
  PreloadGenStart();
  Preload(line);
  PreloadGenEnd(filename);
}
