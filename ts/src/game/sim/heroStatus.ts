



import { max, min, toInt } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { addFloat32, roundToFloat32 } from "wisp/src/sim/binary32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { advanceMash, clearMash } from "./mash";
import type { Fighter } from "./fighter";
import { type AttackBuffer, clearAttackBuffer } from "../input/attackBuffer";
import { type Controls, copyControls, neutralControls } from "./roster";
import { cancelAttack, cancelSpecialState } from "./transitions";
import { HERO_STATUS_GROUPS, HeroStatusKind, type HeroStatusGroup } from "./codes";
import { ROSTER_MANA, drainMana } from "./mana";



interface StatusRules {

  readonly blocksActions: boolean;

  readonly blocksSpecials: boolean;

  readonly endsOnDamage: boolean;

  readonly blocksAttacks?: boolean | undefined;

  readonly mashMinimum?: number | undefined;





  readonly carry?: { readonly speed: number; readonly rise: number } | undefined;
}

const RULES: { readonly [kind: number]: StatusRules | undefined } = {
  [HeroStatusKind.root]: { blocksActions: false, blocksSpecials: false, endsOnDamage: true },
  [HeroStatusKind.silence]: { blocksActions: false, blocksSpecials: true, endsOnDamage: false },

  [HeroStatusKind.sleep]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true, mashMinimum: 24 },


  [HeroStatusKind.hex]: { blocksActions: false, blocksSpecials: true, blocksAttacks: true, endsOnDamage: false, mashMinimum: 36 },

  [HeroStatusKind.chill]: { blocksActions: false, blocksSpecials: false, endsOnDamage: false },
  [HeroStatusKind.stun]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true },


  [HeroStatusKind.carried]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true, mashMinimum: 20, carry: { speed: 3.0, rise: 0.5 } },
};



export interface AppliedStatus {
  readonly kind: HeroStatusKind;
  readonly frames: number;
  readonly group: HeroStatusGroup;

  readonly immunityFrames: number;

  readonly tick?: { readonly every: number; readonly damage: number } | undefined;

  readonly airFrames?: number | undefined;




  readonly drain?: { readonly mana: number; readonly emptyFrames: number } | undefined;
}

const rules = (f: Readonly<Fighter>): StatusRules | undefined => RULES[f.status.condition];

/** The status's duration on a fighter left with `mana`; integer division keeps Lua32 and the host equal. */
export function heroStatusFrames(status: Readonly<AppliedStatus>, mana: number): number {
  const { drain } = status;
  if (drain === undefined) return status.frames;
  const empty = ROSTER_MANA.max - min(ROSTER_MANA.max, max(0, mana));
  return status.frames + floorDiv(drain.emptyFrames * empty, ROSTER_MANA.max);
}


export function heroStatusMashes(f: Readonly<Fighter>): boolean {
  return rules(f)?.mashMinimum !== undefined;
}


export function heroStatusBlocksActions(f: Readonly<Fighter>): boolean {
  return rules(f)?.blocksActions === true;
}


export function applyHeroStatus(f: Fighter, status: Readonly<AppliedStatus>): void {
  const { status: state } = f;

  if (status.kind === HeroStatusKind.poison) {
    if (state.out) return;
    state.poisonFrames = status.frames;
    state.poisonEvery = status.tick?.every ?? status.frames;
    state.poisonDamage = status.tick?.damage ?? 0.0;
    return;
  }
  if (state.out) return;
  if (status.drain !== undefined) drainMana(f, status.drain.mana);
  if ((state.conditionImmunity[status.group] ?? 0) > 0) return;
  state.condition = status.kind;
  state.conditionFrames = status.airFrames !== undefined && !f.motion.grounded ? status.airFrames : heroStatusFrames(status, f.mana.points);
  if (RULES[status.kind]?.mashMinimum !== undefined) clearMash(f.grab);
  state.conditionGroup = status.group;
  state.conditionImmunityFrames = status.immunityFrames;

  if (RULES[status.kind]?.blocksActions === true) {
    cancelAttack(f);
    cancelSpecialState(f);
  }
}


function endHeroStatus(f: Fighter): void {
  const { status } = f;
  if (status.condition === HeroStatusKind.none) return;
  status.conditionImmunity[status.conditionGroup] = max(status.conditionImmunity[status.conditionGroup] ?? 0, status.conditionImmunityFrames);
  status.condition = HeroStatusKind.none;
  status.conditionFrames = 0;
}


export function cleansePoisonAndSlow(f: Fighter): void {
  f.status.poisonFrames = 0;
  f.status.poisonEvery = 0;
  f.status.poisonDamage = 0.0;
  if (f.status.condition === HeroStatusKind.chill) endHeroStatus(f);
}


export function damageEndsHeroStatus(f: Fighter): void {
  if (rules(f)?.endsOnDamage === true) endHeroStatus(f);
}


export function advanceHeroConditions(f: Fighter): void {
  const { status } = f;
  if (status.poisonFrames > 0) {
    status.poisonFrames--;
    if (floorMod(status.poisonFrames, status.poisonEvery) === 0) status.damage = addFloat32(roundToFloat32(status.damage), status.poisonDamage);
  }
  for (let group = 0; group < HERO_STATUS_GROUPS; group++) {
    const left = status.conditionImmunity[group] ?? 0;
    if (left > 0) status.conditionImmunity[group] = left - 1;
  }
  if (status.condition === HeroStatusKind.none) return;
  status.conditionFrames--;
  if (status.conditionFrames <= 0) endHeroStatus(f);
}


export function clearHeroStatus(f: Fighter): void {
  const { status } = f;
  status.condition = HeroStatusKind.none;
  status.conditionFrames = 0;
  status.conditionGroup = 0;
  status.conditionImmunityFrames = 0;
  for (let group = 0; group < HERO_STATUS_GROUPS; group++) status.conditionImmunity[group] = 0;
  status.poisonFrames = 0;
  status.poisonEvery = 0;
  status.poisonDamage = 0.0;
}

const NEUTRAL = neutralControls();






export function maskHeroStatusControls(f: Fighter, input: Controls, commands: AttackBuffer): void {
  const active = rules(f);
  if (active === undefined) return;
  if (active.mashMinimum !== undefined) f.status.conditionFrames = advanceMash(f.grab, input, f.status.conditionFrames, active.mashMinimum) + 1;
  if (active.blocksActions) {
    copyControls(input, NEUTRAL);
    clearAttackBuffer(commands);
    return;
  }
  if (active.blocksAttacks === true) {
    clearAttackBuffer(commands);
    input.attackRequested = false;
    input.attackPressed = false;
    input.getupAttackPressed = false;
  }
  if (active.blocksSpecials && input.specialZ <= 0) input.specialPressed = false;
}






export function carryHeroStatus(f: Fighter): boolean {
  const carry = rules(f)?.carry;
  if (carry === undefined || f.launch.hitstun > 0) return false;
  const { motion } = f;
  motion.vx = f32(-f.facing * carry.speed);
  motion.vz = carry.rise;
  motion.fastFalling = false;
  if (motion.grounded) {
    motion.grounded = false;
    motion.surface = undefined;
  }
  return true;
}
