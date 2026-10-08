import { expect, test } from "bun:test";
import { HOME_STAGES } from "../src/game/menu/homeStages";
import { selectableStage } from "../src/game/menu/stageCatalog";
import { fighterSlug, SELECTABLE_CHARACTERS } from "../src/game/sim/heroes/registry";

test("[spec #268] every selectable fighter has one home stage that exists and is selectable [spec docs/design/home-stages.md]", () => {
  const problems: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    const entries = HOME_STAGES.filter(entry => entry.character === character);
    if (entries.length !== 1) problems.push(`${fighterSlug(character)}: got ${entries.length} home-stage entries, want 1`);
    for (const entry of entries) if (!selectableStage(entry.stage)) problems.push(`${fighterSlug(character)}: home stage ${entry.stage} is not a selectable stage`);
  }
  for (const entry of HOME_STAGES) if (!SELECTABLE_CHARACTERS.includes(entry.character)) problems.push(`${fighterSlug(entry.character)}: has a home stage but is not selectable`);
  expect(problems).toEqual([]);
});
