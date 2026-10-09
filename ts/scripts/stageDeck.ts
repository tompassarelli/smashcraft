





import { type DeckPalette, NEUTRAL_DECK_PALETTE } from "../src/game/assets/stagePalette";
import { SurfaceContact } from "../src/game/sim/codes";
import { MAIN_DECK_BODY_SURFACES, mainDeckLeft, mainDeckRight, mainDeckZ, surfaceLine, solidSurfaceAt, solidSurfaceCount } from "../src/game/sim/stage";

type Vector3 = readonly [x: number, y: number, z: number];
export type OutlinePoint = readonly [x: number, z: number];

const hash = (bytes: Uint8Array | string) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");


const DeckMaterial = { slate: 0, brass: 1, charcoal: 2, steel: 3 } as const;
type DeckMaterial = (typeof DeckMaterial)[keyof typeof DeckMaterial];
const MATERIALS = 4;


export function paletteTexture(palette: DeckPalette) {
  const colors = [palette.top, palette.lip, palette.body, palette.underside];
  const bytes = new Uint8Array(18 + MATERIALS * 4);
  bytes[2] = 2;
  bytes[12] = MATERIALS;
  bytes[14] = 1;
  bytes[16] = 32;
  bytes[17] = 0x28;
  colors.forEach(([r, g, b], i) => bytes.set([b, g, r, 255], 18 + i * 4));
  const coordinate = (material: DeckMaterial): readonly [u: number, v: number] => [(material + 0.5) / MATERIALS, 0.5];
  return { bytes, name: `StagePalette-${hash(bytes)}.tga`, coordinate };
}


export const STAGE_PALETTE_TEXTURE = paletteTexture(NEUTRAL_DECK_PALETTE);

type OutlineKind = "floor" | "wall" | "ceiling";


interface OutlineLine {
  readonly kind: OutlineKind;
  readonly start: OutlinePoint;
  readonly end: OutlinePoint;
  readonly normal: OutlinePoint;
}







function mainDeckOutline(stage: number): OutlineLine[] {
  const left = mainDeckLeft(stage);
  const right = mainDeckRight(stage);
  const center = (left + right) / 2;
  const floor = mainDeckZ(stage);
  const point = (x: number, z: number): OutlinePoint => [x - center, z - floor];
  const line = surfaceLine(stage, 0);
  const lines: OutlineLine[] = [];
  if (line === undefined) lines.push({ kind: "floor", start: point(left, floor), end: point(right, floor), normal: [0, 1] });
  else for (let index = 0; index < line.grades.length; index++) {
    const x1 = line.xs[index]; const z1 = line.zs[index];
    const x2 = line.xs[index + 1]; const z2 = line.zs[index + 1];
    const grade = line.grades[index]; const cosine = line.cosines[index];
    if (x1 === undefined || z1 === undefined || x2 === undefined || z2 === undefined || grade === undefined || cosine === undefined) throw new Error("incomplete ground line");
    lines.push({ kind: "floor", start: point(x1, z1), end: point(x2, z2), normal: [-grade * cosine, cosine] });
  }
  for (let index = 0; index < MAIN_DECK_BODY_SURFACES; index++) {
    const line = solidSurfaceAt(stage, index);
    lines.push({
      kind: line.kind === SurfaceContact.ceiling ? "ceiling" : "wall",
      start: point(line.startX, line.startZ),
      end: point(line.endX, line.endZ),
      normal: [line.normalX, line.normalZ],
    });
  }
  return lines;
}


export interface DeckFace {
  readonly material: DeckMaterial;
  readonly normal: Vector3;
  readonly corners: readonly Vector3[];
}


export const MAIN_DECK_HALF_DEPTH = 60;

const LIP_TOP = -7;
const LIP_BOTTOM = -11;

const materialOf: Readonly<Record<OutlineKind, DeckMaterial>> = { floor: DeckMaterial.slate, wall: DeckMaterial.charcoal, ceiling: DeckMaterial.steel };


function crossing(line: OutlineLine, z: number): number {
  const [startX, startZ] = line.start;
  const [endX, endZ] = line.end;
  if (z === startZ) return startX;
  if (z === endZ) return endX;
  return startX + ((endX - startX) * (z - startZ)) / (endZ - startZ);
}







