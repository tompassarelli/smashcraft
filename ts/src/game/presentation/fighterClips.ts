



import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, LedgeState, PlatformMove, SpecialAction } from "../sim/codes";
import { type HeroClip, type HeroClipTable, type HeroFollowUpPose, type HeroPose, STOCK_FALLBACK_CLIP } from "../sim/heroes/hero";
import { heroDefinition } from "../sim/heroes/registry";
import { RIFLEMAN_GROUND, type GroundKit, jabSlice, strikeClip } from "../sim/heroes/groundNormals";
import * as dh from "./demonHunterAssetInfo";
import * as assets from "./fighterAssetInfo";
import { RECOVERY_CLIPS } from "./recoveryClipInfo";
import { DRILL_CLIPS } from "./drillClipInfo";
import { DOWN_AIR_CLIPS } from "./downAirClipInfo";
import { JUMP_CLIPS } from "./jumpClipInfo";
import { BLADEMASTER_AUTHORED_CLIPS } from "./blademasterClipInfo";
import { GRAB_CLIPS } from "./grabClipInfo";
import { ROSTER_ATTACK_CLIPS } from "./rosterAttackClipInfo";
import { STOCK_CLIP_SWAPS } from "./stockClipSwaps";

const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });






const retimed = (index: number, seconds: number, startup: number, total: number, kit: GroundKit, style: AttackStyle): HeroClip =>
  strikeClip({ index }, f32(f32(seconds * startup) / total), kit, style);

const RIFLEMAN_CLIPS: HeroClipTable = {
  jab: jabSlice({ index: assets.RIFLEMAN_JAB_INDEX }, f32(0.1)),
  jab2: jabSlice({ index: assets.RIFLEMAN_JAB_INDEX }, f32(0.11)),
  grab: clip(assets.RIFLEMAN_GRAB_INDEX, assets.RIFLEMAN_GRAB_SECONDS),
  forwardTilt: clip(assets.RIFLEMAN_FORWARD_TILT_INDEX, assets.RIFLEMAN_FORWARD_TILT_SECONDS),
  upTilt: clip(assets.RIFLEMAN_UP_TILT_INDEX, assets.RIFLEMAN_UP_TILT_SECONDS),
  downTilt: clip(assets.RIFLEMAN_DOWN_TILT_INDEX, assets.RIFLEMAN_DOWN_TILT_SECONDS),
  forwardTiltUp: clip(assets.RIFLEMAN_FORWARD_TILT_UP_INDEX, assets.RIFLEMAN_FORWARD_TILT_UP_SECONDS),
  forwardTiltDown: clip(assets.RIFLEMAN_FORWARD_TILT_DOWN_INDEX, assets.RIFLEMAN_FORWARD_TILT_DOWN_SECONDS),
  forwardSmash: clip(assets.RIFLEMAN_FORWARD_SMASH_INDEX, assets.RIFLEMAN_FORWARD_SMASH_SECONDS),
  upSmash: clip(assets.RIFLEMAN_UP_SMASH_INDEX, assets.RIFLEMAN_UP_SMASH_SECONDS),
  downSmash: clip(assets.RIFLEMAN_DOWN_SMASH_INDEX, assets.RIFLEMAN_DOWN_SMASH_SECONDS),

  dashAttack: retimed(assets.RIFLEMAN_FORWARD_TILT_INDEX, assets.RIFLEMAN_FORWARD_TILT_SECONDS, 6, 30, RIFLEMAN_GROUND, AttackStyle.dashAttack),
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
  wallJump: clip(assets.RIFLEMAN_DOUBLE_JUMP_INDEX, assets.RIFLEMAN_DOUBLE_JUMP_SECONDS),
  wallTech: clip(assets.RIFLEMAN_ROLL_FORWARD_INDEX, assets.RIFLEMAN_ROLL_FORWARD_SECONDS),
  fallSpecial: clip(assets.RIFLEMAN_FALL_SPECIAL_INDEX, assets.RIFLEMAN_FALL_SPECIAL_SECONDS),
  damageGround: clip(assets.RIFLEMAN_DAMAGE_GROUND_INDEX, assets.RIFLEMAN_DAMAGE_GROUND_SECONDS),
  damageAir: clip(assets.RIFLEMAN_DAMAGE_AIR_INDEX, assets.RIFLEMAN_DAMAGE_AIR_SECONDS),
  damageTumble: clip(assets.RIFLEMAN_DAMAGE_TUMBLE_INDEX, assets.RIFLEMAN_DAMAGE_TUMBLE_SECONDS),
  damageShield: clip(assets.RIFLEMAN_DAMAGE_SHIELD_INDEX, assets.RIFLEMAN_DAMAGE_SHIELD_SECONDS),

  dizzy: clip(assets.RIFLEMAN_DAMAGE_SHIELD_INDEX, assets.RIFLEMAN_DAMAGE_SHIELD_SECONDS),
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
  jab: jabSlice({ index: dh.DEMON_HUNTER_ATTACK_JAB_INDEX }, f32(0.13)),
  jab2: jabSlice({ index: dh.DEMON_HUNTER_ATTACK_JAB_INDEX }, f32(0.13)),
  jab3: jabSlice({ index: dh.DEMON_HUNTER_ATTACK_JAB_INDEX }, f32(0.14)),
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
  wallJump: clip(dh.DEMON_HUNTER_DOUBLE_JUMP_INDEX, dh.DEMON_HUNTER_DOUBLE_JUMP_SECONDS),
  wallTech: clip(dh.DEMON_HUNTER_ROLL_FORWARD_INDEX, dh.DEMON_HUNTER_ROLL_FORWARD_SECONDS),
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
  [Character.rifleman]: RIFLEMAN_CLIPS,
  [Character.demonHunter]: DEMON_HUNTER_CLIPS,
};
const NO_CLIPS: HeroClipTable = {};
function recoveryTables(): Readonly<Record<number, HeroClipTable>> {
  const tables: Record<number, HeroClipTable> = {};
  const drills: Readonly<Record<number, HeroClipTable | undefined>> = DRILL_CLIPS;
  for (const [character, recovery] of Object.entries(RECOVERY_CLIPS)) {
    const id = Number(character);
    tables[id] = { ...(ORIGINAL_CLIPS[id] ?? heroDefinition(id)?.presentation.clips ?? NO_CLIPS), ...recovery, ...drills[id] };
  }
  for (const [character, grabs] of Object.entries(GRAB_CLIPS)) {
    const id = Number(character);
    tables[id] = { ...(tables[id] ?? ORIGINAL_CLIPS[id] ?? heroDefinition(id)?.presentation.clips ?? NO_CLIPS), ...grabs };
  }
  for (const [character, downAir] of Object.entries(DOWN_AIR_CLIPS)) {
    const id = Number(character);
    tables[id] = { ...(tables[id] ?? ORIGINAL_CLIPS[id] ?? heroDefinition(id)?.presentation.clips ?? NO_CLIPS), ...downAir };
  }
  for (const [character, jumps] of Object.entries(JUMP_CLIPS)) {
    const id = Number(character);
    tables[id] = { ...(tables[id] ?? ORIGINAL_CLIPS[id] ?? heroDefinition(id)?.presentation.clips ?? NO_CLIPS), ...jumps };
  }
  for (const [character, attacks] of Object.entries(ROSTER_ATTACK_CLIPS)) {
    const id = Number(character);
    tables[id] = { ...(tables[id] ?? ORIGINAL_CLIPS[id] ?? heroDefinition(id)?.presentation.clips ?? NO_CLIPS), ...attacks };
  }
  tables[Character.blademaster] = { ...tables[Character.blademaster], ...BLADEMASTER_AUTHORED_CLIPS };
  for (const [character, swaps] of Object.entries(STOCK_CLIP_SWAPS)) {
    const id = Number(character);
    tables[id] = { ...(tables[id] ?? ORIGINAL_CLIPS[id] ?? heroDefinition(id)?.presentation.clips ?? NO_CLIPS), ...swaps };
  }
  return tables;
}
const COMBINED_CLIPS = recoveryTables();


