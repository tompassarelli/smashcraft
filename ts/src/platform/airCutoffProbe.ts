// Developer-only trace for the native AIR_CUTOFF_4 counterexample.
import { fusedMultiplyAddFloat32, multiplyFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../game/sim/codes";
import { createFighter } from "../game/sim/fighter";
import { decayKnockback } from "../game/sim/knockback";
import { AIR_KNOCKBACK_DECAY, AIR_KNOCKBACK_SQUARED_CUTOFF, decayedAirMotion, setMeleeKnockback } from "../game/sim/motion";
import { advanceFighter } from "../game/sim/step";
import { controls, soloWorld } from "../game/sim/testWorld";
import { meleeAtan2, meleeCos, meleeSin } from "../sim/meleeScalarMath";

// Lua's ordinary float formatting hides nearby binary32 values. Scaling by
// powers of two exposes the exact integer significand without decimal loss.
function exact(value: number): string {
  if (value === 0 || value !== value || value - value !== 0) return String(value);
  let magnitude = Math.abs(value);
  let exponent = -23;
  while (magnitude >= 2.0) {
    magnitude *= 0.5;
    exponent++;
  }
  while (magnitude < 1.0) {
    magnitude *= 2.0;
    exponent--;
  }
  return `${value < 0 ? "-" : ""}${Math.floor(magnitude * 8388608.0)}p${exponent}`;
}

export function airCutoffTrace(): string[] {
  const lines: string[] = [];
  const record = (name: string, value: number) => lines.push(`AIR_CUTOFF_4_TRACE_${name}=${exact(value)}`);
  const x = 0.050999965518713;
  const z = 0.00005743650399381295;
  record("INPUT_X", x);
  record("INPUT_Z", z);
  record("DECAY", AIR_KNOCKBACK_DECAY);
  record("CUTOFF", AIR_KNOCKBACK_SQUARED_CUTOFF);
  const spacing = 3.725290298461914e-9;
  record("RAW_PREVIOUS", roundToFloat32(f32(AIR_KNOCKBACK_DECAY - spacing)));
  record("EXACT_PREVIOUS", subtractFloat32(AIR_KNOCKBACK_DECAY, spacing));
  const verticalSquare = multiplyFloat32(z, z);
  const speedSquare = fusedMultiplyAddFloat32(x, x, verticalSquare);
  record("VERTICAL_SQUARE", verticalSquare);
  record("SPEED_SQUARE", speedSquare);
  record("BELOW", speedSquare < AIR_KNOCKBACK_SQUARED_CUTOFF ? 1 : 0);
  const angle = meleeAtan2(z, x);
  record("ANGLE", angle);
  record("COS", meleeCos(angle));
  record("SIN", meleeSin(angle));
  record("FUSED_X", fusedMultiplyAddFloat32(-AIR_KNOCKBACK_DECAY, meleeCos(angle), x));
  record("FUSED_Z", fusedMultiplyAddFloat32(-AIR_KNOCKBACK_DECAY, meleeSin(angle), z));
  const direct = decayedAirMotion(x, z, AIR_KNOCKBACK_DECAY, AIR_KNOCKBACK_SQUARED_CUTOFF);
  record("DIRECT_X", direct.x);
  record("DIRECT_Z", direct.z);

  const fighter = createFighter(Character.rifleman, -360.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  fighter.motion.z = 300.0;
  fighter.tuning.physics = { ...fighter.tuning.physics, gravity: 0.0 };
  fighter.launch.hitstun = 5;
  setMeleeKnockback(fighter, x, z);
  record("INSTALLED_X", fighter.launch.meleeKnockbackX.original);
  record("INSTALLED_Z", fighter.launch.meleeKnockbackZ.original);
  decayKnockback(fighter);
  record("DECAYED_X", fighter.launch.meleeKnockbackX.original);
  record("DECAYED_Z", fighter.launch.meleeKnockbackZ.original);
  setMeleeKnockback(fighter, x, z);
  advanceFighter(soloWorld(fighter), 0, 0, controls(), 0.0);
  record("FRAME_ORIGINAL_X", fighter.launch.meleeKnockbackX.original);
  record("FRAME_ORIGINAL_Z", fighter.launch.meleeKnockbackZ.original);
  record("FRAME_WORLD_X", fighter.launch.knockbackX);
  record("FRAME_WORLD_Z", fighter.launch.knockbackZ);
  return lines;
}
