import { expect, test } from "bun:test";
import { join } from "node:path";
import { vocabularyProblems } from "wisp/scripts/wisp/vocabulary";

test("Smashcraft's command nouns and shared flags follow Wisp's vocabulary [spec wisp:docs/cli.md]", async () => {
  const source = await Bun.file(join(import.meta.dir, "../scripts/wisp.ts")).text();
  const vocabulary = await Bun.file(join(import.meta.dir, "../node_modules/wisp/docs/cli.md")).text();
  expect(vocabularyProblems(source, vocabulary)).toEqual([]);
  const agents = await Bun.file(join(import.meta.dir, "../../AGENTS.md")).text();
  for (const [, noun] of source.matchAll(/^  ([\w-]+): \{ usage:/gm)) expect(agents).toContain(`wisp ${noun}`);
});
