import { join } from "node:path";
import { Effect } from "effect";
import { expect, test } from "bun:test";
import { verifyToolchain } from "wisp/scripts/wisp/mapBuild";
import { fileIoAbility } from "../scripts/objectData";
import { GENERATED_MODELS, MODEL_SOUND_TABLE, SCRIPT_MODELS, soundTableProblem } from "../scripts/wisp/mapInputs";
import { STAGE_DECK_MODEL } from "../src/game/assets/stageAssetInfo";
import { importedModelFile } from "../scripts/heroModelSource";

const project = join(import.meta.dir, "../..");

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

test("every model sound cue names a stock label and keys a pooled clip [invariant]", () => {
  expect(soundTableProblem(MODEL_SOUND_TABLE)).toBeUndefined();
});

test("the FileIO ability retains the recorded war3map.w3a bytes [reference]", () => {
  const hash = new Bun.CryptoHasher("sha256").update(fileIoAbility()).digest("hex");
  expect(hash).toBe("28b1c0200840165876f4feccaf5bb389a2261e7492ffb0269b23ba0cb569e994");
});
