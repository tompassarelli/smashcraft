// `waygate build` and `waygate rebuild`: the TypeScript-only map build and the
// script-only rebuild of a map that build.sh or `build` packaged.
import { Effect, Layer } from "effect";
import { join } from "node:path";
import { type Command, UsageFailure } from "../command";
import { GameFiles } from "../gameFiles";
import { MapBuild, decodeBuildOptions } from "../mapBuild";
import { SourceErrors } from "../sourceErrors";

const ts = join(import.meta.dir, "../../..");
const profiles = {
  main: MapBuild.layer,
  "physics-probe": MapBuild.layerFor(join(ts, "tsconfig.physics-probe.json"), join(ts, "build/physics-probe.lua")),
} as const;

const profileOptions = (args: readonly string[]) => Effect.gen(function*() {
  const index = args.indexOf("--profile");
  const profile = index < 0 ? "main" : args[index + 1];
  if (profile !== "main" && profile !== "physics-probe") {
    return yield* new UsageFailure({ problem: "--profile takes main or physics-probe" });
  }
  const remaining = index < 0 ? [...args] : [...args.slice(0, index), ...args.slice(index + 2)];
  const services = profiles[profile].pipe(Layer.provideMerge(SourceErrors.layer), Layer.provide(GameFiles.layer));
  return { args: remaining, services };
});

export const build: Command = (args) => Effect.gen(function*() {
  const options = yield* profileOptions(args);
  return yield* decodeBuildOptions(options.args).pipe(
    Effect.flatMap((input) => MapBuild.use((maps) => maps.build(input))),
    Effect.provide(options.services),
  );
});

export const rebuild: Command = (args) => Effect.gen(function*() {
  const options = yield* profileOptions(args);
  const [map, ...rest] = options.args;
  if (map === undefined || rest.length > 0) return yield* new UsageFailure({ problem: "rebuild takes one map" });
  return yield* MapBuild.use((maps) => maps.rebuild(map)).pipe(Effect.provide(options.services));
});
