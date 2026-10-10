




// Replay checksums serialize an absent fighter slot or surface as -1.
import { type TechInput, emptyTechInput } from "../physics/techInput";
import { at } from "wisp/src/runtime/lookup";
import {
  type AttackStyle,
  Character,
  DownState,
  GrabAction,
  GroundAction,
  LedgeState,
  ParryBuffer,
  PlatformMove,
  ProjectileKind,
  SPECIAL_ACTION_CAPACITY,
  ShieldBreak,
  SpecialAction,
  SurfaceContact,
} from "./codes";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type FighterTuning, authoredTuning } from "./tuning";
import { HitElement } from "./hitRegions";
import { initializeInfluenceOperands } from "./influenceOperands";
import type { SpecialPlacement, SpecialProjectile } from "./heroSpecials";

export const PROJECTILE_CAPACITY = 16;
export const SHIELD_MAX = 60.0;

export const SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES = 2;
export const FAST_FALL_INPUT_WINDOW = 4;
/** PlCo +0x468: a platform drop needs down pressed fewer input frames ago than this. */
export const PLATFORM_DROP_INPUT_WINDOW = 6;
/** Frames after platform contact whose stick still chooses stand or drop (smashcraft:docs/gameplay-design.md, "Platforms"). */
export const PLATFORM_INTENT_FRAMES = 3;
export const WALL_TECH_JUMP_INPUT_WINDOW_FRAMES = 20;
/** PlCo +0x770: a wall jump needs the stick to have crossed the horizontal smash deadzone fewer input frames ago than this. */
export const WALL_JUMP_FLICK_FRAMES = 3;
/** A neutral special faces the side the stick last pressed at most this many input frames before it (smashcraft:docs/gameplay-design.md, "Turnaround specials"). */
export const TURNAROUND_SPECIAL_WINDOW_FRAMES = 8;
const STARTING_STOCKS = 3;







export interface MeleeMotionValue {
  original: number;
  published: number;
}

interface Motion {
  x: number;
  z: number;

  deltaX: number;
  deltaZ: number;
  vx: number;
  vz: number;
  meleeX: MeleeMotionValue;
  meleeZ: MeleeMotionValue;
  meleeVelocityZ: MeleeMotionValue;
  grounded: boolean;

  surface: number | undefined;
  crouching: boolean;
  fastFalling: boolean;
  fastFallDownHeld: boolean;

  fastFallInputAge: number;

  previousStickSide: number;

  stickSideAge: number;

  turnaroundSide: number;

  turnaroundAge: number;
}

interface GroundMovement {
  dashFrame: number;
  dashDirection: number;
  action: GroundAction;
  actionFrame: number;
  runBrakeFramesRemaining: number;
  turnRunEntryFacing: number;
  turnRunFacingCommandLatched: boolean;
  turnRunPausePending: boolean;

  dashGrabWindow: number;
}

interface Jump {

  inputAge: number;
  remaining: number;
  serial: number;
  isDouble: boolean;
  squat: number;

  ascent: number;
  held: boolean;

  dodgeQueued: boolean;
  dodgeX: number;
  dodgeZ: number;
}

interface Launch {
  knockbackX: number;
  knockbackZ: number;
  meleeKnockbackX: MeleeMotionValue;
  meleeKnockbackZ: MeleeMotionValue;
  groundKnockbackX: number;

  knockbackAge: number | undefined;
  damageLevel: number;
  hitstun: number;

  throwHitstun: boolean;
  hitlag: number;
  hitlagFrames: number;
  hitlagEndAge: number;
  sdiFollowup: boolean;
  diPending: boolean;
  diLaunchSpeed: number;
  diSerial: number;
  diAngleDegrees: number;
  sdiWasGrounded: boolean;
  sdiLaunchesUpward: boolean;
  sdiSerial: number;
  asdiSerial: number;

  sdiHitTravel: number;
  sdiStringTravel: number;
  sdiStepX: number;
  sdiStepZ: number;
  sdiStepTravel: number;
  sdiNextX: number;
  sdiNextZ: number;
  sdiNextTravel: number;
}

interface Shield {
  raised: boolean;
  tiltX: number;
  tiltZ: number;

