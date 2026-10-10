

import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { DownState } from "./codes";
import { inGrabContext } from "./conditions";
import { finishLanding } from "./down";
import type { Fighter } from "./fighter";
import { DIAGONAL_UNIT } from "./knockback";
import { keepToSlope, landingAlongShift } from "./motion";
import { type Controls, type Roster, fighterAt } from "./roster";
import { checkBlastZone } from "./stocks";
import { leaveMainDeckBody, resolveSolidSurfaceContacts } from "./surfaces";
import { melee } from "./tuning";


const SDI_PULSE_TRAVEL = 6;
const ASDI_TRAVEL = 3;
export const SDI_STEP_TRAVEL = 3;

export const SDI_HIT_TRAVEL = 9;
export const HIT_TRAVEL = SDI_HIT_TRAVEL + ASDI_TRAVEL;

export const STRING_TRAVEL = 24;

export const SDI_STEP_DISTANCE = melee(SDI_STEP_TRAVEL);
export const ASDI_DISTANCE = melee(ASDI_TRAVEL);

type Launch = Fighter["launch"];


function shifts(launch: Readonly<Launch>, directionX: number, directionZ: number): boolean {
  return directionX !== 0 || (directionZ !== 0 && !(launch.sdiWasGrounded && !launch.sdiLaunchesUpward));
}

function charge(launch: Launch, travel: number): void {
  launch.sdiHitTravel += travel;
  launch.sdiStringTravel += travel;
}


export function discardPendingSmashDirectionalInfluence(launch: Launch): void {
  launch.sdiStepX = 0;
  launch.sdiStepZ = 0;
  launch.sdiStepTravel = 0;
  launch.sdiNextX = 0;
  launch.sdiNextZ = 0;
  launch.sdiNextTravel = 0;
}


export function beginSmashDirectionalInfluenceHit(launch: Launch): void {
  discardPendingSmashDirectionalInfluence(launch);
  launch.sdiHitTravel = 0;
}






export function renewSmashDirectionalInfluenceString(f: Fighter): void {
  const { launch } = f;
  const held = launch.hitlag > 0 || launch.hitstun > 0 || inGrabContext(f) || f.status.frozenFrames > 0 || f.cannon.held !== undefined
    || f.down.state === DownState.bound || f.down.state === DownState.damage;
  if (!held) launch.sdiStringTravel = 0;
}





function applyHitlagShift(
  world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>,
  directionX: number, directionZ: number, distance: number, fromAsdi: boolean,
): void {
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
  let landing = landingAlongShift(f, stage, matchFrame, oldX, oldZ, newX, newZ, false);
  if (!fromAsdi && landing !== undefined && shiftZ < 0) {
    newZ = oldZ;
    landing = undefined;
  }
  motion.x = newX;
  motion.z = newZ;
  resolveSolidSurfaceContacts(f, stage, oldX, oldZ, input);
  if (landing !== undefined) finishLanding(f, stage, matchFrame, input, landing, fromAsdi);
  else {
    leaveMainDeckBody(f, stage);
    keepToSlope(f, stage);
  }
  if (motion.x !== oldX || motion.z !== oldZ) {
    if (fromAsdi) launch.asdiSerial++;
    else launch.sdiSerial++;
  }
  checkBlastZone(world, slot, stage);
}





function admitSdiRequest(launch: Launch, directionX: number, directionZ: number): void {
  const pending = launch.sdiStepTravel + launch.sdiNextTravel;
  const hitRoom = SDI_HIT_TRAVEL - launch.sdiHitTravel - pending;
  const stringRoom = STRING_TRAVEL - launch.sdiStringTravel - pending - ASDI_TRAVEL;
  const travel = min(SDI_PULSE_TRAVEL, min(hitRoom, stringRoom));
  if (travel <= 0) return;

  if (launch.sdiStepTravel <= 0) {
    launch.sdiStepX = directionX;
    launch.sdiStepZ = directionZ;
    launch.sdiStepTravel = travel;
  } else if (launch.sdiNextTravel <= 0) {
    launch.sdiNextX = directionX;
    launch.sdiNextZ = directionZ;
    launch.sdiNextTravel = travel;
  }
}


export function applySmashDirectionalInfluence(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const { launch } = fighterAt(world, slot);
  if (input.sdiPulse && shifts(launch, input.sdiX, input.sdiZ)) admitSdiRequest(launch, input.sdiX, input.sdiZ);
  const travel = min(SDI_STEP_TRAVEL, launch.sdiStepTravel);
  if (travel <= 0) return;
  const directionX = launch.sdiStepX;
  const directionZ = launch.sdiStepZ;
  launch.sdiStepTravel -= travel;
  if (launch.sdiStepTravel <= 0) {
    launch.sdiStepX = launch.sdiNextX;
    launch.sdiStepZ = launch.sdiNextZ;
    launch.sdiStepTravel = launch.sdiNextTravel;
    launch.sdiNextX = 0;
    launch.sdiNextZ = 0;
    launch.sdiNextTravel = 0;
  }

  charge(launch, travel);
  applyHitlagShift(world, slot, stage, matchFrame, input, directionX, directionZ, melee(travel), false);
}


export function applyAutomaticSmashDirectionalInfluence(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const { launch } = fighterAt(world, slot);
  const cStick = input.cStickX !== 0 || input.cStickZ !== 0;
  const directionX = cStick ? input.cStickX : input.direction;
  const directionZ = cStick ? input.cStickZ : input.verticalDirection;
  if (!shifts(launch, directionX, directionZ)) return;
  const travel = min(ASDI_TRAVEL, min(HIT_TRAVEL - launch.sdiHitTravel, max(0, STRING_TRAVEL - launch.sdiStringTravel)));
  if (travel <= 0) return;
  charge(launch, travel);
  applyHitlagShift(world, slot, stage, matchFrame, input, directionX, directionZ, melee(travel), true);
}
