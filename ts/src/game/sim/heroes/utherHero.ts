// Uther's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { UTHER_FORSAKEN_MODEL } from "../../assets/importedModelInfo";
import type { HeroDefinition } from "./hero";
import { UTHER_CLIPS, UTHER_FALLBACK_CLIP, UTHER_DAMAGE_CLIPS } from "./utherClips";
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
  passive: { name: "Devotion Aura", description: "After he blocks three hits with his shield, the next launch he takes is weaker." },
  jab: { name: "Hammer and Haft", description: "A hammer check, then a shove of the haft on a second jab." },
  ultimate: { name: "Guardian of the Light", description: "He hits harder and carries three charges that each soften one light hit." },
  gameplan: UTHER_GAMEPLAN,
  presentation: {
    model: UTHER_FORSAKEN_MODEL,
    objectId: 0x6d667574,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNForsakenPaladin.blp",
    clips: UTHER_CLIPS,
    fallback: UTHER_FALLBACK_CLIP,
    damageClips: UTHER_DAMAGE_CLIPS,
  },
};
