import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MOUNTAIN_KING_MOVES } from "../src/game/sim/heroes/mountainKingMoves";
import { MOUNTAIN_KING_SPECIALS } from "../src/game/sim/heroes/mountainKingSpecials";
import { encodeMoveTable, moveTableModule } from "./moveTableEncode";

// Regenerates each converted fighter's move table module (docs/design/move-tables.md).
export const MOVE_TABLES = [
  { file: "mountainKingTable.ts", name: "MOUNTAIN_KING_TABLE_ROWS", moves: MOUNTAIN_KING_MOVES, specials: MOUNTAIN_KING_SPECIALS },
] as const;

const moveTablePath = (file: string): string => join(import.meta.dir, "../src/game/sim/heroes", file);

if (import.meta.main) {
  for (const { file, name, moves, specials } of MOVE_TABLES) writeFileSync(moveTablePath(file), moveTableModule(name, encodeMoveTable(moves, specials)));
}
