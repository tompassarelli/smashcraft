// The in-match HUD: a damage plate per fighter and the match clock. Every
// client creates the same frames; only what they show varies.
import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { Character } from "../sim/codes";
import { fighterName, fighterPortrait } from "../sim/heroes/registry";
import { MENU_FONT, createBackdrop, createText, gameUi, placeTopLeft } from "./frames";
import { manaLabel, manaReadout } from "./manaReadout";

const STOCK_ICONS = 9;

export class MatchClock {
  private readonly label: framehandle;

  constructor() {
    this.label = createText("MatchClock", gameUi(), 890);
    placeTopLeft(this.label, f32(0.65), f32(0.568));
    BlzFrameSetSize(this.label, f32(0.12), f32(0.032));
    BlzFrameSetFont(this.label, MENU_FONT, f32(0.02), 1);
    BlzFrameSetTextAlignment(this.label, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
    BlzFrameSetEnable(this.label, false);
    BlzFrameSetVisible(this.label, false);
  }

  destroy(): void {
    BlzDestroyFrame(this.label);
  }

  update(visible: boolean, seconds: number): void {
    BlzFrameSetVisible(this.label, visible);
    const remainder = imod(seconds, 60);
    BlzFrameSetText(this.label, `${I2S(idiv(seconds, 60))}:${remainder < 10 ? "0" : ""}${I2S(remainder)}`);
  }
}


/** Damage as Melee shows it, one decimal truncated, tinted by how close a KO is. */
function damageText(damage: number): string {
  const tint = damage >= 150 ? "|cffff4747" : damage >= 100 ? "|cffff9845" : damage >= 50 ? "|cffffff98" : "|cffffffff";
  return `${tint}${I2S(R2I(damage))}.${I2S(imod(R2I(damage * 10), 10))}%|r`;
}

/** One fighter's plate: portrait, name, slot, damage and stock icons. */
export class FighterHud {
  private readonly plate: framehandle;
  private readonly portrait: framehandle;
  private readonly damage: framehandle;
  private readonly name: framehandle;
  private readonly slotLabel: framehandle;
  /** Above the plate: mana, or a moment's notice that a special lacked it. */
  private readonly mana: framehandle;
  private readonly manaState = manaReadout();
  private shownMana: string | undefined;
  private readonly stocks: readonly framehandle[];
  /** The frames that show and hide with the plate; stock icons also follow the stock count. */
  private readonly body: readonly framehandle[];
  private shownCharacter: number | undefined;
  // What the plate shows, so a callback that changes nothing calls no native.
  private shownVisible: boolean | undefined;
  private shownDamage: string | undefined;
  private shownStocks: number | undefined;

