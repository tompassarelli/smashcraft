import { expect, test } from "bun:test";
import { model as mdx } from "war3-model";
import { keepFlashableKeys, preservesFlashKey } from "../../tools/animations/white-flash-keys";

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

test("white flash retains exact keys and tangents inside flashable clips, including both edges [spec #310]", () => {
  const animation = track();
  const retained = animation.Keys.slice(1, 4);
  keepFlashableKeys(animation, [sequence]);
  expect(animation.Keys).toEqual(retained);
});

test("white flash preserves independent global-clock keys outside clip intervals [invariant]", () => {
  const animation = track();
  animation.GlobalSeqId = 0;
  const before = structuredClone(animation);
  keepFlashableKeys(animation, [sequence]);
  expect(animation).toEqual(before);
});

test("white flash removes constant linear keys while preserving the held pose and clip boundaries [spec #310]", () => {
  const animation = track();
  animation.LineType = mdx.LineType.Linear;
  for (const key of animation.Keys) key.Vector.fill(7);
  const original = structuredClone(animation.Keys);
  keepFlashableKeys(animation, [sequence]);
  expect(animation.Keys.map(key => key.Frame)).toEqual([100, 200]);
  for (const key of original.slice(1, 4)) expect(preservesFlashKey(animation, key)).toBe(true);
});
