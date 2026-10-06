// The model clip each fighter pose plays, by character, from the packaged
// asset metadata. Tables only: pose selection lives in fighterPose.
import { AttackStyle, Character, GrabAction, LedgeState, SpecialAction } from "../sim/codes";
import * as dh from "./demonHunterAssetInfo";
import * as assets from "./fighterAssetInfo";

/** A clip in a fighter model: its sequence index and authored length. */
export interface Clip {
  readonly index: number;
  readonly seconds: number;
}

/** One clip per character, indexed by Character. */
export type CharacterClips = Readonly<Record<Character, Clip>>;

const clip = (index: number, seconds: number): Clip => ({ index, seconds });

/** The original fighters' clips; expansion heroes show Archer's until their presentation is mapped. */
const byCharacter = (archer: Clip, rifleman: Clip, demonHunter: Clip): CharacterClips => ({
  [Character.archer]: archer, [Character.rifleman]: rifleman, [Character.demonHunter]: demonHunter,
  [Character.blademaster]: archer, [Character.mountainKing]: archer, [Character.warden]: archer, [Character.lich]: archer,
  [Character.uther]: archer, [Character.dreadlord]: archer, [Character.shadowHunter]: archer,
});

const JAB: CharacterClips = byCharacter(clip(assets.ARCHER_JAB_INDEX, assets.ARCHER_JAB_SECONDS), clip(assets.RIFLEMAN_JAB_INDEX, assets.RIFLEMAN_JAB_SECONDS), clip(dh.DEMON_HUNTER_ATTACK_JAB_INDEX, dh.DEMON_HUNTER_ATTACK_JAB_SECONDS));
const GRAB: CharacterClips = byCharacter(clip(assets.ARCHER_GRAB_INDEX, assets.ARCHER_GRAB_SECONDS), clip(assets.RIFLEMAN_GRAB_INDEX, assets.RIFLEMAN_GRAB_SECONDS), clip(dh.DEMON_HUNTER_GRAB_INDEX, dh.DEMON_HUNTER_GRAB_SECONDS));
const FORWARD_TILT: CharacterClips = byCharacter(clip(assets.ARCHER_FORWARD_TILT_INDEX, assets.ARCHER_FORWARD_TILT_SECONDS), clip(assets.RIFLEMAN_FORWARD_TILT_INDEX, assets.RIFLEMAN_FORWARD_TILT_SECONDS), clip(dh.DEMON_HUNTER_FORWARD_TILT_INDEX, dh.DEMON_HUNTER_FORWARD_TILT_SECONDS));
const UP_TILT: CharacterClips = byCharacter(clip(assets.ARCHER_UP_TILT_INDEX, assets.ARCHER_UP_TILT_SECONDS), clip(assets.RIFLEMAN_UP_TILT_INDEX, assets.RIFLEMAN_UP_TILT_SECONDS), clip(dh.DEMON_HUNTER_UP_TILT_INDEX, dh.DEMON_HUNTER_UP_TILT_SECONDS));
const DOWN_TILT: CharacterClips = byCharacter(clip(assets.ARCHER_DOWN_TILT_INDEX, assets.ARCHER_DOWN_TILT_SECONDS), clip(assets.RIFLEMAN_DOWN_TILT_INDEX, assets.RIFLEMAN_DOWN_TILT_SECONDS), clip(dh.DEMON_HUNTER_DOWN_TILT_INDEX, dh.DEMON_HUNTER_DOWN_TILT_SECONDS));
const FORWARD_TILT_UP: CharacterClips = byCharacter(clip(assets.ARCHER_FORWARD_TILT_UP_INDEX, assets.ARCHER_FORWARD_TILT_UP_SECONDS), clip(assets.RIFLEMAN_FORWARD_TILT_UP_INDEX, assets.RIFLEMAN_FORWARD_TILT_UP_SECONDS), clip(dh.DEMON_HUNTER_FORWARD_TILT_UP_INDEX, dh.DEMON_HUNTER_FORWARD_TILT_UP_SECONDS));
const FORWARD_TILT_DOWN: CharacterClips = byCharacter(clip(assets.ARCHER_FORWARD_TILT_DOWN_INDEX, assets.ARCHER_FORWARD_TILT_DOWN_SECONDS), clip(assets.RIFLEMAN_FORWARD_TILT_DOWN_INDEX, assets.RIFLEMAN_FORWARD_TILT_DOWN_SECONDS), clip(dh.DEMON_HUNTER_FORWARD_TILT_DOWN_INDEX, dh.DEMON_HUNTER_FORWARD_TILT_DOWN_SECONDS));
const AERIAL_NEUTRAL: CharacterClips = byCharacter(clip(assets.ARCHER_AERIAL_NEUTRAL_INDEX, assets.ARCHER_AERIAL_NEUTRAL_SECONDS), clip(assets.RIFLEMAN_AERIAL_NEUTRAL_INDEX, assets.RIFLEMAN_AERIAL_NEUTRAL_SECONDS), clip(dh.DEMON_HUNTER_AERIAL_NEUTRAL_INDEX, dh.DEMON_HUNTER_AERIAL_NEUTRAL_SECONDS));
const AERIAL_FORWARD: CharacterClips = byCharacter(clip(assets.ARCHER_AERIAL_FORWARD_INDEX, assets.ARCHER_AERIAL_FORWARD_SECONDS), clip(assets.RIFLEMAN_AERIAL_FORWARD_INDEX, assets.RIFLEMAN_AERIAL_FORWARD_SECONDS), clip(dh.DEMON_HUNTER_AERIAL_FORWARD_INDEX, dh.DEMON_HUNTER_AERIAL_FORWARD_SECONDS));
const AERIAL_BACK: CharacterClips = byCharacter(clip(assets.ARCHER_AERIAL_BACK_INDEX, assets.ARCHER_AERIAL_BACK_SECONDS), clip(assets.RIFLEMAN_AERIAL_BACK_INDEX, assets.RIFLEMAN_AERIAL_BACK_SECONDS), clip(dh.DEMON_HUNTER_AERIAL_BACK_INDEX, dh.DEMON_HUNTER_AERIAL_BACK_SECONDS));
const AERIAL_UP: CharacterClips = byCharacter(clip(assets.ARCHER_AERIAL_UP_INDEX, assets.ARCHER_AERIAL_UP_SECONDS), clip(assets.RIFLEMAN_AERIAL_UP_INDEX, assets.RIFLEMAN_AERIAL_UP_SECONDS), clip(dh.DEMON_HUNTER_AERIAL_UP_INDEX, dh.DEMON_HUNTER_AERIAL_UP_SECONDS));
const AERIAL_DOWN: CharacterClips = byCharacter(clip(assets.ARCHER_AERIAL_DOWN_INDEX, assets.ARCHER_AERIAL_DOWN_SECONDS), clip(assets.RIFLEMAN_AERIAL_DOWN_INDEX, assets.RIFLEMAN_AERIAL_DOWN_SECONDS), clip(dh.DEMON_HUNTER_AERIAL_DOWN_INDEX, dh.DEMON_HUNTER_AERIAL_DOWN_SECONDS));
export const GET_UP_ATTACK: CharacterClips = byCharacter(clip(assets.ARCHER_GET_UP_ATTACK_INDEX, assets.ARCHER_GET_UP_ATTACK_SECONDS), clip(assets.RIFLEMAN_GET_UP_ATTACK_INDEX, assets.RIFLEMAN_GET_UP_ATTACK_SECONDS), clip(dh.DEMON_HUNTER_GET_UP_ATTACK_INDEX, dh.DEMON_HUNTER_GET_UP_ATTACK_SECONDS));

