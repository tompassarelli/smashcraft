import { afterAll, expect, test } from "bun:test";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput } from "../src/game/match/frameInput";
import { Phase, requestStageSelect, selectCharacter } from "../src/game/match/rules";
import { startAtGo } from "../src/game/match/testMatch";
import { IMPACT_DUST, IMPACTS_PER_KIND } from "../src/game/presentation/impactState";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { ReplayCorrections, ReplayHistory } from "../src/game/replay/history";
import { Character, SpecialAction } from "../src/game/sim/codes";
import { HitElement } from "../src/game/sim/hitRegions";
import { fighterAt } from "../src/game/sim/roster";
import { projectileActive } from "../src/game/sim/projectiles";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { install, start, startBuild } from "../src/platform/main";
import { applyFrame } from "../src/platform/shell/frame";
import { startMatch } from "../src/platform/shell/matchStart";
import { confirm } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { views } from "../src/platform/shell/ui";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { resultsView } from "../src/game/presentation/matchCues";
import { pauseMatchPresentation, renderFighter, renderPersistentPresentation, serviceResumePresentation } from "../src/platform/shell/view";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { EffectPose, HeadlessClient } from "wisp/src/headless/client";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { CombatEffects, fighterModel } from "../src/game/render/combatEffects";
import { originalClip, originalClipNamed } from "../src/game/assets/fighterOriginalClipInfo";
import { victoryAnimation } from "../src/game/presentation/matchAudio";
import { createImpactEvents } from "../src/game/presentation/impactEvents";
import { ELECTRIC_CONTACT_FRAMES, advanceImpacts, createImpactState, emitImpacts } from "../src/game/presentation/impactState";
import { ELECTRIC_IMPACT_MODEL } from "../src/game/presentation/hitPresentation";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { HIT_PRESENTATION_CASES } from "../src/game/shell/hitPresentationCases";
import { SpecialEffects } from "../src/game/render/specialEffects";
import { IMMOLATE_SOUNDS } from "../src/game/presentation/elementLooks";
import { originalClip } from "../src/game/assets/fighterOriginalClipInfo";
import { createFighterPose } from "../src/game/presentation/fighterPose";
import { contactDamageClip } from "../src/game/presentation/damagePose";
import { characterModelScale } from "../src/game/presentation/modelScale";
import { FighterPoolPresentation } from "../src/game/render/fighterPool";
import { createFighter } from "../src/game/sim/fighter";
import { TIMED_TEST_STAGE } from "../src/game/sim/stage";
import { drawStageScenery } from "../src/platform/shell/stageScenery";
import { applyDeveloperCommand } from "../src/platform/shell/keys";
import { WHITE_FIGHTER_MODELS } from "../src/game/assets/whiteFighterModels";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("grab holders draw in front of large captives in both facings and return after release [repro #180]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const fighter = createFighter(Character.mountainKing, 0, 1);
    const pool = new FighterPoolPresentation(fighter.character, 0, { x: 0, y: 0, z: FLOOR_HEIGHT });
    const pose = createFighterPose();
    pose.clipIndex = 0;
    const clip = originalClip(fighter.character, 0);
    if (clip === undefined) throw new Error("missing standing clip");
    const shown = () => client.effectPoses().find(effect => effect.model === clip.modelPath);
    for (const facing of [1, -1]) {
      fighter.facing = facing;
      fighter.grab.target = 1;
      pool.present(fighter, pose, 0, 1);
      expect(shown()?.y).toBeLessThan(0);
      expect(fighter.motion.x).toBe(0);
      fighter.grab.target = undefined;
      pool.present(fighter, pose, 0, 2);
      expect(shown()?.y).toBe(0);
    }
    pool.destroy();
  });
  expect(client.errors).toEqual([]);
});

