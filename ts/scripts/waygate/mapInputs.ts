// Smashcraft's declared map imports and object data.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect, Schema } from "effect";
import { MapBuild, MapBuildFailure, runProcess, type ArchiveEntry } from "waygate/scripts/waygate/mapBuild";
import { UsageFailure } from "waygate/scripts/waygate/command";
import { step } from "waygate/scripts/waygate/timings";
import * as frostModels from "../../src/game/assets/frostAssetInfo";
import * as impactModels from "../../src/game/assets/impactAssetInfo";
import { STAGE_DECK_MODEL } from "../../src/game/assets/stageAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "../../src/game/presentation/demonHunterAssetInfo";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../../src/game/presentation/fighterAssetInfo";
import { SUMMON_BEAR, summonClip, summonClipCount } from "../../src/game/presentation/summonClipInfo";
import { buildProject, projectRoot as PROJECT } from "./project";
const tryMapPromise = <A>(operation: string, path: string, run: () => PromiseLike<A>) => Effect.tryPromise({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });
const tryMapSync = <A>(operation: string, path: string, run: () => A) => Effect.try({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });
const EMPTY_MODEL = "the map script names an empty model path";
const BuildOptions = Schema.Struct({
  base: Schema.NonEmptyString,
  container: Schema.NonEmptyString,
  /** Holds animation-assets, illidan-animation, selection-assets, stage-assets and impact-assets. */
  assets: Schema.NonEmptyString,
  summon: Schema.NonEmptyString,
  name: Schema.String.check(Schema.isPattern(/^[\x20-\x7e]{1,200}$/)),
  out: Schema.String.check(Schema.isPattern(/\.w3x$/)),
  packager: Schema.optional(Schema.NonEmptyString),
});
type BuildOptions = typeof BuildOptions.Type;


/** Options from `--name value` pairs. */
export const decodeBuildOptions = (args: readonly string[]) => {
  const pairs = Object.fromEntries(args.flatMap((arg, index) => arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : []));
  return Schema.decodeUnknownEffect(BuildOptions)(pairs).pipe(
    Effect.mapError((cause) => new UsageFailure({ problem: cause.message })),
  );
};


const SELECTION_TEXTURES = [
  "ArcherName", "RiflemanName", "DemonHunterName", "DemonHunterPortrait", "DemonHunterTile", "SelectionBackdrop",
  "SelectionTileFrame", "SelectionCardRed", "SelectionCardBlue", "SelectionCardYellow", "SelectionCardGreen",
  "SelectionCardGray", "SelectionAction", "StageBackdrop", "StageChip", "SelectionSkyDeck", "SelectionThreeBridges",
  "SelectionChipP1", "SelectionChipP2", "SelectionChipP3", "SelectionChipP4", "SelectionChipCPU", "ArcherPortrait",
  "RiflemanPortrait", "ArcherTile", "RiflemanTile", "MatchHUD0", "MatchHUD1", "MatchHUD2", "MatchHUD3",
] as const;


const SummonEvidence = Schema.Struct({
  records: Schema.Array(Schema.Struct({ clips: Schema.Array(Schema.Struct({ filename: Schema.String })) })),
});

const importLines = (path: string) =>
  tryMapPromise("read import list", path, () => Bun.file(path).text()).pipe(
    Effect.map((text) => text.split(/\r?\n/).filter((line) => line.length > 0)),
  );

/**
 * The generated models the compiled script draws: each family's import list
 * under --assets must hold them, and its generator writes both.
 */
export const GENERATED_MODELS: readonly { readonly list: string; readonly generator: string; readonly models: readonly string[] }[] = [
  { list: "stage-assets/imports.txt", generator: "tools/stage/package.ts", models: [STAGE_DECK_MODEL] },
  { list: "impact-assets/imports.txt", generator: "tools/effects/package.ts", models: Object.values(impactModels) },
  { list: "impact-assets/frost-imports.txt", generator: "tools/effects/trap.ts", models: Object.values(frostModels) },
];

/** The summon clip models the compiled script draws; the summon evidence lists their files. */
export const SUMMON_MODELS = Array.from({ length: summonClipCount(SUMMON_BEAR) }, (_, index) => summonClip(SUMMON_BEAR, index).modelPath);

/** Every imported model the compiled script names. */
export const SCRIPT_MODELS: readonly string[] = [
  ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE, DEMON_HUNTER_MODEL_FILE, ...SUMMON_MODELS,
  ...GENERATED_MODELS.flatMap(({ models }) => models),
];

