// `bun wisp anim score|judge` (#367): the animation scorecard. Lines 1–4 are
// measured from the exported bodies (scripts/wisp/animScore.ts); line 5 is a
// separate judge's side-by-side reading against a Smash reference, recorded
// in tools/move-data/anim-score/judge.jsonl. smashcraft:docs/animation-scorecard.md.
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { captureScene, renderScenes, type RenderScene } from "wisp/scripts/wisp/headlessRender";
import { originalClip } from "../../../src/game/assets/fighterOriginalClipInfo";
import { extremeCamera, cameraFieldOfView, FLOOR_HEIGHT } from "../../../src/game/presentation/arenaCamera";
import type { Character } from "../../../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterName, fighterSlug } from "../../../src/game/sim/heroes/registry";
import { createMatchCamera, MATCH_CAMERA_ASPECT } from "../../../src/game/sim/matchCamera";
import { FROZEN_THRONE_STAGE } from "../../../src/game/sim/stage";
import { runProcess } from "../../hostProcess";
import { type MoveScore, THRESHOLDS, scoreMove } from "../animScore";
import { type Look, type SampledMove, loadBody, sampleFighter } from "../animScoreSample";
import { assetsView, readManifest } from "../buildInputs";
import { headlessRender } from "../headlessRender";
import { projectRoot } from "../project";
import { createStandaloneSession, NEUTRAL_INPUT } from "../standalone";

const SCORE_DIRECTORY = join(projectRoot, "tools/move-data/anim-score");
const JUDGE_FILE = join(SCORE_DIRECTORY, "judge.jsonl");
const REFERENCE_STORE = join(homedir(), ".local/share/smashcraft-animation-reference");
const REFERENCE_DIRECTORY = join(REFERENCE_STORE, "scorecard-references");
const REFERENCE_MANIFEST = join(REFERENCE_DIRECTORY, "manifest.json");

/**
 * The Melee fighter each fighter's moves are read against: the timing
 * reference (smashcraft:references/melee-frame-data/) and the judge's
 * side-by-side. A starting choice by build and weapon; Tom tunes it.
 */
export const REFERENCE_FIGHTERS: Readonly<Record<string, string>> = {
  rifleman: "falco", illidan: "captain_falcon", blademaster: "marth", "mountain-king": "donkey_kong", warden: "sheik",
  lich: "mewtwo", "forsaken-paladin": "roy", dreadlord: "ganondorf", "shadow-hunter": "link", "pit-lord": "bowser",
  beastmaster: "link", "lich-king": "ganondorf", thrall: "bowser", "jaina-proudmoore": "zelda", "sylvanas-windrunner": "young_link", "cairne-bloodhoof": "donkey_kong",
  "chen-stormstout": "captain_falcon", peon: "ness", "goblin-tinker": "samus", "kael'thas-sunstrider": "zelda", murloc: "kirby", "grom-hellscream": "roy", kobold: "young_link",
  "malfurion-stormrage": "link", medivh: "mewtwo", "anub'arak": "bowser",
};
/** Each scored move's Melee action (records.jsonl) and SmashWiki hitbox-animation name. */
export const REFERENCE_ACTIONS: Readonly<Record<string, { readonly action: string; readonly wiki: string }>> = {
  jab: { action: "jab1", wiki: "jab" }, jab2: { action: "jab2", wiki: "jab" }, jab3: { action: "jab2", wiki: "jab" },
  "forward-tilt": { action: "ftilt", wiki: "forward tilt" }, "forward-tilt-up": { action: "ftilt", wiki: "forward tilt" }, "forward-tilt-down": { action: "ftilt", wiki: "forward tilt" },
  "up-tilt": { action: "utilt", wiki: "up tilt" }, "down-tilt": { action: "dtilt", wiki: "down tilt" }, "dash-attack": { action: "dattack", wiki: "dash attack" },
  "forward-smash": { action: "fsmash", wiki: "forward smash" }, "up-smash": { action: "usmash", wiki: "up smash" }, "down-smash": { action: "dsmash", wiki: "down smash" },
  "neutral-air": { action: "nair", wiki: "neutral aerial" }, "forward-air": { action: "fair", wiki: "forward aerial" }, "back-air": { action: "bair", wiki: "back aerial" },
  "up-air": { action: "uair", wiki: "up aerial" }, "down-air": { action: "dair", wiki: "down aerial" },
  "neutral-special": { action: "neutral_b", wiki: "neutral special" }, "side-special": { action: "side_b", wiki: "side special" },
  "up-special": { action: "up_b", wiki: "up special" }, "down-special": { action: "down_b", wiki: "down special" },
};

