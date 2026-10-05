// The development build's scene report, read the way the host reads it, against
// Smashcraft's declared player view (scripts/wisp/playerView.ts), with the model
// facts and arena cameras of its render visibility.
import { afterAll, expect, test } from "bun:test";
import { trampoline } from "wisp/src/platform/dispatch";
import { reportedModel, sceneFile } from "wisp/src/runtime/scene";
import { type SceneReport, readSceneLines, sceneProblems } from "wisp/scripts/wisp/scene";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";
import { STAGE_DECK_MODEL } from "../src/game/assets/stageAssetInfo";
import { requestStageSelect, requestStart, selectCharacter } from "../src/game/match/rules";
import { Character } from "../src/game/sim/codes";
import { start as startDevelopment } from "../src/platform/devMain";
import { startMatch } from "../src/platform/shell/matchStart";
import { shell } from "../src/platform/shell/state";
import { renderPersistentPresentation } from "../src/platform/shell/view";
import { type Client, installNatives } from "./desync/simulatedClient";
import { Lockstep } from "./desync/twoClients";

const restoreNatives = installNatives();
afterAll(restoreNatives);

/** The client's latest scene report, from the lines it wrote. */
function sceneReport(client: Client): SceneReport {
  const read = readSceneLines(client.files.get(sceneFile(client.slot, "smashcraft")) ?? []);
  if ("problem" in read) throw new Error(`scene report line ${read.line}: ${read.problem}`);
  return read;
}

test("development build: a match's scene report shows the stage and declares every effect the match creates", () => {
  const clients = new Lockstep([0, 1]);
  clients.everywhere(startDevelopment);
  clients.ticks(30);
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
