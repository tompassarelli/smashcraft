// The development build's scene report, read the way the host reads it, against
// Smashcraft's declared player view (scripts/wisp/playerView.ts), with the model
// facts and arena cameras of its render visibility.
import { afterAll, expect, test } from "bun:test";
import { trampoline } from "wisp/src/platform/dispatch";
import { reportedModel, sceneFile } from "wisp/src/runtime/scene";
import { type SceneReport, readSceneLines, sceneProblems } from "wisp/scripts/wisp/scene";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";
import { IMPACT_DUST_MODEL, IMPACT_HIT_MODEL } from "../src/game/assets/impactAssetInfo";
import { STAGE_DECK_MODEL, STAGE_MAIN_DECK_MODEL } from "../src/game/assets/stageAssetInfo";
import { Action, bit } from "../src/game/input/actions";
import { requestStageSelect, requestStart, selectCharacter, setParticipants } from "../src/game/match/rules";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { STOCK_MODELS } from "../src/game/render/effects";
import { IMPACT_DUST, IMPACTS_PER_KIND, impactLifetime } from "../src/game/presentation/impactState";
import { Character, SurfaceContact } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { DRIFTING_DECK_STAGE, PATTERNED_DECKS_STAGE, MAIN_DECK_BODY_SURFACES, MAIN_DECK_UNDERSIDE_Z, solidSurfaceAt, surfaceLeft, surfaceRight, surfaceZ } from "../src/game/sim/stage";
import { BLAST_ZONE_BOTTOM, BLAST_ZONE_SIDE, BLAST_ZONE_TOP } from "../src/game/sim/stocks";
import { QUICK_MATCH_COMMAND } from "../src/game/shell/devSettings";
import { initializeScenario } from "../src/game/shell/scenarios";
import { install as installDevelopment, start as startDevelopment } from "../src/platform/devMain";
import { PERF_COMMAND } from "../src/platform/frameMeter";
import { startMatch } from "../src/platform/shell/matchStart";
import { shell } from "../src/platform/shell/state";
import { drawStage, lockArenaCamera, renderPersistentPresentation } from "../src/platform/shell/view";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { MAIN_DECK_HALF_DEPTH } from "../scripts/stageDeck";

// Nothing here compares clients' native calls, so none are logged: the dense-dust match runs 240 frames.
const declarations = readNativeDeclarations();
const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this file compares no calls"]));
/** The camera fields and position each client last set. */
interface SetCamera {
  readonly fields: Map<string, number>;
  x: number;
  y: number;
}
const cameras = new Map<HeadlessClient, SetCamera>();
const recordCamera = (client: HeadlessClient) => {
  const camera: SetCamera = { fields: new Map(), x: 0, y: 0 };
  cameras.set(client, camera);
  return {
    SetCameraField: (field: string, value: number) => void camera.fields.set(field, value),
    SetCameraPosition: (x: number, y: number) => {
      camera.x = x;
      camera.y = y;
    },
  };
};
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged, natives: recordCamera }, declarations);
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
  expect(report.models.find(({ model }) => model === reportedModel(STAGE_MAIN_DECK_MODEL))).toMatchObject({ live: 1, inView: 1, drawn: 1 });
  expect(client.errors).toEqual([]);
});

test("moving decks are visible and their effects follow the presented match frame", () => {
  for (const stage of [DRIFTING_DECK_STAGE, PATTERNED_DECKS_STAGE]) {
    const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
    clients.start();
    clients.frames(30);
    const client = clients.clients[0];
    if (client === undefined) throw new Error("missing client");
    client.run(() => {
      const s = shell();
      selectCharacter(s.game, 0, Character.archer);
      selectCharacter(s.game, 1, Character.rifleman);
      requestStageSelect(s.game, 0);
      s.game.stageChoice = stage;
      requestStart(s.game, 0);
      startMatch(s);
      drawStage(s);
      for (const frame of [0, 100, 210, 420, 600]) {
        s.game.matchFrame = frame;
        renderPersistentPresentation(s);
        lockArenaCamera(s);
        for (let deck = 1; deck < s.stageDecks.length; deck++) {
          const effect = s.stageDecks[deck];
          if (effect === undefined) throw new Error("missing deck");
          expect(BlzGetLocalSpecialEffectX(effect)).toBe(s.origin.x + (surfaceLeft(stage, deck, frame) + surfaceRight(stage, deck, frame)) / 2);
          expect(BlzGetLocalSpecialEffectZ(effect)).toBe(s.origin.z + surfaceZ(stage, deck, frame));
        }
        trampoline("scene.report")();
        const report = sceneReport(client);
        expect(sceneProblems(report, SMASHCRAFT_SCENE)).toEqual([]);
        expect(report.models.find(({ model }) => model === reportedModel(STAGE_DECK_MODEL))).toMatchObject({ live: stage === DRIFTING_DECK_STAGE ? 1 : 2, drawn: stage === DRIFTING_DECK_STAGE ? 1 : 2 });
      }
    });
    expect(client.errors).toEqual([]);
  }
});

