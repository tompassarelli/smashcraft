import { expect, test } from "bun:test";
import { join } from "node:path";

// A command isn't done until AGENTS.md, the command list future agents read,
// names it as `bun wisp NAME`.
test("every bun wisp command in scripts/wisp.ts is listed in AGENTS.md", async () => {
  const program = await Bun.file(join(import.meta.dir, "../scripts/wisp.ts")).text();
  const agents = await Bun.file(join(import.meta.dir, "../../AGENTS.md")).text();
  const commands = [...program.matchAll(/^ {2}"?([\w-]+)"?: \{ usage:/gm)].map((match) => match[1]!);
  // Guards the pattern: a reshaped COMMANDS table must not pass with no commands read.
  expect(commands.length).toBeGreaterThanOrEqual(20);
  const unlisted = commands.filter((name) => !new RegExp(`bun\\s+wisp\\s+${name}(?![\\w-])`).test(agents));
  expect(unlisted, "add a `bun wisp NAME` line under AGENTS.md's TypeScript and Wisp commands").toEqual([]);
});
