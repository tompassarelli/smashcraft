// `wisp view scene DATA_DIR...` checks each client's latest scene report;
// `wisp view frame FRAME.ppm...` measures captured or recorded frames. Both
// apply the expectations fresh and the native gates use (../playerView.ts)
// and fail with what a player would see wrong. `wisp view models ...`
// rewrites the model facts those expectations read.
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
import { heroModelSource, importedModelFile, stockModelPath } from "../../heroModelSource";
import { gameFilesLayer, tsDirectory } from "../project";
import { SMASHCRAFT_FRAME, SMASHCRAFT_SCENE } from "../playerView";
import { CHARACTER_NAMES, DrawnModel, FIGHTER_MODELS, STYLE_NAMES, loadDrawnModel, sampleAttack, sampleState, sheet } from "../hurtboxView";
import { characterModelScale } from "../../../src/game/presentation/modelScale";
import { type DrawnReachRow, REACH_CHECKED, drawnReachSource, measureDrawnReach } from "../drawnReach";
import { DRAWN_REACH } from "../drawnReachInfo";
import { measureStrikeMoments, strikeMomentSource } from "../strikeMoments";
import { HERO_ROSTER, SELECTABLE_CHARACTERS, fighterName, fighterSlug } from "../../../src/game/sim/heroes/registry";
import { MOTION_STATES, drawnStrideSource, measureDrawnMotion, measureDrawnStride, type DrawnStride, type DrawnMotionRow } from "../drawnMotion";
import { AttackPhase, AttackStyle, Character } from "../../../src/game/sim/codes";
import { AUTHORED_SAMPLE_STYLES } from "../../../src/game/sim/hurtboxes";

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
      yield* runProcess("extract stock model", model, [extractor, storage, stockModelPath(model), file]);
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

const AERIALS: readonly AttackStyle[] = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];

/**
 * Writes side-view sheets of every shipped fighter's hurt volumes over its
 * drawn pose: the standing and crouching bodies, each sampled move facing
 * right, and its first active frames facing left (smashcraft:docs/hurtboxes.md).
 */
const hurtboxes = (args: readonly string[]) => Effect.gen(function*() {
  const options = Object.fromEntries(args.flatMap((arg, index) => (arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : [])));
  const { assets, out } = options;
  if (assets === undefined || out === undefined || args.length !== 4) return yield* new UsageFailure({ problem: "view hurtboxes takes --assets DIR --out DIR" });
  yield* Effect.tryPromise({
    try: async () => {
      mkdirSync(out, { recursive: true });
      for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
        const model = await loadDrawnModel(assets, character);
        const name = CHARACTER_NAMES[character] ?? `${character}`;
        const sheets = [sheet(`${name} stand-crouch`, model, [sampleState(character, false), sampleState(character, true), sampleState(character, false, -1), sampleState(character, true, -1)], 4)];
        const mirrored = [];
        for (const style of AUTHORED_SAMPLE_STYLES) {
          const aerial = AERIALS.includes(style);
          sheets.push(sheet(`${name} ${STYLE_NAMES[style] ?? style}`, model, sampleAttack(character, style, 1, aerial)));
          mirrored.push(...sampleAttack(character, style, -1, aerial).filter((frame) => frame.phase === AttackPhase.active).slice(0, 1));
        }
        sheets.push(sheet(`${name} first-active-left`, model, mirrored, mirrored.length));
        for (const result of sheets) {
          await Bun.write(join(out, `${result.name.replaceAll(" ", "-")}.png`), result.png);
          for (const line of result.lines) console.log(line);
        }
      }
    },
    catch: (cause) => new MapBuildFailure({ operation: "draw hurt volumes", path: out, cause }),
  });
});

const STRIKE_TABLE = join(import.meta.dir, "../../../src/game/presentation/heroStrikeMomentInfo.ts");

/**
 * Measures the models supplied by the build, or extracts stock models when
 * no assets directory is supplied, and rewrites the strike moment table.
 */
