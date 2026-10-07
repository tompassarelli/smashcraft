// Timed conditions a hero's hit applies to a body (smashcraft:docs/design/roster.md
// "Defense and status limits"): one at a time per fighter, a shield stops
// them, and when one ends its group grants an immunity window so two sources
// cannot chain it. Every value here is fighter state, so rollback restores it.
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


/** What a status prevents and what ends it early. */
interface StatusRules {
  /** No action of any kind: the fighter keeps its velocity and gravity. */
  readonly blocksActions: boolean;
  /** Neutral, side and down specials refuse; up special still recovers. */
  readonly blocksSpecials: boolean;
  /** The next damaging hit ends it. */
  readonly endsOnDamage: boolean;
  /** No attack, aerial or grab starts: movement, jumps, shield, dodges and DI stay (Hex). */
  readonly blocksAttacks?: boolean | undefined;
  /** The fighter mashes out with the grab and freeze rule (sim/mash.ts), never before this many frames. */
  readonly mashMinimum?: number | undefined;
  /** Scales the damage of every hit the fighter deals; 1 when absent. */
  readonly damageDealt?: number | undefined;
  /**
   * Carried away (Val'kyr Shadowguard): each frame the fighter moves `speed`
   * toward its back and rises `rise`, with no gravity or drift; it faces the
   * way it was struck from, so its back is the way the carrier flew.
   */
  readonly carry?: { readonly speed: number; readonly rise: number } | undefined;
}

const RULES: { readonly [kind: number]: StatusRules | undefined } = {
  [HeroStatusKind.silence]: { blocksActions: false, blocksSpecials: true, endsOnDamage: false },
  // Sleep (#132): mashed out as a freeze is, never before frame 24.
  [HeroStatusKind.sleep]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true, mashMinimum: 24 },
  // Hex (#133): a critter that cannot attack, grab or cast, mashed out never before frame 36: past
  // Shadow Hunter's own cast recovery after a point-blank hit, so he can cash it (#105).
  [HeroStatusKind.hex]: { blocksActions: false, blocksSpecials: true, blocksAttacks: true, endsOnDamage: false, mashMinimum: 36 },
  // Chill only lowers top speeds (sim/chill.ts).
  [HeroStatusKind.chill]: { blocksActions: false, blocksSpecials: false, endsOnDamage: false },
  [HeroStatusKind.stun]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true },
  // Howl of Terror: every hit the fighter deals does 10 percent less damage; nothing else changes.
  [HeroStatusKind.terror]: { blocksActions: false, blocksSpecials: false, endsOnDamage: false, damageDealt: f32(0.9) },
  // Val'kyr Shadowguard (#167): carried toward the ledge behind the victim; mashed out never before frame 20, and any
  // damaging hit, the Lich King's included, drops it, so the carry can't be extended into a combo.
  [HeroStatusKind.carried]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true, mashMinimum: 20, carry: { speed: 3.0, rise: 0.5 } },
};


/** An authored status a hit applies. */
export interface AppliedStatus {
  readonly kind: HeroStatusKind;
  readonly frames: number;
  readonly group: HeroStatusGroup;
  /** Immunity to the group once the status ends, by time or by a hit. */
  readonly immunityFrames: number;
  /** Poison's damage: `damage` every `every` frames of its `frames`, with no hitlag, hitstun or knockback. */
  readonly tick?: { readonly every: number; readonly damage: number } | undefined;
  /** Its frames instead when it reaches an airborne fighter (Sleep: an offstage hit is an opening, not a KO). */
  readonly airFrames?: number | undefined;
  /**
   * Mana Burn's: takes `mana` from the body it reaches, immune or not, then
   * lasts up to `emptyFrames` more in proportion to how empty that leaves it.
   */
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

/** Whether the fighter's status is mashed out of (Sleep), as a freeze is. */
export function heroStatusMashes(f: Readonly<Fighter>): boolean {
  return rules(f)?.mashMinimum !== undefined;
}

/** Whether the fighter's status stops every action: no input changes anything while it lasts. */
export function heroStatusBlocksActions(f: Readonly<Fighter>): boolean {
  return rules(f)?.blocksActions === true;
}

/** The factor the fighter's status applies to the damage of each hit it deals (Terror's 0.9). */
export function heroStatusDamageDealt(f: Readonly<Fighter>): number {
  return rules(f)?.damageDealt ?? 1.0;
}

/** Applies the status unless the fighter is immune to its group; a reapplication refreshes it. */
export function applyHeroStatus(f: Fighter, status: Readonly<AppliedStatus>): void {
  const { status: state } = f;
  // Poison has its own slot: it neither replaces nor waits on the condition, and does not stack.
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
  // A status that stops every action also stops the one in progress.
  if (RULES[status.kind]?.blocksActions === true) {
    cancelAttack(f);
    cancelSpecialState(f);
  }
}

/** Ends the fighter's status and starts its group's immunity. */
function endHeroStatus(f: Fighter): void {
  const { status } = f;
  if (status.condition === HeroStatusKind.none) return;
  status.conditionImmunity[status.conditionGroup] = max(status.conditionImmunity[status.conditionGroup] ?? 0, status.conditionImmunityFrames);
  status.condition = HeroStatusKind.none;
  status.conditionFrames = 0;
}

/** A damaging body hit ends a status that ends on damage; the hit that applies one is resolved first. */
export function damageEndsHeroStatus(f: Fighter): void {
  if (rules(f)?.endsOnDamage === true) endHeroStatus(f);
}

/** One frame of status and immunity time; it runs during hitlag too. */
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

/** A new stock or round starts without a status or immunity. */
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

/**
 * Removes the frame's inputs a status forbids, before anything reads them. A
 * mashable status first counts the frame's mash inputs; the status countdown
 * later this frame takes its one frame off.
 */
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

/**
 * A carried fighter's velocity for this frame, set before its motion
 * integrates; true when the carry holds it, so steering, drag and gravity
 * leave the velocity alone.
 */
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
