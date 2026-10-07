// Drag and drop on the stage panel: one shared chip marks the chosen stage.
// Coordinates are UI frame units (pointer.ts). The state belongs to the local
// cursor; only a finished choice crosses the sync event.

/** The playable stages' tiles, left to right. */
import { RANDOM_STAGE, STAGE_CHOICES, stageTileIndex, type StageChoice } from "./stageCatalog";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
export type { StageChoice } from "./stageCatalog";

/** What the button did when it went down. */
type StageGesture =
  /** Picked up the stage chip; it lands on the tile where the button comes up. */
  | { kind: "carry" }
  /** Pressed a stage tile away from the chip; coming up on the same tile chooses it. */
  | { kind: "click"; tile: StageChoice };

interface StageDrag {
  /** The button state at the last update. */
  down: boolean;
  /** The gesture of the current press, if it is one. */
  gesture: StageGesture | undefined;
}

const CARRY: StageGesture = { kind: "carry" };

export function stageTileLeft(choice: number): number {
  if (choice === RANDOM_STAGE) return f32(0.045);
  return f32(0.45399999618530273 + f32(floorMod(stageTileIndex(choice), 3) * 0.10199999809265137));
}

export function stageTileTop(choice: number): number {
  if (choice === RANDOM_STAGE) return f32(0.555);
  return f32(0.4399999976158142 - f32(floorDiv(stageTileIndex(choice), 3) * 0.10300000011920929));
}

export function stageTileAt(x: number, y: number): StageChoice | undefined {
  for (const stage of STAGE_CHOICES) {
    const left = stageTileLeft(stage.id);
    const top = stageTileTop(stage.id);
    if (x >= left && x <= f32(left + 0.09399999678134918) && y <= top && y >= f32(top - 0.07800000160932541)) return stage.id;
  }
  return undefined;
}

/** The chip is centered on the chosen tile; a press within 0.02 of its center picks it up. */
function onStageChip(choice: number, x: number, y: number): boolean {
  const dx = x - (stageTileLeft(choice) + 0.04699999839067459);
  const dy = y - f32(stageTileTop(choice) - 0.039000000804662704);
  return dx * dx + dy * dy <= 0.00039999998989515007;
}

export function stageDrag(): StageDrag {
  return { down: false, gesture: undefined };
}

/** The panel closed: any press in progress is forgotten. */
export function clearStageDrag(drag: StageDrag): void {
  drag.down = false;
  drag.gesture = undefined;
}

/** One frame of the pointer while the panel is open, with the stage chosen now; returns a newly chosen stage. */
export function updateStageDrag(drag: StageDrag, down: boolean, x: number, y: number, choice: number): StageChoice | undefined {
  let chosen: StageChoice | undefined;
  if (down && !drag.down) {
    const tile = stageTileAt(x, y);
    drag.gesture = onStageChip(choice, x, y) ? CARRY : tile === undefined ? undefined : { kind: "click", tile };
  } else if (!down && drag.down) {
    const tile = stageTileAt(x, y);
    const { gesture } = drag;
    if (gesture?.kind === "carry" || (gesture?.kind === "click" && gesture.tile === tile)) chosen = tile;
    drag.gesture = undefined;
  }
  drag.down = down;
  return chosen;
}
