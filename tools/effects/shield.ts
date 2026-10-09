
import { parseMDL, generateMDX, parseMDX } from "../animations/node_modules/war3-model";
import { join } from "node:path";

const output = join(import.meta.dir, "../../build/impact-assets");
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const colors = [[216,44,62], [40,123,213], [231,191,50], [53,167,91]];
const size = 512, radius = 72, segments = 64, rings = 16;
const vector = (v: number[]) => `{ ${v.map(n => +n.toFixed(6)).join(", ")} }`;
const extent = `MinimumExtent { -72, -72, -72 }, MaximumExtent { 72, 72, 72 }, BoundsRadius 72,`;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const gaussian = (n: number) => Math.exp(-n * n / 2);
const geometry: string[] = [];
for (const side of [-1, 1]) {
    const vertices: number[][] = [], normals: number[][] = [], uvs: number[][] = [], faces: number[] = [];
    function vertex(theta: number, phi: number) {
        const x = Math.sin(theta) * Math.cos(phi), up = Math.sin(theta) * Math.sin(phi);
        const depth = side * Math.cos(theta), angle = Math.PI / 18;

        const normal = [x, -depth * Math.cos(angle) + up * Math.sin(angle), depth * Math.sin(angle) + up * Math.cos(angle)];
        vertices.push(normal.map(n => n * radius)); normals.push(normal); uvs.push([.5 + x / 2, .5 - up / 2]);
    }
    vertex(0, 0);
    for (let ring = 1; ring <= rings; ring++) for (let i = 0; i < segments; i++) vertex(ring * Math.PI / (2 * rings), i * Math.PI * 2 / segments);
    for (let i = 0; i < segments; i++) faces.push(0, 1 + i, 1 + (i + 1) % segments);
    for (let ring = 1; ring < rings; ring++) for (let i = 0; i < segments; i++) {
        const a = 1 + (ring - 1) * segments + i, b = 1 + (ring - 1) * segments + (i + 1) % segments;
        const c = 1 + ring * segments + i, d = 1 + ring * segments + (i + 1) % segments;
        faces.push(a, c, d, a, d, b);
    }
    const n = vertices.length;
    geometry.push(`Geoset {
        Vertices ${n} { ${vertices.map(v => vector(v) + ",").join(" ")} }
        Normals ${n} { ${normals.map(v => vector(v) + ",").join(" ")} }
        TVertices ${n} { ${uvs.map(v => vector(v) + ",").join(" ")} }
        VertexGroup { ${Array(n).fill("0,").join(" ")} }
        Faces 1 ${faces.length} { Triangles { ${vector(faces)}, } }
        Groups 1 1 { Matrices { 0 }, }
        ${extent} Anim { ${extent} } MaterialID ${side < 0 ? 0 : 1}, SelectionGroup 0,
    }`);
}
const imports: string[] = [];
const assetInfo: string[] = [];
for (const [slot, color] of colors.entries()) {
    const texture = new Uint8Array(18 + size * size * 4);
    texture[2] = 2; texture[12] = size & 255; texture[13] = size >> 8;
    texture[14] = size & 255; texture[15] = size >> 8; texture[16] = 32; texture[17] = 0x28;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = (x + .5) * 2 / size - 1, v = 1 - (y + .5) * 2 / size;
        const r = Math.hypot(u, v);
        const edge = gaussian((r - .963) / .024);
        const halo = gaussian((r - .92) / .065);
        const gloss = gaussian((u + .27) / .105) * gaussian((v - .67) / .042);
        const lower = gaussian(u / .48) * gaussian((v + .70) / .15);
        const white = clamp(edge * (.40 + .54 * Math.abs(v) ** 3) + gloss * .96 + lower * .29);
        const alpha = clamp((.13 + .19 * halo + .44 * edge + .62 * gloss + .10 * lower) * clamp((1 - r) / .015));
        const rgb = color.map(c => Math.round(c + (255 - c) * white));
        texture.set([rgb[2], rgb[1], rgb[0], Math.round(alpha * 255)], 18 + (y * size + x) * 4);
    }
    const textureName = `ShieldP${slot + 1}-${hash(texture)}.tga`;
    const mdl = `Version { FormatVersion 800, }
        Model "Smashcraft Shield P${slot + 1}" { NumGeosets 2, NumBones 1, BlendTime 0, ${extent} }
        Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${extent} } }
        Textures 1 { Bitmap { Image "war3mapImported\\${textureName}", } }
        Materials 2 {
            Material { PriorityPlane 0, Layer { FilterMode Blend, Unshaded, TwoSided, Unfogged, NoDepthSet, static TextureID 0, static Alpha 0.18, } }
            Material { PriorityPlane 1, Layer { FilterMode Blend, Unshaded, TwoSided, Unfogged, NoDepthSet, static TextureID 0, static Alpha 1, } }
        }
        ${geometry.join("\n")}
        Bone "Shield" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
        PivotPoints 1 { { 0, 0, 0 }, }`;
    const bytes = new Uint8Array(generateMDX(parseMDL(mdl)));
    const decoded = parseMDX(bytes.buffer);
    if (decoded.Geosets.length !== 2 || decoded.Sequences.length !== 1) throw new Error("Shield sphere lost in MDX roundtrip");
    for (const geoset of decoded.Geosets) {
        const v = Array.from(geoset.Vertices);
        for (let i = 0; i < v.length; i += 3) if (Math.abs(Math.hypot(v[i], v[i + 1], v[i + 2]) - radius) > .001) throw new Error("Shield vertex left sphere");
    }
    const centerAlpha = texture[18 + ((size / 2) * size + size / 2) * 4 + 3];
    if (centerAlpha > 40 || centerAlpha < 25) throw new Error("Shield center must preserve fighter visibility");
    const modelName = `ShieldP${slot + 1}-${hash(bytes)}.mdx`;
    await Bun.write(join(output, textureName), texture);
    await Bun.write(join(output, modelName), bytes);
    await Bun.write(join(output, `ShieldP${slot + 1}.mdl`), mdl);
    imports.push(textureName, modelName);
    assetInfo.push(`export const SHIELD_P${slot + 1}_MODEL = ${JSON.stringify(`war3mapImported\\${modelName}`)};`);
}
await Bun.write(join(import.meta.dir, "../../ts/src/game/assets/shieldAssetInfo.ts"),
    `// Generated by tools/effects/shield.ts from the authored shield models; regenerate instead of editing.\n${assetInfo.join("\n")}\n`);
await Bun.write(join(output, "shield-imports.txt"), imports.join("\n") + "\n");
console.log("Four original shields: 2050 vertices/3968 triangles each; MDX sphere roundtrip and transparent-center checks passed; static baked lighting.");
