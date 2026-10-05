// Smashcraft's declared map imports and object data.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { MapBuild, MapBuildFailure, runProcess, type ArchiveEntry } from "waygate/scripts/waygate/mapBuild";
import { UsageFailure } from "waygate/scripts/waygate/command";
import { STAGE_DECK_MODEL } from "../../src/game/assets/stageAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "../../src/game/presentation/demonHunterAssetInfo";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../../src/game/presentation/fighterAssetInfo";
import { buildProject, projectRoot as PROJECT } from "./project";
const tryMapPromise = <A>(operation: string, path: string, run: () => PromiseLike<A>) => Effect.tryPromise({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });
const tryMapSync = <A>(operation: string, path: string, run: () => A) => Effect.try({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });
const NO_STAGE_DECK = "the map script names no stage deck model";
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

/** Why the stage imports cannot supply the deck model the compiled script draws, if they cannot. */
export function missingStageDeck(stageImports: readonly string[], deckModel: string): string | undefined {
  if (deckModel === "") return NO_STAGE_DECK;
  if (stageImports.some((file) => `war3mapImported\\${file}` === deckModel)) return undefined;
  return `${deckModel} is not among the stage imports; package them with tools/stage/package.ts`;
}

/** A rebuild keeps every import, so the map must already carry the deck model the new script draws. */
export const carriedStageDeck = (map: string, packager: string, deckModel: string = STAGE_DECK_MODEL) => Effect.scoped(Effect.gen(function*() {
  if (deckModel === "") return yield* new MapBuildFailure({ operation: "check stage deck model", path: map, cause: NO_STAGE_DECK });
  const scratch = yield* Effect.acquireRelease(
    tryMapSync("create scratch directory", tmpdir(), () => mkdtempSync(join(tmpdir(), "smashcraft-stage-deck."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  yield* runProcess("extract stage deck model", map, [packager, "extract", map, join(scratch, "deck.mdx"), deckModel]).pipe(
    Effect.mapError((failure) => new MapBuildFailure({ operation: "check stage deck model", path: map, cause: `the map does not carry ${deckModel}; build it again (${failure.message})` })),
  );
}));

/** Replaces only the map's script, after checking the map carries the stage deck model that script draws. */
export const rebuildMap = (map: string) =>
  carriedStageDeck(map, buildProject().packager).pipe(Effect.andThen(MapBuild.use((maps) => maps.rebuild(map))));

const imported = (directory: string, file: string): ArchiveEntry => ({ entry: `war3mapImported\\${file}`, source: join(directory, file) });

/** Every asset the map imports, with the file it must equal (build.sh's import list). */
export const importedAssets = (assets: string, summon: string) => Effect.gen(function*() {
  const stage = join(assets, "stage-assets");
  const impact = join(assets, "impact-assets");
  const stageList = join(stage, "imports.txt");
  const stageImports = yield* importLines(stageList);
  const missingDeck = missingStageDeck(stageImports, STAGE_DECK_MODEL);
  if (missingDeck !== undefined) return yield* new MapBuildFailure({ operation: "check stage deck model", path: stageList, cause: missingDeck });
  const evidence = yield* readJson(SummonEvidence, join(summon, "summon-clips-evidence.json"));
  const impactLists = yield* Effect.forEach(["imports.txt", "frost-imports.txt", "shield-imports.txt"], (list) => importLines(join(impact, list)));
  return [
    { entry: ARCHER_MODEL_FILE, source: join(assets, "animation-assets/ArcherFighter.mdx") },
    { entry: RIFLEMAN_MODEL_FILE, source: join(assets, "animation-assets/RiflemanFighter.mdx") },
    { entry: DEMON_HUNTER_MODEL_FILE, source: join(assets, "illidan-animation/DemonHunterFighter.mdx") },
    ...SELECTION_TEXTURES.map((texture) => imported(join(assets, "selection-assets"), `${texture}.tga`)),
    ...["SmashcraftHUD.fdf", "SmashcraftHUD.toc"].map((file) => imported(join(PROJECT, "tools/selection/art"), file)),
    ...stageImports.map((file) => imported(stage, file)),
    ...impactLists.flat().map((file) => imported(impact, file)),
    ...evidence.records.flatMap((record) => record.clips).map(({ filename }) => imported(join(summon, "imports/war3mapImported"), filename)),
  ] satisfies ArchiveEntry[];
});


const readJson = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string) =>
  tryMapPromise("read JSON", path, () => Bun.file(path).json()).pipe(Effect.flatMap((json) => decode(schema, path, json)));

const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string, value: unknown) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError((cause) => new MapBuildFailure({ operation: "decode JSON", path, cause })));
