// The in-match HUD: a damage plate per fighter and the match clock. Every
// client creates the same frames; only what they show varies.
import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { Character } from "../sim/codes";
import { fighterName, fighterPortrait } from "../sim/heroes/registry";
import {
  BUST_BOX, DAMAGE_BOX, MANA_BOX, NAME_BOX, PLATE_HEIGHT_PX, PLATE_TOP, PLATE_WIDTH_PX, SHAKE_FRAMES, SLOT_BOX, STOCK_ICONS_SHOWN, STOCK_ROW, STOCK_STEP_PX,
  TENTHS_BOX, type PlateBox, boxLeft, boxTop, damageTenths, damageWhole, plateLeft, shakeStrength, shakeX, shakeY,
} from "./plateLayout";
import { unitsForPixels } from "./portraitFrames";
import { MENU_FONT, createBackdrop, createText, gameUi, placeTopLeft } from "./frames";

const STOCK_ICONS = STOCK_ICONS_SHOWN;

/** Where a plate's mana bar sits: the plate art's mana track, as left edge, centre height and length. */
export function plateManaSlot(position: number, count: number): { readonly left: number; readonly centerY: number; readonly width: number } {
  return { left: boxLeft(plateLeft(position, count), MANA_BOX), centerY: boxTop(MANA_BOX) - unitsForPixels(MANA_BOX.height) / 2, width: unitsForPixels(MANA_BOX.width) };
}

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


/** One fighter's plate: bust, damage, mana, name, slot and stock icons (plateLayout.ts). */
export class FighterHud {
  private readonly plate: framehandle;
  private readonly portrait: framehandle;
  private readonly damage: framehandle;
  private readonly tenths: framehandle;
  private readonly name: framehandle;
  private readonly slotLabel: framehandle;
  private readonly stocks: readonly framehandle[];
  /** Beside the first stock icon when there are more stocks than icons: "x7". */
  private readonly stockCount: framehandle;
  /** The frames that show and hide with the plate; stock icons also follow the stock count. */
  private readonly body: readonly framehandle[];
  private shownCharacter: number | undefined;
  // What the plate shows, so a callback that changes nothing calls no native.
  private shownVisible: boolean | undefined;
  private shownDamage: string | undefined;
  private shownTenths: string | undefined;
  private shownStocks: number | undefined;
  /** The plate's left edge; the damage readout shakes around its place in it. */
  private left = 0.0;
  private damageValue = 0.0;
  /** Rendered frames into the current hit's shake, and its strength in plate pixels. */
  private shakeFrame = SHAKE_FRAMES;
  private shakeStrength = 0.0;