export function namedClips(table: HeroClipTable): HeroClip[] {
  const clips: HeroClip[] = [];
  // Lua Object.values uses pairs and skips nil, so its result is dense.
  for (const clip of Object.values(table)) if (clip !== undefined) clips.push(clip);
  return clips;
}


export function characterClips(character: number): HeroClipTable {
  return COMBINED_CLIPS[character] ?? ORIGINAL_CLIPS[character] ?? heroDefinition(character)?.presentation.clips ?? NO_CLIPS;
}


export function clipFor(character: number, pose: HeroPose): HeroClip {
  const table = characterClips(character);
  return table[pose] ?? (pose === "jab2" || pose === "jab3" ? table.jab : undefined) ?? heroDefinition(character)?.presentation.fallback ?? STOCK_FALLBACK_CLIP;
}






export function platformClip(character: number, move: PlatformMove): HeroClip {
  switch (move) {
    case PlatformMove.ascent: return clipFor(character, "ledgeClimb");
    default: return clipFor(character, "ledgeHang");
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


interface GrabActionPoses {
  readonly holder: HeroPose;
  readonly victim: HeroPose;
}

const PUMMEL: GrabActionPoses = { holder: "pummel", victim: "victimPummel" };
const THROW_FORWARD: GrabActionPoses = { holder: "throwForward", victim: "victimThrowForward" };
const THROW_BACK: GrabActionPoses = { holder: "throwBack", victim: "victimThrowBack" };
const THROW_UP: GrabActionPoses = { holder: "throwUp", victim: "victimThrowUp" };
const THROW_DOWN: GrabActionPoses = { holder: "throwDown", victim: "victimThrowDown" };


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


export function attackPose(style: AttackStyle | undefined): HeroPose | undefined {
  switch (style) {
    case AttackStyle.neutralAir: return "neutralAir";
    case AttackStyle.forwardAir: return "forwardAir";
    case AttackStyle.backAir: return "backAir";
    case AttackStyle.upAir: return "upAir";
    case AttackStyle.downAir: return "downAir";
    case AttackStyle.jab: return "jab";
    case AttackStyle.jab2: return "jab2";
    case AttackStyle.jab3: return "jab3";
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


export function ownAttackClip(character: number, style: AttackStyle | undefined): HeroClip | undefined {
  const pose = ownAttackPose(style);
  return pose === undefined ? undefined : characterClips(character)[pose];
}


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


export function illidanSmashClips(style: AttackStyle | undefined): SmashClips {
  if (style === AttackStyle.upSmash) return DEMON_HUNTER_UP_SMASH_CHARGE;
  return style === AttackStyle.downSmash ? DEMON_HUNTER_DOWN_SMASH_CHARGE : DEMON_HUNTER_FORWARD_SMASH_CHARGE;
}


interface GroundingClips {
  readonly grounded: HeroClip;
  readonly air: HeroClip;
}

const MANA_BURN: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_NEUTRAL_INDEX, dh.DEMON_HUNTER_SPECIAL_NEUTRAL_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_NEUTRAL_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_NEUTRAL_AIR_SECONDS) };
const FEL_RUSH: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_SIDE_INDEX, dh.DEMON_HUNTER_SPECIAL_SIDE_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_SIDE_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_SIDE_AIR_SECONDS) };
const WING_ASCENT: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_UP_INDEX, dh.DEMON_HUNTER_SPECIAL_UP_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_UP_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_UP_AIR_SECONDS) };
const IMMOLATE: GroundingClips = { grounded: clip(dh.DEMON_HUNTER_SPECIAL_DOWN_INDEX, dh.DEMON_HUNTER_SPECIAL_DOWN_SECONDS), air: clip(dh.DEMON_HUNTER_SPECIAL_DOWN_AIR_INDEX, dh.DEMON_HUNTER_SPECIAL_DOWN_AIR_SECONDS) };
const RIFLEMAN_BLASTER: GroundingClips = { grounded: clip(assets.RIFLEMAN_SPECIAL_NEUTRAL_INDEX, assets.RIFLEMAN_SPECIAL_NEUTRAL_SECONDS), air: clip(assets.RIFLEMAN_SPECIAL_NEUTRAL_AIR_INDEX, assets.RIFLEMAN_SPECIAL_NEUTRAL_AIR_SECONDS) };


