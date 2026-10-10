import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAMILY_NAMES, MANIFEST, readPins, writePin } from "../scripts/wisp/buildInputs";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { MODEL_FACTS_DIRECTORY, modelFactsFile, readModelFacts, writeModelFacts } from "../scripts/wisp/modelFactsTable";
import { readMapBaseline, writeMapBaseline } from "../scripts/mapSize";
import { MOVE_LIST_PATH, moveListMarkdown } from "../scripts/moveList";
import { ensureGenerated } from "../scripts/generated";

const scratch = () => mkdtempSync(join(tmpdir(), "smashcraft-generated-"));

test("every build-input family has its own pin file, and pinning one family touches only its file [spec #401]", () => {
  expect(Object.keys(readPins()).sort()).toEqual([...FAMILY_NAMES].sort());
  const directory = scratch();
  writePin("hero-models", "a".repeat(64), directory);
  writePin("impact-assets", "b".repeat(64), directory);
  writePin("hero-models", "c".repeat(64), directory);
  expect(readdirSync(directory).sort()).toEqual(["hero-models", "impact-assets"]);
  expect(readPins(directory)).toEqual({ "hero-models": "c".repeat(64), "impact-assets": "b".repeat(64) });
  expect(existsSync(`${MANIFEST}.json`)).toBe(false);
});

test("model facts live one file per model, and writing a table rewrites only the models that changed [spec #401]", () => {
  expect(readdirSync(MODEL_FACTS_DIRECTORY).length).toBe(Object.keys(MODEL_FACTS).length);
  const directory = scratch();
  const [first, second] = Object.entries(MODEL_FACTS);
  writeModelFacts(Object.fromEntries([first!, second!]), directory);
  const otherPath = join(directory, modelFactsFile(second![0]));
  const before = readFileSync(otherPath, "utf8");
  writeModelFacts({ [first![0]]: { ...first![1], geosets: first![1].geosets + 1 }, [second![0]]: second![1] }, directory);
  expect(readFileSync(otherPath, "utf8")).toBe(before);
  expect(readModelFacts(directory)[first![0]]?.geosets).toBe(first![1].geosets + 1);
  writeModelFacts({ [second![0]]: second![1] }, directory);
  expect(readdirSync(directory)).toEqual([modelFactsFile(second![0])]);
  expect(modelFactsFile("war3mapImported\\A.mdx")).not.toBe(modelFactsFile("war3mapImported\\a.mdx"));
});

test("the map size baseline has no total row: its total is its rows' sum [spec #401]", () => {
  const path = join(scratch(), "baseline.tsv");
  writeMapBaseline(path, { total: 10_400_000, imports: new Map([["b.mdx", 6_000_000], ["a.blp", 4_000_000]]) });
  const text = readFileSync(path, "utf8");
  expect(text).not.toContain("(map total)");
  expect(readMapBaseline(path)).toEqual({ total: 11_000_000, imports: new Map([["a.blp", 4_000_000], ["b.mdx", 6_000_000]]) });
});

test("the move list is generated from the kit data and regenerated when missing [spec #401]", () => {
  ensureGenerated();
  expect(ensureGenerated()).toEqual([]);
  rmSync(MOVE_LIST_PATH);
  expect(ensureGenerated()).toEqual(["move-list"]);
  expect(readFileSync(MOVE_LIST_PATH, "utf8")).toBe(moveListMarkdown());
});
