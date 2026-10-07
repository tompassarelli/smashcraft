import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { frameCostCaptureFile } from "wisp/src/runtime/frameCostCapture";
import * as nativePerf from "../src/platform/nativePerfMain";
import * as playable from "../src/platform/playableMain";
import { shellState } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("playable presentation exports a diagnostic capture on both clients without divergent handles", () => {
  const clients = headless.clients(nativePerf);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(90);
  clients.chat(0, "-dev capture 240");
  clients.frames(241);
  for (const client of clients.clients) {
    client.run(() => expect(shellState()?.build).toMatchObject({ input: { kind: "callback" }, presentation: "pool-confirmed", hotReload: false }));
    expect(client.errors).toEqual([]);
    const lines = client.files.get(frameCostCaptureFile(client.slot, 1, "smashcraft"));
    expect(lines?.[0]).toMatch(/^frame capture run=1 frames=240 /);
    expect(lines?.length).toBe(241);
    expect(lines?.[240]).toMatch(/^sample 240 /);
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

test("the ordinary playable entry carries no capture meter or command", () => {
  const clients = headless.clients(playable);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev capture 1");
  clients.frames(2);
  for (const client of clients.clients) {
    client.run(() => expect(Reflect.get(globalThis, "__smashcraftFrameMeter")).toBeUndefined());
    expect(client.files.get(frameCostCaptureFile(client.slot, 1, "smashcraft"))).toBeUndefined();
    expect(client.errors).toEqual([]);
  }
});