  strength: number;
  energy: number;
  stun: number;
  heldFrames: number;
  releaseLag: number;

  pushbackX: number;
  recoilX: number;
  recoilZ: number;
  meleeRecoilX: MeleeMotionValue;
  meleeRecoilZ: MeleeMotionValue;
  drainResumePending: boolean;
  triggerWasActive: boolean;
  triggerAge: number;
  reflectFrames: number;
  perfectFrames: number;

  perfectActionFrames: number;

  redParryTried: boolean;
  parryBuffer: ParryBuffer;

  parryBufferDirection: number;
  breakState: ShieldBreak;
  breakFrame: number;
  breakSerial: number;
  breakRemaining: number;
}

interface Attack {
  style: AttackStyle | undefined;
  frame: number;
  duration: number;
  serial: number;
  hit: boolean;
  dashGrab: boolean;
  pivotGrab: boolean;

  cooldown: number;
  smashCharging: boolean;
  smashChargeFrames: number;
  smashChargeAllowed: boolean;
}


interface HitEntry {
  attacker: number | undefined;
  attackSerial: number;
  window: number;
}

interface HitRegistry {
  readonly entries: HitEntry[];

  lastAttacker: number | undefined;
  lastAttackSerial: number | undefined;
  lastWindow: number;
}


interface VisualSerials {
  grab: number;
  throw: number;
  hit: number;
  hitElectric: boolean;
  hitElement: HitElement;
  hitStrength: number;
  hitStrong: boolean;

  hitHeight: number;
  hitPummel: boolean;
  shieldElectric: boolean;
  shield: number;
  shieldReflect: number;

  manaDrained: number;

  manaDenied: number;
}

interface Special {
  action: SpecialAction;
  ex: boolean;
  exArmorUsed: boolean;
  frame: number;
  duration: number;
  lockFrames: number;

  fall: boolean;

  readonly cooldowns: number[];
  direction: number;
  hit: boolean;

  readonly hitTargets: (number | undefined)[];

  form: number;

  aimX: number;
  aimZ: number;

  airtimeUses: number;

  grabFrame: number;

  guarded: boolean;
}

export interface Projectile {
  life: number;
  x: number;
  z: number;
  direction: number;
  kind: ProjectileKind;
  visualFamily: Character;
  velocityX: number;
  velocityZ: number;
  serial: number;
  damageMultiplier: number;

  newlyReflected: boolean;
  exReach: boolean;

  poolHits: number;

  poolWait: number;

  spec: SpecialProjectile | undefined;
}


interface Bear {
  exDamage: boolean;
  life: number;
  x: number;
  z: number;
  velocityX: number;
  velocityZ: number;
  swipeCooldown: number;
  hitSerial: number;
  surface: number | undefined;
}

interface FreezeTrap {
  exReach: boolean;
  life: number;
  arming: number;
  x: number;
  z: number;
  surface: number | undefined;
  serial: number;

  cooldown: number;
}

interface Dodge {
  airDodging: boolean;
  airFrame: number;

  airUsed: boolean;

  airMotionFrames: number;
  groundFrame: number;
  groundDirection: number;
  groundEntryFacing: number;
}

interface Landing {
  lag: number;
}

interface Down {
  state: DownState;
  frame: number;
  direction: number;
  waitRemaining: number;
  faceUp: boolean;

  attackQueued: boolean;
}


interface Tech extends TechInput {
  window: number;
}


interface SurfaceRecovery {
  state: SurfaceContact;
  frame: number;
  velocityApplied: boolean;
  wallJumpQueued: boolean;

  wallJumpRepeat: number;

  wallJumpAge: number | undefined;

  wallJumpSide: number;

  wallJumpsUsed: number;
  reflectCooldown: number;
  lastReflectedSurface: number | undefined;
  contactSerial: number;
  contactKind: SurfaceContact;
  contactApproachSpeed: number;
  contactX: number;
  contactZ: number;
  contactNormalX: number;
  contactNormalZ: number;
}

interface Grab {

  pummels: number;

  grabbedFrames: number;

  heldFrames: number;

