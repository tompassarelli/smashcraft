import { join } from "node:path";
import { AttackStyle, Character, LAST_ATTACK_STYLE } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterName, heroDefinition } from "../src/game/sim/heroes/registry";
import { SPECIAL_INPUTS, fighterKit, normalName } from "../src/game/sim/moveNames";
import { type SoundLayer, moveSound, specialMove } from "../src/game/presentation/moveSounds";

export const SOUND_TABLE_PATH = join(import.meta.dir, "../../docs/design/sound-table.md");

const BACKSLASH = String.fromCharCode(92);
const short = (sound: string) => sound.includes(BACKSLASH) ? sound.slice(sound.lastIndexOf(BACKSLASH) + 1).replace(/\.flac$/, "") : sound;
const cell = (layers: readonly SoundLayer[]) => layers.map((layer) => layer.sounds.map(short).join(" / ")).join(" + ");

export function soundTableMarkdown(): string {
  const lines = [
    "# Move sound table",
    "",
    "Generated from smashcraft:ts/src/game/presentation/moveSounds.ts by",
    "`bun scripts/soundTable.ts` (from smashcraft:ts/); edit the table there, never here.",
    "The model and its reasons are in [sound.md](sound.md). Names are Warcraft III sound",
    "labels (AnimSounds, AbilitySounds, UnitCombatSounds) or file names; `A / B` is",
    "alternatives a serial picks among, `A + B` layers. A whiff plays the perform column",
    "alone. Voice plays on two of three uses. A normal's fire, electric, ice, dark, holy,",
    "poison or arcane hit also layers that element's sound. Normals sharing every sound share a row.",
  ];
  for (const character of SELECTABLE_CHARACTERS) {
    const hero = heroDefinition(character);
    const kit = fighterKit(character);
    lines.push("", `## ${fighterName(character)}`, "", "| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |", "| --- | --- | --- | --- | --- | --- |");
    const groups = new Map<string, string[]>();
    for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
      if (style === AttackStyle.grab || (hero !== undefined && hero.moves.normals[style] === undefined)) continue;
      if (hero === undefined && style === AttackStyle.shot && character !== Character.rifleman) continue;
      const row = moveSound(character, style);
      if (row === undefined) continue;
      const key = `${cell(row.perform)} | ${cell(row.hit)} | ${cell(row.strong)} | ${cell(row.shield)} | ${row.voice === undefined ? "" : cell([row.voice])}`;
      groups.set(key, [...(groups.get(key) ?? []), normalName(style)]);
    }
    for (const [key, names] of groups) lines.push(`| ${names.join(", ")} | ${key} |`);
    for (let slot = 0; slot < 4; slot++) {
      const row = moveSound(character, specialMove(slot));
      if (row === undefined) continue;
      const name = kit.specials[slot]?.name ?? "";
      lines.push(`| ${SPECIAL_INPUTS[slot]}: ${name} | ${cell(row.perform)} | ${cell(row.hit)} | ${cell(row.strong)} | ${cell(row.shield)} | ${row.voice === undefined ? "" : cell([row.voice])} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

if (import.meta.main) {
  await Bun.write(SOUND_TABLE_PATH, soundTableMarkdown());
  console.log(`wrote ${SOUND_TABLE_PATH}`);
}
