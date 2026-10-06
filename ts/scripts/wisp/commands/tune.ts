// `wisp tune --data A --data B [--port N] [--profile NAME]`: a panel on this
// computer that changes the declared values (../tunables.ts) in the running
// match through hot reloads (wisp:docs/tune.md).
import { join } from "node:path";
import { Effect } from "effect";
import type { Command } from "wisp/scripts/wisp/command";
import { makeTune } from "wisp/scripts/wisp/commands/tune";
import { buildProject, profileOption, sourceMapDirectory, tsDirectory } from "../project";
import { SMASHCRAFT_TUNABLES } from "../tunables";

export const tune: Command = (args) => Effect.gen(function*() {
  const { profile, args: remaining } = yield* profileOption(args);
  return yield* makeTune({
    project: buildProject(profile),
    sourceDirectory: join(tsDirectory, "src"),
    sourceMapDirectory,
    filePrefix: "smashcraft",
    root: tsDirectory,
    tunables: SMASHCRAFT_TUNABLES,
  })(remaining);
});