const RIFLEMAN_BEAR = clip(assets.RIFLEMAN_SPELL_INDEX, assets.RIFLEMAN_SPELL_SECONDS);
const RIFLEMAN_TRAP = clip(assets.RIFLEMAN_SPECIAL_DOWN_INDEX, assets.RIFLEMAN_SPECIAL_DOWN_SECONDS);
const RIFLEMAN_RECOVERY = clip(assets.RIFLEMAN_SPECIAL_UP_INDEX, assets.RIFLEMAN_SPECIAL_UP_SECONDS);

const byGrounding = (clips: GroundingClips, grounded: boolean): HeroClip => grounded ? clips.grounded : clips.air;






const ULTIMATE_POSES: { readonly [character: number]: HeroPose | undefined } = {
  [Character.blademaster]: "upSpecial", [Character.mountainKing]: "downSpecial", [Character.warden]: "neutralSpecial",
  [Character.lich]: "neutralSpecial", [Character.forsakenPaladin]: "downSpecial", [Character.dreadlord]: "neutralSpecial",
  [Character.shadowHunter]: "downSpecial", [Character.pitLord]: "grab", [Character.beastmaster]: "sideSpecial",
  [Character.lichKing]: "downSpecial", [Character.thrall]: "downSpecial", [Character.jaina]: "neutralSpecial",
  [Character.sylvanas]: "neutralSpecial", [Character.cairne]: "downSpecial", [Character.chen]: "downSpecial",
  [Character.peon]: "forwardSmash", [Character.tinker]: "sideSpecial", [Character.kaelthas]: "downSpecial",
  [Character.murloc]: "neutralSpecial", [Character.grom]: "sideSpecial", [Character.anubarak]: "neutralSpecial",
  [Character.malfurion]: "downSpecial", [Character.medivh]: "neutralSpecial", [Character.kobold]: "sideSpecial",
};

function ultimateClip(character: number, grounded: boolean): HeroClip {
  if (character === Character.rifleman) return RIFLEMAN_BEAR;
  if (character === Character.demonHunter) return byGrounding(IMMOLATE, grounded);
  return clipFor(character, ULTIMATE_POSES[character] ?? "neutralSpecial");
}

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
    case SpecialAction.demonHunterFelRush: return byGrounding(FEL_RUSH, grounded);
    case SpecialAction.demonHunterWingAscent: return byGrounding(WING_ASCENT, grounded);
    case SpecialAction.demonHunterImmolate: return byGrounding(IMMOLATE, grounded);
    case SpecialAction.riflemanBear: return RIFLEMAN_BEAR;
    case SpecialAction.riflemanTrap: return RIFLEMAN_TRAP;
    case SpecialAction.riflemanRecovery: return RIFLEMAN_RECOVERY;
    case SpecialAction.heroUltimate: return ultimateClip(character, grounded);
    default: return byGrounding(RIFLEMAN_BLASTER, !aerialShot);
  }
}