test("Ahn'Qiraj keeps neutral fighter colours, the hit pulse and scenery at stock light or stage change [spec #267]", () => {
  const clients = headless.clients({ start: () => startBuild({ ...INTEGRITY_BUILD, presentation: "pool-confirmed" }), install });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick stage 13");
  clients.frames(1);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const s = shell();
    const fighter = fighterAt(s.world, 0);
    const pose = s.runtime.poses[0];
    const clip = originalClip(fighter.character, pose.clipIndex ?? 0);
    if (clip === undefined) throw new Error("missing fighter clip");
    const body = () => client.effectPoses().find(effect => effect.model === clip.modelPath && effect.scale > 0);
    const white = () => client.effectPoses().find(effect => effect.model === WHITE_FIGHTER_MODELS[fighter.character] && effect.scale > 0);
    const scenery = () => client.effectPoses().filter(effect => (s.stageScenery ?? []).includes(effect.handle)).map(effect => [effect.handle, effect.color, effect.scale]);
    expect(s.game.stageChoice).toBe(TIMED_TEST_STAGE);
    const backdrop = scenery();
    renderPersistentPresentation(s);
    expect(body()?.color).toEqual([255, 255, 255]);
    fighter.launch.hitlag = 10;
    renderPersistentPresentation(s);
    expect(white()?.color).toEqual([255, 255, 255]);
    expect(white()?.alpha).toBe(220);
    fighter.launch.hitlag = 8;
    renderPersistentPresentation(s);
    expect(white()?.alpha).toBe(100);
    fighter.launch.hitlag = 0;
    fighter.status.frozenFrames = 3;
    renderPersistentPresentation(s);
    expect(body()?.color).toEqual([155, 210, 255]);
    expect(scenery()).toEqual(backdrop);
    applyDeveloperCommand(s, 0, "-dev lighting stock");
    expect(body()?.color).toEqual([155, 210, 255]);
    expect(scenery()).not.toEqual(backdrop);
    applyDeveloperCommand(s, 0, "-dev lighting stage");
    expect(scenery()).toEqual(backdrop);
    fighter.status.frozenFrames = 0;
    s.participants[0].pooled = false;
    renderFighter(s, 0, pose, false);
    const unit = s.participants[0].body?.unit;
    expect(client.log.findLast(call => call.name === "SetUnitVertexColor" && call.args[0] === unit)?.args.slice(1)).toEqual([255, 255, 255, 255]);
    applyDeveloperCommand(s, 0, "-dev lighting stock");
    expect(client.log.findLast(call => call.name === "SetUnitVertexColor" && call.args[0] === unit)?.args.slice(1)).toEqual([255, 255, 255, 255]);
    applyDeveloperCommand(s, 0, "-dev lighting stage");
    s.game.stageChoice = 0;
    drawStageScenery(s);
    renderPersistentPresentation(s);
    expect(body()?.color).toEqual([255, 255, 255]);
    fighter.launch.hitlag = 10;
    renderPersistentPresentation(s);
    expect(white()?.color).toEqual([255, 255, 255]);
    expect(white()?.alpha).toBe(220);
    renderFighter(s, 0, pose, false);
    expect(client.log.findLast(call => call.name === "SetUnitVertexColor" && call.args[0] === unit)?.args.slice(1)).toEqual([255, 255, 255, 255]);
  });
  expect(client.errors).toEqual([]);
});

test("Immolation loops are released on match reset and presentation destruction [invariant]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const renderer = new SpecialEffects(shell().origin);
    const fighter = fighterAt(shell().world, 0);
    fighter.character = Character.demonHunter;
    fighter.special.action = SpecialAction.demonHunterImmolate;
    fighter.special.frame = 0;
    for (const finish of [() => renderer.clear(), () => renderer.clear(), () => renderer.destroy()]) {
      const before = client.log.length;
      renderer.presentConfirmedAnimated(0, fighter, 0);
      const made = client.log.slice(before).find(call => call.name === "CreateSoundFromLabel" && call.args[0] === IMMOLATE_SOUNDS.loop);
      expect(made).toBeDefined();
      finish();
      const stops = client.log.slice(before).filter(call => call.name === "StopSound");
      const releases = client.log.slice(before).filter(call => call.name === "KillSoundWhenDone");
      expect(stops).toHaveLength(1);
      expect(releases.some(call => call.args[0] === stops[0]?.args[0])).toBe(true);
    }
  });
});

