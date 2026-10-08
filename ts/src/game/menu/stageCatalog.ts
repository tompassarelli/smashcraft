import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";

export const RANDOM_STAGE = 15;
export type StageTile = 0 | 2 | 3 | 4 | 6 | 7 | 10 | 11 | 12 | 13 | 14;
export type StageChoice = StageTile | typeof RANDOM_STAGE;

export interface StageInfo<Choice extends StageChoice = StageTile> {
  readonly id: Choice;
  readonly name: string;
  /**
   * The card's picture, square: Warcraft's own campaign loading art for the
   * stage's zone, or for a stage with none, its hero-camera render
   * (scripts/stageThumbnails.ts; smashcraft:docs/design/stage-select.md).
   */
  readonly texture: string;
  readonly description: string;
}

/** The ranked ten, followed by the flat testing arena. */
export const STAGE_CATALOG: readonly StageInfo[] = [
  { id: 2, name: "Frozen Throne", texture: "UI\\Glues\\Loading\\Backgrounds\\Campaigns\\IcecrownExpansion-TopLeft.blp", description: "Three icy platforms above Icecrown.\nFight beneath the Frozen Throne." },
  { id: 10, name: "Nordrassil", texture: "UI\\Glues\\Loading\\Backgrounds\\Campaigns\\AshenvaleExpansion-TopLeft.blp", description: "Three platforms beneath the World Tree.\nThe Ancients breathe alternating gusts." },
  { id: 11, name: "Gryphon Aerie", texture: "war3mapImported\\StageCardGryphon.blp", description: "Close quarters above Aerie Peak.\nA carried platform circles the arena." },
  { id: 3, name: "Durotar Skies", texture: "UI\\Glues\\Loading\\Backgrounds\\Campaigns\\BarrensExpansion-TopLeft.blp", description: "Fight over Durotar's rocky spires.\nOne platform drifts from side to side." },
  { id: 4, name: "Naxxramas", texture: "UI\\Glues\\Loading\\Backgrounds\\Campaigns\\LordaeronExpansion-TopLeft.blp", description: "The Scourge citadel looms overhead.\nTwo platforms patrol their own routes." },
  { id: 14, name: "Hellfire Citadel", texture: "UI\\Glues\\Loading\\Backgrounds\\Campaigns\\OutlandExpansion-TopLeft.blp", description: "Two steady platforms before the demon gate.\nHold your ground against the Legion." },
  { id: 12, name: "Blackrock", texture: "war3mapImported\\StageCardBlackrock.blp", description: "One forge platform above the molten depths.\nA swinging cannon offers a way back." },
  { id: 13, name: "Ahn'Qiraj", texture: "war3mapImported\\StageCardAhnQiraj.blp", description: "An open arena among ancient Qiraji ruins.\nA rising platform breaks the silence." },
  { id: 6, name: "Stratholme", texture: "UI\\Glues\\Loading\\Backgrounds\\Campaigns\\Lordaeron-TopLeft.blp", description: "Rooftops over a burning city at dusk.\nTwo low balconies, one high roof." },
  { id: 7, name: "Tomb of Sargeras", texture: "UI\\Glues\\Loading\\Backgrounds\\Campaigns\\DrownedRuinsExpansion-TopLeft.blp", description: "Sunken ruins awash in the tide.\nTwo platforms reach out past the edges." },
  { id: 0, name: "Sky Deck (test)", texture: "war3mapImported\\StageCardSkyDeck.blp", description: "One open platform for practice and testing.\nRoom to fight, nowhere to hide." },
];

export function stageTileIndex(choice: number): number {
  for (let index = 0; index < STAGE_CATALOG.length; index++) if (at(STAGE_CATALOG, index).id === choice) return index;
  return 0;
}

/** Random is a menu choice, never part of the playable stage roster. */
export const STAGE_CHOICES: readonly StageInfo<StageChoice>[] = [
  { id: RANDOM_STAGE, name: "Random Stage", texture: "ReplaceableTextures\\CommandButtons\\BTNSelectHeroOn.blp", description: "Choose from your stage pool.\nEach stage plays once before repeating." },
  ...STAGE_CATALOG,
];

/** A seeded integer draw, exact in Bun and Warcraft's Lua32. */
export function randomStage(seed: number, mask?: number): StageTile {
  const value = floorMod(seed, 46337);
  const mixed = floorMod(value * value + 12345, 46337);
  const stages = mask === undefined ? STAGE_CATALOG : STAGE_CATALOG.filter(stage => (mask & (1 << stage.id)) !== 0);
  return at(stages, floorMod(mixed ^ floorMod(mixed * 31, 46337), stages.length)).id;
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
