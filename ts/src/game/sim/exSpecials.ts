import type { Fighter } from "./fighter";
import { type Controls, neutralControls } from "./roster";
import { Character, SpecialAction } from "./codes";
import { SpecialSlot, heroSpecialMove, specialKit } from "./heroSpecials";
import { chooseHeroSpecial } from "./heroSpecialRules";
import { originalSpecialCost, spendMana } from "./mana";

export const EX_EXTRA_MANA = 25;
export const EX_ARMOR_DAMAGE = 8.0;
export const EX_ARMOR_FRAMES = 6;
const priceInput = neutralControls();
const priceRefusal = { manaShort: false, groundOnly: false };

export function exSpecialPressed(input: Readonly<Controls>): boolean {
  return input.specialPressed && input.shield && input.specialZ === 0;
}

/** Entry captures the modifier; holding shield later cannot upgrade a running cast. */
export function enterExSpecial(f: Fighter, input: Readonly<Controls>, normalCost: number): void {
  f.special.ex = exSpecialPressed(input) && f.mana.points >= normalCost + EX_EXTRA_MANA;
  f.special.exArmorUsed = false;
  if (f.special.ex) spendMana(f, EX_EXTRA_MANA);
}

export function exArmorActive(f: Readonly<Fighter>): boolean {
  return f.special.ex && !f.special.exArmorUsed && f.special.action !== SpecialAction.none && f.special.frame <= EX_ARMOR_FRAMES;
}

/** Current ground/air cast prices for the two EX cues, before entity and cooldown restrictions. */
export function exSpecialCost(f: Readonly<Fighter>, side: boolean): number {
  const specials = f.tuning.specials;
  if (specials !== undefined) {
    priceInput.specialX = side ? 1 : 0;
    const chosen = chooseHeroSpecial(f, specials, priceInput, priceRefusal);
    if (chosen !== undefined) return heroSpecialMove(specials, chosen).cost + EX_EXTRA_MANA;
    const kit = specialKit(specials, side ? SpecialSlot.side : SpecialSlot.neutral);
    return (f.motion.grounded ? kit.ground : kit.air ?? kit.ground).cost + EX_EXTRA_MANA;
  }
  const action = f.character === Character.archer ? (side ? SpecialAction.archerHomingArrow : SpecialAction.archerArrow)
    : f.character === Character.rifleman ? (side ? SpecialAction.riflemanBear : SpecialAction.riflemanBlaster)
    : side ? SpecialAction.demonHunterFelRush : SpecialAction.demonHunterManaBurn;
  return originalSpecialCost(action) + EX_EXTRA_MANA;
}

export function exManaCue(f: Readonly<Fighter>): string {
  const neutral = f.mana.points >= exSpecialCost(f, false);
  const side = f.mana.points >= exSpecialCost(f, true);
  return neutral && side ? "EX Neutral + Side" : neutral ? "EX Neutral" : side ? "EX Side" : "";
}