class AnimFailure extends Schema.TaggedError<AnimFailure>()("AnimFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}
const attempt = <A>(problem: string, run: () => Promise<A> | A) =>
  Effect.tryPromise({ try: async () => run(), catch: (cause) => new AnimFailure({ problem: `${problem}: ${cause instanceof Error ? cause.message : String(cause)}` }) });

const JudgeLine = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 }));
export const JudgeScore = Schema.Struct({
  look: Schema.Literals(["classic", "definitive"]), fighter: Schema.NonEmptyString, move: Schema.NonEmptyString, judge: Schema.NonEmptyString,
  readability: JudgeLine, weight: JudgeLine, anticipation: JudgeLine, followThrough: JudgeLine, character: JudgeLine, note: Schema.String,
});
export type JudgeScore = typeof JudgeScore.Type;
const JUDGE_LINES = ["readability", "weight", "anticipation", "followThrough", "character"] as const;
/** A move passes line 5 at 4 or higher on every judged line (#367). */
export const JUDGE_PASS = 4;

const MeleeRecord = Schema.Struct({ character: Schema.String, action: Schema.NullOr(Schema.String), values: Schema.Struct({ start: Schema.optional(Schema.NullOr(Schema.Finite)), total: Schema.optional(Schema.NullOr(Schema.Finite)) }) });

const decodeLines = <S extends Schema.Top>(schema: S, path: string) => attempt(`read ${path}`, async () => (await Bun.file(path).exists()) ? (await Bun.file(path).text()).split("\n").filter((line) => line.trim() !== "") : []).pipe(
  Effect.flatMap((lines) => Effect.forEach(lines, (line) => Schema.decodeEffect(Schema.fromJsonString(schema))(line).pipe(Effect.mapError((cause) => new AnimFailure({ problem: `${path}: ${cause.message}` }))))));

/** Melee's first active frame and total for a fighter's move, one-based, as the reference records give them. */
const meleeTiming = (records: readonly (typeof MeleeRecord.Type)[], fighter: string, move: string) => {
  const action = REFERENCE_ACTIONS[move]?.action, character = REFERENCE_FIGHTERS[fighter];
  const found = records.find((record) => record.character === character && record.action === action);
  return found === undefined ? undefined : { character: found.character, action: found.action, start: found.values.start ?? null, total: found.values.total ?? null };
};

interface Row {
  readonly fighter: string;
  readonly move: string;
  readonly moveClass: string;
  readonly score: MoveScore;
  readonly frames: { readonly firstActive: number; readonly lastActive: number; readonly end: number };
  readonly judged: { readonly count: number; readonly lowest: number; readonly means: readonly number[] } | undefined;
  readonly reference: ReturnType<typeof meleeTiming>;
}

const passCount = (row: Row) => [row.score.line1.pass, row.score.line2.pass, row.score.line3.pass, row.score.line4.pass].filter(Boolean).length
  + (row.judged !== undefined && row.judged.lowest >= JUDGE_PASS ? 1 : 0);
const lines = (row: Row) => row.judged === undefined ? 4 : 5;
/** Worst first: most failed lines, then the largest measured shortfall. */
const worstFirst = (a: Row, b: Row) => (lines(b) - passCount(b)) - (lines(a) - passCount(a)) || b.score.shortfall - a.score.shortfall || a.fighter.localeCompare(b.fighter) || a.move.localeCompare(b.move);
const mark = (pass: boolean) => (pass ? "pass" : "FAIL");
const n = (value: number) => value.toFixed(2);

