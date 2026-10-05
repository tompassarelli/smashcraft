// `waygate build` and `waygate rebuild`: the TypeScript-only map build and the
// script-only rebuild of a map that build.sh or `build` packaged.
import { Effect, Layer } from "effect";
import { type Command, UsageFailure } from "waygate/scripts/waygate/command";
import { MapBuild } from "waygate/scripts/waygate/mapBuild";
import { decodeBuildOptions, importedAssets } from "../mapInputs";
import { buildProject, gameFilesLayer, sourceErrorsLayer } from "../project";
import { SMASHCRAFT_MAP } from "../../mapInfo";
import { fighterUnits, fileIoAbility } from "../../objectData";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../../../src/game/presentation/fighterAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "../../../src/game/presentation/demonHunterAssetInfo";

const profiles = {
  main: MapBuild.layer(buildProject()),
  "physics-probe": MapBuild.layer(buildProject("physics-probe")),
  "frame-cost": MapBuild.layer(buildProject("frame-cost")),
} as const;

const profileOptions = (args: readonly string[]) => Effect.gen(function*() {
  const index = args.indexOf("--profile");
  const profile = index < 0 ? "main" : args[index + 1];
  if (profile !== "main" && profile !== "physics-probe" && profile !== "frame-cost") {
    return yield* new UsageFailure({ problem: "--profile takes main, physics-probe or frame-cost" });
  }
  const remaining = index < 0 ? [...args] : [...args.slice(0, index), ...args.slice(index + 2)];
  const services = profiles[profile].pipe(Layer.provideMerge(sourceErrorsLayer), Layer.provide(gameFilesLayer));
  return { args: remaining, services };
});

export const build: Command = (args) => Effect.gen(function*() {
  const options = yield* profileOptions(args);
  return yield* decodeBuildOptions(options.args).pipe(
    Effect.flatMap((input) => Effect.gen(function*() {
      const imports = yield* importedAssets(input.assets, input.summon);
      const { packager, assets, summon, ...map } = input;
      return yield* MapBuild.use((maps) => maps.build({ ...map, ...(packager === undefined ? {} : { packager }), declaration: SMASHCRAFT_MAP, imports, objectData: [
        { entry: "war3map.w3u", contents: fighterUnits({ archer: ARCHER_MODEL_FILE, rifleman: RIFLEMAN_MODEL_FILE, demonHunter: DEMON_HUNTER_MODEL_FILE }) },
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
  return yield* MapBuild.use((maps) => maps.rebuild(map)).pipe(Effect.provide(options.services));
});
