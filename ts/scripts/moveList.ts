



import { join } from "node:path";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { SPECIAL_INPUTS, fighterKit, normalName } from "../src/game/sim/moveNames";
import { WORLD_UNITS_PER_MELEE_UNIT, authoredTuning } from "../src/game/sim/tuning";
import { EdgeGuardTool, edgeGuardTool } from "../src/game/match/edgeGuardScenarios";
import { SIGNATURE_STRONG_HIT, strongHitReason, strongHitRows } from "../src/game/sim/strongHitTable";

export const MOVE_LIST_PATH = join(import.meta.dir, "../../docs/move-list.md");

const cell = (text: string) => text.replaceAll("|", "\\|");
const percent = (damage: number) => `${Math.round(damage * 10) / 10}%`;

export function moveListMarkdown(): string {
  const lines = [
    "# Move list",
    "",
    "Generated from the fighters' kit data by `bun scripts/moveList.ts` (from",
    "smashcraft:ts/); edit the names there, never here. Specials and",
    "ultimates have official names, and so does each jab chain; the other",
    "normals are named by their input (forward tilt, forward air, down smash,",
    "pummel, up throw). A normal's",
    "\"inspired by\" note is a design reference, not a name. An ultimate is",
    "Attack + Special together at a full bar (docs/design/ultimates.md), unless",
    "the match's Ultimates rule is off. Ground movement is in Melee units a frame,",
    "inside Melee's roster spread (smashcraft:docs/gameplay-design.md,",
    "\"Ground states and the stick map\").",
  ];
  const units = (value: number) => (value / WORLD_UNITS_PER_MELEE_UNIT).toFixed(2);
  for (const character of SELECTABLE_CHARACTERS) {
    const kit = fighterKit(character);
    lines.push("", `## ${fighterName(character)}`, "", "| Input | Name | What it does |", "| --- | --- | --- |");
    kit.specials.forEach((special, slot) => {
      const forms = special.forms.length === 0 ? "" : ` (${special.forms.map((form) => form.name).join(", ")})`;
      lines.push(`| ${SPECIAL_INPUTS[slot] ?? "Special"} | ${cell(special.name)}${cell(forms)} | ${cell(special.description)} |`);
    });
    lines.push(`| Jab, repeated | ${cell(kit.jab.name)} | ${cell(kit.jab.description)} |`);
    const tool = edgeGuardTool(character) === EdgeGuardTool.forwardAir ? "Forward air" : "Down air";
    lines.push(`| Edge-guard tool | ${tool} | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |`);
    if (kit.trait !== undefined) lines.push(`| Trait | | ${cell(kit.trait)} |`);
    if (kit.ultimate !== undefined) lines.push(`| Ultimate | ${cell(kit.ultimate.name)} | ${cell(kit.ultimate.description)} |`);
    const { physics, ground } = authoredTuning(character);
    lines.push("", `Ground movement: walk ${units(physics.walkSpeed)}, initial dash ${units(physics.dashSpeed)}, run ${units(physics.runSpeed)}; run from dash frame ${ground.dashRunEnableFrame}.`);
    if (kit.inspiredBy.length > 0) {
      lines.push("", "Normals, inspired by:", "");
      for (const { move, note } of kit.inspiredBy) lines.push(`- ${move}: ${note}`);
    }
    lines.push("", "Strong and weak hits (frames are active frames, damage uncharged):", "",
      "| Move | Axis | Strong hit | Weak hit | Why |", "| --- | --- | --- | --- | --- |");
    for (const row of strongHitRows(character)) {
      const signature = SIGNATURE_STRONG_HIT[character] === row.style ? " (signature)" : "";
      const strong = `${row.position ? "sweetspot" : "clean"}, frames ${row.strongFirst}-${row.strongLast}, ${percent(row.strongDamage)}`;
      const weak = `${row.position ? "sourspot" : "late"}, frames ${row.weakFirst}-${row.weakLast}, ${percent(row.weakDamage)}`;
      lines.push(`| ${normalName(row.style)}${signature} | ${row.position ? "Position" : "Timing"} | ${strong} | ${weak} | ${cell(strongHitReason(character, row.style) ?? "")} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

if (import.meta.main) {
  await Bun.write(MOVE_LIST_PATH, moveListMarkdown());
  console.log(`wrote ${MOVE_LIST_PATH}`);
}
