// Foreign-data boundary only: reduces libmelee's recorded per-frame table to the
// hitbox positions of normal attacks and grabs and the travel of ground dodges.
// Usage: bun libmelee-intake.ts FRAMEDATA.csv OUTPUT_DIRECTORY
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const revision = "ef679270ff95f0d42339dcdf1608282a35023349";
const expected = "8e0d811290b511902076c0011db1a0116356a7ddaa68dfa369ea4f5dcdc93777";
const [csvPath, outputDirectory] = process.argv.slice(2);
if (csvPath === undefined || outputDirectory === undefined) throw new Error("Usage: bun libmelee-intake.ts FRAMEDATA.csv OUTPUT_DIRECTORY");
const bytes = readFileSync(csvPath);
if (createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error("Source bytes differ from the inspected revision");

// libmelee Character values are the game's fighter kinds; Popo stands for the Ice Climbers, Nana is left out.
const characters = new Map<number, string>([
  [0, "mario"], [1, "fox"], [2, "captain_falcon"], [3, "donkey_kong"], [4, "kirby"], [5, "bowser"], [6, "link"],
  [7, "sheik"], [8, "ness"], [9, "peach"], [10, "ice_climbers"], [12, "pikachu"], [13, "samus"], [14, "yoshi"],
  [15, "jigglypuff"], [16, "mewtwo"], [17, "luigi"], [18, "marth"], [19, "zelda"], [20, "young_link"],
  [21, "dr._mario"], [22, "falco"], [23, "pichu"], [24, "mr._game_&_watch"], [25, "ganondorf"], [26, "roy"],
]);
// libmelee Action values are the game's action states; names follow records.jsonl. Forward tilt and
// forward smash are the unangled variants.
const actions = new Map<number, [string, string]>([
  [44, ["attacks", "jab1"]], [45, ["attacks", "jab2"]], [46, ["attacks", "jab3"]], [50, ["attacks", "dattack"]],
  [53, ["attacks", "ftilt"]], [56, ["attacks", "utilt"]], [57, ["attacks", "dtilt"]], [60, ["attacks", "fsmash"]],
  [63, ["attacks", "usmash"]], [64, ["attacks", "dsmash"]], [65, ["attacks", "nair"]], [66, ["attacks", "fair"]],
  [67, ["attacks", "bair"]], [68, ["attacks", "uair"]], [69, ["attacks", "dair"]],
  [212, ["grabs", "standing_grab"]], [214, ["grabs", "dash_grab"]],
  [233, ["dodges", "forward_roll"]], [234, ["dodges", "back_roll"]], [235, ["dodges", "spot_dodge"]],
]);

const lines = bytes.toString("utf8").trimEnd().split("\n");
const header = lines[0]?.split(",").map((name) => name.replaceAll('"', ""));
if (header === undefined) throw new Error("Empty source");
const column = (name: string): number => {
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`Missing column ${name}`);
  return index;
};
const number = (text: string | undefined): number => {
  const value = Number(text);
  if (text === undefined || text === "" || !Number.isFinite(value)) throw new Error(`Unexpected numeric value ${text}`);
  return value;
};
const flag = (text: string | undefined): boolean => {
  if (text === '"True"') return true;
  if (text === '"False"') return false;
  throw new Error(`Unexpected flag ${text}`);
};

type Frame = { frame: number; hitboxes: { size: number; x: number; y: number }[]; locomotion_x: number; locomotion_y: number; iasa: boolean; facing_changed: boolean };
const grouped = new Map<string, { character: number; action: number; frames: Frame[] }>();
for (const line of lines.slice(1)) {
  const cells = line.split(",");
  const character = number(cells[column("character")]), action = number(cells[column("action")]);
  if (!characters.has(character) || !actions.has(action)) continue;
  const hitboxes = [1, 2, 3, 4].filter((n) => flag(cells[column(`hitbox_${n}_status`)])).map((n) => ({
    size: number(cells[column(`hitbox_${n}_size`)]), x: number(cells[column(`hitbox_${n}_x`)]), y: number(cells[column(`hitbox_${n}_y`)]),
  }));
  const key = `${character}/${action}`;
  const entry = grouped.get(key) ?? { character, action, frames: [] };
  entry.frames.push({
    frame: number(cells[column("frame")]), hitboxes,
    locomotion_x: number(cells[column("locomotion_x")]), locomotion_y: number(cells[column("locomotion_y")]),
    iasa: flag(cells[column("iasa")]), facing_changed: flag(cells[column("facing_changed")]),
  });
  grouped.set(key, entry);
}

const records = [...grouped.values()].map(({ character, action, frames }) => {
  frames.sort((a, b) => a.frame - b.frame);
  const [category, name] = actions.get(action) ?? ["", ""];
  frames.forEach((frame, index) => { if (frame.frame !== index + 1) throw new Error(`Frame gap in ${character}/${action}`); });
  const firstIasa = frames.find((frame) => frame.iasa)?.frame ?? null;
  const firstTurn = frames.find((frame) => frame.facing_changed)?.frame ?? null;
  return {
    schema_version: 1, character: characters.get(character), category, action: name,
    source: { repository: "https://github.com/altf4/libmelee", revision, path: "melee/framedata.csv", libmelee_character: character, libmelee_action: action },
    frame_index_origin: 1, recorded_frames: frames.length, first_iasa_frame: firstIasa, first_facing_changed_frame: firstTurn,
    hitbox_frames: frames.filter((frame) => frame.hitboxes.length > 0).map(({ frame, hitboxes }) => ({ frame, hitboxes })),
    locomotion_x: category === "dodges" ? frames.map((frame) => frame.locomotion_x) : null,
  };
});
records.sort((a, b) => JSON.stringify([a.character, a.category, a.action]).localeCompare(JSON.stringify([b.character, b.category, b.action])));
const output = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
writeFileSync(join(outputDirectory, "libmelee.jsonl"), output);

// Representative checks: Fox's jab hits on frames 2-3, his forward roll travels and turns on frame 20.
const parsed = output.trimEnd().split("\n").map((line) => JSON.parse(line));
const foxJab = parsed.find((r) => r.character === "fox" && r.action === "jab1");
if (JSON.stringify(foxJab?.hitbox_frames.map((f: Frame) => f.frame)) !== "[2,3]") throw new Error("Fox jab active frames differ");
const foxRoll = parsed.find((r) => r.character === "fox" && r.action === "forward_roll");
if (foxRoll?.first_facing_changed_frame !== 20 || foxRoll?.recorded_frames !== 31) throw new Error("Fox forward roll differs");
console.log(JSON.stringify({ records: parsed.length, characters: new Set(parsed.map((r) => r.character)).size,
  with_hitboxes: parsed.filter((r) => r.hitbox_frames.length > 0).length }));
