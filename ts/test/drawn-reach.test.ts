// Drawn reach toward the strike (#156, the move-legibility bar): each checked
// swing (the original fighters' re-authored clips, every hero's ground
// normals) moves its drawn silhouette at least 30 units toward its strike and
// peaks within two frames of its active window. The table is measured from
// the packaged and stock models by `bun wisp view reach`
// (scripts/wisp/drawnReach.ts); a re-exported model or remapped clip needs a
// new measurement.
import { expect, test } from "bun:test";
import { DRAWN_REACH } from "../scripts/wisp/drawnReachInfo";
import { REACH_CHECKED } from "../scripts/wisp/drawnReach";
import { DEMON_HUNTER_MODEL_FILE } from "../src/game/presentation/demonHunterAssetInfo";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../src/game/presentation/fighterAssetInfo";
import { attackPose, clipFor, ownAttackClip } from "../src/game/presentation/fighterClips";
import { Character } from "../src/game/sim/codes";
import { heroDefinition } from "../src/game/sim/heroes/registry";

/** Heroes' stock swings measure 30-200 units toward their strikes. */
const SWING = 30;
/** Frames the peak may sit before the first or after the last active frame. */
const SLACK = 2;
const MODELS: { readonly [character: number]: string } = {
  [Character.archer]: ARCHER_MODEL_FILE, [Character.rifleman]: RIFLEMAN_MODEL_FILE, [Character.demonHunter]: DEMON_HUNTER_MODEL_FILE,
};
/** Named departures: the least swing a fighter's model can draw, and why. */
const DEPARTURES: { readonly [character: number]: { readonly swing: number; readonly why: string } } = {
  [Character.lich]: { swing: 28, why: "his model swings only Attack and Spell; jab, forward tilt up and dash attack draw 28-29" },
};

test("every checked swing draws toward its strike on its active frames", () => {
  const off = DRAWN_REACH.flatMap((row) => {
    const pose = attackPose(row.style);
    const clip = ownAttackClip(row.character, row.style) ?? (pose === undefined ? undefined : clipFor(row.character, pose));
    const name = `${row.character}/${row.style}`;
    const model = MODELS[row.character] ?? heroDefinition(row.character)?.presentation.model;
    if (row.model !== model || clip?.index !== row.clip) return [`${name}: model or clip changed, measure again`];
    if (row.swing < (DEPARTURES[row.character]?.swing ?? SWING)) return [`${name}: swings ${row.swing} toward its strike`];
    if (row.peakFrame < row.firstActive - SLACK || row.peakFrame > row.lastActive + SLACK) return [`${name}: peaks on frame ${row.peakFrame}, active ${row.firstActive}-${row.lastActive}`];
    return [];
  });
  expect(off).toEqual([]);
  expect(DRAWN_REACH.map(({ character, style }) => `${character}/${style}`)).toEqual(REACH_CHECKED.flatMap(({ character, styles }) => styles.map((style) => `${character}/${style}`)));
});
