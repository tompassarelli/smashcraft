

import { parseMDL, generateMDX, parseMDX } from "../animations/node_modules/war3-model";
import { join } from "node:path";
import { STAGE_PALETTE_TEXTURE, mainDeckFaces, mainDeckMdl, mainDeckModelFile, mainDeckOutlineStage, paletteTexture } from "../../ts/scripts/stageDeck";
import { STAGE_DECK_PALETTES } from "../../ts/src/game/assets/stagePalette";
import { STAGE_POINT_LIGHTS } from "../../ts/src/game/assets/stagePointLights";
import { stagePointLightMdl, stagePointLightModelFile } from "../../ts/scripts/stageLight";
import { packageLiquids } from "./liquids";
import { packageSkies } from "./skies";
import { platformDeckFaces, texturedDeckMdl } from "../../ts/scripts/stageMaterials";
import { modelFacts } from "../../ts/node_modules/wisp/scripts/wisp/models";
import { MODEL_FACTS } from "../../ts/scripts/wisp/modelFacts";
import { roundedFacts, writeModelFacts } from "../../ts/scripts/wisp/modelFactsTable";

const output = join(import.meta.dir, "../../build/stage-assets");
const { coordinate } = STAGE_PALETTE_TEXTURE;
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const vec = (v: readonly number[]) => `{ ${v.join(", ")} }`;

