import { emptyBackdropShare } from "./layout";
import { candidateProblems, candidateScene, candidates, emit, fogKey, pieceEffects, ranked, settingText, stageOrigin, table, withFog, type Measured, type SearchSpec, type Stage } from "./stageSpace";

const USAGE = "usage: bun tools/stage/search.ts STAGE [SPEC.json] [--out DIR]";
const LOOK = ["day-night-light", "fog", "height-fog-falloff", "sky", "shadows", "point-lights", "pbr", "point-light-shadows", "ambient-occlusion", "bloom"] as const;
const HORIZON = 1 / 3;
const DEFAULT_SPEC: SearchSpec = { fogEnd: [5500, 6000, 7000, 9000], tintScale: [0.8, 1.0, 1.25] };

const args = Bun.argv.slice(2);
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args[outAt + 1] ?? "" : `${process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`}/smashcraft/stage-search`;
const positional = args.filter((_, index) => outAt < 0 || (index !== outAt && index !== outAt + 1));
const stageId = Number(positional[0]);
if (!Number.isInteger(stageId) || out === "") throw new Error(USAGE);
const spec: SearchSpec = positional[1] === undefined ? DEFAULT_SPEC : await Bun.file(positional[1]).json();
const clock = () => performance.now() / 1000;
const t0 = clock();

const { Effect } = await import("../../ts/node_modules/effect/dist/index.js");
const { installHeadless } = await import("../../ts/node_modules/wisp/scripts/wisp/headless");
const { captureScene, renderScenes } = await import("../../ts/node_modules/wisp/scripts/wisp/headlessRender");
const { SMASHCRAFT_HEADLESS } = await import("../../ts/scripts/wisp/headless");
const { headlessRender } = await import("../../ts/scripts/wisp/headlessRender");
const { start, install } = await import("../../ts/src/platform/devMain");
const { stageScenery } = await import("../../ts/src/game/presentation/stageScenery");
const { STAGE_LIGHTS } = await import("../../ts/src/game/assets/stageLighting");
const { STAGE_DECK_PALETTES } = await import("../../ts/src/game/assets/stagePalette");
const { STAGE_CATALOG } = await import("../../ts/src/game/menu/stageCatalog");

const runtime = installHeadless(SMASHCRAFT_HEADLESS);
const clients = runtime.clients({ start, install });
clients.start(); clients.frames(20); clients.chat(0, "-dev items off"); clients.frames(10); clients.chat(0, `-dev quick stage ${stageId}`); clients.frames(15);
for (const client of clients.clients) clients.chat(client.slot, "-dev view near");
clients.frames(65);
const scenes = clients.clients.map(client => ({ view: "near", scene: captureScene(client) }));
clients.frames(245);
for (const client of clients.clients) clients.chat(client.slot, "-dev view far");
clients.frames(55);
scenes.push(...clients.clients.map(client => ({ view: "far", scene: captureScene(client) })));
const errors = clients.clients.flatMap(client => client.errors);
runtime.restore();
if (errors.length > 0) throw new Error(`stage ${stageId}: ${errors.join("\n")}`);
const tSim = clock();

const scenery = stageScenery(stageId);
const light = STAGE_LIGHTS.find(entry => entry.stage === stageId)?.light;
const palette = STAGE_DECK_PALETTES.find(entry => entry.stage === stageId)?.palette;
const name = STAGE_CATALOG.find(entry => entry.id === stageId)?.name ?? `stage ${stageId}`;
if (light === undefined || palette === undefined) throw new Error(`${name}: no light or deck palette`);
const origin = stageOrigin(scenes[0]!.scene.effects, scenery.pieces);
const stage: Stage = { id: stageId, name, scenery, light, palette, origin };
const all = candidates(stage, spec);
const checked = all.map(candidate => ({ candidate, problems: candidateProblems(stage, candidate) }));
const survivors = checked.filter(row => row.problems.length === 0);
const tRules = clock();
console.log(`${name}: ${all.length} candidates, ${survivors.length} pass the render-free rules (${(tRules - tSim).toFixed(1)} s)`);
for (const { candidate, problems } of checked.filter(row => row.problems.length > 0)) console.log(`rejected ${candidate.index} ${settingText(candidate.settings)}: ${problems.join("; ")}`);

const empty = new Map<number, Record<string, number>>(survivors.map(({ candidate }) => [candidate.index, {}]));
const views: string[] = [];
for (const mode of spec.modes ?? ["classic", "definitive"]) for (const client of spec.clients ?? [0]) {
  const directory = `${out}/${stageId}-${mode}-p${client}`;
  const own = scenes.filter(({ scene }) => scene.client === client);
  const fogs = [...new Map(survivors.map(({ candidate }) => [fogKey(candidate.scenery.fog), candidate.scenery.fog])).entries()];
  const jobs = own.flatMap(({ view, scene }, viewIndex) => {
    const common = { ...scene, ui: [], textTags: [], filter: undefined };
    const indices = pieceEffects(scene.effects, scenery.pieces, origin);
    if (indices === undefined) throw new Error(`${name}: ${view} view lost the stage's scenery`);
    const base = scene.frame + 100000 * viewIndex;
    const skies = fogs.map(([key, fog], index) => ({ key, scene: withFog({ ...common, frame: base + 1000 + index, effects: [], units: [] }, fog) }));
    const shots = survivors.map(({ candidate }) => ({ candidate, view: `${mode} p${client} ${view}`, sky: fogKey(candidate.scenery.fog), scene: candidateScene(common, indices, origin, candidate, base + 10000 + candidate.index) }));
    return [{ skies, shots }];
  });
  const captures = jobs.flatMap(({ skies, shots }) => [...skies.map(entry => entry.scene), ...shots.map(entry => entry.scene)]);
  const r0 = clock();
  await Effect.runPromise(renderScenes({ ...headlessRender(), width: 1280, height: client === 0 ? 720 : 540 }, captures, directory, mode, LOOK)).catch(async (failure: unknown) => {
    const drawn = await Promise.all(captures.map(scene => Bun.file(`${directory}/p${client}-frame-${scene.frame}.png`).exists()));
    if (drawn.includes(false) || !String(failure).includes("undrawn")) throw failure;
  });
  const r1 = clock();
  const frame = (number: number) => `${directory}/p${client}-frame-${number}.png`;
  for (const { skies, shots } of jobs) for (const shot of shots) {
    const sky = skies.find(entry => entry.key === shot.sky)!;
    empty.get(shot.candidate.index)![shot.view] = await emptyBackdropShare(frame(sky.scene.frame), frame(shot.scene.frame), HORIZON);
    if (!views.includes(shot.view)) views.push(shot.view);
  }
  console.log(`${mode} p${client}: ${captures.length} frames rendered in ${(r1 - r0).toFixed(1)} s, measured in ${(clock() - r1).toFixed(1)} s`);
}

const rows: Measured[] = survivors.map(({ candidate, problems }) => ({ candidate, problems, empty: empty.get(candidate.index) ?? {} }));
const best = ranked(rows).slice(0, Math.max(1, Math.min(2, spec.finalists ?? 2)));
const report = [
  `${name}: ${all.length} candidates, ${survivors.length} rendered, ${(clock() - t0).toFixed(1)} s (sim ${(tSim - t0).toFixed(1)} s)`,
  "",
  table(rows, views),
  "",
  ...best.flatMap((row, index) => {
    const text = emit(row.candidate);
    return [
      `finalist ${index + 1}: candidate ${row.candidate.index} (${settingText(row.candidate.settings)})`,
      `stageScenery fields:\n${text.scenery}`,
      `stageLighting.ts ${text.light}`,
      "",
    ];
  }),
  `Next: splice a finalist into the stage's scenery and light, then run bun tools/stage/contrast.ts --stock-light ${stageId} and one fresh judge.`,
].join("\n");
await Bun.write(`${out}/${stageId}-search.txt`, report);
console.log(`\n${report}\nwritten ${out}/${stageId}-search.txt`);
