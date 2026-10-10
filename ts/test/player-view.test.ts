
import { afterAll, expect, test } from "bun:test";
import { trampoline } from "wisp/src/platform/dispatch";
import { sceneFile } from "wisp/src/runtime/scene";
import { type SceneReport, readSceneLines, sceneProblems } from "wisp/scripts/wisp/scene";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";
import { requestStageSelect, requestStart, selectCharacter, selectStage } from "../src/game/match/rules";
import { PLAYABLE_BOUNDS } from "../src/game/presentation/arenaCamera";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { placedPieces } from "../src/game/presentation/stageScenery";
import { Character } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { surfaceCount } from "../src/game/sim/stage";
import { stageBounds } from "../src/game/sim/stageBounds";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "../src/game/sim/knockback";
import { install as installDevelopment, start as startDevelopment } from "../src/platform/devMain";
import { startMatch } from "../src/platform/shell/matchStart";
import { resetToStartingSelection, startQuickMatch } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { drawStageScenery } from "../src/platform/shell/stageScenery";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { MAIN_DECK_HALF_DEPTH } from "../scripts/stageDeck";
import { insideWorld } from "../scripts/stageViewRules";


const declarations = readNativeDeclarations();
const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this file compares no calls"]));

interface SetCamera {
  readonly fields: Map<string, number>;
  x: number;
  y: number;
}
const cameras = new Map<HeadlessClient, SetCamera>();
const aspects = new Map<HeadlessClient, number>();
const recordCamera = (client: HeadlessClient) => {
  const camera: SetCamera = { fields: new Map(), x: 0, y: 0 };
  cameras.set(client, camera);
  return {
    BlzGetLocalClientWidth: () => (aspects.get(client) ?? 16 / 9) * 1080,
    SetCameraField: (field: string, value: number) => void camera.fields.set(field, value),
    SetCameraPosition: (x: number, y: number) => {
      camera.x = x;
      camera.y = y;
    },
  };
};
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged, natives: recordCamera }, declarations);
afterAll(headless.restore);

test("every stage's scenery and the fighting plane stand inside Warcraft's world bounds, outside which no effect draws [repro #298]", () => {

  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.client(0);
  const outside: string[] = [];
  client.run(() => {
    const s = shell();

    const inside = insideWorld;
    if (!inside(s.origin.x, s.origin.y - MAIN_DECK_HALF_DEPTH)) outside.push("the deck's front edge");
    for (const stage of STAGE_CATALOG) {
      s.game.stageChoice = stage.id;
      drawStageScenery(s);
      const pieces = placedPieces(stage.id);
      for (const [index, effect] of (s.stageScenery ?? []).entries()) {
        if (!inside(BlzGetLocalSpecialEffectX(effect), BlzGetLocalSpecialEffectY(effect))) outside.push(`${stage.name}: ${pieces[index]?.model}`);
      }
    }
  });
  expect(outside).toEqual([]);
  expect(client.errors).toEqual([]);
});

// Warcraft constrains units to playable bounds, which must contain the blast zones.
const BLAST_MARGIN = 512.0;
for (const { id: stage, name } of STAGE_CATALOG) test(`${name}: every blast zone lies ${BLAST_MARGIN} inside the playable bounds, and a fighter launched past each one is KO'd [repro #298]`, () => {

  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0, 1]);
  clients.start();
  clients.frames(30);
  const client = clients.client(0);
  const { blast } = stageBounds(stage);
  const sides = [
    { side: "left", x: blast.left - 10.0, z: 0.0, vx: -20.0, vz: 0.0 },
    { side: "right", x: blast.right + 10.0, z: 0.0, vx: 20.0, vz: 0.0 },
    { side: "bottom", x: 0.0, z: blast.bottom - 10.0, vx: 0.0, vz: -20.0 },
    { side: "top", x: 0.0, z: blast.top + 10.0, vx: 0.0, vz: 20.0 },
  ] as const;
  const stocks: string[] = [];
  client.run(() => {
    const s = shell();

    const y = s.origin.y + PLAYABLE_BOUNDS.centreY;
    expect(s.origin.x + blast.left - BLAST_MARGIN).toBeGreaterThanOrEqual(PLAYABLE_BOUNDS.left);
    expect(s.origin.x + blast.right + BLAST_MARGIN).toBeLessThanOrEqual(PLAYABLE_BOUNDS.right);
    expect(y - MAIN_DECK_HALF_DEPTH - BLAST_MARGIN).toBeGreaterThanOrEqual(PLAYABLE_BOUNDS.front);
    expect(y + MAIN_DECK_HALF_DEPTH + BLAST_MARGIN).toBeLessThanOrEqual(PLAYABLE_BOUNDS.back);
    startQuickMatch(s, stage, s.build.scenario, undefined, sides.length + 1);
  });
  for (const { side, x, z, vx, vz } of sides) {
    let before = 0;
    client.run(() => {
      const fighter = fighterAt(shell().world, 0);
      before = fighter.status.stocks;
      fighter.motion.grounded = false;
      fighter.motion.x = x;
      fighter.motion.z = z;
      fighter.motion.vx = vx;
      fighter.motion.vz = vz;
      fighter.launch.knockbackZ = vz > 0 ? 2.0 * TOP_KO_MINIMUM_UPWARD_KNOCKBACK : 0.0;
    });
    clients.frames(2);
    client.run(() => stocks.push(`${side}: ${before - fighterAt(shell().world, 0).status.stocks}`));

    clients.frames(160);
  }
  expect(stocks).toEqual(sides.map(({ side }) => `${side}: 1`));
  expect(client.errors).toEqual([]);
});

function sceneReport(client: HeadlessClient): SceneReport {
  const read = readSceneLines(client.files.get(sceneFile(client.slot, "smashcraft")) ?? []);
  if ("problem" in read) throw new Error(`scene report line ${read.line}: ${read.problem}`);
  return read;
}

test("ranked stage lineup: both clients choose all ten stages and draw their decks and themed scenery [invariant]", () => {
  const stages = STAGE_CATALOG.filter(({ id }) => id !== 0);
  expect(stages).toHaveLength(10);
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment });
  clients.start();
  clients.frames(30);
  for (const stage of stages) {
    clients.everywhere(() => {
      const s = shell();
      resetToStartingSelection(s);
      selectCharacter(s.game, 0, Character.rifleman);
      selectCharacter(s.game, 1, Character.rifleman);
      expect(requestStageSelect(s.game, 0)).toBe(true);
      selectStage(s.game, 0, stage.id);
      expect(s.game.stageChoice).toBe(stage.id);
      expect(requestStart(s.game, 0)).toBe(true);
      startMatch(s);
    });
    clients.frames(60);
    for (const client of clients.clients) {
      client.run(() => {
        const s = shell();
        expect(s.stageDecks).toHaveLength(surfaceCount(stage.id));
        expect(s.stageScenery).toHaveLength(placedPieces(stage.id).length);
        expect(s.stageScenery?.length).toBeGreaterThan(0);
        trampoline("scene.report")();
      });
      expect(sceneProblems(sceneReport(client), SMASHCRAFT_SCENE)).toEqual([]);
      expect(client.errors).toEqual([]);
    }
  }
});