const strikes = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const options = Object.fromEntries(args.flatMap((arg, index) => (arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : [])));
  const { extractor, storage, assets } = options;
  const extractStock = extractor !== undefined && storage !== undefined;
  if (!(assets !== undefined && args.length === 2 || extractStock && args.length === (assets === undefined ? 4 : 6))) {
    return yield* new UsageFailure({ problem: "view strikes takes --assets DIR or --extractor CASC_EXTRACT --storage WARCRAFT_DIR [--assets DIR]" });
  }
  const scratch = yield* Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(join(tmpdir(), "smashcraft-strikes."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const files = new Map<string, string>();
  for (const [index, model] of [...new Set(HERO_ROSTER.map(({ presentation }) => presentation.model))].entries()) {
    if (assets !== undefined) {
      files.set(model, join(assets, heroModelSource(model)));
      continue;
    }
    if (importedModelFile(model) !== undefined) return yield* new UsageFailure({ problem: `${model} is imported: pass --assets DIR` });
    if (extractor === undefined || storage === undefined) return yield* new UsageFailure({ problem: "stock models need --extractor CASC_EXTRACT --storage WARCRAFT_DIR" });
    const file = join(scratch, `hero-${index}.mdx`);
    yield* runProcess("extract stock model", model, [extractor, storage, stockModelPath(model), file]);
    files.set(model, file);
  }
  const moments = yield* Effect.tryPromise({
    try: () => measureStrikeMoments((model) => Bun.file(files.get(model) ?? "").arrayBuffer()),
    catch: (cause) => new MapBuildFailure({ operation: "measure strike moments", path: STRIKE_TABLE, cause }),
  });
  yield* Effect.tryPromise({ try: () => Bun.write(STRIKE_TABLE, strikeMomentSource(moments)), catch: (cause) => new MapBuildFailure({ operation: "write strike moments", path: STRIKE_TABLE, cause }) });
  yield* Console.log(`${moments.length} strike moments: ${STRIKE_TABLE}`);
}));

const REACH_TABLE = join(import.meta.dir, "../drawnReachInfo.ts");

/**
 * Measures how far each checked swing draws toward its strike (#156) on a
 * build's packaged fighter models and the heroes' stock models under its
 * hero-models, and rewrites the table ts/test/drawn-reach.test.ts checks.
 */
const reach = (args: readonly string[]) => Effect.gen(function*() {
  const assets = args[0] === "--assets" ? args[1] : undefined;
  const character = args[2] === "--character" ? Number(args[3]) : undefined;
  if (assets === undefined || !(args.length === 2 || args.length === 4 && character !== undefined && REACH_CHECKED.some((row) => row.character === character))) {
    return yield* new UsageFailure({ problem: "view reach takes --assets DIR [--character ID]" });
  }
  const rows = yield* Effect.tryPromise({
    try: async () => {
      const measured: DrawnReachRow[] = [];
      for (const { character: fighter, styles } of REACH_CHECKED) {
        if (character !== undefined && character !== fighter) {
          for (const style of styles) {
            const retained = DRAWN_REACH.find((row) => row.character === fighter && row.style === style);
            if (retained === undefined) throw new Error(`${fighter}/${style}: no retained reach; measure every fighter`);
            measured.push({ ...retained, character: fighter, style });
          }
          continue;
        }
        const hero = HERO_ROSTER.find((candidate) => candidate.character === fighter);
        let model: DrawnModel;
        let id: string;
        if (hero === undefined) {
          const bytes = await Bun.file(join(assets, FIGHTER_MODELS[fighter] ?? "")).arrayBuffer();
          const name = (FIGHTER_MODELS[fighter] ?? "").split("/").at(-1)?.replace(/\.mdx$/, "");
          id = `war3mapImported\\${name}-${new Bun.CryptoHasher("sha256").update(new Uint8Array(bytes)).digest("hex")}.mdx`;
          model = await loadDrawnModel(assets, fighter);
        } else {
          const file = join(assets, heroModelSource(hero.presentation.model));
          model = new DrawnModel(await Bun.file(file).arrayBuffer(), characterModelScale(fighter));
          id = hero.presentation.model;
        }
        for (const style of styles) measured.push({ character: fighter, style, model: id, ...measureDrawnReach(model, fighter, style) });
      }
      return measured;
    },
    catch: (cause) => new MapBuildFailure({ operation: "measure drawn reach", path: assets, cause }),
  });
  for (const row of rows.filter((row) => character === undefined || row.character === character)) yield* Console.log(`${CHARACTER_NAMES[row.character] ?? row.character} ${row.style}: swing ${row.swing.toFixed(1)}, peak frame ${row.peakFrame}, active ${row.firstActive}-${row.lastActive}`);
  yield* Effect.tryPromise({ try: () => Bun.write(REACH_TABLE, drawnReachSource(rows)), catch: (cause) => new MapBuildFailure({ operation: "write drawn reach", path: REACH_TABLE, cause }) });
});

