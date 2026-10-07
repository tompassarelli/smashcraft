import { expect, test } from "bun:test";
import { DRAWN_MOTION } from "../scripts/wisp/drawnMotionInfo";
import { MOTION_STATES, sampleMotion } from "../scripts/wisp/drawnMotion";
import { DRAWN_STRIDES } from "../src/game/presentation/drawnStrideInfo";
import { SELECTABLE_CHARACTERS, heroDefinition } from "../src/game/sim/heroes/registry";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../src/game/presentation/fighterAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "../src/game/presentation/demonHunterAssetInfo";

const ORIGINALS = [ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE, DEMON_HUNTER_MODEL_FILE];

test("all selectable fighters have a measured movement and recovery audit", () => {
  expect(DRAWN_MOTION.map((row) => `${row.character}/${row.state}`)).toEqual(SELECTABLE_CHARACTERS.flatMap((character) => MOTION_STATES.map((state) => `${character}/${state}`)));
});

test("walking, running and initial dashes visibly move the body and keep their measured sequences", () => {
  const off = DRAWN_MOTION.filter((row) => row.state === "walk" || row.state === "run" || row.state === "dash").flatMap((row) => {
    const model = ORIGINALS[row.character] ?? heroDefinition(row.character)?.presentation.model;
    const clips = [...new Set(sampleMotion(row.character, row.state).map((frame) => frame.clip ?? -1))];
    const gait = DRAWN_STRIDES[row.character]?.[row.state === "walk" ? "walk" : "run"];
    const label = `${row.character}/${row.state}`;
    if (row.model !== model || JSON.stringify(row.clips) !== JSON.stringify(clips) || gait?.model !== model) return [`${label}: model or dispatch changed; measure again`];
    // Eight world units of whole-body deformation and 30 at a visible extremity
    // distinguish a gait from idle breathing on every fighter, including the floating Lich.
    if (row.body < 8 || row.motion < 30) return [`${label}: body ${row.body.toFixed(1)}, extremity ${row.motion.toFixed(1)}`];
    return [];
  });
  expect(off).toEqual([]);
});
