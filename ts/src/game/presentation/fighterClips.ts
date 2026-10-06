// The clip table each character's poses play. The original fighters' tables
// come from the packaged asset metadata; each hero registers its own in its
// presentation (sim/heroes/<hero>Hero.ts). Tables only: pose selection lives in
// fighterPose.
import { AttackStyle, Character, GrabAction, LedgeState, PlatformMove, SpecialAction } from "../sim/codes";
import { type HeroClip, type HeroClipTable, type HeroFollowUpPose, type HeroPose, STOCK_FALLBACK_CLIP } from "../sim/heroes/hero";
import { heroDefinition } from "../sim/heroes/registry";
import * as dh from "./demonHunterAssetInfo";
import * as assets from "./fighterAssetInfo";

const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });

// Ledge options: Illidan has his own roll and attack; the others reuse their
// roll and get-up attack. Only Illidan maps smashes and a dash attack.
const ARCHER_CLIPS: HeroClipTable = {
  jab: clip(assets.ARCHER_JAB_INDEX, assets.ARCHER_JAB_SECONDS),
  grab: clip(assets.ARCHER_GRAB_INDEX, assets.ARCHER_GRAB_SECONDS),
  forwardTilt: clip(assets.ARCHER_FORWARD_TILT_INDEX, assets.ARCHER_FORWARD_TILT_SECONDS),
  upTilt: clip(assets.ARCHER_UP_TILT_INDEX, assets.ARCHER_UP_TILT_SECONDS),
  downTilt: clip(assets.ARCHER_DOWN_TILT_INDEX, assets.ARCHER_DOWN_TILT_SECONDS),
  forwardTiltUp: clip(assets.ARCHER_FORWARD_TILT_UP_INDEX, assets.ARCHER_FORWARD_TILT_UP_SECONDS),
  forwardTiltDown: clip(assets.ARCHER_FORWARD_TILT_DOWN_INDEX, assets.ARCHER_FORWARD_TILT_DOWN_SECONDS),
  neutralAir: clip(assets.ARCHER_AERIAL_NEUTRAL_INDEX, assets.ARCHER_AERIAL_NEUTRAL_SECONDS),
  forwardAir: clip(assets.ARCHER_AERIAL_FORWARD_INDEX, assets.ARCHER_AERIAL_FORWARD_SECONDS),
  backAir: clip(assets.ARCHER_AERIAL_BACK_INDEX, assets.ARCHER_AERIAL_BACK_SECONDS),
  upAir: clip(assets.ARCHER_AERIAL_UP_INDEX, assets.ARCHER_AERIAL_UP_SECONDS),
  downAir: clip(assets.ARCHER_AERIAL_DOWN_INDEX, assets.ARCHER_AERIAL_DOWN_SECONDS),
  getUpAttack: clip(assets.ARCHER_GET_UP_ATTACK_INDEX, assets.ARCHER_GET_UP_ATTACK_SECONDS),
  ledgeHang: clip(assets.ARCHER_LEDGE_HANG_INDEX, assets.ARCHER_LEDGE_HANG_SECONDS),
  ledgeClimb: clip(assets.ARCHER_LEDGE_CLIMB_INDEX, assets.ARCHER_LEDGE_CLIMB_SECONDS),
  ledgeRoll: clip(assets.ARCHER_ROLL_FORWARD_INDEX, assets.ARCHER_ROLL_FORWARD_SECONDS),
  ledgeAttack: clip(assets.ARCHER_GET_UP_ATTACK_INDEX, assets.ARCHER_GET_UP_ATTACK_SECONDS),
  knockdown: clip(assets.ARCHER_KNOCKDOWN_INDEX, assets.ARCHER_KNOCKDOWN_SECONDS),
  getUp: clip(assets.ARCHER_GET_UP_INDEX, assets.ARCHER_GET_UP_SECONDS),
  downDamage: clip(assets.ARCHER_DOWN_DAMAGE_INDEX, assets.ARCHER_DOWN_DAMAGE_SECONDS),
  rollForward: clip(assets.ARCHER_ROLL_FORWARD_INDEX, assets.ARCHER_ROLL_FORWARD_SECONDS),
  rollBackward: clip(assets.ARCHER_ROLL_BACKWARD_INDEX, assets.ARCHER_ROLL_BACKWARD_SECONDS),
  spotDodge: clip(assets.ARCHER_SPOT_DODGE_INDEX, assets.ARCHER_SPOT_DODGE_SECONDS),
  jump: clip(assets.ARCHER_JUMP_INDEX, assets.ARCHER_JUMP_SECONDS),
  doubleJump: clip(assets.ARCHER_DOUBLE_JUMP_INDEX, assets.ARCHER_DOUBLE_JUMP_SECONDS),
  fallSpecial: clip(assets.ARCHER_FALL_SPECIAL_INDEX, assets.ARCHER_FALL_SPECIAL_SECONDS),
  damageGround: clip(assets.ARCHER_DAMAGE_GROUND_INDEX, assets.ARCHER_DAMAGE_GROUND_SECONDS),
  damageAir: clip(assets.ARCHER_DAMAGE_AIR_INDEX, assets.ARCHER_DAMAGE_AIR_SECONDS),
  damageTumble: clip(assets.ARCHER_DAMAGE_TUMBLE_INDEX, assets.ARCHER_DAMAGE_TUMBLE_SECONDS),
  damageShield: clip(assets.ARCHER_DAMAGE_SHIELD_INDEX, assets.ARCHER_DAMAGE_SHIELD_SECONDS),
  grabHold: clip(assets.ARCHER_GRAB_HOLD_INDEX, assets.ARCHER_GRAB_HOLD_SECONDS),
  grabbed: clip(assets.ARCHER_GRABBED_INDEX, assets.ARCHER_GRABBED_SECONDS),
  pummel: clip(assets.ARCHER_PUMMEL_INDEX, assets.ARCHER_PUMMEL_SECONDS),
  throwForward: clip(assets.ARCHER_THROW_FORWARD_INDEX, assets.ARCHER_THROW_FORWARD_SECONDS),
  throwBack: clip(assets.ARCHER_THROW_BACK_INDEX, assets.ARCHER_THROW_BACK_SECONDS),
  throwUp: clip(assets.ARCHER_THROW_UP_INDEX, assets.ARCHER_THROW_UP_SECONDS),
  throwDown: clip(assets.ARCHER_THROW_DOWN_INDEX, assets.ARCHER_THROW_DOWN_SECONDS),
  victimPummel: clip(assets.ARCHER_VICTIM_PUMMEL_INDEX, assets.ARCHER_VICTIM_PUMMEL_SECONDS),
  victimThrowForward: clip(assets.ARCHER_VICTIM_THROW_FORWARD_INDEX, assets.ARCHER_VICTIM_THROW_FORWARD_SECONDS),
  victimThrowBack: clip(assets.ARCHER_VICTIM_THROW_BACK_INDEX, assets.ARCHER_VICTIM_THROW_BACK_SECONDS),
  victimThrowUp: clip(assets.ARCHER_VICTIM_THROW_UP_INDEX, assets.ARCHER_VICTIM_THROW_UP_SECONDS),
  victimThrowDown: clip(assets.ARCHER_VICTIM_THROW_DOWN_INDEX, assets.ARCHER_VICTIM_THROW_DOWN_SECONDS),
};

