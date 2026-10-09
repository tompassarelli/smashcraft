import { join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { decodeBLP, getBLPImageData, model as mdx } from "war3-model";
import { generateModelMDX, parseModelMDX } from "../../ts/scripts/mdxCodec";
import { PNG } from "pngjs";
import { fighters, onGlobalClock, removeBodyEffects, tracks } from "./original-clips";
import { modelFacts } from "../../ts/node_modules/wisp/scripts/wisp/models";
import { headlessRender } from "../../ts/scripts/wisp/headlessRender";
import { IMPORTED_MODEL_FILES } from "../../ts/src/game/assets/importedModelInfo";
import { renumberNodes } from "../../ts/scripts/clipNodes";
import { flashableSequences, preservesFlashKey, trimFlashTracks } from "./white-flash-keys";
import { groundPlaneGeosets, removeGeosets } from "../../ts/scripts/groundPlanes";
import { MODEL_FACTS } from "../../ts/scripts/wisp/modelFacts";
import { whiteModelFactsSource } from "../../ts/scripts/wisp/whiteModelFactsSource";
import { WHITE_FIGHTER_MODELS } from "../../ts/src/game/assets/whiteFighterModels";
import { WHITE_MODEL_FACTS } from "../../ts/scripts/wisp/whiteModelFacts";
import { thinKeys } from "../../ts/scripts/keyThin";
import { timelineBody } from "./timeline-body";
import { existsSync } from "node:fs";
import { MeshoptSimplifier } from "meshoptimizer";
import { decimateWhiteBody, roundGeometry } from "./white-decimate";
import { originalClip, originalClipCount } from "../../ts/src/game/assets/fighterOriginalClipInfo";
import { DEFINITIVE_FIGHTERS } from "../../ts/src/game/assets/definitiveFighters";
import type { Character } from "../../ts/src/game/sim/codes";
const DEFINITIVE_WHITE = "_de.w3mod";
const DEFINITIVE_DECIMATION = { ratio: 0.5, error: 0.005 };

const [assetsArg, outputArg, option, characterArg] = process.argv.slice(2);
const definitiveOnly = option === "--definitive";
if (assetsArg === undefined || outputArg === undefined || (option !== undefined && !definitiveOnly && (option !== "--character" || characterArg === undefined))) throw new Error("usage: bun tools/animations/white-flash-models.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID | --definitive]");
const selected = characterArg === undefined ? undefined : Number(characterArg);
if (selected !== undefined && (!Number.isInteger(selected) || !fighters.has(selected))) throw new Error("Choose a fighter number from the roster");
const assets = resolve(assetsArg), output = resolve(outputArg);
if (!relative(resolve(import.meta.dir, "../.."), output).startsWith("..")) throw new Error("White fighter models must stay in private storage");
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const texture = new Uint8Array(18 + 16);
texture[2] = 2; texture[12] = 2; texture[14] = 2; texture[16] = 32; texture[17] = 0x28;
texture.fill(255, 18);
const textureName = `FighterWhite-${hash(texture)}.tga`;
await Bun.write(join(output, textureName), texture);
const paths: Record<number, string> = selected === undefined && !definitiveOnly ? {} : { ...WHITE_FIGHTER_MODELS };
let imports = selected === undefined && !definitiveOnly ? [textureName] : (await Bun.file(join(output, "white-flash-imports.txt")).text()).trim().split("\n");
const sourceAssets = headlessRender({ assets, imports: IMPORTED_MODEL_FILES.map(({ entry, file }) => ({ entry, source: join(assets, "imported-models", file) })) });
const whiteTextures = new Map<string, string>();
async function whiteTexture(path: string, graphics: "classic" | "definitive" = "classic"): Promise<string> {
  const known = whiteTextures.get(`${graphics}:${path}`);
  if (known !== undefined) return known;
  const bytes = await sourceAssets.readAsset(path, graphics);
  if (bytes === undefined) throw new Error(`Missing body texture ${path}`);
  let pixels: { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
  if (String.fromCharCode(...bytes.subarray(0, 3)) === "BLP") pixels = getBLPImageData(decodeBLP(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)), 0);
  else if (bytes[0] === 137 && bytes[1] === 80) pixels = PNG.sync.read(Buffer.from(bytes));
  else {
    const convert = Bun.spawn(["magick", "-", "png:-"], { stdin: bytes, stdout: "pipe", stderr: "pipe" });
    const converted = await new Response(convert.stdout).arrayBuffer();
    if (await convert.exited !== 0) throw new Error(`Cannot read ${path}: ${await new Response(convert.stderr).text()}`);
    pixels = PNG.sync.read(Buffer.from(converted));
  }
  if (graphics === "definitive") {
    let opaque = true;
    for (let pixel = 0; pixel < pixels.width * pixels.height && opaque; pixel++) opaque = pixels.data[pixel * 4 + 3] === 255;
    if (opaque) {
      whiteTextures.set(`${graphics}:${path}`, `war3mapImported\\${textureName}`);
      return `war3mapImported\\${textureName}`;
    }
  }
  const step = graphics === "definitive" ? Math.max(1, Math.ceil(Math.max(pixels.width, pixels.height) / 256)) : 1;
  const width = Math.ceil(pixels.width / step), height = Math.ceil(pixels.height / step);
  const white = new Uint8Array(18 + width * height * 4);
  white[2] = 2; white[16] = 32; white[17] = 0x28;
  const header = new DataView(white.buffer);
  header.setUint16(12, width, true); header.setUint16(14, height, true);
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const pixel = row * width + column;
    white.fill(255, 18 + pixel * 4, 21 + pixel * 4);
    white[21 + pixel * 4] = pixels.data[(row * step * pixels.width + column * step) * 4 + 3];
  }
  const name = `FighterWhite-${hash(white)}.tga`;
  await Bun.write(join(output, name), white);
  if (!imports.includes(name)) imports.push(name);
  const imported = `war3mapImported\\${name}`;
  whiteTextures.set(`${graphics}:${path}`, imported);
  return imported;
}
async function definitiveWhite(character: number, name: string, filename: string): Promise<boolean> {
  const body = originalClip(character, 0)?.modelPath;
  if (!DEFINITIVE_FIGHTERS.has(character as Character) || body === undefined || !body.includes("TimelineBody-")) return false;
  const source = join(assets, "original-clips-static-lights/imports/_de.w3mod", ...body.split("\\"));
  if (!existsSync(source)) return false;
  const model = parseModelMDX(await Bun.file(source).arrayBuffer());
  if (model.Sequences.length !== 1) throw new Error(`${name}: the Definitive body is not one timeline`);
  const clips = Array.from({ length: originalClipCount(character) }, (_, index) => {
    const clip = originalClip(character, index);
    if (clip === undefined) throw new Error(`${name}: clip ${index} is missing`);
    return { ...model.Sequences[0]!, Interval: new Uint32Array([Math.round(clip.startSeconds * 1000), Math.round(clip.endSeconds * 1000)]) };
  });
  trimFlashTracks(model, flashableSequences(character, clips));
  removeBodyEffects(model);
  model.Lights = [];
  await MeshoptSimplifier.ready;
  decimateWhiteBody(model, DEFINITIVE_DECIMATION);
  const geosets = model.Geosets.length;
  const effectMaterials = new Set(model.Materials.flatMap((material, index) =>
    material.Layers.every(layer => layer.FilterMode === mdx.FilterMode.Additive || layer.FilterMode === mdx.FilterMode.AddAlpha)
      || material.Layers.some(layer => typeof layer.TextureID === "number" && model.Textures[layer.TextureID]?.ReplaceableId === 2)
      ? [index] : []));
  const solid = model.Textures.push({ Image: `war3mapImported\\${textureName}`, ReplaceableId: 0, Flags: 0 }) - 1;
  const whiteDiffuse = new Map<number, number>();
  for (const material of model.Materials) {
    for (const layer of material.Layers) {
      layer.Shading = (layer.Shading | mdx.LayerShading.Unshaded) & ~mdx.LayerShading.NoDepthSet;
      if (layer.FilterMode === mdx.FilterMode.Transparent) layer.FilterMode = mdx.FilterMode.Blend;
      if (typeof layer.TextureID === "number") {
        const diffuse = layer.TextureID;
        let white = whiteDiffuse.get(diffuse);
        if (white === undefined) {
          const texture = model.Textures[diffuse];
          white = texture?.Image ? model.Textures.push({ ...texture, Image: await whiteTexture(texture.Image, "definitive"), ReplaceableId: 0 }) - 1 : solid;
          whiteDiffuse.set(diffuse, white);
        }
        layer.TextureID = white;
      }
      if (layer.EmissiveTextureID !== undefined) layer.EmissiveTextureID = solid;
      if (layer.TeamColorTextureID !== undefined) layer.TeamColorTextureID = solid;
    }
  }
  for (const geoset of model.GeosetAnims) { geoset.Color = new Float32Array([1, 1, 1]); geoset.Flags &= ~mdx.GeosetAnimFlags.Color; }
  roundGeometry(model);
  const effectGeosets = new Set(model.Geosets.flatMap((geoset, index) => effectMaterials.has(geoset.MaterialID) ? [index] : []));
  removeGeosets(model, effectGeosets);
  renumberNodes(model);
  const bytes = new Uint8Array(generateModelMDX(model));
  const decoded = parseModelMDX(bytes.buffer);
  if (decoded.Sequences.length !== 1 || decoded.Geosets.length !== geosets - effectGeosets.size) throw new Error(`${name}: Definitive white overlay changed geometry`);
  tracks(decoded, (track, path) => { if (track.Keys.length === 0) throw new Error(`${name}: Definitive white overlay left ${path} without keys`); });
  const planes = groundPlaneGeosets(decoded);
  if (planes.length > 0) throw new Error(`${name}: Definitive white overlay kept ground plane geosets ${planes.join(", ")}`);
  await Bun.write(join(output, DEFINITIVE_WHITE, filename), bytes);
  imports.push(`${DEFINITIVE_WHITE}/${filename}`);
  return true;
}
if (definitiveOnly) {
  imports = imports.filter(file => !file.startsWith(`${DEFINITIVE_WHITE}/`));
  let count = 0;
  for (const [character, path] of Object.entries(WHITE_FIGHTER_MODELS)) {
    const fighter = fighters.get(Number(character));
    if (fighter === undefined) throw new Error(`No roster fighter ${character}`);
    if (await definitiveWhite(Number(character), fighter.name, path.replace("war3mapImported\\", ""))) count++;
  }
  await Bun.write(join(output, "white-flash-imports.txt"), imports.join("\n") + "\n");
  console.log(`${count} Definitive white bodies updated over the Definitive timeline bodies`);
  process.exit(0);
}
const facts: Record<string, ReturnType<typeof modelFacts>> = selected === undefined ? {} : { ...WHITE_MODEL_FACTS };
for (const [character, fighter] of fighters.entries()) {
  if (selected !== undefined && character !== selected) continue;
  const previous = paths[character];
  if (previous !== undefined) {
    imports = imports.filter(file => previous !== `war3mapImported\\${file}` && previous !== `war3mapImported\\${file.replace(`${DEFINITIVE_WHITE}/`, "")}`);
    delete facts[previous.replaceAll("\\", "/").toLowerCase()];
  }
  const source = await Bun.file(join(assets, fighter.source)).arrayBuffer();
  const thinned = thinKeys(parseModelMDX(source)).model;
  const original = timelineBody(thinned, flashableSequences(character, thinned.Sequences));
  const model = structuredClone(original);
  const sequence = model.Sequences[0];
  if (sequence === undefined) throw new Error(`${fighter.name}: no animation sequence`);
  const lastFrame = Math.max(...model.Sequences.map(item => item.Interval[1]));
  const sequences = model.Sequences;
  trimFlashTracks(model, sequences);
  model.Sequences = [{ ...sequence, Name: "Stand", Interval: new Uint32Array([0, lastFrame]), NonLooping: true }];
  removeBodyEffects(model);
  model.Lights = [];
  const effectMaterials = new Set(model.Materials.flatMap((material, index) =>
    material.Layers.every(layer => layer.FilterMode === mdx.FilterMode.Additive || layer.FilterMode === mdx.FilterMode.AddAlpha)
      || material.Layers.some(layer => typeof layer.TextureID === "number" && model.Textures[layer.TextureID]?.ReplaceableId === 2)
      ? [index] : []));
  for (const material of model.Materials) {
    for (const layer of material.Layers) {
      layer.Shading = (layer.Shading | mdx.LayerShading.Unshaded) & ~mdx.LayerShading.NoDepthSet;
      // Both renderers alpha-test a Transparent layer against the effect alpha, which drops the flash at alpha 190.
      if (layer.FilterMode === mdx.FilterMode.Transparent) layer.FilterMode = mdx.FilterMode.Blend;
    }
  }
  for (const texture of model.Textures) {
    texture.Image = texture.Image ? await whiteTexture(texture.Image) : `war3mapImported\\${textureName}`;
    texture.ReplaceableId = 0;
  }
  for (const geoset of model.GeosetAnims) { geoset.Color = new Float32Array([1, 1, 1]); geoset.Flags &= ~mdx.GeosetAnimFlags.Color; }
  // Warcraft ignores zero geoset alpha on glow cards and team-glow planes (#346).
  const effectGeosets = new Set(model.Geosets.flatMap((geoset, index) => effectMaterials.has(geoset.MaterialID) ? [index] : []));
  removeGeosets(model, effectGeosets);
  removeGeosets(original, effectGeosets);
  removeBodyEffects(original);
  original.Lights = [];
  renumberNodes(model);
  renumberNodes(original);
  const bytes = new Uint8Array(generateModelMDX(model));
  const decoded = parseModelMDX(bytes.buffer);
  if (decoded.Sequences.length !== 1 || decoded.Geosets.length !== model.Geosets.length) throw new Error(`${fighter.name}: white overlay changed geometry`);
  for (const key of ["Geosets", "PivotPoints"] as const) if (!isDeepStrictEqual(decoded[key], original[key])) throw new Error(`${fighter.name}: white overlay changed ${key}`);
  for (const key of ["Bones", "Helpers"] as const) {
    const hierarchy = (nodes: mdx.Node[]) => nodes.map(({ Translation, Rotation, Scaling, ...node }) => node);
    if (!isDeepStrictEqual(hierarchy(decoded[key]), hierarchy(original[key]))) throw new Error(`${fighter.name}: white overlay changed ${key} hierarchy`);
  }
  const decodedTracks = new Map<string, mdx.AnimVector>();
  tracks(decoded, (track, path) => {
    if (track.Keys.length === 0) throw new Error(`${fighter.name}: white overlay left ${path} without keys`);
    decodedTracks.set(path, track);
  });
  tracks(original, (track, path) => {
    if (!/^\.(Bones|Helpers)\./.test(path)) return;
    const kept = decodedTracks.get(path);
    const byFrame = new Map<number, mdx.AnimKeyframe[]>();
    for (const key of kept?.Keys ?? []) byFrame.set(key.Frame, [...(byFrame.get(key.Frame) ?? []), key]);
    const active = track.Keys.filter(key => onGlobalClock(track) || sequences.some(sequence => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]));
    if (active.some(key => !byFrame.get(key.Frame)?.some(item => isDeepStrictEqual(key, item)) && !preservesFlashKey(kept, key))) throw new Error(`${fighter.name}: white overlay changed flashable key ${path}`);
  });
  if (decoded.Geosets.some(geoset => effectMaterials.has(geoset.MaterialID))) throw new Error(`${fighter.name}: white overlay kept an effect geoset`);
  const planes = groundPlaneGeosets(decoded);
  if (planes.length > 0) throw new Error(`${fighter.name}: white overlay kept ground plane geosets ${planes.join(", ")}`);
  const filename = `${fighter.name}White-${hash(bytes)}.mdx`;
  await Bun.write(join(output, filename), bytes);
  imports.push(filename); paths[character] = `war3mapImported\\${filename}`;
  await definitiveWhite(character, fighter.name, filename);
  facts[`war3mapImported/${filename}`.toLowerCase()] = modelFacts(bytes);
}
await Bun.write(join(output, "white-flash-imports.txt"), imports.join("\n") + "\n");
await Bun.write(join(import.meta.dir, "../../ts/src/game/assets/whiteFighterModels.ts"), `// Generated by tools/animations/white-flash-models.ts; regenerate instead of editing.\nexport const WHITE_FIGHTER_MODELS: Readonly<Record<number, string>> = {\n${Object.entries(paths).map(([character, path]) => `  ${character}: ${JSON.stringify(path)},`).join("\n")}\n};\n`);
await Bun.write(join(import.meta.dir, "../../ts/scripts/wisp/whiteModelFacts.ts"), `// Generated by tools/animations/white-flash-models.ts; regenerate instead of editing.\nimport type { ModelFacts } from "wisp/scripts/wisp/models";\nexport const WHITE_MODEL_FACTS: Readonly<Record<string, ModelFacts>> = ${JSON.stringify(facts, null, 2)};\n`);
await Bun.write(join(import.meta.dir, "../../ts/scripts/wisp/modelFacts.ts"), whiteModelFactsSource(MODEL_FACTS, Object.values(paths), facts));
console.log(`${selected === undefined ? Object.keys(paths).length : 1} white body models updated: original mesh and flashable animation keys retained on one seekable timeline, emitters/lights removed`);
