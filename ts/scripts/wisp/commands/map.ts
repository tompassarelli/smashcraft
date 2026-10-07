// `wisp map build` and `wisp map rebuild`: the TypeScript-only map build and the
// script-only rebuild of a map that build.sh or `build` packaged.
import { Effect, Layer } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { MapBuild } from "wisp/scripts/wisp/mapBuild";
import { checkoutInputs } from "../buildInputs";
import { step } from "wisp/scripts/wisp/timings";
import { decodeBuildOptions, importedAssets, rebuildMap } from "../mapInputs";
import { buildProject, gameFilesLayer, profileOption, sourceErrorsLayer } from "../project";
import { SMASHCRAFT_MAP } from "../../mapInfo";
import { fighterUnits, fileIoAbility } from "../../objectData";

/** `--profile NAME` removed from the arguments, and that profile's map services. */
export const profileOptions = (args: readonly string[]) => Effect.gen(function*() {
  const { profile, args: remaining } = yield* profileOption(args);
  const services = MapBuild.layer(buildProject(profile)).pipe(Layer.provideMerge(sourceErrorsLayer), Layer.provideMerge(gameFilesLayer));
  return { args: remaining, services };
});

export const build: Command = (args) => Effect.gen(function*() {
  const options = yield* profileOptions(args);
  return yield* decodeBuildOptions(options.args).pipe(
    Effect.flatMap((options) => Effect.gen(function*() {
      // Inputs given override the checkout's build-inputs.json; with all four given it isn't read.
      const { base, container, assets, summon, packager, ...map } = options;
      const declared = base !== undefined && container !== undefined && assets !== undefined && summon !== undefined
        ? { base, container, assets, summon }
        : yield* checkoutInputs().pipe(step("verify build inputs"));
      const imports = yield* importedAssets(assets ?? declared.assets, summon ?? declared.summon);
      return yield* MapBuild.use((maps) => maps.build({ ...map, base: base ?? declared.base, container: container ?? declared.container, ...(packager === undefined ? {} : { packager }), declaration: SMASHCRAFT_MAP, imports, objectData: [
        { entry: "war3map.w3u", contents: fighterUnits() },
        { entry: "war3map.w3a", contents: fileIoAbility() },
      ] }));
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
