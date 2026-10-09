






import { expect, test } from "bun:test";
import { DRAWN_REACH } from "../scripts/wisp/drawnReachInfo";
import { REACH_CHECKED } from "../scripts/wisp/drawnReach";
import { DEMON_HUNTER_MODEL_FILE } from "../src/game/presentation/demonHunterAssetInfo";
import { RIFLEMAN_MODEL_FILE } from "../src/game/presentation/fighterAssetInfo";
import { attackPose, clipFor, ownAttackClip } from "../src/game/presentation/fighterClips";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { heroDefinition } from "../src/game/sim/heroes/registry";


const SWING = 30;

const SLACK = 2;
const MODELS: { readonly [character: number]: string } = {
  [Character.rifleman]: RIFLEMAN_MODEL_FILE, [Character.demonHunter]: DEMON_HUNTER_MODEL_FILE,
};

const DEPARTURES: { readonly [character: number]: { readonly swing: number; readonly why: string } } = {};

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

  expect(DRAWN_REACH.filter((row) => JABS.includes(row.style)).length).toBeGreaterThanOrEqual(2 * 11);
});
