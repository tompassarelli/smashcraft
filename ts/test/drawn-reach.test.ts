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
import { AttackStyle, Character } from "../src/game/sim/codes";
import { heroDefinition } from "../src/game/sim/heroes/registry";

/** Heroes' stock swings measure 30-200 units toward their strikes. */
const SWING = 30;
/** Frames the peak may sit before the first or after the last active frame. */
const SLACK = 2;
const MODELS: { readonly [character: number]: string } = {
  [Character.archer]: ARCHER_MODEL_FILE, [Character.rifleman]: RIFLEMAN_MODEL_FILE, [Character.demonHunter]: DEMON_HUNTER_MODEL_FILE,
};
/** Named departures: the least swing a fighter's model can draw, and why. */
const DEPARTURES: { readonly [character: number]: { readonly swing: number; readonly why: string } } = {};
/** Jabs that swing less than their fighter's floor, and why (#163: a jab slice stops short of the forward tilt). */
const JAB_DEPARTURES: { readonly [character: number]: { readonly swing: number; readonly why: string } } = {
  [Character.lich]: { swing: 24, why: "his close slap stops short of his forward tilt's 66-unit reach, and his Attack draws little before that: 25-26" },
};
const JABS: readonly number[] = [AttackStyle.jab, AttackStyle.jab2, AttackStyle.jab3];

test("every checked swing draws toward its strike on its active frames [spec #156]", () => {
  const off = DRAWN_REACH.flatMap((row) => {
    const pose = row.style === AttackStyle.ledgeAttack ? "ledgeAttack" : attackPose(row.style);
    const clip = ownAttackClip(row.character, row.style) ?? (pose === undefined ? undefined : clipFor(row.character, pose));
    const name = `${row.character}/${row.style}`;
    const model = MODELS[row.character] ?? heroDefinition(row.character)?.presentation.model;
    if (row.model !== model || clip?.index !== row.clip) return [`${name}: model or clip changed, measure again`];
    const floor = (JABS.includes(row.style) ? JAB_DEPARTURES[row.character]?.swing : undefined) ?? DEPARTURES[row.character]?.swing ?? SWING;
    if (row.swing < floor) return [`${name}: swings ${row.swing} toward its strike`];
    if (row.peakFrame < row.firstActive - SLACK || row.peakFrame > row.lastActive + SLACK) return [`${name}: peaks on frame ${row.peakFrame}, active ${row.firstActive}-${row.lastActive}`];
    return [];
  });
  expect(off).toEqual([]);
  expect(DRAWN_REACH.map(({ character, style }) => `${character}/${style}`)).toEqual(REACH_CHECKED.flatMap(({ character, styles }) => styles.map((style) => `${character}/${style}`)));
});

test("every jab draws shorter than its fighter's forward tilt (#163) [spec #163]", () => {
  const forward = (character: number, style: number) => DRAWN_REACH.find((row) => row.character === character && row.style === style)?.forward;
  const long = DRAWN_REACH.flatMap(({ character, style, forward: jab }) => {
    const tilt = forward(character, AttackStyle.forwardTilt);
    if (!JABS.includes(style)) return [];
    return tilt === undefined || jab >= tilt ? [`${character}/${style}: draws ${jab} forward, its forward tilt ${tilt}`] : [];
  });
  expect(long).toEqual([]);
  // Every chain step is measured.
  expect(DRAWN_REACH.filter((row) => JABS.includes(row.style)).length).toBeGreaterThanOrEqual(2 * 12);
});
