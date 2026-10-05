// Controls the signed-in Warcraft clients on their private desktops.
// Usage: bun scripts/warcraft.ts look CLIENT [gold]       words on screen with positions
//        bun scripts/warcraft.ts read CLIENT X Y W H [gold] text in one region
//        bun scripts/warcraft.ts click CLIENT X Y
//        bun scripts/warcraft.ts keys CLIENT KEY...
import { Effect } from "effect";
import { type Client, type Ink, click, keys, loadClients, read, words } from "./warcraft/desktop";

const [command, name, ...rest] = Bun.argv.slice(2);

const program = Effect.gen(function*() {
  const clients = yield* loadClients();
  const client = clients.find((candidate: Client) => candidate.name === name);
  if (client === undefined) return yield* Effect.die(`unknown client ${name}; known: ${clients.map((c) => c.name).join(", ")}`);
  const ink: Ink = rest.includes("gold") ? "gold" : "light";
  const started = performance.now();
  switch (command) {
    case "look":
      for (const word of yield* words(client, ink)) console.log(`${word.x},${word.y} ${word.text}`);
      break;
    case "read": {
      const [x, y, width, height] = rest.slice(0, 4).map(Number);
      console.log((yield* read(client, { x: x!, y: y!, width: width!, height: height! }, ink)).trim());
      break;
    }
    case "click":
      yield* click(client, Number(rest[0]), Number(rest[1]));
      break;
    case "keys":
      yield* keys(client, ...rest);
      break;
    default:
      return yield* Effect.die(`unknown command ${command}`);
  }
  console.error(`${command} ${name}: ${(performance.now() - started).toFixed(0)} ms`);
});

await Effect.runPromise(program);
