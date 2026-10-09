


import { f32 } from "wisp/src/sim/f32";
import { mainDeckLeft, mainDeckRight } from "./stage";
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
  return { left: f32(mainDeckLeft(stage) - beyondLedge), right: f32(mainDeckRight(stage) + beyondLedge), bottom: melee(bottom), top: melee(top) };
}


function makeBounds(stage: number): { readonly camera: StageRegion; readonly blast: StageRegion } {
  return { camera: region(stage, 170.0, -80.0, 114.0), blast: region(stage, 246.0, -140.0, 188.0) };
}

const FINAL_DESTINATION = makeBounds(0);

const BATTLEFIELD = {
  camera: region(0, 200.0, -59.0, 170.0, 68.4000015258789),
  blast: region(0, 280.0, -136.0, 250.0, 68.4000015258789),
};

export function stageBounds(stage: number): { readonly camera: StageRegion; readonly blast: StageRegion } {
  return stage === 2 ? BATTLEFIELD : FINAL_DESTINATION;
}
