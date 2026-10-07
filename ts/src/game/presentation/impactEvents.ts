import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { type Character, DownState, LedgeState, ShieldBreak, SurfaceContact } from "../sim/codes";
import { attackStartup, isFloorTeching, isGroundDodging, isTumbling } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { LEDGE_HANG_DEPTH, LEDGE_HANG_OUTSET } from "../sim/ledge";
import { SMASH_MAX_CHARGE_FRAMES } from "../sim/moves";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../sim/tuning";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { AttackStyle } from "../sim/codes";
import { moveTier } from "./moveTiers";

/** How a down state was entered: a floor tech, or a missed one that bounced. */
export const ImpactLanding = { none: 0, tech: 1, missedTech: 2 } as const;
export type ImpactLanding = (typeof ImpactLanding)[keyof typeof ImpactLanding];

/** A new jump: ground, double, other aerial, or a wall push-off. */
export const JumpCue = { none: 0, ground: 1, double: 2, air: 3, wall: 4 } as const;
export type JumpCue = (typeof JumpCue)[keyof typeof JumpCue];

export const DodgeCue = { none: 0, spot: 1, roll: 2 } as const;
export type DodgeCue = (typeof DodgeCue)[keyof typeof DodgeCue];

/** The fighter's x beyond which a KO counts as a side KO. */
const SIDE_KO_X = 920.0;

/**
 * A numerical journal for one fighter's executed frame: the before half
 * records the fighter's prior state, the after half the cues it produced.
 * Native presentation consumes it outside simulation and replay.
 */
export interface ImpactEvents {
  previousDown: DownState;
  previouslyOut: boolean;
  previousGroundDodge: number;
  previousSurfaceContactSerial: number;
  previousHitVisualSerial: number;
  previousFrozenFrames: number;
  previousShieldVisualSerial: number;
  previousShieldReflectVisualSerial: number;
  previouslyGrounded: boolean;
  previousJumpSerial: number;
  previouslyAirDodging: boolean;
  previousShieldBreak: ShieldBreak;
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
  previousLedgeState: LedgeState;
  previousLedgeSide: number;
  previousAttackSerial: number;
  previousAttackFrame: number;
  grab: boolean;
  throwRelease: boolean;
  charge: boolean;
  ready: boolean;
  ledgeCatch: boolean;
  ledgeRecovery: boolean;
  /** The ledge lip a catch or recovery happened at; kept until the next one. */
  ledgeX: number;
  ledgeZ: number;
  hit: boolean;
  electric: boolean;
  element: HitElement;
  strength: number;
  /** The hit's sound tier (presentation/moveTiers.ts): its attacker's move class, else its launch strength. */
  tier: number;
  /** The tier of a swing reaching its first active frame this frame; -1 for none. */
  swing: number;
  /** The hit's serial, which picks among a tier sound's variants. */
  variant: number;
  pummel: boolean;
  shieldElectric: boolean;
  footstep: "none" | "walk" | "run" | "dash";
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
  jump: JumpCue;
  /** Where the latest jump took off; kept until the next one. */
  jumpOriginX: number;
  jumpOriginZ: number;
  character: Character;
  facing: number;
  koDirectionX: number;
  koDirectionZ: number;
  landing: ImpactLanding;
  dodge: DodgeCue;
  direction: number;
  x: number;
  z: number;
  surface: SurfaceContact;
  surfaceMissedTech: boolean;
  /** The latest wall or ceiling contact and its inward normal; kept until the next one. */
  contactX: number;
  contactZ: number;
  normalX: number;
  normalZ: number;
}

export function createImpactEvents(): ImpactEvents {
  return {
    previousDown: DownState.none, previouslyOut: false, previousGroundDodge: 0,
    previousSurfaceContactSerial: 0, previousHitVisualSerial: 0, previousFrozenFrames: 0, previousShieldVisualSerial: 0,
    previousShieldReflectVisualSerial: 0, previouslyGrounded: true, previousJumpSerial: 0,
    previouslyAirDodging: false, previousShieldBreak: ShieldBreak.none, previousDashFrame: 0,
    previousX: 0.0, previousZ: 0.0, previousVelocityX: 0.0, previousDownFrame: 0,
    previousGrabVisualSerial: 0, previousThrowVisualSerial: 0, previouslyCharging: false,
    previousChargeFrames: 0, previousLedgeSerial: 0, previousLedgeState: LedgeState.none,
    previousLedgeSide: 0, previousAttackSerial: 0, previousAttackFrame: 0, grab: false, throwRelease: false, charge: false, ready: false,
    ledgeCatch: false, ledgeRecovery: false, ledgeX: 0.0, ledgeZ: 0.0, hit: false, electric: false,
    element: HitElement.normal, strength: 0, tier: 0, swing: -1, variant: 0, pummel: false, shieldElectric: false, footstep: "none",
    shieldHit: false, shieldReflect: false, shieldBreak: false, ordinaryLanding: false,
    movementDust: false, runningDust: false, launchTrail: false, dodgeTrail: false, airDodge: false,
    respawn: false, jump: JumpCue.none, jumpOriginX: 0.0, jumpOriginZ: 0.0, character: 0, facing: 1,
    koDirectionX: 0, koDirectionZ: 0, landing: ImpactLanding.none, dodge: DodgeCue.none, direction: 0, x: 0.0, z: 0.0,
    surface: SurfaceContact.none, surfaceMissedTech: false, contactX: 0.0, contactZ: 0.0,
    normalX: 0.0, normalZ: 0.0,
  };
}

