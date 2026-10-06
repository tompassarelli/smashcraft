// The roster grid on the character panel: one contiguous block of fighter
// cells sized from the number of selectable fighters. Drawn frames, hover
// targets and chip positions all read these cells (UI frame units, pointer.ts).

/** A fighter's cell: its number is the fighter it chooses. */
export type RosterTile = number;

/** Fighters a player can choose. */
export const SELECTABLE_FIGHTERS = 3;

/** One cell at full size; the frame art's own proportions. */
const CELL_WIDTH = 0.112;
const CELL_HEIGHT = 0.132;
/** The grid region: left edge, width, height above its bottom edge. */
const REGION_X = 0.26;
const REGION_WIDTH = 0.48;
/** The grid sits on this bottom edge and grows upward. */
const REGION_BOTTOM = 0.292;
const REGION_HEIGHT = 0.268;

export interface RosterGrid {
  readonly count: number;
  readonly columns: number;
  readonly rows: number;
  /** Cell scale against full size, at most 1. */
  readonly scale: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  /** Left and top edge of the whole grid. */
  readonly left: number;
  readonly top: number;
}

export interface CellRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The grid for `count` fighters: the column count that allows the largest cells, the grid centered across the region. */
export function rosterGrid(count: number): RosterGrid {
  let columns = 1;
  let best = 0;
  for (let c = 1; c <= count; c++) {
    const rows = Math.ceil(count / c);
    const fit = Math.min(1, REGION_WIDTH / (c * CELL_WIDTH), REGION_HEIGHT / (rows * CELL_HEIGHT));
    if (fit >= best) {
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
  const column = tile % grid.columns;
  const row = (tile - column) / grid.columns;
  const left = grid.left + column * grid.cellWidth;
  const top = grid.top - row * grid.cellHeight;
  return { left, top, right: left + grid.cellWidth, bottom: top - grid.cellHeight };
}

/** The fighter cell under the pointer. */
export function tileAt(grid: RosterGrid, x: number, y: number): RosterTile | undefined {
  const column = Math.floor((x - grid.left) / grid.cellWidth);
  const row = Math.floor((grid.top - y) / grid.cellHeight);
  if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) return undefined;
  const tile = row * grid.columns + column;
  return tile < grid.count ? tile : undefined;
}
