




import { RANDOM_STAGE, STAGE_CHOICES, stageTileIndex, type StageChoice } from "./stageCatalog";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
export type { StageChoice } from "./stageCatalog";


type StageGesture =

  | { kind: "carry" }

  | { kind: "click"; tile: StageChoice };

interface StageDrag {

  down: boolean;

  gesture: StageGesture | undefined;
}

const CARRY: StageGesture = { kind: "carry" };

export function stageTileLeft(choice: number): number {
  return f32(0.45399999618530273 + f32(floorMod(choice === RANDOM_STAGE ? 0 : stageTileIndex(choice) + 1, 3) * 0.10199999809265137));
}

export function stageTileTop(choice: number): number {
  return f32(f32(0.445) - f32(floorDiv(choice === RANDOM_STAGE ? 0 : stageTileIndex(choice) + 1, 3) * f32(0.08)));
}

export function stageTileAt(x: number, y: number): StageChoice | undefined {
  for (const stage of STAGE_CHOICES) {
    const left = stageTileLeft(stage.id);
    const top = stageTileTop(stage.id);
    if (x >= left && x <= f32(left + 0.09399999678134918) && y <= top && y >= f32(top - f32(0.059))) return stage.id;
  }
  return undefined;
}


function onStageChip(choice: number, x: number, y: number): boolean {
  const dx = x - (stageTileLeft(choice) + 0.04699999839067459);
  const dy = y - f32(stageTileTop(choice) - f32(0.0295));
  return dx * dx + dy * dy <= 0.00039999998989515007;
}

export function stageDrag(): StageDrag {
  return { down: false, gesture: undefined };
}


export function clearStageDrag(drag: StageDrag): void {
  drag.down = false;
  drag.gesture = undefined;
}


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
