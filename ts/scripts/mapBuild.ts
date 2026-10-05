// The TypeScript-only map build and the script-only rebuild (#35, #36).
//
// The base map is a small MPQ whose hash table cannot take the map's imported
// assets, so the TypeScript build packages into a copy of a fully packaged
// private map instead (mitigation until map-pack can grow an archive). That
// copy's script, object data, description and header are replaced with
// TypeScript-generated ones; every other base map file and every declared
// import must equal its source. Imports the build does not declare stay
// unverified.
import { closeSync, openSync, readSync, writeSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Cause, Effect, Exit, Schema } from "effect";
import { DEMON_HUNTER_MODEL_FILE } from "../src/game/presentation/demonHunterAssetInfo";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../src/game/presentation/fighterAssetInfo";
import { mapCompiler, report } from "./compiler";
import { type ArchiveEntry, MapBuildFailure, mapPack, readJson, runProcess, stageMap, tryMapPromise, tryMapSync, verifyArchive, verifyToolchain, workDirectory } from "./mapEffects";
import { decodeMapInfo, declareMap, encodeMapInfo, mapConfig, mapHeader, SMASHCRAFT_MAP } from "./mapInfo";
import { composeScript, loadBundle, typescriptBase } from "./mapScript";
import { fighterUnits, fileIoAbility } from "./objectData";

const PROJECT = join(import.meta.dir, "../..");
const MAP_CONFIG = join(import.meta.dir, "../tsconfig.map.json");
const MAP_BUNDLE = join(import.meta.dir, "../build/map.lua");
export const DEFAULT_PACKAGER = join(PROJECT, "build/tools/map-pack");

const SELECTION_TEXTURES = [
  "ArcherName", "RiflemanName", "DemonHunterName", "DemonHunterPortrait", "DemonHunterTile", "SelectionBackdrop",
  "SelectionTileFrame", "SelectionCardRed", "SelectionCardBlue", "SelectionCardYellow", "SelectionCardGreen",
  "SelectionCardGray", "SelectionAction", "StageBackdrop", "StageChip", "SelectionSkyDeck", "SelectionThreeBridges",
  "SelectionChipP1", "SelectionChipP2", "SelectionChipP3", "SelectionChipP4", "SelectionChipCPU", "ArcherPortrait",
  "RiflemanPortrait", "ArcherTile", "RiflemanTile", "MatchHUD0", "MatchHUD1", "MatchHUD2", "MatchHUD3",
] as const;

const compileBundle = () => Effect.gen(function*() {
  const diagnostics = yield* tryMapSync("compile map", MAP_CONFIG, mapCompiler(MAP_CONFIG));
  if (diagnostics.length > 0) return yield* new MapBuildFailure({ operation: "compile map", path: MAP_CONFIG, cause: report(diagnostics) });
  return yield* tryMapSync("read map bundle", MAP_BUNDLE, () => loadBundle(MAP_BUNDLE));
});

const elapsed = (from: number, to: number) => `${(to - from).toFixed(0)} ms`;

/** Replaces only war3map.lua of a map built by build.sh or the TypeScript build. */
export const rebuildMap = (map: string, packager = DEFAULT_PACKAGER) => Effect.scoped(Effect.gen(function*() {
  const started = performance.now();
  const bundle = yield* compileBundle();
  const compiled = performance.now();
  const basePath = `${map}.base.lua`;
  const base = yield* tryMapPromise("read base script", basePath, () => Bun.file(basePath).text());
  const script = yield* tryMapSync("compose map script", basePath, () => composeScript(base, bundle));
  const scriptPath = `${map}.lua`;
  yield* tryMapPromise("write map script", scriptPath, () => Bun.write(scriptPath, script));
  const work = yield* workDirectory(dirname(map));
  yield* stageMap(map, map, (staged) => Effect.gen(function*() {
    yield* mapPack(packager).replace(staged, scriptPath);
    yield* verifyArchive(packager, staged, [{ entry: "war3map.lua", source: scriptPath }], work);
  }));
  const done = performance.now();
  yield* Effect.sync(() => console.log(`rebuilt ${map}: compile ${elapsed(started, compiled)}, package ${elapsed(compiled, done)}, total ${elapsed(started, done)}`));
}));

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
export type BuildOptions = typeof BuildOptions.Type;