const HEADER = ["fighter", "move", "class", "passed", "shortfall", "L1", "body share", "mass shift", "limb", "L2", "end error", "jump", "overshoot", "L3", "windup", "peak", "settle", "fill", "first active", "last active", "end", "L4", "contrast", "IoU windup/contact", "IoU contact/recovery", "L5", "judges", "lowest", "readability", "weight", "anticipation", "follow-through", "character", "Melee reference", "ref start", "ref total"];
function tsvRow(row: Row): string {
  const { line1, line2, line3, line4 } = row.score, j = row.judged;
  return [row.fighter, row.move, row.moveClass, `${passCount(row)}/${lines(row)}`, n(row.score.shortfall),
    mark(line1.pass), n(line1.bodyShare), n(line1.massShift), line1.limb,
    mark(line2.pass), n(line2.endError), n(line2.jump), n(line2.overshoot),
    mark(line3.pass), line3.windup, line3.peak, line3.settle, n(line3.fill), row.frames.firstActive, row.frames.lastActive, row.frames.end,
    mark(line4.pass), n(line4.contrast), n(line4.windupContact), n(line4.contactRecovery),
    j === undefined ? "unjudged" : mark(j.lowest >= JUDGE_PASS), j?.count ?? 0, j === undefined ? "" : n(j.lowest), ...JUDGE_LINES.map((_, index) => j === undefined ? "" : n(j.means[index] ?? 0)),
    row.reference === undefined ? "" : `${row.reference.character} ${row.reference.action}`, row.reference?.start ?? "", row.reference?.total ?? ""].join("\t");
}

const parseFlags = (args: readonly string[], allowed: readonly string[]) => {
  const flags = new Map<string, string[]>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index], value = args[index + 1];
    if (flag === undefined || !allowed.includes(flag) || value === undefined) return undefined;
    flags.set(flag, [...(flags.get(flag) ?? []), value]);
  }
  return flags;
};

const selectFighters = (names: readonly string[] | undefined) => Effect.gen(function*() {
  if (names === undefined) return SELECTABLE_CHARACTERS;
  const chosen = names.map((name) => SELECTABLE_CHARACTERS.find((character) => fighterSlug(character) === name.toLowerCase() || fighterName(character).toLowerCase() === name.toLowerCase()));
  const missing = names.filter((_, index) => chosen[index] === undefined);
  if (missing.length > 0) return yield* new UsageFailure({ problem: `no fighter named ${missing.join(", ")}; use a slug such as ${fighterSlug(SELECTABLE_CHARACTERS[0] ?? 1)}` });
  return chosen.flatMap((character) => (character === undefined ? [] : [character]));
});

/** Every scored row for the chosen fighters and look, with stored judgements. */
const measure = (fighters: readonly Character[], look: Look, assets: string) => Effect.gen(function*() {
  const judged = yield* decodeLines(JudgeScore, JUDGE_FILE);
  const records = yield* decodeLines(MeleeRecord, join(projectRoot, "references/melee-frame-data/records.jsonl"));
  const rows: Row[] = [];
  const samples = new Map<string, SampledMove>();
  for (const character of fighters) {
    const fighter = fighterSlug(character);
    const moves = yield* attempt(`sample ${fighter}`, async () => sampleFighter(await loadBody(assets, character, look), character));
    for (const sampled of moves) {
      const { sample } = sampled;
      const score = yield* Effect.try({ try: () => scoreMove(sample, THRESHOLDS[sample.moveClass]), catch: (cause) => new AnimFailure({ problem: `${fighter} ${sampled.move}: ${String(cause)}` }) });
      const own = judged.filter((entry) => entry.look === look && entry.fighter === fighter && entry.move === sampled.move);
      const means = JUDGE_LINES.map((line) => own.reduce((sum, entry) => sum + entry[line], 0) / Math.max(1, own.length));
      rows.push({
        fighter, move: sampled.move, moveClass: sample.moveClass, score,
        frames: { firstActive: sample.firstActive, lastActive: sample.lastActive, end: sampled.endFrame },
        judged: own.length === 0 ? undefined : { count: own.length, lowest: Math.min(...means), means },
        reference: meleeTiming(records, fighter, sampled.move),
      });
      samples.set(`${fighter}/${sampled.move}`, sampled);
    }
  }
  return { rows, samples };
});

