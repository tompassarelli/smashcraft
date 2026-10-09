

import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { PLAYABLE_CHARACTERS, SELECTABLE_CHARACTERS, nextCharacterIn, playableCharactersOf } from "../src/game/sim/heroes/registry";
import { createMatchState } from "../src/game/match/rules";

test("a hidden fighter is skipped by selection stepping and never preselected; measurement keeps it [spec docs/design/roster.md]", () => {
  const playable = playableCharactersOf(SELECTABLE_CHARACTERS, ["rifleman"]);
  expect(playable).not.toContain(Character.rifleman);
  expect(playable.length).toBe(SELECTABLE_CHARACTERS.length - 1);
  expect(nextCharacterIn(playable, Character.rifleman, 1)).toBe(Character.demonHunter);
  expect(nextCharacterIn(playable, Character.demonHunter, -1)).toBe(playable[playable.length - 1]);
  for (let step = 0, at: Character = Character.rifleman; step < 2 * playable.length; step++) {
    at = nextCharacterIn(playable, at, 1);
    expect(at).not.toBe(Character.rifleman);
  }
  expect(playableCharactersOf(SELECTABLE_CHARACTERS, SELECTABLE_CHARACTERS.map(() => "rifleman")).length).toBe(SELECTABLE_CHARACTERS.length - 1);
  for (const choice of createMatchState().characterChoices) expect(PLAYABLE_CHARACTERS).toContain(choice);
});
