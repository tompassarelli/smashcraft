// Foreign MDX/texture boundary; gameplay events and lifetimes are game-owned.
import { parseMDL, generateMDX, parseMDX } from "../animations/node_modules/war3-model";
import { join } from "node:path";

const output = join(import.meta.dir, "../../build/impact-assets");
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const texture = new Uint8Array(18 + 256 * 64 * 4);
texture[2] = 2;
texture[12] = 0; texture[13] = 1; texture[14] = 64;
texture[16] = 32; texture[17] = 0x28;
const colors = [[255,255,255], [150,190,255], [120,255,140], [255,255,255]];
for (let y = 0; y < 64; y++) for (let x = 0; x < 256; x++) {
    const tile = Math.floor(x / 64);
    const radius = Math.hypot(((x % 64) + .5 - 32) / 32, (y + .5 - 32) / 32);
    const alpha = tile === 3 ? Math.round(255 * Math.max(0, 1 - radius * radius) ** 1.5) : 255;
    const [r,g,b] = colors[tile];
    texture.set([b,g,r,alpha], 18 + (y * 256 + x) * 4);
}
const textureName = `ImpactPalette-${hash(texture)}.tga`;
type Point = [number, number];
type Shape = { points: Point[], tile: number, soft?: boolean, dark?: boolean };
const vector = (a: number[]) => `{ ${a.join(", ")} }`;
const extent = "MinimumExtent { -100, -1, -100 }, MaximumExtent { 100, 1, 100 }, BoundsRadius 150,";

function rays(count: number, rx: number, rz: number): Shape[] {
    const result: Shape[] = [];
    for (let i=0; i<count; i++) {
        const angle = i * Math.PI * 2 / count;
        const length = i % 2 === 0 ? 1 : .62;
        const a = angle - .18, b = angle + .18;
        const points: Point[] = [[rx*.2*Math.cos(a),rz*.2*Math.sin(a)],
            [rx*length*Math.cos(angle),rz*length*Math.sin(angle)],
            [rx*.2*Math.cos(b),rz*.2*Math.sin(b)], [0,0]];
        result.push({points: points.map(([x,z]) => [x*1.18,z*1.18]), tile:1});
        result.push({points, tile:0});
    }
    result.push({points:Array.from({length:16}, (_,i) => [rx*.21*Math.cos(i*Math.PI/8),rz*.21*Math.sin(i*Math.PI/8)]), tile:0});
    return result;
}
const miss: Shape[] = [];
for (let i=0; i<7; i++) {
    const x = (i-3)*11;
    const height = [35,58,74,48,68,51,33][i];
    miss.push({points:[[x*.25-7,0],[x*1.45,height],[x*.25+7,0]],tile:2});
    miss.push({points:[[x*.25-3,0],[x*1.22,height*.8],[x*.25+3,0]],tile:0});
}
const dust: Shape[] = [];
for (const [x,z,r] of [[-23,15,17],[-7,20,23],[16,18,20],[31,12,14],[1,31,16]]) {
    dust.push({points:[[x-r,z-r*.8],[x+r,z-r*.8],[x+r,z+r*.8],[x-r,z+r*.8]],tile:3,soft:true});
}
const electric: Shape[] = [];
for (let side = -1; side <= 1; side += 2) {
    for (const z of [-28, 0, 28]) {
        electric.push({points:[[side*12,z-3],[side*34,z+14],[side*28,z+3],[side*58,z+18],[side*36,z-10],[side*42,z-1]],tile:1});
    }
}
const ring: Shape[] = [];
for (let i = 0; i < 24; i++) {
    const a=i*Math.PI/12, b=(i+1)*Math.PI/12;
    ring.push({points:[[34*Math.cos(a),13*Math.sin(a)],[42*Math.cos(a),17*Math.sin(a)],
        [42*Math.cos(b),17*Math.sin(b)],[34*Math.cos(b),13*Math.sin(b)]],tile:0});
}
const models: [string,Shape[]][] = [["Hit",rays(16,47,44)], ["Tech",rays(8,60,22)], ["Miss",miss], ["Dust",dust], ["Roll",rays(8,33,30)],
    ["Electric",electric], ["Shield",rays(10,38,38)], ["Jump",ring], ["KO",rays(20,85,85)], ["Respawn",rays(8,45,65)]];
// The danger edge stays at unit radius; its dark interior leaves the rim crisp.
const defile: Shape[] = [{ points: Array.from({length:64}, (_,i) => {
    const angle = i * Math.PI / 32;
    return [.89 * Math.cos(angle), .12 + .08 * Math.sin(angle)] as Point;
}), tile:0, dark:true }];
for (let i = 0; i < 64; i++) {
    const a=i*Math.PI/32, b=(i+1)*Math.PI/32;
    defile.push({points:[[.91*Math.cos(a),.12+.08*Math.sin(a)],[Math.cos(a),.12+.08*Math.sin(a)],
        [Math.cos(b),.12+.08*Math.sin(b)],[.965*Math.cos(b),.12+.08*Math.sin(b)]],tile:0});
}
defile.push({points:[[-1,0],[-1,.20],[-.91,.20],[-.91,0]],tile:0},
    {points:[[.91,0],[.91,.20],[1,.20],[1,0]],tile:0});