const RIFLEMAN_CLIPS: HeroClipTable = {
  jab: clip(assets.RIFLEMAN_JAB_INDEX, assets.RIFLEMAN_JAB_SECONDS),
  grab: clip(assets.RIFLEMAN_GRAB_INDEX, assets.RIFLEMAN_GRAB_SECONDS),
  forwardTilt: clip(assets.RIFLEMAN_FORWARD_TILT_INDEX, assets.RIFLEMAN_FORWARD_TILT_SECONDS),
  upTilt: clip(assets.RIFLEMAN_UP_TILT_INDEX, assets.RIFLEMAN_UP_TILT_SECONDS),
  downTilt: clip(assets.RIFLEMAN_DOWN_TILT_INDEX, assets.RIFLEMAN_DOWN_TILT_SECONDS),
  forwardTiltUp: clip(assets.RIFLEMAN_FORWARD_TILT_UP_INDEX, assets.RIFLEMAN_FORWARD_TILT_UP_SECONDS),
  forwardTiltDown: clip(assets.RIFLEMAN_FORWARD_TILT_DOWN_INDEX, assets.RIFLEMAN_FORWARD_TILT_DOWN_SECONDS),
  neutralAir: clip(assets.RIFLEMAN_AERIAL_NEUTRAL_INDEX, assets.RIFLEMAN_AERIAL_NEUTRAL_SECONDS),
  forwardAir: clip(assets.RIFLEMAN_AERIAL_FORWARD_INDEX, assets.RIFLEMAN_AERIAL_FORWARD_SECONDS),
  backAir: clip(assets.RIFLEMAN_AERIAL_BACK_INDEX, assets.RIFLEMAN_AERIAL_BACK_SECONDS),
  upAir: clip(assets.RIFLEMAN_AERIAL_UP_INDEX, assets.RIFLEMAN_AERIAL_UP_SECONDS),
  downAir: clip(assets.RIFLEMAN_AERIAL_DOWN_INDEX, assets.RIFLEMAN_AERIAL_DOWN_SECONDS),
  getUpAttack: clip(assets.RIFLEMAN_GET_UP_ATTACK_INDEX, assets.RIFLEMAN_GET_UP_ATTACK_SECONDS),
  ledgeHang: clip(assets.RIFLEMAN_LEDGE_HANG_INDEX, assets.RIFLEMAN_LEDGE_HANG_SECONDS),
  ledgeClimb: clip(assets.RIFLEMAN_LEDGE_CLIMB_INDEX, assets.RIFLEMAN_LEDGE_CLIMB_SECONDS),
  ledgeRoll: clip(assets.RIFLEMAN_ROLL_FORWARD_INDEX, assets.RIFLEMAN_ROLL_FORWARD_SECONDS),
  ledgeAttack: clip(assets.RIFLEMAN_GET_UP_ATTACK_INDEX, assets.RIFLEMAN_GET_UP_ATTACK_SECONDS),
  knockdown: clip(assets.RIFLEMAN_KNOCKDOWN_INDEX, assets.RIFLEMAN_KNOCKDOWN_SECONDS),
  getUp: clip(assets.RIFLEMAN_GET_UP_INDEX, assets.RIFLEMAN_GET_UP_SECONDS),
  downDamage: clip(assets.RIFLEMAN_DOWN_DAMAGE_INDEX, assets.RIFLEMAN_DOWN_DAMAGE_SECONDS),
  rollForward: clip(assets.RIFLEMAN_ROLL_FORWARD_INDEX, assets.RIFLEMAN_ROLL_FORWARD_SECONDS),
  rollBackward: clip(assets.RIFLEMAN_ROLL_BACKWARD_INDEX, assets.RIFLEMAN_ROLL_BACKWARD_SECONDS),
  spotDodge: clip(assets.RIFLEMAN_SPOT_DODGE_INDEX, assets.RIFLEMAN_SPOT_DODGE_SECONDS),
  jump: clip(assets.RIFLEMAN_JUMP_INDEX, assets.RIFLEMAN_JUMP_SECONDS),
  doubleJump: clip(assets.RIFLEMAN_DOUBLE_JUMP_INDEX, assets.RIFLEMAN_DOUBLE_JUMP_SECONDS),
  fallSpecial: clip(assets.RIFLEMAN_FALL_SPECIAL_INDEX, assets.RIFLEMAN_FALL_SPECIAL_SECONDS),
  damageGround: clip(assets.RIFLEMAN_DAMAGE_GROUND_INDEX, assets.RIFLEMAN_DAMAGE_GROUND_SECONDS),
  damageAir: clip(assets.RIFLEMAN_DAMAGE_AIR_INDEX, assets.RIFLEMAN_DAMAGE_AIR_SECONDS),
  damageTumble: clip(assets.RIFLEMAN_DAMAGE_TUMBLE_INDEX, assets.RIFLEMAN_DAMAGE_TUMBLE_SECONDS),
  damageShield: clip(assets.RIFLEMAN_DAMAGE_SHIELD_INDEX, assets.RIFLEMAN_DAMAGE_SHIELD_SECONDS),
  grabHold: clip(assets.RIFLEMAN_GRAB_HOLD_INDEX, assets.RIFLEMAN_GRAB_HOLD_SECONDS),
  grabbed: clip(assets.RIFLEMAN_GRABBED_INDEX, assets.RIFLEMAN_GRABBED_SECONDS),
  pummel: clip(assets.RIFLEMAN_PUMMEL_INDEX, assets.RIFLEMAN_PUMMEL_SECONDS),
  throwForward: clip(assets.RIFLEMAN_THROW_FORWARD_INDEX, assets.RIFLEMAN_THROW_FORWARD_SECONDS),
  throwBack: clip(assets.RIFLEMAN_THROW_BACK_INDEX, assets.RIFLEMAN_THROW_BACK_SECONDS),
  throwUp: clip(assets.RIFLEMAN_THROW_UP_INDEX, assets.RIFLEMAN_THROW_UP_SECONDS),
  throwDown: clip(assets.RIFLEMAN_THROW_DOWN_INDEX, assets.RIFLEMAN_THROW_DOWN_SECONDS),
  victimPummel: clip(assets.RIFLEMAN_VICTIM_PUMMEL_INDEX, assets.RIFLEMAN_VICTIM_PUMMEL_SECONDS),
  victimThrowForward: clip(assets.RIFLEMAN_VICTIM_THROW_FORWARD_INDEX, assets.RIFLEMAN_VICTIM_THROW_FORWARD_SECONDS),
  victimThrowBack: clip(assets.RIFLEMAN_VICTIM_THROW_BACK_INDEX, assets.RIFLEMAN_VICTIM_THROW_BACK_SECONDS),
  victimThrowUp: clip(assets.RIFLEMAN_VICTIM_THROW_UP_INDEX, assets.RIFLEMAN_VICTIM_THROW_UP_SECONDS),
  victimThrowDown: clip(assets.RIFLEMAN_VICTIM_THROW_DOWN_INDEX, assets.RIFLEMAN_VICTIM_THROW_DOWN_SECONDS),
};

