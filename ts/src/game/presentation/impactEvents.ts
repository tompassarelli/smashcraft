import { f32 } from "../../sim/f32";
import { floorMod } from "../../sim/intMath";
import { DownState, LedgeState, ShieldBreak, SurfaceContact } from "../sim/codes";
import { isFloorTeching, isGroundDodging, isTumbling } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { LEDGE_HANG_DEPTH, LEDGE_HANG_OUTSET } from "../sim/ledge";
import { SMASH_MAX_CHARGE_FRAMES } from "../sim/moves";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../sim/tuning";

export const IMPACT_NONE = 0;
export const IMPACT_TECH = 1;
export const IMPACT_MISSED_TECH = 2;

export interface ImpactEvents {
  previousDown: number;
  previouslyOut: boolean;
  previousGroundDodge: number;
  previousSurfaceContactSerial: number;
  previousHitVisualSerial: number;
  previousShieldVisualSerial: number;
  previousShieldReflectVisualSerial: number;
  previouslyGrounded: boolean;
  previousJumpSerial: number;
  previouslyAirDodging: boolean;
  previousShieldBreak: number;
  previousDashFrame: number;
  previousX: number;
  previousZ: number;
  previousVelocityX: number;
  previousDownFrame: number;
  previousGrabVisualSerial: number;
  previousThrowVisualSerial: number;
  previouslyCharging: boolean;
  previousChargeFrames: number;
  previousLedgeSerial: number;
  previousLedgeState: number;
  previousLedgeSide: number;
  grab: boolean;
  throwRelease: boolean;
  charge: boolean;
  ready: boolean;
  ledgeCatch: boolean;
  ledgeRecovery: boolean;
  ledgeX: number;
  ledgeZ: number;
  hit: boolean;
  electric: boolean;
  shieldHit: boolean;
  shieldReflect: boolean;
  shieldBreak: boolean;
  ordinaryLanding: boolean;
  movementDust: boolean;
  runningDust: boolean;
  launchTrail: boolean;
  dodgeTrail: boolean;
  airDodge: boolean;
  respawn: boolean;
  jump: number;
  jumpOriginX: number;
  jumpOriginZ: number;
  character: number;
  facing: number;
  koDirectionX: number;
  koDirectionZ: number;
  landing: number;
  dodge: number;
  direction: number;
  x: number;
  z: number;
  surface: number;
  surfaceMissedTech: boolean;
  contactX: number;
  contactZ: number;
  normalX: number;
  normalZ: number;
}

export function createImpactEvents(): ImpactEvents {
  return {
    previousDown: DownState.none, previouslyOut: false, previousGroundDodge: 0,
    previousSurfaceContactSerial: 0, previousHitVisualSerial: 0, previousShieldVisualSerial: 0,
    previousShieldReflectVisualSerial: 0, previouslyGrounded: true, previousJumpSerial: 0,
    previouslyAirDodging: false, previousShieldBreak: ShieldBreak.none, previousDashFrame: 0,
    previousX: 0.0, previousZ: 0.0, previousVelocityX: 0.0, previousDownFrame: 0,
    previousGrabVisualSerial: 0, previousThrowVisualSerial: 0, previouslyCharging: false,
    previousChargeFrames: 0, previousLedgeSerial: 0, previousLedgeState: LedgeState.none,
    previousLedgeSide: 0, grab: false, throwRelease: false, charge: false, ready: false,
    ledgeCatch: false, ledgeRecovery: false, ledgeX: 0.0, ledgeZ: 0.0, hit: false, electric: false,
    shieldHit: false, shieldReflect: false, shieldBreak: false, ordinaryLanding: false,
    movementDust: false, runningDust: false, launchTrail: false, dodgeTrail: false, airDodge: false,
    respawn: false, jump: 0, jumpOriginX: 0.0, jumpOriginZ: 0.0, character: 0, facing: 1,
    koDirectionX: 0, koDirectionZ: 0, landing: IMPACT_NONE, dodge: 0, direction: 0, x: 0.0, z: 0.0,
    surface: SurfaceContact.none, surfaceMissedTech: false, contactX: 0.0, contactZ: 0.0,
    normalX: 0.0, normalZ: 0.0,
  };
}

