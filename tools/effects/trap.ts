// Foreign MDX boundary: original trap and translucent ice-shell geometry.
import { parseMDL, generateMDX, parseMDX } from "../animations/node_modules/war3-model";
import { join } from "node:path";

const output = join(import.meta.dir, "../../build/impact-assets");
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
type V = [number, number, number];
type Face = { vertices: V[], color: number, translucent?: boolean };
const colors = [[34,81,117], [86,169,220], [154,226,255], [225,249,255]];
const texture = new Uint8Array(18 + 4 * 4);
texture[2] = 2; texture[12] = 4; texture[14] = 1;
texture[16] = 32; texture[17] = 0x28;
colors.forEach(([r,g,b],i) => texture.set([b,g,r,255],18+i*4));
const textureName = `FrostPalette-${hash(texture)}.tga`;
const vector = (v: number[]) => `{ ${v.join(", ")} }`;
const extent = "MinimumExtent { -65, -50, 0 }, MaximumExtent { 65, 50, 150 }, BoundsRadius 170,";
const shell: Face[] = [];
const trap: Face[] = [];
const ring = (rx: number, ry: number, z: number, i: number): V =>
    [rx*Math.cos(i*Math.PI/4), ry*Math.sin(i*Math.PI/4), z];
for (let i=0; i<8; i++) {
    // Unequal shoulder heights make a crystalline cap, while the transparent
    // front facets keep the trapped fighter's silhouette visible.
    const a = ring(56,38,4,i), b = ring(56,38,4,i+1);
    const c = ring(49,32,110+(i%3)*7,i+1), d = ring(49,32,110+((i+2)%3)*7,i);
    shell.push({vertices:[a,b,c,d],color:1+i%3,translucent:true});
    shell.push({vertices:[d,c,[8,-3,150]],color:2+i%2,translucent:true});
    // Narrow bright ribs help read the outline without an opaque ice cube.
    const inner: V = [d[0]*.95,d[1]*.95,d[2]];
    shell.push({vertices:[a,d,inner,[a[0]*.95,a[1]*.95,a[2]]],color:3});
    trap.push({vertices:[ring(46,30,2,i),ring(46,30,2,i+1),ring(34,22,3,i+1),ring(34,22,3,i)],color:i%2});
    trap.push({vertices:[ring(42,27,4,i),ring(42,27,4,i+.34),ring(36,23,4,i+.34),ring(36,23,4,i)],color:3});
    const foot = ring(23,14,3,i);
    const apex: V = [foot[0]*1.15,foot[1]*1.15,15+i%3*4];
    trap.push({vertices:[[foot[0]-5,foot[1]-4,3],[foot[0]+5,foot[1]-4,3],apex],color:2});
    trap.push({vertices:[[foot[0]+5,foot[1]-4,3],[foot[0]+5,foot[1]+4,3],apex],color:1});
}
trap.push({vertices:[[-12,-9,3],[12,-9,3],[12,9,3],[-12,9,3]],color:1});
trap.push({vertices:[[-10,-2,4],[10,-2,4],[10,2,4],[-10,2,4]],color:3});
trap.push({vertices:[[-2,-8,4],[2,-8,4],[2,8,4],[-2,8,4]],color:3});

const imports = [textureName];
const assetInfo: string[] = [];
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240"><rect width="640" height="240" fill="#18202c"/>';
for (const [index,[name,faces]] of ([['Trap',trap],['Ice',shell]] as [string,Face[]][]).entries()) {
    const geosets = faces.map(({vertices,color,translucent}) => {
        const n = vertices.length;
        const triangles = Array.from({length:n-2},(_,i)=>[0,i+1,i+2]).flat();
        return `Geoset {
            Vertices ${n} { ${vertices.map(v=>vector(v)+",").join(" ")} }
            Normals ${n} { ${Array(n).fill("{ 0, -1, 0 },").join(" ")} }
            TVertices ${n} { ${Array(n).fill(vector([(color+.5)/4,.5])+",").join(" ")} }
            VertexGroup { ${Array(n).fill("0,").join(" ")} }
            Faces 1 ${triangles.length} { Triangles { ${vector(triangles)}, } }
            Groups 1 1 { Matrices { 0 }, }
            ${extent} Anim { ${extent} } MaterialID ${translucent?1:0}, SelectionGroup 0,
        }`;
    }).join("\n");
    const mdl = `Version { FormatVersion 800, }
        Model "Smashcraft Frost ${name}" { NumGeosets ${faces.length}, NumBones 1, BlendTime 0, ${extent} }
        Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${extent} } }
        Textures 1 { Bitmap { Image "war3mapImported\\${textureName}", } }
        Materials 2 {
            Material { Layer { FilterMode None, Unshaded, TwoSided, Unfogged, static TextureID 0, static Alpha 1, } }
            Material { Layer { FilterMode Blend, Unshaded, TwoSided, Unfogged, NoDepthSet, static TextureID 0, static Alpha 0.32, } }
        }
        ${geosets}
        Bone "Frost" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
        PivotPoints 1 { { 0, 0, 0 }, }`;
    const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
    const decoded = parseMDX(bytes.buffer);
    if (decoded.Geosets.length !== faces.length) throw new Error(`${name}: geometry lost`);
    for (const face of decoded.Geosets) {
        const v = Array.from(face.Vertices);
        if (!v.every(Number.isFinite) || v.some((p,i)=>i%3===2 && (p<0 || p>150)))
            throw new Error(`${name}: invalid geometry bounds`);
    }
    const filename = `Frost${name}-${hash(bytes)}.mdx`;
    await Bun.write(join(output,filename),bytes);
    await Bun.write(join(output,`Frost${name}.mdl`),mdl);
    imports.push(filename);
    assetInfo.push(`export const FROST_${name.toUpperCase()}_MODEL = ${JSON.stringify(`war3mapImported\\${filename}`)};`);
    svg += `<g transform="translate(${160+index*320} 190)">`;
    for (const f of faces) svg += `<polygon points="${f.vertices.map(([x,y,z])=>`${x+y*.3},${-z+y*.3}`).join(' ')}" fill="rgb(${colors[f.color].join(',')})" opacity="${f.translucent?.4:1}"/>`;
    svg += `</g><text x="${160+index*320}" y="223" fill="white" text-anchor="middle" font-family="sans-serif">${name}</text>`;
}
await Bun.write(join(output,textureName),texture);
await Bun.write(join(import.meta.dir, "../../ts/src/game/assets/frostAssetInfo.ts"),
    `// Generated by tools/effects/trap.ts from the authored frost models; regenerate instead of editing.\n${assetInfo.join("\n")}\n`);
await Bun.write(join(output,"frost-imports.txt"),imports.join("\n")+"\n");
await Bun.write(join(output,"frost-preview.svg"),svg+"</svg>");
console.log("Original trap/ice models: packaged geometry and vertical bounds passed.");