function frontAndBack(outline: readonly OutlineLine[]): DeckFace[] {
  const heights = outline.map(({ start }) => start[1]);
  const top = Math.max(...heights);
  const bottom = Math.min(...heights);
  const levels = [...new Set([...heights, LIP_TOP, LIP_BOTTOM])].filter((z) => z <= top && z >= bottom).sort((a, b) => b - a);
  const faces: DeckFace[] = [];
  for (let band = 0; band + 1 < levels.length; band++) {
    const high = levels[band] ?? top;
    const low = levels[band + 1] ?? bottom;
    const middle = (high + low) / 2;
    const sides = outline.filter(({ start, end }) => Math.min(start[1], end[1]) <= low && Math.max(start[1], end[1]) >= high && start[1] !== end[1]);
    const [leftSide, rightSide, extra] = sides.sort((a, b) => crossing(a, middle) - crossing(b, middle));
    if (leftSide === undefined || rightSide === undefined || extra !== undefined) {
      throw new Error(`the outline crosses height ${middle} ${sides.length} times, not twice`);
    }
    const material = high > LIP_TOP ? DeckMaterial.slate : high > LIP_BOTTOM ? DeckMaterial.brass : DeckMaterial.charcoal;
    const at = (side: OutlineLine, z: number, y: number): Vector3 => [crossing(side, z), y, z];
    const front = -MAIN_DECK_HALF_DEPTH;
    const back = MAIN_DECK_HALF_DEPTH;
    faces.push({ material, normal: [0, -1, 0], corners: [at(leftSide, low, front), at(rightSide, low, front), at(rightSide, high, front), at(leftSide, high, front)] });
    faces.push({ material, normal: [0, 1, 0], corners: [at(leftSide, high, back), at(rightSide, high, back), at(rightSide, low, back), at(leftSide, low, back)] });
  }
  return faces;
}


export const mainDeckOutlineStage = (stage: number): number => (solidSurfaceCount(stage) >= MAIN_DECK_BODY_SURFACES ? stage : 0);


export function mainDeckFaces(stage: number): DeckFace[] {
  const outline = mainDeckOutline(stage);
  outline.forEach((line, index) => {
    const next = outline[(index + 1) % outline.length];
    if (next === undefined || line.end[0] !== next.start[0] || line.end[1] !== next.start[1]) {
      throw new Error(`the main deck's outline is open after line ${index}`);
    }
  });
  const sides = outline.map(({ kind, start, end, normal }): DeckFace => ({
    material: materialOf[kind],
    normal: [normal[0], 0, normal[1]],
    corners: [
      [start[0], -MAIN_DECK_HALF_DEPTH, start[1]], [end[0], -MAIN_DECK_HALF_DEPTH, end[1]],
      [end[0], MAIN_DECK_HALF_DEPTH, end[1]], [start[0], MAIN_DECK_HALF_DEPTH, start[1]],
    ],
  }));
  return [...frontAndBack(outline), ...sides];
}

// MDL numbers cannot use exponent notation.
function mdlNumber(value: number): string {
  const text = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(`${text} has no plain MDL form`);
  return text;
}

const vector = (values: readonly number[]) => `{ ${values.map(mdlNumber).join(", ")} }`;


export function mainDeckMdl(faces: readonly DeckFace[], textureName: string): string {
  const corners = faces.flatMap((face) => face.corners.map((corner) => ({ corner, face })));
  const triangles: number[] = [];
  let first = 0;
  for (const { corners: polygon } of faces) {
    for (let corner = 1; corner + 1 < polygon.length; corner++) triangles.push(first, first + corner, first + corner + 1);
    first += polygon.length;
  }
  const points = corners.map(({ corner }) => corner);
  const low = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis] ?? 0)));
  const high = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis] ?? 0)));
  const radius = Math.ceil(Math.max(...points.map(([x, y, z]) => Math.hypot(x, y, z))));
  const extent = `MinimumExtent ${vector(low)}, MaximumExtent ${vector(high)}, BoundsRadius ${radius},`;
  return `Version { FormatVersion 800, }
Model "Smashcraft main deck" { NumGeosets 1, NumBones 1, BlendTime 0, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${extent} } }
Textures 1 { Bitmap { Image "war3mapImported\\${textureName}", } }
Materials 1 { Material { Layer { FilterMode None, Unshaded, static TextureID 0, static Alpha 1, } } }
Geoset {
    Vertices ${points.length} { ${points.map((point) => `${vector(point)},`).join("\n")} }
    Normals ${points.length} { ${corners.map(({ face }) => `${vector(face.normal)},`).join("\n")} }
    TVertices ${points.length} { ${corners.map(({ face }) => `${vector(STAGE_PALETTE_TEXTURE.coordinate(face.material))},`).join("\n")} }
    VertexGroup { ${points.map(() => "0,").join(" ")} }
    Faces 1 ${triangles.length} { Triangles { ${vector(triangles)}, } }
    Groups 1 1 { Matrices { 0 }, }
    ${extent}
    Anim { ${extent} }
    MaterialID 0,
    SelectionGroup 0,
}
Bone "Deck" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;
}






export const mainDeckModelFile = (mdl: string) => `StageMainDeck-${hash(mdl)}.mdx`;
