import { expect, test } from "bun:test";
import { STAMP_CELL, STAMP_CELLS, type StampCell, stampCells } from "../src/runtime/drawnStamp";
import { fixtureOf, frameStamp } from "../scripts/nativeCapture";

/** The stamp's colors as Warcraft draws its team color textures. */
const RGB: Readonly<Record<StampCell, readonly [number, number, number]>> = { one: [255, 3, 3], zero: [0, 66, 255], guard: [32, 192, 0] };

function painted(width: number, height: number, script: number, frame: number) {
  const rgb = new Uint8Array(width * height * 3).fill(90);
  const scale = height / 0.6;
  const left = (width - 0.8 * scale) / 2;
  const side = STAMP_CELL * scale;
  stampCells(script, frame).forEach((cell, index) => {
    for (let y = 0; y < Math.floor(side); y++) for (let x = Math.ceil(left + index * side); x < Math.floor(left + (index + 1) * side); x++) rgb.set(RGB[cell], (y * width + x) * 3);
  });
  return { width, height, rgb };
}

// The map paints what the host reads; a capture without the stamp, or with a cell flipped, names no frame.
test("a capture's drawn stamp names the fixture and frame the map painted, at 1080 and 1440 lines", () => {
  expect(stampCells(5, 177)).toHaveLength(STAMP_CELLS);
  expect(frameStamp(painted(1920, 1080, 5, 177))).toEqual({ script: 5, frame: 177 });
  expect(frameStamp(painted(2560, 1440, 63, 18000))).toEqual({ script: 63, frame: 18000 });
  expect(frameStamp({ width: 1920, height: 1080, rgb: new Uint8Array(1920 * 1080 * 3).fill(90) })).toBeUndefined();
  const flipped = painted(1920, 1080, 5, 177);
  const scale = 1080 / 0.6;
  const x = Math.round((1920 - 0.8 * scale) / 2 + 10.5 * STAMP_CELL * scale);
  const y = Math.round(0.5 * STAMP_CELL * scale);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) flipped.rgb.set(flipped.rgb[((y + dy) * 1920 + x + dx) * 3] === 255 ? RGB.zero : RGB.one, ((y + dy) * 1920 + x + dx) * 3);
  expect(frameStamp(flipped)).toBeUndefined();
});

test("a fixture holds each capture frame of its pad script once", () => {
  const fixture = fixtureOf("test/native/pads/180/lich-back-left.pad", "#! chat -dev quick hero lich\n40 a stick 1 0\n164 a capture\n164 b capture\n+13 a capture\n");
  expect(fixture).toEqual({ name: "180-lich-back-left", frames: [164, 177], script: fixture.script });
});