/** Ledge options: Illidan has his own roll and attack; the others reuse their roll and get-up attack. */
const LEDGE_HANG: CharacterClips = byCharacter(clip(assets.ARCHER_LEDGE_HANG_INDEX, assets.ARCHER_LEDGE_HANG_SECONDS), clip(assets.RIFLEMAN_LEDGE_HANG_INDEX, assets.RIFLEMAN_LEDGE_HANG_SECONDS), clip(dh.DEMON_HUNTER_LEDGE_HANG_INDEX, dh.DEMON_HUNTER_LEDGE_HANG_SECONDS));
export const LEDGE_CLIMB: CharacterClips = byCharacter(clip(assets.ARCHER_LEDGE_CLIMB_INDEX, assets.ARCHER_LEDGE_CLIMB_SECONDS), clip(assets.RIFLEMAN_LEDGE_CLIMB_INDEX, assets.RIFLEMAN_LEDGE_CLIMB_SECONDS), clip(dh.DEMON_HUNTER_LEDGE_CLIMB_INDEX, dh.DEMON_HUNTER_LEDGE_CLIMB_SECONDS));
export const LEDGE_ROLL: CharacterClips = byCharacter(clip(assets.ARCHER_ROLL_FORWARD_INDEX, assets.ARCHER_ROLL_FORWARD_SECONDS), clip(assets.RIFLEMAN_ROLL_FORWARD_INDEX, assets.RIFLEMAN_ROLL_FORWARD_SECONDS), clip(dh.DEMON_HUNTER_LEDGE_ROLL_INDEX, dh.DEMON_HUNTER_LEDGE_ROLL_SECONDS));
export const LEDGE_ATTACK: CharacterClips = byCharacter(clip(assets.ARCHER_GET_UP_ATTACK_INDEX, assets.ARCHER_GET_UP_ATTACK_SECONDS), clip(assets.RIFLEMAN_GET_UP_ATTACK_INDEX, assets.RIFLEMAN_GET_UP_ATTACK_SECONDS), clip(dh.DEMON_HUNTER_LEDGE_ATTACK_INDEX, dh.DEMON_HUNTER_LEDGE_ATTACK_SECONDS));