/** Regenerates cadence facts and the all-fighter state audit from one private asset view. */
const motion = (args: readonly string[]) => Effect.gen(function*() {
  const assets = args[0] === "--assets" ? args[1] : undefined;
  if (assets === undefined || args.length !== 2) return yield* new UsageFailure({ problem: "view motion takes --assets DIR" });
  const result = yield* Effect.tryPromise({
    try: async () => {
      const strides: DrawnStride[] = [];
      const rows: DrawnMotionRow[] = [];
      const models: { character: Character; drawn: DrawnModel; model: string }[] = [];
      for (const character of SELECTABLE_CHARACTERS) {
        const hero = HERO_ROSTER.find((candidate) => candidate.character === character);
        const relative = hero === undefined ? FIGHTER_MODELS[character] ?? "" : heroModelSource(hero.presentation.model);
        const bytes = await Bun.file(join(assets, relative)).arrayBuffer();
        const hash = new Bun.CryptoHasher("sha256").update(new Uint8Array(bytes)).digest("hex");
        const model = hero?.presentation.model ?? `war3mapImported\\${relative.split("/").at(-1)?.replace(/\.mdx$/, "")}-${hash}.mdx`;
        const drawn = new DrawnModel(bytes, characterModelScale(character));
        for (const state of ["walk", "run"] as const) strides.push(measureDrawnStride(bytes, drawn, character, state, model));
        models.push({ character, drawn, model });
      }
      const stridePath = join(import.meta.dir, "../../../src/game/presentation/drawnStrideInfo.ts");
      const strideSource = drawnStrideSource(strides);
      if (!await Bun.file(stridePath).exists() || await Bun.file(stridePath).text() !== strideSource) {
        await Bun.write(stridePath, strideSource);
        // A fresh process reads the regenerated cadence before sampling production pose times.
        return { changed: true, rows };
      }
      for (const { character, drawn, model } of models) for (const state of MOTION_STATES) rows.push(measureDrawnMotion(drawn, character, state, model));
      const rowSource = rows.map((row) => `  ${JSON.stringify({ ...row, motion: Number(row.motion.toFixed(1)), body: Number(row.body.toFixed(1)), toward: Number(row.toward.toFixed(1)), against: Number(row.against.toFixed(1)) })},`).join("\n");
      await Bun.write(join(import.meta.dir, "../drawnMotionInfo.ts"), `// Generated by \`bun wisp view motion --assets DIR\`; regenerate instead of editing.\nimport type { DrawnMotionRow } from "./drawnMotion";\nexport const DRAWN_MOTION: readonly DrawnMotionRow[] = [\n${rowSource}\n];\n`);
      const lines = ["# Fighter movement and recovery clips", "", "Generated from the packaged models by `bun wisp view motion --assets DIR` (#171). Each row follows production pose selection over the state's completed frames. Motion is the greatest local vertex travel; body is the mean of each vertex's greatest travel, in world units. The direction column measures vertex travel toward/against the action's direction (vertical for standing up or crouching, horizontal otherwise). Local measurements exclude the simulation's movement across the stage. Clip numbers and names identify sequences of the fighter's model. A zero reveals a held pose. These measurements expose gaps; a stock Walk in a roll row still needs a roll clip.", "", "| Fighter | State | Clip | Motion | Body | Direction; toward/against |", "| --- | --- | --- | ---: | ---: | --- |", ...rows.map((row) => `| ${fighterName(row.character)} | ${row.state} | ${row.clips.map((clip, index) => `${clip}: ${row.names[index]}`).join(", ")} | ${row.motion.toFixed(1)} | ${row.body.toFixed(1)} | ${row.direction}; ${row.toward.toFixed(1)}/${row.against.toFixed(1)} |`), "", "Walking/running cadence uses grounded vertices' horizontal excursion twice per cycle. The Lich floats and uses the stock sequence's movement speed. Both measurements use the fighter's displayed model scale.", ""];
      await Bun.write(join(import.meta.dir, "../../../../docs/fighter-motion.md"), lines.join("\n"));
      return { changed: false, rows };
    },
    catch: (cause) => new MapBuildFailure({ operation: "measure drawn motion", path: assets, cause }),
  });
  if (result.changed) return yield* runProcess("measure updated movement cadence", tsDirectory, [process.execPath, "scripts/wisp.ts", "view", "motion", ...args]);
  for (const row of result.rows) yield* Console.log(`${fighterSlug(row.character)} ${row.state}: clips ${row.clips.join(",")}, motion ${row.motion.toFixed(1)}, body ${row.body.toFixed(1)}`);
});

export const view: Command = ([mode, ...paths]) => {
  if (mode === "models") return models(paths);
  if (mode === "motion") return motion(paths);
  if (mode === "reach") return reach(paths);
  if (mode === "strikes") return strikes(paths);
  if (mode === "hurtboxes") return hurtboxes(paths);
  if (paths.length === 0) return Effect.fail(new UsageFailure({ problem: "view takes scene DATA_DIR..., frame FRAME.ppm..., models --assets DIR ..., hurtboxes, strikes or reach --assets DIR" }));
  if (mode === "scene") return scenes(paths);
  if (mode === "frame") return frames(paths);
  return Effect.fail(new UsageFailure({ problem: `unknown view check ${mode}` }));
};
