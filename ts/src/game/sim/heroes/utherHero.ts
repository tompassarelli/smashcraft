// Uther's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { UTHER_CLIPS, UTHER_FALLBACK_CLIP } from "./utherClips";
import { UTHER_MOVES } from "./utherMoves";
import { UTHER_GAMEPLAN } from "./utherGameplan";
import { UTHER_SPECIALS } from "./utherSpecials";

export const UTHER_HERO: HeroDefinition = {
  character: Character.uther,
  name: "Uther",
  purpose: "Defensive hammer fighter",
  weakness: "Weak chase and punishable defensive reads",
  complete: true,
  moves: UTHER_MOVES,
  specials: UTHER_SPECIALS,
  gameplan: UTHER_GAMEPLAN,
  presentation: {
    model: "units\\human\\HeroPaladin\\HeroPaladin.mdl",
    scale: 1.0,
    objectId: 0x6d667574,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroPaladin.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    clips: UTHER_CLIPS,
    fallback: UTHER_FALLBACK_CLIP,
  },
};