export function ledgeClips(state: LedgeState): CharacterClips {
  switch (state) {
    case LedgeState.climb: return LEDGE_CLIMB;
    case LedgeState.roll: return LEDGE_ROLL;
    case LedgeState.attack: return LEDGE_ATTACK;
    default: return LEDGE_HANG;
  }
}

export const KNOCKDOWN: CharacterClips = byCharacter(clip(assets.ARCHER_KNOCKDOWN_INDEX, assets.ARCHER_KNOCKDOWN_SECONDS), clip(assets.RIFLEMAN_KNOCKDOWN_INDEX, assets.RIFLEMAN_KNOCKDOWN_SECONDS), clip(dh.DEMON_HUNTER_KNOCKDOWN_INDEX, dh.DEMON_HUNTER_KNOCKDOWN_SECONDS));
export const GET_UP: CharacterClips = byCharacter(clip(assets.ARCHER_GET_UP_INDEX, assets.ARCHER_GET_UP_SECONDS), clip(assets.RIFLEMAN_GET_UP_INDEX, assets.RIFLEMAN_GET_UP_SECONDS), clip(dh.DEMON_HUNTER_GET_UP_INDEX, dh.DEMON_HUNTER_GET_UP_SECONDS));
export const DOWN_DAMAGE: CharacterClips = byCharacter(clip(assets.ARCHER_DOWN_DAMAGE_INDEX, assets.ARCHER_DOWN_DAMAGE_SECONDS), clip(assets.RIFLEMAN_DOWN_DAMAGE_INDEX, assets.RIFLEMAN_DOWN_DAMAGE_SECONDS), clip(dh.DEMON_HUNTER_DOWN_DAMAGE_INDEX, dh.DEMON_HUNTER_DOWN_DAMAGE_SECONDS));
export const ROLL_FORWARD: CharacterClips = byCharacter(clip(assets.ARCHER_ROLL_FORWARD_INDEX, assets.ARCHER_ROLL_FORWARD_SECONDS), clip(assets.RIFLEMAN_ROLL_FORWARD_INDEX, assets.RIFLEMAN_ROLL_FORWARD_SECONDS), clip(dh.DEMON_HUNTER_ROLL_FORWARD_INDEX, dh.DEMON_HUNTER_ROLL_FORWARD_SECONDS));
export const ROLL_BACKWARD: CharacterClips = byCharacter(clip(assets.ARCHER_ROLL_BACKWARD_INDEX, assets.ARCHER_ROLL_BACKWARD_SECONDS), clip(assets.RIFLEMAN_ROLL_BACKWARD_INDEX, assets.RIFLEMAN_ROLL_BACKWARD_SECONDS), clip(dh.DEMON_HUNTER_ROLL_BACKWARD_INDEX, dh.DEMON_HUNTER_ROLL_BACKWARD_SECONDS));
export const SPOT_DODGE: CharacterClips = byCharacter(clip(assets.ARCHER_SPOT_DODGE_INDEX, assets.ARCHER_SPOT_DODGE_SECONDS), clip(assets.RIFLEMAN_SPOT_DODGE_INDEX, assets.RIFLEMAN_SPOT_DODGE_SECONDS), clip(dh.DEMON_HUNTER_SPOT_DODGE_INDEX, dh.DEMON_HUNTER_SPOT_DODGE_SECONDS));