test("hit event language: 26 event cases reach stock effects and confirmed sounds without replay [invariant]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(1);
  const commandClient = clients.clients[0];
  if (commandClient === undefined) throw new Error("missing host client");
  const commandStart = commandClient.log.length;
  clients.chat(0, "-dev effects 3");
  expect(commandClient.log.slice(commandStart).some(call => call.name === "CreateSoundFromLabel" && call.args[0] === "Fireball")).toBe(true);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const renderer = new CombatEffects({ x: 0, y: 0, z: FLOOR_HEIGHT });

    const shownScale: number[] = [];
    for (const [index, { cue, sound, model }] of HIT_PRESENTATION_CASES.entries()) {
      renderer.clear();
      const events = { ...createImpactEvents(), ...cue };
      const impacts = createImpactState();
      emitImpacts(impacts, events, 8);
      const before = client.log.length;
      renderer.presentConfirmed(index + 1, 0, events);
      renderer.present(impacts, 0, impacts, true);
      const calls = client.log.slice(before);

      expect(calls.filter(call => call.name === "CreateSoundFromLabel" || call.name === "CreateSound")
        .map(call => String(call.args[0]).split("\\").pop()?.replace(/\.flac$/, ""))).toEqual([sound]);
      expect(calls.filter(call => call.name === "StartSound")).toHaveLength(1);
      expect(client.effectPoses().some(pose => pose.model.includes(model) && pose.scale > 0)).toBe(true);
      shownScale[index] = Math.max(...client.effectPoses().filter(pose => pose.model.includes(model)).map(pose => pose.scale));
      const after = client.log.length;
      renderer.presentConfirmed(index + 1, 0, events);
      renderer.presentConfirmed(index, 0, events);
      expect(client.log.length).toBe(after);
    }

    expect(shownScale[2]).toBeGreaterThanOrEqual(shownScale[7] ?? 0);
    renderer.destroy();
  });
  expect(client.errors).toEqual([]);
});

test("electric hit and electric shield sparks draw Lightning Shield at least 200 units across for 24 frames [repro #301]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  const facts = MODEL_FACTS[ELECTRIC_IMPACT_MODEL];
  if (facts?.bounds === undefined) throw new Error("missing Lightning Shield facts");
  const width = facts.bounds.max[0] - facts.bounds.min[0];
  client.run(() => {
    const renderer = new CombatEffects({ x: 0, y: 0, z: FLOOR_HEIGHT });
    for (const cue of [{ hit: true, element: HitElement.electric, electric: true }, { shieldHit: true, shieldElectric: true }]) {
      renderer.clear();
      const impacts = createImpactState();
      emitImpacts(impacts, { ...createImpactEvents(), ...cue }, 8);
      const shown = () => client.effectPoses({ visibleOnly: true }).filter(pose => pose.model.includes("LightningShieldTarget"));
      for (let age = 0; age <= ELECTRIC_CONTACT_FRAMES; age++) {
        renderer.present(impacts, age, impacts, true);
        if (age < ELECTRIC_CONTACT_FRAMES) {
          expect(shown()).toHaveLength(1);
          expect(shown()[0]?.animation).toBe("Stand");

          expect((shown()[0]?.scale ?? 0) * width).toBeGreaterThanOrEqual(200);
        } else expect(shown()).toHaveLength(0);
        advanceImpacts(impacts);
      }
    }
    renderer.destroy();
  });
  expect(client.errors).toEqual([]);
});

test("contact sparks and failed stock cues have visible geometry in front of Mountain King [repro #82]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  const client = clients.client(0);
  const body = MODEL_FACTS[fighterModel(Character.mountainKing)]?.bounds;
  if (body === undefined) throw new Error("missing Mountain King bounds");
  client.run(() => {
    const renderer = new CombatEffects({ x: 0, y: 0, z: FLOOR_HEIGHT });
    for (const index of [0, 1, 3, 6, 15, 16, 17, 18, 19]) {
      renderer.clear();
      const cue = HIT_PRESENTATION_CASES[index];
      if (cue === undefined) throw new Error(`missing case ${index}`);
      const impacts = createImpactState();
      emitImpacts(impacts, { ...createImpactEvents(), ...cue.cue }, 8);
      renderer.present(impacts, 0, impacts, true);
      const shown = client.effectPoses({ visibleOnly: true });
      expect(shown.some(pose => (MODEL_FACTS[pose.model]?.geosets ?? 0) > 0)).toBe(true);
      if ([0, 1, 3, 6, 16, 17, 18].includes(index)) {
        expect(shown.some(pose => pose.y < body.min[1] * characterModelScale(Character.mountainKing))).toBe(true);
      }
    }
    renderer.destroy();
  });
});

