// Regenerates what the stage-select cards draw from the current stage data
// (smashcraft:docs/design/stage-select.md): every stage's layout silhouette
// (src/game/menu/stageSilhouettes.ts) and, for stages with no Warcraft zone
// art, a headless render re-drawn from the stage's hero camera without
// fighters or HUD, composited over its sky and graded, stored as a BLP in the
// build-input store under its own hash and recorded in ts/stage-thumbnails.json.
// Usage (from ts/): bun scripts/stageThumbnails.ts [--stage NAME] [--out PRIVATE_DIR]
// --stage redraws only that stage's card and its row; without it, every stage.
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { makeHeadless } from "wisp/scripts/wisp/commands/headless";
import { renderScenes, type RenderScene } from "wisp/scripts/wisp/headlessRender";
import type { StageTile } from "../src/game/menu/stageCatalog";
import { stageScenery } from "../src/game/presentation/stageScenery";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { encodeBlp } from "./blp";
import { runProcess } from "./hostProcess";
import { headlessRender } from "./wisp/headlessRender";
import { SMASHCRAFT_JOURNEYS } from "./wisp/journeys";
import { storeStageCard } from "./wisp/buildInputs";
import { CARD, HERO_CAMERAS, RENDERED_STAGES, type ThumbnailManifest, silhouetteSource, stageInputHash, stageNamed, thumbnailFile } from "./stageThumbnailSpec";

const TS = resolve(import.meta.dir, "..");
const MANIFEST_FILE = join(TS, "stage-thumbnails.json");
const SILHOUETTE_FILE = join(TS, "src/game/menu/stageSilhouettes.ts");
const FRAME = 80;

class ThumbnailFailure extends Schema.TaggedError<ThumbnailFailure>()("ThumbnailFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}
const attempt = <A>(problem: string, run: () => A | Promise<A>) =>
  Effect.tryPromise({ try: async () => run(), catch: (cause) => new ThumbnailFailure({ problem: `${problem}: ${cause instanceof Error ? cause.message : String(cause)}` }) });

const SceneShape = Schema.Struct({
  frame: Schema.Number,
  client: Schema.Number,
  camera: Schema.Struct({ x: Schema.Number, y: Schema.Number, fields: Schema.Record(Schema.String, Schema.Number) }),
  effects: Schema.Array(Schema.Unknown),
});

/** The renderer's own scene file: the fields this tool reads are checked, the rest pass through to the renderer. */
const isScene = (value: unknown): value is RenderScene => Schema.is(SceneShape)(value);

const outIndex = process.argv.indexOf("--out");
const work = outIndex < 0 ? join(homedir(), ".local/share/smashcraft-build-inputs/stage-thumbnails-work") : resolve(process.argv[outIndex + 1] ?? "");

const stageIndex = process.argv.indexOf("--stage");
const stageName = stageIndex < 0 ? undefined : process.argv[stageIndex + 1] ?? "";

const renderer = headlessRender();

/** One stage's quick match, held at its widest camera with items off, captured at FRAME. */
const captureStage = (stage: StageTile) => Effect.gen(function*() {
  const directory = join(work, `s${stage}`);
  const journey = join(work, `s${stage}.json`);
  yield* attempt("write the journey", () => Bun.write(journey, JSON.stringify({ frames: FRAME + 10, events: [
    { frame: 20, player: 0, chat: "-dev items off" }, { frame: 30, player: 0, chat: `-dev quick stage ${stage}` }, { frame: 40, player: 0, chat: "-dev view far" },
  ] })));
  // The journey's scene report counts expected problems (an unmodeled terrain native); the frame is still drawn.
  yield* makeHeadless(async () => ({ ...SMASHCRAFT_JOURNEYS, render: renderer }))(["--journey", journey, "--render", directory, "--frames", String(FRAME)])
    .pipe(Effect.catch(() => Effect.void));
  const raw = yield* attempt(`read stage ${stage}'s captured scene`, () => Bun.file(join(directory, `p0-frame-${FRAME}.json`)).json());
  if (!isScene(raw)) return yield* new ThumbnailFailure({ problem: `stage ${stage}'s captured scene isn't a render scene` });
  const scene = raw;
  const hero = HERO_CAMERAS[stage];
  if (hero === undefined) return yield* new ThumbnailFailure({ problem: `stage ${stage} has zone art and no hero camera` });
  // Only the stage is drawn: no fighters, HUD or menus.
  const drawn: RenderScene = { ...scene, frame: stage, client: 0, ui: [], units: [], camera: {
    x: scene.camera.x + hero.x, y: scene.camera.y,
    fields: { ...scene.camera.fields, CAMERA_FIELD_ROTATION: hero.rotation, CAMERA_FIELD_ANGLE_OF_ATTACK: hero.angleOfAttack, CAMERA_FIELD_TARGET_DISTANCE: hero.distance,
      CAMERA_FIELD_FIELD_OF_VIEW: hero.fieldOfView, CAMERA_FIELD_ZOFFSET: FLOOR_HEIGHT + hero.z, CAMERA_FIELD_FARZ: 20000 },
  } };
  return drawn;
});

const hex = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, "0");

