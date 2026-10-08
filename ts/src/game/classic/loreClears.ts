// The Lore Battles this client's player has cleared (#305), kept in a local
// file as the tutorial keeps its answer (ui/tutorialMenu.ts). Clears are
// presentation only: they are never synchronized or read by the match.
import { readChunks, writeChunks } from "wisp/src/platform/fileio";
import { LORE_BATTLES } from "./loreBattles";

export const LORE_CLEARS_FILE = "SmashcraftLore.pld";
/** Characters per stored chunk. */
const CHUNK = 200;

export interface ChunkFiles {
  readonly read: (filename: string) => string[];
  readonly write: (filename: string, chunks: readonly string[]) => boolean;
}

const NATIVE_FILES: ChunkFiles = { read: filename => readChunks(filename), write: (filename, chunks) => writeChunks(filename, chunks) };

export class LoreClears {
  private ids: string[] | undefined;

  constructor(private readonly files: ChunkFiles = NATIVE_FILES) {}

  /** The cleared battles' ids, read from the file on first use; unknown ids are dropped. */
  private cleared(): string[] {
    this.ids ??= this.files.read(LORE_CLEARS_FILE).join("").split(",").filter(id => LORE_BATTLES.some(battle => battle.id === id));
    return this.ids;
  }

  has(id: string): boolean {
    return this.cleared().includes(id);
  }

  count(): number {
    return this.cleared().length;
  }

  mark(id: string): void {
    if (this.has(id)) return;
    const ids = this.cleared();
    ids.push(id);
    const text = ids.join(",");
    const chunks: string[] = [];
    for (let offset = 0; offset < text.length; offset += CHUNK) chunks.push(text.substring(offset, offset + CHUNK));
    this.files.write(LORE_CLEARS_FILE, chunks);
  }
}

let local: LoreClears | undefined;

/** This client's clears. */
export function loreClears(): LoreClears {
  local ??= new LoreClears();
  return local;
}
