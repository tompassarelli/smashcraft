// The expansion heroes by Character code, in the roster's build order. A hero
// joins selection only when its definition is marked complete.
import { floorMod } from "wisp/src/sim/intMath";
import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { BEASTMASTER_HERO } from "./beastmasterHero";
import { BLADEMASTER_HERO } from "./blademasterHero";
import { DREADLORD_HERO } from "./dreadlordHero";
import { LICH_HERO } from "./lichHero";
import { MOUNTAIN_KING_HERO } from "./mountainKingHero";
import { PIT_LORD_HERO } from "./pitLordHero";
import { SHADOW_HUNTER_HERO } from "./shadowHunterHero";
import { UTHER_HERO } from "./utherHero";
import { WARDEN_HERO } from "./wardenHero";

export const HERO_ROSTER: readonly HeroDefinition[] = [
  BLADEMASTER_HERO, MOUNTAIN_KING_HERO, WARDEN_HERO, LICH_HERO, UTHER_HERO, DREADLORD_HERO, SHADOW_HUNTER_HERO, PIT_LORD_HERO, BEASTMASTER_HERO,
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

/** The fighters players may choose, in roster-tile order. */
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

/** The selectable fighter `direction` steps from `current` in tile order, wrapping. */
export function nextSelectableCharacter(current: number | undefined, direction: number): Character {
  const count = SELECTABLE_CHARACTERS.length;
  let index = 0;
  for (let i = 0; i < count; i++) if (SELECTABLE_CHARACTERS[i] === current) index = i;
  return SELECTABLE_CHARACTERS[floorMod(index + direction, count)] ?? Character.archer;
}

const ORIGINAL_ART = ["Archer", "Rifleman", "DemonHunter"] as const;

/** The fighter's portrait texture: a hero's own, or an original fighter's imported tile or portrait art. */
export function fighterPortrait(character: number, tile: boolean): string {
  const hero = heroDefinition(character);
  return hero === undefined ? `war3mapImported\\${ORIGINAL_ART[character] ?? "Archer"}${tile ? "Tile" : "Portrait"}.tga` : hero.presentation.portrait;
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
