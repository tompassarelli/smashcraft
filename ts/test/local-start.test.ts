// #60's claim headless, in the 0.0.49 native bot session's four-fighter
// match (R2): two helpers' pads playing the session's beats against computer
// Illidan and Archer, client B's game stopped for 2 s three times, Battle.net
// latency as that session measured it and the helpers' typing cost. Every
// legal press must start in its presser's first prediction, at most a callback
// after the map captured it. Presses captured while a remote row R frames
// behind held prediction back, and those B's helper journaled while B's game
// was stopped, are left out, as #60 leaves them out, and so are presses whose
// prediction entered their frame in a world a remote row it had not yet
// received had already changed (a remote hit it could not foresee).
import { afterAll, expect, test } from "bun:test";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import { type SyncLatency, syncDelivery } from "wisp/src/headless/syncChannel";
import type { HeadlessClient, SyncMessage } from "wisp/src/headless/client";
import { type InputRow, type RowFields, inputRow, sameInput } from "../src/game/input/inputRow";
import type { ParticipantInputs } from "../src/game/input/participants";
import { Phase } from "../src/game/match/rules";
import { observedFrameLegalActions, observedFrameStartedActions } from "../src/game/match/step";
import { ShadowInputSchedule } from "../src/game/netcode/shadowSchedule";
import { Character } from "../src/game/sim/codes";
import type { Roster } from "../src/game/sim/roster";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { sweep } from "./sweep";

/** The session's beats: an action's bits, frames held (0 for a 5 ms tap), what its press also carries; 24 frames apart. */
const BEATS: readonly (readonly [mask: number, held: number, press: RowFields])[] = [
  [32, 0, {}],
  [2048, 6, { throwX: 1 }],
  [16, 0, {}],
  [4096, 6, { throwZ: 1 }],
  [64, 0, {}],
  [256, 12, { triggerLeft: 255 }],
  [1024, 6, { throwX: -1 }],
  [2, 18, { axisX: 127, sdi: true, sdiX: 1, throwX: 1 }],
  [8192, 6, { throwZ: -1 }],
  [1, 18, { axisX: -127, sdi: true, sdiX: -1, throwX: -1 }],
];
const BEAT_GAP = 24;
/**
 * The gate's sample: steady-play legal presses. The match plays the beats until
 * the stalls are over and this many have been confirmed, so a kit change that
 * makes fewer beats legal lengthens the match instead of failing the floor.
 */
const GATED_PRESSES = 15;
/** A ceiling of two minutes of beats; the sample, not this, ends the match. */
const MATCH_FRAMES = 7200;

function beatRows(frames: number): InputRow[] {
  const row = (fields: RowFields = {}) => {
    const made = inputRow(fields);
    if (made === undefined) throw new Error("no row");
    return made;
  };
  const rows = Array.from({ length: frames + 1 }, () => row());
  let frame = BEAT_GAP;
  for (let beat = 0; frame <= frames; beat++) {
    const [mask, held, press] = BEATS[beat % BEATS.length] ?? [0, 0, {}];
    if (held === 0) {
      rows[frame] = row({ pressed: mask, released: mask });
      frame += BEAT_GAP;
      continue;
    }
    rows[frame] = row({ held: mask, pressed: mask, ...press });
    const hold = { held: mask, axisX: press.axisX ?? 0, triggerLeft: press.triggerLeft ?? 0 };
    for (let i = 1; i < held && frame + i <= frames; i++) rows[frame + i] = row(hold);
    if (frame + held <= frames) rows[frame + held] = row({ released: mask });
    frame += held + BEAT_GAP;
  }
  return rows;
}
const BEAT_ROWS = beatRows(MATCH_FRAMES + 600);

/**
 * Arrival 11 / 23 / 30 / 39 frames (p50 / p95 / p99 / max) after a send
 * every 6 frames. R2's own echoes came back in 118-120 / 294-409 / - /
 * 586-2785 ms.
 */
