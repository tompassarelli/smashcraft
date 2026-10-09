




import { existsSync } from "node:fs";
import { join } from "node:path";
import { Console, Effect } from "effect";
import { FAMILY_NAMES, INPUTS_STORE, MANIFEST, readManifest, regenerate } from "./wisp/buildInputs";
import { GENERATED_MODELS, TOMB_WATERFALL_IMPORTS, missingModels } from "./wisp/mapInputs";
import { parseModelMDX } from "./mdxCodec";
import { WHITE_FIGHTER_MODELS } from "../src/game/assets/whiteFighterModels";
import { groundPlaneGeosets } from "./groundPlanes";

const store = process.argv[2] ?? INPUTS_STORE;

const program = Effect.gen(function*() {
  const manifest = yield* readManifest(MANIFEST);
  const problems: string[] = [];
  for (const { list, generator, models } of GENERATED_MODELS) {
    const family = FAMILY_NAMES.find((name) => list.startsWith(`${name}/`));
    if (family === undefined) return yield* Effect.die(`${list} is not in a build-input family`);
    const directory = join(store, family, manifest[family]);
    const listPath = join(directory, list.slice(family.length + 1));
    const remedy = `${generator} wrote models the stored family lacks: ${regenerate(family, manifest[family])}`;
    if (!existsSync(listPath)) {
      problems.push(`${listPath} is missing; ${remedy}`);
      continue;
    }
    const imports = (yield* Effect.promise(() => Bun.file(listPath).text())).split(/\r?\n/).filter((line) => line.length > 0);
    const unlisted = missingModels(imports, models);
    const absent = models.map((model) => model.replace(/^war3mapImported\\/, "")).filter((file) => !existsSync(join(directory, file)));
    if (unlisted !== undefined) problems.push(`${family} ${manifest[family]}: ${unlisted}; ${remedy}`);
    else if (absent.length > 0) problems.push(`${family} ${manifest[family]}: ${absent.join(", ")} missing; ${remedy}`);
  }

  const stage = join(store, "stage-assets", manifest["stage-assets"]);
  const waterfalls = TOMB_WATERFALL_IMPORTS.map(({ file }) => file).filter((file) => !existsSync(join(stage, file)));
  if (waterfalls.length > 0) problems.push(`stage-assets ${manifest["stage-assets"]}: ${waterfalls.join(", ")} missing; add the new deck files to a copy of the stored family instead of storing build/stage-assets alone`);
  const impact = join(store, "impact-assets", manifest["impact-assets"]);
  for (const model of Object.values(WHITE_FIGHTER_MODELS)) {
    const path = join(impact, model.replace(/^war3mapImported\\/, ""));
    if (!existsSync(path)) continue;
    const planes = groundPlaneGeosets(parseModelMDX(yield* Effect.promise(() => Bun.file(path).arrayBuffer())));
    if (planes.length > 0) problems.push(`${model} keeps ground plane geosets ${planes.join(", ")}, which Warcraft draws solid white; regenerate it with tools/animations/white-flash-models.ts`);
  }
  if (problems.length > 0) {
    yield* Console.error(problems.join("\n"));
    return yield* Effect.sync(() => process.exit(1));
  }
  yield* Console.log(`stored models: ${GENERATED_MODELS.reduce((sum, { models }) => sum + models.length, 0)} generated models found in their stored families`);
});

await Effect.runPromise(program);
