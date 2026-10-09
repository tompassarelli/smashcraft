import { MeshoptSimplifier } from "meshoptimizer";
import { model as mdx } from "war3-model";
import { removeGeosets } from "../../ts/scripts/groundPlanes";

export interface Decimation { readonly ratio: number; readonly error: number; readonly lockBorder?: boolean }

const hiddenThroughout = (animation: mdx.GeosetAnim | undefined) => {
  const alpha = animation?.Alpha;
  if (alpha === undefined) return false;
  return typeof alpha === "number" ? alpha === 0 : alpha.Keys.every(key => key.Vector[0] === 0);
};

function simplifyGeoset(geoset: mdx.Geoset, { ratio, error, lockBorder = false }: Decimation): void {
  const count = geoset.Vertices.length / 3;
  const skin = geoset.SkinWeights;
  const representative = new Uint32Array(count);
  const seen = new Map<string, number>();
  for (let vertex = 0; vertex < count; vertex++) {
    const position = Array.from(geoset.Vertices.subarray(vertex * 3, vertex * 3 + 3)).join(",");
    const weights = skin === undefined ? "" : Array.from(skin.subarray(vertex * 8, vertex * 8 + 8)).join(",");
    const key = `${position}|${weights}`;
    const known = seen.get(key);
    representative[vertex] = known ?? vertex;
    if (known === undefined) seen.set(key, vertex);
  }
  const welded = Uint32Array.from(geoset.Faces, index => representative[index] ?? index);
  const target = Math.max(3, Math.floor(welded.length * ratio / 3) * 3);
  const [indices] = MeshoptSimplifier.simplify(welded, geoset.Vertices, 3, target, error, lockBorder ? ["LockBorder"] : []);
  const kept = [...new Set(indices)].sort((a, b) => a - b);
  const remap = new Map(kept.map((vertex, index) => [vertex, index]));
  const pick = <T extends Float32Array | Uint8Array>(values: T, width: number): T => {
    const out = new (values.constructor as new (length: number) => T)(kept.length * width);
    kept.forEach((vertex, index) => out.set(values.subarray(vertex * width, vertex * width + width), index * width));
    return out;
  };
  geoset.Vertices = pick(geoset.Vertices, 3);
  geoset.Normals = pick(geoset.Normals, 3);
  if (geoset.Tangents !== undefined) geoset.Tangents = pick(geoset.Tangents, 4);
  if (skin !== undefined) geoset.SkinWeights = pick(skin, 8);
  if (geoset.VertexGroup.length === count) geoset.VertexGroup = pick(geoset.VertexGroup, 1);
  geoset.TVertices = geoset.TVertices.map(uv => pick(uv, 2));
  geoset.Faces = Uint16Array.from(indices, vertex => remap.get(vertex) ?? 0);
}

/** A light white silhouette: one level of detail, no hidden geosets, simplified meshes, and keys only on nodes that move drawn vertices. */
export function decimateWhiteBody(model: mdx.Model, decimation: Decimation): void {
  const animations = new Map(model.GeosetAnims.map(animation => [animation.GeosetId, animation]));
  removeGeosets(model, new Set(model.Geosets.flatMap((geoset, index) => geoset.LevelOfDetail > 0 || hiddenThroughout(animations.get(index)) ? [index] : [])));
  for (const geoset of model.Geosets) simplifyGeoset(geoset, decimation);
  pruneLinearKeys(model);
  const parents = new Map(model.Nodes.filter(node => node !== undefined).map(node => [node.ObjectId, node.Parent]));
  const used = new Set<number>();
  for (const geoset of model.Geosets) {
    const skin = geoset.SkinWeights;
    const groups = geoset.Groups;
    const mark = (group: number) => { for (const node of groups[group] ?? []) used.add(node); };
    if (skin !== undefined) {
      for (let vertex = 0; vertex < skin.length / 8; vertex++) for (let slot = 0; slot < 4; slot++) if ((skin[vertex * 8 + 4 + slot] ?? 0) > 0) mark(skin[vertex * 8 + slot] ?? 0);
    } else for (const group of geoset.VertexGroup) mark(group);
  }
  for (const node of [...used]) for (let parent = parents.get(node); parent !== undefined && parent !== null && parent >= 0 && !used.has(parent); parent = parents.get(parent)) used.add(parent);
  for (const node of model.Nodes) {
    if (node === undefined || used.has(node.ObjectId)) continue;
    delete node.Translation;
    delete node.Rotation;
    delete node.Scaling;
  }
}

const EPSILON: Readonly<Record<string, number>> = { Translation: 0.1, Rotation: 0.004, Scaling: 0.001 };

/** Drops linear keys that their kept neighbours already reproduce within a hair. */
export function pruneLinearKeys(model: mdx.Model): void {
  for (const node of model.Nodes) {
    if (node === undefined) continue;
    for (const name of ["Translation", "Rotation", "Scaling"] as const) {
      const track = node[name];
      if (track === undefined || track.LineType !== mdx.LineType.Linear || track.Keys.length < 3) continue;
      const epsilon = EPSILON[name] ?? 0;
      const keys = track.Keys;
      const kept = [keys[0]!];
      let start = 0;
      for (let index = 1; index < keys.length - 1; index++) {
        const from = keys[start]!, to = keys[index + 1]!;
        let fits = true;
        for (let between = start + 1; between <= index && fits; between++) {
          const key = keys[between]!;
          const t = (key.Frame - from.Frame) / Math.max(1, to.Frame - from.Frame);
          for (let axis = 0; axis < key.Vector.length && fits; axis++) {
            const expected = from.Vector[axis]! + (to.Vector[axis]! - from.Vector[axis]!) * t;
            fits = Math.abs(expected - key.Vector[axis]!) <= epsilon;
          }
        }
        if (!fits) { kept.push(keys[index]!); start = index; }
      }
      kept.push(keys[keys.length - 1]!);
      track.Keys = kept;
    }
  }
}

const MANTISSA_BITS = 10;

function roundMantissa(values: Float32Array): void {
  const bits = new Uint32Array(values.buffer, values.byteOffset, values.length);
  const drop = 23 - MANTISSA_BITS, half = 1 << (drop - 1), mask = ~((1 << drop) - 1) >>> 0;
  for (let index = 0; index < bits.length; index++) {
    const exponent = (bits[index]! >>> 23) & 0xff;
    if (exponent !== 0 && exponent !== 0xff) bits[index] = ((bits[index]! + half) & mask) >>> 0;
  }
}

/** Rounds geometry and key floats to 10 mantissa bits (relative error under 0.05%) so they compress. */
export function roundGeometry(model: mdx.Model): void {
  for (const geoset of model.Geosets) {
    roundMantissa(geoset.Vertices);
    roundMantissa(geoset.Normals);
    if (geoset.Tangents !== undefined) roundMantissa(geoset.Tangents);
    geoset.TVertices.forEach(roundMantissa);
  }
  for (const node of model.Nodes) {
    if (node === undefined) continue;
    for (const name of ["Translation", "Rotation", "Scaling"] as const) {
      for (const key of node[name]?.Keys ?? []) for (const values of [key.Vector, key.InTan, key.OutTan]) if (values instanceof Float32Array) roundMantissa(values);
    }
  }
}
