import { expect, test } from "bun:test";
import { STAGE_SKIES, stageSkyMdl, stageSkyModelFile, stageSkyTexture } from "../scripts/stageSky";
import { STAGE_SKY_MODELS } from "../src/game/assets/stageSkyInfo";
import { parseMDL } from "war3-model";

test("shipped skies stay in the classic sky volume and do not write depth or animate [native]", () => {
  for (const sky of STAGE_SKIES) {
    const texture = stageSkyTexture(sky), mdl = stageSkyMdl(texture.name), model = parseMDL(mdl);
    expect(STAGE_SKY_MODELS[sky.stage]).toBe(`war3mapImported\\${stageSkyModelFile(mdl)}`);
    expect(model.Geosets).toHaveLength(1);
    expect(model.Geosets[0]?.Faces.length).toBe(3072);
    for (const coordinate of model.Geosets[0]?.Vertices ?? []) expect(Math.abs(coordinate)).toBeLessThanOrEqual(2000);
    expect(model.Materials[0]?.Layers[0]?.Shading).toBe(1 | 16 | 32 | 64 | 128);
    expect(model.ParticleEmitters).toHaveLength(0);
    expect(model.ParticleEmitters2).toHaveLength(0);
    expect(texture.bytes.slice(12, 18)).toEqual(new Uint8Array([0, 1, 128, 0, 32, 0x28]));
  }
});