const extent = 'MinimumExtent { -50, -60, -54 }, MaximumExtent { 50, 60, 0 }, BoundsRadius 96,';
let geometry = "";
let count = 0;
function slab(top: number, bottom: number, halfWidth: number, halfDepth: number, lowerWidth: number, lowerDepth: number, material: number) {
    const vertices = [
        [-halfWidth,-halfDepth,top], [halfWidth,-halfDepth,top], [halfWidth,halfDepth,top], [-halfWidth,halfDepth,top],
        [-lowerWidth,-lowerDepth,bottom], [lowerWidth,-lowerDepth,bottom], [lowerWidth,lowerDepth,bottom], [-lowerWidth,lowerDepth,bottom],
    ];
    const faces = [[0,1,2,3], [5,4,7,6], [4,5,1,0], [5,6,2,1], [6,7,3,2], [7,4,0,3]];
    const normals = [[0,0,1],[0,0,-1],[0,-1,0],[1,0,0],[0,1,0],[-1,0,0]];
    const points = faces.flatMap(f => f.map(i => vertices[i]));
    const triangles = faces.flatMap((_, i) => [i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3]);
    geometry += `Geoset {
        Vertices 24 { ${points.map(v => vec(v)+",").join("\n")} }
        Normals 24 { ${normals.flatMap(v => Array(4).fill(vec(v)+",")).join("\n")} }
        TVertices 24 { ${Array(24).fill(vec(coordinate(material))+",").join("\n")} }
        VertexGroup { ${Array(24).fill("0,").join(" ")} }
        Faces 1 36 { Triangles { ${vec(triangles)}, } }
        Groups 1 1 { Matrices { 0 }, }
        ${extent}
        Anim { ${extent} }
        MaterialID 0,
        SelectionGroup 0,
    }\n`;
    count++;
}
slab(0,-7,50,60,50,60,0);
slab(-7,-11,50,60,50,60,1);
slab(-11,-46,50,60,46,44,2);
slab(-46,-54,46,44,44,40,3);
const slabMdl = (textureName: string) => `Version { FormatVersion 800, }
Model "Smashcraft floating deck" { NumGeosets ${count}, NumBones 1, BlendTime 0, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${extent} } }
Textures 1 { Bitmap { Image "war3mapImported\\${textureName}", } }
Materials 1 { Material { Layer { FilterMode None, Unshaded, static TextureID 0, static Alpha 1, } } }
${geometry}
Bone "Deck" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;
const bytes = new Uint8Array(generateMDX(parseMDL(slabMdl(STAGE_PALETTE_TEXTURE.name))));
const decoded = parseMDX(bytes.buffer);

const points = decoded.Geosets.flatMap(g => Array.from(g.Vertices));
for (let i=0; i<points.length; i+=3) {
    if (points[i] < -50 || points[i] > 50 || points[i+2] > 0) throw new Error("deck geometry exceeds collision plane");
}
const walkingFace = Array.from(decoded.Geosets[0].Vertices.slice(0, 12));
if (JSON.stringify(walkingFace) !== JSON.stringify([-50,-60,0,50,-60,0,50,60,0,-50,60,0])) {
    throw new Error("deck walking face must span its complete collision plane");
}
const imports: string[] = [];
const themed: string[] = [];
for (const { stage, theme, palette, materials } of STAGE_DECK_PALETTES) {


    const mainFaces = mainDeckFaces(mainDeckOutlineStage(stage));
    const authored = mainFaces.flatMap(face => face.corners.flatMap(corner => corner.map(Math.fround)));
    const { bytes: texture, name: textureName } = paletteTexture(palette);
    const slab = materials === undefined ? slabMdl(textureName) : texturedDeckMdl(platformDeckFaces(), materials.platform, palette);
    const slabBytes = new Uint8Array(generateMDX(parseMDL(slab)));
    const slabName = `StageDeck-${hash(slabBytes)}.mdx`;
    const mainMdl = materials === undefined ? mainDeckMdl(mainFaces, textureName) : texturedDeckMdl(mainFaces, materials, palette);
    const mainBytes = new Uint8Array(generateMDX(parseMDL(mainMdl)));
    const drawn = parseMDX(mainBytes.buffer).Geosets.flatMap(g => Array.from(g.Vertices));
    if (materials === undefined && JSON.stringify(drawn) !== JSON.stringify(authored)) throw new Error("the main deck model's vertices differ from its outline's");
    const mainName = mainDeckModelFile(mainMdl);
    await Bun.write(join(output, textureName), texture);
    await Bun.write(join(output, slabName), slabBytes);
    await Bun.write(join(output, mainName), mainBytes);
    await Bun.write(join(output, `StageDeck${theme}.mdl`), slab);
    await Bun.write(join(output, `StageMainDeck${theme}.mdl`), mainMdl);
    imports.push(slabName, mainName, textureName);
    let alternate = "";
    if (materials?.alternatePlatform !== undefined) {
        const mdl = texturedDeckMdl(platformDeckFaces(), materials.alternatePlatform, palette);
        const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
        const name = `StageDeck-${hash(bytes)}.mdx`;
        await Bun.write(join(output, name), bytes);
        imports.push(name);
        alternate = `, alternate: ${JSON.stringify(`war3mapImported\\${name}`)}`;
    }
    themed.push(`  ${stage}: { slab: ${JSON.stringify(`war3mapImported\\${slabName}`)}, main: ${JSON.stringify(`war3mapImported\\${mainName}`)}${alternate} },`);
    console.log(`${theme} deck: ${slabName} (${slabBytes.byteLength} bytes), ${mainName} (${mainBytes.byteLength} bytes)`);
}
const [neutral] = themed;
if (neutral === undefined) throw new Error("no deck palettes");
await Bun.write(join(import.meta.dir, "../../ts/src/game/assets/stageAssetInfo.ts"),
    `// Generated by tools/stage/package.ts from the authored deck models; regenerate instead of editing.
/** Each selectable stage's deck models in its palette: the raised decks' slab, which the map scales to each deck, and the main deck, drawn from its collision outline in arena units. */
export const STAGE_DECK_MODELS: Readonly<Record<number, { readonly slab: string; readonly main: string; readonly alternate?: string }>> = {
${themed.join("\n")}
};
/** The neutral palette's slab. */
export const STAGE_DECK_MODEL = ${JSON.stringify(`war3mapImported\\${imports[0]}`)};
/** The neutral palette's main deck. */
export const STAGE_MAIN_DECK_MODEL = ${JSON.stringify(`war3mapImported\\${imports[1]}`)};
`);
console.log(`Stage decks: ${STAGE_DECK_PALETTES.length} palettes; slab bounds x=[-50,50], z=[-54,0]; main decks from each stage's collision outline`);


