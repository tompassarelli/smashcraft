export { parseMDX, generateMDX, ModelRenderer, model } from "war3-model";
// The node table of an MDX model, as tools/animations/original-clips.ts
// writes the pooled fighters' clip models. Warcraft does not read a node's
// ObjectId as written: Illidan's standalone light, written alone with
// ObjectId 155 beside a 276-entry pivot table, lit from the wrong place
// natively and lit exactly once numbered 0. So a model that drops nodes
// numbers the rest by their place in the file's node order, with the pivot at
// that place.

/** A node as war3-model reads it: bones, lights, helpers, attachments, emitters, events and collision shapes. */
interface Node {
  readonly Name?: string;
  ObjectId: number | null;
  Parent?: number | null;
}

/** The parts of a war3-model model that address nodes by ObjectId. */
export interface NodeTable {
  Bones: Node[];
  Lights: Node[];
  Helpers: Node[];
  Attachments: Node[];
  ParticleEmitters: Node[];
  ParticleEmitters2: Node[];
  ParticleEmitterPopcorns?: Node[];
  RibbonEmitters: Node[];
  EventObjects: Node[];
  CollisionShapes: Node[];
  Geosets: { Groups: number[][]; SkinWeights?: Uint8Array }[];
  PivotPoints: Float32Array[];
  Nodes: Node[];
}

/** The model's nodes in the order its MDX file stores them. */
function fileOrder(model: NodeTable): Node[] {
  return [
    ...model.Bones, ...model.Lights, ...model.Helpers, ...model.Attachments, ...model.ParticleEmitters,
    ...model.ParticleEmitters2, ...(model.ParticleEmitterPopcorns ?? []), ...model.RibbonEmitters,
    ...model.EventObjects, ...model.CollisionShapes,
  ];
}

const isRoot = (parent: number | null | undefined): parent is null | undefined => parent === null || parent === undefined;

/** Each node whose ObjectId, parent or pivot does not follow its place in the file's node order. */
export function misplacedNodes(model: NodeTable): string[] {
  const nodes = fileOrder(model);
  const problems = nodes.flatMap((node, place) => {
    const name = node.Name ?? `node ${place}`;
    if (node.ObjectId !== place) return [`${name} has ObjectId ${node.ObjectId} at place ${place}`];
    if (!isRoot(node.Parent) && (node.Parent < 0 || node.Parent >= nodes.length)) return [`${name} has parent ${node.Parent} of ${nodes.length} nodes`];
    return [];
  });
  if (model.PivotPoints.length !== nodes.length) problems.push(`${model.PivotPoints.length} pivots for ${nodes.length} nodes`);
  return problems;
}

/**
 * Numbers every node by its place in the file's node order. Parents, skin
 * matrices and pivots follow their node, so the skeleton and its mesh stay as
 * they were.
 */
export function renumberNodes(model: NodeTable): void {
  const nodes = fileOrder(model);
  const places = new Map<number, number>();
  nodes.forEach((node, place) => {
    if (node.ObjectId === null || places.has(node.ObjectId)) throw new Error(`${node.Name ?? place}: ObjectId ${node.ObjectId} is missing or repeated`);
    places.set(node.ObjectId, place);
  });
  const placeOf = (id: number, what: string): number => {
    const place = places.get(id);
    if (place === undefined) throw new Error(`${what} names ObjectId ${id}, which no node has`);
    return place;
  };
  const pivots = nodes.map((node) => {
    const pivot = model.PivotPoints[node.ObjectId ?? -1];
    if (pivot === undefined) throw new Error(`${node.Name ?? node.ObjectId}: no pivot`);
    return pivot;
  });
  for (const geoset of model.Geosets) {
    geoset.Groups = geoset.Groups.map((group) => group.map((id) => placeOf(id, "A skin matrix")));
    if (geoset.SkinWeights !== undefined) for (let offset = 0; offset < geoset.SkinWeights.length; offset += 8) {
      for (let influence = 0; influence < 4; influence++) if ((geoset.SkinWeights[offset + 4 + influence] ?? 0) > 0) {
        geoset.SkinWeights[offset + influence] = placeOf(geoset.SkinWeights[offset + influence] ?? 0, "A weighted skin matrix");
      }
    }
  }
  for (const node of nodes) {
    if (!isRoot(node.Parent)) node.Parent = placeOf(node.Parent, `${node.Name ?? node.ObjectId}'s parent`);
  }
  nodes.forEach((node, place) => {
    node.ObjectId = place;
  });
  model.PivotPoints = pivots;
  model.Nodes = nodes;
}
