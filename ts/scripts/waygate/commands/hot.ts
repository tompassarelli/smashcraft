import { join } from "node:path";
import { Effect } from "effect";
import type { Command } from "waygate/scripts/waygate/command";
import { makeHot } from "waygate/scripts/waygate/commands/hot";
import { buildProject, profileOption, sourceMapDirectory, ts } from "../project";

/** `--profile NAME` hot-reloads that profile's bundle instead of normal gameplay's. */
export const hot: Command = (args) => Effect.gen(function*() {
  const { profile, args: remaining } = yield* profileOption(args);
  return yield* makeHot({ project: buildProject(profile), sourceDirectory: join(ts, "src"), sourceMapDirectory, filePrefix: "smashcraft" })(remaining);
});