/** The rendered stage over its sky, graded: RGBA bytes of the stored picture, and a preview PNG. */
const composePicture = (stage: StageTile, render: string, cards: string) => Effect.gen(function*() {
  const fog = stageScenery(stage).fog ?? { red: 0.5, green: 0.6, blue: 0.7 };
  const horizon = `#${hex(fog.red)}${hex(fog.green)}${hex(fog.blue)}`;
  const top = `#${hex(fog.red * CARD.skyTop)}${hex(fog.green * CARD.skyTop)}${hex(fog.blue * CARD.skyTop)}`;
  const preview = join(cards, `${thumbnailFile(stage).replace(/\.blp$/, "")}.png`);
  const size = `${CARD.width}x${CARD.height}`;
  // The renderer clears to rgb(10,15,23) where no model draws: that is the sky.
  yield* runProcess(ChildProcess.make("magick", [
    "-size", size, `gradient:${top}-${horizon}`,
    "(", render, "-fuzz", "2%", "-transparent", "rgb(10,15,23)", "-resize", `${size}!`, ")", "-composite",
    ...CARD.grade, "-alpha", "off", preview,
  ], { stdin: "ignore" }));
  const raw = join(cards, `s${stage}.rgba`);
  yield* runProcess(ChildProcess.make("magick", [preview, "-depth", "8", `rgba:${raw}`], { stdin: "ignore" }));
  const rgba = yield* attempt("read the picture", () => Bun.file(raw).bytes());
  return encodeBlp({ width: CARD.width, height: CARD.height, data: rgba, alpha: false }, CARD.quality);
});

const program = Effect.gen(function*() {
  const only = stageName === undefined ? undefined : stageNamed(stageName);
  if (stageName !== undefined && only === undefined) return yield* new ThumbnailFailure({ problem: `no selectable stage is called ${JSON.stringify(stageName)}` });
  yield* attempt("write the silhouettes", () => Bun.write(SILHOUETTE_FILE, silhouetteSource()));
  const stages = only === undefined ? RENDERED_STAGES : RENDERED_STAGES.filter((stage) => stage === only);
  const previous: ThumbnailManifest = only === undefined ? { stages: [] } : yield* attempt("read the manifest", () => Bun.file(MANIFEST_FILE).json());
  mkdirSync(work, { recursive: true });
  const scenes = yield* Effect.forEach(stages, captureStage);
  const renders = join(work, "renders");
  // One browser per scene: the renderer fails tearing down one scene's models for the next.
  yield* Effect.forEach(scenes, (scene) => renderScenes({ ...renderer, width: CARD.renderWidth, height: CARD.renderHeight }, [scene], renders));
  const cards = join(work, "cards");
  mkdirSync(cards, { recursive: true });
  const rows = yield* Effect.forEach(stages, (stage) => composePicture(stage, join(renders, `p0-frame-${stage}.png`), cards).pipe(
    Effect.flatMap((blp) => attempt("store the card", () => storeStageCard(blp)).pipe(
      Effect.map((sha256) => ({ stage, file: thumbnailFile(stage), inputs: stageInputHash(stage), sha256, bytes: blp.length })))),
  ), { concurrency: 4 });
  // The other stages' rows stay as they were, in catalog order, so one stage's regeneration changes only its own lines.
  const merged = RENDERED_STAGES.flatMap((stage) => rows.find((row) => row.stage === stage) ?? previous.stages.find((row) => row.stage === stage) ?? []);
  yield* attempt("write the manifest", () => Bun.write(MANIFEST_FILE, JSON.stringify({ stages: merged } satisfies ThumbnailManifest, null, 2) + "\n"));
  for (const row of rows) console.log(`${row.file}\t${row.bytes} bytes`);
  console.log(`${rows.length} rendered pictures; all cards ${merged.reduce((sum, row) => sum + row.bytes, 0)} bytes; previews in ${cards}`);
});

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
