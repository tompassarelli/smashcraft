




import { at } from "wisp/src/runtime/lookup";
import { SpecialAction } from "./codes";
import type { NamedMove } from "./heroes/hero";
import { heroDefinition } from "./heroes/registry";
import type { FighterMoves } from "./heroMoves";
import { FOLLOW_UP_FORM, type AuthoredSpecial, type SpecialKit, SpecialForm, SpecialSlot, specialForm, specialKit } from "./heroSpecials";
import { ORIGINAL_KITS } from "./originalKits";


export interface NamedForm {
  readonly form: number;
  readonly name: string;
}

export interface SpecialText extends NamedMove {
  readonly forms: readonly NamedForm[];
}

export interface FighterKitText {

  readonly specials: readonly SpecialText[];
  readonly trait: string | undefined;

  readonly jab: NamedMove;
  readonly ultimate?: NamedMove | undefined;

  readonly inspiredBy: readonly { readonly move: string; readonly note: string }[];
}


export const NORMAL_NAMES: readonly string[] = [
  "Jab", "Shot", "Up smash", "Down smash", "Forward smash", "Grab", "Forward tilt", "Up tilt", "Down tilt", "Forward tilt (up)",
  "Forward tilt (down)", "Get-up attack", "Neutral air", "Forward air", "Back air", "Up air", "Down air", "Ledge attack", "Dash attack", "Dash attack",
  "Second jab", "Third jab",
];


const GRAB_NAMES: readonly string[] = ["", "", "Pummel", "Forward throw", "Back throw", "Up throw", "Down throw"];

export const SPECIAL_INPUTS = ["Neutral special", "Side special", "Up special", "Down special"] as const;

export function normalName(style: number): string {
  return NORMAL_NAMES[style] ?? "Attack";
}

const BASE_FORMS = [SpecialForm.ground, SpecialForm.air, SpecialForm.recall, SpecialForm.marked] as const;

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
      trait: undefined,
      jab: hero.jab,
      ultimate: hero.ultimate,
      inspiredBy: heroInspirations(hero.moves),
    };
  }
  const original = ORIGINAL_KITS[character];
  if (original === undefined) throw new Error(`Unknown fighter ${character}`);
  return {
    specials: original.specials.map((special) => ({ name: special.name, description: special.description, forms: special.forms ?? [] })),
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
