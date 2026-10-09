




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
import { HERO_ROSTER, SELECTABLE_CHARACTERS, isSelectableCharacter, fighterName, fighterSlug } from "../../../src/game/sim/heroes/registry";
import { DRAWN_STRIDES } from "../../../src/game/presentation/drawnStrideInfo";
import { DRAWN_MOTION } from "../drawnMotionInfo";
import { MOTION_STATES, drawnStrideSource, measureDrawnMotion, measureDrawnStride, type DrawnStride, type DrawnMotionRow } from "../drawnMotion";
import { AttackPhase, AttackStyle, Character } from "../../../src/game/sim/codes";
import { AUTHORED_SAMPLE_STYLES } from "../../../src/game/sim/hurtboxes";
import { CUE_FRAMES, type CueMeasurement, cueMoves, measureCueMoves } from "../cueBudget";

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

import { MODEL_FACTS } from "../modelFacts";
import { DEFINITIVE_CUE_EMITTERS } from "../../../src/game/presentation/cueEmitterInfo";

const MODEL_TABLE = join(import.meta.dir, "../modelFacts.ts");



const tableLine = (model: string, facts: ModelFacts) =>
  `  ${JSON.stringify(model)}: ${JSON.stringify(facts, (_key, value: unknown) => (typeof value === "number" ? Math.round(value * 1000) / 1000 : value))},`;






const models = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  if (args.length === 1 && args[0] === "--prune") {
    const named = new Set(SMASHCRAFT_SCENE.kinds.flatMap(kind => kind.models).filter(model => model !== ""));
    const missing = [...named].filter(model => MODEL_FACTS[model] === undefined);
    if (missing.length > 0) return yield* new UsageFailure({ problem: `new models need a full measurement: ${missing.join(", ")}` });
    const source = yield* Effect.tryPromise({ try: () => Bun.file(MODEL_TABLE).text(), catch: cause => new MapBuildFailure({ operation: "read model facts", path: MODEL_TABLE, cause }) });
    const kept = source.split("\n").filter(line => {
      const key = /^  ("(?:[^"\\]|\\.)*"):/.exec(line)?.[1];
      return key === undefined || named.has(JSON.parse(key));
    }).join("\n");
    yield* Effect.tryPromise({ try: () => Bun.write(MODEL_TABLE, kept), catch: cause => new MapBuildFailure({ operation: "write model facts", path: MODEL_TABLE, cause }) });
    yield* Console.log(`Kept ${named.size} measured models: ${MODEL_TABLE}`);
    return;
  }
  const options = Object.fromEntries(args.flatMap((arg, index) => (arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : [])));
  const { assets, summon, extractor, storage, only } = options;
  if (assets === undefined || summon === undefined || extractor === undefined || storage === undefined || !(args.length === 8 || args.length === 10 && only !== undefined)) {
    return yield* new UsageFailure({ problem: "view models takes --assets DIR --summon DIR --extractor CASC_EXTRACT --storage WARCRAFT_DIR [--only MODEL,...]" });
  }
  const imports = new Map((yield* importedAssets(assets, summon)).map(({ entry, source }) => [entry.toLowerCase(), source]));
  const scratch = yield* Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(join(tmpdir(), "smashcraft-stock-models."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
  const selected = only?.split(",");
  const named = [...new Set(SMASHCRAFT_SCENE.kinds.flatMap((kind) => kind.models))].filter((model) => model !== "" && (selected === undefined || selected.includes(model))).sort();
  const lines = yield* Effect.forEach(named, (model, index) => Effect.gen(function*() {
    let file = imports.get(model.toLowerCase());
    if (file === undefined) {
      const stockFile = join(scratch, `stock-${index}.mdx`);
      file = stockFile;
      yield* runProcess("extract stock model", model, [extractor, storage, stockModelPath(model), stockFile]).pipe(
        Effect.catch(() => runProcess("extract HD-only stock model", model, [extractor, storage, stockModelPath(model).replace("war3.w3mod:", "war3.w3mod:_hd.w3mod:"), stockFile])),
      );
    }
    const path = file;
    const facts = yield* Effect.tryPromise({
      try: async () => modelFacts(await Bun.file(path).bytes()),
      catch: (cause) => new MapBuildFailure({ operation: "read model facts", path: model, cause }),
    });
    return tableLine(model, facts);
  }), { concurrency: 4 });
  const cueEmitters = { ...DEFINITIVE_CUE_EMITTERS };
  for (const [index, model] of named.entries()) {
    if (!Object.hasOwn(cueEmitters, model)) continue;
    const path = join(scratch, `definitive-${index}.mdx`);
    yield* runProcess("extract Definitive cue", model, [extractor, storage, stockModelPath(model).replace("war3.w3mod:", "war3.w3mod:_de.w3mod:"), path]);
    const facts = yield* Effect.tryPromise({ try: async () => modelFacts(await Bun.file(path).bytes()), catch: cause => new MapBuildFailure({ operation: "read Definitive cue", path: model, cause }) });
    cueEmitters[model] = facts.emitters.some(emitter => emitter.kind === "popcorn");
  }
  yield* Effect.tryPromise({
    try: () => Bun.write(join(import.meta.dir, "../../../src/game/presentation/cueEmitterInfo.ts"), [
      "// Generated by `bun wisp view models` from the stock _de MDX emitter chunks.",
      "export const DEFINITIVE_CUE_EMITTERS: { readonly [model: string]: boolean | undefined } = {",
      ...Object.entries(cueEmitters).sort().map(([model, popcorn]) => `  ${JSON.stringify(model)}: ${popcorn},`),
      "};", "",
    ].join("\n")),
    catch: cause => new MapBuildFailure({ operation: "write cue emitter facts", path: "cueEmitterInfo.ts", cause }),
  });
  const existing = selected === undefined ? undefined : yield* Effect.tryPromise({
    try: () => Bun.file(MODEL_TABLE).text(),
    catch: cause => new MapBuildFailure({ operation: "read model facts", path: MODEL_TABLE, cause }),
  });
  const retained = existing?.split("\n").filter(line => {
    const key = /^  ("(?:[^"\\]|\\.)*"):/.exec(line)?.[1];
    return key !== undefined && !named.includes(JSON.parse(key));
  });
  const source = [
    "// Generated by `bun wisp view models` from the build's imported models and the game's",
    "// classic models; regenerate instead of editing.",
    'import type { ModelFacts } from "wisp/scripts/wisp/models";',
    "",
    "export const MODEL_FACTS: Readonly<Record<string, ModelFacts>> = {",
    ...(retained === undefined ? lines : [...retained, ...lines].sort()),
    "};",
    "",
  ].join("\n");
  yield* Effect.tryPromise({ try: () => Bun.write(MODEL_TABLE, source), catch: (cause) => new MapBuildFailure({ operation: "write model facts", path: MODEL_TABLE, cause }) });
  yield* Console.log(`${named.length} models, ${named.filter((model) => !imports.has(model.toLowerCase())).length} from the game's archives: ${MODEL_TABLE}`);
}));