const score: Command = (args) => Effect.gen(function*() {
  const flags = parseFlags(args, ["--fighter", "--graphics", "--assets"]);
  const look = flags?.get("--graphics")?.[0] ?? "classic";
  if (flags === undefined || (look !== "classic" && look !== "definitive")) return yield* new UsageFailure({ problem: "anim score [--fighter F]... [--graphics classic|definitive] [--assets DIR]" });
  const fighters = yield* selectFighters(flags.get("--fighter"));
  const assets = flags.get("--assets")?.[0] ?? assetsView(yield* readManifest());
  const { rows } = yield* measure(fighters, look, assets);
  // A partial run replaces only its fighters' rows in the stored table.
  const table = join(SCORE_DIRECTORY, `${look}.tsv`);
  const kept = yield* attempt(`read ${table}`, async () => (await Bun.file(table).exists()) ? (await Bun.file(table).text()).trim().split("\n").slice(1) : []);
  const chosen = new Set(fighters.map(fighterSlug));
  const others = flags.has("--fighter") ? kept.filter((line) => !chosen.has(line.split("\t")[0] ?? "")) : [];
  const sorted = [...rows].sort(worstFirst);
  yield* attempt(`write ${table}`, async () => {
    mkdirSync(SCORE_DIRECTORY, { recursive: true });
    const lines = [...others, ...sorted.map(tsvRow)].sort((a, b) => a.localeCompare(b));
    await Bun.write(table, `${HEADER.join("\t")}\n${lines.join("\n")}\n`);
  });
  yield* Console.log(`worst first (${look}; L1 body, L2 return to ready, L3 phases, L4 contrast, L5 judged):`);
  for (const row of sorted.slice(0, 40)) {
    const { line1, line2, line3, line4 } = row.score;
    yield* Console.log(`${String(passCount(row)).padStart(1)}/${lines(row)} ${`${row.fighter} ${row.move}`.padEnd(34)} L1 ${mark(line1.pass)} ${n(line1.bodyShare)}/${n(line1.massShift)}  L2 ${mark(line2.pass)} ${n(line2.endError)}/${n(line2.jump)}/${n(line2.overshoot)}  L3 ${mark(line3.pass)} w${line3.windup} p${line3.peak} a${row.frames.firstActive} fill ${n(line3.fill)}  L4 ${mark(line4.pass)} ${n(line4.contrast)}  L5 ${row.judged === undefined ? "unjudged" : `${mark(row.judged.lowest >= JUDGE_PASS)} ${n(row.judged.lowest)}`}`);
  }
  const fighterRows = new Map<string, Row[]>();
  for (const row of rows) fighterRows.set(row.fighter, [...(fighterRows.get(row.fighter) ?? []), row]);
  yield* Console.log("\nper fighter (moves passing every measured line; each line's passes):");
  for (const [fighter, own] of fighterRows) {
    const count = (pick: (row: Row) => boolean) => own.filter(pick).length;
    yield* Console.log(`${fighter.padEnd(18)} ${count((row) => row.score.line1.pass && row.score.line2.pass && row.score.line3.pass && row.score.line4.pass)}/${own.length} all  L1 ${count((row) => row.score.line1.pass)}  L2 ${count((row) => row.score.line2.pass)}  L3 ${count((row) => row.score.line3.pass)}  L4 ${count((row) => row.score.line4.pass)}  L5 ${count((row) => row.judged !== undefined && row.judged.lowest >= JUDGE_PASS)}/${count((row) => row.judged !== undefined)} judged`);
  }
  yield* Console.log(`${rows.length} rows; ${relative(projectRoot, table)}`);
}).pipe(Effect.provide(BunServices.layer));

