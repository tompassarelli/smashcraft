// `wisp build` and `wisp rebuild`: the TypeScript-only map build and the
// script-only rebuild of a map that build.sh or `build` packaged.
import { Effect, Layer } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { MapBuild } from "wisp/scripts/wisp/mapBuild";
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
    Effect.flatMap((input) => Effect.gen(function*() {
      const imports = yield* importedAssets(input.assets, input.summon);
      const { packager, assets, summon, ...map } = input;
      return yield* MapBuild.use((maps) => maps.build({ ...map, ...(packager === undefined ? {} : { packager }), declaration: SMASHCRAFT_MAP, imports, objectData: [
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
