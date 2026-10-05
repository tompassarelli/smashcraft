// The development build's scene report, read the way the host reads it, against
// Smashcraft's declared player view (scripts/wisp/playerView.ts).
import { afterAll, expect, test } from "bun:test";
import { trampoline } from "wisp/src/platform/dispatch";
import { sceneFile } from "wisp/src/runtime/scene";
import { type SceneReport, readSceneLines, sceneProblems } from "wisp/scripts/wisp/scene";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";
import { requestStageSelect, requestStart, selectCharacter } from "../src/game/match/rules";
import { Character } from "../src/game/sim/codes";
import { install as installDevelopment, start as startDevelopment } from "../src/platform/devMain";
import { startMatch } from "../src/platform/shell/matchStart";
import { shell } from "../src/platform/shell/state";
import { renderPersistentPresentation } from "../src/platform/shell/view";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
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
