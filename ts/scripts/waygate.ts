// Waygate: Smashcraft's host tools as one program (#37). Each command is
// composed from the services in smashcraft:ts/scripts/waygate/ and prints how
// long each of its steps took.
// Usage (from ts/): bun waygate COMMAND [ARGUMENTS]
import { Cause, Effect, Exit, Option } from "effect";
import type { Command } from "./waygate/command";
import { step, timingsLayer } from "./waygate/timings";

/** Each command loads on demand, so it loads only the modules it uses. */
const COMMANDS: Record<string, { readonly usage: string; readonly load: () => Promise<Command> }> = {
  hot: { usage: "hot --data DIR [--data DIR ...] [--watch]", load: async () => (await import("./waygate/commands/hot")).hot },
  build: { usage: "build --base BASE.w3m --container MAP.w3x --assets DIR --summon DIR --name NAME --out OUT.w3x [--packager PATH]", load: async () => (await import("./waygate/commands/map")).build },
  rebuild: { usage: "rebuild MAP.w3x", load: async () => (await import("./waygate/commands/map")).rebuild },
  fresh: { usage: "fresh MAP.w3x", load: async () => (await import("./waygate/commands/fresh")).fresh },
  tapes: { usage: "tapes   (LUA=<32-bit lua>)", load: async () => (await import("./waygate/commands/tapes")).tapes },
  client: { usage: "client look|read|click|keys CLIENT ...", load: async () => (await import("./waygate/commands/client")).client },
};

const [name, ...args] = process.argv.slice(2);
const entry = name === undefined ? undefined : COMMANDS[name];
if (name === undefined || entry === undefined) {
  console.error(`usage: bun waygate COMMAND\n${Object.values(COMMANDS).map(({ usage }) => `  ${usage}`).join("\n")}`);
  process.exit(2);
}
const command = await entry.load();
const exit = await Effect.runPromiseExit(command(args).pipe(step(name), Effect.provide(timingsLayer((line) => console.error(line)))));
if (Exit.isFailure(exit)) {
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isNone(failure)) console.error(Cause.pretty(exit.cause));
  else console.error(failure.value._tag === "UsageFailure" ? `${failure.value.message}\nusage: bun waygate ${entry.usage}` : failure.value.message);
  process.exit(Option.isSome(failure) && failure.value._tag === "UsageFailure" ? 2 : 1);
}
process.exit(0);