models.push(["Defile",defile]);
const imports = [textureName];
const assetInfo: string[] = [];
let preview = `<svg xmlns="http://www.w3.org/2000/svg" width="${models.length*200}" height="210"><defs><radialGradient id="dust"><stop stop-color="white"/><stop offset=".55" stop-color="white" stop-opacity=".65"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><rect width="${models.length*200}" height="210" fill="#18202c"/>`;
for (const [index,[name,shapes]] of models.entries()) {
    const geometry = shapes.map(({points,tile,soft,dark}, id) => {
        const n = points.length;
        const faces = Array.from({length:n-2}, (_,i) => [0,i+1,i+2]).flat();
        const uvs = soft ? [[.7501,.001],[.9999,.001],[.9999,.999],[.7501,.999]] : Array(n).fill([(tile+.5)/4,.5]);
        return `Geoset {
            Vertices ${n} { ${points.map(([x,z]) => vector([x,-id*.002,z])+",").join(" ")} }
            Normals ${n} { ${Array(n).fill("{ 0, -1, 0 },").join(" ")} }
            TVertices ${n} { ${uvs.map(v=>vector(v)+",").join(" ")} }
            VertexGroup { ${Array(n).fill("0,").join(" ")} }
            Faces 1 ${faces.length} { Triangles { ${vector(faces)}, } }
            Groups 1 1 { Matrices { 0 }, }
            ${extent} Anim { ${extent} } MaterialID ${dark ? 2 : soft ? 1 : 0}, SelectionGroup 0,
        }`;
    }).join("\n");
    const mdl = `Version { FormatVersion 800, }
        Model "Smashcraft ${name}" { NumGeosets ${shapes.length}, NumBones 1, BlendTime 0, ${extent} }
        Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${extent} } }
        Textures 1 { Bitmap { Image "war3mapImported\\${textureName}", } }
        Materials ${name === "Defile" ? 3 : 2} {
            Material { Layer { FilterMode Additive, Unshaded, TwoSided, Unfogged, NoDepthSet, static TextureID 0, static Alpha 1, } }
            Material { Layer { FilterMode Blend, Unshaded, TwoSided, Unfogged, NoDepthSet, static TextureID 0, static Alpha 1, } }
            ${name === "Defile" ? 'Material { Layer { FilterMode Blend, Unshaded, TwoSided, Unfogged, NoDepthSet, static TextureID 0, static Alpha 1, } }' : ''}
        }
        ${geometry}
        ${name === "Defile" ? 'GeosetAnim { static Alpha 1, static Color { 0.045, 0.025, 0.065 }, GeosetId 0, }' : ''}
        Bone "Impact" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
        ${name === "Tech" ? `Light "ContactFlash" {
            ObjectId 1, Omnidirectional,
            static AttenuationStart 0, static AttenuationEnd 320,
            Intensity 3 { Linear, 0: 0.55, 90: 0.25, 180: 0, }
            static Color { 0.65, 0.8, 1 },
            static AmbIntensity 0, static AmbColor { 0, 0, 0 },
        }` : ""}
        PivotPoints ${name === "Tech" ? 2 : 1} { { 0, 0, 0 }, ${name === "Tech" ? "{ 0, -12, 20 }," : ""} }`;
    const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
    const decoded = parseMDX(bytes.buffer);
    if (decoded.Geosets.length !== shapes.length || decoded.Sequences.length !== 1) throw new Error(`${name}: lost effect geometry`);
    if (decoded.Lights.length !== (name === "Tech" ? 1 : 0)) throw new Error(`${name}: lost contact light`);
    for (const geoset of decoded.Geosets) {
        if (!Array.from(geoset.Vertices).every(Number.isFinite)) throw new Error(`${name}: invalid vertex`);
    }
    const filename = `Impact${name}-${hash(bytes)}.mdx`;
    await Bun.write(join(output,filename),bytes);
    await Bun.write(join(output,`Impact${name}.mdl`),mdl);
    imports.push(filename);
    assetInfo.push(`export const IMPACT_${name.toUpperCase()}_MODEL = ${JSON.stringify(`war3mapImported\\${filename}`)};`);
    preview += `<g transform="translate(${index*200+100} 120)">`;
    if (name !== "Hit") preview += '<path d="M-90 0H90" stroke="#b4bdc6"/>';
    for (const shape of shapes) {
        if (shape.soft) {
            const [[l,b],[r],,[,t]] = shape.points;
            preview += `<ellipse cx="${(l+r)/2}" cy="${-(t+b)/2}" rx="${(r-l)/2}" ry="${(t-b)/2}" fill="url(#dust)"/>`;
        } else preview += `<polygon points="${shape.points.map(([x,z])=>`${x},${-z}`).join(" ")}" fill="rgb(${colors[shape.tile].join(",")})"/>`;
    }
    preview += `</g><text x="${index*200+100}" y="185" text-anchor="middle" fill="white" font-family="sans-serif" font-size="16">${name}</text>`;
}
await Bun.write(join(output,textureName),texture);
await Bun.write(join(import.meta.dir, "../../ts/src/game/assets/impactAssetInfo.ts"),
    `// Generated by tools/effects/package.ts from the authored impact models; regenerate instead of editing.\n${assetInfo.join("\n")}\n`);
await Bun.write(join(output,"imports.txt"),imports.join("\n")+"\n");
await Bun.write(join(output,"preview.svg"),preview+"</svg>");
console.log(`${models.length} original impact models: MDX roundtrip geometry passed; static poses, adapter-driven fade/expansion.`);