const extraTurns = Array.from({ length: 24 }, (_, turns) => 0.75 ** turns);
const BOT_SESSION_LATENCY: SyncLatency = { latencyMs: 80, turnMs: 25, extraTurns: extraTurns.map((weight) => weight / extraTurns.reduce((sum, each) => sum + each, 0)) };
/** 180 ms (10.8 frames) for 608 characters taken at once (smashcraft:test/lag-recovery.test.ts). */
const TYPING_FRAMES_PER_CHARACTER_SQUARED = 0.00003;
const CATCH_UP_CALLBACKS = 10;
/** B's messages take 100 ms longer, as R2's did: B's own echo p95 409 ms, A's 294 ms. */
const B_SLOWER = 6;
const STALL_FRAMES = 120;
/** R2's stops of B, 6, 14 and 22 s into the match, by B's helper's clock. */
const STALLS = [360, 840, 1320];

const declarations = readNativeDeclarations();
const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this test compares confirmed state"]));
const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
helpers.rows = (_slot, frame) => BEAT_ROWS[frame] ?? BEAT_ROWS[0] as InputRow;
let now = 0;
helpers.clock = () => now;
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged }, declarations);
afterAll(headless.restore);

const callbacks = [0, 0];
const local = () => GetPlayerId(GetLocalPlayer());
interface Press {
  readonly slot: number;
  readonly frame: number;
  readonly pressed: number;
  readonly capture: number;
  /** Prediction was held back by a remote row R frames behind it, or hadn't yet run every local row since. */
  readonly held: boolean;
  /**
   * The prediction entered the press's frame in a different world than the confirmed
   * run did: a remote row it had not yet received had already changed the match.
   */
  remote?: boolean;
  /** The predicted world entering the press's frame. */
  entering?: string;
  predicted?: number;
  started?: number;
  legal?: number;
}
const presses = new Map<string, Press>();
/** Each client's world after a frame, as its latest prediction and its confirmed run left it. */
const predictedWorlds = new Map<string, string>();
const confirmedWorlds = new Map<string, string>();
/** The fighters' state a press's start depends on; a coarse digest only ever reports fewer worlds apart. */
function worldDigest(world: Readonly<Roster> | undefined): string {
  return (world?.fighters ?? []).map((f) => f === undefined ? "-" : [
    f.motion.x, f.motion.z, f.motion.vx, f.motion.vz, f.status.damage, f.attack.style ?? -1, f.attack.frame, f.attack.cooldown,
    f.launch.hitstun, f.launch.hitlag, f.landing.lag, f.shield.raised, f.shield.stun, f.jump.squat, f.down.state, f.special.action, f.special.frame,
  ].join(",")).join("/");
}
const wrongRows: string[] = [];
const captureLocalAt = ShadowInputSchedule.prototype.captureLocalAt;
const completeSpeculative = ShadowInputSchedule.prototype.completeSpeculative;
const completeConfirmed = ShadowInputSchedule.prototype.completeConfirmed;
const readConfirmed = ShadowInputSchedule.prototype.readConfirmed;
ShadowInputSchedule.prototype.captureLocalAt = function (this: ShadowInputSchedule, epoch: number, frame: number, sample: Readonly<InputRow>) {
  const slot = local();
  if (sample.pressed !== 0 && !presses.has(`${slot} ${frame}`)) {
    presses.set(`${slot} ${frame}`, { slot, frame, pressed: sample.pressed, capture: callbacks[slot] ?? 0, held: shell().rollback?.predictionHeld === true });
  }
  return captureLocalAt.call(this, epoch, frame, sample);
};
ShadowInputSchedule.prototype.completeSpeculative = function (this: ShadowInputSchedule, epoch: number, frame: number) {
  const slot = local();
  const press = presses.get(`${slot} ${frame}`);
  if (press !== undefined && press.predicted === undefined) {
    press.predicted = callbacks[slot] ?? 0;
    press.started = press.pressed & (observedFrameStartedActions[slot as 0] ?? 0);
    press.entering = predictedWorlds.get(`${slot} ${frame - 1}`);
  }
  predictedWorlds.set(`${slot} ${frame}`, worldDigest(shell().rollback?.speculative.world));
  return completeSpeculative.call(this, epoch, frame);
};
ShadowInputSchedule.prototype.completeConfirmed = function (this: ShadowInputSchedule, epoch: number, frame: number) {
  const slot = local();
  const press = presses.get(`${slot} ${frame}`);
  if (press !== undefined) {
    press.legal = press.pressed & (observedFrameLegalActions[slot as 0] ?? 0);
    press.remote = press.entering !== undefined && press.entering !== confirmedWorlds.get(`${slot} ${frame - 1}`);
  }
  confirmedWorlds.set(`${slot} ${frame}`, worldDigest(shell().world));
  return completeConfirmed.call(this, epoch, frame);
};
ShadowInputSchedule.prototype.readConfirmed = function (this: ShadowInputSchedule, epoch: number, inputs: ParticipantInputs) {
  const frame = this.nextConfirmedFrame();
  const read = readConfirmed.call(this, epoch, inputs);
  for (const slot of read ? [0, 1] : []) {
    const row: Readonly<InputRow> | undefined = inputs[slot];
    if (row === undefined || !sameInput(row, BEAT_ROWS[frame] as InputRow)) wrongRows.push(`client ${local()} slot ${slot} frame ${frame}`);
  }
  return read;
};
afterAll(() => {
  ShadowInputSchedule.prototype.captureLocalAt = captureLocalAt;
  ShadowInputSchedule.prototype.completeSpeculative = completeSpeculative;
  ShadowInputSchedule.prototype.completeConfirmed = completeConfirmed;
  ShadowInputSchedule.prototype.readConfirmed = readConfirmed;
});

