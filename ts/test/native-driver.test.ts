import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { parseRepro } from "wisp/src/runtime/repro";
import { replayRepro } from "../src/game/replay/moment";
import { nativeDriverCommand } from "../src/platform/nativeDriver";
import { install, start } from "../src/platform/nativeDriverMain";
import { shell } from "../src/platform/shell/state";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { value } from "./rematch/playableMatch";

const runtime = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(runtime.restore);

// Real shell callback, capture and replay; command delivery itself belongs to Wisp.
test("native driver sets up pad rows, holds the whole callback, and stepped and free runs replay equally", () => {
  const clients = runtime.clients({ install, start }, [0, 1]);
  const command = (text: string) => clients.everywhere(() => nativeDriverCommand(text));
  clients.start();
  clients.frames(3);
  const script = "#! chat -dev quick hero archer\n1 a stick 0.6 0\n10 a tap A 2\n20 a stick 0 0\n40 b tap B 8\n70 a cstick 0 1\n75 a cstick 0 0\n120 a capture\n";
  command(script);
  clients.frames(20);
  for (const client of clients.clients) expect(value(client, () => shell().runtime.simulationFrame)).toBe(0);
  command("step 10");
  clients.frames(25);
  for (const client of clients.clients) expect(value(client, () => shell().runtime.simulationFrame)).toBe(10);
  command("step 110");
  clients.frames(140);
  const stepped = clients.clients.map(client => value(client, () => confirmedChecksum(shell())));
  for (const client of clients.clients) {
    expect(value(client, () => shell().runtime.simulationFrame)).toBe(120);
    const filename = [...client.files.keys()].find(name => name.startsWith("smashcraft-repro-") && name.includes("-f120-"));
    expect(filename).toBeDefined();
    const repro = parseRepro(client.files.get(filename ?? "") ?? []);
    if (typeof repro === "string") throw new Error(repro);
    const replay = replayRepro(repro);
    expect(replay.problems).toEqual([]);
    expect(replay.checksum).toBe(repro.checksum);
  }
  command(script);
  command("resume 120");
  clients.frames(150);
  for (const [index, client] of clients.clients.entries()) {
    expect(value(client, () => shell().runtime.simulationFrame)).toBe(120);
    expect(value(client, () => confirmedChecksum(shell()))).toBe(stepped[index]);
    expect(client.errors).toEqual([]);
  }
  expect(stepped[0]).toBe(stepped[1]);
  command("capture");
  clients.frames(5);
  for (const client of clients.clients) expect(value(client, () => shell().runtime.simulationFrame)).toBe(120);
  command("reset");
  clients.frames(5);
  for (const client of clients.clients) expect(value(client, () => shell().runtime.simulationFrame)).toBe(0);
  expect(clients.firstDivergence()).toBeUndefined();
});