/** Why `imports` cannot supply every model the compiled script names, if they cannot. */
export function missingModels(imports: readonly string[], models: readonly string[]): string | undefined {
  if (models.includes("")) return EMPTY_MODEL;
  const listed = new Set(imports.map((file) => `war3mapImported\\${file}`));
  const missing = models.filter((model) => !listed.has(model));
  return missing.length === 0 ? undefined : `${missing.join(", ")} not among the imports`;
}

const requireListed = (path: string, imports: readonly string[], models: readonly string[], remedy: string) => {
  const missing = missingModels(imports, models);
  return missing === undefined ? Effect.void : Effect.fail(new MapBuildFailure({ operation: "check script models", path, cause: `${missing}; ${remedy}` }));
};

/** A rebuild keeps every import, so the map must already carry each model the new script names. */
export const carriedModels = (map: string, packager: string, models: readonly string[] = SCRIPT_MODELS) => Effect.scoped(Effect.gen(function*() {
  if (models.includes("")) return yield* new MapBuildFailure({ operation: "check script models", path: map, cause: EMPTY_MODEL });
  const scratch = yield* Effect.acquireRelease(
    tryMapSync("create scratch directory", tmpdir(), () => mkdtempSync(join(tmpdir(), "smashcraft-models."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const failures = yield* Effect.forEach(models, (model, index) =>
    Effect.match(runProcess("extract model", map, [packager, "extract", map, join(scratch, `${index}`), model]), {
      onFailure: (failure) => [{ model, reason: failure.message }],
      onSuccess: () => [],
    }), { concurrency: 4 });
  const missing = failures.flat();
  const first = missing[0];
  if (first === undefined) return;
  return yield* new MapBuildFailure({ operation: "check script models", path: map,
    cause: `the map does not carry ${missing.map(({ model }) => model).join(", ")}; build it again (${first.reason})` });
}));

/** Replaces only the map's script, after checking the map carries every model that script names. */
export const rebuildMap = (map: string) =>
  carriedModels(map, buildProject().packager).pipe(step("script models carried"), Effect.andThen(MapBuild.use((maps) => maps.rebuild(map))));

const imported = (directory: string, file: string): ArchiveEntry => ({ entry: `war3mapImported\\${file}`, source: join(directory, file) });

/** Every asset the map imports, with the file it must equal (build.sh's import list). */
export const importedAssets = (assets: string, summon: string) => Effect.gen(function*() {
  const generated = yield* Effect.forEach(GENERATED_MODELS, ({ list, generator, models }) => Effect.gen(function*() {
    const path = join(assets, list);
    const files = yield* importLines(path);
    yield* requireListed(path, files, models, `package them with ${generator}`);
    return files.map((file) => imported(dirname(path), file));
  }));
  const evidencePath = join(summon, "summon-clips-evidence.json");
  const evidence = yield* readJson(SummonEvidence, evidencePath);
  const summonFiles = evidence.records.flatMap((record) => record.clips).map(({ filename }) => filename);
  yield* requireListed(evidencePath, summonFiles, SUMMON_MODELS, "summonClipInfo.ts and the summon clips differ");
  const impact = join(assets, "impact-assets");
  const impactLists = yield* Effect.forEach(["shield-imports.txt"], (list) => importLines(join(impact, list)));
  return [
    { entry: ARCHER_MODEL_FILE, source: join(assets, "animation-assets/ArcherFighter.mdx") },
    { entry: RIFLEMAN_MODEL_FILE, source: join(assets, "animation-assets/RiflemanFighter.mdx") },
    { entry: DEMON_HUNTER_MODEL_FILE, source: join(assets, "illidan-animation/DemonHunterFighter.mdx") },
    ...SELECTION_TEXTURES.map((texture) => imported(join(assets, "selection-assets"), `${texture}.tga`)),
    ...["SmashcraftHUD.fdf", "SmashcraftHUD.toc"].map((file) => imported(join(PROJECT, "tools/selection/art"), file)),
    ...generated.flat(),
    ...impactLists.flat().map((file) => imported(impact, file)),
    ...summonFiles.map((filename) => imported(join(summon, "imports/war3mapImported"), filename)),
  ] satisfies ArchiveEntry[];
});


const readJson = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string) =>
  tryMapPromise("read JSON", path, () => Bun.file(path).json()).pipe(Effect.flatMap((json) => decode(schema, path, json)));

const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string, value: unknown) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError((cause) => new MapBuildFailure({ operation: "decode JSON", path, cause })));
