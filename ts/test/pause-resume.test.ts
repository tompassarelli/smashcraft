import { readFileSync } from "node:fs";
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { PAUSE_DASH_PAD } from "../src/game/match/pauseResume.tests";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { Key } from "../src/platform/shell/keyEvents";
import { parsePadScript } from "../scripts/integrity/padScript";
import { ABS_X, BTN_START, EV_ABS, EV_KEY } from "../scripts/integrity/linuxInput";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("Start resumes from the exact paused fighter positions after three seconds mid-dash", () => {
  const script = readFileSync(`${import.meta.dir}/native/pads/206/pause-dash.pad`, "utf8");
  expect(script).toBe(PAUSE_DASH_PAD);
  const steps = parsePadScript(script);
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0, 1]);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick hero archer");
  clients.frames(30);
  const positions = () => clients.clients.map(client => value(client, () => {
    const world = shell().rollback?.speculative.world ?? shell().world;
    return PARTICIPANT_SLOTS.filter(slot => isActive(world, slot)).map(slot => {
      const { x, z } = fighterAt(world, slot).motion;
      return [x, z];
    });
  }));
  const frames = () => clients.clients.map(client => value(client, () => shell().rollback?.speculative.runtime.simulationFrame));
  let before: ReturnType<typeof positions> = [];
  let pausedFrames: ReturnType<typeof frames> = [];
  let edge = 0;
  for (let callback = 1; callback <= 349; callback++) {
    while (steps[edge]?.frame === callback) {
      const step = steps[edge];
      if (step?.kind === "edge") for (const input of step.edges) {
        const key = input.type === EV_KEY && input.code === BTN_START ? Key.y : input.type === EV_ABS && input.code === ABS_X ? Key.r : undefined;
        if (key !== undefined) for (const client of clients.clients) client.key(step.slot, key, 0, input.value !== 0);
      }
      edge++;
    }
    clients.frames(1);
    if (callback === 167) { before = positions(); pausedFrames = frames(); }
    if (callback >= 168 && callback <= 348) {
      expect(positions()).toEqual(before);
      expect(frames()).toEqual(pausedFrames);
    }
    if (callback === 349) {
      expect(positions()).not.toEqual(before);
      expect(frames()).toEqual(pausedFrames.map(frame => (frame ?? 0) + 1));
      const resumed = positions();
      console.log(`pause: 180 callbacks, first resumed positions unchanged; next callback +1 simulation frame, dash step ${(resumed[0]?.[0]?.[0] ?? 0) - (before[0]?.[0]?.[0] ?? 0)}`);
    }
  }
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});
