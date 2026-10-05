// The build and running map consume these same object definitions.
import { CHUNKS_PER_FILE, FILE_IO_ABILITY } from "waygate/src/runtime/gameFiles";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "./presentation/fighterAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "./presentation/demonHunterAssetInfo";
import { Character } from "./sim/codes";

export interface FighterObject {
  readonly base: string;
  readonly id: number;
  readonly name: string;
  readonly model: string;
  readonly artVersion: number;
  readonly scale: number;
  readonly blendTime: number;
  readonly selectionScale: number;
  readonly moveSpeed: number;
  readonly attackCooldown: number;
}

const fighterFields = {
  artVersion: 0,
  scale: 1.0,
  // Blending can hold the previous pose throughout hitlag.
  blendTime: 0.0,
  selectionScale: 0.0,
  // Native movement/attacks are paused; Smashcraft's simulation owns both.
  moveSpeed: 270.0,
  attackCooldown: 1.5,
} as const;

export const FIGHTER_OBJECTS: Readonly<Record<Character, FighterObject>> = {
  [Character.archer]: { ...fighterFields, base: "earc", id: 0x6d666172, name: "Archer", model: ARCHER_MODEL_FILE },
  [Character.rifleman]: { ...fighterFields, base: "hrif", id: 0x6d667266, name: "Rifleman", model: RIFLEMAN_MODEL_FILE },
  [Character.demonHunter]: { ...fighterFields, base: "earc", id: 0x6d666468, name: "Illidan", model: DEMON_HUNTER_MODEL_FILE },
};

/** Explicit order for archive emission and synchronized native application. */
export const FIGHTER_OBJECT_ORDER = [Character.archer, Character.rifleman, Character.demonHunter] as const;

/** FileIO's channel ability uses one tooltip per file chunk. */
export const FILE_IO_OBJECT = {
  base: "ANcl",
  id: FILE_IO_ABILITY,
  levels: CHUNKS_PER_FILE,
  tooltip: " ",
} as const;
