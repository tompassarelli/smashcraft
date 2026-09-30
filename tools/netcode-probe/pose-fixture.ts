// Foreign MDL/MDX boundary: a known linear marker separates native clip and seek semantics.
import {parseMDL, generateMDX, parseMDX} from "../animations/node_modules/war3-model";
import {join} from "node:path";

const output = process.argv[2];
if (!output) throw new Error("Expected probe import directory");
const timeline = process.argv[3] === "timeline";
const texture = new Uint8Array(26);
texture[2] = 2;
texture[12] = 2;
texture[14] = 1;
texture[16] = 32;
texture[17] = 0x28;
texture.set([255,255,255,255, 50,255,50,255],18);
const extent = "MinimumExtent { -30, -5, -10 }, MaximumExtent { 230, 5, 210 }, BoundsRadius 315,";
const vector = (v: number[]) => `{ ${v.join(", ")} }`;
const geometry = (vertices: number[][], faces: number[], bone: number, color: number) => `Geoset {
    Vertices ${vertices.length} { ${vertices.map(v=>vector(v)+",").join(" ")} }
    Normals ${vertices.length} { ${vertices.map(()=>"{ 0, -1, 0 },").join(" ")} }
    TVertices ${vertices.length} { ${vertices.map(()=>`{ ${color}, 0.5 },`).join(" ")} }
    VertexGroup { ${vertices.map(()=>"0,").join(" ")} }
    Faces 1 ${faces.length} { Triangles { ${vector(faces)}, } }
    Groups 1 1 { Matrices { ${bone} }, }
    ${extent}
    ${Array.from({length: timeline ? 1 : 3},()=>`Anim { ${extent} }`).join(" ")}
    MaterialID 0, SelectionGroup 0,
}`;
const ruler: number[][] = [];
const rulerFaces: number[] = [];
for (const z of [0,60,100,200]) {
    const n=ruler.length;
    ruler.push([-25,0,z-2],[25,0,z-2],[25,0,z+2],[-25,0,z+2]);
    rulerFaces.push(n,n+1,n+2,n,n+2,n+3);
}
const mdl = `Version { FormatVersion 800, }
Model "Seek fixture" { NumGeosets 2, NumBones 2, BlendTime 0, ${extent} }
Sequences ${timeline ? 1 : 3} {
    ${timeline ? `Anim "Stand" { Interval { 0, 5000 }, NonLooping, ${extent} }` : `
    Anim "Stand" { Interval { 0, 1000 }, ${extent} }
    Anim "Attack" { Interval { 2000, 3000 }, NonLooping, ${extent} }
    Anim "Walk" { Interval { 4000, 5000 }, ${extent} }
    `}
}
Textures 1 { Bitmap { Image "war3mapImported\\PoseFixture.tga", } }
Materials 1 { Material { Layer { FilterMode None, Unshaded, TwoSided, static TextureID 0, static Alpha 1, } } }
${geometry(ruler,rulerFaces,0,.25)}
${geometry([[-20,-1,-8],[20,-1,0],[-20,-1,8]],[0,1,2],1,.75)}
Bone "Ruler" { ObjectId 0, GeosetId 0, GeosetAnimId None, }
Bone "Marker" { ObjectId 1, Parent 0, GeosetId 1, GeosetAnimId None,
    Translation 6 { Linear,
        0: { 0, 0, 0 }, 1000: { 0, 0, 0 },
        2000: { 0, 0, 0 }, 3000: { 0, 0, 200 },
        4000: { 0, 0, 0 }, 5000: { 200, 0, 0 },
    }
}
PivotPoints 2 { { 0, 0, 0 }, { 0, 0, 0 }, }
`;
const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
const modelName = `PoseFixture-${new Bun.CryptoHasher("sha256").update(bytes).digest("hex")}.mdx`;
const decoded = parseMDX(bytes.buffer);
if (JSON.stringify(decoded.Sequences.map(s=>Array.from(s.Interval))) !== (timeline ? "[[0,5000]]" : "[[0,1000],[2000,3000],[4000,5000]]")) throw new Error("Fixture intervals changed");
const track = decoded.Bones.find(b=>b.Name==="Marker")!.Translation!;
if (track.Keys.length!==6 || track.Keys[3].Vector[2]!==200 || track.Keys[5].Vector[0]!==200) throw new Error("Fixture motion changed");
await Bun.write(join(output,modelName),bytes);
await Bun.write(join(output,"PoseFixture.mdl"),mdl);
await Bun.write(join(output,"PoseFixture.tga"),texture);
await Bun.write(join(output,"../../wurst/PoseFixtureInfo.wurst"),`package PoseFixtureInfo\npublic constant string POSE_FIXTURE_MODEL = "war3mapImported\\\\${modelName}"\n`);
console.log(`Fixture: ${timeline ? "single frozen Stand timeline;" : "separate clips;"} 2000..3000ms moves z=0..200; 4000..5000ms moves x=0..200`);
