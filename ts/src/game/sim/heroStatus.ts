// Timed conditions a hero's hit applies to a body (smashcraft:docs/design/roster.md
// "Defense and status limits"): one at a time per fighter, a shield stops
// them, and when one ends its group grants an immunity window so two sources
// cannot chain it. Every value here is fighter state, so rollback restores it.
import { max } from "../../runtime/numbers";
import type { Fighter } from "./fighter";
import { type AttackBuffer, clearAttackBuffer } from "../input/attackBuffer";
import { type Controls, copyControls, neutralControls } from "./roster";
import { cancelAttack, cancelSpecialState } from "./transitions";
import { HERO_STATUS_GROUPS, HeroStatusKind, type HeroStatusGroup } from "./codes";


/** What a status prevents and what ends it early. */
interface StatusRules {
  /** No action of any kind: the fighter keeps its velocity and gravity. */
  readonly blocksActions: boolean;
  /** Neutral, side and down specials refuse; up special still recovers. */
  readonly blocksSpecials: boolean;
  /** The next damaging hit ends it. */
  readonly endsOnDamage: boolean;
}

const RULES: { readonly [kind: number]: StatusRules | undefined } = {
  [HeroStatusKind.sleep]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true },
};

/** An authored status a hit applies. */
export interface AppliedStatus {
  readonly kind: HeroStatusKind;
  readonly frames: number;
  readonly group: HeroStatusGroup;
  /** Immunity to the group once the status ends, by time or by a hit. */
  readonly immunityFrames: number;
}

const rules = (f: Readonly<Fighter>): StatusRules | undefined => RULES[f.status.condition];

/** Applies the status unless the fighter is immune to its group; a reapplication refreshes it. */
export function applyHeroStatus(f: Fighter, status: Readonly<AppliedStatus>): void {
  const { status: state } = f;
  if (state.out || (state.conditionImmunity[status.group] ?? 0) > 0) return;
  state.condition = status.kind;
  state.conditionFrames = status.frames;
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
}

const NEUTRAL = neutralControls();

/** Removes the frame's inputs a status forbids, before anything reads them. */
export function maskHeroStatusControls(f: Readonly<Fighter>, input: Controls, commands: AttackBuffer): void {
  const active = rules(f);
  if (active === undefined) return;
  if (active.blocksActions) {
    copyControls(input, NEUTRAL);
    clearAttackBuffer(commands);
    return;
  }
  if (active.blocksSpecials && input.specialZ <= 0) input.specialPressed = false;
}