test("damage hue and shield recoil reach the renderer through freeze, stun and recovery without allocating effects [invariant]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const s = shell();
    selectCharacter(s.game, 0, Character.rifleman);
    selectCharacter(s.game, 1, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(startAtGo(s.game, 0)).toBe(true);
    startMatch(s);
    const victim = fighterAt(s.world, 0);
    const initialAllocations = client.log.filter(({ name }) => name === "AddSpecialEffect").length;
    const draw = () => {
      const before = client.log.length;
      renderFighter(s, 0, s.runtime.poses[0], false);
      renderPersistentPresentation(s);
      return client.log.slice(before);
    };
    victim.launch.hitstun = 12;
    for (const lag of [5, 0]) {
      victim.launch.hitlag = lag;
      const colours = draw().filter(({ name }) => name === "BlzSetSpecialEffectColor" || name === "SetUnitVertexColor");
      expect(colours.some(({ args }) => args[1] === 255 && args[2] === 185 && args[3] === 150)).toBe(true);
    }
    victim.launch.hitstun = 0;
    expect(draw().some(({ name, args }) => (name === "BlzSetSpecialEffectColor" || name === "SetUnitVertexColor") && args[2] === 185)).toBe(false);
    victim.shield.raised = true;
    victim.shield.stun = 5;
    victim.shield.pushbackX = -10;
    for (const lag of [4, 0]) {
      victim.launch.hitlag = lag;
      const calls = draw();
      expect(calls.some(({ name, args }) => name === "BlzSetSpecialEffectColor" && args[1] === 255 && args[2] === 225 && args[3] === 150)).toBe(true);
      expect(calls.some(({ name, args }) => name === "BlzSetSpecialEffectPosition" && args[1] === s.origin.x + victim.motion.x - 6)).toBe(true);
    }
    victim.shield.stun = 0;
    expect(draw().some(({ name, args }) => name === "BlzSetSpecialEffectColor" && args[2] === 225)).toBe(false);
    expect(client.log.filter(({ name }) => name === "AddSpecialEffect")).toHaveLength(initialAllocations);
  });
  expect(client.errors).toEqual([]);
});

test("combat effects: a hit corrected in after its spark's window still shows its spark once, from the start [invariant]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const renderer = new CombatEffects({ x: 0, y: 0, z: FLOOR_HEIGHT });
    const sparks = () => client.effectPoses().filter((pose) => pose.model.includes("ImpactHit-") && pose.scale > 0 && pose.z > -FLOOR_HEIGHT);
    const hit = { ...createImpactEvents(), hit: true, x: 40.0, z: 100.0 };
    const empty = createImpactState();

    for (let frame = 10; frame < 30; frame++) renderer.present(empty, frame, empty, true);
    expect(sparks()).toHaveLength(0);
    renderer.confirmContacts(10, hit);
    const shown: number[] = [];
    for (let frame = 30; frame < 45; frame++) {
      renderer.present(empty, frame, empty, true);
      shown.push(sparks().length);
    }

    expect(shown).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]);

    renderer.confirmContacts(50, hit);
    for (let n = 0; n < 20; n++) renderer.present(empty, 60, empty, true);
    expect(sparks()).toHaveLength(1);
    renderer.clear();


    const predicted = createImpactState();
    emitImpacts(predicted, hit, 70);
    renderer.present(predicted, 70, empty, true);
    expect(sparks()).toHaveLength(1);
    const later = createImpactState();
    for (let frame = 71; frame < 90; frame++) renderer.present(later, frame, empty, true);
    renderer.confirmContacts(70, hit);
    for (let frame = 90; frame < 95; frame++) {
      renderer.present(later, frame, empty, true);
      expect(sparks()).toHaveLength(0);
    }

    const confirmed = createImpactState();
    emitImpacts(confirmed, hit, 100);
    renderer.confirmContacts(100, hit);
    renderer.present(confirmed, 100, confirmed, true);
    expect(sparks()).toHaveLength(1);
    renderer.destroy();
  });
  expect(client.errors).toEqual([]);
});


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

