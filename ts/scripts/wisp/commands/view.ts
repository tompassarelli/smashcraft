// `wisp view scene DATA_DIR...` checks each client's latest scene report;
// `wisp view frame FRAME.ppm...` measures captured or recorded frames. Both
// apply the expectations fresh and the native gates use (../playerView.ts)
// and fail with what a player would see wrong.
import { join } from "node:path";
import { Console, Effect } from "effect";
import { sceneFile } from "wisp/src/runtime/scene";
import { FILE_SLOT_NUMBERS } from "wisp/scripts/wisp/boundary";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { frameProblems, measureFrame } from "wisp/scripts/wisp/frameProbe";
import { readGameFile } from "wisp/scripts/wisp/gameFiles";
import { PlayerViewFailure, SceneReportFile, readFrame } from "wisp/scripts/wisp/playerView";
import { describeScene, sceneProblems } from "wisp/scripts/wisp/scene";
import { gameFilesLayer } from "../project";
import { SMASHCRAFT_FRAME, SMASHCRAFT_SCENE } from "../playerView";

const scenes = (directories: readonly string[]) => Effect.forEach(directories, (directory) => Effect.gen(function*() {
  const reports = yield* Effect.forEach(FILE_SLOT_NUMBERS, (slot) => {
    const path = join(directory, sceneFile(slot, "smashcraft"));
    return readGameFile(path, SceneReportFile).pipe(Effect.map((file) => (file === undefined ? [] : [{ path, ...file }])));
  });
  const newest = reports.flat().sort((a, b) => b.modified - a.modified)[0];
  if (newest === undefined) return yield* new UsageFailure({ problem: `${directory} holds no scene report` });
  yield* Console.log(`${newest.path}: ${describeScene(newest.value, SMASHCRAFT_SCENE)}`);
  const problems = sceneProblems(newest.value, SMASHCRAFT_SCENE);
  if (problems.length > 0) return yield* new PlayerViewFailure({ client: directory, source: newest.path, problems });
}), { discard: true }).pipe(Effect.provide(gameFilesLayer));

/** Every frame's measurements; fails after all are printed when any frame lacks a feature. */
const frames = (paths: readonly string[]) => Effect.gen(function*() {
  const absent = new Map<string, string[]>();
  for (const path of paths) {
    const results = measureFrame(yield* readFrame(path), SMASHCRAFT_FRAME);
    yield* Console.log(`${path}: ${results.map(({ feature, present, measured }) => `${feature.name} ${present ? "present" : "absent"} (${measured})`).join("; ")}`);
    for (const { seen } of frameProblems(results)) absent.set(seen, [...(absent.get(seen) ?? []), path]);
  }
  if (absent.size === 0) return;
  return yield* new PlayerViewFailure({
    client: `${new Set([...absent.values()].flat()).size} of ${paths.length} frames`,
    source: paths.length === 1 ? paths[0] ?? "" : `${paths.length} frames`,
    problems: [...absent].map(([seen, failed]) => ({ seen, evidence: `${failed.length} of ${paths.length} frames` })),
  });
});

export const view: Command = ([mode, ...paths]) => {
  if (paths.length === 0) return Effect.fail(new UsageFailure({ problem: "view takes scene DATA_DIR... or frame FRAME.ppm..." }));
  if (mode === "scene") return scenes(paths);
  if (mode === "frame") return frames(paths);
  return Effect.fail(new UsageFailure({ problem: `unknown view check ${mode}` }));
};
