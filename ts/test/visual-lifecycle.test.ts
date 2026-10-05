import { afterAll, expect, test } from "bun:test";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput } from "../src/game/match/frameInput";
import { Phase, requestStageSelect, requestStart, selectCharacter } from "../src/game/match/rules";
import { IMPACT_DUST, IMPACTS_PER_KIND } from "../src/game/presentation/impactState";
import { ReplayCorrections, ReplayHistory } from "../src/game/replay/history";
import { Character } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { start } from "../src/platform/main";
import { applyFrame } from "../src/platform/shell/frame";
import { startMatch } from "../src/platform/shell/matchStart";
import { confirm } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { pauseMatchPresentation, renderPersistentPresentation } from "../src/platform/shell/view";
import { type Client, installNatives } from "./desync/simulatedClient";
import { Lockstep } from "./desync/twoClients";

const restoreNatives = installNatives();
afterAll(restoreNatives);

interface EffectPose {
  alpha: number;
  scale: number;
  timeScale: number;
  position: readonly unknown[];
}

/** Read the existing native-call trace; the host does not simulate Warcraft particles. */
function effectPoses(client: Client): Map<unknown, EffectPose> {
  const poses = new Map<unknown, EffectPose>();
  for (const { name, args } of client.log) {
    if (name === "DestroyEffect") {
      poses.delete(args[0]);
      continue;
    }
    if (!name.startsWith("BlzSetSpecialEffect")) continue;
    const pose = poses.get(args[0]) ?? { alpha: 255, scale: 1, timeScale: 1, position: [] };
    poses.set(args[0], pose);
    if (name === "BlzSetSpecialEffectAlpha") pose.alpha = Number(args[1]);
    if (name === "BlzSetSpecialEffectScale") pose.scale = Number(args[1]);
    if (name === "BlzSetSpecialEffectTimeScale") pose.timeScale = Number(args[1]);
    if (name === "BlzSetSpecialEffectPosition") pose.position = args.slice(1);
  }
  return poses;
}

function visible(client: Client, handles: ReadonlySet<unknown>): Map<unknown, EffectPose> {
  return new Map([...effectPoses(client)].filter(([handle, pose]) => handles.has(handle) && pose.alpha > 0 && pose.scale > 0));
}

test("combat effects: rollback, pause/resume and rematch neither replay nor retain effects", () => {
  const clients = new Lockstep([0, 1]);
  clients.everywhere(start);
  clients.ticks(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const s = shell();
    selectCharacter(s.game, 0, Character.demonHunter);
    selectCharacter(s.game, 1, Character.archer);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    s.game.timeLimitMinutes = 0;
    const handles = new Set([...effectPoses(client)].filter(([, pose]) => pose.alpha === 0).map(([handle]) => handle));
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
    const restarts = () => client.log.slice(actionStart).filter(({ name, args }) => name === "BlzSetSpecialEffectTime" && args[1] === 0);
    expect(restarts()).toHaveLength(1);
    const animated = restarts()[0]?.args[0];
    expect(visible(client, handles).has(animated)).toBe(true);
    s.produced.inputs[1].groundDodgePressed = true;
    s.produced.inputs[1].shield = true;
    step();
    s.produced.inputs[1].groundDodgePressed = false;
    s.produced.inputs[1].shield = false;
    for (let frame = 3; frame <= 5; frame++) step();
    expect(s.runtime.impacts.nextSlot[IMPACT_DUST]).toBe(2);
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

    s.session.paused = true;
    pauseMatchPresentation(s, true);
    const paused = visible(client, handles);
    expect(paused.has(animated)).toBe(true);
    expect(paused.get(animated)?.timeScale).toBe(0);
    expect([...paused.values()].every((pose) => pose.timeScale === 0)).toBe(true);
    for (let callback = 0; callback < 20; callback++) renderPersistentPresentation(s);
    expect(s.runtime.simulationFrame).toBe(5);
    expect(visible(client, handles)).toEqual(paused);
    expect(restarts()).toHaveLength(1);
    s.session.paused = false;
    pauseMatchPresentation(s, false);
    expect(visible(client, handles).get(animated)?.timeScale).toBe(1);
    step();
    expect(s.runtime.simulationFrame).toBe(6);
    expect(restarts()).toHaveLength(1);

    s.game.timeLimitMinutes = 1;
    s.game.remainingFrames = 1;
    step();
    expect(s.game.phase).toBe(Phase.result);
    expect(visible(client, handles).size).toBe(0);
    confirm(s, 0);
    confirm(s, 1);
    expect(s.game.phase).toBe(Phase.characterMenu);
    expect(visible(client, handles).size).toBe(0);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    expect(s.runtime.simulationFrame).toBe(0);
    expect(visible(client, handles).size).toBe(0);
    s.produced.inputs[0].specialPressed = true;
    expect(captureFrame(s.frameInput, 1, s.world.mask, s.produced, s.runtime)).toBe(true);
    applyFrame(s);
    renderPersistentPresentation(s);
    expect(visible(client, handles).has(animated)).toBe(true);
    // Fighter shields are recreated by the rematch; count only the retained particle's restarts.
    expect(restarts().filter(({ args }) => args[0] === animated)).toHaveLength(2);
  });
  expect(client.errors).toEqual([]);
});
