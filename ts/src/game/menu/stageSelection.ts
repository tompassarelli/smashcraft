// Drag and drop on the stage panel: one shared chip marks the chosen stage.
// Coordinates are UI frame units (pointer.ts). The state belongs to the local
// cursor; only a finished choice crosses the sync event.

/** The playable stages' tiles, left to right. */
export type StageTile = 0 | 1;

/** What the button did when it went down. */
type StageGesture =
  /** Picked up the stage chip; it lands on the tile where the button comes up. */
  | { kind: "carry" }
  /** Pressed a stage tile away from the chip; coming up on the same tile chooses it. */
  | { kind: "click"; tile: StageTile };

interface StageDrag {
  /** The button state at the last update. */
  down: boolean;
  /** The gesture of the current press, if it is one. */
  gesture: StageGesture | undefined;
}

const CARRY: StageGesture = { kind: "carry" };

export function stageTileLeft(choice: number): number {
  return choice === 0 ? 0.45399999618530273 : 0.6119999885559082;
}

export function stageTileAt(x: number, y: number): StageTile | undefined {
  if (y < 0.2980000078678131 || y > 0.41600000858306885) return undefined;
  if (x >= 0.45399999618530273 && x <= 0.5960000157356262) return 0;
  if (x >= 0.6119999885559082 && x <= 0.7540000081062317) return 1;
  return undefined;
}

/** The chip is centered on the chosen tile; a press within 0.02 of its center picks it up. */
function onStageChip(choice: number, x: number, y: number): boolean {
  const dx = x - (stageTileLeft(choice) + 0.07100000232458115);
  const dy = y - 0.3569999933242798;
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
export function updateStageDrag(drag: StageDrag, down: boolean, x: number, y: number, choice: number): StageTile | undefined {
  let chosen: StageTile | undefined;
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