/** The parts of the lockstep this test drives itself, so one game can stop while the other runs. */
interface LockstepFrames {
  frame: number;
  readonly inFlight: { readonly arrival: number; readonly message: SyncMessage }[];
  flush(): void;
}

// About 1.5 s alone; at load 23-29 a host took headless match tests past Bun's 5 s default.
sweep("#60: every local press starts in the presser's next prediction unless a remote holds prediction back", () => {
  const network = syncDelivery(BOT_SESSION_LATENCY, 11);
  let slower = 0;
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: { arrivalFrame: (sender, frame, message) => network.arrivalFrame(sender, frame, message) + (sender === 1 ? slower : 0) } });
  const lockstep = clients as unknown as LockstepFrames;
  const host = clients.clients[0] as HeadlessClient;
  const read = <T>(client: HeadlessClient, body: () => T): T => {
    let value: T | undefined;
    client.run(() => {
      value = body();
    });
    return value as T;
  };
  const phase = () => read(host, () => shell().game.phase);
  /** Games stopped as SIGSTOP stops them: they run nothing, and while one is stopped no turn completes, so no message arrives. */
  const stopped = new Set<number>();
  const owed = [0, 0];
  const typing = [0, 0];
  const tick = () => {
    now++;
    lockstep.frame++;
    if (stopped.size === 0) {
      while ((lockstep.inFlight[0]?.arrival ?? Infinity) <= lockstep.frame) {
        const due = lockstep.inFlight.shift();
        if (due !== undefined) for (const client of clients.clients) client.deliverSync(due.message);
      }
    }
    const runs = clients.clients.map((_, index) => {
      if (stopped.has(index) || (typing[index] ?? 0) >= 1) {
        if (!stopped.has(index)) typing[index] = (typing[index] ?? 0) - 1;
        owed[index] = (owed[index] ?? 0) + 1;
        return 0;
      }
      const run = 1 + Math.min(owed[index] ?? 0, CATCH_UP_CALLBACKS);
      owed[index] = (owed[index] ?? 0) - (run - 1);
      return run;
    });
    for (let round = 0; round < Math.max(...runs); round++) {
      clients.clients.forEach((client, index) => {
        if (round >= (runs[index] ?? 0)) return;
        callbacks[index] = (callbacks[index] ?? 0) + 1;
        client.step();
      });
    }
    lockstep.flush();
    helpers.typed.clear();
    helpers.service(clients);
    for (const [slot, characters] of helpers.typed) typing[slot] = (typing[slot] ?? 0) + characters * characters * TYPING_FRAMES_PER_CHARACTER_SQUARED;
  };
  const until = (what: string, done: () => boolean, limit: number) => {
    for (let frame = 0; frame < limit && !done(); frame++) tick();
    if (!done()) throw new Error(`${what} not reached; phase ${phase()}`);
  };

  clients.start();
  for (let frame = 0; frame < 30; frame++) tick();
  for (const [slot, character] of [[2, Character.demonHunter], [3, Character.archer]] as const) {
    for (let click = 0; click < 2; click++) clients.everywhere(() => panelActions().selection.cycleMode(0, slot));
    clients.everywhere(() => panelActions().selection.selectCpuChoice(0, slot, character));
  }
  for (const slot of [0, 1]) clients.press(slot, Key.n);
  for (let frame = 0; frame < 60; frame++) tick();
  clients.press(0, Key.y);
  until("stage menu", () => phase() === Phase.stageMenu, 120);
  clients.press(0, Key.y);
  until("match", () => phase() === Phase.match, 120);
  until("journaling", () => (helpers.journaled(0) ?? 0) > 0 && (helpers.journaled(1) ?? 0) > 0, 60);
  slower = B_SLOWER;
  expect(read(host, () => [shell().game.humanFighterMask, shell().game.computerMask, [...shell().game.characterChoices]])).toEqual([3, 12, [0, 1, 2, 0]]);

  /** Frames B's helper journaled while B's game was stopped. */
  const ownStalls: [number, number][] = [];
  for (const stall of STALLS) {
    until("stall", () => (helpers.journaled(1) ?? 0) >= stall, MATCH_FRAMES);
    const from = helpers.journaled(1) ?? 0;
    stopped.add(1);
    helpers.silent.add(1);
    for (let frame = 0; frame < STALL_FRAMES; frame++) tick();
    stopped.clear();
    helpers.silent.clear();
    ownStalls.push([from, helpers.journaled(1) ?? 0]);
  }
  const own = (press: Press) => press.slot === 1 && ownStalls.some(([from, to]) => press.frame > from && press.frame <= to);
  const steadyLegal = () => [...presses.values()].filter((press) => (press.legal ?? 0) !== 0 && !own(press) && !press.held && press.remote !== true).length;
  until(`${GATED_PRESSES} steady-play legal presses`, () => steadyLegal() >= GATED_PRESSES, MATCH_FRAMES);
  until("every press confirmed", () => [...presses.values()].every((press) => press.legal !== undefined), 120);

  const legal = [...presses.values()].filter((press) => (press.legal ?? 0) !== 0);
  const rows = legal.map((press) => ({ ...press, own: own(press), late: (press.predicted ?? Infinity) - press.capture, mispredicted: ((press.started ?? 0) & (press.legal ?? 0)) !== press.legal }));
  // A press whose prediction entered its frame in a world a late remote row had already changed is reported apart too:
  // its start answers to that row, not to the local press's latency.
  const gated = rows.filter((press) => !press.own && !press.held && press.remote !== true);
  expect(gated.length).toBeGreaterThanOrEqual(GATED_PRESSES);
  expect(gated.filter((press) => press.late > 1 || press.mispredicted)).toEqual([]);
  // A's presses while B's game was stopped wait for B's rows, and are reported apart.
  expect(rows.filter((press) => press.held && press.slot === 0).length).toBeGreaterThan(0);

  until("one confirmed frame on both clients", () => new Set(clients.clients.map((client) => read(client, () => shell().runtime.simulationFrame))).size === 1, 60);
  const checksums = clients.clients.map((client) => read(client, () => confirmedChecksum(shell())));
  expect(checksums[0]).toBe(checksums[1] as string);
  expect(wrongRows).toEqual([]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 30_000);
