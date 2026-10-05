import { join } from "node:path";
import { Effect } from "effect";
import { expect, test } from "bun:test";
import { verifyToolchain } from "waygate/scripts/waygate/mapBuild";
import { composeScript, typescriptBase } from "waygate/scripts/mapScript";
import { fileIoAbility } from "../scripts/objectData";
import { GENERATED_MODELS, MODEL_SOUND_TABLE, ORIGINAL_CLIP_MODELS, SCRIPT_MODELS, missingModels, soundTableProblem } from "../scripts/waygate/mapInputs";
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
  const clipFiles = ORIGINAL_CLIP_MODELS.map((model) => model.slice("war3mapImported\\".length));
  expect(missingModels(clipFiles, ORIGINAL_CLIP_MODELS)).toBeUndefined();
  expect(missingModels(clipFiles.slice(4), ORIGINAL_CLIP_MODELS)).toMatch(/ and 1 more not among the imports$/);
});

test("every model sound cue names a stock label and keys a pooled clip", () => {
  expect(soundTableProblem(MODEL_SOUND_TABLE)).toBeUndefined();
  const cue = { sequenceIndex: 0, seconds: 0.0, soundIndex: 0 };
  const clip = { modelPath: "war3mapImported\\Clip-0.mdx", startSeconds: 0.0, endSeconds: 1.0, looping: false };
  const table = { cueCount: () => 1, cue: () => cue, label: () => "ArcherDeath", clip: () => clip };
  expect(soundTableProblem(table)).toBeUndefined();
  expect(soundTableProblem({ ...table, label: () => "" })).toBe("character 0 sound cue 0 names no sound label");
  expect(soundTableProblem({ ...table, label: () => undefined })).toBe("character 0 sound cue 0 names no sound label");
  expect(soundTableProblem({ ...table, clip: () => undefined })).toBe("character 0 sound cue 0 keys sequence 0, which has no clip");
});

test("the FileIO ability retains the recorded war3map.w3a bytes", () => {
  const hash = new Bun.CryptoHasher("sha256").update(fileIoAbility()).digest("hex");
  expect(hash).toBe("28b1c0200840165876f4feccaf5bb389a2261e7492ffb0269b23ba0cb569e994");
});