test("the two shipped defects fail the scene check from the match's first report", () => {
  const read = (lines: readonly string[]) => {
    const report = readSceneLines(lines);
    if ("problem" in report) throw new Error(report.problem);
    return report;
  };
  const deck = `model 1 1 1 0 0 0 0 ${reportedModel(STAGE_MAIN_DECK_MODEL)}`;
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
  expect(overlay(host)).toEqual(["frame cost, last 89 frames, median / p95 / max\nLua: no clock\nnatives: 0 / 0 / 0\ncatch-up frames: 1 / 1 / 1"]);
  expect(overlay(guest)).toEqual([]);
});

/** The match HUD's panels reach 0.139 up the 0.6-high screen (src/game/ui/matchHud.ts). */
const HUD_TOP_ROW = 1 - 0.139 / 0.6;
type Point = readonly [x: number, y: number, z: number];

/**
 * Where an arena point shows in the frame of the camera a client set, as
 * fractions of the frame's width and height from its top left. The ground is
 * level, so the camera's target is its z offset above the ground, FLOOR_HEIGHT
 * below the floor. The clients run 16:9 and Warcraft spreads the field of
 * view across the width, as wisp:scripts/wisp/visibility.ts frames a camera.
 */
function framePoint(camera: SetCamera, origin: { readonly x: number; readonly y: number }, [x, y, z]: Point) {
  const field = (name: string) => camera.fields.get(name) ?? Number.NaN;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const attack = field("CAMERA_FIELD_ANGLE_OF_ATTACK");
  const pitch = radians(attack > 180 ? attack - 360 : attack);
  const yaw = radians(field("CAMERA_FIELD_ROTATION"));
  const forward = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)] as const;
  const right = [Math.sin(yaw), -Math.cos(yaw), 0] as const;
  const up = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]] as const;
  const distance = field("CAMERA_FIELD_TARGET_DISTANCE");
  const target = [camera.x - origin.x, camera.y - origin.y, field("CAMERA_FIELD_ZOFFSET") - FLOOR_HEIGHT] as const;
  const relative = [0, 1, 2].map((axis) => [x, y, z][axis]! - (target[axis]! - distance * forward[axis]!));
  const along = (axis: readonly number[]) => relative.reduce((sum, value, index) => sum + value * axis[index]!, 0);
  const across = Math.tan(radians(field("CAMERA_FIELD_FIELD_OF_VIEW") / 2));
  return { column: 0.5 + along(right) / (2 * along(forward) * across), row: 0.5 - along(up) / (2 * along(forward) * (across * 9) / 16) };
}

