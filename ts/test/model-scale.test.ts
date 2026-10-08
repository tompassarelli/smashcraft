// Fighters keep Warcraft's own model proportions (#162): every fighter is
// drawn at its stock unit's model scale times one shared factor.
import { expect, test } from "bun:test";
import { FIGHTER_OBJECTS } from "../src/game/objectData";
import { FIGHTER_MATCH_SCALE, STOCK_MODEL_SCALES, characterModelScale } from "../src/game/presentation/modelScale";
import { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS } from "../src/game/sim/heroes/registry";

/**
 * `modelScale:sd` of each fighter's stock unit in the game's
 * units/unitskin.txt, read from the installed game's archive on 7 Oct 2026.
 * A stock value here changes only when Warcraft's does, never to resize a fighter.
 */
const UNITSKIN_MODEL_SCALE: Readonly<Record<string, number>> = {
  earc: 1.0, hrif: 1.0, Edem: 1.0, Obla: 1.0, Hmkg: 1.0, Ewar: 1.0,
  Ulic: 1.0, Hpal: 1.0, Npal: Math.fround(1.2), Udre: 1.0, Oshd: 1.0, Nplh: 1.0, Nbst: 1.0, Usyl: 1.0,
  Othr: 1.0, Hjai: 1.0, Otch: 1.0, Npbm: 1.0, opeo: 1.0, Ntin: 1.0, Hblm: 1.0,
  // A community model has no unit behind it, so no unit scale: drawn at 1.0 (#167).
  LichKing2: 1.0,
};

test("every fighter is drawn at its stock unit's model scale times the shared factor [native]", () => {
  const characters = Object.values(Character);
  expect([...SELECTABLE_CHARACTERS].sort((a, b) => a - b)).toEqual(characters);
  for (const character of characters) {
    const { unit, scale } = STOCK_MODEL_SCALES[character];
    expect({ character, unit, scale }).toEqual({ character, unit, scale: UNITSKIN_MODEL_SCALE[unit] ?? Number.NaN });
    expect({ character, draw: characterModelScale(character) }).toEqual({ character, draw: Math.fround(scale * FIGHTER_MATCH_SCALE) });
    expect({ character, object: FIGHTER_OBJECTS[character].scale }).toEqual({ character, object: characterModelScale(character) });
  }
});