export const JUMP: CharacterClips = byCharacter(clip(assets.ARCHER_JUMP_INDEX, assets.ARCHER_JUMP_SECONDS), clip(assets.RIFLEMAN_JUMP_INDEX, assets.RIFLEMAN_JUMP_SECONDS), clip(dh.DEMON_HUNTER_JUMP_INDEX, dh.DEMON_HUNTER_JUMP_SECONDS));
export const DOUBLE_JUMP: CharacterClips = byCharacter(clip(assets.ARCHER_DOUBLE_JUMP_INDEX, assets.ARCHER_DOUBLE_JUMP_SECONDS), clip(assets.RIFLEMAN_DOUBLE_JUMP_INDEX, assets.RIFLEMAN_DOUBLE_JUMP_SECONDS), clip(dh.DEMON_HUNTER_DOUBLE_JUMP_INDEX, dh.DEMON_HUNTER_DOUBLE_JUMP_SECONDS));
export const FALL_SPECIAL: CharacterClips = byCharacter(clip(assets.ARCHER_FALL_SPECIAL_INDEX, assets.ARCHER_FALL_SPECIAL_SECONDS), clip(assets.RIFLEMAN_FALL_SPECIAL_INDEX, assets.RIFLEMAN_FALL_SPECIAL_SECONDS), clip(dh.DEMON_HUNTER_FALL_SPECIAL_INDEX, dh.DEMON_HUNTER_FALL_SPECIAL_SECONDS));

export const DAMAGE_GROUND: CharacterClips = byCharacter(clip(assets.ARCHER_DAMAGE_GROUND_INDEX, assets.ARCHER_DAMAGE_GROUND_SECONDS), clip(assets.RIFLEMAN_DAMAGE_GROUND_INDEX, assets.RIFLEMAN_DAMAGE_GROUND_SECONDS), clip(dh.DEMON_HUNTER_DAMAGE_GROUND_INDEX, dh.DEMON_HUNTER_DAMAGE_GROUND_SECONDS));
export const DAMAGE_AIR: CharacterClips = byCharacter(clip(assets.ARCHER_DAMAGE_AIR_INDEX, assets.ARCHER_DAMAGE_AIR_SECONDS), clip(assets.RIFLEMAN_DAMAGE_AIR_INDEX, assets.RIFLEMAN_DAMAGE_AIR_SECONDS), clip(dh.DEMON_HUNTER_DAMAGE_AIR_INDEX, dh.DEMON_HUNTER_DAMAGE_AIR_SECONDS));
export const DAMAGE_TUMBLE: CharacterClips = byCharacter(clip(assets.ARCHER_DAMAGE_TUMBLE_INDEX, assets.ARCHER_DAMAGE_TUMBLE_SECONDS), clip(assets.RIFLEMAN_DAMAGE_TUMBLE_INDEX, assets.RIFLEMAN_DAMAGE_TUMBLE_SECONDS), clip(dh.DEMON_HUNTER_DAMAGE_TUMBLE_INDEX, dh.DEMON_HUNTER_DAMAGE_TUMBLE_SECONDS));
export const DAMAGE_SHIELD: CharacterClips = byCharacter(clip(assets.ARCHER_DAMAGE_SHIELD_INDEX, assets.ARCHER_DAMAGE_SHIELD_SECONDS), clip(assets.RIFLEMAN_DAMAGE_SHIELD_INDEX, assets.RIFLEMAN_DAMAGE_SHIELD_SECONDS), clip(dh.DEMON_HUNTER_DAMAGE_SHIELD_INDEX, dh.DEMON_HUNTER_DAMAGE_SHIELD_SECONDS));