export function captureImpactEventsBefore(events: ImpactEvents, fighter: Readonly<Fighter>): void {
  events.previousDown = fighter.down.state;
  events.previouslyOut = fighter.status.out;
  events.previousGroundDodge = fighter.dodge.groundFrame;
  events.previousSurfaceContactSerial = fighter.surfaceRecovery.contactSerial;
  events.previousHitVisualSerial = fighter.visuals.hit;
  events.previousShieldVisualSerial = fighter.visuals.shield;
  events.previousShieldReflectVisualSerial = fighter.visuals.shieldReflect;
  events.previouslyGrounded = fighter.motion.grounded;
  events.previousJumpSerial = fighter.jump.serial;
  events.previouslyAirDodging = fighter.dodge.airDodging;
  events.previousShieldBreak = fighter.shield.breakState;
  events.previousDashFrame = fighter.ground.dashFrame;
  events.previousX = fighter.motion.x;
  events.previousZ = fighter.motion.z;
  events.previousVelocityX = fighter.motion.vx;
  events.previousDownFrame = fighter.down.frame;
  events.previousGrabVisualSerial = fighter.visuals.grab;
  events.previousThrowVisualSerial = fighter.visuals.throw;
  events.previouslyCharging = fighter.attack.smashCharging;
  events.previousChargeFrames = fighter.attack.smashChargeFrames;
  events.previousLedgeSerial = fighter.ledge.serial;
  events.previousLedgeState = fighter.ledge.state;
  events.previousLedgeSide = fighter.ledge.side;
  events.grab = false; events.throwRelease = false; events.charge = false; events.ready = false;
  events.ledgeCatch = false; events.ledgeRecovery = false; events.hit = false; events.electric = false;
  events.shieldHit = false; events.shieldReflect = false; events.shieldBreak = false;
  events.ordinaryLanding = false; events.movementDust = false; events.runningDust = false;
  events.launchTrail = false; events.dodgeTrail = false; events.airDodge = false; events.respawn = false;
  events.jump = 0; events.koDirectionX = 0; events.koDirectionZ = 0; events.landing = IMPACT_NONE;
  events.dodge = 0; events.direction = 0; events.surface = SurfaceContact.none; events.surfaceMissedTech = false;
}

