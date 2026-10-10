
















import { afterAll, expect } from "bun:test";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import { WARCRAFT_COST } from "wisp/src/headless/nativeCost";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import type { HeadlessClient } from "wisp/src/headless/client";
import { type InputRow, emptyInput, sameInput } from "../src/game/input/inputRow";
import type { ParticipantInputs } from "../src/game/input/participants";
import { Phase } from "../src/game/match/rules";
import { ShadowInputSchedule } from "../src/game/netcode/shadowSchedule";
import { Character } from "../src/game/sim/codes";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { CATCH_UP_FRAMES } from "../src/game/shell/playback";
import { install, startBuild } from "../src/platform/main";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers, rowFor } from "./rematch/journalHelper";
import { sweep } from "./sweep";

const declarations = readNativeDeclarations();

const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this test compares confirmed state"]));

const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
helpers.workload = { denseCycles: 40, walkers: [] };

let now = 0;
helpers.clock = () => now;
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged }, declarations);
afterAll(headless.restore);


const applied = { rows: 0, wrong: [] as string[] };
const readConfirmed = ShadowInputSchedule.prototype.readConfirmed;




let callbackIndex = 0;
const capturedAt = new Map<string, readonly [callback: number, halted: boolean]>();

const localStarts: { readonly client: number; readonly frame: number; readonly callbacks: number; readonly halted: boolean }[] = [];
const captureLocalAt = ShadowInputSchedule.prototype.captureLocalAt;
const completeSpeculative = ShadowInputSchedule.prototype.completeSpeculative;
ShadowInputSchedule.prototype.captureLocalAt = function (this: ShadowInputSchedule, epoch: number, frame: number, sample: Readonly<InputRow>) {
  const captured = captureLocalAt.call(this, epoch, frame, sample);

  if (sample.pressed !== 0) capturedAt.set(`${GetPlayerId(GetLocalPlayer())} ${frame}`, [callbackIndex, frame - this.rollbackFrames() > this.knownThrough()]);
  return captured;
};
ShadowInputSchedule.prototype.completeSpeculative = function (this: ShadowInputSchedule, epoch: number, frame: number) {
  const completed = completeSpeculative.call(this, epoch, frame);
  const key = `${GetPlayerId(GetLocalPlayer())} ${frame}`;
  const captured = capturedAt.get(key);
  if (completed && captured !== undefined) {
    localStarts.push({ client: GetPlayerId(GetLocalPlayer()), frame, callbacks: callbackIndex - captured[0], halted: captured[1] });
    capturedAt.delete(key);
  }
  return completed;
};
afterAll(() => {
  ShadowInputSchedule.prototype.captureLocalAt = captureLocalAt;
  ShadowInputSchedule.prototype.completeSpeculative = completeSpeculative;
  ShadowInputSchedule.prototype.readConfirmed = readConfirmed;
});
ShadowInputSchedule.prototype.readConfirmed = function (this: ShadowInputSchedule, epoch: number, inputs: ParticipantInputs) {
  const frame = this.nextConfirmedFrame();
  const read = readConfirmed.call(this, epoch, inputs);
  if (read) {
    for (const slot of [0, 1]) {
      applied.rows++;
      const row: Readonly<InputRow> | undefined = inputs[slot];
      const delay = shell().rollback?.delay ?? 0;
      const expected = frame <= delay ? emptyInput() : rowFor(slot, frame, helpers.workload);
      if (row === undefined || !sameInput(row, expected)) applied.wrong.push(`client ${GetPlayerId(GetLocalPlayer())} slot ${slot} frame ${frame}`);
    }
  }
  return read;
};

const STALL_FRAMES = 120;

const SHORT_STALL_FRAMES = 15;
const SECOND = 60;
// Edit-box stall: 185 ms for 608 characters (wisp:src/headless/nativeCost.ts).
const TYPING_FRAMES_PER_CHARACTER_SQUARED = WARCRAFT_COST.typingUsPerCharacterSquared / (1000000 / 60);

const CATCH_UP_CALLBACKS = 10;


