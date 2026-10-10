import { afterAll, expect, test } from "bun:test";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput } from "../src/game/match/frameInput";
import { Phase, requestStageSelect, selectCharacter } from "../src/game/match/rules";
import { startAtGo } from "../src/game/match/testMatch";
import { IMPACT_DUST, IMPACTS_PER_KIND } from "../src/game/presentation/impactState";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { ReplayCorrections, ReplayHistory } from "../src/game/replay/history";
import { Character } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { install, start } from "../src/platform/main";
import { applyFrame } from "../src/platform/shell/frame";
import { startMatch } from "../src/platform/shell/matchStart";
import { confirm } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { pauseMatchPresentation, renderPersistentPresentation, serviceResumePresentation } from "../src/platform/shell/view";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { EffectPose, HeadlessClient } from "wisp/src/headless/client";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);


function effectPoses(client: HeadlessClient): Map<unknown, EffectPose> {
  return new Map(client.effectPoses().map((pose) => [pose.handle, pose]));
}

const hidden = (pose: EffectPose) => pose.alpha === 0 || pose.scale === 0;

function visible(client: HeadlessClient, handles: ReadonlySet<unknown>): Map<unknown, EffectPose> {
  return new Map([...effectPoses(client)].filter(([handle, pose]) => handles.has(handle) && !hidden(pose)));
}

// Alpha, scale and time scale do not stop Warcraft model particle emitters.




function hiddenInView(client: HeadlessClient): unknown[] {
  const ground = shell().origin.z - FLOOR_HEIGHT;
  return [...effectPoses(client)].filter(([, pose]) => hidden(pose) && pose.z > ground).map(([handle]) => handle);
}

test("combat effects: rollback, pause/resume and rematch neither replay nor retain effects [k1 scenario]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const s = shell();
    selectCharacter(s.game, 0, Character.demonHunter);
    selectCharacter(s.game, 1, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(startAtGo(s.game, 0)).toBe(true);
    startMatch(s);
    s.game.timeLimitMinutes = 0;
    const handles = new Set([...effectPoses(client)].filter(([, pose]) => hidden(pose)).map(([handle]) => handle));
    expect(hiddenInView(client)).toEqual([]);
    const initialAllocations = client.log.filter(({ name }) => name === "AddSpecialEffect").length;
    const history = new ReplayHistory();
    const live = { world: s.world, match: s.game, controls: s.produced, runtime: s.runtime };
    expect(history.beginEpoch(14, 1, 12)).toBe(true);
    const step = () => {
      const frame = s.runtime.simulationFrame + 1;
      expect(captureFrame(s.frameInput, frame, s.world.mask, s.produced, s.runtime)).toBe(true);
      expect(history.saveSpeculative(14, s.frameInput, live)).toBe(true);
      applyFrame(s);
      renderPersistentPresentation(s);
    };
    const actionStart = client.log.length;
    s.produced.inputs[0].specialPressed = true;
    step();
    s.produced.inputs[0].specialPressed = false;
    const resets = client.log.slice(actionStart).filter(({ name, args }) => name === "BlzSetSpecialEffectTime" && args[1] === 0);
    expect(resets).toHaveLength(1);
    const animated = resets[0]?.args[0];
    const restarts = () => client.log.slice(actionStart).filter(({ name, args }) => name === "BlzSetSpecialEffectTime" && args[0] === animated && args[1] === 0);
    expect(visible(client, handles).has(animated)).toBe(true);
    s.produced.inputs[1].groundDodgePressed = true;
    s.produced.inputs[1].shield = true;
    step();
    s.produced.inputs[1].groundDodgePressed = false;
    s.produced.inputs[1].shield = false;
    for (let frame = 3; frame <= 5; frame++) step();
    expect(s.runtime.impacts.nextSlot[IMPACT_DUST]).toBe(2);
    expect(hiddenInView(client)).toEqual([]);
    const beforeCorrection = visible(client, handles);
    const corrected = createMatchFrameInput();
    expect(captureFrame(corrected, 2, s.world.mask, createFrameControls(), s.runtime)).toBe(true);
    const corrections = new ReplayCorrections();
    expect(corrections.beginEpoch(14)).toBe(true);
    expect(corrections.add(corrected)).toBe(true);
    const traceBeforeReplay = client.log.length;
    expect(history.correct(14, corrections, live)).toBe(2);
    expect(client.log.length).toBe(traceBeforeReplay);
    expect(s.runtime.impacts.nextSlot[IMPACT_DUST]).toBe(0);
    expect(s.runtime.impacts.ages[IMPACT_DUST * IMPACTS_PER_KIND]).toBeUndefined();
    renderPersistentPresentation(s);
    s.ui?.special.presentConfirmedAnimated(s.runtime.simulationFrame, fighterAt(s.world, 0), 0);
    expect(visible(client, handles).size).toBeLessThan(beforeCorrection.size);
    expect(restarts()).toHaveLength(1);
    expect(client.log.filter(({ name }) => name === "AddSpecialEffect")).toHaveLength(initialAllocations);
    expect(hiddenInView(client)).toEqual([]);

    s.session.paused = true;
    pauseMatchPresentation(s, true);
    const paused = visible(client, handles);
    expect(paused.has(animated)).toBe(true);
    expect(paused.get(animated)?.timeScale).toBe(0);
    expect([...paused.values()].every((pose) => pose.timeScale === 0)).toBe(true);
    expect(hiddenInView(client)).toEqual([]);
    for (let callback = 0; callback < 20; callback++) renderPersistentPresentation(s);
    expect(s.runtime.simulationFrame).toBe(5);
    expect(visible(client, handles)).toEqual(paused);
    expect(restarts()).toHaveLength(1);
    s.session.paused = false;
    pauseMatchPresentation(s, false);
    client.setWallTime(client.clockSeconds() + 1 / 60);
    client.draw(1 / 60);
    serviceResumePresentation(s);
    renderPersistentPresentation(s);
    expect(visible(client, handles)).toEqual(paused);
    expect(visible(client, handles).get(animated)?.timeScale).toBe(0);
    client.setWallTime(client.clockSeconds() + 2 / 60);
    serviceResumePresentation(s);
    expect(visible(client, handles).get(animated)?.timeScale).toBe(1);
    step();
    expect(s.runtime.simulationFrame).toBe(6);
    expect(restarts()).toHaveLength(1);

    s.game.timeLimitMinutes = 1;
    s.game.remainingFrames = 1;
    step();
    expect(s.game.phase).toBe(Phase.result);
    expect(visible(client, handles).size).toBe(0);
    expect(hiddenInView(client)).toEqual([]);
    confirm(s, 0);
    confirm(s, 1);
    expect(s.game.phase).toBe(Phase.characterMenu);
    expect(visible(client, handles).size).toBe(0);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(startAtGo(s.game, 0)).toBe(true);
    startMatch(s);
    expect(s.runtime.simulationFrame).toBe(0);
    expect(visible(client, handles).size).toBe(0);
    expect(hiddenInView(client)).toEqual([]);
    s.produced.inputs[0].specialPressed = true;
    expect(captureFrame(s.frameInput, 1, s.world.mask, s.produced, s.runtime)).toBe(true);
    applyFrame(s);
    renderPersistentPresentation(s);
    expect(visible(client, handles).has(animated)).toBe(true);

    expect(restarts().filter(({ args }) => args[0] === animated)).toHaveLength(2);
  });
  expect(client.errors).toEqual([]);
});