const AERIALS: readonly AttackStyle[] = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];






const hurtboxes = (args: readonly string[]) => Effect.gen(function*() {
  const options = Object.fromEntries(args.flatMap((arg, index) => (arg.startsWith("--") && args[index + 1] !== undefined ? [[arg.slice(2), args[index + 1]]] : [])));
  const { assets, out } = options;
  if (assets === undefined || out === undefined || args.length !== 4) return yield* new UsageFailure({ problem: "view hurtboxes takes --assets DIR --out DIR" });
  yield* Effect.tryPromise({
    try: async () => {
      mkdirSync(out, { recursive: true });
      for (const character of [ Character.rifleman, Character.demonHunter]) {
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


const motion = (args: readonly string[]) => Effect.gen(function*() {
  const assets = args[0] === "--assets" ? args[1] : undefined;
  const selected = args[2] === "--character" ? Number(args[3]) : undefined;
  if (assets === undefined || !(args.length === 2 || args.length === 4 && selected !== undefined && isSelectableCharacter(selected))) return yield* new UsageFailure({ problem: "view motion takes --assets DIR [--character ID]" });
  const result = yield* Effect.tryPromise({
    try: async () => {
      const strides: DrawnStride[] = selected === undefined ? [] : SELECTABLE_CHARACTERS.flatMap(character => {
        const row = DRAWN_STRIDES[character];
        return row === undefined || character === selected ? [] : (["walk", "run"] as const).map(motion => ({ character, motion, ...row[motion] }));
      });
      const rows: DrawnMotionRow[] = selected === undefined ? [] : DRAWN_MOTION.filter(row => row.character !== selected);
      const models: { character: Character; drawn: DrawnModel; model: string }[] = [];
      const characters = [ Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)];
      for (const character of characters) {
        if (selected !== undefined && character !== selected) continue;
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
      const strideSource = drawnStrideSource(strides.sort((a, b) => a.character - b.character));
      if (!await Bun.file(stridePath).exists() || await Bun.file(stridePath).text() !== strideSource) {
        await Bun.write(stridePath, strideSource);

        return { changed: true, rows };
      }
      for (const { character, drawn, model } of models) for (const state of MOTION_STATES) rows.push(measureDrawnMotion(drawn, character, state, model));
      rows.sort((a, b) => characters.indexOf(a.character) - characters.indexOf(b.character) || MOTION_STATES.indexOf(a.state) - MOTION_STATES.indexOf(b.state));
      const rowSource = rows.map((row) => `  ${JSON.stringify({ ...row, motion: Number(row.motion.toFixed(1)), body: Number(row.body.toFixed(1)), toward: Number(row.toward.toFixed(1)), against: Number(row.against.toFixed(1)) })},`).join("\n");
      await Bun.write(join(import.meta.dir, "../drawnMotionInfo.ts"), `// Generated by \`bun wisp view motion --assets DIR\`; regenerate instead of editing.\nimport type { DrawnMotionRow } from "./drawnMotion";\nexport const DRAWN_MOTION: readonly DrawnMotionRow[] = [\n${rowSource}\n];\n`);
      const lines = ["# Fighter movement and recovery clips", "", "Generated from the packaged models by `bun wisp view motion --assets DIR` (#171). Each row follows production pose selection over the state's completed frames. Motion is the greatest local vertex travel; body is the mean of each vertex's greatest travel, in world units. The direction column measures vertex travel toward/against the action's direction (vertical for standing up or crouching, horizontal otherwise). Local measurements exclude the simulation's movement across the stage. Clip numbers and names identify sequences of the fighter's model. A zero reveals a held pose. These measurements expose gaps; a stock Walk in a roll row still needs a roll clip.", "", "| Fighter | State | Clip | Motion | Body | Direction; toward/against |", "| --- | --- | --- | ---: | ---: | --- |", ...rows.map((row) => `| ${fighterName(row.character)} | ${row.state} | ${row.clips.map((clip, index) => `${clip}: ${row.names[index]}`).join(", ")} | ${row.motion.toFixed(1)} | ${row.body.toFixed(1)} | ${row.direction}; ${row.toward.toFixed(1)}/${row.against.toFixed(1)} |`), "", "Walking/running cadence uses grounded vertices' horizontal excursion twice per cycle. The Lich floats and uses the stock sequence's movement speed. Both measurements use the fighter's displayed model scale.", ""];
      await Bun.write(join(import.meta.dir, "../../../../docs/fighter-motion.md"), lines.join("\n"));
      return { changed: false, rows };
    },
    catch: (cause) => new MapBuildFailure({ operation: "measure drawn motion", path: assets, cause }),
  });
  if (result.changed) return yield* runProcess("measure updated movement cadence", tsDirectory, [process.execPath, "scripts/wisp.ts", "view", "motion", ...args]);
  for (const row of result.rows.filter(row => selected === undefined || row.character === selected)) yield* Console.log(`${fighterSlug(row.character)} ${row.state}: clips ${row.clips.join(",")}, motion ${row.motion.toFixed(1)}, body ${row.body.toFixed(1)}`);
});

const cues = (args: readonly string[]) => Effect.gen(function*() {
  const only = args.flatMap((arg, index) => args[index - 1] === "--move" ? [arg] : []);
  const looks = args.flatMap((arg, index) => args[index - 1] !== "--graphics" ? [] : arg === "classic" ? ["classic" as const] : arg === "definitive" ? ["definitive" as const] : []);
  if (args.length !== (only.length + looks.length) * 2) {
    return yield* new UsageFailure({ problem: "view cues takes [--move FIGHTER:MOVE]... [--graphics classic|definitive]" });
  }
  const moves = cueMoves().filter(({ name }) => only.length === 0 || only.includes(name));
  const rows: CueMeasurement[] = [];
  for (const graphics of looks.length === 0 ? ["classic", "definitive"] as const : looks) {
    rows.push(...yield* measureCueMoves(moves, graphics, join(CUE_FRAMES, graphics)));
  }
  const frames = (value: number) => Number.isFinite(value) ? String(value) : "never";
  for (const row of [...rows].sort((a, b) => b.linger - a.linger || b.coverage - a.coverage)) {
    yield* Console.log(`${row.over.length > 0 ? "OVER" : "ok  "} ${row.move} ${row.graphics}: danger to ${row.lastDanger}, shown ${row.firstShown}-${frames(row.lastShown)}, linger ${frames(row.linger)}, covers ${(row.coverage * 100).toFixed(1)}% (${row.widest.join(", ")})${row.popcorn ? " (Popcorn undrawn)" : ""}${row.over.length > 0 ? `; ${row.over.join("; ")}` : ""}`);
  }
  const over = rows.filter((row) => row.over.length > 0);
  yield* Console.log(`${rows.length} cue measurements, ${over.length} over budget; frames in ${CUE_FRAMES}`);
  if (over.length > 0) return yield* new MapBuildFailure({ operation: "check the effect budget", path: "docs/design/visual-quality.md", cause: over.map((row) => `${row.move} ${row.graphics}`).join(", ") });
});

export const view: Command = ([mode, ...paths]) => {
  if (mode === "cues") return cues(paths);
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