/** Moves per judge batch: one fresh judge reads one batch. */
const JUDGE_BATCH = 6;

/** Frames a judge sees: start, windup extreme, contact, last active, recovery key, end. */
const keyFrames = (row: Row) => [...new Set([0, row.score.keys.windup, row.score.keys.contact, row.frames.lastActive, row.score.keys.recovery, row.frames.end])].sort((a, b) => a - b);

const ReferenceEntry = Schema.Struct({ file: Schema.String, source: Schema.String, character: Schema.String, move: Schema.String });
const ReferenceManifest = Schema.fromJsonString(Schema.Record(Schema.String, ReferenceEntry));
const readReferences = attempt(`read ${REFERENCE_MANIFEST}`, async () => (await Bun.file(REFERENCE_MANIFEST).exists()) ? await Bun.file(REFERENCE_MANIFEST).text() : "{}").pipe(
  Effect.flatMap(Schema.decodeEffect(ReferenceManifest)), Effect.mapError((cause) => new AnimFailure({ problem: `reference manifest: ${cause.message}` })));

/** The fighter's own reference move, else the same move from the best-covered reference fighters. */
const referenceFor = (references: Readonly<Record<string, typeof ReferenceEntry.Type>>, fighter: string, move: string) =>
  [REFERENCE_FIGHTERS[fighter] ?? "", "falco", "marth", "sheik", ...Object.values(REFERENCE_FIGHTERS)].map((character) => references[`${character}/${move}`]).find((entry) => entry !== undefined);

