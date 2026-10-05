import { join } from "node:path";
import { Effect } from "effect";
import { expect, test } from "bun:test";
import { verifyToolchain } from "waygate/scripts/waygate/mapBuild";
import { composeScript, typescriptBase } from "waygate/scripts/mapScript";
import { fileIoAbility } from "../scripts/objectData";
import { missingStageDeck } from "../scripts/waygate/mapInputs";
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

test("every match-running map draws its stage with a packaged content-addressed deck model", () => {
  expect(STAGE_DECK_MODEL).toMatch(/^war3mapImported\\StageDeck-[0-9a-f]{64}\.mdx$/);
  const deck = STAGE_DECK_MODEL.slice("war3mapImported\\".length);
  expect(missingStageDeck([deck, "StagePalette-0.tga"], STAGE_DECK_MODEL)).toBeUndefined();
  expect(missingStageDeck([deck], "")).toBe("the map script names no stage deck model");
  expect(missingStageDeck(["StageDeck-0.mdx", "StagePalette-0.tga"], STAGE_DECK_MODEL)).toContain("is not among the stage imports");
});

test("the FileIO ability retains the recorded war3map.w3a bytes", () => {
  const hash = new Bun.CryptoHasher("sha256").update(fileIoAbility()).digest("hex");
  expect(hash).toBe("28b1c0200840165876f4feccaf5bb389a2261e7492ffb0269b23ba0cb569e994");
});
