// Writes smashcraft:docs/move-list.md, every selectable fighter's move list,
// from the kit data (src/game/sim/moveNames.ts). test/move-list.test.ts
// fails when the committed page differs, so a renamed move needs a rerun:
//   bun scripts/moveList.ts
import { join } from "node:path";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { SPECIAL_INPUTS, fighterKit } from "../src/game/sim/moveNames";

export const MOVE_LIST_PATH = join(import.meta.dir, "../../docs/move-list.md");

const cell = (text: string) => text.replaceAll("|", "\\|");

export function moveListMarkdown(): string {
  const lines = [
    "# Move list",
    "",
    "Generated from the fighters' kit data by `bun scripts/moveList.ts` (from",
    "smashcraft:ts/); edit the names there, never here. Specials, passives and",
    "ultimates have official names, and so does each jab chain; the other",
    "normals are named by their input (forward tilt, forward air, down smash,",
    "pummel, up throw). A normal's",
    "\"inspired by\" note is a design reference, not a name. Ultimates are off in",
    "matches until the match rules turn them on.",
  ];
  for (const character of SELECTABLE_CHARACTERS) {
    const kit = fighterKit(character);
    lines.push("", `## ${fighterName(character)}`, "", "| Input | Name | What it does |", "| --- | --- | --- |");
    kit.specials.forEach((special, slot) => {
      const forms = special.forms.length === 0 ? "" : ` (${special.forms.map((form) => form.name).join(", ")})`;
      lines.push(`| ${SPECIAL_INPUTS[slot] ?? "Special"} | ${cell(special.name)}${cell(forms)} | ${cell(special.description)} |`);
    });
    lines.push(`| Jab, repeated | ${cell(kit.jab.name)} | ${cell(kit.jab.description)} |`);
    const { passive } = kit;
    lines.push(passive === undefined ? `| Passive | none | ${cell(kit.trait ?? "")} |` : `| Passive | ${cell(passive.name)} | ${cell(passive.description)} |`);
    if (kit.ultimate !== undefined) lines.push(`| Ultimate | ${cell(kit.ultimate.name)} | ${cell(kit.ultimate.description)} |`);
    if (kit.inspiredBy.length > 0) {
      lines.push("", "Normals, inspired by:", "");
      for (const { move, note } of kit.inspiredBy) lines.push(`- ${move}: ${note}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

if (import.meta.main) {
  await Bun.write(MOVE_LIST_PATH, moveListMarkdown());
  console.log(`wrote ${MOVE_LIST_PATH}`);
}
