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
import { MODEL_FACTS } from "../../ts/scripts/wisp/modelFacts";
import { whiteModelFactsSource } from "../../ts/scripts/wisp/whiteModelFactsSource";
import { WHITE_FIGHTER_MODELS } from "../../ts/src/game/assets/whiteFighterModels";
import { WHITE_MODEL_FACTS } from "../../ts/scripts/wisp/whiteModelFacts";

const [assetsArg, outputArg, option, characterArg] = process.argv.slice(2);
if (assetsArg === undefined || outputArg === undefined || (option !== undefined && (option !== "--character" || characterArg === undefined))) throw new Error("usage: bun tools/animations/white-flash-models.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]");
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
const paths: Record<number, string> = selected === undefined ? {} : { ...WHITE_FIGHTER_MODELS };
let imports = selected === undefined ? [textureName] : (await Bun.file(join(output, "white-flash-imports.txt")).text()).trim().split("\n");
const sourceAssets = headlessRender({ assets, imports: IMPORTED_MODEL_FILES.map(({ entry, file }) => ({ entry, source: join(assets, "imported-models", file) })) });
const whiteTextures = new Map<string, string>();
async function whiteTexture(path: string): Promise<string> {
  const known = whiteTextures.get(path);
  if (known !== undefined) return known;
  const bytes = await sourceAssets.readAsset(path);
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
  const white = new Uint8Array(18 + pixels.width * pixels.height * 4);
  white[2] = 2; white[16] = 32; white[17] = 0x28;
  const header = new DataView(white.buffer);
  header.setUint16(12, pixels.width, true); header.setUint16(14, pixels.height, true);
  for (let pixel = 0; pixel < pixels.width * pixels.height; pixel++) {
    white.fill(255, 18 + pixel * 4, 21 + pixel * 4);
    white[21 + pixel * 4] = pixels.data[pixel * 4 + 3];
  }
  const name = `FighterWhite-${hash(white)}.tga`;
  await Bun.write(join(output, name), white);
  if (!imports.includes(name)) imports.push(name);
  const imported = `war3mapImported\\${name}`;
  whiteTextures.set(path, imported);
  return imported;
}
const facts: Record<string, ReturnType<typeof modelFacts>> = selected === undefined ? {} : { ...WHITE_MODEL_FACTS };
for (const [character, fighter] of fighters.entries()) {
  if (selected !== undefined && character !== selected) continue;
  const previous = paths[character];
  if (previous !== undefined) {
    imports = imports.filter(file => previous !== `war3mapImported\\${file}`);
    delete facts[previous.replaceAll("\\", "/").toLowerCase()];
  }
  const source = await Bun.file(join(assets, fighter.source)).arrayBuffer();
  const model = parseModelMDX(source);
  const original = parseModelMDX(source);
  const sequence = model.Sequences[0];
  if (sequence === undefined) throw new Error(`${fighter.name}: no animation sequence`);
  const lastFrame = Math.max(...model.Sequences.map(item => item.Interval[1]));
  const sequences = flashableSequences(character, model.Sequences);
  // A combined timeline must keep each clip's missing channels at their static defaults.
  tracks(model, (track, path) => {
    const transform = /^\.(Bones|Helpers|Attachments|CollisionShapes)\.\d+\.(Translation|Rotation|Scaling)$/.test(path);
    const alpha = /^\.(GeosetAnims\.\d+|Materials\.\d+\.Layers\.\d+)\.Alpha$/.test(path);
    if (onGlobalClock(track) || (!transform && !alpha)) return;
    const keys = track.Keys;
    const defaults = alpha ? [1] : path.endsWith("Rotation") ? [0, 0, 0, 1] : path.endsWith("Scaling") ? [1, 1, 1] : [0, 0, 0];
    const added: mdx.AnimKeyframe[] = [];
    for (const clip of sequences) {
      const [start, end] = clip.Interval;
      const active = keys.filter(key => key.Frame >= start && key.Frame <= end);
      for (const [frame, edge] of [[start, active[0]], [end, active.at(-1)]] as const) {
        if (keys.some(key => key.Frame === frame)) continue;
        added.push(edge === undefined ? { Frame: frame, Vector: new Float32Array(defaults), InTan: new Float32Array(defaults), OutTan: new Float32Array(defaults) } : { ...structuredClone(edge), Frame: frame });
      }
    }
    track.Keys = [...keys, ...added].sort((a, b) => a.Frame - b.Frame);
  });
  trimFlashTracks(model, sequences);
  model.Sequences = [{ ...sequence, Name: "Stand", Interval: new Uint32Array([0, lastFrame]), NonLooping: true }];
  removeBodyEffects(model);
  model.Lights = [];
  const effectMaterials = new Set(model.Materials.flatMap((material, index) =>
    material.Layers.every(layer => layer.FilterMode === mdx.FilterMode.Additive || layer.FilterMode === mdx.FilterMode.AddAlpha)
      || material.Layers.some(layer => typeof layer.TextureID === "number" && model.Textures[layer.TextureID]?.ReplaceableId === 2)
      ? [index] : []));
  for (const material of model.Materials) {
    for (const layer of material.Layers) layer.Shading = (layer.Shading | mdx.LayerShading.Unshaded) & ~mdx.LayerShading.NoDepthSet;
  }
  for (const texture of model.Textures) {
    texture.Image = texture.Image ? await whiteTexture(texture.Image) : `war3mapImported\\${textureName}`;
    texture.ReplaceableId = 0;
  }
  for (const geoset of model.GeosetAnims) { geoset.Color = new Float32Array([1, 1, 1]); geoset.Flags &= ~mdx.GeosetAnimFlags.Color; }
  // Material alpha is ignored by the headless SD renderer; hide glow cards at the geoset.
  model.Geosets.forEach((geoset, GeosetId) => {
    if (!effectMaterials.has(geoset.MaterialID)) return;
    const animation = model.GeosetAnims.find(item => item.GeosetId === GeosetId);
    if (animation !== undefined) animation.Alpha = 0;
    else model.GeosetAnims.push({ GeosetId, Alpha: 0, Color: new Float32Array([1, 1, 1]), Flags: 0 });
  });
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
  decoded.Geosets.forEach((geoset, index) => {
    if (effectMaterials.has(geoset.MaterialID) && decoded.GeosetAnims.find(item => item.GeosetId === index)?.Alpha !== 0) throw new Error(`${fighter.name}: effect geoset ${index} remains visible`);
  });
  const filename = `${fighter.name}White-${hash(bytes)}.mdx`;
  await Bun.write(join(output, filename), bytes);
  imports.push(filename); paths[character] = `war3mapImported\\${filename}`;
  facts[`war3mapImported/${filename}`.toLowerCase()] = modelFacts(bytes);
}
await Bun.write(join(output, "white-flash-imports.txt"), imports.join("\n") + "\n");
await Bun.write(join(import.meta.dir, "../../ts/src/game/assets/whiteFighterModels.ts"), `// Generated by tools/animations/white-flash-models.ts; regenerate instead of editing.\nexport const WHITE_FIGHTER_MODELS: Readonly<Record<number, string>> = ${JSON.stringify(paths, null, 2)};\n`);
await Bun.write(join(import.meta.dir, "../../ts/scripts/wisp/whiteModelFacts.ts"), `// Generated by tools/animations/white-flash-models.ts; regenerate instead of editing.\nimport type { ModelFacts } from "wisp/scripts/wisp/models";\nexport const WHITE_MODEL_FACTS: Readonly<Record<string, ModelFacts>> = ${JSON.stringify(facts, null, 2)};\n`);
await Bun.write(join(import.meta.dir, "../../ts/scripts/wisp/modelFacts.ts"), whiteModelFactsSource(MODEL_FACTS, Object.values(paths), facts));
console.log(`${selected === undefined ? Object.keys(paths).length : 1} white body models updated: original mesh and flashable animation keys retained on one seekable timeline, emitters/lights removed`);