const DEMON_HUNTER_CLIPS: HeroClipTable = {
  jab: clip(dh.DEMON_HUNTER_ATTACK_JAB_INDEX, dh.DEMON_HUNTER_ATTACK_JAB_SECONDS),
  grab: clip(dh.DEMON_HUNTER_GRAB_INDEX, dh.DEMON_HUNTER_GRAB_SECONDS),
  forwardTilt: clip(dh.DEMON_HUNTER_FORWARD_TILT_INDEX, dh.DEMON_HUNTER_FORWARD_TILT_SECONDS),
  upTilt: clip(dh.DEMON_HUNTER_UP_TILT_INDEX, dh.DEMON_HUNTER_UP_TILT_SECONDS),
  downTilt: clip(dh.DEMON_HUNTER_DOWN_TILT_INDEX, dh.DEMON_HUNTER_DOWN_TILT_SECONDS),
  forwardTiltUp: clip(dh.DEMON_HUNTER_FORWARD_TILT_UP_INDEX, dh.DEMON_HUNTER_FORWARD_TILT_UP_SECONDS),
  forwardTiltDown: clip(dh.DEMON_HUNTER_FORWARD_TILT_DOWN_INDEX, dh.DEMON_HUNTER_FORWARD_TILT_DOWN_SECONDS),
  neutralAir: clip(dh.DEMON_HUNTER_AERIAL_NEUTRAL_INDEX, dh.DEMON_HUNTER_AERIAL_NEUTRAL_SECONDS),
  forwardAir: clip(dh.DEMON_HUNTER_AERIAL_FORWARD_INDEX, dh.DEMON_HUNTER_AERIAL_FORWARD_SECONDS),
  backAir: clip(dh.DEMON_HUNTER_AERIAL_BACK_INDEX, dh.DEMON_HUNTER_AERIAL_BACK_SECONDS),
  upAir: clip(dh.DEMON_HUNTER_AERIAL_UP_INDEX, dh.DEMON_HUNTER_AERIAL_UP_SECONDS),
  downAir: clip(dh.DEMON_HUNTER_AERIAL_DOWN_INDEX, dh.DEMON_HUNTER_AERIAL_DOWN_SECONDS),
  getUpAttack: clip(dh.DEMON_HUNTER_GET_UP_ATTACK_INDEX, dh.DEMON_HUNTER_GET_UP_ATTACK_SECONDS),
  ledgeHang: clip(dh.DEMON_HUNTER_LEDGE_HANG_INDEX, dh.DEMON_HUNTER_LEDGE_HANG_SECONDS),
  ledgeClimb: clip(dh.DEMON_HUNTER_LEDGE_CLIMB_INDEX, dh.DEMON_HUNTER_LEDGE_CLIMB_SECONDS),
  ledgeRoll: clip(dh.DEMON_HUNTER_LEDGE_ROLL_INDEX, dh.DEMON_HUNTER_LEDGE_ROLL_SECONDS),
  ledgeAttack: clip(dh.DEMON_HUNTER_LEDGE_ATTACK_INDEX, dh.DEMON_HUNTER_LEDGE_ATTACK_SECONDS),
  knockdown: clip(dh.DEMON_HUNTER_KNOCKDOWN_INDEX, dh.DEMON_HUNTER_KNOCKDOWN_SECONDS),
  getUp: clip(dh.DEMON_HUNTER_GET_UP_INDEX, dh.DEMON_HUNTER_GET_UP_SECONDS),
  downDamage: clip(dh.DEMON_HUNTER_DOWN_DAMAGE_INDEX, dh.DEMON_HUNTER_DOWN_DAMAGE_SECONDS),
  rollForward: clip(dh.DEMON_HUNTER_ROLL_FORWARD_INDEX, dh.DEMON_HUNTER_ROLL_FORWARD_SECONDS),
  rollBackward: clip(dh.DEMON_HUNTER_ROLL_BACKWARD_INDEX, dh.DEMON_HUNTER_ROLL_BACKWARD_SECONDS),
  spotDodge: clip(dh.DEMON_HUNTER_SPOT_DODGE_INDEX, dh.DEMON_HUNTER_SPOT_DODGE_SECONDS),
  jump: clip(dh.DEMON_HUNTER_JUMP_INDEX, dh.DEMON_HUNTER_JUMP_SECONDS),
  doubleJump: clip(dh.DEMON_HUNTER_DOUBLE_JUMP_INDEX, dh.DEMON_HUNTER_DOUBLE_JUMP_SECONDS),
  fallSpecial: clip(dh.DEMON_HUNTER_FALL_SPECIAL_INDEX, dh.DEMON_HUNTER_FALL_SPECIAL_SECONDS),
  damageGround: clip(dh.DEMON_HUNTER_DAMAGE_GROUND_INDEX, dh.DEMON_HUNTER_DAMAGE_GROUND_SECONDS),
  damageAir: clip(dh.DEMON_HUNTER_DAMAGE_AIR_INDEX, dh.DEMON_HUNTER_DAMAGE_AIR_SECONDS),
  damageTumble: clip(dh.DEMON_HUNTER_DAMAGE_TUMBLE_INDEX, dh.DEMON_HUNTER_DAMAGE_TUMBLE_SECONDS),
  damageShield: clip(dh.DEMON_HUNTER_DAMAGE_SHIELD_INDEX, dh.DEMON_HUNTER_DAMAGE_SHIELD_SECONDS),
  grabHold: clip(dh.DEMON_HUNTER_GRAB_HOLD_INDEX, dh.DEMON_HUNTER_GRAB_HOLD_SECONDS),
  grabbed: clip(dh.DEMON_HUNTER_GRABBED_INDEX, dh.DEMON_HUNTER_GRABBED_SECONDS),
  pummel: clip(dh.DEMON_HUNTER_PUMMEL_INDEX, dh.DEMON_HUNTER_PUMMEL_SECONDS),
  throwForward: clip(dh.DEMON_HUNTER_THROW_FORWARD_INDEX, dh.DEMON_HUNTER_THROW_FORWARD_SECONDS),
  throwBack: clip(dh.DEMON_HUNTER_THROW_BACK_INDEX, dh.DEMON_HUNTER_THROW_BACK_SECONDS),
  throwUp: clip(dh.DEMON_HUNTER_THROW_UP_INDEX, dh.DEMON_HUNTER_THROW_UP_SECONDS),
  throwDown: clip(dh.DEMON_HUNTER_THROW_DOWN_INDEX, dh.DEMON_HUNTER_THROW_DOWN_SECONDS),
  victimPummel: clip(dh.DEMON_HUNTER_VICTIM_PUMMEL_INDEX, dh.DEMON_HUNTER_VICTIM_PUMMEL_SECONDS),
  victimThrowForward: clip(dh.DEMON_HUNTER_VICTIM_THROW_FORWARD_INDEX, dh.DEMON_HUNTER_VICTIM_THROW_FORWARD_SECONDS),
  victimThrowBack: clip(dh.DEMON_HUNTER_VICTIM_THROW_BACK_INDEX, dh.DEMON_HUNTER_VICTIM_THROW_BACK_SECONDS),
  victimThrowUp: clip(dh.DEMON_HUNTER_VICTIM_THROW_UP_INDEX, dh.DEMON_HUNTER_VICTIM_THROW_UP_SECONDS),
  victimThrowDown: clip(dh.DEMON_HUNTER_VICTIM_THROW_DOWN_INDEX, dh.DEMON_HUNTER_VICTIM_THROW_DOWN_SECONDS),
  forwardSmash: clip(dh.DEMON_HUNTER_FORWARD_SMASH_INDEX, dh.DEMON_HUNTER_FORWARD_SMASH_SECONDS),
  upSmash: clip(dh.DEMON_HUNTER_UP_SMASH_INDEX, dh.DEMON_HUNTER_UP_SMASH_SECONDS),
  downSmash: clip(dh.DEMON_HUNTER_DOWN_SMASH_INDEX, dh.DEMON_HUNTER_DOWN_SMASH_SECONDS),
  dashAttack: clip(dh.DEMON_HUNTER_DASH_ATTACK_INDEX, dh.DEMON_HUNTER_DASH_ATTACK_SECONDS),
};

