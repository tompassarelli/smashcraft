import { join } from "node:path";
import { Effect } from "effect";
import { expect, test } from "bun:test";
import { verifyToolchain } from "wisp/scripts/wisp/mapBuild";
import { fileIoAbility } from "../scripts/objectData";
import { GENERATED_MODELS, MODEL_SOUND_TABLE, SCRIPT_MODELS, TOMB_WATERFALL_IMPORTS, importProblem, soundTableProblem } from "../scripts/wisp/mapInputs";
import { STAGE_DECK_MODEL } from "../src/game/assets/stageAssetInfo";
import { importedModelFile } from "../scripts/heroModelSource";
import { generatedFiles } from "../scripts/wisp/commands/map";
import { unresolvedHdTexture } from "../scripts/hdBodyTextures";

const project = join(import.meta.dir, "../..");

test("an imported HD body cannot depend on a missing Definitive stock texture [repro #334]", () => {
  const bytes = new Uint8Array(4 + 8 + 268);
  bytes.set(new TextEncoder().encode("MDLXTEXS"));
  new DataView(bytes.buffer).setUint32(8, 268, true);
  const path = "Units/Orc/HeroTaurenChieftain/Tauren_Chieftain_Diffuse.tif";
  bytes.set(new TextEncoder().encode(path), 16);
  expect(unresolvedHdTexture(bytes, new Set())).toBe(path);
  expect(unresolvedHdTexture(bytes, new Set([path.replaceAll("/", "\\").toLowerCase()]))).toBeUndefined();
  new DataView(bytes.buffer).setUint32(12, 1, true);
  expect(unresolvedHdTexture(bytes, new Set())).toBeUndefined();
});

test("the installed TypeScript toolchain matches typescript-toolchain.lock [spec AGENTS.md]", async () => {
  await Effect.runPromise(verifyToolchain(join(project, "typescript-toolchain.lock"), join(project, "ts")));
  // Wisp's check predates the host tools' platform package (docs/typescript.md, "Host tools").
  const locked = Bun.TOML.parse(await Bun.file(join(project, "typescript-toolchain.lock")).text());
  const declared = (await Bun.file(join(project, "ts/package.json")).json()).devDependencies["@effect/platform-bun"];
  const installed = async (name: string) => (await Bun.file(join(project, "ts/node_modules", name, "package.json")).json()).version;
  const version = locked["effectPlatformBun"];
  expect({ declared, bun: await installed("@effect/platform-bun"), shared: await installed("@effect/platform-node-shared") }).toEqual({ declared: version, bun: version, shared: version });
});

test("every imported model the map script names is a distinct content-addressed path [invariant]", () => {
  expect(SCRIPT_MODELS).toContain(STAGE_DECK_MODEL);
  for (const { models } of GENERATED_MODELS) expect(models.length).toBeGreaterThan(0);
  // A community model keeps the archive path its author's readme names (importedModelInfo.ts); every generated one is content-addressed.
  for (const model of SCRIPT_MODELS) if (importedModelFile(model) === undefined) expect(model).toMatch(/^war3mapImported\\[A-Za-z0-9]+-[0-9a-f]{64}\.mdx$/);
  expect(new Set(SCRIPT_MODELS).size).toBe(SCRIPT_MODELS.length);
});

test("the map build refuses an archive path imported twice or from a missing file, as Tomb's waterfall was [repro #242]", () => {
  const waterfall = TOMB_WATERFALL_IMPORTS.map(({ entry, file }) => ({ entry, source: `stage-assets/${file}` }));
  const present = (path: string) => !path.endsWith("TombWaterfallHD.mdx");
  expect(importProblem(waterfall, () => true)).toBeUndefined();
  expect(importProblem(waterfall, present)).toContain("_hd.w3mod\\Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx's file stage-assets/TombWaterfallHD.mdx is missing");
  const twice = [...waterfall, { entry: waterfall[0]!.entry.toUpperCase(), source: "other.mdx" }];
  expect(importProblem(twice, () => true)).toContain("imported twice, from stage-assets/TombWaterfallHD.mdx and other.mdx");
});

test("every model sound cue names a stock label and keys a pooled clip [invariant]", () => {
  expect(soundTableProblem(MODEL_SOUND_TABLE)).toBeUndefined();
});

test("the FileIO ability retains the recorded war3map.w3a bytes [reference]", () => {
  const hash = new Bun.CryptoHasher("sha256").update(fileIoAbility()).digest("hex");
  expect(hash).toBe("28b1c0200840165876f4feccaf5bb389a2261e7492ffb0269b23ba0cb569e994");
});

test("the map ships war3mapPostProcessing.txt: Forgotten Hollow's contact-shadow ASSAO and bloom above 0.9 only [spec #288]", () => {
  const file = generatedFiles().find(({ entry }) => entry === "war3mapPostProcessing.txt");
  // Radius and ShadowMultiplier from Blizzard's (1)ForgottenHollow.w3x; Bloom Enabled 0 and threshold 0.72 in stock PostProcessingConfig.txt.
  expect(new TextDecoder().decode(file?.contents)).toBe(
    "[ASSAO]\r\nRadius=6.000000\r\nShadowMultiplier=3.000000\r\n\r\n[Bloom]\r\nEnabled=1\r\nBloomThreshold=0.900000\r\n",
  );
});