test("combat effects: rollback, pause/resume and rematch neither replay nor retain effects [invariant]", () => {
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

test("quick match: a shot's missile and the idle missile pools stay out of the arena camera's view [provisional]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const s = shell();
    selectCharacter(s.game, 0, Character.rifleman);
    selectCharacter(s.game, 1, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(startAtGo(s.game, 0)).toBe(true);
    startMatch(s);
    s.game.timeLimitMinutes = 0;

    expect(hiddenInView(client)).toEqual([]);
    const handles = new Set([...effectPoses(client)].filter(([, pose]) => hidden(pose)).map(([handle]) => handle));
    const step = () => {
      expect(captureFrame(s.frameInput, s.runtime.simulationFrame + 1, s.world.mask, s.produced, s.runtime)).toBe(true);
      applyFrame(s);
      renderPersistentPresentation(s);
    };
    s.produced.inputs[1].specialPressed = true;
    step();
    s.produced.inputs[1].specialPressed = false;
    const rifleman = fighterAt(s.world, 1);
    const shooting = () => rifleman.projectiles.some((_, index) => projectileActive(rifleman, index));
    let shown = 0;
    for (let frame = 0; frame < 10 && !shooting(); frame++) step();
    expect(shooting()).toBe(true);
    for (let frame = 0; frame < 120 && shooting(); frame++) {
      step();
      shown = Math.max(shown, visible(client, handles).size);
    }
    expect(shooting()).toBe(false);
    expect(shown).toBeGreaterThan(0);
    expect(hiddenInView(client)).toEqual([]);

    s.game.timeLimitMinutes = 1;
    s.game.remainingFrames = 1;
    step();
    expect(s.game.phase).toBe(Phase.result);
    expect(hiddenInView(client)).toEqual([]);
    confirm(s, 0);
    confirm(s, 1);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(startAtGo(s.game, 0)).toBe(true);
    startMatch(s);
    expect(hiddenInView(client)).toEqual([]);
  });
  expect(client.errors).toEqual([]);
});