const ORIGINAL_CLIPS: { readonly [character: number]: HeroClipTable | undefined } = {
  [Character.archer]: ARCHER_CLIPS,
  [Character.rifleman]: RIFLEMAN_CLIPS,
  [Character.demonHunter]: DEMON_HUNTER_CLIPS,
};
const NO_CLIPS: HeroClipTable = {};

/** The character's clip table: an original fighter's, or a hero's registered one. */
export function characterClips(character: number): HeroClipTable {
  return ORIGINAL_CLIPS[character] ?? heroDefinition(character)?.presentation.clips ?? NO_CLIPS;
}

/** The character's clip for a pose, or the hero's fallback when its table leaves the pose out. */
export function clipFor(character: number, pose: HeroPose): HeroClip {
  return characterClips(character)[pose] ?? heroDefinition(character)?.presentation.fallback ?? STOCK_FALLBACK_CLIP;
}

/**
 * A platform move plays the ledge clip every fighter's table maps: ascent the
 * ledge climb, descent the ledge hang it lowers from, and both wraps the
 * ledge roll around the edge.
 */
export function platformClip(character: number, move: PlatformMove): HeroClip {
  switch (move) {
    case PlatformMove.ascent: return clipFor(character, "ledgeClimb");
    case PlatformMove.descent: return clipFor(character, "ledgeHang");
    default: return clipFor(character, "ledgeRoll");
  }
}

