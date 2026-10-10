



import { f32 } from "wisp/src/sim/f32";
import { GrabAction } from "../sim/codes";
import { fighterHurtboxes } from "../sim/hurtboxes";
import { GRAB_HOLD_FRAMES, PUMMEL_CONTACT_FRAME, pummelLimit } from "../sim/moves";
import type { Fighter } from "../sim/fighter";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { FREEZE_TRAP_FREEZE_FRAMES } from "../sim/summons";


export const ESCAPE_METER_SEGMENT_FRAMES = 10;

const HEAD_CLEARANCE = 30.0;

export const ESCAPE_METER_HEIGHT = f32(0.008);
export const ESCAPE_METER_BORDER = f32(0.0015);

export interface EscapeMeterView {
  shown: boolean;

  remaining: number;

  full: number;

  pummel: number;

  x: number;
  z: number;
}

export function escapeMeterView(): EscapeMeterView {
  return { shown: false, remaining: 0, full: GRAB_HOLD_FRAMES, pummel: -1, x: 0.0, z: 0.0 };
}





export function readEscapeMeter(world: Readonly<Roster>, slot: number, view: EscapeMeterView): void {
  view.shown = false;
  if (!isActive(world, slot)) return;
  const held = fighterAt(world, slot);
  if (held.status.out) return;
  if (held.status.frozenFrames > 0) {
    view.remaining = held.status.frozenFrames;
    view.full = FREEZE_TRAP_FREEZE_FRAMES;
    view.pummel = -1;
  } else {
    const ownerSlot = held.grab.owner;
    if (ownerSlot === undefined || held.grab.grabbedFrames <= 0) return;
    const { grab, tuning } = fighterAt(world, ownerSlot);
    if (grab.action !== GrabAction.hold && grab.action !== GrabAction.pummel) return;
    view.remaining = held.grab.grabbedFrames;
    view.full = GRAB_HOLD_FRAMES;
    view.pummel = grab.action === GrabAction.pummel
      ? grab.frame < PUMMEL_CONTACT_FRAME ? PUMMEL_CONTACT_FRAME - grab.frame : -1
      : grab.pummels < pummelLimit(tuning.moves) ? PUMMEL_CONTACT_FRAME : -1;
  }
  view.shown = true;
  view.x = held.motion.x;
  view.z = overheadAnchorZ(held);
}


function overheadAnchorZ(f: Readonly<Fighter>): number {
  let top = 0.0;
  for (const part of fighterHurtboxes(f).stand) top = Math.max(top, Math.max(part.z1, part.z2) + part.radius);
  return f.motion.z + top + HEAD_CLEARANCE;
}


export function escapeMeterFill(view: Readonly<EscapeMeterView>): number {
  return Math.min(1.0, view.remaining / view.full);
}
