import { join } from "node:path";
import { Effect } from "effect";
import type { Command } from "wisp/scripts/wisp/command";
import { UsageFailure } from "wisp/scripts/wisp/command";

const docs = join(import.meta.dir, "../../../../docs");

export const makeHelp = (usages: readonly string[], print: (line: string) => void = console.log): Command => (args) => Effect.gen(function*() {
  const router = yield* Effect.tryPromise({
    try: () => Bun.file(join(docs, "README.md")).text(),
    catch: (cause) => new UsageFailure({ problem: `Can't read the documentation index: ${String(cause)}` }),
  });
  const topics = [...router.matchAll(/^\| `([\w-]+)` \| \[[^\]]+\]\((commands\/[\w-]+\.md)\) \|$/gm)]
    .flatMap(([, name, file]) => name === undefined || file === undefined ? [] : [{ name, file }]);
  if (args.length === 0) {
    print(`usage: bun wisp COMMAND\n${usages.map((usage) => `  ${usage}`).join("\n")}\n\nhelp: bun wisp help TOPIC\ntopics: ${topics.map(({ name }) => name).join(" ")}\ndocs: docs/README.md`);
    return;
  }
  const topic = topics.find(({ name }) => name === args[0]);
  if (args.length !== 1 || topic === undefined) return yield* new UsageFailure({ problem: `Choose one help topic: ${topics.map(({ name }) => name).join(" ")}` });
  const page = yield* Effect.tryPromise({
    try: () => Bun.file(join(docs, topic.file)).text(),
    catch: (cause) => new UsageFailure({ problem: `Can't read docs/${topic.file}: ${String(cause)}` }),
  });
  const usage = usages.find((line) => line.split(" ")[0] === topic.name);
  print(`${usage === undefined ? "" : `usage: bun wisp ${usage}\n\n`}${page.trim()}\n\ndocs: docs/${topic.file}`);
});