export function ledgePose(state: LedgeState): HeroPose {
  switch (state) {
    case LedgeState.climb: return "ledgeClimb";
    case LedgeState.roll: return "ledgeRoll";
    case LedgeState.attack: return "ledgeAttack";
    default: return "ledgeHang";
  }
}

/** A pummel or throw from both sides: the holder's pose and the victim's. */
interface GrabActionPoses {
  readonly holder: HeroPose;
  readonly victim: HeroPose;
}

const PUMMEL: GrabActionPoses = { holder: "pummel", victim: "victimPummel" };
const THROW_FORWARD: GrabActionPoses = { holder: "throwForward", victim: "victimThrowForward" };
const THROW_BACK: GrabActionPoses = { holder: "throwBack", victim: "victimThrowBack" };
const THROW_UP: GrabActionPoses = { holder: "throwUp", victim: "victimThrowUp" };
const THROW_DOWN: GrabActionPoses = { holder: "throwDown", victim: "victimThrowDown" };

/** Pummels and throws have clips; holding and escaping do not. */
export function grabActionPoses(action: GrabAction): GrabActionPoses | undefined {
  switch (action) {
    case GrabAction.pummel: return PUMMEL;
    case GrabAction.throwForward: return THROW_FORWARD;
    case GrabAction.throwBack: return THROW_BACK;
    case GrabAction.throwUp: return THROW_UP;
    case GrabAction.throwDown: return THROW_DOWN;
    default: return undefined;
  }
}

