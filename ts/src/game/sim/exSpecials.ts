import type { Fighter } from "./fighter";
import type { Controls } from "./roster";
import { SpecialAction } from "./codes";
import { ROSTER_MANA, spendMana } from "./mana";

export const EX_ARMOR_DAMAGE = 8.0;
export const EX_ARMOR_FRAMES = 6;

export function exSpecialPressed(input: Readonly<Controls>): boolean {
  return input.specialPressed && input.shield;
}

export function exSpecialAffordable(f: Readonly<Fighter>): boolean {
  return f.mana.points >= ROSTER_MANA.max;
}


export function enterExSpecial(f: Fighter, input: Readonly<Controls>): void {
  f.special.ex = exSpecialPressed(input) && exSpecialAffordable(f);
  f.special.exArmorUsed = false;
  if (f.special.ex) spendMana(f, ROSTER_MANA.max);
}

export function exArmorActive(f: Readonly<Fighter>): boolean {
  return f.special.ex && !f.special.exArmorUsed && f.special.action !== SpecialAction.none && f.special.frame <= EX_ARMOR_FRAMES;
}