export const GRAB_HOLD: CharacterClips = byCharacter(clip(assets.ARCHER_GRAB_HOLD_INDEX, assets.ARCHER_GRAB_HOLD_SECONDS), clip(assets.RIFLEMAN_GRAB_HOLD_INDEX, assets.RIFLEMAN_GRAB_HOLD_SECONDS), clip(dh.DEMON_HUNTER_GRAB_HOLD_INDEX, dh.DEMON_HUNTER_GRAB_HOLD_SECONDS));
export const GRABBED: CharacterClips = byCharacter(clip(assets.ARCHER_GRABBED_INDEX, assets.ARCHER_GRABBED_SECONDS), clip(assets.RIFLEMAN_GRABBED_INDEX, assets.RIFLEMAN_GRABBED_SECONDS), clip(dh.DEMON_HUNTER_GRABBED_INDEX, dh.DEMON_HUNTER_GRABBED_SECONDS));

/** A pummel or throw from both sides: the holder's clip and the victim's. */
interface GrabActionClips {
  readonly holder: CharacterClips;
  readonly victim: CharacterClips;
}

const PUMMEL: GrabActionClips = {
  holder: byCharacter(clip(assets.ARCHER_PUMMEL_INDEX, assets.ARCHER_PUMMEL_SECONDS), clip(assets.RIFLEMAN_PUMMEL_INDEX, assets.RIFLEMAN_PUMMEL_SECONDS), clip(dh.DEMON_HUNTER_PUMMEL_INDEX, dh.DEMON_HUNTER_PUMMEL_SECONDS)),
  victim: byCharacter(clip(assets.ARCHER_VICTIM_PUMMEL_INDEX, assets.ARCHER_VICTIM_PUMMEL_SECONDS), clip(assets.RIFLEMAN_VICTIM_PUMMEL_INDEX, assets.RIFLEMAN_VICTIM_PUMMEL_SECONDS), clip(dh.DEMON_HUNTER_VICTIM_PUMMEL_INDEX, dh.DEMON_HUNTER_VICTIM_PUMMEL_SECONDS)),
};
const THROW_FORWARD: GrabActionClips = {
  holder: byCharacter(clip(assets.ARCHER_THROW_FORWARD_INDEX, assets.ARCHER_THROW_FORWARD_SECONDS), clip(assets.RIFLEMAN_THROW_FORWARD_INDEX, assets.RIFLEMAN_THROW_FORWARD_SECONDS), clip(dh.DEMON_HUNTER_THROW_FORWARD_INDEX, dh.DEMON_HUNTER_THROW_FORWARD_SECONDS)),
  victim: byCharacter(clip(assets.ARCHER_VICTIM_THROW_FORWARD_INDEX, assets.ARCHER_VICTIM_THROW_FORWARD_SECONDS), clip(assets.RIFLEMAN_VICTIM_THROW_FORWARD_INDEX, assets.RIFLEMAN_VICTIM_THROW_FORWARD_SECONDS), clip(dh.DEMON_HUNTER_VICTIM_THROW_FORWARD_INDEX, dh.DEMON_HUNTER_VICTIM_THROW_FORWARD_SECONDS)),
};
const THROW_BACK: GrabActionClips = {
  holder: byCharacter(clip(assets.ARCHER_THROW_BACK_INDEX, assets.ARCHER_THROW_BACK_SECONDS), clip(assets.RIFLEMAN_THROW_BACK_INDEX, assets.RIFLEMAN_THROW_BACK_SECONDS), clip(dh.DEMON_HUNTER_THROW_BACK_INDEX, dh.DEMON_HUNTER_THROW_BACK_SECONDS)),
  victim: byCharacter(clip(assets.ARCHER_VICTIM_THROW_BACK_INDEX, assets.ARCHER_VICTIM_THROW_BACK_SECONDS), clip(assets.RIFLEMAN_VICTIM_THROW_BACK_INDEX, assets.RIFLEMAN_VICTIM_THROW_BACK_SECONDS), clip(dh.DEMON_HUNTER_VICTIM_THROW_BACK_INDEX, dh.DEMON_HUNTER_VICTIM_THROW_BACK_SECONDS)),
};
const THROW_UP: GrabActionClips = {
  holder: byCharacter(clip(assets.ARCHER_THROW_UP_INDEX, assets.ARCHER_THROW_UP_SECONDS), clip(assets.RIFLEMAN_THROW_UP_INDEX, assets.RIFLEMAN_THROW_UP_SECONDS), clip(dh.DEMON_HUNTER_THROW_UP_INDEX, dh.DEMON_HUNTER_THROW_UP_SECONDS)),
  victim: byCharacter(clip(assets.ARCHER_VICTIM_THROW_UP_INDEX, assets.ARCHER_VICTIM_THROW_UP_SECONDS), clip(assets.RIFLEMAN_VICTIM_THROW_UP_INDEX, assets.RIFLEMAN_VICTIM_THROW_UP_SECONDS), clip(dh.DEMON_HUNTER_VICTIM_THROW_UP_INDEX, dh.DEMON_HUNTER_VICTIM_THROW_UP_SECONDS)),
};
const THROW_DOWN: GrabActionClips = {
  holder: byCharacter(clip(assets.ARCHER_THROW_DOWN_INDEX, assets.ARCHER_THROW_DOWN_SECONDS), clip(assets.RIFLEMAN_THROW_DOWN_INDEX, assets.RIFLEMAN_THROW_DOWN_SECONDS), clip(dh.DEMON_HUNTER_THROW_DOWN_INDEX, dh.DEMON_HUNTER_THROW_DOWN_SECONDS)),
  victim: byCharacter(clip(assets.ARCHER_VICTIM_THROW_DOWN_INDEX, assets.ARCHER_VICTIM_THROW_DOWN_SECONDS), clip(assets.RIFLEMAN_VICTIM_THROW_DOWN_INDEX, assets.RIFLEMAN_VICTIM_THROW_DOWN_SECONDS), clip(dh.DEMON_HUNTER_VICTIM_THROW_DOWN_INDEX, dh.DEMON_HUNTER_VICTIM_THROW_DOWN_SECONDS)),
};