/** The pose an attack's start selects; smashes and shots without one play the named "attack" clip. */
export function attackPose(style: AttackStyle | undefined): HeroPose | undefined {
  switch (style) {
    case AttackStyle.neutralAir: return "neutralAir";
    case AttackStyle.forwardAir: return "forwardAir";
    case AttackStyle.backAir: return "backAir";
    case AttackStyle.upAir: return "upAir";
    case AttackStyle.downAir: return "downAir";
    case AttackStyle.jab: return "jab";
    case AttackStyle.grab: return "grab";
    case AttackStyle.forwardTilt: return "forwardTilt";
    case AttackStyle.upTilt: return "upTilt";
    case AttackStyle.downTilt: return "downTilt";
    case AttackStyle.forwardTiltUp: return "forwardTiltUp";
    case AttackStyle.forwardTiltDown: return "forwardTiltDown";
    case AttackStyle.getupAttack:
    case AttackStyle.ledgeAttack: return "getUpAttack";
    default: return undefined;
  }
}

function ownAttackPose(style: AttackStyle | undefined): HeroPose | undefined {
  switch (style) {
    case AttackStyle.upSmash: return "upSmash";
    case AttackStyle.downSmash: return "downSmash";
    case AttackStyle.forwardSmash: return "forwardSmash";
    case AttackStyle.demonHunterDashAttack:
    case AttackStyle.dashAttack: return "dashAttack";
    default: return undefined;
  }
}

