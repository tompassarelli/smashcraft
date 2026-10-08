// The stage-select cards follow the stage art (smashcraft:docs/design/stage-select.md).
// Each stage's card is checked on its own: after a stage or its art changes, run the
// command the failure prints (`bun scripts/stageThumbnails.ts --stage NAME` from ts/)
// and commit ts/stage-thumbnails.json and src/game/menu/stageSilhouettes.ts.
import { expect, test } from "bun:test";
import { join } from "node:path";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { HERO_CAMERAS, type ThumbnailManifest, regenerateCommand, silhouetteEntry, silhouetteSource, stageInputHash, thumbnailFile } from "../scripts/stageThumbnailSpec";

const root = join(import.meta.dir, "..");
const regenerate = (stage: number) => `stale: run \`${regenerateCommand(stage)}\` from ts/ and commit what it writes`;
const ZONE_ART = "UI\\Glues\\Loading\\Backgrounds\\Campaigns\\";

test("every selectable stage's card shows Warcraft's zone art or a recorded render of the stage [spec docs/design/stage-select.md]", async () => {
  const manifest: ThumbnailManifest = await Bun.file(join(root, "stage-thumbnails.json")).json();
  for (const { id, name, texture } of STAGE_CATALOG) {
    if (HERO_CAMERAS[id] === undefined) expect(texture.startsWith(ZONE_ART), `${name} has neither zone art nor a hero camera`).toBe(true);
    else expect(manifest.stages.find((row) => row.stage === id)?.file, `${name} has no rendered picture: ${regenerate(id)}`).toBe(thumbnailFile(id));
  }
});

test("a rendered stage picture is regenerated whenever its own stage's art inputs change [invariant]", async () => {
  const manifest: ThumbnailManifest = await Bun.file(join(root, "stage-thumbnails.json")).json();
  for (const row of manifest.stages) {
    const stage = STAGE_CATALOG.find((entry) => entry.id === row.stage);
    expect(stage, `stage ${row.stage} is no longer selectable: run \`bun scripts/stageThumbnails.ts\` from ts/`).toBeDefined();
    if (stage !== undefined) expect(row.inputs, `${stage.name}'s art changed since its picture was drawn: ${regenerate(stage.id)}`).toBe(stageInputHash(stage.id));
  }
});

test("every stage's layout silhouette is regenerated from its current surfaces [invariant]", async () => {
  const file = await Bun.file(join(root, "src/game/menu/stageSilhouettes.ts")).text();
  for (const { id, name } of STAGE_CATALOG) expect(file.includes(silhouetteEntry(id)), `${name}'s silhouette differs from its surfaces: ${regenerate(id)}`).toBe(true);
  expect(file, "the silhouette file differs from the stages' surfaces: run `bun scripts/stageThumbnails.ts` from ts/").toBe(silhouetteSource());
});
