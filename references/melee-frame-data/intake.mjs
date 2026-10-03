// Foreign-data boundary only: reads a public reference database, never gameplay.
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const revision = "ec5155149faeed24b5e5781d7efe17387cc9ee3d";
const expected = "ebdc169f3b97a3b8693206ca00f8f9b4fb1684f237a41367bf149af581320eb6";
const [databasePath, outputDirectory] = process.argv.slice(2);
if (!databasePath || !outputDirectory) throw new Error("Usage: bun intake.mjs DATABASE OUTPUT_DIRECTORY");
if (createHash("sha256").update(readFileSync(databasePath)).digest("hex") !== expected)
  throw new Error("Source bytes differ from the inspected revision");
const db = new Database(databasePath, { readonly: true });
const records = [];
for (const table of ["attacks", "grabs", "throws", "dodges", "misc"]) {
  const rows = db.query(`SELECT * FROM ${table}`).all();
  rows.sort((a, b) => JSON.stringify([a.char, a.move ?? a.type ?? ""]).localeCompare(JSON.stringify([b.char, b.move ?? b.type ?? ""])));
  for (const row of rows) {
    const { char, move, type, notes, ...sourceValues } = row;
    for (const value of Object.values(sourceValues))
      if (value !== null && value !== "" && typeof value !== "number") throw new Error("Unexpected nonnumeric source value; review rights and representation before intake");
    records.push({
      schema_version: 1, character: char, category: table, action: move ?? type ?? null,
      source: { repository: "https://github.com/mitchhit234/meleeWebProject", revision,
        path: "characters.db", table, page: `https://meleeframedata.com/${char}` },
      game_revision: null, frame_index_origin: 1,
      source_values: sourceValues,
      values: Object.fromEntries(Object.entries(sourceValues).map(([key, value]) => [key, value === -1 || value === "" ? null : value])),
      notes_present_but_excluded: Boolean(notes?.trim()),
    });
  }
}
db.close();
const output = records.map(r => JSON.stringify(r)).join("\n") + "\n";
writeFileSync(join(outputDirectory, "records.jsonl"), output);
const parsed = output.trimEnd().split("\n").map(line => JSON.parse(line));
const coverage = {};
const missing = {};
for (const row of parsed) {
  const byCharacter = coverage[row.character] ??= {};
  byCharacter[row.category] = (byCharacter[row.category] ?? 0) + 1;
  for (const [key, value] of Object.entries(row.values)) if (value === null) {
    const field = `${row.category}.${key}`;
    missing[field] = (missing[field] ?? 0) + 1;
  }
}
for (const [character, start, end, total, iasa, stun] of [["fox",2,3,17,16,3],["falco",2,3,17,16,3],["marth",4,7,27,26,4]]) {
  const row = parsed.find(r => r.character === character && r.category === "attacks" && r.action === "jab1");
  for (const [key, expectedValue] of Object.entries({start,end,total,iasa,stun}))
    if (row?.values[key] !== expectedValue) throw new Error(`Representative source mismatch: ${character}.${key}`);
}
const summary = { record_count: parsed.length, character_ids: Object.keys(coverage).length,
  records_with_excluded_notes: parsed.filter(r => r.notes_present_but_excluded).length,
  records_with_missing_values: parsed.filter(r => Object.values(r.values).includes(null)).length,
  by_character: coverage, missing_by_field: missing };
writeFileSync(join(outputDirectory, "coverage.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