/** Smashes and dash attacks play their own clip only where the table maps one. */
export function ownAttackClip(character: number, style: AttackStyle | undefined): HeroClip | undefined {
  const pose = ownAttackPose(style);
  return pose === undefined ? undefined : characterClips(character)[pose];
}

/** A charged smash: the held charge clip, then the release. */
interface SmashClips {
  readonly charge: HeroClip;
  readonly release: HeroClip;
}

const DEMON_HUNTER_UP_SMASH_CHARGE: SmashClips = {
  charge: clip(dh.DEMON_HUNTER_UP_SMASH_CHARGE_INDEX, dh.DEMON_HUNTER_UP_SMASH_CHARGE_SECONDS),
  release: clip(dh.DEMON_HUNTER_UP_SMASH_RELEASE_INDEX, dh.DEMON_HUNTER_UP_SMASH_RELEASE_SECONDS),
};
const DEMON_HUNTER_DOWN_SMASH_CHARGE: SmashClips = {
  charge: clip(dh.DEMON_HUNTER_DOWN_SMASH_CHARGE_INDEX, dh.DEMON_HUNTER_DOWN_SMASH_CHARGE_SECONDS),
  release: clip(dh.DEMON_HUNTER_DOWN_SMASH_RELEASE_INDEX, dh.DEMON_HUNTER_DOWN_SMASH_RELEASE_SECONDS),
};
const DEMON_HUNTER_FORWARD_SMASH_CHARGE: SmashClips = {
  charge: clip(dh.DEMON_HUNTER_FORWARD_SMASH_CHARGE_INDEX, dh.DEMON_HUNTER_FORWARD_SMASH_CHARGE_SECONDS),
  release: clip(dh.DEMON_HUNTER_FORWARD_SMASH_RELEASE_INDEX, dh.DEMON_HUNTER_FORWARD_SMASH_RELEASE_SECONDS),
};

/** Illidan's charged smash clips; any other style charges as a forward smash. */
export function illidanSmashClips(style: AttackStyle | undefined): SmashClips {
  if (style === AttackStyle.upSmash) return DEMON_HUNTER_UP_SMASH_CHARGE;
  return style === AttackStyle.downSmash ? DEMON_HUNTER_DOWN_SMASH_CHARGE : DEMON_HUNTER_FORWARD_SMASH_CHARGE;
}

/** Illidan's specials have a grounded and an aerial clip; so does the rifleman's blaster. */
interface GroundingClips {
  readonly grounded: HeroClip;
  readonly air: HeroClip;
}

