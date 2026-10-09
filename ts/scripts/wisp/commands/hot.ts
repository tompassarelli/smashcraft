import { join } from "node:path";
import { Effect } from "effect";
import type { Command } from "wisp/scripts/wisp/command";
import { makeHot } from "wisp/scripts/wisp/commands/hot";
import { buildProject, profileOption, sourceMapDirectory, tsDirectory } from "../project";


export const hot: Command = (args) => Effect.gen(function*() {
  const { profile, args: remaining } = yield* profileOption(args);
  return yield* makeHot({ project: buildProject(profile), sourceDirectory: join(tsDirectory, "src"), sourceMapDirectory, filePrefix: "smashcraft" })(remaining);
});