  queuedThrow: GrabAction;
  action: GrabAction;
  frame: number;
  serial: number;
  mashX: number;
  mashZ: number;
  owner: number | undefined;
  target: number | undefined;
}






interface PlatformTransit {
  move: PlatformMove;
  frame: number;
  duration: number;
  deck: number | undefined;
  fromX: number;
  toX: number;
  fromZ: number;
  toZ: number;

  rise: number;

  stand: boolean;
  shield: boolean;

  landedFrames: number;

  dodgeQueued: boolean;
  dodgeX: number;
  dodgeZ: number;
  specialQueued: boolean;
  specialX: number;
  specialZ: number;
}

interface Ledge {
  state: LedgeState;
  side: number;
  frame: number;
  serial: number;
  intangible: number;
  regrab: number;
  grabs: number;
}


interface StageCannon {

  held: number | undefined;

  firing: number | undefined;

  cooldown: number;

  passing: boolean;
}


interface Water {

  inWater: boolean;

  frames: number;

  entries: number;

  hydraFrame: number;

  hydraX: number;

  hydraStrikeFrame: number;
}

interface Status {
  offscreenFrames: number;
  damage: number;
  stocks: number;
  respawn: number;
  out: boolean;
  invincible: number;
  frozenFrames: number;

  freezeImmunityFrames: number;

  armorFrames: number;
  armorMaxDamage: number;

  armorChills: boolean;

  condition: number;
  conditionFrames: number;
  conditionGroup: number;
  conditionImmunityFrames: number;

  readonly conditionImmunity: number[];

  poisonFrames: number;
  poisonEvery: number;
  poisonDamage: number;

  divineFrames: number;


  buff: number;
  buffFrames: number;
}


interface Mana {
  points: number;
}


export interface PlacedObject {
  life: number;

  age: number;
  x: number;
  z: number;

  direction: number;
  durability: number;

  serial: number;

  spec: SpecialPlacement | undefined;

  readonly struck: (number | undefined)[];

  specialStruck: number;

  mode: number;
  modeFrame: number;

  apart: number;

  bitten: number;

  surface: number | undefined;
}

export interface Fighter {
  character: Character;
  tuning: FighterTuning;
  facing: number;
  readonly motion: Motion;
  readonly ground: GroundMovement;
  readonly jump: Jump;
  readonly launch: Launch;
  readonly shield: Shield;
  readonly attack: Attack;
  readonly hits: HitRegistry;
  readonly visuals: VisualSerials;
  readonly special: Special;
  readonly projectiles: Projectile[];
  readonly bear: Bear;
  readonly freezeTrap: FreezeTrap;
  readonly dodge: Dodge;
  readonly landing: Landing;
  readonly down: Down;
  readonly tech: Tech;
  readonly surfaceRecovery: SurfaceRecovery;
  readonly grab: Grab;
  readonly ledge: Ledge;
  readonly platform: PlatformTransit;
  readonly cannon: StageCannon;
  readonly water: Water;
  readonly status: Status;
  readonly mana: Mana;
  readonly placed: PlacedObject;

  readonly pack: PlacedObject[];
}

const repeat = <T>(count: number, make: () => T): T[] => Array.from({ length: count }, () => make());

function emptyProjectile(): Projectile {
  return {
    life: 0,
    x: 0.0,
    z: 0.0,
    direction: 0,
    kind: ProjectileKind.blaster,
    visualFamily: Character.rifleman,
    velocityX: 0.0,
    velocityZ: 0.0,
    serial: 0,
    damageMultiplier: 1.0,
    newlyReflected: false,
    exReach: false,
    poolHits: 0,
    poolWait: 0,
    spec: undefined,
  };
}