const MANA_BURN: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_NEUTRAL_INDEX, dh.DEMON_HUNTER_SPECIAL_NEUTRAL_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_NEUTRAL_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_NEUTRAL_AIR_SECONDS) };
const PARRY_STEP: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_SIDE_INDEX, dh.DEMON_HUNTER_SPECIAL_SIDE_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_SIDE_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_SIDE_AIR_SECONDS) };
const WING_ASCENT: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_UP_INDEX, dh.DEMON_HUNTER_SPECIAL_UP_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_UP_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_UP_AIR_SECONDS) };
const IMMOLATE: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_DOWN_INDEX, dh.DEMON_HUNTER_SPECIAL_DOWN_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_DOWN_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_DOWN_AIR_SECONDS) };
const RIFLEMAN_BLASTER: GroundingClips = { grounded: clip(assets.RIFLEMAN_SPECIAL_NEUTRAL_INDEX, assets.RIFLEMAN_SPECIAL_NEUTRAL_SECONDS), air: clip(assets.RIFLEMAN_SPECIAL_NEUTRAL_AIR_INDEX, assets.RIFLEMAN_SPECIAL_NEUTRAL_AIR_SECONDS) };
const ARCHER_ARROW = clip(assets.ARCHER_SPECIAL_NEUTRAL_INDEX, assets.ARCHER_SPECIAL_NEUTRAL_SECONDS);
const ARCHER_HOMING_ARROW = clip(assets.ARCHER_SPECIAL_SIDE_INDEX, assets.ARCHER_SPECIAL_SIDE_SECONDS);
const ARCHER_DISENGAGE = clip(assets.ARCHER_SPECIAL_DOWN_INDEX, assets.ARCHER_SPECIAL_DOWN_SECONDS);
const ARCHER_RECOVERY = clip(assets.ARCHER_SPECIAL_UP_INDEX, assets.ARCHER_SPECIAL_UP_SECONDS);
// The stock Warcraft cast: he rocks back with a raised hand, then points the rifle
// forward about when the bear appears (60% through, frame 24 of 42).
const RIFLEMAN_BEAR = clip(assets.RIFLEMAN_SPELL_INDEX, assets.RIFLEMAN_SPELL_SECONDS);
const RIFLEMAN_TRAP = clip(assets.RIFLEMAN_SPECIAL_DOWN_INDEX, assets.RIFLEMAN_SPECIAL_DOWN_SECONDS);
const RIFLEMAN_RECOVERY = clip(assets.RIFLEMAN_SPECIAL_UP_INDEX, assets.RIFLEMAN_SPECIAL_UP_SECONDS);

const byGrounding = (clips: GroundingClips, grounded: boolean): HeroClip => grounded ? clips.grounded : clips.air;

/**
 * A special's clip. A hero's four specials play its table's grounded or aerial
 * pose. A follow-up plays its own follow-up pose when the table maps one. Any other action without its own clip plays the rifleman's blaster,
 * aerial when it has an aerial shot's duration.
 */
const FOLLOW_UP_POSES: readonly (readonly [grounded: HeroFollowUpPose, air: HeroFollowUpPose])[] = [
  ["neutralSpecialFollowUp", "neutralSpecialFollowUpAir"], ["sideSpecialFollowUp", "sideSpecialFollowUpAir"],
  ["upSpecialFollowUp", "upSpecialFollowUpAir"], ["downSpecialFollowUp", "downSpecialFollowUpAir"],
];

export function specialClip(character: number, action: SpecialAction, grounded: boolean, aerialShot: boolean, followUp = false): HeroClip {
  const poses = followUp ? FOLLOW_UP_POSES[action - SpecialAction.heroNeutral] : undefined;
  const own = poses === undefined ? undefined : characterClips(character)[grounded ? poses[0] : poses[1]];
  if (own !== undefined) return own;
  switch (action) {
    case SpecialAction.heroNeutral: return clipFor(character, grounded ? "neutralSpecial" : "neutralSpecialAir");
    case SpecialAction.heroSide: return clipFor(character, grounded ? "sideSpecial" : "sideSpecialAir");
    case SpecialAction.heroUp: return clipFor(character, grounded ? "upSpecial" : "upSpecialAir");
    case SpecialAction.heroDown: return clipFor(character, grounded ? "downSpecial" : "downSpecialAir");
    case SpecialAction.demonHunterManaBurn: return byGrounding(MANA_BURN, grounded);
    case SpecialAction.demonHunterParryStep: return byGrounding(PARRY_STEP, grounded);
    case SpecialAction.demonHunterWingAscent: return byGrounding(WING_ASCENT, grounded);
    case SpecialAction.demonHunterImmolate: return byGrounding(IMMOLATE, grounded);
    case SpecialAction.archerArrow: return ARCHER_ARROW;
    case SpecialAction.archerHomingArrow: return ARCHER_HOMING_ARROW;
    case SpecialAction.archerDisengage: return ARCHER_DISENGAGE;
    case SpecialAction.archerRecovery: return ARCHER_RECOVERY;
    case SpecialAction.riflemanBear: return RIFLEMAN_BEAR;
    case SpecialAction.riflemanTrap: return RIFLEMAN_TRAP;
    case SpecialAction.riflemanRecovery: return RIFLEMAN_RECOVERY;
    default: return byGrounding(RIFLEMAN_BLASTER, !aerialShot);
  }
}
