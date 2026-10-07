import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";

export const RANDOM_STAGE = 15;
export type StageTile = 0 | 2 | 3 | 4 | 10 | 11 | 12 | 13 | 14;
export type StageChoice = StageTile | typeof RANDOM_STAGE;

export interface StageInfo<Choice extends StageChoice = StageTile> {
  readonly id: Choice;
  readonly name: string;
  readonly texture: string;
  readonly description: string;
}

/** The ranked eight, followed by the flat testing arena. */
export const STAGE_CATALOG: readonly StageInfo[] = [
  { id: 2, name: "Frozen Throne", texture: "war3mapImported\\SelectionFrozenThrone.tga", description: "Three icy platforms above Icecrown.\nFight beneath the Frozen Throne." },
  { id: 10, name: "Nordrassil", texture: "war3mapImported\\SelectionNordrassil.tga", description: "Three platforms beneath the World Tree.\nThe Ancients breathe alternating gusts." },
  { id: 11, name: "Gryphon Aerie", texture: "war3mapImported\\SelectionGryphon.tga", description: "Close quarters above Aerie Peak.\nA carried platform circles the arena." },
  { id: 3, name: "Durotar Skies", texture: "war3mapImported\\SelectionDurotar.tga", description: "Fight over Durotar's rocky spires.\nOne platform drifts from side to side." },
  { id: 4, name: "Naxxramas", texture: "war3mapImported\\SelectionNaxxramas.tga", description: "The Scourge citadel looms overhead.\nTwo platforms patrol their own routes." },
  { id: 14, name: "Hellfire Citadel", texture: "war3mapImported\\SelectionHellfire.tga", description: "Two steady platforms before the demon gate.\nHold your ground against the Legion." },
  { id: 12, name: "Blackrock", texture: "war3mapImported\\SelectionBlackrock.tga", description: "One forge platform above the molten depths.\nA swinging cannon offers a way back." },
  { id: 13, name: "Ahn'Qiraj", texture: "war3mapImported\\SelectionAhnQiraj.tga", description: "An open arena among ancient Qiraji ruins.\nA rising platform breaks the silence." },
  { id: 0, name: "Sky Deck (test)", texture: "war3mapImported\\SelectionSkyDeck.tga", description: "One open platform for practice and testing.\nRoom to fight, nowhere to hide." },
];

export function stageTileIndex(choice: number): number {
  for (let index = 0; index < STAGE_CATALOG.length; index++) if (at(STAGE_CATALOG, index).id === choice) return index;
  return 0;
}

/** Random is a menu choice, never part of the playable stage roster. */
export const STAGE_CHOICES: readonly StageInfo<StageChoice>[] = [
  { id: RANDOM_STAGE, name: "Random Stage", texture: "ReplaceableTextures\\CommandButtons\\BTNSelectHeroOn.blp", description: "Let fate choose the arena.\nAny available stage can be chosen." },
  ...STAGE_CATALOG,
];

/** A seeded integer draw, exact in Bun and Warcraft's Lua32. */
export function randomStage(seed: number): StageTile {
  const value = floorMod(seed, 46337);
  const mixed = floorMod(value * value + 12345, 46337);
  return at(STAGE_CATALOG, floorMod(mixed ^ floorMod(mixed * 31, 46337), STAGE_CATALOG.length)).id;
}

export const stageInfo = (choice: number): StageInfo<StageChoice> => choice === RANDOM_STAGE ? at(STAGE_CHOICES, 0) : at(STAGE_CATALOG, stageTileIndex(choice));

export function selectableStage(choice: number): choice is StageTile {
  return STAGE_CATALOG.some(stage => stage.id === choice);
}

export function selectableStageChoice(choice: number): choice is StageChoice {
  return choice === RANDOM_STAGE || selectableStage(choice);
}

export function nextStage(choice: number, direction: -1 | 1): StageChoice {
  const index = STAGE_CHOICES.findIndex(stage => stage.id === choice);
  return at(STAGE_CHOICES, floorMod(index + direction, STAGE_CHOICES.length)).id;
}