const deckFacts = Object.fromEntries(Object.entries(MODEL_FACTS).filter(([model]) => !model.startsWith("war3mapImported\\StageDeck-") && !model.startsWith("war3mapImported\\StageMainDeck-")));
for (const name of imports.filter(name => name.startsWith("StageDeck-") || name.startsWith("StageMainDeck-"))) {
    deckFacts[`war3mapImported\\${name}`] = roundedFacts(modelFacts(await Bun.file(join(output, name)).bytes()));
}
writeModelFacts(deckFacts);


const snowExtent = 'MinimumExtent { -1600, -200, -1500 }, MaximumExtent { 1600, 200, 2800 }, BoundsRadius 3500,';
const snowMdl = `Version { FormatVersion 800, }
Model "Smashcraft drifting snow" { BlendTime 0, ${snowExtent} }
Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${snowExtent} } }
Textures 1 { Bitmap { Image "Textures\\snowflake2.blp", } }
${[700, 1700, 2700].map((height, index) => `ParticleEmitter2 "Snow${index}" {
  ObjectId ${index}, Unshaded, SortPrimsFarZ,
  static Speed 60, static Variation 0.25, static Latitude 15,
  static Gravity 15, static EmissionRate 70,
  static Width 2800, static Length 60,
  LifeSpan 12, Blend, Rows 1, Columns 1, Head,
  TailLength 0, Time 0.5,
  SegmentColor { Color { 1, 1, 1 }, Color { 1, 1, 1 }, Color { 1, 1, 1 }, }
  Alpha { 0, 130, 0 }, ParticleScaling { 3, 5, 3 },
  LifeSpanUVAnim { 0, 0, 1 }, DecayUVAnim { 0, 0, 1 },
  TailUVAnim { 0, 0, 1 }, TailDecayUVAnim { 0, 0, 1 },
  TextureID 0, ReplaceableId 0, PriorityPlane 0,
  Rotation 1 { DontInterp, 0: { 1, 0, 0, 0 }, }
}`).join('\n')}
PivotPoints 3 { { 0, 0, 700 }, { 0, 0, 1700 }, { 0, 0, 2700 }, }
`;
const snowBytes = new Uint8Array(generateMDX(parseMDL(snowMdl)));
const snowName = `StageSnow-${hash(snowBytes)}.mdx`;
await Bun.write(join(output, snowName), snowBytes);
await Bun.write(join(output, "StageSnow.mdl"), snowMdl);
const infoPath = join(import.meta.dir, "../../ts/src/game/assets/stageAssetInfo.ts");
await Bun.write(infoPath, `${await Bun.file(infoPath).text()}/** Drifting snow behind the fighting plane, using the stock snowflake texture. */\nexport const STAGE_SNOW_MODEL = ${JSON.stringify(`war3mapImported\\${snowName}`)};\n`);
console.log(`Stage snow: three emitters, stock snowflake texture; ${snowName}`);


const pointLights: string[] = [];
const pointLightNames: string[] = [];
for (const { stage, theme, lights } of STAGE_POINT_LIGHTS) {
    const files: string[] = [];
    for (const light of lights) {
        const mdl = stagePointLightMdl(light);
        const name = stagePointLightModelFile(mdl);
        const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
        const decoded = parseMDX(bytes.buffer);
        if (decoded.Geosets.length !== 0 || decoded.Lights.length !== 1 || decoded.Lights[0]?.LightType !== 0) throw new Error(`${theme}: a point light model must hold one omni light and no geometry`);
        await Bun.write(join(output, name), bytes);
        await Bun.write(join(output, `StagePointLight${theme}${files.length}.mdl`), mdl);
        pointLightNames.push(name);
        files.push(JSON.stringify(`war3mapImported\\${name}`));
    }
    pointLights.push(`  ${stage}: [${files.join(", ")}],`);
}
await Bun.write(infoPath, `${await Bun.file(infoPath).text()}/** Each stage's backdrop omni light models, in the order of its lights in stagePointLights.ts. */\nexport const STAGE_POINT_LIGHT_MODELS: Readonly<Record<number, readonly string[]>> = {\n${pointLights.join("\n")}\n};\n`);
const skyNames = await packageSkies(output);
const liquidNames = await packageLiquids(output);
await Bun.write(join(output, "imports.txt"), `${[...new Set([...imports, snowName, ...pointLightNames, ...skyNames, ...liquidNames])].join("\n")}\n`);
