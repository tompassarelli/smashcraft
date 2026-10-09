import { expect, test } from "bun:test";
import { join } from "node:path";
import { Effect } from "effect";
import { makeHelp } from "../scripts/wisp/commands/help";

test("every advertised command has reachable help and a docs topic [repro #368]", async () => {
  const help = Bun.spawnSync([process.execPath, "wisp", "help"], { cwd: join(import.meta.dir, "..") });
  expect(help.exitCode, help.stderr.toString()).toBe(0);
  const output = help.stdout.toString();
  const commands = [...output.matchAll(/^  ([\w-]+) /gm)].map((match) => match[1]!);
  const usages = [...output.matchAll(/^  (.*)$/gm)].map((match) => match[1]!);
  expect(commands.length).toBeGreaterThanOrEqual(20);
  const router = await Bun.file(join(import.meta.dir, "../../docs/README.md")).text();
  const topics = [...router.matchAll(/^\| `([\w-]+)` \| \[[^\]]+\]\((commands\/[\w-]+\.md)\) \|$/gm)];
  expect(commands.filter((name) => !topics.some((topic) => topic[1] === name))).toEqual([]);
  for (const [, topic, path] of topics) {
    expect(output).toContain(topic!);
    const page = await Bun.file(join(import.meta.dir, "../../docs", path!)).text();
    const printed: string[] = [];
    await Effect.runPromise(makeHelp(usages, (line) => printed.push(line))([topic!]));
    expect(printed.join("\n")).toContain(page.trim());
    expect(printed.join("\n")).toContain(`docs/${path}`);
  }
});