/** Options from `--name value` pairs. */
export const decodeBuildOptions = (args: readonly string[]) => {
  const pairs = Object.fromEntries(args.flatMap((arg, index) => arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : []));
  return Schema.decodeUnknownEffect(BuildOptions)(pairs).pipe(
    Effect.mapError((cause) => new MapBuildFailure({ operation: "read build options", path: "argv", cause })),
  );
};

const SummonEvidence = Schema.Struct({
  records: Schema.Array(Schema.Struct({ clips: Schema.Array(Schema.Struct({ filename: Schema.String })) })),
});

const importLines = (path: string) =>
  tryMapPromise("read import list", path, () => Bun.file(path).text()).pipe(
    Effect.map((text) => text.split(/\r?\n/).filter((line) => line.length > 0)),
  );

/** Every asset the map imports, with the file it must equal (build.sh's import list). */
const importedAssets = (assets: string, summon: string) => Effect.gen(function*() {
  const imported = (directory: string, file: string): ArchiveEntry => ({ entry: `war3mapImported\\${file}`, source: join(directory, file) });
  const stage = join(assets, "stage-assets");
  const impact = join(assets, "impact-assets");
  const evidence = yield* readJson(SummonEvidence, join(summon, "summon-clips-evidence.json"));
  const impactLists = yield* Effect.forEach(["imports.txt", "frost-imports.txt", "shield-imports.txt"], (list) => importLines(join(impact, list)));
  return [
    { entry: ARCHER_MODEL_FILE, source: join(assets, "animation-assets/ArcherFighter.mdx") },
    { entry: RIFLEMAN_MODEL_FILE, source: join(assets, "animation-assets/RiflemanFighter.mdx") },
    { entry: DEMON_HUNTER_MODEL_FILE, source: join(assets, "illidan-animation/DemonHunterFighter.mdx") },
    ...SELECTION_TEXTURES.map((texture) => imported(join(assets, "selection-assets"), `${texture}.tga`)),
    ...["SmashcraftHUD.fdf", "SmashcraftHUD.toc"].map((file) => imported(join(PROJECT, "tools/selection/art"), file)),
    ...(yield* importLines(join(stage, "imports.txt"))).map((file) => imported(stage, file)),
    ...impactLists.flat().map((file) => imported(impact, file)),
    ...evidence.records.flatMap((record) => record.clips).map(({ filename }) => imported(join(summon, "imports/war3mapImported"), filename)),
  ] satisfies ArchiveEntry[];
});

/** The base map's other files (terrain, doodads, strings ...), which the container must carry unchanged. */
const baseMapFiles = (packager: string, base: string, generated: ReadonlySet<string>, work: string) => Effect.gen(function*() {
  const listPath = join(work, "base-listfile");
  yield* mapPack(packager).extract(base, listPath, "(listfile)");
  const list = yield* tryMapPromise("read base map file list", base, () => Bun.file(listPath).text());
  const entries = list.split(/\r?\n/).filter((entry) => entry.length > 0 && !generated.has(entry));
  return yield* Effect.forEach(entries, (entry, index) => {
    const source = join(work, `base-${index}`);
    return mapPack(packager).extract(base, source, entry).pipe(Effect.as({ entry, source } satisfies ArchiveEntry));
  }, { concurrency: 4 });
});

/** Overwrites the map header in front of the archive; the container must have one of the same size. */
const writeHeader = (map: string, header: Uint8Array) => tryMapSync("write map header", map, () => {
  const file = openSync(map, "r+");
  try {
    const magic = new Uint8Array(4);
    readSync(file, magic, 0, magic.length, 0);
    if (new TextDecoder().decode(magic) !== "HM3W") throw new Error("asset container has no map header in front of its archive");
    writeSync(file, header, 0, header.length, 0);
  } finally {
    closeSync(file);
  }
});

