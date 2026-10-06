// The development build's scene report, read the way the host reads it, against
// Smashcraft's declared player view (scripts/wisp/playerView.ts), with the model
// facts and arena cameras of its render visibility.
import { afterAll, expect, test } from "bun:test";
import { trampoline } from "wisp/src/platform/dispatch";
import { reportedModel, sceneFile } from "wisp/src/runtime/scene";
import { type SceneReport, readSceneLines, sceneProblems } from "wisp/scripts/wisp/scene";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";
import { IMPACT_DUST_MODEL, IMPACT_HIT_MODEL } from "../src/game/assets/impactAssetInfo";
import { STAGE_DECK_MODEL } from "../src/game/assets/stageAssetInfo";
import { Action, bit } from "../src/game/input/actions";
import { requestStageSelect, requestStart, selectCharacter, setParticipants } from "../src/game/match/rules";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { STOCK_MODELS } from "../src/game/render/effects";
import { IMPACT_DUST, IMPACTS_PER_KIND, impactLifetime } from "../src/game/presentation/impactState";
import { Character } from "../src/game/sim/codes";
import { QUICK_MATCH_COMMAND } from "../src/game/shell/devSettings";
import { install as installDevelopment, start as startDevelopment } from "../src/platform/devMain";
import { PERF_COMMAND } from "../src/platform/frameMeter";
import { startMatch } from "../src/platform/shell/matchStart";
import { shell } from "../src/platform/shell/state";
import { renderPersistentPresentation } from "../src/platform/shell/view";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

// Nothing here compares clients' native calls, so none are logged: the dense-dust match runs 240 frames.
const declarations = readNativeDeclarations();
const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this file compares no calls"]));
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged }, declarations);
const seconds = (value: number) => value * SMASHCRAFT_SCENE.framesPerSecond;
afterAll(headless.restore);

/** The client's latest scene report, from the lines it wrote. */
function sceneReport(client: HeadlessClient): SceneReport {
  const read = readSceneLines(client.files.get(sceneFile(client.slot, "smashcraft")) ?? []);
  if ("problem" in read) throw new Error(`scene report line ${read.line}: ${read.problem}`);
  return read;
}

test("development build: a match's scene report shows the stage and declares every effect the match creates", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  client.run(() => {
    const s = shell();
    selectCharacter(s.game, 0, Character.demonHunter);
    selectCharacter(s.game, 1, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(requestStart(s.game, 0)).toBe(true);
    // Every effect pool is created when the match starts.
    startMatch(s);
    renderPersistentPresentation(s);
    trampoline("scene.report")();
  });
  const report = sceneReport(client);
  expect(sceneProblems(report, SMASHCRAFT_SCENE)).toEqual([]);
  const declared = new Set(SMASHCRAFT_SCENE.kinds.flatMap(({ models }) => models.map((model) => model.replaceAll("\\", "/"))));
  expect(report.models.filter(({ model }) => !declared.has(model)).map(({ model }) => model)).toEqual([]);
  expect(report.effects).toBeGreaterThan(200);
  expect(report.models.find(({ model }) => model.includes("StageDeck"))).toMatchObject({ live: 1, inView: 1, drawn: 1 });
  expect(client.errors).toEqual([]);
});

test("the two shipped defects fail the scene check from the match's first report", () => {
  const read = (lines: readonly string[]) => {
    const report = readSceneLines(lines);
    if ("problem" in report) throw new Error(report.problem);
    return report;
  };
  const deck = `model 1 1 1 0 0 0 0 ${reportedModel(STAGE_DECK_MODEL)}`;
  // Match-start lines of the development build with 05266a3's parking reverted (evidence/render-visibility-20261006):
  // the rifleman's collapsed GyroCopterMissile pool waits at the floor and keeps smoking.
  expect(sceneProblems(read(["scene 1 frame 0 effects 267", deck, "model 16 16 0 0 0 0 0 Abilities/Weapons/GyroCopter/GyroCopterMissile.mdx"]), SMASHCRAFT_SCENE)).toEqual([{
    seen: "16 hidden projectiles in view still show particles",
    evidence: "model Abilities/Weapons/GyroCopter/GyroCopterMissile.mdx: 16 in view, 0 drawn; BlizParticle02 emits 30/s, each for 0.5 s",
  }]);
  // And with 168e08c's empty stage deck model.
  const emptyDeck = { ...SMASHCRAFT_SCENE, kinds: SMASHCRAFT_SCENE.kinds.map((kind) => (kind.name === "stage deck" ? { ...kind, models: [""] } : kind)) };
  expect(sceneProblems(read(["scene 1 frame 0 effects 267", "model 1 1 1 0 0 0 1 "]), emptyDeck).map(({ seen }) => seen)).toEqual([
    "no stage under the fighters: 0 of the 1 stage deck pieces a match needs are drawn",
    "invisible stage deck: 1 effects were created with no model, 1 of them meant to be drawn now",
    "nothing where a stage deck should be: the game names no model for it",
  ]);
});

