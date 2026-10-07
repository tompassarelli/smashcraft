import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { PAD_ACTIVE_KEY, PAD_KEYS } from "../src/game/input/padCapture";
import { decodePacket } from "../src/game/input/wire";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

for (const route of ["keys", "cursor"] as const) test(`analog-${route}: the live rollback capture sends exact pad axes and trigger pressure`, () => {
  const build = { ...PLAYABLE_BUILD, id: `typescript-analog-${route}`, analogPad: route, devConsole: true };
  const clients = headless.clients({ start: () => startBuild(build), install }, [0, 1]);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(5);
  const packed = 13 | 8 << 5 | 1 << 10 | 2 << 12;
  const host = clients.client(0);
  host.key(0, 0x24, 0, true);
  host.key(0, 0x52, 0, true);
  host.key(0, PAD_ACTIVE_KEY, 0, true);
  if (route === "keys") {
    for (let index = 0; index < PAD_KEYS.length; index++) {
      const key = PAD_KEYS[index];
      if (key !== undefined) host.key(0, key, 0, (packed & 1 << index) !== 0);
    }
  } else host.run(() => { const pad = shell().pad; if (pad !== undefined) pad.packet = packed; });
  clients.frames(6);
  let captured: string[] = [];
  host.run(() => { captured = shell().pad?.rows ?? []; });
  const record = captured.find(line => line.split(" ")[3] === `${packed}`);
  expect(record).toBeDefined();
  const wire = record?.split(" ")[4] ?? "";
  const row = decodePacket(wire)?.rows[0];
  expect(row).toMatchObject({ axisX: 88, axisZ: 0, triggerLeft: 77, triggerRight: 166 });
  host.key(0, PAD_ACTIVE_KEY, 0, false);
  clients.frames(2);
  let updating: string | undefined;
  host.run(() => { updating = shell().pad?.rows.at(-1); });
  expect(decodePacket(updating?.split(" ")[4] ?? "")?.rows[0]).toMatchObject({ axisX: 88, triggerLeft: 77, triggerRight: 166 });
  host.natives.BlzIsLocalClientActive = () => false;
  clients.frames(2);
  host.run(() => {
    expect(shell().pad?.packet).toBeUndefined();
    updating = shell().pad?.rows.at(-1);
  });
  expect(decodePacket(updating?.split(" ")[4] ?? "")?.rows[0]).toMatchObject({ axisX: 0, held: 0, triggerLeft: 0, triggerRight: 0 });
  expect(clients.clients.flatMap(client => client.errors)).toEqual([]);
});
