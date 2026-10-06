// The escape meter over a held or frozen fighter
// (smashcraft:docs/gameplay-design.md, "Grab holds and pummels" and
// "Rifleman's trap escape"): local presentation read from the simulation, the
// same for every player.
import { GrabAction } from "../sim/codes";
import { fighterHurtboxes } from "../sim/hurtboxes";
import { GRAB_HOLD_FRAMES, PUMMEL_CONTACT_FRAME, pummelLimit } from "../sim/moves";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { FREEZE_TRAP_FREEZE_FRAMES } from "../sim/summons";

/** Frames between the meter's segment lines. */
export const ESCAPE_METER_SEGMENT_FRAMES = 10;
/** World units between the held fighter's standing head and the meter. */
const HEAD_CLEARANCE = 30.0;

export interface EscapeMeterView {
  shown: boolean;
  /** Frames left before the fighter breaks free. */
  remaining: number;
  /** The bar's full length in frames: GRAB_HOLD_FRAMES for a grab, FREEZE_TRAP_FREEZE_FRAMES for a freeze. */
  full: number;
  /** Frames until a pummel would land, or -1 when none can. */
  pummel: number;
  /** World position of the meter's centre. */
  x: number;
  z: number;
}

export function escapeMeterView(): EscapeMeterView {
  return { shown: false, remaining: 0, full: GRAB_HOLD_FRAMES, pummel: -1, x: 0.0, z: 0.0 };
}

/**
 * The meter while `slot` is frozen, or held and not yet being thrown. The bar
 * empties before a pummel lands when `remaining` is at most `pummel`.
 */
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
  let top = 0.0;
  for (const part of fighterHurtboxes(held).stand) top = Math.max(top, Math.max(part.z1, part.z2) + part.radius);
  view.x = held.motion.x;
  view.z = held.motion.z + top + HEAD_CLEARANCE;
}

/** The bar's filled share, 0..1. */
export function escapeMeterFill(view: Readonly<EscapeMeterView>): number {
  return Math.min(1.0, view.remaining / view.full);
}