/** Records the fighter before its frame executes and clears the previous frame's cues. */
export function captureImpactEventsBefore(events: ImpactEvents, fighter: Readonly<Fighter>): void {
  events.previousDown = fighter.down.state;
  events.previouslyOut = fighter.status.out;
  events.previousGroundDodge = fighter.dodge.groundFrame;
  events.previousSurfaceContactSerial = fighter.surfaceRecovery.contactSerial;
  events.previousHitVisualSerial = fighter.visuals.hit;
  events.previousFrozenFrames = fighter.status.frozenFrames;
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
  events.previousAttackSerial = fighter.attack.serial;
  events.previousAttackFrame = fighter.attack.frame;
  events.grab = false;
  events.throwRelease = false;
  events.charge = false;
  events.ready = false;
  events.ledgeCatch = false;
  events.ledgeRecovery = false;
  events.hit = false;
  events.electric = false;
  events.pummel = false;
  events.footstep = "none";
  events.shieldHit = false;
  events.shieldReflect = false;
  events.shieldBreak = false;
  events.ordinaryLanding = false;
  events.movementDust = false;
  events.runningDust = false;
  events.launchTrail = false;
  events.dodgeTrail = false;
  events.airDodge = false;
  events.respawn = false;
  events.swing = -1;
  events.jump = JumpCue.none;
  events.koDirectionX = 0;
  events.koDirectionZ = 0;
  events.landing = ImpactLanding.none;
  events.dodge = DodgeCue.none;
  events.direction = 0;
  events.surface = SurfaceContact.none;
  events.surfaceMissedTech = false;
}

/** The tier of the attack that last hit the fighter, while its attacker is still in it; undefined otherwise. */
function hitTier(fighter: Readonly<Fighter>, world: Readonly<Roster> | undefined): number | undefined {
  const { lastAttacker, lastAttackSerial } = fighter.hits;
  if (world === undefined || lastAttacker === undefined || !isActive(world, lastAttacker)) return undefined;
  const attacker = fighterAt(world, lastAttacker);
  const { style, serial } = attacker.attack;
  return style === undefined || serial !== lastAttackSerial ? undefined : moveTier(attacker.character, style);
}

/**
 * Derives the cues of the frame that just executed. Out fighters, and the
 * frame they return, raise none. The roster, when given, names each hit's
 * attacker for its sound tier.
 */
