// Forsaken Paladin's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { FORSAKEN_PALADIN_MODEL } from "../../assets/importedModelInfo";
import type { HeroDefinition } from "./hero";
import { FORSAKEN_PALADIN_CLIPS, FORSAKEN_PALADIN_FALLBACK_CLIP, FORSAKEN_PALADIN_DAMAGE_CLIPS } from "./forsakenPaladinClips";
import { FORSAKEN_PALADIN_MOVES } from "./forsakenPaladinMoves";
import { FORSAKEN_PALADIN_GAMEPLAN } from "./forsakenPaladinGameplan";
import { FORSAKEN_PALADIN_SPECIALS } from "./forsakenPaladinSpecials";

export const FORSAKEN_PALADIN_HERO: HeroDefinition = {
  character: Character.forsakenPaladin,
  name: "Forsaken Paladin",
  purpose: "Forsaken hammer fighter who holds consecrated ground",
  weakness: "Slow feet and punishable hammer commitments",
  complete: true,
  moves: FORSAKEN_PALADIN_MOVES,
  specials: FORSAKEN_PALADIN_SPECIALS,
  passive: { name: "Sacred Aura", description: "After he blocks three hits with his shield, the next launch he takes is 20% weaker." },
  jab: { name: "Hammer and Haft", description: "A hammer check, then a shove of the haft on a second jab." },
  gameplan: FORSAKEN_PALADIN_GAMEPLAN,
  presentation: {
    model: FORSAKEN_PALADIN_MODEL,
    objectId: 0x6d667574,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNForsakenPaladin.blp",
    clips: FORSAKEN_PALADIN_CLIPS,
    fallback: FORSAKEN_PALADIN_FALLBACK_CLIP,
    damageClips: FORSAKEN_PALADIN_DAMAGE_CLIPS,
  },
};
