import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { TINKER_MOVES } from "./tinkerMoves";
import { TINKER_SPECIALS } from "./tinkerSpecials";
import { TINKER_GAMEPLAN } from "./tinkerGameplan";

export const TINKER_HERO: HeroDefinition = {
  character: Character.tinker, name: "Goblin Tinker", purpose: "Factory and rocket space control",
  weakness: "Short claws and vulnerable setup",
  passive: { name: "Engineering Upgrade", description: "Gadget hits charge up to two upgrades; the next claw hit spends them for extra damage." },
  jab: { name: "Claw-Pack", description: "Two short claw taps and a wrench shove." },
  ultimate: { name: "Robo-Goblin Overdrive", description: "An extended armored hammer-tank advance." },
  complete: true, moves: TINKER_MOVES, specials: TINKER_SPECIALS, gameplan: TINKER_GAMEPLAN,
  presentation: {
    model: "units\\creeps\\HeroTinker\\HeroTinker.mdl", objectId: 0x6d667469,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroTinker.blp",
    placedModel: { path: "Units\\Creeps\\HeroTinkerFactory\\HeroTinkerFactory.mdl", height: 100.0, alpha: 255 },
    clips: {}, fallback: { index: 6, seconds: f32(1.0) },
  },
};
