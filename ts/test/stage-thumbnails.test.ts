// The stage-select cards follow the stage art (smashcraft:docs/design/stage-select.md).
// After a stage or its art changes: `bun scripts/stageThumbnails.ts` from ts/, then commit
// ts/stage-thumbnails.json, src/game/menu/stageSilhouettes.ts and build-inputs.json.
import { expect, test } from "bun:test";
import { join } from "node:path";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { HERO_CAMERAS, type ThumbnailManifest, silhouetteSource, stageInputHash, thumbnailFile } from "../scripts/stageThumbnailSpec";

const root = join(import.meta.dir, "..");
const REGENERATE = "stale: run `bun scripts/stageThumbnails.ts` from ts/ and commit what it writes";
const ZONE_ART = "UI\\Glues\\Loading\\Backgrounds\\Campaigns\\";

test("every selectable stage's card shows Warcraft's zone art or a recorded render of the stage [spec docs/design/stage-select.md]", async () => {
  const manifest: ThumbnailManifest = await Bun.file(join(root, "stage-thumbnails.json")).json();
  for (const { id, name, texture } of STAGE_CATALOG) {
    if (HERO_CAMERAS[id] === undefined) expect(texture.startsWith(ZONE_ART), `${name} has neither zone art nor a hero camera`).toBe(true);
    else expect(manifest.stages.find((row) => row.stage === id)?.file, `${name} has no rendered picture: ${REGENERATE}`).toBe(thumbnailFile(id));
  }
});

test("a rendered stage picture is regenerated whenever its stage's art inputs change [invariant]", async () => {
  const manifest: ThumbnailManifest = await Bun.file(join(root, "stage-thumbnails.json")).json();
  const inputs = await Bun.file(join(root, "../build-inputs.json")).json();
  expect(manifest.family, `build-inputs.json names other stage pictures: ${REGENERATE}`).toBe(inputs["stage-thumbnails"]);
  for (const row of manifest.stages) {
    const stage = STAGE_CATALOG.find((entry) => entry.id === row.stage);
    expect(stage, `stage ${row.stage} is no longer selectable: ${REGENERATE}`).toBeDefined();
    if (stage !== undefined) expect(row.inputs, `${stage.name}'s art changed since its picture was drawn: ${REGENERATE}`).toBe(stageInputHash(stage.id, inputs["stage-assets"]));
  }
});

test("every stage's layout silhouette is regenerated from its current surfaces [invariant]", async () => {
  expect(await Bun.file(join(root, "src/game/menu/stageSilhouettes.ts")).text(), `the silhouettes differ from the stages' surfaces: ${REGENERATE}`).toBe(silhouetteSource());
});
