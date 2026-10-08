// #120: training chosen with the rule buttons at fighter selection, played in
// two journal clients with a computer partner, and the reset both players'
// clients apply on the same frame.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { Action, bit } from "../src/game/input/actions";
import { inputRow } from "../src/game/input/inputRow";
import { Phase } from "../src/game/match/rules";
import { matchSpawnX } from "../src/game/match/step";
import { PartnerBehaviour, PartnerEscape } from "../src/game/match/trainingState";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { QUICK_TRAINING_COMMAND } from "../src/game/shell/devSettings";
import { fighterAt } from "../src/game/sim/roster";
import { RULE_BUTTONS } from "../src/game/ui/ruleButtons";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers, rowFor } from "./rematch/journalHelper";
import { expectSynchronized, shows, value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

const RESET_FRAME = 150;
const BOTH_SHIELDS = bit(Action.leftTrigger) | bit(Action.rightTrigger);

test("training settings agree on both clients and both shields with attack reset the match on both [spec #120] [invariant]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 120), keepCalls: 64 });
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id);
  helpers.rows = (slot, frame) => slot === 0 && frame === RESET_FRAME
    ? inputRow({ held: BOTH_SHIELDS | bit(Action.attack), pressed: bit(Action.attack), released: 0 })
    : rowFor(slot, frame, { denseCycles: 0, walkers: [0] });
  const read = <T>(body: () => T) => value(clients.client(0), body);
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const until = (what: string, done: () => boolean, n = 600) => {
    for (let i = 0; i < n && !done(); i++) frames(1);
    expect(done(), what).toBe(true);
  };
  const click = (name: keyof typeof RULE_BUTTONS, actor = 1) => {
    const box = RULE_BUTTONS[name];
    expect(clients.click(actor, box.x + box.width / 2, box.y - box.height / 2)).toBe(true);
    frames(1);
  };
  clients.start(); frames(30);
  click("training");
  click("moreBehaviour", 0);
  click("lessEscape");
  for (let step = 0; step < 4; step++) click("moreDamage", step % 2);
  click("hitAreas");
  for (const client of clients.clients) {
    expect(value(client, () => {
      const { training, trainer } = shell().game;
      return [training, trainer.behaviour, trainer.escape, trainer.damage, trainer.showHitAreas];
    })).toEqual([true, PartnerBehaviour.shield, PartnerEscape.random, 40, true]);
    expect(shows(client, "Training: On")).toBe(true);
    expect(shows(client, "Partner: Shield")).toBe(true);
    expect(shows(client, "Partner damage: 40%")).toBe(true);
  }
  for (const actor of [0, 1]) clients.press(actor, Key.n);
  frames(5);
  for (let cycle = 0; cycle < 2; cycle++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
  clients.press(0, Key.y);
  until("stage selection", () => read(() => shell().game.phase) === Phase.stageMenu, 30);
  clients.press(0, Key.y);
  until("match", () => read(() => shell().game.phase) === Phase.match, 120);
  expect(read(() => fighterAt(shell().world, 2).status.damage)).toBe(40);
  // Player 1 walks left; the reset puts every fighter back on its spot and the partner at its damage.
  until("player 1 walks away from its spot", () => read(() => fighterAt(shell().world, 0).motion.x) < matchSpawnX(0) - 100.0, 1200);
  until("the reset frame", () => read(() => shell().runtime.simulationFrame) >= RESET_FRAME, 1200);
  for (const client of clients.clients) {
    expect(value(client, () => {
      const { world, game } = shell();
      // Player 1 had walked far left; the confirmed cursor may already be a frame or two past the reset.
      return [game.phase, fighterAt(world, 2).status.damage, Math.abs(fighterAt(world, 0).motion.x - matchSpawnX(0)) < 5.0, fighterAt(world, 1).motion.x];
    })).toEqual([Phase.match, 40, true, matchSpawnX(1)]);
  }
  frames(60);
  expect(read(() => shell().game.phase)).toBe(Phase.match);
  expect(read(() => fighterAt(shell().world, 2).shield.raised)).toBe(true);
  expectSynchronized(clients);
});

test("-dev quick training starts a training match with a shielding partner at 40% and hit areas on, on both clients [spec #120]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  clients.start();
  frames(30);
  clients.chat(0, QUICK_TRAINING_COMMAND);
  frames(240);
  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(value(client, () => {
      const { game, world } = shell();
      return [game.phase, game.training, game.trainer.showHitAreas, game.computerMask, fighterAt(world, 2).status.damage, game.trainer.behaviour];
    })).toEqual([Phase.match, true, true, 4, 40, PartnerBehaviour.shield]);
  }
});
