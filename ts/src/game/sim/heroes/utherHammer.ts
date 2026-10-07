import { AttackStyle, Character, SpecialAction } from "../codes";
import type { Fighter } from "../fighter";

export function utherHammerAttack(character: Character, style: AttackStyle | undefined): boolean {
  return character === Character.uther && style !== undefined
    && style !== AttackStyle.jab && style !== AttackStyle.jab2 && style !== AttackStyle.jab3
    && style !== AttackStyle.backAir && style !== AttackStyle.grab;
}

/** The held hammer, excluding light projectiles, boots, jabs and throws. */
export function utherHammerContact(fighter: Readonly<Fighter>, damage: number, direct: boolean): boolean {
  if (!direct || damage < 8.0 || fighter.character !== Character.uther) return false;
  return utherHammerAttack(fighter.character, fighter.attack.style)
    || fighter.special.action === SpecialAction.heroNeutral
    || fighter.special.action === SpecialAction.heroSide
    || fighter.special.action === SpecialAction.heroUp;
}
