// GrNLa.dat's map_head camera/dead points (Ground_801C34AC), converted like
// the main deck walls: six world units per Melee unit, preserving the
// distance from each ledge. Both current layouts use that FD deck body.
import { f32 } from "wisp/src/sim/f32";
import { surfaceLeft, surfaceRight } from "./stage";
import { melee } from "./tuning";

export interface StageRegion {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}

const REFERENCE_LEDGE = 85.5656967163086;

function region(stage: number, side: number, bottom: number, top: number, referenceLedge: number = REFERENCE_LEDGE): StageRegion {
  const beyondLedge = melee(f32(side - referenceLedge));
  return { left: f32(surfaceLeft(stage, 0) - beyondLedge), right: f32(surfaceRight(stage, 0) + beyondLedge), bottom: melee(bottom), top: melee(top) };
}

/** Current stage layouts borrow FD's body; a future matching layout selects its own cited points here. */
function makeBounds(stage: number): { readonly camera: StageRegion; readonly blast: StageRegion } {
  return { camera: region(stage, 170.0, -80.0, 114.0), blast: region(stage, 246.0, -140.0, 188.0) };
}

const FINAL_DESTINATION = makeBounds(0);
// Frozen Throne's Battlefield layout preserves offsets from its ±68.4 ledges.
const BATTLEFIELD = {
  camera: region(0, 200.0, -59.0, 170.0, 68.4000015258789),
  blast: region(0, 280.0, -136.0, 250.0, 68.4000015258789),
};

export function stageBounds(stage: number): { readonly camera: StageRegion; readonly blast: StageRegion } {
  return stage === 2 ? BATTLEFIELD : FINAL_DESTINATION;
}
