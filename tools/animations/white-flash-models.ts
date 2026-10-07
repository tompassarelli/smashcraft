import { join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { generateMDX, parseMDX, model as mdx } from "war3-model";
import { fighters, onGlobalClock, removeBodyEffects, tracks } from "./original-clips";
import { modelFacts } from "../../ts/node_modules/wisp/scripts/wisp/models";

const [assetsArg, outputArg] = process.argv.slice(2);
if (assetsArg === undefined || outputArg === undefined) throw new Error("usage: bun tools/animations/white-flash-models.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
const assets = resolve(assetsArg), output = resolve(outputArg);
if (!relative(resolve(import.meta.dir, "../.."), output).startsWith("..")) throw new Error("White fighter models must stay in private storage");
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const texture = new Uint8Array(18 + 16);
texture[2] = 2; texture[12] = 2; texture[14] = 2; texture[16] = 32; texture[17] = 0x28;
texture.fill(255, 18);
const textureName = `FighterWhite-${hash(texture)}.tga`;
await Bun.write(join(output, textureName), texture);
const paths: string[] = [], imports = [textureName];
const facts: Record<string, ReturnType<typeof modelFacts>> = {};
for (const fighter of fighters) {
  const source = await Bun.file(join(assets, fighter.source)).arrayBuffer();
  const model = parseMDX(source);
  const original = parseMDX(source);
  const sequence = model.Sequences[0];
  if (sequence === undefined) throw new Error(`${fighter.name}: no animation sequence`);
  const lastFrame = Math.max(...model.Sequences.map(item => item.Interval[1]));
  const sequences = model.Sequences;
  // A combined timeline must keep each clip's missing channels at their static defaults.
  tracks(model, (track, path) => {
    if (onGlobalClock(track) || !/^\.(Bones|Helpers)\.\d+\.(Translation|Rotation|Scaling)$/.test(path)) return;
    const keys = track.Keys;
    const defaults = path.endsWith("Rotation") ? [0, 0, 0, 1] : path.endsWith("Scaling") ? [1, 1, 1] : [0, 0, 0];
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
  model.Sequences = [{ ...sequence, Name: "Stand", Interval: new Uint32Array([0, lastFrame]), NonLooping: true }];
  removeBodyEffects(model);
  model.Lights = [];
  const effectMaterials = new Set(model.Materials.flatMap((material, index) =>
    material.Layers.every(layer => layer.FilterMode === mdx.FilterMode.Additive || layer.FilterMode === mdx.FilterMode.AddAlpha)
      || material.Layers.some(layer => typeof layer.TextureID === "number" && model.Textures[layer.TextureID]?.ReplaceableId === 2)
      ? [index] : []));
  for (const material of model.Materials) {
    material.Layers = [{ FilterMode: mdx.FilterMode.Transparent, Shading: mdx.LayerShading.Unshaded | mdx.LayerShading.TwoSided, TextureID: 0, TVertexAnimId: -1, CoordId: 0, Alpha: 1 }];
  }
  model.Textures = [{ Image: `war3mapImported\\${textureName}` }];
  for (const geoset of model.GeosetAnims) { geoset.Color = new Float32Array([1, 1, 1]); geoset.Flags &= ~mdx.GeosetAnimFlags.Color; }
  // Material alpha is ignored by the headless SD renderer; hide glow cards at the geoset.
  model.Geosets.forEach((geoset, GeosetId) => {
    if (!effectMaterials.has(geoset.MaterialID)) return;
    const animation = model.GeosetAnims.find(item => item.GeosetId === GeosetId);
    if (animation !== undefined) animation.Alpha = 0;
    else model.GeosetAnims.push({ GeosetId, Alpha: 0, Color: new Float32Array([1, 1, 1]), Flags: 0 });
  });
  const bytes = new Uint8Array(generateMDX(model));
  const decoded = parseMDX(bytes.buffer);
  if (decoded.Sequences.length !== 1 || decoded.Geosets.length !== model.Geosets.length) throw new Error(`${fighter.name}: white overlay changed geometry`);
  for (const key of ["Geosets", "PivotPoints"] as const) if (!isDeepStrictEqual(decoded[key], original[key])) throw new Error(`${fighter.name}: white overlay changed ${key}`);
  for (const key of ["Bones", "Helpers"] as const) {
    const hierarchy = (nodes: mdx.Node[]) => nodes.map(({ Translation, Rotation, Scaling, ...node }) => node);
    if (!isDeepStrictEqual(hierarchy(decoded[key]), hierarchy(original[key]))) throw new Error(`${fighter.name}: white overlay changed ${key} hierarchy`);
  }
  const decodedTracks = new Map<string, mdx.AnimVector>();
  tracks(decoded, (track, path) => decodedTracks.set(path, track));
  tracks(original, (track, path) => {
    if (!/^\.(Bones|Helpers)\./.test(path)) return;
    const kept = decodedTracks.get(path);
    const byFrame = new Map<number, mdx.AnimKeyframe[]>();
    for (const key of kept?.Keys ?? []) byFrame.set(key.Frame, [...(byFrame.get(key.Frame) ?? []), key]);
    if (kept === undefined || track.Keys.some(key => !byFrame.get(key.Frame)?.some(item => isDeepStrictEqual(key, item)))) throw new Error(`${fighter.name}: white overlay changed original key ${path}`);
  });
  decoded.Geosets.forEach((geoset, index) => {
    if (effectMaterials.has(geoset.MaterialID) && decoded.GeosetAnims.find(item => item.GeosetId === index)?.Alpha !== 0) throw new Error(`${fighter.name}: effect geoset ${index} remains visible`);
  });
  const filename = `${fighter.name}White-${hash(bytes)}.mdx`;
  await Bun.write(join(output, filename), bytes);
  imports.push(filename); paths.push(`war3mapImported\\${filename}`);
  facts[`war3mapImported/${filename}`.toLowerCase()] = modelFacts(bytes);
}
await Bun.write(join(output, "white-flash-imports.txt"), imports.join("\n") + "\n");
await Bun.write(join(import.meta.dir, "../../ts/src/game/assets/whiteFighterModels.ts"), `// Generated by tools/animations/white-flash-models.ts; regenerate instead of editing.\nexport const WHITE_FIGHTER_MODELS: readonly string[] = ${JSON.stringify(paths, null, 2)};\n`);
await Bun.write(join(import.meta.dir, "../../ts/scripts/wisp/whiteModelFacts.ts"), `// Generated by tools/animations/white-flash-models.ts; regenerate instead of editing.\nimport type { ModelFacts } from "wisp/scripts/wisp/models";\nexport const WHITE_MODEL_FACTS: Readonly<Record<string, ModelFacts>> = ${JSON.stringify(facts, null, 2)};\n`);
console.log(`${paths.length} white body models: original mesh and animation keys retained on one seekable timeline, emitters/lights removed`);
