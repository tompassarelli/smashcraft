// The release roster: a fighter failing the balance gate is hidden from
// selection stepping, while measurement keeps the whole roster.
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { PLAYABLE_CHARACTERS, SELECTABLE_CHARACTERS, nextCharacterIn, playableCharactersOf } from "../src/game/sim/heroes/registry";
import { createMatchState } from "../src/game/match/rules";
import { hiddenFighters, releaseRosterSource } from "../scripts/releaseRoster";
import type { FighterSummary } from "../scripts/cpuField";

test("a hidden fighter is skipped by selection stepping and never preselected; measurement keeps it", () => {
  const playable = playableCharactersOf(SELECTABLE_CHARACTERS, ["rifleman"]);
  expect(playable).not.toContain(Character.rifleman);
  expect(playable.length).toBe(SELECTABLE_CHARACTERS.length - 1);
  expect(nextCharacterIn(playable, Character.archer, 1)).toBe(Character.demonHunter);
  expect(nextCharacterIn(playable, Character.demonHunter, -1)).toBe(Character.archer);
  for (let step = 0, at: Character = Character.archer; step < 2 * playable.length; step++) {
    at = nextCharacterIn(playable, at, 1);
    expect(at).not.toBe(Character.rifleman);
  }
  expect(playableCharactersOf(SELECTABLE_CHARACTERS, SELECTABLE_CHARACTERS.map(() => "archer")).length).toBe(SELECTABLE_CHARACTERS.length - 1);
  for (const choice of createMatchState().characterChoices) expect(PLAYABLE_CHARACTERS).toContain(choice);
});

test("a gate run's outside fighters become the hidden list", () => {
  const summary = (fighter: string, winRate: number, opponents: readonly string[]) =>
    ({ fighter, winRate, played: Object.fromEntries(opponents.map((o) => [o, 400])), against: Object.fromEntries(opponents.map((o) => [o, 0.5])), decisive: Object.fromEntries(opponents.map((o) => [o, 400])) }) as unknown as FighterSummary;
  const field = { options: { opponents: ["wren", "wren"] as const, tiers: ["expert", "expert"] as const }, summaries: [summary("archer", 0.38, ["rifleman", "illidan"]), summary("rifleman", 0.71, ["illidan"]), summary("illidan", 0.5, [])] };
  expect(hiddenFighters(field)).toEqual(["archer", "rifleman"]);
  expect(() => hiddenFighters({ ...field, options: { ...field.options, tiers: ["intermediate", "intermediate"] } })).toThrow("not a gate run");
  expect(() => hiddenFighters({ ...field, options: { ...field.options, opponents: ["ember", "ember"] } })).toThrow("not a gate run");
  expect(() => hiddenFighters({ ...field, options: {} })).toThrow("not a gate run");
  expect(releaseRosterSource(["archer", "rifleman"])).toContain('HIDDEN_FIGHTERS: readonly string[] = ["archer", "rifleman"];');
});
