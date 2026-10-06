// Fighter-owned records, construction and copying stay together so every
// mutable rollback field can be reviewed against the complete Fighter type.
// A fighter's complete simulation state as plain data. References to other
// fighters are participant slots, so a rollback snapshot is a field-by-field
// copy and code can be replaced while state is kept. Replay checksums write
// an absent slot or surface as -1 at that boundary.
import { type TechInput, emptyTechInput } from "../physics/techInput";
import {
  type AttackStyle,
  Character,
  DownState,
  GrabAction,
  GroundAction,
  HippogryphKind,
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
import { ROSTER_MANA } from "./mana";
import { HitElement } from "./hitRegions";
import type { SpecialPlacement, SpecialProjectile } from "./heroSpecials";

export const PROJECTILE_CAPACITY = 16;
export const SHIELD_MAX = 60.0;
// Common NTSC 1.02 input counters; the shield geometry is Smashcraft's own.
export const SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES = 2;
export const FAST_FALL_INPUT_WINDOW = 4;
/** PlCo +0x468: a platform drop needs down pressed fewer input frames ago than this. */
export const PLATFORM_DROP_INPUT_WINDOW = 6;
export const WALL_TECH_JUMP_INPUT_WINDOW_FRAMES = 20;
/** PlCo +0x770: a wall jump needs the stick to have crossed the horizontal smash deadzone fewer input frames ago than this. */
export const WALL_JUMP_FLICK_FRAMES = 3;
const STARTING_STOCKS = 3;
/** A tech press age that is never inside a window; the input driver saturates at 255. */

/**
 * A position or velocity kept in Melee units alongside its rounded world value.
 * Original-unit accumulation survives the projection; a published value that no
 * longer matches the world field identifies an intervening world write.
 */
export interface MeleeMotionValue {
  original: number;
  published: number;
}

interface Motion {
  x: number;
  z: number;
  /** The last completed movement step, sampled by synchronous contact resolution. */
  deltaX: number;
  deltaZ: number;
  vx: number;
  vz: number;
  meleeX: MeleeMotionValue;
  meleeZ: MeleeMotionValue;
  meleeVelocityZ: MeleeMotionValue;
  grounded: boolean;
  /** The platform under a grounded fighter. */
  surface: number | undefined;
  crouching: boolean;
  fastFalling: boolean;
  fastFallDownHeld: boolean;
  /** Input frames since down was pressed, Melee's one stick timer for fast-falls and platform drops; ages past the longer window are equivalent. */
  fastFallInputAge: number;
  /** The side of Melee's horizontal smash deadzone the stick was past on the previous input frame: -1, 0 or 1. */
  previousStickSide: number;
  /** Input frames since the stick crossed that deadzone to its current side (Melee's stick-x timer); ages past the wall-jump flick window are equivalent. */
  stickSideAge: number;
  /** The last air-steering direction; a neutral aerial special turns to it. */
  lastAerialTapDirection: number;
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
  /** Frames in which a late dash-to-guard entry still turns a grab into a dash grab. */
  dashGrabWindow: number;
}

interface Jump {
  /** Input frames since jump was pressed, for wall-tech jumps. */
  inputAge: number;
  remaining: number;
  serial: number;
  isDouble: boolean;
  squat: number;
  /** Frames since a ground jump left the deck, takeoff counting as 1, through EARLY_ASCENT_GRAB_FRAMES; 0 otherwise (#107). */
  ascent: number;
  held: boolean;
  /** An air dodge pressed during jump squat, taken on the takeoff frame. */
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
  /** Frames since the last launch; merging only distinguishes ages below ten. */
  knockbackAge: number | undefined;
  damageLevel: number;
  hitstun: number;
  /** The current hitstun came from a throw; grabs cannot extend it. */
  throwHitstun: boolean;
  hitlag: number;
  diPending: boolean;
  diLaunchSpeed: number;
  diSerial: number;
  diAngleDegrees: number;
  sdiWasGrounded: boolean;
  sdiLaunchesUpward: boolean;
  sdiSerial: number;
  asdiSerial: number;
  /** Bounded SDI in Melee units: travel charged this hit and this string, and the queued requests (smashDirectionalInfluence.ts). */
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
  /** Analog pressure scale in [0, 1]; digital is 1. */
  strength: number;
  energy: number;
  stun: number;
  heldFrames: number;
  releaseLag: number;
  /** Shield contact motion, separate from launch velocity. */
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
  /** A parry's reward while the shield stays held: it drops without release lag into any grounded option. */
  perfectActionFrames: number;
  /** A red parry was already pressed in this shieldstun: one try per blocked hit, so mashing earns nothing. */
  redParryTried: boolean;
  parryBuffer: ParryBuffer;
  /** The buffered ground dodge's direction: 0 spot dodge, otherwise the roll's. */
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
  /** Frames before any new action, set by attacks, specials and traps. */
  cooldown: number;
  smashCharging: boolean;
  smashChargeFrames: number;
  smashChargeAllowed: boolean;
}

/** One attacker's latest contact with this fighter; eligibility for that attack's later windows. */
interface HitEntry {
  attacker: number | undefined;
  attackSerial: number;
  window: number;
}

interface HitRegistry {
  readonly entries: HitEntry[];
  /** The latest contact, for diagnostics. */
  lastAttacker: number | undefined;
  lastAttackSerial: number | undefined;
  lastWindow: number;
}

/** Presentation counters: each increment is one event to show. */
interface VisualSerials {
  grab: number;
  throw: number;
  hit: number;
  hitElectric: boolean;
  hitElement: HitElement;
  hitStrength: number;
  hitPummel: boolean;
  shieldElectric: boolean;
  shield: number;
  shieldReflect: number;
  parry: number;
  /** Hero specials refused for want of mana, once per press. */
  manaDenied: number;
}

interface Special {
  action: SpecialAction;
  frame: number;
  duration: number;
  lockFrames: number;
  /** Up-specials end in a helpless fall until landing or a ledge catch. */
  fall: boolean;
  /** Indexed by SpecialAction. */
  readonly cooldowns: number[];
  direction: number;
  hit: boolean;
  /** Targets this action has already struck. */
  readonly hitTargets: (number | undefined)[];
  /** A hero special's authored form (SpecialForm), captured on entry. */
  form: number;
  /** The stick on entry, world-relative: -1, 0 or 1 on each axis. */
  aimX: number;
  aimZ: number;
  /** Hero specials used this airtime, one bit per SpecialSlot. */
  airtimeUses: number;
  /** The special frame a hero command grab caught on; 0 before a catch. */
  grabFrame: number;
  /** This action's guard has already succeeded. */
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
  /** Reflected this frame; it moves from the next frame. */
  newlyReflected: boolean;
  /** A hero projectile's authored record; immutable and shared like tuning. */
  spec: SpecialProjectile | undefined;
}

/** Summons keep their last values when they expire; snapshots and checksums include them. */
interface Bear {
  life: number;
  x: number;
  z: number;
  velocityX: number;
  velocityZ: number;
  swipeCooldown: number;
  hitSerial: number;
  surface: number | undefined;
}

interface Hippogryph {
  life: number;
  x: number;
  z: number;
  velocityX: number;
  velocityZ: number;
  kind: HippogryphKind;
}

interface FreezeTrap {
  life: number;
  arming: number;
  x: number;
  z: number;
  surface: number | undefined;
  serial: number;
  /** The owner's frames before another trap. */
  cooldown: number;
}

interface Dodge {
  airDodging: boolean;
  airFrame: number;
  /** The airtime's one air dodge is spent; landing, a ledge catch or a hit refreshes it. */
  airUsed: boolean;
  /** Frames of decaying air dodge motion left. */
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
  /** A get-up attack pressed during the bound, which Melee starts as the bound ends. */
  attackQueued: boolean;
}

/** Tech input ages; they continue through frozen input frames. */
interface Tech extends TechInput {
  window: number;
}

/** Wall and ceiling contacts and the techs that recover from them. */
interface SurfaceRecovery {
  state: SurfaceContact;
  frame: number;
  velocityApplied: boolean;
  wallJumpQueued: boolean;
  /** Earlier wall jumps since landing when this one began; each lowers its rise. */
  wallJumpRepeat: number;
  /** Frames since the fighter met a wall on wallJumpSide fast enough to wall jump off it, while it stays against it. */
  wallJumpAge: number | undefined;
  /** The side of the fighter that wall is on: -1 left, 1 right. */
  wallJumpSide: number;
  /** Wall jumps since the fighter last stood on the ground. */
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
  /** Pummels this hold has started. */
  pummels: number;
  /** Frames left before a held fighter breaks free. */
  grabbedFrames: number;
  /** Frames a held fighter has been held, which bound how soon mashing frees it. */
  heldFrames: number;
  /** A throw pressed during the pummel, which starts when the pummel ends. */
  queuedThrow: GrabAction;
  action: GrabAction;
  frame: number;
  serial: number;
  mashX: number;
  mashZ: number;
  owner: number | undefined;
  target: number | undefined;
}

/**
 * A move through a pass-through platform (platformMoves.ts). Positions are
 * kept from the platform's left end and top, so a moving platform carries the
 * fighter; the inputs are latched over the move.
 */
interface PlatformTransit {
  move: PlatformMove;
  frame: number;
  duration: number;
  deck: number | undefined;
  fromX: number;
  toX: number;
  fromZ: number;
  toZ: number;
  /** The vertical velocity an ascent carries out. */
  rise: number;
  /** Down or shield held or pressed during an ascent: it ends standing or shielding on the platform. */
  stand: boolean;
  shield: boolean;
  /** Half-circle progress toward each side while airborne, 0 to 3 steps, and frames since its first step. */
  wrapLeft: number;
  wrapLeftAge: number;
  wrapRight: number;
  wrapRightAge: number;
  /** An air dodge or special pressed during a descent, taken on its first free frame. */
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
}

/** A stage cannon (stageHazards.ts) holding this fighter, and its catch immunity after a shot. */
interface StageCannon {
  /** Frames since the cannon caught this fighter, while it holds it. */
  held: number | undefined;
  /** Frames since the cannon began its shot, while it holds this fighter. */
  firing: number | undefined;
  /** Frames before a cannon can catch this fighter again. */
  cooldown: number;
}

interface Status {
  offscreenFrames: number;
  damage: number;
  stocks: number;
  respawn: number;
  out: boolean;
  invincible: number;
  frozenFrames: number;
  /** Frames until another trap may catch a fighter after its ice breaks. */
  freezeImmunityFrames: number;
  /** Frames of hero armor left, and the largest hit it absorbs. */
  armorFrames: number;
  armorMaxDamage: number;
  /** The armor chills the melee striker whose hit spends it (Lich's Frost Armor). */
  armorChills: boolean;
  /** A hero status (HeroStatusKind), its frames left, its immunity group and the immunity it grants on ending. */
  condition: number;
  conditionFrames: number;
  conditionGroup: number;
  conditionImmunityFrames: number;
  /** Frames of immunity left per HeroStatusGroup. */
  readonly conditionImmunity: number[];
  /** Poison, beside the condition: frames left, ticks every this many frames, damage per tick. */
  poisonFrames: number;
  poisonEvery: number;
  poisonDamage: number;
  /** Frames of Divine Shield left: intangible to strikes and projectiles, not grabs, until the fighter attacks (Uther, #131). */
  divineFrames: number;
  /** Damage percent hero guards and returning projectiles restored this stock. */
  guardHealed: number;
}

/** Every fighter's resource for specials (sim/mana.ts). */
interface Mana {
  points: number;
  /** Trickle progress toward the next point. */
  progress: number;
}

/** A hero's one placed object (sim/placedObjects.ts); `life` 0 when none stands. */
interface PlacedObject {
  life: number;
  /** Frames since placement. */
  age: number;
  x: number;
  z: number;
  /** The facing it fires along. */
  direction: number;
  durability: number;
  /** Counts placements, so presentation never replays one. */
  serial: number;
  /** Its authored record; immutable and shared like tuning. */
  spec: SpecialPlacement | undefined;
  /** The attack serial each participant last struck it with. */
  readonly struck: (number | undefined)[];
  /** One bit per participant whose running special has struck it. */
  specialStruck: number;
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
  readonly projectiles: readonly Projectile[];
  readonly bear: Bear;
  readonly hippogryph: Hippogryph;
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
  readonly status: Status;
  readonly mana: Mana;
  readonly placed: PlacedObject;
}

const repeat = <T>(count: number, make: () => T): T[] => Array.from({ length: count }, () => make());

function emptyProjectile(): Projectile {
  return {
    life: 0,
    x: 0.0,
    z: 0.0,
    direction: 0,
    kind: ProjectileKind.blaster,
    visualFamily: Character.archer,
    velocityX: 0.0,
    velocityZ: 0.0,
    serial: 0,
    damageMultiplier: 1.0,
    newlyReflected: false,
    spec: undefined,
  };
}

/** A fighter standing at startX with the Wurst constructor's initial state. */
export function createFighter(character: Character, startX: number, facing: number): Fighter {
  const tuning = authoredTuning(character);
  return {
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
      lastAerialTapDirection: 0,
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
    visuals: { grab: 0, throw: 0, hit: 0, hitElectric: false, hitElement: HitElement.normal, hitStrength: 0, hitPummel: false, shieldElectric: false, shield: 0, shieldReflect: 0, parry: 0, manaDenied: 0 },
    special: {
      action: SpecialAction.none,
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
    bear: { life: 0, x: 0.0, z: 0.0, velocityX: 0.0, velocityZ: 0.0, swipeCooldown: 0, hitSerial: 0, surface: undefined },
    hippogryph: { life: 0, x: 0.0, z: 0.0, velocityX: 0.0, velocityZ: 0.0, kind: HippogryphKind.none },
    freezeTrap: { life: 0, arming: 0, x: 0.0, z: 0.0, surface: undefined, serial: 0, cooldown: 0 },
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
    ledge: { state: LedgeState.none, side: 0, frame: 0, serial: 0, intangible: 0, regrab: 0 },
    platform: {
      move: PlatformMove.none, frame: 0, duration: 0, deck: undefined, fromX: 0.0, toX: 0.0, fromZ: 0.0, toZ: 0.0, rise: 0.0,
      stand: false, shield: false, wrapLeft: 0, wrapLeftAge: 0, wrapRight: 0, wrapRightAge: 0, dodgeQueued: false, dodgeX: 0, dodgeZ: 0, specialQueued: false, specialX: 0, specialZ: 0,
    },
    cannon: { held: undefined, firing: undefined, cooldown: 0 },
    status: { offscreenFrames: 0, damage: 0.0, stocks: STARTING_STOCKS, respawn: 0, out: false, invincible: 0, frozenFrames: 0, freezeImmunityFrames: 0, armorFrames: 0, armorMaxDamage: 0.0, armorChills: false, condition: 0, conditionFrames: 0, conditionGroup: 0, conditionImmunityFrames: 0, conditionImmunity: [0, 0, 0], guardHealed: 0.0, divineFrames: 0, poisonFrames: 0, poisonEvery: 0, poisonDamage: 0.0 },
    mana: { points: ROSTER_MANA.max, progress: 0 },
    placed: { life: 0, age: 0, x: 0.0, z: 0.0, direction: 1, durability: 0.0, serial: 0, spec: undefined, struck: repeat<number | undefined>(PARTICIPANT_CAPACITY, () => undefined), specialStruck: 0 },
  };
}