export function finishImpactEventsAfter(events: ImpactEvents, fighter: Readonly<Fighter>): void {
  const { motion, status, ground, surfaceRecovery, visuals, jump, launch, shield, down, grab, attack, ledge, dodge } = fighter;
  events.character = fighter.character;
  events.facing = fighter.facing;
  events.x = motion.x;
  events.z = motion.z;
  events.direction = motion.x < events.previousX ? -1 : motion.x > events.previousX ? 1 : fighter.facing;
  events.respawn = events.previouslyOut && !status.out;
  if (!events.previouslyOut && status.out) {
    if (motion.x <= -920.0 || motion.x >= 920.0) events.koDirectionX = motion.x < 0.0 ? -1 : 1;
    else events.koDirectionZ = motion.z < 0.0 ? -1 : 1;
  }
  if (surfaceRecovery.contactSerial !== events.previousSurfaceContactSerial) {
    events.surface = surfaceRecovery.contactKind;
    events.contactX = surfaceRecovery.contactX;
    events.contactZ = surfaceRecovery.contactZ;
    events.normalX = surfaceRecovery.contactNormalX;
    events.normalZ = surfaceRecovery.contactNormalZ;
    events.surfaceMissedTech = (events.surface === SurfaceContact.wall || events.surface === SurfaceContact.ceiling) && isTumbling(fighter);
  }
  if (!events.previouslyOut && !status.out) {
    events.grab = visuals.grab !== events.previousGrabVisualSerial;
    events.throwRelease = visuals.throw !== events.previousThrowVisualSerial;
    events.charge = !events.previouslyCharging && attack.smashCharging;
    events.ready = attack.smashCharging && events.previousChargeFrames < SMASH_MAX_CHARGE_FRAMES && attack.smashChargeFrames === SMASH_MAX_CHARGE_FRAMES;
    events.ledgeCatch = ledge.serial !== events.previousLedgeSerial;
    events.ledgeRecovery = events.previousLedgeState === LedgeState.hang
      && (ledge.state === LedgeState.climb || ledge.state === LedgeState.roll || ledge.state === LedgeState.attack || jump.serial !== events.previousJumpSerial);
    if (events.ledgeCatch) {
      events.ledgeX = f32(motion.x - f32(ledge.side * LEDGE_HANG_OUTSET));
      events.ledgeZ = f32(motion.z + LEDGE_HANG_DEPTH);
    } else if (events.ledgeRecovery) {
      events.ledgeX = f32(events.previousX - f32(events.previousLedgeSide * LEDGE_HANG_OUTSET));
      events.ledgeZ = f32(events.previousZ + LEDGE_HANG_DEPTH);
    }
  }
  events.hit = !events.previouslyOut && !status.out && visuals.hit !== events.previousHitVisualSerial;
  events.electric = events.hit && visuals.hitElectric;
  events.shieldHit = !events.previouslyOut && !status.out && visuals.shield !== events.previousShieldVisualSerial;
  events.shieldReflect = !events.previouslyOut && !status.out && visuals.shieldReflect !== events.previousShieldReflectVisualSerial;
  events.shieldBreak = !events.previouslyOut && !status.out && events.previousShieldBreak === ShieldBreak.none && shield.breakState !== ShieldBreak.none;
  events.ordinaryLanding = !events.previouslyOut && !status.out && !events.previouslyGrounded && motion.grounded && down.state === DownState.none;
  if (!events.previouslyOut && !status.out && jump.serial !== events.previousJumpSerial && !events.ledgeRecovery) {
    events.jump = jump.isDouble ? 2 : events.previouslyGrounded ? 1 : 3;
    events.jumpOriginX = events.previousX;
    events.jumpOriginZ = events.previousZ;
  }
  events.airDodge = !events.previouslyOut && !status.out && !events.previouslyAirDodging && dodge.airDodging;
  if (!events.previouslyOut && !status.out && launch.hitlag === 0) {
    const moved = Math.abs(f32(motion.x - events.previousX)) > f32(0.1) || Math.abs(f32(motion.z - events.previousZ)) > f32(0.1);
    if (motion.grounded && down.state === DownState.none && !isGroundDodging(fighter)) {
      events.movementDust = ground.dashFrame === 1 && events.previousDashFrame !== 1
        || (moved && (f32(events.previousVelocityX * motion.vx) < 0 || Math.abs(events.previousVelocityX) > f32(Math.abs(motion.vx) + f32(0.1))));
      events.runningDust = moved && Math.abs(motion.vx) > fighter.tuning.physics.walkSpeed;
    }
    events.dodgeTrail = moved && (dodge.groundFrame > events.previousGroundDodge && floorMod(dodge.groundFrame, 4) === 0
      || (down.state === DownState.roll || down.state === DownState.techRoll) && down.frame > events.previousDownFrame && floorMod(down.frame, 4) === 0);
    events.launchTrail = !motion.grounded && isTumbling(fighter) && moved && down.frame > events.previousDownFrame
      && floorMod(down.frame, 3) === 0 && f32(Math.abs(launch.knockbackX) + Math.abs(launch.knockbackZ)) > WORLD_UNITS_PER_MELEE_UNIT;
  }
  if (!events.previouslyOut && !status.out && events.previousDown !== down.state) {
    if (isFloorTeching(fighter)) events.landing = IMPACT_TECH;
    else if (down.state === DownState.bound) events.landing = IMPACT_MISSED_TECH;
    if (down.state === DownState.roll || down.state === DownState.techRoll) {
      events.dodge = 2;
      events.direction = down.direction;
    }
  }
  if (!events.previouslyOut && !status.out && events.previousGroundDodge === 0 && dodge.groundFrame > 0) {
    events.direction = dodge.groundDirection;
    events.dodge = events.direction === 0 ? 1 : 2;
  }
  void grab;
}

export interface ImpactPresentationCursor { lastFrame: number | undefined; }

export function createImpactPresentationCursor(): ImpactPresentationCursor {
  return { lastFrame: undefined };
}

export function resetImpactPresentationCursor(cursor: ImpactPresentationCursor): void {
  cursor.lastFrame = undefined;
}

export function consumeImpactFrame(cursor: ImpactPresentationCursor, frame: number): boolean {
  if (cursor.lastFrame !== undefined && frame <= cursor.lastFrame) return false;
  cursor.lastFrame = frame;
  return true;
}
