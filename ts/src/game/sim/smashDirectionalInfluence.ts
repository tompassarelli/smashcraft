// Smash DI during hitlag and automatic smash DI when it ends: fixed shifts of
// the victim's position along the held direction.
import { f32 } from "waygate/src/sim/f32";
import { finishLanding } from "./down";
import { DIAGONAL_UNIT } from "./knockback";
import { landingAlongShift } from "./motion";
import { type Controls, type Roster, fighterAt } from "./roster";
import { checkBlastZone } from "./stocks";
import { resolveSolidSurfaceContacts } from "./surfaces";
import { melee } from "./tuning";

export const SDI_DISTANCE = melee(6.0);
export const ASDI_DISTANCE = melee(3.0);

/**
 * Shifts a fighter in hitlag. A grounded launch that isn't upward stays on the
 * floor; smash DI cannot land through a deck, while automatic smash DI can.
 */
function applyHitlagShift(
  world: Roster, slot: number, stage: number, input: Readonly<Controls>,
  directionX: number, directionZ: number, distance: number, fromAsdi: boolean,
): void {
  if (directionX === 0 && directionZ === 0) return;
  const f = fighterAt(world, slot);
  const { motion, launch } = f;
  const diagonalScale = directionX !== 0 && directionZ !== 0 ? DIAGONAL_UNIT : 1.0;
  const shiftX = f32(f32(directionX * diagonalScale) * distance);
  let shiftZ = f32(f32(directionZ * diagonalScale) * distance);
  if (launch.sdiWasGrounded && !launch.sdiLaunchesUpward) shiftZ = 0.0;
  if (shiftX === 0 && shiftZ === 0) return;
  const oldX = motion.x;
  const oldZ = motion.z;
  const newX = f32(oldX + shiftX);
  let newZ = f32(oldZ + shiftZ);
  let landing = landingAlongShift(f, stage, oldX, oldZ, newX, newZ);
  if (!fromAsdi && landing !== undefined && shiftZ < 0) {
    newZ = oldZ;
    landing = undefined;
  }
  motion.x = newX;
  motion.z = newZ;
  resolveSolidSurfaceContacts(f, stage, oldX, oldZ, input);
  if (landing !== undefined) finishLanding(f, stage, input, landing, fromAsdi);
  if (motion.x !== oldX || motion.z !== oldZ) {
    if (fromAsdi) launch.asdiSerial++;
    else launch.sdiSerial++;
  }
  checkBlastZone(world, slot);
}

/** One smash-DI pulse during hitlag. */
export function applySmashDirectionalInfluence(world: Roster, slot: number, stage: number, input: Readonly<Controls>): void {
  if (input.sdiPulse) applyHitlagShift(world, slot, stage, input, input.sdiX, input.sdiZ, SDI_DISTANCE, false);
}

/** The shift when hitlag ends, along the C-stick if it is held, otherwise the control stick. */
export function applyAutomaticSmashDirectionalInfluence(world: Roster, slot: number, stage: number, input: Readonly<Controls>): void {
  const cStick = input.cStickX !== 0 || input.cStickZ !== 0;
  const directionX = cStick ? input.cStickX : input.direction;
  const directionZ = cStick ? input.cStickZ : input.verticalDirection;
  applyHitlagShift(world, slot, stage, input, directionX, directionZ, ASDI_DISTANCE, true);
}
