import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { HERO_ROSTER } from "../../src/game/sim/heroes/registry";
import { FIGHTER_OBJECTS } from "../../src/game/objectData";
import { heroModelSource } from "../heroModelSource";
import { INPUTS_STORE, assetsView, readManifest } from "./buildInputs";
import { importedAssets } from "./mapInputs";

const key = (path: string) => path.replaceAll("\\", "/").toLowerCase().replace(/\.mdl$/, ".mdx");
const PRIVATE = join(homedir(), ".local/share/smashcraft-render-assets");

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
  let stockDirectory: Promise<string> | undefined;
  const stockCache = () => stockDirectory ??= (async () => {
    const info = await Bun.file(join(storage, ".build.info")).text();
    const lines = info.trim().split(/\r?\n/), headers = (lines[0] ?? "").split("|").map((name) => name.split("!")[0] ?? name);
    const rows = lines.slice(1).map((line) => Object.fromEntries(line.split("|").map((value, index) => [headers[index] ?? String(index), value])));
    stockInfo = { storage, buildInfoSha256: createHash("sha256").update(info).digest("hex"), fields: rows.find((row) => row.Active === "1") ?? rows[0] ?? {} };
    const directory = join(options.cache ?? PRIVATE, "stock", stockInfo.buildInfoSha256);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "build-info.json"), JSON.stringify(stockInfo, null, 2) + "\n");
    return directory;
  })();
  let sources: Promise<Map<string, string>> | undefined;
  let extractedTextures: Map<string, string> | undefined;
  const pending = new Map<string, Promise<Uint8Array | undefined>>();
  const loadSources = async () => {
    const manifest = await Effect.runPromise(readManifest());
    const assets = options.assets ?? assetsView(manifest);
    const imports = options.imports ?? await Effect.runPromise(importedAssets(assets, join(INPUTS_STORE, "summon", manifest.summon)));
    const paths = new Map(imports.map(({ entry, source }) => [key(entry), source]));
    for (const { presentation } of HERO_ROSTER) {
      if (!paths.has(key(presentation.model))) paths.set(key(presentation.model), join(assets, heroModelSource(presentation.model)));
    }
    return paths;
  };
  const read = async (path: string) => {
    const file = Bun.file(path);
    return await file.exists() ? file.bytes() : undefined;
  };
  const run = async (command: string[]) => {
    const process = Bun.spawn(command, { stdout: "ignore", stderr: "pipe" });
    const error = await new Response(process.stderr).text();
    return { code: await process.exited, error };
  };
  const resolve = async (path: string): Promise<Uint8Array | undefined> => {
    const normalized = key(path);
    if (normalized.split("/").some((part) => part === "..") || normalized.startsWith("/")) throw new Error(`invalid map asset path: ${path}`);
    sources ??= loadSources();
    const source = (await sources).get(normalized);
    if (source !== undefined) return read(source);
    if (normalized.startsWith("war3mapimported/")) return undefined;
    const texture = /\.(blp|tga|png|dds)$/.test(normalized);
    const pngName = normalized.replace(/\.[^.]+$/, ".png");
    const textures = options.textures ?? process.env.WC3_TEXTURES;
    if (texture && textures !== undefined) {
      extractedTextures ??= new Map(Array.from(new Bun.Glob("**/*.{png,blp,tga}").scanSync({ cwd: textures })).map((name) => [key(name), join(textures, name)]));
      const existingPath = extractedTextures.get(pngName) ?? extractedTextures.get(normalized);
      const existing = existingPath === undefined ? undefined : await read(existingPath);
      if (existing !== undefined) return existing;
    }
    const directory = await stockCache();
    const cache = join(directory, normalized);
    const cached = await read(cache);
    if (cached !== undefined) return cached;
    const extractor = options.extractor ?? process.env.CASC_EXTRACTOR ?? Bun.which("casc-extract")
      ?? Array.from(new Bun.Glob("*/build/animation-assets/casc-extract").scanSync({ cwd: dirname(INPUTS_STORE), absolute: true }))[0];
    if (extractor === null || extractor === undefined) throw new Error(`stock asset ${path} needs CASC_EXTRACTOR (tools/animations/extract.sh builds it)`);
    mkdirSync(dirname(cache), { recursive: true });
    const extracted = await run([extractor, storage, `war3.w3mod:${normalized}`, cache]);
    if (extracted.code === 0) return read(cache);
    if (/\.(flac|wav|ogg|mp3)$/.test(normalized)) {
      const localized = await run([extractor, storage, `war3.w3mod:_locales/enus.w3mod:${normalized}`, cache]);
      return localized.code === 0 ? read(cache) : undefined;
    }
    if (!texture) return undefined;
    const png = join(directory, pngName);
    const oldPng = await read(png);
    if (oldPng !== undefined) return oldPng;
    const dds = cache.replace(/\.[^.]+$/, ".dds");
    const fallback = await run([extractor, storage, `war3.w3mod:${normalized.replace(/\.[^.]+$/, ".dds")}`, dds]);
    if (fallback.code !== 0) return undefined;
    const converted = await run(["magick", `${dds}[0]`, png]);
    if (converted.code !== 0) throw new Error(`cannot convert stock texture ${path}: ${converted.error.trim()}`);
    return read(png);
  };
  return {
    unitModels: Object.fromEntries(Object.values(FIGHTER_OBJECTS).map(({ id, model }) => [id, model])),
    readAsset(path: string): Promise<Uint8Array | undefined> {
      const normalized = key(path);
      let promise = pending.get(normalized);
      if (promise === undefined) pending.set(normalized, promise = resolve(path).then((bytes) => {
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
