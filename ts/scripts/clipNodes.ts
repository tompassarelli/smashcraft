export { parseMDX, generateMDX, ModelRenderer, model } from "war3-model";
// Warcraft requires ObjectIds and pivots to follow file order (native Illidan light capture).








interface Node {
  readonly Name?: string;
  ObjectId: number | null;
  Parent?: number | null;
}


interface NodeTable {
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


function fileOrder(model: NodeTable): Node[] {
  return [
    ...model.Bones, ...model.Lights, ...model.Helpers, ...model.Attachments, ...model.ParticleEmitters,
    ...model.ParticleEmitters2, ...(model.ParticleEmitterPopcorns ?? []), ...model.RibbonEmitters,
    ...model.EventObjects, ...model.CollisionShapes,
  ];
}

const isRoot = (parent: number | null | undefined): parent is null | undefined => parent === null || parent === undefined;


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