/** Pummels and throws have clips; holding and escaping do not. */
export function grabActionClips(action: GrabAction): GrabActionClips | undefined {
  switch (action) {
    case GrabAction.pummel: return PUMMEL;
    case GrabAction.throwForward: return THROW_FORWARD;
    case GrabAction.throwBack: return THROW_BACK;
    case GrabAction.throwUp: return THROW_UP;
    case GrabAction.throwDown: return THROW_DOWN;
    default: return undefined;
  }
}

/** The clip an attack's start selects; smashes and shots without one play the named "attack" clip. */
export function attackClips(style: AttackStyle | undefined): CharacterClips | undefined {
  switch (style) {
    case AttackStyle.neutralAir: return AERIAL_NEUTRAL;
    case AttackStyle.forwardAir: return AERIAL_FORWARD;
    case AttackStyle.backAir: return AERIAL_BACK;
    case AttackStyle.upAir: return AERIAL_UP;
    case AttackStyle.downAir: return AERIAL_DOWN;
    case AttackStyle.jab: return JAB;
    case AttackStyle.grab: return GRAB;
    case AttackStyle.forwardTilt: return FORWARD_TILT;
    case AttackStyle.upTilt: return UP_TILT;
    case AttackStyle.downTilt: return DOWN_TILT;
    case AttackStyle.forwardTiltUp: return FORWARD_TILT_UP;
    case AttackStyle.forwardTiltDown: return FORWARD_TILT_DOWN;
    case AttackStyle.getupAttack:
    case AttackStyle.ledgeAttack: return GET_UP_ATTACK;
    default: return undefined;
  }
}

const DEMON_HUNTER_UP_SMASH = clip(dh.DEMON_HUNTER_UP_SMASH_INDEX, dh.DEMON_HUNTER_UP_SMASH_SECONDS);
const DEMON_HUNTER_DOWN_SMASH = clip(dh.DEMON_HUNTER_DOWN_SMASH_INDEX, dh.DEMON_HUNTER_DOWN_SMASH_SECONDS);
const DEMON_HUNTER_FORWARD_SMASH = clip(dh.DEMON_HUNTER_FORWARD_SMASH_INDEX, dh.DEMON_HUNTER_FORWARD_SMASH_SECONDS);
const DEMON_HUNTER_DASH_ATTACK = clip(dh.DEMON_HUNTER_DASH_ATTACK_INDEX, dh.DEMON_HUNTER_DASH_ATTACK_SECONDS);

/** Illidan's smashes and dash attack have clips of their own. */
export function illidanAttackClip(style: AttackStyle | undefined): Clip | undefined {
  switch (style) {
    case AttackStyle.upSmash: return DEMON_HUNTER_UP_SMASH;
    case AttackStyle.downSmash: return DEMON_HUNTER_DOWN_SMASH;
    case AttackStyle.forwardSmash: return DEMON_HUNTER_FORWARD_SMASH;
    case AttackStyle.demonHunterDashAttack: return DEMON_HUNTER_DASH_ATTACK;
    default: return undefined;
  }
}

