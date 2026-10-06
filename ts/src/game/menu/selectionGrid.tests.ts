import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { pointerX } from "./pointer";
import { cellRect, rosterGrid, tileAt } from "./selectionGrid";

/** The screen shapes the grid must hold at, as pixel sizes. */
const SCREENS = [
  { name: "16:9", width: 1920, height: 1080 },
  { name: "16:10", width: 1920, height: 1200 },
  { name: "3:2", width: 1620, height: 1080 },
] as const;

/** Frame coordinates to the pixel edge a screen of this size draws them at (the inverse of pointer.ts). */
const pixelX = (x: number, width: number, height: number) => Math.round((x * height) / f32(0.6) + (width - (height * 4) / 3) / 2);
const pixelY = (y: number, height: number) => Math.round(((f32(0.6) - y) * height) / f32(0.6));

for (const count of [3, 10]) {
  for (const { name, width, height } of SCREENS) {
    test(`${count} fighters at ${name}: drawn cells touch with no gaps and the pointer reads the cell it is over`, () => {
      const grid = rosterGrid(count);
      let gaps = 0;
      for (let tile = 0; tile < count; tile++) {
        const rect = cellRect(grid, tile);
        const right = floorMod(tile, grid.columns) < grid.columns - 1 && tile + 1 < count ? cellRect(grid, tile + 1) : undefined;
        const below = tile + grid.columns < count ? cellRect(grid, tile + grid.columns) : undefined;
        if (right !== undefined && pixelX(rect.right, width, height) !== pixelX(right.left, width, height)) gaps++;
        if (below !== undefined && pixelY(rect.bottom, height) !== pixelY(below.top, height)) gaps++;
        // Every filled cell is in the grid's row-major order: no empty cell lies before one.
        assertEquals(tileAt(grid, (rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2), tile);
      }
      assertEquals(gaps, 0, `gaps between adjacent filled cells at ${name}`);
      // Every pixel across the first row reads the cell drawn there.
      const first = cellRect(grid, 0);
      const y = (first.top + first.bottom) / 2;
      const span = Math.min(count, grid.columns);
      for (let px = pixelX(first.left, width, height) + 1; px < pixelX(cellRect(grid, span - 1).right, width, height) - 1; px++) {
        const hit = tileAt(grid, pointerX(px, width, height), y);
        assertEquals(hit !== undefined && hit < span, true, `pixel ${px} reads a filled cell`);
      }
      assertEquals(grid.top - grid.rows * grid.cellHeight >= f32(0.29) && grid.top <= f32(0.56), true);
      assertEquals(grid.left >= f32(0.26) && grid.left + grid.columns * grid.cellWidth <= f32(0.74), true);
    });
  }
}
test("a partial last row fills from the left and leaves no cell to point at past the last fighter", () => {
  const ten = rosterGrid(10);
  assertEquals(ten.columns, 5);
  assertEquals(ten.rows, 2);
  const nine = rosterGrid(9);
  const last = cellRect(nine, 8);
  assertEquals(tileAt(nine, last.left + f32(0.001), last.top - f32(0.001)), 8);
  assertEquals(tileAt(nine, last.right + f32(0.001), last.top - f32(0.001)), undefined);
  const three = rosterGrid(3);
  assertEquals(tileAt(three, cellRect(three, 2).right + f32(0.001), f32(0.36)), undefined);
});
