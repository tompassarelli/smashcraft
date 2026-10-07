import { expect, test } from "bun:test";
import { HOME_STAGES } from "../src/game/menu/homeStages";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";

const DOC = `${import.meta.dir}/../../docs/design/home-stages.md`;

test("every selectable fighter has exactly one home stage", () => {
  expect(HOME_STAGES.map(entry => entry.character).sort((a, b) => a - b)).toEqual([...SELECTABLE_CHARACTERS].sort((a, b) => a - b));
});

test("docs/design/home-stages.md's table is the source table", async () => {
  const rows = (await Bun.file(DOC).text()).split("\n")
    .filter(line => line.startsWith("| ") && !line.startsWith("| Fighter") && !line.startsWith("| ---"))
    .map(line => line.split("|").map(cell => cell.trim()));
  expect(rows.map(cells => [cells[1], Number(cells[3])])).toEqual(HOME_STAGES.map(({ character, stage }) => [fighterName(character), stage]));
  for (const cells of rows) {
    const stage = STAGE_CATALOG.find(({ id }) => id === Number(cells[3]));
    if (stage !== undefined) expect(cells[2]).toBe(stage.name);
  }
});
