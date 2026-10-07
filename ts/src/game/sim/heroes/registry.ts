// The expansion heroes by Character code, in the roster's build order. A hero
// joins selection only when its definition is marked complete.
import { floorMod } from "wisp/src/sim/intMath";
import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { BEASTMASTER_HERO } from "./beastmasterHero";
import { BLADEMASTER_HERO } from "./blademasterHero";
import { DREADLORD_HERO } from "./dreadlordHero";
import { LICH_HERO } from "./lichHero";
import { LICH_KING_HERO } from "./lichKingHero";
import { MOUNTAIN_KING_HERO } from "./mountainKingHero";
import { PIT_LORD_HERO } from "./pitLordHero";
import { SHADOW_HUNTER_HERO } from "./shadowHunterHero";
import { SYLVANAS_HERO } from "./sylvanasHero";
import { UTHER_HERO } from "./utherHero";
import { WARDEN_HERO } from "./wardenHero";
import { HIDDEN_FIGHTERS } from "./releaseRoster";

export const HERO_ROSTER: readonly HeroDefinition[] = [
  BLADEMASTER_HERO, MOUNTAIN_KING_HERO, WARDEN_HERO, LICH_HERO, UTHER_HERO, DREADLORD_HERO, SHADOW_HUNTER_HERO, PIT_LORD_HERO, BEASTMASTER_HERO, LICH_KING_HERO,
  SYLVANAS_HERO,
];

const BY_CHARACTER: { readonly [character: number]: HeroDefinition | undefined } = {
  [Character.blademaster]: BLADEMASTER_HERO,
  [Character.mountainKing]: MOUNTAIN_KING_HERO,
  [Character.warden]: WARDEN_HERO,
  [Character.lich]: LICH_HERO,
  [Character.uther]: UTHER_HERO,
  [Character.dreadlord]: DREADLORD_HERO,
  [Character.shadowHunter]: SHADOW_HUNTER_HERO,
  [Character.pitLord]: PIT_LORD_HERO,
  [Character.beastmaster]: BEASTMASTER_HERO,
  [Character.lichKing]: LICH_KING_HERO,
  [Character.sylvanas]: SYLVANAS_HERO,
};

export function heroDefinition(character: number): HeroDefinition | undefined {
  return BY_CHARACTER[character];
}

/** The original fighters first, then every complete hero in build order. */
export function selectableCharactersOf(roster: readonly HeroDefinition[]): readonly Character[] {
  const choices: Character[] = [Character.archer, Character.rifleman, Character.demonHunter];
  for (const hero of roster) if (hero.complete) choices.push(hero.character);
  return choices;
}

/** Every finished fighter, in roster-tile order: measurement tools and named dev commands use all of them; selection uses PLAYABLE_CHARACTERS. */
export const SELECTABLE_CHARACTERS: readonly Character[] = selectableCharactersOf(HERO_ROSTER);

export function isSelectableCharacter(choice: number): choice is Character {
  for (const character of SELECTABLE_CHARACTERS) if (character === choice) return true;
  return false;
}

const ORIGINAL_NAMES = ["Archer", "Rifleman", "Illidan"] as const;

/** The fighter's name as players see it. */
export function fighterName(character: number): string {
  return heroDefinition(character)?.name ?? ORIGINAL_NAMES[character] ?? "Archer";
}

/** The fighter in `choices` that `direction` steps from `current`, wrapping; from a fighter not in `choices`, the first or last. */
export function nextCharacterIn(choices: readonly Character[], current: number | undefined, direction: number): Character {
  const count = choices.length;
  let index = -1;
  for (let i = 0; i < count; i++) if (choices[i] === current) index = i;
  if (index < 0) return choices[direction < 0 ? count - 1 : 0] ?? Character.archer;
  return choices[floorMod(index + direction, count)] ?? Character.archer;
}

/** The playable fighter `direction` steps from `current` in tile order, wrapping. */
export function nextSelectableCharacter(current: number | undefined, direction: number): Character {
  return nextCharacterIn(PLAYABLE_CHARACTERS, current, direction);
}

/**
 * The fighters with rendered portraits (tools/selection/render-fighters.ts);
 * the map imports each one's tile and card. A fighter missing here shows its
 * Warcraft command icon.
 */
export const RENDERED_FIGHTERS: readonly Character[] = [
  Character.archer, Character.rifleman, Character.demonHunter, Character.blademaster, Character.mountainKing, Character.warden,
  Character.lich, Character.uther, Character.dreadlord, Character.shadowHunter, Character.pitLord, Character.beastmaster, Character.lichKing,
];

/** The name a fighter's rendered portraits are filed under: "MountainKing". */
export const fighterRenderName = (character: number): string => fighterName(character).split(" ").join("");

/**
 * A fighter's rendered portraits: the grid tile (head and shoulders on the shared
 * background), the card (full body), the HUD bust (head and shoulders, clear
 * background) and the stock icon (head).
 */
export type PortraitKind = "Tile" | "Card" | "Bust" | "Stock";
export const PORTRAIT_KINDS: readonly PortraitKind[] = ["Tile", "Card", "Bust", "Stock"];

/** The fighter's portrait texture of `kind`, or its hero's command icon. */
export function fighterPortrait(character: number, kind: PortraitKind, slot?: number): string {
  for (const rendered of RENDERED_FIGHTERS) {
    if (rendered === character) return `war3mapImported\\Fighter${kind}${fighterRenderName(character)}${slot === undefined ? "" : `P${slot + 1}`}.tga`;
  }
  return fighterIcon(character);
}

const ORIGINAL_ICONS = ["BTNArcher", "BTNRifleman", "BTNHeroDemonHunter"] as const;

/** The fighter's Warcraft command icon. */
export function fighterIcon(character: number): string {
  return heroDefinition(character)?.presentation.portrait ?? `ReplaceableTextures\\CommandButtons\\${ORIGINAL_ICONS[character] ?? "BTNArcher"}.blp`;
}

const ORIGINAL_SLUGS = ["archer", "rifleman", "illidan"] as const;

/** The fighter's name in commands and soak records: "archer", "illidan", "mountain-king". */
export function fighterSlug(character: number): string {
  const hero = heroDefinition(character);
  return hero === undefined ? ORIGINAL_SLUGS[character] ?? "archer" : hero.name.toLowerCase().split(" ").join("-");
}

/** The selectable fighters by slug, for tools that name fighters on the command line. */
export function selectableCharacterBySlug(slug: string): Character | undefined {
  for (const character of SELECTABLE_CHARACTERS) if (fighterSlug(character) === slug) return character;
  return undefined;
}

/** `selectable` without the fighters whose slugs `hidden` names; never empty. */
export function playableCharactersOf(selectable: readonly Character[], hidden: readonly string[]): readonly Character[] {
  const choices: Character[] = [];
  for (const character of selectable) {
    let shown = true;
    for (const slug of hidden) if (fighterSlug(character) === slug) shown = false;
    if (shown) choices.push(character);
  }
  return choices.length === 0 ? selectable.slice(0, 1) : choices;
}

/** The fighters players and computers choose from on the selection screen: the release roster (releaseRoster.ts). */
export const PLAYABLE_CHARACTERS: readonly Character[] = playableCharactersOf(SELECTABLE_CHARACTERS, HIDDEN_FIGHTERS);
