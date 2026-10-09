import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";





export type RosterTile = number;



const CELL_WIDTH = f32(0.112);
const CELL_HEIGHT = f32(0.132);

const REGION_X = f32(0.05);
const REGION_WIDTH = f32(0.7);

const REGION_BOTTOM = f32(0.28);
const REGION_HEIGHT = f32(0.2);

export interface RosterGrid {
  readonly count: number;
  readonly columns: number;
  readonly rows: number;

  readonly scale: number;
  readonly cellWidth: number;
  readonly cellHeight: number;

  readonly left: number;
  readonly top: number;
}

export interface CellRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}


export function rosterGrid(count: number): RosterGrid {
  let columns = 1;
  let best = 0;
  for (let c = 1; c <= count; c++) {
    const rows = Math.ceil(count / c);
    const fit = Math.min(1, REGION_WIDTH / (c * CELL_WIDTH), REGION_HEIGHT / (rows * CELL_HEIGHT));
    if (fit > best) {
      best = fit;
      columns = c;
    }
  }
  const rows = Math.ceil(count / columns);
  const cellWidth = CELL_WIDTH * best;
  const cellHeight = CELL_HEIGHT * best;
  return { count, columns, rows, scale: best, cellWidth, cellHeight, left: REGION_X + (REGION_WIDTH - columns * cellWidth) / 2, top: REGION_BOTTOM + rows * cellHeight };
}

export function cellRect(grid: RosterGrid, tile: number): CellRect {
  const shortRows = grid.rows * grid.columns - grid.count;
  const longRows = grid.rows - shortRows;
  const longCount = longRows * grid.columns;
  const row = tile < longCount ? floorDiv(tile, grid.columns) : longRows + floorDiv(tile - longCount, grid.columns - 1);
  const columns = row < longRows ? grid.columns : grid.columns - 1;
  const column = tile < longCount ? floorMod(tile, grid.columns) : floorMod(tile - longCount, columns);
  const left = grid.left + (grid.columns - columns) * grid.cellWidth / 2 + column * grid.cellWidth;
  const top = grid.top - row * grid.cellHeight;
  return { left, top, right: left + grid.cellWidth, bottom: top - grid.cellHeight };
}


export function tileAt(grid: RosterGrid, x: number, y: number): RosterTile | undefined {
  for (let tile = 0; tile < grid.count; tile++) {
    const rect = cellRect(grid, tile);
    if (x >= rect.left && x < rect.right && y <= rect.top && y > rect.bottom) return tile;
  }
  return undefined;
}