test("pooled fighters: unchanged poses keep their appearance and a returning fading clip draws fully [provisional]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const fighter = createFighter(Character.rifleman, 0, 1);
    const pool = new FighterPoolPresentation(fighter.character, 0, { x: 0, y: 0, z: FLOOR_HEIGHT });
    const pose = createFighterPose();
    pose.clipIndex = 0;
    const clip = originalClip(fighter.character, 0);
    if (clip === undefined) throw new Error("missing standing clip");
    const shown = () => client.effectPoses().find(effect => effect.model === clip.modelPath);
    const draw = (frame: number) => {
      const before = client.log.length;
      pool.present(fighter, pose, 0, frame);
      return client.log.slice(before);
    };
    const allocations = client.log.filter(call => call.name === "AddSpecialEffect").length;
    draw(1);
    expect(shown()?.alpha).toBe(255);
    expect(shown()?.scale).toBe(characterModelScale(fighter.character));
    const repeated = draw(2);
    expect(repeated.some(call => call.name === "BlzSetSpecialEffectPosition")).toBe(true);
    expect(repeated.filter(call => ["BlzSetSpecialEffectYaw", "BlzSetSpecialEffectScale", "BlzSetSpecialEffectTime", "BlzSetSpecialEffectColor", "BlzSetSpecialEffectAlpha"].includes(call.name))).toEqual([]);

    fighter.facing = -1;
    fighter.status.frozenFrames = 3;
    pose.clipTime = 0.25;
    const changed = draw(3);
    expect(changed.some(call => call.name === "BlzSetSpecialEffectYaw" && Number(call.args[1]) > 3)).toBe(true);
    expect(changed.some(call => call.name === "BlzSetSpecialEffectTime" && call.args[1] === clip.startSeconds + 0.25)).toBe(true);
    expect(changed.some(call => call.name === "BlzSetSpecialEffectColor" && call.args.slice(1).join(",") === "155,210,255")).toBe(true);
    fighter.status.frozenFrames = 0;
    fighter.status.invincible = 5;
    const recovered = draw(4);
    expect(recovered.some(call => call.name === "BlzSetSpecialEffectColor" && call.args.slice(1).join(",") === "255,255,255")).toBe(true);
    expect(shown()?.alpha).toBe(140);
    fighter.status.invincible = 0;
    draw(5);
    expect(shown()?.alpha).toBe(255);

    fighter.launch.hitlag = 5;
    pose.clipIndex = contactDamageClip(fighter).index;
    draw(6);
    expect(shown()?.alpha).toBeGreaterThan(0);
    expect(shown()?.alpha).toBeLessThan(255);
    pose.clipIndex = 0;
    draw(7);
    expect(shown()?.alpha).toBe(255);
    expect(shown()?.scale).toBe(characterModelScale(fighter.character));
    pool.hide();
    expect(shown()?.scale).toBe(0);
    draw(8);
    expect(shown()?.alpha).toBe(255);
    expect(shown()?.scale).toBe(characterModelScale(fighter.character));
    expect(client.log.filter(call => call.name === "AddSpecialEffect")).toHaveLength(allocations);
    pool.destroy();
  });
  expect(client.errors).toEqual([]);
});

test("every fighter wears its slot's player colour from the first match frame through the victory pose [repro #320]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");

  const firstColoured = client.log.findIndex(call => call.name === "BlzSetSpecialEffectColorByPlayer" || call.name === "CreateUnit");
  expect(firstColoured).toBeGreaterThan(0);
  const recoloured = client.log.slice(0, firstColoured).filter(call => call.name === "SetPlayerColor").map(call => call.args.join(","));
  expect(recoloured).toEqual(PARTICIPANT_SLOTS.map(slot => `${slot},${slot}`));
  clients.chat(0, "-dev quick pair Forsaken Paladin / Cairne Bloodhoof");
  const problems: string[] = [];
  let matchFrames = 0;
  for (let frame = 0; frame < 150; frame++) {
    clients.frames(1);
    client.run(() => {
      const s = shell();
      if (s.game.phase !== Phase.match) return;
      matchFrames++;
      for (const slot of [0, 1] as const) {
        const pool = views(s).fighters[slot]?.pool as unknown as { readonly clips: readonly unknown[] } | undefined;
        if (pool === undefined) {
          problems.push(`match frame ${matchFrames}: slot ${slot} has no clip pool`);
          continue;
        }
        const poses = (client as unknown as { readonly effects: ReadonlyMap<unknown, EffectPose> }).effects;
        const colours = new Set(pool.clips.map(clip => poses.get(clip)?.teamColor));
        if (colours.size !== 1 || !colours.has(slot)) problems.push(`match frame ${matchFrames}: slot ${slot} clips wear players ${[...colours].join(",")}`);
      }
    });
  }
  expect(problems).toEqual([]);
  expect(matchFrames).toBeGreaterThan(60);
  client.run(() => {
    const s = shell();
    s.game.winner = 1;
    const ui = views(s);
    ui.match.beginResults(resultsView(s.game, s.world, ui.match.tally), 0);
    ui.match.tick();
    const victory = originalClipNamed(Character.cairne, victoryAnimation(Character.cairne));
    const clip = victory === undefined ? undefined : originalClip(Character.cairne, victory);
    const model = clip?.timeline === true ? clip.modelPath : fighterModel(Character.cairne);
    const pose = client.effectPoses().filter(effect => effect.model === model && effect.scale > 0).at(-1);
    expect(pose?.teamColor).toBe(1);
  });
  expect(client.errors).toEqual([]);
});
