// `wisp map build` and `wisp map rebuild`: the TypeScript-only map build and the
// script-only rebuild of a map that build.sh or `build` packaged.
import { closeSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Console, Effect, Layer } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { type ArchiveEntry, type GeneratedFile, MapBuild, MapBuildFailure, runProcess } from "wisp/scripts/wisp/mapBuild";
import { checkoutInputs } from "../buildInputs";
import { step } from "wisp/scripts/wisp/timings";
import { decodeBuildOptions, importedAssets, rebuildMap } from "../mapInputs";
import { buildProject, gameFilesLayer, profileOption, projectRoot, sourceErrorsLayer } from "../project";
import { describeMapSize, mapGrowthProblem, type MapSize, readMapBaseline, readTables, storedBytes, writeMapBaseline } from "../../mapSize";
import { SMASHCRAFT_MAP } from "../../mapInfo";
import { fighterUnits, fileIoAbility } from "../../objectData";
import { POST_PROCESSING_FILE } from "../../postProcessing";

/** `--profile NAME` removed from the arguments, and that profile's map services. */
export const profileOptions = (args: readonly string[]) => Effect.gen(function*() {
  const { profile, args: remaining } = yield* profileOption(args);
  const services = MapBuild.layer(buildProject(profile)).pipe(Layer.provideMerge(sourceErrorsLayer), Layer.provideMerge(gameFilesLayer));
  return { profile, args: remaining, services };
});

/** The map's generated root files, which the build writes over the base map's. */
export const generatedFiles = (): readonly GeneratedFile[] => [
  { entry: "war3map.w3u", contents: fighterUnits() },
  { entry: "war3map.w3a", contents: fileIoAbility() },
  POST_PROCESSING_FILE,
];

const MAP_SIZE_BASELINE = join(projectRoot, "ts/map-size-baseline.tsv");

/**
 * The built map's size and each import's stored bytes, from its archive tables.
 * Imports are the declared ones and every entry in a folder, so files the
 * container still carries count too; the map's own root files don't.
 */
const measureMap = (out: string, declared: readonly ArchiveEntry[]) => Effect.scoped(Effect.gen(function*() {
  const scratch = yield* Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(join(tmpdir(), "smashcraft-size."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const listPath = join(scratch, "listfile");
  yield* runProcess("extract the archive's file list", out, [buildProject().packager, "extract", out, listPath, "(listfile)"]);
  const declaredEntries = new Set(declared.map(({ entry }) => entry.toLowerCase()));
  const listed = readFileSync(listPath, "utf8").split(/\r?\n/).filter((name) => name !== "" && (name.includes("\\") || declaredEntries.has(name.toLowerCase())));
  return yield* Effect.try({
    try: (): MapSize => {
      const fd = openSync(out, "r");
      try {
        const read = (start: number, length: number) => {
          const bytes = new Uint8Array(length);
          readSync(fd, bytes, 0, length, start);
          return bytes;
        };
        const total = statSync(out).size;
        const tables = readTables(read, total);
        return { total, imports: new Map(listed.map((entry) => [entry, storedBytes(tables, entry) ?? 0])) };
      } finally {
        closeSync(fd);
      }
    },
    catch: (cause) => new MapBuildFailure({ operation: "measure map size", path: out, cause }),
  });
}));

/** Prints the map's size; the default build fails when it outgrows the committed baseline (AGENTS.md, "Map size"). */
const checkMapSize = (out: string, imports: readonly ArchiveEntry[], bounded: boolean) => Effect.gen(function*() {
  const size = yield* measureMap(out, imports);
  yield* Console.log(describeMapSize(size));
  if (!bounded) return;
  const baseline = readMapBaseline(MAP_SIZE_BASELINE);
  if (baseline === undefined || process.env.MAP_SIZE_UPDATE === "1") {
    writeMapBaseline(MAP_SIZE_BASELINE, size);
    return yield* Console.log("wrote ts/map-size-baseline.tsv; commit it");
  }
  const problem = mapGrowthProblem(size, baseline);
  if (problem !== undefined) return yield* new MapBuildFailure({ operation: "check map size", path: out, cause: problem });
});

export const build: Command = (args) => Effect.gen(function*() {
  const options = yield* profileOptions(args);
  const bounded = options.profile === "main";
  return yield* decodeBuildOptions(options.args).pipe(
    Effect.flatMap((options) => Effect.gen(function*() {
      // Inputs given override the checkout's build-inputs.json; with all four given it isn't read.
      const { base, container, assets, summon, packager, ...map } = options;
      const declared = base !== undefined && container !== undefined && assets !== undefined && summon !== undefined
        ? { base, container, assets, summon }
        : yield* checkoutInputs().pipe(step("verify build inputs"));
      const imports = yield* importedAssets(assets ?? declared.assets, summon ?? declared.summon);
      return yield* MapBuild.use((maps) => maps.build({ ...map, base: base ?? declared.base, container: container ?? declared.container, ...(packager === undefined ? {} : { packager }), declaration: SMASHCRAFT_MAP, imports, objectData: generatedFiles() })).pipe(Effect.andThen(checkMapSize(map.out, imports, bounded)));
    })),
    Effect.provide(options.services),
  );
});

export const rebuild: Command = (args) => Effect.gen(function*() {
  const options = yield* profileOptions(args);
  const [map, ...rest] = options.args;
  if (map === undefined || rest.length > 0) return yield* new UsageFailure({ problem: "rebuild takes one map" });
  return yield* rebuildMap(map).pipe(Effect.provide(options.services));
});

/** Build and rebuild the map through one noun. */
export const map: Command = ([verb, ...args]) => verb === "build" ? build(args) : verb === "rebuild" ? rebuild(args) : Effect.fail(new UsageFailure({ problem: "map takes build or rebuild" }));