test("a fighter within 100 of the main deck's underside shows above the HUD with the underside, wherever the others are", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  const camera = client === undefined ? undefined : cameras.get(client);
  if (client === undefined || camera === undefined) throw new Error("missing client");
  const near = 100;
  const underside = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index) => solidSurfaceAt(0, index))
    .find((line) => line.kind === SurfaceContact.ceiling && line.startZ === MAIN_DECK_UNDERSIDE_Z && line.endZ === MAIN_DECK_UNDERSIDE_Z);
  if (underside === undefined) throw new Error("the main deck has no level underside");
  // The underside's front edge where it is nearest the fighter.
  const undersideNear = ([x]: Point): Point => [Math.min(Math.max(x, underside.endX), underside.startX), -MAIN_DECK_HALF_DEPTH, MAIN_DECK_UNDERSIDE_Z];
  // Beside a wall, 12 outside it as a fighter stands against it; under the underside, down to the blast zone.
  const beside = (side: number, z: number): Point => {
    const wall = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index) => solidSurfaceAt(0, index))
      .find((line) => line.normalX * side > 0 && Math.min(line.startZ, line.endZ) <= z && Math.max(line.startZ, line.endZ) >= z);
    if (wall === undefined) throw new Error(`no wall at ${z}`);
    return [wall.startX + ((wall.endX - wall.startX) * (z - wall.startZ)) / (wall.endZ - wall.startZ) + 12 * side, 0, z];
  };
  const fighters: Point[] = [
    ...[underside.endX, 0, underside.startX].flatMap((x) => [MAIN_DECK_UNDERSIDE_Z - 1, BLAST_ZONE_BOTTOM + 1].map((z): Point => [x, 0, z])),
    ...[-1, 1].flatMap((side) => [MAIN_DECK_UNDERSIDE_Z + near / 2, MAIN_DECK_UNDERSIDE_Z + near].map((z) => beside(side, z))),
  ];
  // The other fighter: KO'd, on the main deck, on a raised deck, high, at the top blast zone, far to a side.
  const others: (Point | undefined)[] = [undefined, [300, 0, 0], [-265, 0, 170], [0, 0, 465], [0, 0, BLAST_ZONE_TOP - 1], [-(BLAST_ZONE_SIDE - 20), 0, 0]];
  const misses: string[] = [];
  let origin = { x: 0, y: 0 };
  client.run(() => {
    const s = shell();
    setParticipants(s.game, 1, 2);
    selectCharacter(s.game, 0, Character.archer);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    origin = s.origin;
    for (const fighter of fighters) for (const other of others) {
      const low = fighterAt(s.world, 0).motion;
      [low.x, low.z] = [fighter[0], fighter[2]];
      const high = fighterAt(s.world, 1);
      high.status.out = other === undefined;
      [high.motion.x, high.motion.z] = [other?.[0] ?? 0, other?.[2] ?? 0];
      lockArenaCamera(s);
      const seen = [undersideNear(fighter), fighter].map((point) => framePoint(camera, origin, point));
      const outside = seen.filter(({ column, row }) => column < 0 || column > 1 || row < 0 || row > HUD_TOP_ROW);
      const otherSeen = other === undefined ? undefined : framePoint(camera, origin, other);
      if (outside.length > 0 || (otherSeen !== undefined && (otherSeen.row < 0 || otherSeen.row > 1))) {
        misses.push(`fighter at (${fighter[0].toFixed(0)}, ${fighter[2].toFixed(0)}) with the other at ${other === undefined ? "none" : `(${other[0]}, ${other[2]})`}: underside and fighter at ${seen.map(({ column, row }) => `(${column.toFixed(2)}, ${row.toFixed(2)})`).join(" and ")}${otherSeen === undefined ? "" : `, other ${otherSeen.row.toFixed(2)}`}`);
      }
    }
    trampoline("scene.report")();
  });
  expect(misses).toEqual([]);
  expect(sceneProblems(sceneReport(client), SMASHCRAFT_SCENE)).toEqual([]);
});

test("the underside scenario holds a fighter under the main deck, shown above the HUD with the underside, through fresh's frame 30", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  const camera = client === undefined ? undefined : cameras.get(client);
  if (client === undefined || camera === undefined) throw new Error("missing client");
  let origin = { x: 0, y: 0 };
  client.run(() => {
    const s = shell();
    setParticipants(s.game, 1, 2);
    selectCharacter(s.game, 0, Character.archer);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    initializeScenario("underside", s.game, s.world);
    origin = s.origin;
  });
  clients.frames(30);
  client.run(() => {
    const { motion, status } = fighterAt(shell().world, 0);
    expect([motion.x, motion.z, status.frozenFrames > 0]).toEqual([520, MAIN_DECK_UNDERSIDE_Z, true]);
  });
  // The underside's right end, and the fighter's feet.
  const shown: Point[] = [[371, -MAIN_DECK_HALF_DEPTH, MAIN_DECK_UNDERSIDE_Z], [520, 0, MAIN_DECK_UNDERSIDE_Z]];
  for (const { column, row } of shown.map((point) => framePoint(camera, origin, point))) {
    expect(column).toBeGreaterThan(0);
    expect(column).toBeLessThan(1);
    expect(row).toBeGreaterThan(0);
    expect(row).toBeLessThan(HUD_TOP_ROW);
  }
});