  /** `count` plates share the bottom of the screen; this one starts at its slot's position. */
  constructor(private readonly slot: number, count: number) {
    const suffix = I2S(slot);
    const context = 800 + slot * 20;
    const parent = gameUi();
    this.plate = createBackdrop(`FighterHUDPlate${suffix}`, parent, context);
    BlzFrameSetTexture(this.plate, `war3mapImported\\HudPlate${suffix}.tga`, 0, true);
    BlzFrameSetSize(this.plate, unitsForPixels(PLATE_WIDTH_PX), unitsForPixels(PLATE_HEIGHT_PX));
    BlzFrameSetEnable(this.plate, false);
    this.portrait = createBackdrop(`FighterHUDPortrait${suffix}`, parent, context + 1);
    sizeTo(this.portrait, BUST_BOX);
    BlzFrameSetEnable(this.portrait, false);
    this.damage = BlzCreateFrame("SmashcraftDamage", parent, 0, context + 2);
    sizeTo(this.damage, DAMAGE_BOX);
    BlzFrameSetTextAlignment(this.damage, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
    BlzFrameSetEnable(this.damage, false);
    this.tenths = createText(`FighterHUDTenths${suffix}`, parent, context + 7 + STOCK_ICONS);
    sizeTo(this.tenths, TENTHS_BOX);
    BlzFrameSetFont(this.tenths, MENU_FONT, f32(0.016), 1);
    BlzFrameSetTextAlignment(this.tenths, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.tenths, false);
    this.name = createText(`FighterHUDName${suffix}`, parent, context + 3);
    sizeTo(this.name, NAME_BOX);
    BlzFrameSetFont(this.name, MENU_FONT, f32(0.0072), 1);
    BlzFrameSetTextAlignment(this.name, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.name, false);
    this.slotLabel = createText(`FighterHUDSlot${suffix}`, parent, context + 4);
    sizeTo(this.slotLabel, SLOT_BOX);
    BlzFrameSetFont(this.slotLabel, MENU_FONT, f32(0.0085), 1);
    BlzFrameSetTextAlignment(this.slotLabel, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
    BlzFrameSetText(this.slotLabel, `P${I2S(slot + 1)}`);
    BlzFrameSetEnable(this.slotLabel, false);
    const stocks: framehandle[] = [];
    for (let index = 0; index < STOCK_ICONS; index++) {
      const icon = createBackdrop(`FighterHUDStock${suffix}_${I2S(index)}`, parent, context + 5 + index);
      sizeTo(icon, STOCK_ROW);
      BlzFrameSetEnable(icon, false);
      stocks.push(icon);
    }
    this.stocks = stocks;
    this.stockCount = createText(`FighterHUDStockCount${suffix}`, parent, context + 6 + STOCK_ICONS);
    BlzFrameSetSize(this.stockCount, unitsForPixels(120), unitsForPixels(STOCK_ROW.height));
    BlzFrameSetFont(this.stockCount, MENU_FONT, f32(0.011), 1);
    BlzFrameSetTextAlignment(this.stockCount, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.stockCount, false);
    this.body = [this.plate, this.portrait, this.damage, this.tenths, this.name, this.slotLabel];
    this.layout(slot, count);
    this.update(false, Character.archer, 0.0, 0);
  }

  destroy(): void {
    for (const frame of this.body) BlzDestroyFrame(frame);
    for (const icon of this.stocks) BlzDestroyFrame(icon);
    BlzDestroyFrame(this.stockCount);
  }

  /** Places this plate `position`-th of `count` evenly spaced plates. */
  layout(position: number, count: number): void {
    const left = plateLeft(position, count);
    this.left = left;
    placeTopLeft(this.plate, left, PLATE_TOP);
    placeAt(this.portrait, left, BUST_BOX);
    placeAt(this.damage, left, DAMAGE_BOX);
    placeAt(this.tenths, left, TENTHS_BOX);
    placeAt(this.name, left, NAME_BOX);
    placeAt(this.slotLabel, left, SLOT_BOX);
    this.stocks.forEach((icon, index) => placeTopLeft(icon, boxLeft(left, STOCK_ROW) + unitsForPixels(index * STOCK_STEP_PX), boxTop(STOCK_ROW)));
    placeTopLeft(this.stockCount, boxLeft(left, STOCK_ROW) + unitsForPixels(STOCK_STEP_PX + 4), boxTop(STOCK_ROW));
  }

  /** Every rendered frame. */
  update(visible: boolean, character: Character, damage: number, stocks: number): void {
    if (this.shownVisible !== visible) {
      this.shownVisible = visible;
      for (const frame of this.body) BlzFrameSetVisible(frame, visible);
    }
    if (this.shownCharacter !== character) {
      this.shownCharacter = character;
      BlzFrameSetTexture(this.portrait, fighterPortrait(character, "Bust", this.slot), 0, true);
      BlzFrameSetText(this.name, fighterName(character).toUpperCase());
      for (const icon of this.stocks) BlzFrameSetTexture(icon, fighterPortrait(character, "Stock", this.slot), 0, true);
    }
    this.shake(visible, damage);
    const shownDamage = damageWhole(damage);
    if (this.shownDamage !== shownDamage) {
      this.shownDamage = shownDamage;
      BlzFrameSetText(this.damage, shownDamage);
    }
    const shownTenths = damageTenths(damage);
    if (this.shownTenths !== shownTenths) {
      this.shownTenths = shownTenths;
      BlzFrameSetText(this.tenths, shownTenths);
    }
    const shownStocks = visible ? stocks : 0;
    const previous = this.shownStocks;
    if (previous === shownStocks) return;
    this.shownStocks = shownStocks;
    const icons = shownStocks > STOCK_ICONS ? 1 : shownStocks;
    for (let index = 0; index < this.stocks.length; index++) {
      const icon = this.stocks[index];
      if (icon !== undefined) BlzFrameSetVisible(icon, index < icons);
    }
    BlzFrameSetVisible(this.stockCount, shownStocks > STOCK_ICONS);
    BlzFrameSetText(this.stockCount, `x${I2S(shownStocks)}`);
  }

  /** A hit shakes the readout for a moment, harder for a bigger hit; local presentation only. */
  private shake(visible: boolean, damage: number): void {
    const added = damage - this.damageValue;
    this.damageValue = damage;
    if (visible && added > 0.0) {
      this.shakeFrame = 0;
      this.shakeStrength = shakeStrength(added);
    } else if (this.shakeFrame >= SHAKE_FRAMES) return;
    else this.shakeFrame++;
    const dx = unitsForPixels(shakeX(this.shakeStrength, this.shakeFrame));
    const dy = unitsForPixels(shakeY(this.shakeStrength, this.shakeFrame));
    placeTopLeft(this.damage, boxLeft(this.left, DAMAGE_BOX) + dx, boxTop(DAMAGE_BOX) - dy);
    placeTopLeft(this.tenths, boxLeft(this.left, TENTHS_BOX) + dx, boxTop(TENTHS_BOX) - dy);
  }
}

function sizeTo(frame: framehandle, box: PlateBox): void {
  BlzFrameSetSize(frame, unitsForPixels(box.width), unitsForPixels(box.height));
}

function placeAt(frame: framehandle, left: number, box: PlateBox): void {
  placeTopLeft(frame, boxLeft(left, box), boxTop(box));
}
