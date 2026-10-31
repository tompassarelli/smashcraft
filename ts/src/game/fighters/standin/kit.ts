import type { HeroDefinition } from "../../sim/heroes/hero";
import type { FighterGameplan } from "../../sim/gameplan";
import type { SpecialKit } from "../../sim/specials/schema";
import { STANDIN_GAMEPLAN } from "./gameplan";
import { standinMoves } from "./moves";
import { type StandinEffects, standinSpecials } from "./specials";

export interface StandinIdentity {
  readonly character: HeroDefinition["character"];
  readonly name: string;
  readonly displayName?: string | undefined;
  readonly effects: StandinEffects;
  readonly neutral?: SpecialKit | undefined;
  readonly side?: SpecialKit | undefined;
  readonly up?: SpecialKit | undefined;
  readonly down?: SpecialKit | undefined;
  readonly gameplan?: FighterGameplan | undefined;
}

export function standinHero({ character, name, displayName, effects, neutral, side, up, down, gameplan }: StandinIdentity): HeroDefinition {
  const shared = standinSpecials(character, effects);
  return {
    character, name, displayName: `${displayName ?? name} (WIP)`,
    purpose: "Work-in-progress stand-in: a plain middleweight moveset until his own kit lands",
    weakness: "No signature tools yet: every move is the shared stand-in's",
    complete: true,
    moves: standinMoves(character), specials: { ...shared, neutral: neutral ?? shared.neutral, side: side ?? shared.side, up: up ?? shared.up, down: down ?? shared.down }, gameplan: gameplan ?? STANDIN_GAMEPLAN,
    jab: { name: "Stand-in Jab", description: "Two quick strikes ahead." },
  };
}
