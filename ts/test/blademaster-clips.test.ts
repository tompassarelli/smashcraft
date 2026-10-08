import { expect, test } from "bun:test";
import { BLADEMASTER_AUTHORED_CLIPS } from "../src/game/presentation/blademasterClipInfo";
import { DOWN_AIR_CLIPS } from "../src/game/presentation/downAirClipInfo";
import { Character } from "../src/game/sim/codes";

test("Blademaster normals each name a distinct original sword gesture", () => {
  const indices = Object.values(BLADEMASTER_AUTHORED_CLIPS).map(clip => clip.index);
  indices.push(DOWN_AIR_CLIPS[Character.blademaster].downAir.index);
  expect(indices).toHaveLength(17);
  expect(new Set(indices).size).toBe(indices.length);
  expect(indices).not.toContain(13);
  expect(BLADEMASTER_AUTHORED_CLIPS).not.toHaveProperty("jab3");
});
