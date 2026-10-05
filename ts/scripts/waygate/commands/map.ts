// `waygate build` and `waygate rebuild`: the TypeScript-only map build and the
// script-only rebuild of a map that build.sh or `build` packaged.
import { Effect, Layer } from "effect";
import { type Command, UsageFailure } from "../command";
import { GameFiles } from "../gameFiles";
import { MapBuild, decodeBuildOptions } from "../mapBuild";
import { SourceErrors } from "../sourceErrors";

const services = MapBuild.layer.pipe(Layer.provideMerge(SourceErrors.layer), Layer.provide(GameFiles.layer));

export const build: Command = (args) =>
  decodeBuildOptions(args).pipe(Effect.flatMap((options) => MapBuild.use((maps) => maps.build(options))), Effect.provide(services));

export const rebuild: Command = ([map, ...rest]) =>
  map === undefined || rest.length > 0
    ? Effect.fail(new UsageFailure({ problem: "rebuild takes one map" }))
    : MapBuild.use((maps) => maps.rebuild(map)).pipe(Effect.provide(services));
