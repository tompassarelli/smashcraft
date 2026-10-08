// Smashcraft's declared map imports and object data.
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect, Schema } from "effect";
import { WHITE_FIGHTER_MODELS } from "../../src/game/assets/whiteFighterModels";
import { STAGE_SKY_MODELS } from "../../src/game/assets/stageSkyInfo";
import { MapBuild, MapBuildFailure, runProcess, type ArchiveEntry } from "wisp/scripts/wisp/mapBuild";
import { UsageFailure } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { type FighterOriginalClip, originalClip, originalClipCount, originalLightPath } from "../../src/game/assets/fighterOriginalClipInfo";
import * as frostModels from "../../src/game/assets/frostAssetInfo";
import * as impactModels from "../../src/game/assets/impactAssetInfo";
import { IMPORTED_MODEL_FILES } from "../../src/game/assets/importedModelInfo";
import { type ModelSoundCue, fighterSoundCue, fighterSoundCueCount, modelSoundLabel } from "../../src/game/assets/modelSoundInfo";
import * as shieldModels from "../../src/game/assets/shieldAssetInfo";
import { STAGE_WATER_MODEL, STAGE_LAVA_MODEL } from "../../src/game/assets/terrainAssetInfo";
import { STAGE_DECK_MODELS, STAGE_LIGHT_MODELS, STAGE_POINT_LIGHT_MODELS, STAGE_SNOW_MODEL } from "../../src/game/assets/stageAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "../../src/game/presentation/demonHunterAssetInfo";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../../src/game/presentation/fighterAssetInfo";
import { SUMMON_BEAR, summonClip, summonClipCount } from "../../src/game/presentation/summonClipInfo";
import { Character } from "../../src/game/sim/codes";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { HERO_ROSTER, PORTRAIT_KINDS, RENDERED_FIGHTERS, fighterPortrait } from "../../src/game/sim/heroes/registry";
import { PARTICIPANT_SLOTS } from "../../src/game/input/participants";
import { PORTRAIT_QUALITY, encodeBlp, readTga } from "../blp";
import { importedModelFile } from "../heroModelSource";
import { buildProject, projectRoot as PROJECT } from "./project";
import { UI_FRAMES } from "./uiFrames";
const tryMapPromise = <A>(operation: string, path: string, run: () => PromiseLike<A>) => Effect.tryPromise({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });
const tryMapSync = <A>(operation: string, path: string, run: () => A) => Effect.try({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });
const EMPTY_MODEL = "the map script names an empty model path";
/** #298 / TS-c: mode-specific stock no-mist replacements; Classic keeps the installed waterfall. */
export const TOMB_WATERFALL_IMPORTS = [
  { entry: "_hd.w3mod\\Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx", file: "TombWaterfallHD.mdx" },
  { entry: "_de.w3mod\\Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx", file: "TombWaterfallDE.mdx" },
] as const;
const BuildOptions = Schema.Struct({
  // Each input left out resolves from the checkout's build-inputs.json (buildInputs.ts).
  base: Schema.optional(Schema.NonEmptyString),
  container: Schema.optional(Schema.NonEmptyString),
  /** Holds animation-assets, illidan-animation, selection-assets, fighter-renders, stage-assets, stage-thumbnails, impact-assets, imported-models and original-clips-static-lights. */
  assets: Schema.optional(Schema.NonEmptyString),
  summon: Schema.optional(Schema.NonEmptyString),
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
  "SelectionBackdrop",
  "SelectionTileFrame", "SelectionCardRed", "SelectionCardBlue", "SelectionCardTeal", "SelectionCardPurple",
  "SelectionCardGray", "SelectionAction", "StageBackdrop", "StageChip", "SelectionThreeBridges",
  "SelectionChipP1", "SelectionChipP2", "SelectionChipP3", "SelectionChipP4", "SelectionChipCPU",
  "HudPlate0", "HudPlate1", "HudPlate2", "HudPlate3",
] as const;


const SummonEvidence = Schema.Struct({
  records: Schema.Array(Schema.Struct({ clips: Schema.Array(Schema.Struct({ filename: Schema.String })) })),
});

const OriginalClipEvidence = Schema.Struct({
  records: Schema.Array(Schema.Struct({
    light: Schema.NullOr(Schema.Struct({ filename: Schema.String })),
    clips: Schema.Array(Schema.Struct({ filename: Schema.String })),
  })),
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
  { list: "impact-assets/white-flash-imports.txt", generator: "tools/animations/white-flash-models.ts", models: WHITE_FIGHTER_MODELS },
  { list: "stage-assets/imports.txt", generator: "tools/stage/package.ts", models: [...Object.values(STAGE_DECK_MODELS).flatMap(({ main, slab }) => [main, slab]), STAGE_SNOW_MODEL, STAGE_WATER_MODEL, STAGE_LAVA_MODEL, ...Object.values(STAGE_LIGHT_MODELS), ...Object.values(STAGE_POINT_LIGHT_MODELS).flat(), ...Object.values(STAGE_SKY_MODELS)] },
  { list: "impact-assets/imports.txt", generator: "tools/effects/package.ts", models: Object.values(impactModels) },
  { list: "impact-assets/frost-imports.txt", generator: "tools/effects/trap.ts", models: Object.values(frostModels) },
  { list: "impact-assets/shield-imports.txt", generator: "tools/effects/shield.ts", models: Object.values(shieldModels) },
];

/** The summon clip models the compiled script draws; the summon evidence lists their files. */
const SUMMON_MODELS = Array.from({ length: summonClipCount(SUMMON_BEAR) }, (_, index) => summonClip(SUMMON_BEAR, index).modelPath);

/**
 * The pooled fighters' clip and light models the compiled script draws; the
 * original clip export's evidence lists their files.
 */
export const ORIGINAL_CLIP_MODELS = Object.values(Character).flatMap((character) => {
  const light = originalLightPath(character);
  const clips = Array.from({ length: originalClipCount(character) }, (_, index) => originalClip(character, index)?.modelPath ?? "");
  return light === undefined ? clips : [...clips, light];
});

/** The heroes whose bodies are community models the map imports (importedModelInfo.ts). */
const IMPORTED_HERO_MODELS = HERO_ROSTER.map(({ presentation }) => presentation.model).filter((model) => importedModelFile(model) !== undefined);

/** Every imported model the compiled script names. */
export const SCRIPT_MODELS: readonly string[] = [
  ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE, DEMON_HUNTER_MODEL_FILE, ...IMPORTED_HERO_MODELS, ...SUMMON_MODELS, ...ORIGINAL_CLIP_MODELS,
  ...GENERATED_MODELS.flatMap(({ models }) => models),
];

/** The model sound table and the clips its cues are keyed to. */
interface SoundTable {
  readonly cueCount: (character: number) => number;
  readonly cue: (character: number, ordinal: number) => ModelSoundCue | undefined;
  readonly label: (soundIndex: number) => string | undefined;
  readonly clip: (character: number, sequenceIndex: number) => FighterOriginalClip | undefined;
}

export const MODEL_SOUND_TABLE: SoundTable = { cueCount: fighterSoundCueCount, cue: fighterSoundCue, label: modelSoundLabel, clip: originalClip };

/**
 * Why the model sound table names a cue no sound can play, if it does. Cues
 * name the game's stock sound labels, which the map does not import.
 */
export function soundTableProblem(table: SoundTable): string | undefined {
  for (const character of Object.values(Character)) {
    for (let ordinal = 0; ordinal < table.cueCount(character); ordinal++) {
      const cue = table.cue(character, ordinal);
      if (cue === undefined) return `character ${character} sound cue ${ordinal} is missing`;
      const label = table.label(cue.soundIndex);
      if (label === undefined || label === "") return `character ${character} sound cue ${ordinal} names no sound label`;
      if (table.clip(character, cue.sequenceIndex) === undefined) {
        return `character ${character} sound cue ${ordinal} keys sequence ${cue.sequenceIndex}, which has no clip`;
      }
    }
  }
  return undefined;
}

/** Why `imports` cannot supply every model the compiled script names, if they cannot. */
export function missingModels(imports: readonly string[], models: readonly string[]): string | undefined {
  if (models.includes("")) return EMPTY_MODEL;
  const listed = new Set(imports.map((file) => `war3mapImported\\${file}`));
  const missing = models.filter((model) => !listed.has(model));
  return missing.length === 0 ? undefined : `${some(missing)} not among the imports`;
}

/** The first few of `models`, and how many more. */
const some = (models: readonly string[]) => `${models.slice(0, 3).join(", ")}${models.length > 3 ? ` and ${models.length - 3} more` : ""}`;

const requireListed = (path: string, imports: readonly string[], models: readonly string[], remedy: string) => {
  const missing = missingModels(imports, models);
  return missing === undefined ? Effect.void : Effect.fail(new MapBuildFailure({ operation: "check script models", path, cause: `${missing}; ${remedy}` }));
};

/**
 * A rebuild keeps every import, so the map must already carry each model the
 * new script names. The build verified their contents; this reads the
 * archive's file list once, whose names Warcraft matches without case.
 */
const carriedModels = (map: string, packager: string, models: readonly string[] = SCRIPT_MODELS) => Effect.scoped(Effect.gen(function*() {
  if (models.includes("")) return yield* new MapBuildFailure({ operation: "check script models", path: map, cause: EMPTY_MODEL });
  const scratch = yield* Effect.acquireRelease(
    tryMapSync("create scratch directory", tmpdir(), () => mkdtempSync(join(tmpdir(), "smashcraft-models."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const listPath = join(scratch, "listfile");
  yield* runProcess("extract the archive's file list", map, [packager, "extract", map, listPath, "(listfile)"]);
  const text = yield* tryMapPromise("read the archive's file list", listPath, () => Bun.file(listPath).text());
  const carried = new Set(text.split(/\r?\n/).map((name) => name.toLowerCase()));
  const missing = models.filter((model) => !carried.has(model.toLowerCase()));
  if (missing.length > 0) {
    return yield* new MapBuildFailure({ operation: "check script models", path: map, cause: `the map does not carry ${some(missing)}; build it again` });
  }
}));

/** The generated menu frames' FDF and TOC files, which the script's create functions load by name. */
const UI_FRAME_FILES = UI_FRAMES.flatMap(({ definition }) => [`${definition.name}.fdf`, `${definition.name}.toc`]);

/**
 * Replaces the map's script, after checking the map carries every model that
 * script names, and the generated menu frames the script creates by name.
 */
export const rebuildMap = (map: string) => {
  const packager = buildProject().packager;
  return carriedModels(map, packager).pipe(
    step("script models carried"),
    Effect.andThen(MapBuild.use((maps) => maps.rebuild(map))),
    Effect.andThen(Effect.forEach(UI_FRAME_FILES, (file) => {
      const { entry, source } = imported(join(PROJECT, "tools/selection/art"), file);
      return runProcess(`replace ${entry}`, map, [packager, "replace", map, source, entry]);
    }, { discard: true })),
    step("menu frames replaced"),
  );
};

const imported = (directory: string, file: string): ArchiveEntry => ({ entry: `war3mapImported\\${file}`, source: join(directory, file) });

/** Where encoded portraits are kept, by source hash and quality, so a rebuild encodes only changed renders. */
const PORTRAIT_CACHE = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "smashcraft/blp-portraits");

/**
 * The fighter portraits as BLP (#307), encoded from the TGAs
 * tools/selection/render-fighters.ts renders.
 */
const portraitImports = (assets: string) => Effect.forEach(
  RENDERED_FIGHTERS.flatMap((character) => PORTRAIT_KINDS.flatMap((kind) => [undefined, ...PARTICIPANT_SLOTS].map((slot) => fighterPortrait(character, kind, slot)))),
  (entry) => Effect.gen(function*() {
    const source = join(assets, "fighter-renders", entry.replace("war3mapImported\\", "").replace(/\.blp$/, ".tga"));
    const bytes = yield* tryMapPromise("read portrait", source, () => Bun.file(source).bytes());
    const encoded = join(PORTRAIT_CACHE, `${new Bun.CryptoHasher("sha256").update(bytes).digest("hex")}-q${PORTRAIT_QUALITY}.blp`);
    if (!(yield* tryMapPromise("check portrait cache", encoded, () => Bun.file(encoded).exists()))) {
      const blp = yield* tryMapSync("encode portrait", source, () => encodeBlp(readTga(bytes), PORTRAIT_QUALITY));
      yield* tryMapPromise("write portrait", encoded, () => Bun.write(encoded, blp));
    }
    return { entry, source: encoded } satisfies ArchiveEntry;
  }),
);

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
  const clipDirectory = join(assets, "original-clips-static-lights");
  const clipEvidencePath = join(clipDirectory, "original-clips-evidence.json");
  const clipEvidence = yield* readJson(OriginalClipEvidence, clipEvidencePath);
  const clipFiles = clipEvidence.records.flatMap((record) => [...record.clips.map(({ filename }) => filename), ...(record.light === null ? [] : [record.light.filename])]);
  // A changed fighter clip (a re-authored original, a new hero) needs a new pool in the private inputs too.
  yield* requireListed(clipEvidencePath, clipFiles, ORIGINAL_CLIP_MODELS,
    `this assets folder's clip pool predates the checkout's clips. From the repository root, export a new pool from ${assets} ` +
    "with animation-assets and illidan-animation holding the packaged models fighterAssetInfo.ts and demonHunterAssetInfo.ts name: " +
    `cp -rL ${clipDirectory} NEW && chmod -R u+w NEW && bun tools/animations/export-original-clips.ts --assets ${assets} --out NEW --keep-unchanged; ` +
    "then `bun wisp inputs add original-clips-static-lights NEW` and commit build-inputs.json (smashcraft:docs/build-inputs.md)");
  const soundProblem = soundTableProblem(MODEL_SOUND_TABLE);
  if (soundProblem !== undefined) {
    return yield* new MapBuildFailure({ operation: "check model sounds", path: "ts/src/game/assets/modelSoundInfo.ts", cause: `${soundProblem}; export them with tools/animations/export-model-sounds.ts` });
  }
  return [
    { entry: ARCHER_MODEL_FILE, source: join(assets, "animation-assets/ArcherFighter.mdx") },
    { entry: RIFLEMAN_MODEL_FILE, source: join(assets, "animation-assets/RiflemanFighter.mdx") },
    { entry: DEMON_HUNTER_MODEL_FILE, source: join(assets, "illidan-animation/DemonHunterFighter.mdx") },
    ...SELECTION_TEXTURES.map((texture) => imported(join(assets, "selection-assets"), `${texture}.tga`)),
    ...(yield* portraitImports(assets)),
    // Generated by scripts/stageThumbnails.ts (docs/design/stage-select.md).
    ...STAGE_CATALOG.filter(({ texture }) => texture.startsWith("war3mapImported\\")).map(({ texture }) => ({ entry: texture, source: join(assets, "stage-thumbnails", texture.replace("war3mapImported\\", "")) })),
    ...["SmashcraftHUD.fdf", "SmashcraftHUD.toc", ...UI_FRAME_FILES].map((file) => imported(join(PROJECT, "tools/selection/art"), file)),
    // Community models, textures and icons at the archive paths their authors' readmes name.
    ...IMPORTED_MODEL_FILES.map(({ entry, file }) => ({ entry, source: join(assets, "imported-models", file) })),
    ...generated.flat(),
    ...TOMB_WATERFALL_IMPORTS.map(({ entry, file }) => ({ entry, source: join(assets, "stage-assets", file) })),
    ...summonFiles.map((filename) => imported(join(summon, "imports/war3mapImported"), filename)),
    ...clipFiles.map((filename) => imported(join(clipDirectory, "imports/war3mapImported"), filename)),
  ] satisfies ArchiveEntry[];
});


const readJson = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string) =>
  tryMapPromise("read JSON", path, () => Bun.file(path).json()).pipe(Effect.flatMap((json) => decode(schema, path, json)));

const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string, value: unknown) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError((cause) => new MapBuildFailure({ operation: "decode JSON", path, cause })));
