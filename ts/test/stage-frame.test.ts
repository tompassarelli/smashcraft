import { expect, test } from "bun:test";
import { SMASHCRAFT_FRAME } from "../scripts/wisp/playerView";

const sky = SMASHCRAFT_FRAME[0];
if (sky === undefined) throw new Error("missing sky check");
const frame = (color: readonly [number, number, number]) => ({ width: 10, height: 10, rgb: new Uint8Array(Array.from({ length: 100 }, () => color).flat()) });

test("native rust, winter and aurora skies pass the same coverage gate as a bright sky", () => {
  for (const color of [[96, 64, 56], [84, 124, 156], [4, 68, 52], [148, 172, 180]] as const) expect(sky.measure(frame(color)).present).toBe(true);
});

test("an absent sky and a frame below the 50 percent sky gate still fail", () => {
  expect(sky.measure(frame([0, 0, 0])).present).toBe(false);
  const partial = frame([0, 0, 0]);
  for (let index = 0; index < 19; index++) partial.rgb.set([96, 64, 56], index * 3);
  expect(sky.measure(partial).present).toBe(false);
});
