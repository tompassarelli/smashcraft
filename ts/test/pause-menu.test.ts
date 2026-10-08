import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { Action, bit } from "../src/game/input/actions";
import { Phase, selectCharacter, setParticipants } from "../src/game/match/rules";
import { LESSONS, NO_LESSON } from "../src/game/match/tutorial";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { shows, value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

for (const mode of ["cpu", "classic", "training", "practice", "tutorial"] as const) {
  test(`pause menu returns ${mode} to its fighters and title with keyboard and pad [spec #331]`, () => {
    const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0]);
    clients.start();
    clients.frames(30);
    clients.everywhere(() => {
      const game = shell().game;
      setParticipants(game, 1, mode === "practice" ? 0 : 2);
      game.stockCount = 4;
      game.timeLimitMinutes = 7;
      if (mode === "training" || mode === "tutorial") game.training = true;
    });
    const first = clients.client(0);
    const choices = value(first, () => shell().game.characterChoices.slice());
    if (mode === "classic") clients.chat(0, "-dev classic Rifleman");
    else if (mode === "tutorial") clients.everywhere(() => panelActions().selection.startTutorial(0));
    else if (mode === "practice") {
      clients.everywhere(() => {
        selectCharacter(shell().game, 0, shell().game.characterChoices[0]);
        panelActions().selection.start(0);
        panelActions().stage.start(0);
      });
    } else clients.chat(0, mode === "cpu" ? "-dev quick cpu wren rookie" : "-dev quick");
    clients.frames(90);
    expect(value(first, () => shell().game.phase)).toBe(Phase.match);
    clients.press(0, Key.y);
    clients.frames(1);
    expect(value(first, () => shell().session.paused)).toBe(true);
    for (const label of ["Resume", "Character select", "Main menu"]) expect(shows(first, label)).toBe(true);
    const frame = value(first, () => shell().runtime.simulationFrame);
    clients.press(0, 0x28);
    clients.press(0, 0x26);
    if (mode === "cpu") first.key(0, Key.n, 0, true);
    else clients.press(0, Key.enter);
    clients.frames(5);
    expect(value(first, () => shell().session.paused)).toBe(false);
    if (mode === "cpu") {
      expect(value(first, () => (shell().rollback?.keyboard?.capture.row.held ?? 0) & bit(Action.attack))).toBe(0);
      first.key(0, Key.n, 0, false);
    }
    clients.press(0, Key.y);
    clients.frames(1);
    expect(value(first, () => shell().session.paused)).toBe(true);
    const selected = value(first, () => ({ fighters: shell().game.characterChoices.slice(), stocks: shell().game.stockCount, minutes: shell().game.timeLimitMinutes, training: shell().game.training, lesson: shell().game.trainer.lesson }));
    clients.press(0, 69);
    clients.frames(5);
    expect(value(first, () => shell().runtime.simulationFrame)).toBeGreaterThanOrEqual(frame);
    expect(value(first, () => shell().rollback?.keyboard?.capture.row.held)).toBe(0);
    clients.press(0, Key.n);
    clients.frames(5);
    expect(value(first, () => shell().game.phase)).toBe(Phase.characterMenu);
    expect(value(first, () => shell().session.paused)).toBe(false);
    if (mode === "classic") {
      expect(value(first, () => shell().game.characterChoices)).toEqual(choices);
      expect(value(first, () => [shell().game.stockCount, shell().game.timeLimitMinutes, shell().game.classic])).toEqual([4, 7, true]);
    } else expect(value(first, () => ({ fighters: shell().game.characterChoices.slice(), stocks: shell().game.stockCount, minutes: shell().game.timeLimitMinutes, training: shell().game.training, lesson: shell().game.trainer.lesson }))).toEqual(selected);
    if (mode === "classic") clients.chat(0, "-dev classic Rifleman");
    else if (mode === "tutorial") clients.everywhere(() => panelActions().selection.startTutorial(0));
    else if (mode === "practice") {
      clients.everywhere(() => {
        panelActions().selection.start(0);
        panelActions().stage.start(0);
      });
    } else clients.chat(0, "-dev quick");
    clients.frames(90);
    clients.press(0, Key.y);
    clients.frames(1);
    clients.press(0, 0x28);
    clients.press(0, 0x28);
    clients.press(0, Key.enter);
    clients.frames(5);
    expect(value(first, () => shell().pauseMenu?.title)).toBe(true);
    expect(shows(first, "Smashcraft")).toBe(true);
    clients.press(0, mode === "cpu" ? Key.enter : Key.n);
    clients.frames(1);
    expect(value(first, () => shell().pauseMenu?.title)).toBe(false);
    for (const client of clients.clients) expect(client.errors).toEqual([]);
    expect(clients.firstDivergence()).toBeUndefined();
  });
}

test("leaving a completed tutorial through the pause menu returns to ordinary Training [repro #331]", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0]);
  const first = clients.client(0);
  clients.start();
  clients.frames(30);
  clients.everywhere(() => panelActions().selection.startTutorial(0));
  clients.frames(90);
  expect(value(first, () => shell().game.phase)).toBe(Phase.match);
  clients.everywhere(() => { shell().game.trainer.lesson = LESSONS.length; });
  clients.press(0, Key.y);
  clients.frames(1);
  expect(value(first, () => shell().session.paused)).toBe(true);
  clients.press(0, Key.escape);
  clients.frames(5);
  expect(value(first, () => [shell().game.phase, shell().game.training, shell().game.trainer.lesson])).toEqual([Phase.characterMenu, true, NO_LESSON]);
  expect(first.errors).toEqual([]);
});
