// The stage decks' palette and the main deck's model, which
// tools/stage/package.ts writes. The main deck is drawn from its collision:
// the walking line, then the walls and underside of
// smashcraft:ts/src/game/sim/stage.ts, as one outline extruded through the
// deck's depth. Plain data and MDL text, so the logic tests check the model
// against the collision lines without the model compiler.
import { STAGE_PALETTE } from "../src/game/assets/stagePalette";
import { SurfaceContact } from "../src/game/sim/codes";
import { MAIN_DECK_BODY_SURFACES, mainDeckLeft, mainDeckRight, mainDeckZ, solidSurfaceAt } from "../src/game/sim/stage";

type Vector3 = readonly [x: number, y: number, z: number];
export type OutlinePoint = readonly [x: number, z: number];

const hash = (bytes: Uint8Array | string) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

/** One texel per material, in material order: slate walking surface, brass lip, charcoal body, recessed steel. */
const MATERIAL_COLORS = [STAGE_PALETTE.slate, STAGE_PALETTE.brass, STAGE_PALETTE.charcoal, STAGE_PALETTE.steel];
const DeckMaterial = { slate: 0, brass: 1, charcoal: 2, steel: 3 } as const;
type DeckMaterial = (typeof DeckMaterial)[keyof typeof DeckMaterial];

/** The decks' palette texture, an uncompressed TGA, its content-addressed name, and the texture coordinate of each material's texel. */
export const STAGE_PALETTE_TEXTURE = (() => {
  const bytes = new Uint8Array(18 + MATERIAL_COLORS.length * 4);
  bytes[2] = 2;
  bytes[12] = MATERIAL_COLORS.length;
  bytes[14] = 1;
  bytes[16] = 32;
  bytes[17] = 0x28;
  MATERIAL_COLORS.forEach(([r, g, b], i) => bytes.set([b, g, r, 255], 18 + i * 4));
  const coordinate = (material: DeckMaterial): readonly [u: number, v: number] => [(material + 0.5) / MATERIAL_COLORS.length, 0.5];
  return { bytes, name: `StagePalette-${hash(bytes)}.tga`, coordinate };
})();

type OutlineKind = "floor" | "wall" | "ceiling";

/** One line of the deck's outline, the solid behind its outward normal. */
interface OutlineLine {
  readonly kind: OutlineKind;
  readonly start: OutlinePoint;
  readonly end: OutlinePoint;
  readonly normal: OutlinePoint;
}

/**
 * The main deck's collision outline on `stage`, in model units: arena x and z
 * from the deck's center at floor height. The walking line runs from the left
 * ledge to the right one, then the walls and underside follow in the stage's
 * order, back to the left ledge.
 */
function mainDeckOutline(stage: number): OutlineLine[] {
  const left = mainDeckLeft(stage);
  const right = mainDeckRight(stage);
  const center = (left + right) / 2;
  const floor = mainDeckZ(stage);
  const point = (x: number, z: number): OutlinePoint => [x - center, z - floor];
  const lines: OutlineLine[] = [{ kind: "floor", start: point(left, floor), end: point(right, floor), normal: [0, 1] }];
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

/** A flat polygon of the model, counter-clockwise seen from outside, so `normal` faces out. */
export interface DeckFace {
  readonly material: DeckMaterial;
  readonly normal: Vector3;
  readonly corners: readonly Vector3[];
}

/** Half the deck's depth, as the walking surface of the raised decks' model. */
export const MAIN_DECK_HALF_DEPTH = 60;
/** The front face's slate walking edge and brass lip, as the raised decks' model draws them. */
const LIP_TOP = -7;
const LIP_BOTTOM = -11;

const materialOf: Readonly<Record<OutlineKind, DeckMaterial>> = { floor: DeckMaterial.slate, wall: DeckMaterial.charcoal, ceiling: DeckMaterial.steel };

/** Where a line that spans height `z` crosses it; its own ends exactly. */
function crossing(line: OutlineLine, z: number): number {
  const [startX, startZ] = line.start;
  const [endX, endZ] = line.end;
  if (z === startZ) return startX;
  if (z === endZ) return endX;
  return startX + ((endX - startX) * (z - startZ)) / (endZ - startZ);
}

/**
 * The deck's front and back faces: the outline cut into level bands at each
 * of its corners and the lip's edges. Each band runs between the two lines
 * that span it, so the outline must cross every height between the floor
 * and the underside exactly twice.
 */
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

/** The main deck: its outline's front and back faces, and each outline line drawn through the depth facing out along its normal. */
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

/** A number as MDL text writes it; MDL has no exponents. */
function mdlNumber(value: number): string {
  const text = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(`${text} has no plain MDL form`);
  return text;
}

const vector = (values: readonly number[]) => `{ ${values.map(mdlNumber).join(", ")} }`;

/** The main deck's MDL text: one geoset holding every face, each corner its own vertex. */
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

/**
 * The main deck's model file. It is named after its MDL text rather than the
 * compiled model, so a test can tell from the collision alone whether the
 * shipped model is the one drawn from it.
 */
export const mainDeckModelFile = (mdl: string) => `StageMainDeck-${hash(mdl)}.mdx`;
