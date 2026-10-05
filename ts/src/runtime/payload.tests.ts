import { assertEquals, test } from "./testing";
import { floorMod } from "../sim/intMath";
import { checksum, decodeBase64, encodeBase64 } from "./payload";

test("payload: every byte value survives base64, with each padding length", () => {
  const bytes = Array.from({ length: 256 }, (_, i) => i);
  for (const length of [256, 255, 254, 0]) {
    const slice = bytes.slice(0, length);
    assertEquals(decodeBase64(encodeBase64(slice))?.join(","), slice.join(","));
  }
  assertEquals(encodeBase64([77, 97]), "TWE=");
  assertEquals(decodeBase64("TWE"), undefined);
  assertEquals(decodeBase64("TW!="), undefined);
});

// Bun and 32-bit Lua must agree, or every hot reload is refused as a mismatch.
// The expected value comes from an exact BigInt evaluation; this input drives
// both lanes within 0.05% of their modulus.
test("payload: checksum is exact in 32-bit integers", () => {
  const bytes = Array.from({ length: 4096 }, (_, i) => floorMod(i * 167 + 255, 256));
  assertEquals(checksum(bytes), "144609:7323593");
});
