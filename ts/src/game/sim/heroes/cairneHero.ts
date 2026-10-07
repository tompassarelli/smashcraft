import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { CAIRNE_GAMEPLAN } from "./cairneGameplan";
import { CAIRNE_MOVES } from "./cairneMoves";
import { CAIRNE_SPECIALS } from "./cairneSpecials";

import { CAIRNE_CLIPS, CAIRNE_DAMAGE_CLIPS, CAIRNE_FALLBACK } from "../../presentation/heroes/cairneClips";

export const CAIRNE_HERO: HeroDefinition = {
  character: Character.cairne, name: "Cairne Bloodhoof", purpose: "Super-heavyweight with sweeping totem strikes",
  weakness: "A huge target with slow whiffs and exposed recovery", complete: true,
  passive: { name: "Endurance Aura", description: "Land two melee attacks to move 10% faster on the ground for two seconds." },
  jab: { name: "Haft and Totem", description: "Check with the haft, then press again for the totem's short finishing blow." },
  ultimate: { name: "Ancestral Reincarnation", description: "At high damage, risk a long ritual to regain some strength without restoring a stock." },
  moves: CAIRNE_MOVES, specials: CAIRNE_SPECIALS, gameplan: CAIRNE_GAMEPLAN,
  presentation: {
    model: "units\\orc\\HeroTaurenChieftain\\HeroTaurenChieftain.mdl", objectId: 0x6d666361,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroTaurenChieftain.blp", fallback: CAIRNE_FALLBACK,
    clips: CAIRNE_CLIPS, damageClips: CAIRNE_DAMAGE_CLIPS,
  },
};
