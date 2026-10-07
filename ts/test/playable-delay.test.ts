// The release keyboard path: local capture assigns two frames ahead, and
// predicted fighters respond on that frame while their own echo is in flight.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { syncDelivery } from "wisp/src/headless/syncChannel";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { fighterAt } from "../src/game/sim/roster";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("release keyboard shields start exactly two frames after capture before the sender's echo", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0, 1], {
    delivery: syncDelivery({ latencyMs: 150, turnMs: 25, extraTurns: [1] }, 60),
  });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(30);
  let pressedFrames: readonly number[] = [];
  const states = () => clients.clients.map((client) => value(client, () => {
    const rollback = shell().rollback;
    if (rollback === undefined) throw new Error("release has no rollback");
    return {
      shield: fighterAt(rollback.speculative.world, client.slot).shield.raised,
      frame: rollback.schedule.speculativeFrame(),
      accepted: rollback.schedule.accepted(rollback.epoch, client.slot, pressedFrames[client.slot] ?? 0) !== undefined,
      target: rollback.schedule.captureTarget(),
      delay: rollback.delay,
    };
  }));
  const before = states();
  pressedFrames = before.map((state) => state.target ?? 0);
  for (const state of before) {
    expect(state.shield).toBe(false);
    expect(state.delay).toBe(2);
    expect(state.target).toBe(state.frame + 2);
  }
  for (const player of clients.clients) for (const client of clients.clients) client.key(player.slot, 0x51, 0, true);
  clients.frames(1);
  expect(states().map((state) => state.shield)).toEqual([false, false]);
  clients.frames(1);
  expect(states().map((state) => state.shield)).toEqual([false, false]);
  clients.frames(1);
  for (const state of states()) {
    expect(state.shield).toBe(true);
    expect(state.accepted).toBe(false);
  }
  for (const player of clients.clients) for (const client of clients.clients) client.key(player.slot, 0x51, 0, false);
  clients.frames(30);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});
