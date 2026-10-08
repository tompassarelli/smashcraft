import { expect, test } from "bun:test";
import { DRAWN_MOTION } from "../scripts/wisp/drawnMotionInfo";
import { MOTION_STATES, sampleMotion } from "../scripts/wisp/drawnMotion";
import { DRAWN_STRIDES } from "../src/game/presentation/drawnStrideInfo";
import { SELECTABLE_CHARACTERS, heroDefinition } from "../src/game/sim/heroes/registry";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../src/game/presentation/fighterAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "../src/game/presentation/demonHunterAssetInfo";

const ORIGINALS = [ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE, DEMON_HUNTER_MODEL_FILE];

test("all selectable fighters have a measured movement and recovery audit [spec #171]", () => {
  expect(DRAWN_MOTION.map((row) => `${row.character}/${row.state}`)).toEqual(SELECTABLE_CHARACTERS.flatMap((character) => MOTION_STATES.map((state) => `${character}/${state}`)));
});

test("walking, running and initial dashes visibly move the body and keep their measured sequences [spec #171]", () => {
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

const RECOVERY_STATES = ["roll-forward", "roll-back", "spot-dodge", "air-dodge", "tech", "tech-forward", "tech-back", "get-up", "get-up-forward", "get-up-back", "get-up-attack"] as const;

test("every fighter plays distinct, visibly moving recovery actions and swings its get-up attack both ways [spec #171]", () => {
  const off: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    const selected: number[] = [];
    for (const state of RECOVERY_STATES) {
      const row = DRAWN_MOTION.find((entry) => entry.character === character && entry.state === state);
      if (row === undefined) { off.push(`${character}/${state}: no measurement`); continue; }
      const model = ORIGINALS[character] ?? heroDefinition(character)?.presentation.model;
      const clips = [...new Set(sampleMotion(character, state).map((frame) => frame.clip ?? -1))];
      const label = `${character}/${state}`;
      if (row.model !== model || JSON.stringify(row.clips) !== JSON.stringify(clips)) off.push(`${label}: model or dispatch changed; measure again`);
      if (clips.length !== 1 || clips[0] === undefined || clips[0] < 0) off.push(`${label}: must play one dedicated clip`);
      else selected.push(clips[0]);
      // Even a compact spot dodge must displace the body, beyond idle breathing.
      if (row.body < 5 || row.motion < 20) off.push(`${label}: body ${row.body.toFixed(1)}, extremity ${row.motion.toFixed(1)}`);
      if ((state.includes("forward") || state.endsWith("back")) && row.toward < 20) off.push(`${label}: insufficient travel in its direction`);
      if (state === "get-up-attack" && (row.toward < 30 || row.against < 30)) off.push(`${label}: must swing both sides`);
    }
    if (new Set(selected).size !== RECOVERY_STATES.length) off.push(`${character}: recovery actions share a clip`);
  }
  expect(off).toEqual([]);
});
