import { expect, test } from "bun:test";
import { join } from "node:path";
import { vocabularyProblems } from "wisp/scripts/wisp/vocabulary";

test("Smashcraft's command nouns and shared flags follow Wisp's vocabulary [spec wisp:docs/cli.md]", async () => {
  const help = Bun.spawnSync([process.execPath, "wisp", "help"], { cwd: join(import.meta.dir, "..") });
  expect(help.exitCode, help.stderr.toString()).toBe(0);
  const output = help.stdout.toString();
  const usages = [...output.matchAll(/^  ([\w-]+) (.*)$/gm)];
  expect(usages.length).toBeGreaterThanOrEqual(20);
  const source = usages.map(([, noun, rest]) => `  ${noun}: { usage: "${noun} ${rest!.replaceAll('"', "'")}" }`).join("\n");
  const vocabulary = await Bun.file(join(import.meta.dir, "../node_modules/wisp/docs/cli.md")).text();
  expect(vocabularyProblems(source, vocabulary)).toEqual([]);
  const router = await Bun.file(join(import.meta.dir, "../../docs/README.md")).text();
  for (const [, noun] of usages) expect(router).toContain(`| \`${noun}\` |`);
});