export function createFighter(character: Character, startX: number, facing: number): Fighter {
  const tuning = authoredTuning(character);
  const fighter: Fighter = {
    character,
    tuning,
    facing,
    motion: {
      x: startX,
      z: 0.0,
      deltaX: 0.0,
      deltaZ: 0.0,
      vx: 0.0,
      vz: 0.0,
      meleeX: { original: 0.0, published: 0.0 },
      meleeZ: { original: 0.0, published: 0.0 },
      meleeVelocityZ: { original: 0.0, published: 0.0 },
      grounded: true,
      surface: undefined,
      crouching: false,
      fastFalling: false,
      fastFallDownHeld: false,
      fastFallInputAge: PLATFORM_DROP_INPUT_WINDOW,
      previousStickSide: 0,
      stickSideAge: WALL_JUMP_FLICK_FRAMES,
      turnaroundSide: 0,
      turnaroundAge: TURNAROUND_SPECIAL_WINDOW_FRAMES + 1,
    },
    ground: {
      dashFrame: 0,
      dashDirection: 0,
      action: GroundAction.none,
      actionFrame: 0,
      runBrakeFramesRemaining: 0,
      turnRunEntryFacing: 0,
      turnRunFacingCommandLatched: false,
      turnRunPausePending: false,
      dashGrabWindow: 0,
    },
    jump: {
      inputAge: WALL_TECH_JUMP_INPUT_WINDOW_FRAMES,
      remaining: 2,
      serial: 0,
      isDouble: false,
      squat: 0,
      ascent: 0,
      held: false,
      dodgeQueued: false,
      dodgeX: 0,
      dodgeZ: 0,
    },
    launch: {
      knockbackX: 0.0,
      knockbackZ: 0.0,
      meleeKnockbackX: { original: 0.0, published: 0.0 },
      meleeKnockbackZ: { original: 0.0, published: 0.0 },
      groundKnockbackX: 0.0,
      knockbackAge: undefined,
      damageLevel: 0,
      hitstun: 0,
      throwHitstun: false,
      hitlag: 0,
      hitlagFrames: 0,
      hitlagEndAge: 16,
      sdiFollowup: false,
      diPending: false,
      diLaunchSpeed: 0.0,
      diSerial: 0,
      diAngleDegrees: 0.0,
      sdiWasGrounded: false,
      sdiLaunchesUpward: false,
      sdiSerial: 0,
      asdiSerial: 0,
      sdiHitTravel: 0,
      sdiStringTravel: 0,
      sdiStepX: 0,
      sdiStepZ: 0,
      sdiStepTravel: 0,
      sdiNextX: 0,
      sdiNextZ: 0,
      sdiNextTravel: 0,
    },
    shield: {
      raised: false,
      tiltX: 0.0,
      tiltZ: 0.0,
      strength: 1.0,
      energy: SHIELD_MAX,
      stun: 0,
      heldFrames: 0,
      releaseLag: 0,
      pushbackX: 0.0,
      recoilX: 0.0,
      recoilZ: 0.0,
      meleeRecoilX: { original: 0.0, published: 0.0 },
      meleeRecoilZ: { original: 0.0, published: 0.0 },
      drainResumePending: false,
      triggerWasActive: false,
      triggerAge: SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES,
      reflectFrames: 0,
      perfectFrames: 0,
      perfectActionFrames: 0,
      redParryTried: false,
      parryBuffer: ParryBuffer.none,
      parryBufferDirection: 0,
      breakState: ShieldBreak.none,
      breakFrame: 0,
      breakSerial: 0,
      breakRemaining: 0.0,
    },
    attack: {
      style: undefined,
      frame: 0,
      duration: 0,
      serial: 0,
      hit: false,
      dashGrab: false,
      pivotGrab: false,
      cooldown: 0,
      smashCharging: false,
      smashChargeFrames: 0,
      smashChargeAllowed: false,
    },
    hits: {
      entries: repeat(PARTICIPANT_CAPACITY, () => ({ attacker: undefined, attackSerial: 0, window: 0 })),
      lastAttacker: undefined,
      lastAttackSerial: undefined,
      lastWindow: 0,
    },
    visuals: { grab: 0, throw: 0, hit: 0, hitElectric: false, hitElement: HitElement.normal, hitStrength: 0, hitStrong: false, hitHeight: 1, hitPummel: false, shieldElectric: false, shield: 0, shieldReflect: 0, manaDrained: 0, manaDenied: 0 },
    special: {
      action: SpecialAction.none,
      ex: false,
      exArmorUsed: false,
      frame: 0,
      duration: 0,
      lockFrames: 0,
      fall: false,
      cooldowns: repeat(SPECIAL_ACTION_CAPACITY, () => 0),
      direction: 0,
      hit: false,
      hitTargets: repeat<number | undefined>(PARTICIPANT_CAPACITY, () => undefined),
      form: 0,
      aimX: 0,
      aimZ: 0,
      airtimeUses: 0,
      grabFrame: 0,
      guarded: false,
    },
    projectiles: repeat(PROJECTILE_CAPACITY, () => emptyProjectile()),
    bear: { exDamage: false, life: 0, x: 0.0, z: 0.0, velocityX: 0.0, velocityZ: 0.0, swipeCooldown: 0, hitSerial: 0, surface: undefined },
    freezeTrap: { exReach: false, life: 0, arming: 0, x: 0.0, z: 0.0, surface: undefined, serial: 0, cooldown: 0 },
    dodge: { airDodging: false, airFrame: 0, airUsed: false, airMotionFrames: 0, groundFrame: 0, groundDirection: 0, groundEntryFacing: 0 },
    landing: { lag: 0 },
    down: { state: DownState.none, frame: 0, direction: 0, waitRemaining: 0, faceUp: true, attackQueued: false },
    tech: { ...emptyTechInput(), window: 0 },
    surfaceRecovery: {
      state: SurfaceContact.none,
      frame: 0,
      velocityApplied: false,
      wallJumpQueued: false,
      wallJumpRepeat: 0,
      wallJumpAge: undefined,
      wallJumpSide: 0,
      wallJumpsUsed: 0,
      reflectCooldown: 0,
      lastReflectedSurface: undefined,
      contactSerial: 0,
      contactKind: SurfaceContact.none,
      contactApproachSpeed: 0.0,
      contactX: 0.0,
      contactZ: 0.0,
      contactNormalX: 0.0,
      contactNormalZ: 0.0,
    },
    grab: { pummels: 0, grabbedFrames: 0, heldFrames: 0, queuedThrow: GrabAction.none, action: GrabAction.none, frame: 0, serial: 0, mashX: 0, mashZ: 0, owner: undefined, target: undefined },
    ledge: { state: LedgeState.none, side: 0, frame: 0, serial: 0, intangible: 0, regrab: 0, grabs: 0 },
    platform: {
      move: PlatformMove.none, frame: 0, duration: 0, deck: undefined, fromX: 0.0, toX: 0.0, fromZ: 0.0, toZ: 0.0, rise: 0.0,
      stand: false, shield: false, landedFrames: PLATFORM_INTENT_FRAMES + 1, dodgeQueued: false, dodgeX: 0, dodgeZ: 0, specialQueued: false, specialX: 0, specialZ: 0,
    },
    cannon: { held: undefined, firing: undefined, cooldown: 0, passing: false },
    water: { inWater: false, frames: 0, entries: 0, hydraFrame: 0, hydraX: 0.0, hydraStrikeFrame: -1 },
    status: { offscreenFrames: 0, damage: 0.0, stocks: STARTING_STOCKS, respawn: 0, out: false, invincible: 0, frozenFrames: 0, freezeImmunityFrames: 0, armorFrames: 0, armorMaxDamage: 0.0, armorChills: false, condition: 0, conditionFrames: 0, conditionGroup: 0, conditionImmunityFrames: 0, conditionImmunity: [0, 0, 0], divineFrames: 0, poisonFrames: 0, poisonEvery: 0, poisonDamage: 0.0, buff: 0, buffFrames: 0 },
    mana: { points: 0 },
    placed: createPlacedObject(),
    pack: character === Character.beastmaster ? [createPlacedObject(), createPlacedObject()] : [],
  };
  initializeInfluenceOperands(fighter);
  return fighter;
}

export function createPlacedObject(): PlacedObject {
  return { life: 0, age: 0, x: 0.0, z: 0.0, direction: 1, durability: 0.0, serial: 0, spec: undefined, struck: repeat<number | undefined>(PARTICIPANT_CAPACITY, () => undefined), specialStruck: 0, mode: 0, modeFrame: 0, apart: 0, bitten: 0, surface: undefined };
}

export function placedObject(fighter: Readonly<Fighter>, slot = 0): PlacedObject {
  return slot === 0 ? fighter.placed : at(fighter.pack, slot - 1);
}
