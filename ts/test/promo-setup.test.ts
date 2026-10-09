import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { fighterAt } from "../src/game/sim/roster";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("promotion setup runs two Expert computers with clean HUD and reset restores match UI [spec #346]", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0]);
  const client = clients.client(0);
  clients.start(); clients.frames(30);
  clients.chat(0, "-dev quick promo stage 0 pair rifleman / illidan");
  clients.frames(5);
  expect(value(client, () => shell().game.computerMask)).toBe(3);
  expect(value(client, () => shell().game.humanFighterMask)).toBe(0);
  expect(value(client, () => shell().game.cpuTiers.slice(0, 2))).toEqual(["expert", "expert"]);
  const before = value(client, () => [fighterAt(shell().world, 0).motion.x, fighterAt(shell().world, 1).motion.x]);
  clients.frames(90);
  const after = value(client, () => [fighterAt(shell().world, 0).motion.x, fighterAt(shell().world, 1).motion.x]);
  expect(after[0]).not.toBe(before[0]);
  expect(after[1]).not.toBe(before[1]);
  expect(client.frames.snapshot({ visibleOnly: true }).some(frame => /FighterHUD|Mana|MeleeHelp|MeleeNotice/.test(frame.name))).toBe(false);
  clients.chat(0, "-dev reset"); clients.frames(5);
  clients.chat(0, "-dev quick"); clients.frames(30);
  expect(client.frames.snapshot({ visibleOnly: true }).some(frame => frame.name.includes("FighterHUD"))).toBe(true);
  expect(client.errors).toEqual([]);
});
