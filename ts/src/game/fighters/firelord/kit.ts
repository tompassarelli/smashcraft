import { Character } from "../../sim/codes";
import type { HeroDefinition } from "../../sim/heroes/hero";
import { standinHero } from "../standin/kit";
import { FIRELORD_GAMEPLAN } from "./gameplan";
import { LAVA_RAZE, SUBMERGE } from "./specials";
import { LAVA_SURF_KIT } from "./surf";

export const FIRELORD_HERO: HeroDefinition = standinHero({
  character: Character.firelord, name: "Firelord", side: SUBMERGE, up: LAVA_SURF_KIT, down: LAVA_RAZE, gameplan: FIRELORD_GAMEPLAN,
  effects: { bolt: "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx", burst: "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx" },
});
