// `wisp view scene DATA_DIR...` checks each client's latest scene report;
// `wisp view frame FRAME.ppm...` measures captured or recorded frames. Both
// apply the expectations fresh and the native gates use (../playerView.ts)
// and fail with what a player would see wrong. `wisp view models ...`
// rewrites the model facts those expectations read.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Console, Effect } from "effect";
import { sceneFile } from "wisp/src/runtime/scene";
import { FILE_SLOT_NUMBERS } from "wisp/scripts/wisp/boundary";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { frameProblems, measureFrame } from "wisp/scripts/wisp/frameProbe";
import { readGameFile } from "wisp/scripts/wisp/gameFiles";
import { MapBuildFailure, runProcess } from "wisp/scripts/wisp/mapBuild";
import { type ModelFacts, modelFacts } from "wisp/scripts/wisp/models";
import { PlayerViewFailure, SceneReportFile, readFrame } from "wisp/scripts/wisp/playerView";
import { describeScene, sceneProblems } from "wisp/scripts/wisp/scene";
import { importedAssets } from "../mapInputs";
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

const MODEL_TABLE = join(import.meta.dir, "../modelFacts.ts");

/** The game's archive path of a stock model, as CascLib names it: the classic models the clients draw. */
const stockPath = (model: string) => `war3.w3mod:${model.replaceAll("\\", "/").toLowerCase()}`;

/** Facts rounded to thousandths, so a table changes only when a model does. */
const tableLine = (model: string, facts: ModelFacts) =>
  `  ${JSON.stringify(model)}: ${JSON.stringify(facts, (_key, value: unknown) => (typeof value === "number" ? Math.round(value * 1000) / 1000 : value))},`;

/**
 * Reads every model a scene kind names, imported ones from the build's inputs
 * and the rest from the game's archives through the CascLib extractor that
 * tools/animations/extract.sh builds, and rewrites the model facts table.
 */
const models = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const options = Object.fromEntries(args.flatMap((arg, index) => (arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : [])));
  const { assets, summon, extractor, storage } = options;
  if (assets === undefined || summon === undefined || extractor === undefined || storage === undefined || args.length !== 8) {
    return yield* new UsageFailure({ problem: "view models takes --assets DIR --summon DIR --extractor CASC_EXTRACT --storage WARCRAFT_DIR" });
  }
  const imports = new Map((yield* importedAssets(assets, summon)).map(({ entry, source }) => [entry.toLowerCase(), source]));
  const scratch = yield* Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(join(tmpdir(), "smashcraft-stock-models."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const named = [...new Set(SMASHCRAFT_SCENE.kinds.flatMap((kind) => kind.models))].filter((model) => model !== "").sort();
  const lines = yield* Effect.forEach(named, (model, index) => Effect.gen(function*() {
    let file = imports.get(model.toLowerCase());
    if (file === undefined) {
      file = join(scratch, `stock-${index}.mdx`);
      yield* runProcess("extract stock model", model, [extractor, storage, stockPath(model), file]);
    }
    const path = file;
    const facts = yield* Effect.tryPromise({
      try: async () => modelFacts(await Bun.file(path).bytes()),
      catch: (cause) => new MapBuildFailure({ operation: "read model facts", path: model, cause }),
    });
    return tableLine(model, facts);
  }), { concurrency: 4 });
  const source = [
    "// Generated by `bun wisp view models` from the build's imported models and the game's",
    "// classic models; regenerate instead of editing.",
    'import type { ModelFacts } from "wisp/scripts/wisp/models";',
    "",
    "export const MODEL_FACTS: Readonly<Record<string, ModelFacts>> = {",
    ...lines,
    "};",
    "",
  ].join("\n");
  yield* Effect.tryPromise({ try: () => Bun.write(MODEL_TABLE, source), catch: (cause) => new MapBuildFailure({ operation: "write model facts", path: MODEL_TABLE, cause }) });
  yield* Console.log(`${named.length} models, ${named.filter((model) => !imports.has(model.toLowerCase())).length} from the game's archives: ${MODEL_TABLE}`);
}));

export const view: Command = ([mode, ...paths]) => {
  if (mode === "models") return models(paths);
  if (paths.length === 0) return Effect.fail(new UsageFailure({ problem: "view takes scene DATA_DIR..., frame FRAME.ppm... or models --assets DIR ..." }));
  if (mode === "scene") return scenes(paths);
  if (mode === "frame") return frames(paths);
  return Effect.fail(new UsageFailure({ problem: `unknown view check ${mode}` }));
};
