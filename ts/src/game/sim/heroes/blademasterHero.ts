// Blademaster's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { BLADEMASTER_GAMEPLAN } from "./blademasterGameplan";
import { BLADEMASTER_CLIPS, BLADEMASTER_FALLBACK_CLIP } from "./blademasterClips";
import { BLADEMASTER_MOVES } from "./blademasterMoves";
import { BLADEMASTER_SPECIALS } from "./blademasterSpecials";

export const BLADEMASTER_HERO: HeroDefinition = {
  character: Character.blademaster,
  name: "Blademaster",
  purpose: "Grounded sword spacing and whiff punishment",
  weakness: "Exposed recoveries and weak ranged pressure",
  complete: true,
  moves: BLADEMASTER_MOVES,
  specials: BLADEMASTER_SPECIALS,
  gameplan: BLADEMASTER_GAMEPLAN,
  presentation: {
    model: "units\\orc\\HeroBladeMaster\\HeroBladeMaster.mdl",
    scale: 1.0,
    objectId: 0x6d66626d,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroBlademaster.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    // Mirror Image: his own model, see-through, standing where he left it.
    placedModel: { path: "units\\orc\\HeroBladeMaster\\HeroBladeMaster.mdl", height: 140.0, alpha: 120 },
    clips: BLADEMASTER_CLIPS,
    fallback: BLADEMASTER_FALLBACK_CLIP,
  },
};