sweep("after a 2 s stall of one or both games, each client catches up within a second, a bounded number of frames a callback [k1 scenario]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 7) });
  const host = clients.clients[0] as HeadlessClient;
  const read = <T>(client: HeadlessClient, body: () => T): T => {
    let value: T | undefined;
    client.run(() => {
      value = body();
    });
    return value as T;
  };
  const phase = () => read(host, () => shell().game.phase);

  const most = { admitted: 0, confirmed: 0, predicted: 0 };
  let measuring = false;
  const callback = () => {
    const before = measuring ? clients.clients.map(cursors) : [];
    callbackIndex++;
    clients.frames(1);
    if (!measuring) return;
    clients.clients.forEach((client, index) => {
      const was = before[index] as Cursors;
      const cursor = cursors(client);
      most.admitted = Math.max(most.admitted, cursor.admitted - was.admitted);
      most.confirmed = Math.max(most.confirmed, cursor.confirmed - was.confirmed);
      most.predicted = Math.max(most.predicted, cursor.predicted - was.predicted);
    });
  };

  const stalledFrames: { readonly client: number; readonly after: number; readonly through: number }[] = [];

  let typing = 0;

  let owed = 0;

  const tick = (stalled = false) => {
    now++;
    if (stalled || typing >= 1) {
      if (!stalled) typing--;
      owed++;
    } else {
      const run = 1 + Math.min(owed, CATCH_UP_CALLBACKS);
      owed -= run - 1;
      for (let index = 0; index < run; index++) callback();
    }
    helpers.service(clients);
    for (const characters of helpers.typed.values()) typing += characters * characters * TYPING_FRAMES_PER_CHARACTER_SQUARED;
  };
  const until = (what: string, done: () => boolean, limit: number) => {
    for (let frame = 0; frame < limit && !done(); frame++) tick();
    if (!done()) throw new Error(`${what} not reached; phase ${phase()}`);
  };

  const cursors = (client: HeadlessClient) => read(client, () => {
    const s = shell();
    const rollback = s.rollback;
    if (rollback === undefined) throw new Error("no rollback");
    const journaled = helpers.journaled(client.slot) ?? 0;
    const admitted = (rollback.journal?.source?.expectedFrame() ?? 1) - 1;
    const predicted = rollback.schedule.speculativeFrame() - 1;
    const confirmed = s.runtime.simulationFrame;
    return { admitted, predicted, confirmed, predictedLag: journaled - predicted, confirmedLag: journaled - confirmed };
  });
  type Cursors = ReturnType<typeof cursors>;
  const play = (frames: number): Cursors[][] => {
    const samples: Cursors[][] = [];
    for (let frame = 0; frame < frames; frame++) {
      tick();
      samples.push(clients.clients.map(cursors));
    }
    return samples;
  };

  const stall = (held: ReadonlySet<number>, frames = STALL_FRAMES) => {
    const steady = play(SECOND);
    const usual = (lag: (cursor: Cursors) => number) => Math.max(...steady.flatMap((frame) => frame.map(lag)));
    const predictedLag = usual((cursor) => cursor.predictedLag);
    const confirmedLag = usual((cursor) => cursor.confirmedLag);

    const from = new Map(clients.clients.map(({ slot }) => [slot, helpers.journaled(slot) ?? 0]));
    for (const slot of held) helpers.silent.add(slot);
    for (let frame = 0; frame < frames; frame++) tick(true);
    helpers.silent.clear();
    for (const [slot, first] of from) stalledFrames.push({ client: slot, after: first, through: helpers.journaled(slot) ?? 0 });
    const behind = Math.min(...clients.clients.map((client) => cursors(client).predictedLag));
    const recovery = play(2 * SECOND);
    const caughtUp = recovery.findIndex((frame) => frame.every((cursor) => cursor.predictedLag <= predictedLag && cursor.confirmedLag <= confirmedLag));
    return { behind, caughtUp: caughtUp < 0 ? undefined : caughtUp + 1, predictedLag };
  };

  clients.start();
  for (let frame = 0; frame < 30; frame++) tick();

  for (let click = 0; click < 2; click++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
  clients.everywhere(() => panelActions().selection.selectCpuChoice(0, 2, Character.rifleman));
  for (const slot of [0, 1]) clients.press(slot, Key.n);
  for (let frame = 0; frame < 5; frame++) tick();
  clients.press(0, Key.y);
  until("stage menu", () => phase() === Phase.stageMenu, 30);
  clients.press(0, Key.y);
  until("match", () => phase() === Phase.match, 120);
  until("journaling", () => (helpers.journaled(0) ?? 0) > 0 && (helpers.journaled(1) ?? 0) > 0, 60);
  expect(read(host, () => [shell().game.humanFighterMask, shell().game.computerMask, shell().game.characterChoices[2]])).toEqual([3, 4, Character.rifleman]);
  measuring = true;

  localStarts.length = 0;
  const both = stall(new Set([0, 1]));
  const one = stall(new Set([1]));
  const afterLongStalls = localStarts.length;
  const short = stall(new Set([0, 1]), SHORT_STALL_FRAMES);
  expect(short.caughtUp ?? Infinity).toBeLessThanOrEqual(SECOND);

  expect(localStarts.length - afterLongStalls).toBeGreaterThan(50);
  expect(localStarts.slice(afterLongStalls).filter(({ callbacks }) => callbacks > 1)).toEqual([]);



  const stopped = (start: (typeof localStarts)[number]) => stalledFrames.some(({ client, after, through }) => client === start.client && start.frame > after && start.frame <= through);
  const running = localStarts.filter((start) => !stopped(start) && !start.halted);
  expect(running.length).toBeGreaterThan(300);
  expect(running.filter(({ callbacks }) => callbacks > 1)).toEqual([]);
  for (const recovered of [both, one]) {

    expect(recovered.predictedLag).toBeLessThanOrEqual(2);
    expect(recovered.behind).toBeGreaterThanOrEqual(STALL_FRAMES);
    expect(recovered.caughtUp ?? Infinity).toBeLessThanOrEqual(SECOND);
  }

  expect(most).toEqual({ admitted: CATCH_UP_FRAMES, confirmed: CATCH_UP_FRAMES, predicted: CATCH_UP_FRAMES });

  until("one confirmed frame on both clients", () => new Set(clients.clients.map((client) => cursors(client).confirmed)).size === 1, 30);
  const checksums = clients.clients.map((client) => read(client, () => confirmedChecksum(shell())));
  expect(checksums[0]).toBe(checksums[1] as string);
  expect(phase()).toBe(Phase.match);

  expect(applied.wrong).toEqual([]);
  expect(applied.rows).toBe(4 * cursors(host).confirmed);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 30_000);
