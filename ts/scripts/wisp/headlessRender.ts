import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { HERO_ROSTER } from "../../src/game/sim/heroes/registry";
import { FIGHTER_OBJECTS } from "../../src/game/objectData";
import { heroModelSource } from "../heroModelSource";
import { INPUTS_STORE, assetsView, readManifest } from "./buildInputs";
import { importedAssets } from "./mapInputs";
import { runProcess } from "../hostProcess";

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

/** The map's imports and classic stock assets. Extraction stays outside the checkout. */
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
      if (!paths.has(key(presentation.model))) paths.set(key(presentation.model), join(assets, heroModelSource(presentation.model)));
    }
    return paths;
  }).pipe(Effect.mapError((cause) => cause instanceof RenderAssetFailure ? cause : new RenderAssetFailure({ problem: `read the map's imports: ${cause.message}` })))));
  let extractedTextures: Map<string, string> | undefined;
  const pending = new Map<string, Promise<Uint8Array | undefined>>();
  const read = (path: string) => attempt(`read ${path}`, async () => {
    const file = Bun.file(path);
    return await file.exists() ? file.bytes() : undefined;
  });
  /** Runs a tool in its own scope: true when it exited 0. Interrupting the read stops it. */
  const succeeds = (program: string, args: readonly string[]) =>
    runProcess(ChildProcess.make(program, args, { stdin: "ignore" })).pipe(Effect.as(true), Effect.catchTag("ProcessFailure", () => Effect.succeed(false)));
  const resolve = (path: string) => Effect.gen(function*() {
    const normalized = key(path);
    if (normalized.split("/").some((part) => part === "..") || normalized.startsWith("/")) return yield* new RenderAssetFailure({ problem: `invalid map asset path: ${path}` });
    const source = (yield* sources).get(normalized);
    if (source !== undefined) return yield* read(source);
    if (normalized.startsWith("war3mapimported/")) return undefined;
    const texture = /\.(blp|tga|png|dds)$/.test(normalized);
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
    if (!(yield* succeeds(extractor, [storage, `war3.w3mod:${normalized.replace(/\.[^.]+$/, ".dds")}`, dds]))) return undefined;
    yield* runProcess(ChildProcess.make("magick", [`${dds}[0]`, png], { stdin: "ignore" })).pipe(
      Effect.mapError((failure) => new RenderAssetFailure({ problem: `cannot convert stock texture ${path}: ${failure.problem}` })));
    return yield* read(png);
  });
  return {
    unitModels: Object.fromEntries(Object.values(FIGHTER_OBJECTS).map(({ id, model }) => [id, model])),
    readAsset(path: string): Promise<Uint8Array | undefined> {
      const normalized = key(path);
      let promise = pending.get(normalized);
      // Wisp's renderer reads assets through promises: this is the one runtime boundary.
      if (promise === undefined) pending.set(normalized, promise = Effect.runPromise(resolve(path).pipe(Effect.provide(BunServices.layer))).then((bytes) => {
        if (bytes !== undefined && manifestPath !== undefined) {
          used.set(normalized, { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
          mkdirSync(dirname(manifestPath), { recursive: true });
          writeFileSync(manifestPath, JSON.stringify({ stock: stockInfo, assets: Object.fromEntries(used) }, null, 2) + "\n");
        }
        return bytes;
      }));
      return promise;
    },
  };
}
