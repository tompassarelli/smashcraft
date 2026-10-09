import { expect, test } from "bun:test";
import { model as mdx } from "war3-model";
import { keepFlashableKeys, preservesFlashKey, trimFlashTracks } from "../../tools/animations/white-flash-keys";
import { groundPlaneGeosets, removeGeosets } from "../scripts/groundPlanes";

const sequence: mdx.Sequence = {
  Name: "Attack", Interval: new Uint32Array([100, 200]), NonLooping: true,
  MoveSpeed: 0, Rarity: 0, BoundsRadius: 1,
  MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3),
};
const track = (): mdx.AnimVector => ({
  LineType: mdx.LineType.Hermite, GlobalSeqId: -1,
  Keys: [0, 100, 150, 200, 300].map(Frame => ({ Frame,
    Vector: new Float32Array([Frame]), InTan: new Float32Array([1]), OutTan: new Float32Array([2]),
  })),
});

test("white flash preserves independent global-clock keys outside clip intervals [invariant]", () => {
  const animation = track();
  animation.GlobalSeqId = 0;
  const before = structuredClone(animation);
  keepFlashableKeys(animation, [sequence]);
  expect(animation).toEqual(before);
});

test("white flash keeps exact keys and tangents inside flashable clips, and collapses constant linear keys to the clip edges while preserving the held pose [spec #310]", () => {
  const animation = track();
  const retained = animation.Keys.slice(1, 4);
  keepFlashableKeys(animation, [sequence]);
  expect(animation.Keys).toEqual(retained);
  const constant = track();
  constant.LineType = mdx.LineType.Linear;
  for (const key of constant.Keys) key.Vector.fill(7);
  const original = structuredClone(constant.Keys);
  keepFlashableKeys(constant, [sequence]);
  expect(constant.Keys.map(key => key.Frame)).toEqual([100, 200]);
  for (const key of original.slice(1, 4)) expect(preservesFlashKey(constant, key)).toBe(true);
});

test("white flash removes a track whose keys all lie outside flashable clips, because Warcraft crashes loading an empty track [repro #284]", () => {

  const hidden: mdx.AnimVector = { LineType: mdx.LineType.DontInterp, GlobalSeqId: -1, Keys: [{ Frame: 20, Vector: new Float32Array([0]) }, { Frame: 300, Vector: new Float32Array([1]) }] };
  const attachment = { Name: "Weapon", Visibility: hidden, Translation: track() };
  trimFlashTracks({ Attachments: [attachment], Nodes: [attachment] }, [sequence]);
  expect("Visibility" in attachment).toBe(false);
  expect(attachment.Translation.Keys.map(key => key.Frame)).toEqual([100, 150, 200]);
});

test("white flash drops the team-glow ground plane under a fighter and renumbers what refers to the rest [repro #346]", () => {
  const square = (size: number, z: number) => new Float32Array([-size, -size, z, size, -size, z, size, size, z, -size, size, z]);
  const geoset = (Vertices: Float32Array) => ({ Vertices }) as mdx.Geoset;
  const body = geoset(new Float32Array([0, 0, 0, 20, 0, 0, 0, 0, 180]));
  const model = {
    Geosets: [geoset(square(110, 8)), body],
    GeosetAnims: [{ GeosetId: 0, Alpha: 0, Color: new Float32Array(3), Flags: 0 }, { GeosetId: 1, Alpha: 1, Color: new Float32Array(3), Flags: 0 }],
    Bones: [{ GeosetId: 0, GeosetAnimId: 0 }, { GeosetId: 1, GeosetAnimId: 1 }],
  } as unknown as mdx.Model;
  expect(groundPlaneGeosets(model)).toEqual([0]);
  removeGeosets(model, new Set(groundPlaneGeosets(model)));
  expect(model.Geosets).toEqual([body]);
  expect(model.GeosetAnims.map(animation => animation.GeosetId)).toEqual([0]);
  expect(model.Bones.map(bone => [bone.GeosetId, bone.GeosetAnimId])).toEqual([[null, null], [0, 0]]);
  expect(groundPlaneGeosets(model)).toEqual([]);
});