export function finishImpactEventsAfter(events: ImpactEvents, fighter: Readonly<Fighter>, world?: Readonly<Roster>): void {
  const { motion, status, ground, surfaceRecovery, visuals, jump, launch, shield, down, attack, ledge, dodge } = fighter;
  events.character = fighter.character;
  events.facing = fighter.facing;
  events.x = motion.x;
  events.z = motion.z;
  events.direction = motion.x < events.previousX ? -1 : motion.x > events.previousX ? 1 : fighter.facing;
  events.respawn = events.previouslyOut && !status.out;
  if (!events.previouslyOut && status.out) {
    if (motion.x <= -SIDE_KO_X || motion.x >= SIDE_KO_X) events.koDirectionX = motion.x < 0.0 ? -1 : 1;
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
  const present = !events.previouslyOut && !status.out;
  if (present) {
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
  events.hit = present && visuals.hit !== events.previousHitVisualSerial;
  events.electric = events.hit && visuals.hitElectric;
  events.element = visuals.hitElement;
  events.strength = visuals.hitStrength;
  events.tier = events.hit ? hitTier(fighter, world) ?? visuals.hitStrength : events.tier;
  events.variant = visuals.hit;
  events.pummel = events.hit && visuals.hitPummel;
  if (present && events.previousFrozenFrames === 0 && status.frozenFrames > 0) {
    events.hit = true;
    events.element = HitElement.ice;
    events.electric = false;
    events.pummel = false;
    events.strength = 0;
    events.tier = 0;
  }
  // A swing sounds once, on its first active frame; a hitlag freeze holds that frame.
  const { style } = attack;
  if (present && style !== undefined && style !== AttackStyle.grab && style !== AttackStyle.shot && !attack.dashGrab
    && (attack.serial !== events.previousAttackSerial || attack.frame !== events.previousAttackFrame) && attack.frame === attackStartup(fighter, style)) {
    events.swing = moveTier(fighter.character, style);
  }
  events.shieldElectric = visuals.shieldElectric;
  events.shieldHit = present && visuals.shield !== events.previousShieldVisualSerial;
  events.shieldReflect = present && visuals.shieldReflect !== events.previousShieldReflectVisualSerial;
  events.shieldBreak = present && events.previousShieldBreak === ShieldBreak.none && shield.breakState !== ShieldBreak.none;
  events.ordinaryLanding = present && !events.previouslyGrounded && motion.grounded && down.state === DownState.none;
  if (present && jump.serial !== events.previousJumpSerial && !events.ledgeRecovery) {
    events.jump = surfaceRecovery.state === SurfaceContact.techWall ? JumpCue.wall
      : jump.isDouble ? JumpCue.double : events.previouslyGrounded ? JumpCue.ground : JumpCue.air;
    if (events.jump === JumpCue.wall) {
      events.contactX = surfaceRecovery.contactX;
      events.contactZ = surfaceRecovery.contactZ;
      events.normalX = surfaceRecovery.contactNormalX;
      events.normalZ = surfaceRecovery.contactNormalZ;
    }
    events.jumpOriginX = events.previousX;
    events.jumpOriginZ = events.previousZ;
  }
  events.airDodge = present && !events.previouslyAirDodging && dodge.airDodging;
  if (present && launch.hitlag === 0) {
    const moved = Math.abs(f32(motion.x - events.previousX)) > f32(0.1) || Math.abs(f32(motion.z - events.previousZ)) > f32(0.1);
    if (motion.grounded && down.state === DownState.none && !isGroundDodging(fighter)) {
      const reversed = f32(events.previousVelocityX * motion.vx) < 0;
      const slowed = Math.abs(events.previousVelocityX) > f32(Math.abs(motion.vx) + f32(0.1));
      events.movementDust = (ground.dashFrame === 1 && events.previousDashFrame !== 1) || (moved && (reversed || slowed));
      events.runningDust = moved && Math.abs(motion.vx) > fighter.tuning.physics.walkSpeed;
      if (ground.dashFrame === 1 && events.previousDashFrame !== 1) events.footstep = "dash";
      else if (moved && attack.style === undefined && fighter.grab.target === undefined) {
        const cadence = events.runningDust ? 8 : 16;
        if (imod(ground.actionFrame, cadence) === 1) events.footstep = events.runningDust ? "run" : "walk";
      }
    }
    const groundDodgeStep = dodge.groundFrame > events.previousGroundDodge && imod(dodge.groundFrame, 4) === 0;
    const downRollStep = (down.state === DownState.roll || down.state === DownState.techRoll)
      && down.frame > events.previousDownFrame && imod(down.frame, 4) === 0;
    events.dodgeTrail = moved && (groundDodgeStep || downRollStep);
    events.launchTrail = !motion.grounded && isTumbling(fighter) && moved
      && down.frame > events.previousDownFrame && imod(down.frame, 3) === 0
      && f32(Math.abs(launch.knockbackX) + Math.abs(launch.knockbackZ)) > WORLD_UNITS_PER_MELEE_UNIT;
  }
  if (present && events.previousDown !== down.state) {
    if (isFloorTeching(fighter)) events.landing = ImpactLanding.tech;
    else if (down.state === DownState.bound) events.landing = ImpactLanding.missedTech;
    if (down.state === DownState.roll || down.state === DownState.techRoll) {
      events.dodge = DodgeCue.roll;
      events.direction = down.direction;
    }
  }
  if (present && events.previousGroundDodge === 0 && dodge.groundFrame > 0) {
    events.direction = dodge.groundDirection;
    events.dodge = events.direction === 0 ? DodgeCue.spot : DodgeCue.roll;
  }
}

/**
 * The renderer presents completed frames only, each once. Replay never calls
 * the renderer; beginning a new match resets this cursor.
 */
export interface ImpactPresentationCursor {
  lastFrame: number | undefined;
}

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