/** A map whose project code is only the TypeScript bundle, started from ts/src/platform/main.ts. */
export const buildTypescriptMap = (options: BuildOptions) => Effect.scoped(Effect.gen(function*() {
  const started = performance.now();
  const out = resolve(options.out);
  if (!relative(PROJECT, out).startsWith("..")) {
    return yield* new MapBuildFailure({ operation: "check output", path: out, cause: "maps contain private assets and must be built outside the checkout" });
  }
  const packager = options.packager ?? DEFAULT_PACKAGER;
  const pack = mapPack(packager);
  yield* verifyToolchain(join(PROJECT, "typescript-toolchain.lock"), join(PROJECT, "ts"));
  const work = yield* workDirectory(dirname(out));
  const bundle = yield* compileBundle();
  const compiled = performance.now();

  const baseScriptPath = join(work, "base.war3map.lua");
  const baseInfoPath = join(work, "base.war3map.w3i");
  yield* pack.extract(options.base, baseScriptPath);
  yield* pack.extract(options.base, baseInfoPath, "war3map.w3i");
  const [baseScript, baseInfo] = yield* tryMapPromise("read base map", options.base, () =>
    Promise.all([Bun.file(baseScriptPath).text(), Bun.file(baseInfoPath).bytes()]));
  const generated = yield* tryMapSync("generate map files", options.base, () => {
    const info = declareMap(decodeMapInfo(baseInfo), options.name, SMASHCRAFT_MAP);
    const base = typescriptBase(baseScript, mapConfig(info));
    return {
      base,
      header: mapHeader(info),
      files: [
        { entry: "war3map.lua", contents: new TextEncoder().encode(composeScript(base, bundle)) },
        { entry: "war3map.w3i", contents: encodeMapInfo(info) },
        { entry: "war3map.w3u", contents: fighterUnits({ archer: ARCHER_MODEL_FILE, rifleman: RIFLEMAN_MODEL_FILE, demonHunter: DEMON_HUNTER_MODEL_FILE }) },
        { entry: "war3map.w3a", contents: fileIoAbility() },
      ],
    };
  });
  const files = generated.files.map((file) => ({ ...file, source: join(work, file.entry) }));
  yield* Effect.forEach(files, ({ source, contents }) =>
    tryMapPromise("write generated file", source, () => Bun.write(source, contents)), { discard: true });
  const scriptPath = join(work, "war3map.lua");
  yield* runProcess("check map script syntax", scriptPath, ["nix", "shell", "nixpkgs#lua5_3", "--command", "luac", "-p", scriptPath]);
  const assets = [
    ...yield* baseMapFiles(packager, options.base, new Set(files.map(({ entry }) => entry)), work),
    ...yield* importedAssets(options.assets, options.summon),
  ];
  const generatedAt = performance.now();

  let packaged = 0;
  yield* stageMap(options.container, out, (staged) => Effect.gen(function*() {
    for (const file of files) yield* pack.replace(staged, file.source, file.entry);
    yield* writeHeader(staged, generated.header);
    packaged = performance.now();
    const header = yield* tryMapPromise("read map header", staged, () => Bun.file(staged).slice(0, generated.header.length).bytes());
    if (Buffer.compare(header, generated.header) !== 0) {
      return yield* new MapBuildFailure({ operation: "verify map header", path: staged, cause: "header differs from the generated one" });
    }
    yield* verifyArchive(packager, staged, [...files, ...assets], work);
  }));
  yield* tryMapPromise("keep base script for rebuilds", `${out}.base.lua`, () => Bun.write(`${out}.base.lua`, generated.base));
  const done = performance.now();
  yield* Effect.sync(() => console.log(
    `built ${out}: compile ${elapsed(started, compiled)}, generate ${elapsed(compiled, generatedAt)}, package ${elapsed(generatedAt, packaged)}, verify ${files.length + assets.length} entries ${elapsed(packaged, done)}, total ${elapsed(started, done)}`,
  ));
}));

/** Runs a map command, printing a failure's cause instead of a stack. */
export async function runMapCommand(program: Effect.Effect<void, MapBuildFailure>): Promise<void> {
  const exit = await Effect.runPromiseExit(program);
  if (Exit.isFailure(exit)) {
    console.error(Cause.pretty(exit.cause));
    process.exit(1);
  }
}
