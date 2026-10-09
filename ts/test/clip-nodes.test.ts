import { expect, test } from "bun:test";
import { type NodeTable, misplacedNodes, renumberNodes } from "../scripts/clipNodes";






function illidanShapedClip(): NodeTable {
  const node = (Name: string, ObjectId: number, Parent: number | null) => ({ Name, ObjectId, Parent });
  return {
    Bones: [node("hero glow", 0, null), node("forearm", 1, 4)],
    Lights: [],
    Helpers: [node("Bone_Root", 3, null), node("Bone_Arm", 4, 3)],
    Attachments: [node("Hand Ref", 5, 4)],
    ParticleEmitters: [],
    ParticleEmitters2: [],
    RibbonEmitters: [],
    EventObjects: [],
    CollisionShapes: [node("collision", 7, null)],
    Geosets: [{ Groups: [[0], [1]] }, { Groups: [[1]] }],
    PivotPoints: Array.from({ length: 8 }, (_, id) => new Float32Array([id, 0, 10 * id])),
    Nodes: [],
  };
}


function skeleton(model: NodeTable) {
  const nodes = [...model.Bones, ...model.Helpers, ...model.Attachments, ...model.CollisionShapes];
  const name = (id: number | null | undefined) => (id === null || id === undefined ? null : nodes.find((node) => node.ObjectId === id)?.Name);
  return {
    nodes: nodes.map((node) => [node.Name, name(node.Parent), [...(model.PivotPoints[node.ObjectId ?? -1] ?? [])]]),
    skin: model.Geosets.map((geoset) => geoset.Groups.map((group) => group.map(name))),
  };
}

test("renumbering puts every node at its place with the same parent, pivot and skin [invariant]", () => {
  const clip = illidanShapedClip();
  const before = skeleton(clip);
  renumberNodes(clip);
  expect(misplacedNodes(clip)).toEqual([]);
  expect(skeleton(clip)).toEqual(before);
  expect(clip.Nodes.map((node) => node.Name)).toEqual(["hero glow", "forearm", "Bone_Root", "Bone_Arm", "Hand Ref", "collision"]);
});
