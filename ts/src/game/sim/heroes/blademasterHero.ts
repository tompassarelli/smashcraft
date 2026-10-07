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
  passive: { name: "Critical Strike", description: "Every fourth sword hit in a row strikes harder; his blade glows when it is ready." },
  jab: { name: "Swift Cuts", description: "Two quick cuts close to his body on repeated jabs." },
  ultimate: { name: "Bladestorm", description: "A long spinning flurry of cuts that ends in one strong finishing hit." },
  gameplan: BLADEMASTER_GAMEPLAN,
  presentation: {
    model: "units\\orc\\HeroBladeMaster\\HeroBladeMaster.mdl",
    objectId: 0x6d66626d,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroBlademaster.blp",
    // Mirror Image: his own model, see-through, standing where he left it.
    placedModel: { path: "units\\orc\\HeroBladeMaster\\HeroBladeMaster.mdl", height: 140.0, alpha: 120 },
    clips: BLADEMASTER_CLIPS,
    fallback: BLADEMASTER_FALLBACK_CLIP,
  },
};
