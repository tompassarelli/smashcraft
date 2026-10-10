import { join } from "node:path";
import { generateMDX, parseMDL } from "../animations/node_modules/war3-model";
import { lavaGlowTexel, liquidTexel, liquidTga, tombWaterTexel, TOMB_LIQUID_TEXTURE_SIZE } from "../../ts/scripts/stageLiquid";

const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

export async function packageLiquids(output: string): Promise<readonly string[]> {
  const names: string[] = [];
  const models: string[] = [];
  for (const kind of ["Water", "Lava", "Sea", "TombWater", "TombSea"] as const) {
    const tomb = kind === "TombWater" || kind === "TombSea";
    const texture = liquidTga((x, y) => {
      const color = tomb ? tombWaterTexel(x, y) : liquidTexel(kind === "Lava" ? "Lava" : "Water", x, y);
      return kind === "Sea" || kind === "TombSea" ? [color[0], color[1], color[2], 255] : color;
    }, tomb ? TOMB_LIQUID_TEXTURE_SIZE : undefined);
    const textureName = `Stage${kind}-${hash(texture)}.tga`;

    const glow = kind === "Lava" ? liquidTga(lavaGlowTexel) : undefined;
    const glowName = glow === undefined ? undefined : `Stage${kind}Glow-${hash(glow)}.tga`;
    const highlights = tomb ? liquidTga((x, y) => {
      const [red] = tombWaterTexel(x, y);
      const crest = Math.max(0, (red - 111) / 31);
      return kind === "TombSea" ? [216, 240, 255, Math.round(255 * crest * crest)] : [104, 166, 180, Math.round(255 * crest * crest)];
    }, TOMB_LIQUID_TEXTURE_SIZE) : undefined;
    const highlightsName = highlights === undefined ? undefined : `Stage${kind}Highlights-${hash(highlights)}.tga`;
    const sea = kind === "TombSea";
    const extent = `MinimumExtent { -50, -60, 0 }, MaximumExtent { 50, 60, ${sea ? 12 : 0} }, BoundsRadius 80,`;
    const vec = (values: readonly number[]) => `{ ${values.join(", ")} }`;
    const quad = (corners: readonly number[][], uv: readonly number[][], material: number, index: number, tint?: readonly number[]) => `Geoset {
Vertices 4 { ${corners.map(point => `${vec(point)},`).join(" ")} }
Normals 4 { { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, }
TVertices 4 { ${uv.map(point => `${vec(point)},`).join(" ")} }
VertexGroup { 0, 0, 0, 0, } Faces 1 6 { Triangles { { 0, 1, 2, 0, 2, 3 }, } }
Groups 1 1 { Matrices { 0 }, } ${extent} Anim { ${extent} } MaterialID ${material}, SelectionGroup 0,
} ${tint === undefined ? "" : `GeosetAnim { static Alpha 1, static Color ${vec([...tint].reverse())}, GeosetId ${index}, }`}`;
    const seaQuad = (z: number, material: number, index: number, tint?: readonly number[]) => quad([[-50, -60, z], [50, -60, z], [50, 60, z], [-50, 60, z]], [[0, 0], [10, 0], [10, 7], [0, 7]], material, index, tint);
    const surface = sea ? seaQuad(0, 0, 0, [0.828, 0.9, 0.9]) + "\n" + seaQuad(4, 1, 1) + "\n" + seaQuad(8, 2, 2) : "";
    const foam = sea ? [
      [-2.75, -17.3, 5.5, 2], [-2.75, -15.1, 5.5, 1],
      [-2.8, -16.5, 0.18, 1.5], [2.62, -16.5, 0.18, 1.5],
      [-17.2, 10, 4.8, 0.8], [-14, 11.2, 3.8, 0.65],
      [-6.2, 12.9, 5.6, 0.75], [-0.7, 15.2, 5.8, 0.65],
      [5.1, 16.5, 5.4, 0.8], [11.7, 11.9, 5.1, 0.7],
    ].map(([x = 0, y = 0, width = 1, depth = 1], index) => quad([[x, y, 12], [x + width, y, 12], [x + width, y + depth, 12], [x, y + depth, 12]], [[0, 0], [1, 0], [1, 1], [0, 1]], 3, 3 + index)).join("\n") : "";
    const mdl = `Version { FormatVersion 800, }
Model "Smashcraft ${kind}" { ${sea ? "NumGeosets 13, NumGeosetAnims 1," : "NumGeosets 1,"} NumBones 1, BlendTime 0, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 0, 12000 }, ${extent} } }
${tomb ? "GlobalSequences 1 { Duration 240000, }" : ""}
Textures ${sea ? 4 : glowName === undefined && highlightsName === undefined ? 1 : 2} { Bitmap { Image "war3mapImported\\${textureName}", WrapWidth, WrapHeight, } ${glowName === undefined ? "" : `Bitmap { Image "war3mapImported\\${glowName}", WrapWidth, WrapHeight, }`} ${highlightsName === undefined ? "" : `Bitmap { Image "war3mapImported\\${highlightsName}", WrapWidth, WrapHeight, }`} ${sea ? `Bitmap { Image "ReplaceableTextures\\Water\\Water00.blp", WrapWidth, WrapHeight, } Bitmap { Image "Textures\\White_64_Foam1.blp", }` : ""} }
TextureAnims ${sea ? 3 : tomb ? 2 : 1} {
  TVertexAnim { Translation 2 { Linear, ${tomb ? "GlobalSeqId 0," : ""} 0: { 0, 0, 0 }, ${tomb ? 240000 : 12000}: { ${tomb ? "2, 1" : "1, 0"}, 0 }, } }
  ${tomb ? "TVertexAnim { Translation 2 { Linear, GlobalSeqId 0, 0: { 0.37, 0.61, 0 }, 240000: { -2.63, 2.61, 0 }, } Scaling 1 { DontInterp, 0: { 1.375, 0.875, 1 }, } }" : ""}
  ${sea ? "TVertexAnim { Translation 2 { Linear, GlobalSeqId 0, 0: { 0.18, 0.43, 0 }, 240000: { -5.82, 3.43, 0 }, } Scaling 1 { DontInterp, 0: { 1.75, 1.25, 1 }, } }" : ""}
}
${sea ? `Materials 4 {
Material { Layer { FilterMode None, Unshaded, TwoSided, static TextureID 0, TVertexAnimId 0, static Alpha 1, } }
Material { PriorityPlane 1, Layer { FilterMode Blend, Unshaded, TwoSided, NoDepthSet, static TextureID 1, TVertexAnimId 1, static Alpha 0.75, } }
Material { PriorityPlane 2, Layer { FilterMode Blend, Unshaded, TwoSided, NoDepthSet, static TextureID 2, TVertexAnimId 2, static Alpha 0.12, } }
Material { PriorityPlane 3, Layer { FilterMode Blend, Unshaded, TwoSided, NoDepthSet, static TextureID 3, static Alpha 1, } }
}` : `Materials 1 { Material { Layer { FilterMode Blend, Unshaded, TwoSided, static TextureID 0, TVertexAnimId 0, static Alpha 1, } ${glowName === undefined ? "" : "Layer { FilterMode Additive, Unshaded, TwoSided, static TextureID 1, TVertexAnimId 0, static Alpha 1, }"} ${highlightsName === undefined ? "" : "Layer { FilterMode Additive, Unshaded, TwoSided, static TextureID 1, TVertexAnimId 1, Alpha 9 { Linear, GlobalSeqId 0, 0: 0.22, 30000: 0.38, 60000: 0.26, 90000: 0.34, 120000: 0.22, 150000: 0.38, 180000: 0.26, 210000: 0.34, 240000: 0.22, } }"}  } }`}

${sea ? surface + "\n" + foam : `Geoset {
Vertices 4 { { -50, -60, 0 }, { 50, -60, 0 }, { 50, 60, 0 }, { -50, 60, 0 }, }
Normals 4 { { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, }
TVertices 4 { { 0, 0 }, { ${tomb ? 0.5 : kind === "Sea" ? 96 : 4}, 0 }, { ${tomb ? 0.5 : kind === "Sea" ? 96 : 4}, ${tomb ? 0.05 : kind === "Sea" ? 64 : 1} }, { 0, ${tomb ? 0.05 : kind === "Sea" ? 64 : 1} }, }
VertexGroup { 0, 0, 0, 0, }
Faces 1 6 { Triangles { { 0, 1, 2, 0, 2, 3 }, } }
Groups 1 1 { Matrices { 0 }, }
${extent} Anim { ${extent} } MaterialID 0, SelectionGroup 0,
}
`}
Bone "Surface" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;
    const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
    const modelName = `Stage${kind}-${hash(bytes)}.mdx`;
    await Bun.write(join(output, textureName), texture);
    await Bun.write(join(output, modelName), bytes);
    if (glow !== undefined && glowName !== undefined) {
      await Bun.write(join(output, glowName), glow);
      names.push(glowName);
    }
    if (highlights !== undefined && highlightsName !== undefined) {
      await Bun.write(join(output, highlightsName), highlights);
      names.push(highlightsName);
    }
    names.push(textureName, modelName);
    models.push(`export const STAGE_${kind.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}_MODEL = ${JSON.stringify(`war3mapImported\\${modelName}`)};`);
  }
  await Bun.write(join(import.meta.dir, "../../ts/src/game/assets/terrainAssetInfo.ts"), `// Generated by tools/stage/package.ts.\n${models.join("\n")}\n`);
  return names;
}
