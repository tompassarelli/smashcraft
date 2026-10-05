import { join } from "node:path";
import { Effect } from "effect";
import { expect, test } from "bun:test";
import { verifyToolchain } from "wisp/scripts/wisp/mapBuild";
import { composeScript, typescriptBase } from "wisp/scripts/mapScript";
import { fileIoAbility } from "../scripts/objectData";
import { GENERATED_MODELS, SCRIPT_MODELS, missingModels } from "../scripts/wisp/mapInputs";
import { STAGE_DECK_MODEL } from "../src/game/assets/stageAssetInfo";

const project = join(import.meta.dir, "../..");
const baseMapScript = "function main()\nInitBlizzard()\nRunInitializationTriggers()\nend\n\nfunction config()\nSetPlayers(1)\nend\n";
const bundle = { text: "return { start = function() end }", key: "1-2" };

test("the installed TypeScript toolchain matches typescript-toolchain.lock", async () => {
  await Effect.runPromise(verifyToolchain(join(project, "typescript-toolchain.lock"), join(project, "ts")));
});

test("a TypeScript-only map starts the TypeScript entry with its own config, before and after a rebuild", () => {
  const base = typescriptBase(baseMapScript, "function mapConfig()\n    SetPlayers(4)\nend\n");
  expect(base).not.toMatch(/^RunInitializationTriggers\(\)$/m);
  for (const candidate of [bundle, { ...bundle, key: "3-4" }]) {
    const script = composeScript(base, candidate, "smashcraftTs");
    expect(script).toContain(`function main()\n    baseMain()\n    smashcraftTs.start("${candidate.key}")\nend`);
    expect(script).toContain("function config()\n    mapConfig()\nend");
  }
  expect(() => composeScript(base, undefined, "smashcraftTs")).toThrow();
});

test("every imported model the map script names is a distinct content-addressed path", () => {
  expect(SCRIPT_MODELS).toContain(STAGE_DECK_MODEL);
  for (const { models } of GENERATED_MODELS) expect(models.length).toBeGreaterThan(0);
  for (const model of SCRIPT_MODELS) expect(model).toMatch(/^war3mapImported\\[A-Za-z0-9]+-[0-9a-f]{64}\.mdx$/);
  expect(new Set(SCRIPT_MODELS).size).toBe(SCRIPT_MODELS.length);
});

test("a build refuses import lists that lack a model the script names", () => {
  const deck = STAGE_DECK_MODEL.slice("war3mapImported\\".length);
  expect(missingModels([deck, "StagePalette-0.tga"], [STAGE_DECK_MODEL])).toBeUndefined();
  expect(missingModels([deck], [STAGE_DECK_MODEL, ""])).toBe("the map script names an empty model path");
  expect(missingModels(["StageDeck-0.mdx", "StagePalette-0.tga"], [STAGE_DECK_MODEL])).toBe(`${STAGE_DECK_MODEL} not among the imports`);
});

test("the FileIO ability retains the recorded war3map.w3a bytes", () => {
  const hash = new Bun.CryptoHasher("sha256").update(fileIoAbility()).digest("hex");
  expect(hash).toBe("28b1c0200840165876f4feccaf5bb389a2261e7492ffb0269b23ba0cb569e994");
});
