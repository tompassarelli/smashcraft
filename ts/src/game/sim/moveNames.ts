// What every fighter's moves are called, read from its kit data: a hero's
// SpecialKit.name and HeroDefinition.passive/ultimate, an original fighter's
// ORIGINAL_KITS record. Specials, passives and ultimates have official names;
// normals go by their input. smashcraft:docs/move-list.md, the Moves page and
// training's readout all read this view.
import { at } from "wisp/src/runtime/lookup";
import { SpecialAction } from "./codes";
import type { NamedMove } from "./heroes/hero";
import { heroDefinition } from "./heroes/registry";
import type { FighterMoves } from "./heroMoves";
import { FOLLOW_UP_FORM, type AuthoredSpecial, type SpecialKit, SpecialForm, SpecialSlot, specialForm, specialKit } from "./heroSpecials";
import { ORIGINAL_KITS } from "./originalKits";

/** A form the design names on its own, by the running special's form code. */
export interface NamedForm {
  readonly form: number;
  readonly name: string;
}

export interface SpecialText extends NamedMove {
  readonly forms: readonly NamedForm[];
}

export interface FighterKitText {
  /** Neutral, side, up and down, in SpecialSlot order. */
  readonly specials: readonly SpecialText[];
  /** Undefined for a fighter the design gives no passive; `trait` then says what its hits do. */
  readonly passive: NamedMove | undefined;
  readonly trait: string | undefined;
  /** The jab chain: every fighter's repeated jab (#163). */
  readonly jab: NamedMove;
  readonly ultimate?: NamedMove | undefined;
  /** Docs only: normals and throws by input name, with what each draws on. */
  readonly inspiredBy: readonly { readonly move: string; readonly note: string }[];
}

/** Normals by AttackStyle code, named by their input as players call them. */
export const NORMAL_NAMES: readonly string[] = [
  "Jab", "Shot", "Up smash", "Down smash", "Forward smash", "Grab", "Forward tilt", "Up tilt", "Down tilt", "Forward tilt (up)",
  "Forward tilt (down)", "Get-up attack", "Neutral air", "Forward air", "Back air", "Up air", "Down air", "Ledge attack", "Dash attack", "Dash attack",
  "Second jab", "Third jab",
];

/** Pummel and throws by GrabAction code. */
const GRAB_NAMES: readonly string[] = ["", "", "Pummel", "Forward throw", "Back throw", "Up throw", "Down throw"];

export const SPECIAL_INPUTS = ["Neutral special", "Side special", "Up special", "Down special"] as const;

export function normalName(style: number): string {
  return NORMAL_NAMES[style] ?? "Attack";
}

const BASE_FORMS = [SpecialForm.ground, SpecialForm.air, SpecialForm.free, SpecialForm.recall, SpecialForm.marked] as const;

function namedForms(kit: Readonly<SpecialKit>): NamedForm[] {
  const forms: NamedForm[] = [];
  const add = (form: number, special: Readonly<AuthoredSpecial>) => {
    const { name } = special;
    if (name === undefined || name === kit.name) return;
    for (const named of forms) if (named.name === name) return;
    forms.push({ form, name });
  };
  for (const base of BASE_FORMS) {
    const special = specialForm(kit, base);
    if (base !== SpecialForm.ground && special === kit.ground) continue;
    add(base, special);
    const followUps = special.followUps ?? [];
    for (let index = 0; index < followUps.length; index++) {
      const followUp = followUps[index];
      if (followUp !== undefined) add(base + FOLLOW_UP_FORM * (index + 1), followUp.special);
    }
  }
  return forms;
}

function notes(names: readonly string[], table: { readonly [code: number]: string | undefined }): { move: string; note: string }[] {
  const result: { move: string; note: string }[] = [];
  for (let code = 0; code < names.length; code++) {
    const note = table[code];
    if (note !== undefined) result.push({ move: names[code] ?? "Attack", note });
  }
  return result;
}

function heroInspirations(moves: Readonly<FighterMoves>): { move: string; note: string }[] {
  const normals: { [style: number]: string | undefined } = {};
  const throws: { [action: number]: string | undefined } = {};
  for (let style = 0; style < NORMAL_NAMES.length; style++) normals[style] = moves.normals[style]?.inspiredBy;
  for (let action = 0; action < GRAB_NAMES.length; action++) throws[action] = moves.throws[action]?.inspiredBy;
  return [...notes(NORMAL_NAMES, normals), ...notes(GRAB_NAMES, throws)];
}

/** The fighter's specials, passive and ultimate as players see them. */
export function fighterKit(character: number): FighterKitText {
  const hero = heroDefinition(character);
  if (hero !== undefined) {
    const { specials } = hero;
    const slots = [SpecialSlot.neutral, SpecialSlot.side, SpecialSlot.up, SpecialSlot.down];
    return {
      specials: specials === undefined ? [] : slots.map((slot) => {
        const kit = specialKit(specials, slot);
        return { name: kit.name, description: kit.description, forms: namedForms(kit) };
      }),
      passive: hero.passive,
      trait: undefined,
      jab: hero.jab,
      ultimate: hero.ultimate,
      inspiredBy: heroInspirations(hero.moves),
    };
  }
  const original = ORIGINAL_KITS[character] ?? at(ORIGINAL_KITS, 0);
  return {
    specials: original.specials.map((special) => ({ name: special.name, description: special.description, forms: special.forms ?? [] })),
    passive: original.passive,
    trait: original.trait,
    jab: original.jab,
    ultimate: original.ultimate,
    inspiredBy: notes(NORMAL_NAMES, original.inspiredBy ?? {}),
  };
}

/** The name of a running special: its named form's, else the special's. */
export function specialName(character: number, action: number, form: number): string {
  const hero = heroDefinition(character);
  if (hero !== undefined) {
    const { specials } = hero;
    if (specials === undefined || action < SpecialAction.heroNeutral || action > SpecialAction.heroDown) return "Special";
    const kit = specialKit(specials, action - SpecialAction.heroNeutral);
    return specialForm(kit, form).name ?? kit.name;
  }
  const original = ORIGINAL_KITS[character];
  if (original === undefined) return "Special";
  for (const special of original.specials) {
    if (special.action !== action) continue;
    for (const named of special.forms ?? []) if (named.form === form) return named.name;
    return special.name;
  }
  return "Special";
}