/** A charged smash: the held charge clip, then the release. */
interface SmashClips {
  readonly charge: Clip;
  readonly release: Clip;
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
  readonly grounded: Clip;
  readonly air: Clip;
}

const MANA_BURN: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_NEUTRAL_INDEX, dh.DEMON_HUNTER_SPECIAL_NEUTRAL_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_NEUTRAL_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_NEUTRAL_AIR_SECONDS) };
const PARRY_STEP: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_SIDE_INDEX, dh.DEMON_HUNTER_SPECIAL_SIDE_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_SIDE_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_SIDE_AIR_SECONDS) };
const WING_ASCENT: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_UP_INDEX, dh.DEMON_HUNTER_SPECIAL_UP_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_UP_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_UP_AIR_SECONDS) };
const IMMOLATE: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_DOWN_INDEX, dh.DEMON_HUNTER_SPECIAL_DOWN_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_DOWN_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_DOWN_AIR_SECONDS) };
const RIFLEMAN_BLASTER: GroundingClips = { grounded: clip(assets.RIFLEMAN_SPECIAL_NEUTRAL_INDEX, assets.RIFLEMAN_SPECIAL_NEUTRAL_SECONDS), air: clip(assets.RIFLEMAN_SPECIAL_NEUTRAL_AIR_INDEX, assets.RIFLEMAN_SPECIAL_NEUTRAL_AIR_SECONDS) };
const ARCHER_ARROW = clip(assets.ARCHER_SPECIAL_NEUTRAL_INDEX, assets.ARCHER_SPECIAL_NEUTRAL_SECONDS);
const ARCHER_MULTISHOT = clip(assets.ARCHER_SPECIAL_SIDE_INDEX, assets.ARCHER_SPECIAL_SIDE_SECONDS);
const ARCHER_DISENGAGE = clip(assets.ARCHER_SPECIAL_DOWN_INDEX, assets.ARCHER_SPECIAL_DOWN_SECONDS);
const ARCHER_RECOVERY = clip(assets.ARCHER_SPECIAL_UP_INDEX, assets.ARCHER_SPECIAL_UP_SECONDS);
const RIFLEMAN_BEAR = clip(assets.RIFLEMAN_SPECIAL_SIDE_INDEX, assets.RIFLEMAN_SPECIAL_SIDE_SECONDS);
const RIFLEMAN_TRAP = clip(assets.RIFLEMAN_SPECIAL_DOWN_INDEX, assets.RIFLEMAN_SPECIAL_DOWN_SECONDS);
const RIFLEMAN_RECOVERY = clip(assets.RIFLEMAN_SPECIAL_UP_INDEX, assets.RIFLEMAN_SPECIAL_UP_SECONDS);

const byGrounding = (clips: GroundingClips, grounded: boolean): Clip => grounded ? clips.grounded : clips.air;

/**
 * A special's clip. Any action without its own clip plays the rifleman's
 * blaster, aerial when it has an aerial shot's duration.
 */
export function specialClip(action: SpecialAction, grounded: boolean, aerialShot: boolean): Clip {
  switch (action) {
    case SpecialAction.demonHunterManaBurn: return byGrounding(MANA_BURN, grounded);
    case SpecialAction.demonHunterParryStep: return byGrounding(PARRY_STEP, grounded);
    case SpecialAction.demonHunterWingAscent: return byGrounding(WING_ASCENT, grounded);
    case SpecialAction.demonHunterImmolate: return byGrounding(IMMOLATE, grounded);
    case SpecialAction.archerArrow: return ARCHER_ARROW;
    case SpecialAction.archerMultishot: return ARCHER_MULTISHOT;
    case SpecialAction.archerDisengage: return ARCHER_DISENGAGE;
    case SpecialAction.archerRecovery: return ARCHER_RECOVERY;
    case SpecialAction.riflemanBear: return RIFLEMAN_BEAR;
    case SpecialAction.riflemanTrap: return RIFLEMAN_TRAP;
    case SpecialAction.riflemanRecovery: return RIFLEMAN_RECOVERY;
    default: return byGrounding(RIFLEMAN_BLASTER, !aerialShot);
  }
}