/**
 * Dense play's dust: an archer jumping every 9 frames while running back and
 * forth, with two computers chasing it, takes the eight-slot dust pool's next
 * slot before the last dust in it fades. Counted as one stay, a reused slot
 * stayed in view over 180 frames and failed the rematch of #26's clean-folders
 * capture (240 frames) and its headless run (687).
 */
test("a dust slot reused while shown is a new stay each use; a standing spark and a collapsed missile still fail", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing client");
  // A hit spark left standing at the stage center, moved in view but never parked: the defect the check is for.
  let lingering: effect | undefined;
  client.run(() => {
    const s = shell();
    setParticipants(s.game, 1, 6);
    selectCharacter(s.game, 0, Character.archer);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    s.game.timeLimitMinutes = 0;
    lingering = AddSpecialEffect(IMPACT_HIT_MODEL, s.origin.x, s.origin.y);
  });
  // Per frame, how long each dust slot has been in view and how often its slot was reused meanwhile.
  const stays = new Map<number, { frames: number; reuses: number; age: number | undefined }>();
  let longestReused = 0;
  for (let frame = 0; frame < 240; frame++) {
    client.run(() => {
      const { origin, participants } = shell();
      const { row } = participants[0].capture;
      const direction = Math.floor(frame / 40) % 2 === 0 ? Action.moveLeft : Action.moveRight;
      row.held = bit(direction);
      row.pressed = (frame % 9 === 0 ? bit(Action.jump) : 0) | (frame % 40 === 0 ? bit(direction) : 0);
      row.axisX = direction === Action.moveLeft ? -127 : 127;
      if (lingering !== undefined && frame % 60 === 0) BlzSetSpecialEffectPosition(lingering, origin.x + frame, origin.y, origin.z);
    });
    clients.frames(1);
    client.run(() => {
      const s = shell();
      const pool = (s.ui?.combat as unknown as { impacts: readonly effect[] }).impacts;
      for (let use = 0; use < IMPACTS_PER_KIND; use++) {
        const slot = IMPACT_DUST * IMPACTS_PER_KIND + use;
        const handle = pool[slot];
        const shown = handle !== undefined && BlzGetLocalSpecialEffectZ(handle) > s.origin.z - FLOOR_HEIGHT + 1.0;
        const age = s.runtime.impacts.ages[slot];
        const stay = stays.get(slot) ?? { frames: 0, reuses: 0, age: undefined };
        const reuses = stay.reuses + (shown && stay.age !== undefined && age !== undefined && age < stay.age ? 1 : 0);
        stays.set(slot, shown ? { frames: stay.frames + 1, reuses, age } : { frames: 0, reuses: 0, age: undefined });
        if (shown && reuses > 0) longestReused = Math.max(longestReused, stay.frames + 1);
      }
    });
  }
  client.run(() => {
    // And 05266a3's defect: a collapsed missile waiting at the floor, where the camera sees its smoke.
    const { origin } = shell();
    const missile = AddSpecialEffect(STOCK_MODELS.gyroCopterMissile, origin.x, origin.y);
    BlzSetSpecialEffectScale(missile, 0.0);
    BlzSetSpecialEffectPosition(missile, origin.x, origin.y, origin.z);
    trampoline("scene.report")();
  });
  // A dust slot stayed in view across uses for longer than a hit spark may stay;
  // each use was a stay of its own, and only the standing spark and the collapsed missile fail.
  expect(longestReused).toBeGreaterThan(seconds(3));
  const report = sceneReport(client);
  expect(report.models.find(({ model }) => model === reportedModel(IMPACT_DUST_MODEL))?.longest).toBe(impactLifetime(IMPACT_DUST));
  expect(sceneProblems(report, SMASHCRAFT_SCENE).map(({ seen }) => seen)).toEqual([
    "a hit spark stayed in view for 4.00 s; it should be gone within 3.00 s",
    "1 hidden projectile in view still show particles",
  ]);
  expect(client.errors).toEqual([]);
});

test("development build: -dev perf shows the typing player what the match's frames cost", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment });
  clients.start();
  clients.frames(30);
  clients.chat(0, QUICK_MATCH_COMMAND);
  clients.frames(60);
  clients.chat(0, PERF_COMMAND);
  const overlay = (client: HeadlessClient | undefined) => client?.frames.shownText().filter((text) => text.startsWith("frame cost")) ?? [];
  const [host, guest] = clients.clients;
  // Bun has no Lua clock and counts no natives; the frames are the shell's since its first tick, the match advancing one a frame.
  expect(overlay(host)).toEqual(["frame cost, last 89 frames, median / max\nLua: no clock\nnatives: 0 / 0\ncatch-up frames: 1 / 1"]);
  expect(overlay(guest)).toEqual([]);
});
