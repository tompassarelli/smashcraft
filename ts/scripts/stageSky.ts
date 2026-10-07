// Original sky art at the foreign MDX/TGA boundary. The authored colour fields
// are independent of installed Warcraft textures and private visual references.
type Color = readonly [number, number, number];
interface StageSky { readonly stage: number; readonly theme: string; readonly zenith: Color; readonly horizon: Color; readonly nadir: Color; readonly cloud: number }
export const STAGE_SKIES: readonly StageSky[] = [
  { stage: 0, theme: "Sky", zenith: [42, 72, 116], horizon: [125, 157, 178], nadir: [20, 28, 43], cloud: 8 },
  { stage: 2, theme: "Icecrown", zenith: [24, 39, 69], horizon: [85, 125, 158], nadir: [18, 27, 44], cloud: 12 },
  { stage: 11, theme: "Gryphon", zenith: [50, 77, 112], horizon: [150, 173, 182], nadir: [31, 42, 58], cloud: 14 },
  { stage: 3, theme: "Durotar", zenith: [73, 55, 63], horizon: [175, 128, 86], nadir: [38, 30, 32], cloud: 10 },
  { stage: 4, theme: "Naxxramas", zenith: [19, 33, 48], horizon: [57, 99, 111], nadir: [16, 28, 34], cloud: 8 },
  { stage: 14, theme: "Hellfire", zenith: [27, 24, 42], horizon: [71, 106, 74], nadir: [23, 30, 26], cloud: 6 },
  { stage: 12, theme: "Blackrock", zenith: [31, 27, 33], horizon: [101, 66, 56], nadir: [43, 29, 30], cloud: 7 },
  { stage: 6, theme: "Stratholme", zenith: [40, 28, 52], horizon: [168, 84, 52], nadir: [30, 20, 22], cloud: 10 },
  { stage: 7, theme: "Sargeras", zenith: [28, 48, 62], horizon: [92, 140, 140], nadir: [16, 30, 34], cloud: 12 },
  { stage: 13, theme: "AhnQiraj", zenith: [76, 72, 84], horizon: [179, 159, 115], nadir: [41, 35, 37], cloud: 7 },
];
const hash = (value: Uint8Array | string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
/** Quiet, seamless atmospheric bands; the horizon carries colour, not the action's bright accents. */
export function stageSkyTexture(sky: StageSky) {
  const width = 256, height = 128;
  const bytes = new Uint8Array(18 + width * height * 4);
  bytes[2] = 2; bytes[12] = 0; bytes[13] = 1; bytes[14] = height; bytes[16] = 32; bytes[17] = 0x28;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const elevation = 1 - 2 * y / (height - 1);
    const from = elevation >= 0 ? sky.horizon : sky.nadir;
    const to = elevation >= 0 ? sky.zenith : sky.horizon;
    const mix = elevation >= 0 ? Math.pow(elevation, 0.65) : Math.pow(1 + elevation, 2);
    const angle = x / width * Math.PI * 2;
    const cloud = sky.cloud * Math.pow(Math.max(0, Math.sin(angle * 3 + elevation * 18) * Math.cos(angle * 2 - elevation * 7)), 3) * Math.max(0, elevation);
    const color = from.map((channel, i) => Math.round(channel * (1 - mix) + (to[i] ?? channel) * mix + cloud));
    bytes.set([color[2] ?? 0, color[1] ?? 0, color[0] ?? 0, 255], 18 + (y * width + x) * 4);
  }
  return { bytes, name: `StageSky-${hash(bytes)}.tga` };
}
/** A complete inward-facing sphere: sky draws behind the stage without a camera-dependent seam. */
export function stageSkyMdl(texture: string) {
  const segments = 32, rings = 16, radius = 2000;
  const vertices: number[][] = [], uv: number[][] = [], triangles: number[] = [];
  for (let row = 0; row <= rings; row++) for (let column = 0; column <= segments; column++) {
    const latitude = Math.PI / 2 - row / rings * Math.PI, longitude = column / segments * Math.PI * 2;
    vertices.push([Math.cos(latitude) * Math.cos(longitude) * radius, Math.cos(latitude) * Math.sin(longitude) * radius, Math.sin(latitude) * radius].map(Math.fround));
    uv.push([column / segments, row / rings]);
  }
  for (let row = 0; row < rings; row++) for (let column = 0; column < segments; column++) {
    const a = row * (segments + 1) + column, b = a + 1, c = a + segments + 1, d = c + 1;
    triangles.push(a, c, b, b, c, d);
  }
  const vec = (v: readonly number[]) => `{ ${v.join(", ")} }`;
  const extent = 'MinimumExtent { -2000, -2000, -2000 }, MaximumExtent { 2000, 2000, 2000 }, BoundsRadius 2000,';
  return `Version { FormatVersion 800, }
Model "Smashcraft atmospheric sky" { NumGeosets 1, NumBones 1, BlendTime 0, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${extent} } }
Textures 1 { Bitmap { Image "war3mapImported\\${texture}", } }
Materials 1 { Material { Layer { FilterMode None, Unshaded, Unfogged, TwoSided, NoDepthTest, NoDepthSet, static TextureID 0, static Alpha 1, } } }
Geoset {
  Vertices ${vertices.length} { ${vertices.map(v => `${vec(v)},`).join("\n")} }
  Normals ${vertices.length} { ${vertices.map(v => `${vec(v.map(c => -c / radius))},`).join("\n")} }
  TVertices ${uv.length} { ${uv.map(v => `${vec(v)},`).join("\n")} }
  VertexGroup { ${vertices.map(() => "0,").join(" ")} }
  Faces 1 ${triangles.length} { Triangles { ${vec(triangles)}, } }
  Groups 1 1 { Matrices { 0 }, }
  ${extent} Anim { ${extent} } MaterialID 0, SelectionGroup 0,
}
Bone "Sky" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;
}
export const stageSkyModelFile = (mdl: string) => `StageSky-${hash(mdl)}.mdx`;
