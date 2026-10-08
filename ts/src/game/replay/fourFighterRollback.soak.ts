// The 0.0.49 bot session's four fighters (two pads, computer Illidan and
// Archer) with every row 4-22 frames late, outside the default suite. Run on
// demand, in Bun and in Lua32: GAME_SOAK=1 bun test test/game.test.ts, or
// GAME_SOAK=1 with scripts/lua-tests.ts. Predictions replay from snapshots,
// so any state a snapshot misses in Lua only shows here as the speculative
// history leaving the confirmed world, as a Special's hit targets did (#60).
import { floorMod } from "wisp/src/sim/intMath";
import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { type InputRow, type RowFields, inputRow } from "../input/inputRow";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { inputPacket } from "../input/wire";
import { createFrameControls } from "../match/controls";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { Phase, copyMatchState, createMatchState, fighterActive, fighterMask, setParticipants } from "../match/rules";
import { initializeMatchFighters, matchSpawnX } from "../match/step";
import { ShadowInputSchedule } from "../netcode/shadowSchedule";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { firstStateDifference } from "./difference";
import { ReplayHistory } from "./history";
import { ShadowInputPlayback } from "./shadowPlayback";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";

const SLOT_CHARACTERS = [Character.archer, Character.rifleman, Character.demonHunter, Character.archer] as const;
const row = (fields: RowFields = {}): InputRow => assertDefined(inputRow(fields), "row");

/** The bot session's beats, both pads together: [action bits, frames held (0 for a tap), what the press carries]; 24 frames apart. */
const BEATS: readonly [number, number, RowFields][] = [
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

function beatRows(frames: number): InputRow[] {
  const rows: InputRow[] = [row()];
  let frame = 1;
  while (rows.length <= frames) rows.push(row());
  for (let beat = 0; frame <= frames; beat++) {
    const [mask, held, extra] = BEATS[floorMod(beat, BEATS.length)] ?? [0, 0, {}];
    const axes = { axisX: extra.axisX ?? 0, triggerLeft: extra.triggerLeft ?? 0 };
    if (held === 0) {
      rows[frame] = row({ pressed: mask, released: mask });
      frame += 24;
      continue;
    }
    rows[frame] = row({ held: mask, pressed: mask, ...extra });
    for (let i = 1; i < held && frame + i <= frames; i++) rows[frame + i] = row({ held: mask, ...axes });
    if (frame + held <= frames) rows[frame + held] = row({ released: mask });
    frame += held + 24;
  }
  return rows;
}

function lobby(game: ReturnType<typeof createMatchState>): ReplayState {
  const world = createRoster(fighterMask(game));
  for (const slot of PARTICIPANT_SLOTS) {
    if (fighterActive(game, slot)) world.fighters[slot] = createFighter(SLOT_CHARACTERS[slot], matchSpawnX(slot), slot === 0 || slot === 2 ? 1 : -1);
  }
  initializeMatchFighters(game, world);
  return { world, match: game, controls: createFrameControls(), runtime: createPacingAndPresentation() };
}

test("four fighters: speculative history matches the confirmed world through late rows [invariant]", () => {
  const frames = 1200;
  const epoch = 5;
  const game = createMatchState();
  setParticipants(game, 3, 12);
  game.phase = Phase.match;
  game.timeLimitMinutes = 0;
  game.stockCount = 99;
  const confirmedGame = createMatchState();
  copyMatchState(confirmedGame, game);
  const live = lobby(game);
  const confirmed = lobby(confirmedGame);
  const schedule = new ShadowInputSchedule();
  const playback = new ShadowInputPlayback();
  const history = new ReplayHistory();
  const confirmedHistory = new ReplayHistory();
  assertTrue(schedule.beginEpoch(epoch, 0, 24, 3));
  assertTrue(playback.beginEpoch(epoch));
  assertTrue(history.beginEpoch(epoch, 1, 24));
  assertTrue(confirmedHistory.beginEpoch(epoch, 1));
  const beats = beatRows(frames);
  const rows = [beats, beats];
  // Pseudo-random arrival 4-22 frames late, in order per sender.
  let seed = 12345;
  const next = () => {
    seed = floorMod(seed * 1103 + 12345, 65536);
    return seed;
  };
  const delivered = [0, 0];
  const arrival: number[][] = [[], []];
  for (const slot of [0, 1]) {
    let last = 0;
    for (let frame = 1; frame <= frames; frame++) {
      last = Math.max(last, frame + 4 + floorMod(next(), 19));
      arrival[slot]?.push(last);
    }
  }
  const scratch = createReplaySnapshot();
  const now = createReplaySnapshot();
  let compared = 0;
  let first: string | undefined;
  for (let t = 1; t <= frames + 40; t++) {
    if (t <= frames) schedule.captureLocalAt(epoch, t, assertDefined(rows[0]?.[t], "local row"));
    for (const slot of [0, 1]) {
      while ((delivered[slot] ?? 0) < frames && (arrival[slot]?.[delivered[slot] ?? 0] ?? Infinity) <= t) {
        const frame = (delivered[slot] ?? 0) + 1;
        assertEquals(schedule.acceptSynchronized(slot, assertDefined(inputPacket(epoch, frame, [assertDefined(rows[slot]?.[frame], "row")]), "packet")), "accepted");
        delivered[slot] = frame;
      }
    }
    for (let steps = 0; steps < 6 && schedule.mayAdvanceConfirmed(); steps++) assertTrue(playback.advanceConfirmed(schedule, epoch, confirmed, confirmedHistory));
    assertTrue(playback.reconcile(schedule, epoch, 0, live, history) !== "rejected");
    assertTrue(playback.catchUpSpeculative(schedule, epoch, 0, live, history, 6));
    const c = confirmed.runtime.simulationFrame;
    if (first === undefined && history.contains(epoch, c + 1) && history.firstCorrectableFrame() > c) {
      // Restoring changes live state; keep it and put it back.
      copyReplayState(now, live);
      assertTrue(history.restore(epoch, c + 1, live));
      copyReplayState(scratch, live);
      copyReplayState(live, now);
      copyReplayState(now, confirmed);
      compared++;
      const difference = firstStateDifference(now, scratch);
      if (difference !== undefined) first = `frame ${c}: ${difference}`;
    }
  }
  assertTrue(compared > 100);
  assertEquals(first, undefined);
});
