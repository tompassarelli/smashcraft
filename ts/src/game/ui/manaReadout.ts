// What a fighter's mana label says: its mana, or for a moment after a special
// it could not afford, that it lacks mana. Presentation only; the simulation
// counts refusals in Fighter.visuals.manaDenied.
import { toInt } from "../../runtime/numbers";

/** Rendered updates the refusal notice stays up, about three quarters of a second. */
export const MANA_NOTICE_UPDATES = 45;

export interface ManaReadout {
  /** The refusal count last seen; a larger one starts the notice. */
  seenDenials: number;
  noticeLeft: number;
}

export const manaReadout = (): ManaReadout => ({ seenDenials: 0, noticeLeft: 0 });

/** Advances the readout one rendered update and returns its text, or "" for a fighter without mana. */
export function manaLabel(readout: ManaReadout, points: number | undefined, denials: number): string {
  if (denials > readout.seenDenials) readout.noticeLeft = MANA_NOTICE_UPDATES;
  readout.seenDenials = denials;
  if (points === undefined) {
    readout.noticeLeft = 0;
    return "";
  }
  if (readout.noticeLeft > 0) {
    readout.noticeLeft--;
    return "|cffff6060Not enough mana|r";
  }
  return `|cff8fc4ffMana ${toInt(points)}|r`;
}