const WikiImages = Schema.fromJsonString(Schema.Struct({ continue: Schema.optional(Schema.Struct({ aicontinue: Schema.String })), query: Schema.Struct({ allimages: Schema.Array(Schema.Struct({ name: Schema.String, url: Schema.String })) }) }));
const wikiName = (character: string) => character.split("_").map((part) => part === "&" ? part : part.charAt(0).toUpperCase() + part.slice(1)).join("_").replace("Mr._game_&_watch", "Mr._Game_&_Watch");
const httpGet = (url: string) => attempt(`fetch ${url}`, async () => {
  const response = await fetch(url, { headers: { "user-agent": "smashcraft-animation-scorecard (private reference study)" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
});

/** Downloads each reference fighter's Melee hitbox animations from SmashWiki into the private reference store. */
const fetchReferences = Effect.gen(function*() {
  const manifest: Record<string, typeof ReferenceEntry.Type> = { ...(yield* readReferences) };
  const characters = [...new Set(Object.values(REFERENCE_FIGHTERS))];
  for (const character of characters) {
    const prefix = `${wikiName(character)}_`;
    const images: { name: string; url: string }[] = [];
    let from: string | undefined;
    do {
      const query = `https://www.ssbwiki.com/api.php?action=query&list=allimages&aiprefix=${encodeURIComponent(prefix)}&ailimit=500&aiprop=url&format=json${from === undefined ? "" : `&aicontinue=${encodeURIComponent(from)}`}`;
      const text = yield* httpGet(query).pipe(Effect.flatMap((response) => attempt("read the image list", () => response.text())));
      const page = yield* Schema.decodeEffect(WikiImages)(text).pipe(Effect.mapError((cause) => new AnimFailure({ problem: `SmashWiki image list: ${cause.message}` })));
      images.push(...page.query.allimages);
      from = page.continue?.aicontinue;
    } while (from !== undefined);
    const hitboxes = images.filter((image) => /_Hitbox(_[A-Za-z0-9]+)*_Melee\.gif$/i.test(image.name));
    for (const [move, { wiki }] of Object.entries(REFERENCE_ACTIONS)) {
      const key = `${character}/${move}`;
      if (manifest[key] !== undefined && existsSync(join(REFERENCE_DIRECTORY, manifest[key].file))) continue;
      const words = wiki.split(" ");
      const named = (image: { name: string }) => image.name.slice(prefix.length).toLowerCase().replace(/_hitbox.*$/, "").split(/[_ ]+/);
      const candidates = hitboxes.filter((image) => { const parts = named(image); return words.every((word) => parts.includes(word)) && !parts.includes("aerial") === !words.includes("aerial"); })
        .sort((a, b) => named(a).length - named(b).length || a.name.localeCompare(b.name));
      const image = candidates[0];
      if (image === undefined) { yield* Console.log(`no SmashWiki hitbox animation for ${key}`); continue; }
      const file = join(character, image.name);
      if (!existsSync(join(REFERENCE_DIRECTORY, file))) {
        const bytes = yield* httpGet(image.url).pipe(Effect.flatMap((response) => attempt("read the image", () => response.arrayBuffer())));
        yield* attempt(`write ${file}`, () => Bun.write(join(REFERENCE_DIRECTORY, file), bytes));
      }
      manifest[key] = { file, source: image.url, character, move };
      yield* Console.log(`${key}: ${image.name}`);
    }
  }
  yield* attempt("write the manifest", async () => {
    mkdirSync(REFERENCE_DIRECTORY, { recursive: true });
    await Bun.write(REFERENCE_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    await Bun.write(join(REFERENCE_DIRECTORY, "rights.json"), `${JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), owner: "Nintendo game imagery / SmashWiki host", rights: "copyrighted reference only; private study, never committed or redistributed", use: "line 5 of the animation scorecard (#367): side-by-side judging only" }, null, 2)}\n`);
  });
  yield* Console.log(`${Object.keys(manifest).length} references in ${REFERENCE_DIRECTORY}`);
});

/** Renders each chosen move's key frames at gameplay zoom beside its reference and writes the judges' batch. */
const prepare = (args: readonly string[]) => Effect.gen(function*() {
  const flags = parseFlags(args, ["--fighter", "--move", "--graphics", "--out", "--assets"]);
  const out = flags?.get("--out")?.[0], look = flags?.get("--graphics")?.[0] ?? "classic";
  if (flags === undefined || out === undefined || (look !== "classic" && look !== "definitive")) return yield* new UsageFailure({ problem: "anim judge prepare --out PRIVATE_DIR [--fighter F]... [--move FIGHTER:MOVE]... [--graphics classic|definitive]" });
  const output = resolve(out);
  if (!relative(projectRoot, output).startsWith("..")) return yield* new UsageFailure({ problem: "judge renders stay outside the repository (their references are private)" });
  const wanted = flags.get("--move");
  const fighters = yield* selectFighters(flags.get("--fighter") ?? (wanted === undefined ? undefined : [...new Set(wanted.map((move) => move.split(":")[0] ?? ""))]));
  const assets = flags.get("--assets")?.[0] ?? assetsView(yield* readManifest());
  const { rows, samples } = yield* measure(fighters, look, assets);
  const chosen = rows.filter((row) => wanted === undefined || wanted.includes(`${row.fighter}:${row.move}`));
  if (chosen.length === 0) return yield* new UsageFailure({ problem: "no scored move matches" });
  const references = yield* readReferences;
  // One match's scene supplies the camera, light and sky; each frame draws only the fighter's body.
  const session = yield* Effect.acquireRelease(attempt("start the scene session", () => createStandaloneSession({ presentation: "pool-confirmed", script: "#! chat -dev quick" })), (open) => Effect.sync(() => open.close()));
  for (let frame = 0; frame < 60; frame++) session.step(NEUTRAL_INPUT);
  const base = captureScene(session.client, { visibleOnly: true });
  const bodyEffect = base.effects.find((effect) => /TimelineBody/.test(effect.model)) ?? base.effects[0];
  if (bodyEffect === undefined) return yield* new AnimFailure({ problem: "the sample scene has no fighter body to render" });
  const camera = createMatchCamera();
  extremeCamera(camera, FROZEN_THRONE_STAGE, MATCH_CAMERA_ASPECT, "far");
  const scenes: RenderScene[] = [];
  const frameIds = new Map<string, number[]>();
  for (const row of chosen) {
    const character = SELECTABLE_CHARACTERS.find((candidate) => fighterSlug(candidate) === row.fighter) ?? 0;
    const clip = originalClip(character, 0), sampled = samples.get(`${row.fighter}/${row.move}`);
    if (clip === undefined || sampled === undefined) continue;
    const ids: number[] = [];
    for (const index of keyFrames(row)) {
      const frame = sampled.sample.frames[index];
      if (frame === undefined) continue;
      const id = scenes.length;
      ids.push(id);
      const z = FLOOR_HEIGHT + (sampled.heights[index] ?? 0);
      scenes.push({
        ...base, frame: id, units: [], ui: [], textTags: [],
        camera: { ...base.camera, x: 0, y: 0, fields: { ...base.camera.fields, CAMERA_FIELD_TARGET_DISTANCE: camera.distance, CAMERA_FIELD_ZOFFSET: z + 90, CAMERA_FIELD_FIELD_OF_VIEW: cameraFieldOfView(camera, MATCH_CAMERA_ASPECT) } },
        effects: [{ ...bodyEffect, model: clip.modelPath, animation: "Stand", animationElapsed: sampled.seconds[index] ?? 0, animationClock: 0, timeScale: 0, x: 0, y: 0, z, yaw: 0, teamColor: 0, alpha: 255 }],
      });
    }
    frameIds.set(`${row.fighter}/${row.move}`, ids);
  }
  const project = { ...headlessRender({ assets }), width: 1920, height: 1080 };
  yield* renderScenes(project, scenes, join(output, "frames"), look);
  const batches: string[][] = [];
  const size = JUDGE_BATCH;
  for (const row of chosen) {
    const key = `${row.fighter}/${row.move}`;
    const ids = frameIds.get(key) ?? [];
    const crops = ids.map((id) => join(output, "frames", `p${base.client}-frame-${id}.png`));
    const ours = join(output, "moves", `${row.fighter}-${row.move}-ours.png`);
    mkdirSync(join(output, "moves"), { recursive: true });
    // 480x360 around the fighter at the far camera's native pixels: gameplay zoom, uncropped by scaling.
    yield* runProcess(ChildProcess.make("magick", [...crops.flatMap((crop) => ["(", crop, "-gravity", "center", "-crop", "480x360+0-60", "+repage", ")"]), "+append", ours]));
    const reference = referenceFor(references, row.fighter, row.move);
    const side = join(output, "moves", `${row.fighter}-${row.move}.png`);
    if (reference !== undefined) {
      const strip = join(output, "moves", `${row.fighter}-${row.move}-reference.png`);
      const gif = join(REFERENCE_DIRECTORY, reference.file);
      const count = Number((yield* runProcess(ChildProcess.make("magick", ["identify", "-format", "%n\n", gif]))).split("\n")[0] ?? 1);
      const picks = Array.from({ length: Math.min(8, count) }, (_, index) => Math.round(index * (count - 1) / Math.max(1, Math.min(8, count) - 1)));
      yield* runProcess(ChildProcess.make("magick", [`${gif}[${picks.join(",")}]`, "-coalesce", "-resize", "x360", "+append", strip]));
      yield* runProcess(ChildProcess.make("magick", [ours, strip, "-gravity", "west", "-background", "#101522", "-append", side]));
    } else yield* runProcess(ChildProcess.make("magick", [ours, side]));
    const batch = batches.at(-1);
    if (batch === undefined || batch.length >= size) batches.push([key]); else batch.push(key);
  }
  const brief = yield* attempt("read the judge brief", () => Bun.file(join(projectRoot, "docs/animation-judge-brief.md")).text());
  for (const [index, batch] of batches.entries()) {
    const items = batch.map((key) => {
      const row = chosen.find((candidate) => `${candidate.fighter}/${candidate.move}` === key);
      const reference = referenceFor(references, row?.fighter ?? "", row?.move ?? "");
      const [fighter = "", move = ""] = key.split("/");
      return `- ${fighterName(SELECTABLE_CHARACTERS.find((candidate) => fighterSlug(candidate) === fighter) ?? 0)} (\`${fighter}\`), \`${move}\`: ${join(output, "moves", `${fighter}-${move}.png`)}\n  Top row, ours: frames ${row === undefined ? "" : keyFrames(row).join(", ")} (start, windup, contact on the first active frame ${row?.frames.firstActive}, last active, recovery, end of ${row?.frames.end}). Bottom row: ${reference === undefined ? "no reference animation on file; judge against the brief's standard" : `Melee ${reference.character.replaceAll("_", " ")}'s ${REFERENCE_ACTIONS[move]?.wiki} (hitbox view)`}.`;
    });
    const file = join(output, `batch-${index + 1}.md`);
    yield* attempt(`write ${file}`, () => Bun.write(file, `${brief}\n\n## Your moves (look: ${look})\n\n${items.join("\n")}\n\nWrite your scores to ${join(output, `scores-${index + 1}.jsonl`)}, one JSON line per move.\n`));
  }
  yield* Console.log(`${chosen.length} moves in ${batches.length} batches: ${output}/batch-N.md; record with: bun wisp anim judge record ${output}/scores-*.jsonl`);
}).pipe(Effect.scoped, Effect.provide(BunServices.layer));

/** Validates judges' score files and appends them to the stored judgements. */
const record = (files: readonly string[]) => Effect.gen(function*() {
  if (files.length === 0) return yield* new UsageFailure({ problem: "anim judge record SCORES.jsonl..." });
  const entries: JudgeScore[] = [];
  for (const file of files) entries.push(...(yield* decodeLines(JudgeScore, file)));
  const known = new Set(SELECTABLE_CHARACTERS.map(fighterSlug));
  const unknown = entries.filter((entry) => !known.has(entry.fighter) || REFERENCE_ACTIONS[entry.move] === undefined);
  if (unknown.length > 0) return yield* new AnimFailure({ problem: `unknown fighter or move: ${unknown.map((entry) => `${entry.fighter}/${entry.move}`).join(", ")}` });
  const old = yield* decodeLines(JudgeScore, JUDGE_FILE);
  const seen = new Set(old.map((entry) => `${entry.look}/${entry.fighter}/${entry.move}/${entry.judge}`));
  const added = entries.filter((entry) => !seen.has(`${entry.look}/${entry.fighter}/${entry.move}/${entry.judge}`));
  yield* attempt(`write ${JUDGE_FILE}`, async () => {
    mkdirSync(SCORE_DIRECTORY, { recursive: true });
    const text = (await Bun.file(JUDGE_FILE).exists()) ? await Bun.file(JUDGE_FILE).text() : "";
    await Bun.write(JUDGE_FILE, text + added.map((entry) => `${JSON.stringify(entry)}\n`).join(""));
  });
  yield* Console.log(`${added.length} judgements recorded (${entries.length - added.length} already stored); ${relative(projectRoot, JUDGE_FILE)}`);
}).pipe(Effect.provide(BunServices.layer));

export const anim: Command = ([mode, verb, ...rest]) => {
  if (mode === "score") return score(verb === undefined ? [] : [verb, ...rest]);
  if (mode === "judge" && verb === "fetch") return fetchReferences.pipe(Effect.provide(BunServices.layer));
  if (mode === "judge" && verb === "prepare") return prepare(rest);
  if (mode === "judge" && verb === "record") return record(rest);
  return Effect.fail(new UsageFailure({ problem: "anim score [--fighter F]... [--graphics classic|definitive] | anim judge fetch | anim judge prepare --out PRIVATE_DIR [--fighter F]... [--move FIGHTER:MOVE]... | anim judge record SCORES.jsonl..." }));
};