  /** `count` plates share the bottom of the screen; this one starts at its slot's position. */
  constructor(slot: number, count: number) {
    const suffix = I2S(slot);
    const context = 800 + slot * 20;
    const parent = gameUi();
    this.plate = createBackdrop(`FighterHUDPlate${suffix}`, parent, context);
    BlzFrameSetTexture(this.plate, `war3mapImported\\MatchHUD${suffix}.tga`, 0, true);
    BlzFrameSetEnable(this.plate, false);
    this.portrait = createBackdrop(`FighterHUDPortrait${suffix}`, parent, context + 1);
    BlzFrameSetSize(this.portrait, f32(0.117), f32(0.117));
    BlzFrameSetEnable(this.portrait, false);
    this.damage = BlzCreateFrame("SmashcraftDamage", parent, 0, context + 2);
    BlzFrameSetTextAlignment(this.damage, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.damage, false);
    this.name = createText(`FighterHUDName${suffix}`, parent, context + 3);
    BlzFrameSetFont(this.name, MENU_FONT, f32(0.009), 1);
    BlzFrameSetTextAlignment(this.name, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
    BlzFrameSetEnable(this.name, false);
    this.slotLabel = createText(`FighterHUDSlot${suffix}`, parent, context + 4);
    BlzFrameSetSize(this.slotLabel, f32(0.023), f32(0.014));
    BlzFrameSetFont(this.slotLabel, MENU_FONT, f32(0.008), 1);
    BlzFrameSetText(this.slotLabel, `P${I2S(slot + 1)}`);
    BlzFrameSetEnable(this.slotLabel, false);
    this.mana = createText(`FighterHUDMana${suffix}`, parent, context + 5 + STOCK_ICONS);
    BlzFrameSetFont(this.mana, MENU_FONT, f32(0.009), 1);
    BlzFrameSetTextAlignment(this.mana, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
    BlzFrameSetEnable(this.mana, false);
    const stocks: framehandle[] = [];
    for (let index = 0; index < STOCK_ICONS; index++) {
      const icon = createBackdrop(`FighterHUDStock${suffix}_${I2S(index)}`, parent, context + 5 + index);
      BlzFrameSetSize(icon, f32(0.012), f32(0.012));
      BlzFrameSetEnable(icon, false);
      stocks.push(icon);
    }
    this.stocks = stocks;
    this.body = [this.plate, this.portrait, this.damage, this.name, this.slotLabel, this.mana];
    this.layout(slot, count);
    this.update(false, Character.archer, 0.0, 0);
  }

  destroy(): void {
    for (const frame of this.body) BlzDestroyFrame(frame);
    for (const icon of this.stocks) BlzDestroyFrame(icon);
  }

  /** Places this plate `position`-th of `count` evenly spaced plates. */
  layout(position: number, count: number): void {
    const spacing = f32(0.76) / count;
    const width = count > 2 ? f32(0.17) : 0.25;
    const x = f32(0.02) + spacing * (position + 0.5) - width / 2;
    placeTopLeft(this.plate, x, f32(0.084));
    BlzFrameSetSize(this.plate, width, f32(0.053));
    placeTopLeft(this.portrait, x - f32(0.02), f32(0.139));
    placeTopLeft(this.damage, x + width * f32(0.44), f32(0.117));
    BlzFrameSetSize(this.damage, width * f32(0.57), f32(0.064));
    BlzFrameSetScale(this.damage, count > 2 ? f32(0.77) : 1.0);
    placeTopLeft(this.name, x + width * f32(0.37), f32(0.052));
    BlzFrameSetSize(this.name, width * f32(0.6), f32(0.016));
    placeTopLeft(this.slotLabel, x + f32(0.004), f32(0.05));
    placeTopLeft(this.mana, x, f32(0.155));
    BlzFrameSetSize(this.mana, width, f32(0.014));
    this.stocks.forEach((icon, index) => placeTopLeft(icon, x + width * f32(0.38) + index * f32(0.013), f32(0.029)));
  }

  /** `mana` is undefined for a fighter without it; `manaDenials` counts specials it could not afford. */
  update(visible: boolean, character: Character, damage: number, stocks: number, mana?: number, manaDenials = 0): void {
    const shownMana = manaLabel(this.manaState, mana, manaDenials);
    if (this.shownMana !== shownMana) {
      this.shownMana = shownMana;
      BlzFrameSetText(this.mana, shownMana);
    }
    if (this.shownVisible !== visible) {
      this.shownVisible = visible;
      for (const frame of this.body) BlzFrameSetVisible(frame, visible);
    }
    if (this.shownCharacter !== character) {
      this.shownCharacter = character;
      BlzFrameSetTexture(this.portrait, fighterPortrait(character), 0, true);
      BlzFrameSetText(this.name, fighterName(character).toUpperCase());
      for (const icon of this.stocks) BlzFrameSetTexture(icon, fighterPortrait(character), 0, true);
    }
    const shownDamage = damageText(damage);
    if (this.shownDamage !== shownDamage) {
      this.shownDamage = shownDamage;
      BlzFrameSetText(this.damage, shownDamage);
    }
    const shownStocks = visible ? stocks : 0;
    const previous = this.shownStocks;
    if (previous === shownStocks) return;
    this.shownStocks = shownStocks;
    for (let index = 0; index < this.stocks.length; index++) {
      const icon = this.stocks[index];
      if (icon !== undefined && (previous === undefined || index < previous !== index < shownStocks)) BlzFrameSetVisible(icon, index < shownStocks);
    }
  }
}
