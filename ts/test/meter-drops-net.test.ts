import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { Phase } from "../src/game/match/rules";
import { shell } from "../src/platform/shell/state";
import { start, install } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("two clients spawn and award the same meter drops on the same frames against an expert computer [spec #385] [invariant]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu wren expert");
  const logs = clients.clients.map(() => [] as string[]);
  const seen = clients.clients.map(() => ({ spawn: 0, pickup: 0 }));
  for (let frame = 0; frame < 2700; frame++) {
    clients.frames(1);
    clients.clients.forEach((client, index) => client.run(() => {
      const { game } = shell();
      const last = seen[index]!;
      if (game.phase !== Phase.match) return;
      if (game.drops.spawnSerial !== last.spawn) logs[index]!.push(`spawn ${game.drops.spawnSerial} at ${game.matchFrame} point ${game.drops.point}`);
      if (game.drops.pickupSerial !== last.pickup) logs[index]!.push(`pickup ${game.drops.pickupSerial} at ${game.matchFrame} by ${game.drops.lastTaker}`);
      last.spawn = game.drops.spawnSerial;
      last.pickup = game.drops.pickupSerial;
    }));
  }
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
  expect(seen[0]!.pickup).toBeGreaterThanOrEqual(2);
  expect(logs[1]).toEqual(logs[0]!);
  console.log(`meter drops two-client: ${logs[0]!.join("; ")}; 0 divergent states`);
}, 60000);
