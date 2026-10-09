import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { HERO_ROSTER } from "../../src/game/sim/heroes/registry";
import { FIGHTER_OBJECTS } from "../../src/game/objectData";
import { PLAYABLE_BOUNDS, WORLD_BOUNDS } from "../../src/game/presentation/arenaCamera";
import { heroModelSource, importedModelFile } from "../heroModelSource";
import { INPUTS_STORE, assetsView, readManifest } from "./buildInputs";
import { importedAssets } from "./mapInputs";
import { runProcess } from "../hostProcess";
import { POST_PROCESSING_FILE } from "../postProcessing";
import { resolveRenderAsset, type AssetLocation, type AssetLayer, type Graphics, type ResolvedRenderAsset } from "wisp/scripts/wisp/renderAssets";

const key = (path: string) => path.replaceAll("\\", "/").toLowerCase().replace(/\.mdl$/, ".mdx");
const PRIVATE = join(homedir(), ".local/share/smashcraft-render-assets");

/** A map asset the renderer asked for couldn't be read, extracted or converted. */
class RenderAssetFailure extends Schema.TaggedError<RenderAssetFailure>()("RenderAssetFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

export interface RenderAssetOptions {
  readonly assets?: string;
  readonly imports?: readonly { readonly entry: string; readonly source: string }[];
  readonly extractor?: string;
  readonly storage?: string;
  readonly textures?: string;
  readonly cache?: string;
  readonly manifest?: string;
}

/** The map's imports and selected stock layers. Extraction stays outside the checkout. */
export function headlessRender(options: RenderAssetOptions = {}) {
  const storage = options.storage ?? process.env.WC3_STORAGE ?? join(homedir(), ".local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/Program Files (x86)/Warcraft III");
  const manifestPath = options.manifest ?? process.env.WC3_ASSET_MANIFEST;
  const used = new Map<string, { readonly sha256: string; readonly bytes: number }>();
  let stockInfo: { readonly storage: string; readonly buildInfoSha256: string; readonly fields: Readonly<Record<string, string>> } | undefined;
  const attempt = <A>(operation: string, run: () => A | Promise<A>) =>
    Effect.tryPromise({ try: async () => run(), catch: (cause) => new RenderAssetFailure({ problem: `${operation}: ${cause instanceof Error ? cause.message : String(cause)}` }) });
  // Both run once per renderer, whichever asset asks first.
  const stockCache = Effect.runSync(Effect.cached(attempt("read the stock build info", async () => {
    const info = await Bun.file(join(storage, ".build.info")).text();
    const lines = info.trim().split(/\r?\n/), headers = (lines[0] ?? "").split("|").map((name) => name.split("!")[0] ?? name);
    const rows = lines.slice(1).map((line) => Object.fromEntries(line.split("|").map((value, index) => [headers[index] ?? String(index), value])));
    stockInfo = { storage, buildInfoSha256: createHash("sha256").update(info).digest("hex"), fields: rows.find((row) => row.Active === "1") ?? rows[0] ?? {} };
    const directory = join(options.cache ?? PRIVATE, "stock", stockInfo.buildInfoSha256);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "build-info.json"), JSON.stringify(stockInfo, null, 2) + "\n");
    return directory;
  })));
  const sources = Effect.runSync(Effect.cached(Effect.gen(function*() {
    const manifest = yield* readManifest();
    const assets = options.assets ?? assetsView(manifest);
    const imports = options.imports ?? (yield* importedAssets(assets, join(INPUTS_STORE, "summon", manifest.summon)));
    const paths = new Map(imports.map(({ entry, source }) => [key(entry), source]));
    for (const { presentation } of HERO_ROSTER) {
      if (paths.has(key(presentation.model))) continue;
      paths.set(key(presentation.model), join(assets, heroModelSource(presentation.model)));
      if (importedModelFile(presentation.model) === undefined) stockFallback.add(key(presentation.model));
    }
    return paths;
  }).pipe(Effect.mapError((cause) => cause instanceof RenderAssetFailure ? cause : new RenderAssetFailure({ problem: `read the map's imports: ${cause.message}` })))));
  // Copies of stock Classic heroes are fallbacks; they must not override a player's stock art layer.
  const stockFallback = new Set<string>();
  let extractedTextures: Map<string, string> | undefined;
  const pending = new Map<string, Promise<ResolvedRenderAsset>>();
  const read = (path: string) => attempt(`read ${path}`, async () => {
    const file = Bun.file(path);
    return await file.exists() ? file.bytes() : undefined;
  });
  const convertTexture = (source: string, target: string) => Effect.gen(function*() {
    const converter = Bun.which("magick") ?? Bun.which("convert");
    if (converter === null) return yield* new RenderAssetFailure({ problem: "textures need ImageMagick installed (magick or convert)" });
    yield* runProcess(ChildProcess.make(converter, [`${source}[0]`, target], { stdin: "ignore" })).pipe(
      Effect.mapError((failure) => new RenderAssetFailure({ problem: `cannot convert texture ${source}: ${failure.problem}` })));
  });
  // The stock extractor can exit 0 without writing a missing asset.
  const succeeds = (program: string, args: readonly string[]) =>
    runProcess(ChildProcess.make(program, args, { stdin: "ignore" })).pipe(
      Effect.flatMap(() => {
        const output = args.at(-1);
        return output === undefined ? Effect.succeed(false) : read(output).pipe(Effect.map((bytes) => bytes !== undefined && bytes.length > 0));
      }),
      Effect.catchTag("ProcessFailure", () => Effect.succeed(false)));
  /** A stock art layer; DDS textures are converted to PNG in private storage. */
  const stockLayer = (normalized: string, layer: AssetLayer) => Effect.gen(function*() {
    const directory = join(yield* stockCache, layer);
    const texture = /\.(blp|tga|png|dds|tif)$/.test(normalized);
    const target = texture ? normalized.replace(/\.[^.]+$/, ".png") : normalized;
    const cached = yield* read(join(directory, target));
    if (cached !== undefined) return cached;
    const extractor = options.extractor ?? process.env.CASC_EXTRACTOR ?? Bun.which("casc-extract")
      ?? Array.from(new Bun.Glob("*/build/animation-assets/casc-extract").scanSync({ cwd: dirname(INPUTS_STORE), absolute: true }))[0];
    if (extractor === null || extractor === undefined) return yield* new RenderAssetFailure({ problem: `stock asset ${normalized} needs CASC_EXTRACTOR (tools/animations/extract.sh builds it)` });
    mkdirSync(dirname(join(directory, target)), { recursive: true });
    if (!texture) return (yield* succeeds(extractor, [storage, `war3.w3mod:${layer}:${normalized}`, join(directory, target)])) ? yield* read(join(directory, target)) : undefined;
    const dds = join(directory, normalized.replace(/\.[^.]+$/, ".dds"));
    if (!(yield* succeeds(extractor, [storage, `war3.w3mod:${layer}:${normalized.replace(/\.[^.]+$/, ".dds")}`, dds]))) {
      const blp = join(directory, normalized.replace(/\.[^.]+$/, ".blp"));
      return (yield* succeeds(extractor, [storage, `war3.w3mod:${layer}:${normalized.replace(/\.[^.]+$/, ".blp")}`, blp])) ? yield* read(blp) : undefined;
    }
    yield* convertTexture(dds, join(directory, target));
    return yield* read(join(directory, target));
  });
  const stockClassic = (path: string) => Effect.gen(function*() {
    const normalized = key(path);
    if (normalized.split("/").some((part) => part === "..") || normalized.startsWith("/")) return yield* new RenderAssetFailure({ problem: `invalid map asset path: ${path}` });
    const imported = yield* sources;
    const source = imported.get(normalized);
    if (source !== undefined) return yield* read(source);
    if (normalized.startsWith("war3mapimported/")) return undefined;
    const texture = /\.(blp|tga|png|dds|tif)$/.test(normalized);
    const pngName = normalized.replace(/\.[^.]+$/, ".png");
    const textures = options.textures ?? process.env.WC3_TEXTURES;
    if (texture && textures !== undefined) {
      extractedTextures ??= new Map(Array.from(new Bun.Glob("**/*.{png,blp,tga}").scanSync({ cwd: textures })).map((name) => [key(name), join(textures, name)]));
      const existingPath = extractedTextures.get(pngName) ?? extractedTextures.get(normalized);
      const existing = existingPath === undefined ? undefined : yield* read(existingPath);
      if (existing !== undefined) return existing;
    }
    const directory = yield* stockCache;
    const cache = join(directory, normalized);
    const cached = yield* read(cache);
    if (cached !== undefined) return cached;
    const extractor = options.extractor ?? process.env.CASC_EXTRACTOR ?? Bun.which("casc-extract")
      ?? Array.from(new Bun.Glob("*/build/animation-assets/casc-extract").scanSync({ cwd: dirname(INPUTS_STORE), absolute: true }))[0];
    if (extractor === null || extractor === undefined) return yield* new RenderAssetFailure({ problem: `stock asset ${path} needs CASC_EXTRACTOR (tools/animations/extract.sh builds it)` });
    mkdirSync(dirname(cache), { recursive: true });
    if (yield* succeeds(extractor, [storage, `war3.w3mod:${normalized}`, cache])) return yield* read(cache);
    if (/\.(flac|wav|ogg|mp3)$/.test(normalized)) {
      return (yield* succeeds(extractor, [storage, `war3.w3mod:_locales/enus.w3mod:${normalized}`, cache])) ? yield* read(cache) : undefined;
    }
    if (!texture) return undefined;
    const png = join(directory, pngName);
    const oldPng = yield* read(png);
    if (oldPng !== undefined) return oldPng;
    const dds = cache.replace(/\.[^.]+$/, ".dds");
    if (!(yield* succeeds(extractor, [storage, `war3.w3mod:${normalized.replace(/\.[^.]+$/, ".dds")}`, dds]))) {
      const blp = cache.replace(/\.[^.]+$/, ".blp");
      return (yield* succeeds(extractor, [storage, `war3.w3mod:${normalized.replace(/\.[^.]+$/, ".blp")}`, blp])) ? yield* read(blp) : undefined;
    }
    yield* convertTexture(dds, png);
    return yield* read(png);
  });
  const resolveAsset = (path: string, graphics: Graphics = "classic", body?: AssetLocation): Promise<ResolvedRenderAsset> => {
    const normalized = `${graphics}:${body?.source ?? ""}:${body?.layer ?? ""}:${key(path)}`;
    let promise = pending.get(normalized);
    const resolveMap = (entry: string) => Effect.gen(function*() {
      const imported = yield* sources;
      const name = key(entry);
      // The map's generated post-processing file, which Definitive's ambient occlusion and bloom read.
      if (name === key(POST_PROCESSING_FILE.entry)) return POST_PROCESSING_FILE.contents;
      if (graphics !== "classic" && stockFallback.has(name)) return undefined;
      const source = imported.get(name);
      if (source === undefined) return undefined;
      const bytes = yield* read(source);
      if (bytes === undefined || !name.endsWith(".dds")) return bytes;
      const directory = join(options.cache ?? PRIVATE, "map-textures");
      const decoded = join(directory, `${createHash("sha256").update(bytes).digest("hex")}.png`);
      const cached = yield* read(decoded);
      if (cached !== undefined) return cached;
      mkdirSync(directory, { recursive: true });
      yield* convertTexture(source, decoded);
      return yield* read(decoded);
    });
    const readers = {
      map: (entry: string) => Effect.runPromise(resolveMap(entry).pipe(Effect.provide(BunServices.layer))),
      stock: (entry: string, layer: AssetLayer) => Effect.runPromise((layer === "base" ? stockClassic(entry) : stockLayer(key(entry), layer)).pipe(Effect.provide(BunServices.layer))),
    };
    if (promise === undefined) pending.set(normalized, promise = Effect.runPromise(resolveRenderAsset(readers, path, graphics, body)).then((result) => {
      const { bytes } = result;
      if (bytes !== undefined && manifestPath !== undefined) {
        used.set(normalized, { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
        mkdirSync(dirname(manifestPath), { recursive: true });
        writeFileSync(manifestPath, JSON.stringify({ stock: stockInfo, assets: Object.fromEntries(used) }, null, 2) + "\n");
      }
      return result;
    }));
    return promise;
  };
  return {
    unitModels: Object.fromEntries(Object.values(FIGHTER_OBJECTS).map(({ id, model }) => [id, model])),
    // Warcraft draws no effect outside the base map's world bounds (#297, #298); the headless world stands 0,0 on the playable centre.
    terrain: { bounds: { minX: WORLD_BOUNDS.left, maxX: WORLD_BOUNDS.right, minY: WORLD_BOUNDS.front, maxY: WORLD_BOUNDS.back }, origin: [0.0, PLAYABLE_BOUNDS.centreY] as const },
    resolveAsset,
    readAsset: (path: string, graphics: Graphics = "classic") => resolveAsset(path, graphics).then(({ bytes }) => bytes),
  };
}
