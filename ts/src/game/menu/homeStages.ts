import { Character } from "../sim/codes";

/**
 * Each selectable fighter's home stage: the place you would meet them in a
 * Warcraft campaign (smashcraft:docs/design/home-stages.md gives the lore).
 * Stage ids are smashcraft:ts/src/game/menu/stageCatalog.ts tiles.
 */
export const HOME_STAGES: readonly { readonly character: Character; readonly stage: number }[] = [
  { character: Character.archer, stage: 10 },
  { character: Character.rifleman, stage: 11 },
  { character: Character.demonHunter, stage: 14 },
  { character: Character.blademaster, stage: 3 },
  { character: Character.mountainKing, stage: 12 },
  { character: Character.warden, stage: 7 },
  { character: Character.lich, stage: 4 },
  { character: Character.forsakenPaladin, stage: 6 },
  { character: Character.dreadlord, stage: 6 },
  { character: Character.shadowHunter, stage: 3 },
  { character: Character.pitLord, stage: 14 },
  { character: Character.beastmaster, stage: 3 },
  { character: Character.lichKing, stage: 2 },
  { character: Character.thrall, stage: 3 },
  { character: Character.jaina, stage: 11 },
  { character: Character.sylvanas, stage: 4 },
  { character: Character.cairne, stage: 3 },
  { character: Character.chen, stage: 3 },
  { character: Character.peon, stage: 3 },
  { character: Character.tinker, stage: 3 },
  { character: Character.kaelthas, stage: 14 },
];
