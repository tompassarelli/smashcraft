


import { STAMP_CELL, STAMP_CELLS, type StampCell, stampCells } from "../../runtime/drawnStamp";
import { createBackdrop, gameUi, placeTopLeft } from "../../game/ui/frames";
import { f32 } from "wisp/src/sim/f32";

const TEXTURES: Readonly<Record<StampCell, string>> = {
  guard: "ReplaceableTextures\\TeamColor\\TeamColor06.blp",
  one: "ReplaceableTextures\\TeamColor\\TeamColor00.blp",
  zero: "ReplaceableTextures\\TeamColor\\TeamColor01.blp",
};

interface Stamp {
  readonly cells: framehandle[];
  readonly shown: (StampCell | undefined)[];
}

declare global { var __smashcraftDrawnStamp: Stamp | undefined; }

function stamp(): Stamp {
  const existing = globalThis.__smashcraftDrawnStamp;
  if (existing !== undefined) return existing;
  const cells: framehandle[] = [];
  for (let index = 0; index < STAMP_CELLS; index++) {
    const cell = createBackdrop("SmashcraftDrawnStamp", gameUi(), index);
    BlzFrameSetSize(cell, STAMP_CELL, STAMP_CELL);
    placeTopLeft(cell, f32(index * STAMP_CELL), f32(0.6));
    BlzFrameSetLevel(cell, 9);
    cells.push(cell);
  }
  const created: Stamp = { cells, shown: cells.map(() => undefined) };
  globalThis.__smashcraftDrawnStamp = created;
  return created;
}


export function paintDrawnStamp(script: number, frame: number): void {
  const { cells, shown } = stamp();
  const kinds = stampCells(script, frame);
  for (let index = 0; index < STAMP_CELLS; index++) {
    const kind = kinds[index];
    const cell = cells[index];
    if (kind === undefined || cell === undefined || shown[index] === kind) continue;
    BlzFrameSetTexture(cell, TEXTURES[kind], 0, true);
    shown[index] = kind;
  }
}
