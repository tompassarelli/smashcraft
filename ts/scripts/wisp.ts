// Wisp: Smashcraft's host tools as one program (#37). Each command is
// composed from the services in smashcraft:ts/scripts/wisp/ and prints how
// long each of its steps took.
// Usage (from ts/): bun wisp COMMAND [ARGUMENTS]
import { Cause, Effect, Exit, Option } from "effect";
import type { Command } from "wisp/scripts/wisp/command";
import { step, timingsLayer } from "wisp/scripts/wisp/timings";

/** Each command loads on demand, so it loads only the modules it uses. */
const COMMANDS: Record<string, { readonly usage: string; readonly load: () => Promise<Command> }> = {
  hot: { usage: "hot --data DIR [--data DIR ...] [--watch] [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/hot")).hot },
  build: { usage: "build --base BASE.w3m --container MAP.w3x --assets DIR --summon DIR --name NAME --out OUT.w3x [--packager PATH] [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/map")).build },
  rebuild: { usage: "rebuild MAP.w3x [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/map")).rebuild },
  fresh: { usage: "fresh MAP.w3x [--rebuild] [--from-game] [--no-quick] [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/fresh")).fresh },
  tapes: { usage: "tapes   (LUA=<32-bit lua>)", load: async () => (await import("./wisp/commands/tapes")).tapes },
  oracle: { usage: "oracle", load: async () => (await import("./wisp/commands/oracle")).oracle },
  parity: { usage: "parity numeric [RESULT_FILE ...] | capture OPTIONS... | result CAPTURE_DIR | headless --helper BINARY --out DIR", load: async () => (await import("./wisp/commands/parity")).parity },
  integrity: { usage: "integrity capture OPTIONS... | result CAPTURE_DIR | headless --helper BINARY --out DIR", load: async () => (await import("./wisp/commands/parity")).integrity },
  "four-fighters": { usage: "four-fighters capture OPTIONS... | result CAPTURE_DIR", load: async () => (await import("./wisp/commands/fourFighters")).fourFighters },
  playable: { usage: "playable capture OPTIONS... | result CAPTURE_DIR", load: async () => (await import("./wisp/commands/playable")).playable },
  client: { usage: "client look|read|click|keys CLIENT ...", load: async () => (await import("./wisp/commands/client")).client },
  view: { usage: "view scene DATA_DIR... | frame FRAME.ppm... | models --assets DIR --summon DIR --extractor CASC_EXTRACT --storage WARCRAFT_DIR", load: async () => (await import("./wisp/commands/view")).view },
  headless: { usage: "headless [quick-match|desync] [--clients N]", load: async () => (await import("./wisp/commands/headless")).headless },
  dev: { usage: "dev [--data DIR --data DIR]", load: async () => (await import("./wisp/commands/dev")).dev },
  play: { usage: "play   (Tom's desktop: Battle.net, Play, a hosted game against a computer, the controller helper)", load: async () => (await import("./wisp/commands/play")).play },
  tune: { usage: "tune --data DIR [--data DIR ...] [--port N] [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/tune")).tune },
  repro: { usage: "repro FILE [--test NAME]", load: async () => (await import("./wisp/commands/repro")).repro },
};

const [name, ...args] = process.argv.slice(2);
const entry = name === undefined ? undefined : COMMANDS[name];
if (name === undefined || entry === undefined) {
  console.error(`usage: bun wisp COMMAND\n${Object.values(COMMANDS).map(({ usage }) => `  ${usage}`).join("\n")}`);
  process.exit(2);
}
const command = await entry.load();
const exit = await Effect.runPromiseExit(command(args).pipe(step(name), Effect.provide(timingsLayer((line) => console.error(line)))));
if (Exit.isFailure(exit)) {
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isNone(failure)) console.error(Cause.pretty(exit.cause));
  else console.error(failure.value._tag === "UsageFailure" ? `${failure.value.message}\nusage: bun wisp ${entry.usage}` : failure.value.message);
  process.exit(Option.isSome(failure) && failure.value._tag === "UsageFailure" ? 2 : 1);
}
process.exit(0);
