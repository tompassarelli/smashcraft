


import { readChunks, writeChunks } from "wisp/src/platform/fileio";
import { LORE_BATTLES } from "./loreBattles";

export const LORE_CLEARS_FILE = "SmashcraftLore.pld";

const CHUNK = 200;

export interface ChunkFiles {
  readonly read: (filename: string) => string[];
  readonly write: (filename: string, chunks: readonly string[]) => boolean;
}

const NATIVE_FILES: ChunkFiles = { read: filename => readChunks(filename), write: (filename, chunks) => writeChunks(filename, chunks) };

export class LoreClears {
  private ids: string[] | undefined;

  constructor(private readonly files: ChunkFiles = NATIVE_FILES) {}


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


export function loreClears(): LoreClears {
  local ??= new LoreClears();
  return local;
}
