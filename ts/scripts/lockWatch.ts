// The soak's lock-loop detector (#68): it follows the confirmed match frame by
// frame and, while a fighter is under the other fighters' control (hit, held,
// knocked down or stunned) or free of it for less than a reaction, remembers
// each situation it was in. When one comes back, it replays that cycle with
// every input class (scripts/agency.ts) from the recorded rows, once two more
// seconds have played or the stretch ends, so an input whose effect comes
// later (mashing out of a hold) shows. A cycle in which the fighter could act
// on no frame, or only on TIGHT_ESCAPE frames in a row, is a loop it can't
// act out of, and is reported.
import { type InputRow, emptyInput } from "../src/game/input/inputRow";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { Phase } from "../src/game/match/rules";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../src/game/replay/snapshot";
import { Character } from "../src/game/sim/codes";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { ESCAPE_FRAMES, INPUT_CLASSES, type InputClass, TIGHT_ESCAPE, analyzeAgency, escapeFrames, runFrame, sameGameplay, situationKey, snapshotOf, underControl } from "./agency";

/** The longest stretch under control the detector follows: ten seconds. */
const LONGEST_STRETCH = 600;
/** Frames played after a cycle before it is replayed, unless the fighter is free sooner. */
const AFTER_CYCLE = 120;
/** A gap in the confirmed frames longer than this starts the record again. */
const LONGEST_GAP = 60;
const NAMES: Readonly<Record<number, string>> = { [Character.archer]: "Archer", [Character.rifleman]: "Rifleman", [Character.demonHunter]: "Illidan" };

/** A situation that came back, waiting to be replayed: the match at its first frame and when it came back. */
interface Cycle {
  readonly start: ReplayState;
  readonly end: ReplayState;
}

/** One fighter's current stretch under control, and any moment free of it shorter than ESCAPE_FRAMES: each frame's match, and the first frame of each situation. */
interface Stretch {
  readonly states: ReplayState[];
  readonly firstSeen: Map<string, number>;
  cycle: Cycle | undefined;
  /** A cycle of this stretch was found already: one replay a stretch bounds the soak's cost. */
  found: boolean;
  /** Frames in a row the fighter has been free of control. */
  free: number;
}

/** The rows a human slot ran a confirmed frame with, as the match recorded them. */
export type RecordedRows = (frame: number, slot: number) => Readonly<InputRow> | undefined;

const describe = (state: Readonly<ReplayState>, slot: number) => `p${slot} (${NAMES[fighterAt(state.world, slot).character] ?? "fighter"})`;

export class LockWatch {
  constructor(private readonly classes: readonly InputClass[] = INPUT_CLASSES) {}

  private readonly last = createReplaySnapshot();
  private readonly replay = createReplaySnapshot();
  private lastFrame: number | undefined;
  /** The latest frame observed: rows are recorded through it. */
  private seen = 0;
  private readonly stretches = new Map<number, Stretch>();
  private readonly pool: ReplayState[] = [];
  /** Cycles replayed with every input class, and followed frames or cycles the recorded rows did not reproduce. */
  cycles = 0;
  unreplayed = 0;

  /**
   * After the confirmed match reached `confirmed`: each frame since the last
   * call, run again from the match seen then with `rows` where more than one
   * passed. Returns what it found, once a stretch.
   */
  advance(confirmed: Readonly<ReplayState>, rows: RecordedRows): string[] {
    const frame = confirmed.runtime.simulationFrame;
    const found: string[] = [];
    let follows = this.lastFrame !== undefined && frame >= this.lastFrame && frame - this.lastFrame <= LONGEST_GAP;
    if (follows && this.lastFrame !== undefined) {
      copyReplayState(this.replay, this.last);
      for (let next = this.lastFrame + 1; next <= frame; next++) {
        runFrame(this.replay, (slot) => rows(next, slot) ?? emptyInput());
        // The shell may change the match between frames (a pause clears attack buffers): follow it from there.
        if (next === frame && !sameGameplay(this.replay, confirmed)) {
          this.unreplayed++;
          follows = false;
          break;
        }
        found.push(...this.observe(this.replay, rows));
      }
    }
    if (!follows || confirmed.match.phase !== Phase.match) {
      for (const slot of [...this.stretches.keys()]) found.push(...this.end(slot, rows));
    }
    copyReplayState(this.last, confirmed);
    this.lastFrame = confirmed.match.phase === Phase.match ? frame : undefined;
    return found;
  }

  /** Ends a fighter's stretch, replaying its waiting cycle with the frames played since. */
  private end(slot: number, rows: RecordedRows): string[] {
    const stretch = this.stretches.get(slot);
    if (stretch === undefined) return [];
    const found = this.replayCycle(stretch, slot, rows);
    this.pool.push(...stretch.states);
    this.stretches.delete(slot);
    return found;
  }

  private observe(state: Readonly<ReplayState>, rows: RecordedRows): string[] {
    const found: string[] = [];
    this.seen = state.runtime.simulationFrame;
    for (const victim of PARTICIPANT_SLOTS) {
      if (!isActive(state.world, victim)) continue;
      const fighter = fighterAt(state.world, victim);
      const held = underControl(fighter);
      const stretch = this.stretches.get(victim);
      // A stretch goes on through a moment free of control shorter than a reaction: a loop may leave such a window.
      if (fighter.status.out || state.match.phase !== Phase.match || (!held && (stretch === undefined || ++stretch.free > ESCAPE_FRAMES))) {
        found.push(...this.end(victim, rows));
        continue;
      }
      const current = stretch ?? { states: [], firstSeen: new Map<string, number>(), cycle: undefined, found: false, free: 0 };
      if (held) current.free = 0;
      this.stretches.set(victim, current);
      if (current.cycle !== undefined && state.runtime.simulationFrame - current.cycle.end.runtime.simulationFrame >= AFTER_CYCLE) {
        found.push(...this.replayCycle(current, victim, rows));
      }
      // Only a situation the fighter is under control in can close a loop that holds it: one it is free in is idling.
      if (!held || current.found || current.cycle !== undefined || current.states.length >= LONGEST_STRETCH) continue;
      const copy = this.pool.pop() ?? createReplaySnapshot();
      copyReplayState(copy, state);
      current.states.push(copy);
      const key = situationKey(state, victim);
      const earlier = current.firstSeen.get(key);
      const start = earlier === undefined ? undefined : current.states[earlier];
      if (start === undefined) current.firstSeen.set(key, current.states.length - 1);
      else current.cycle = { start: snapshotOf(start), end: snapshotOf(state) };
    }
    return found;
  }

  /** Replays a stretch's waiting cycle with every input class, through the last frame seen; text when the victim could not act out of it. */
  private replayCycle(stretch: Stretch, victim: number, rows: RecordedRows): string[] {
    const { cycle } = stretch;
    if (cycle === undefined) return [];
    stretch.cycle = undefined;
    stretch.found = true;
    const { start, end } = cycle;
    const from = start.runtime.simulationFrame;
    const to = end.runtime.simulationFrame;
    const horizon = Math.max(0, this.seen - to);
    const report = analyzeAgency({ start, victim, frames: to - from, horizon, row: (slot, frame) => rows(frame, slot) ?? emptyInput() }, this.classes);
    const replayed = report.states[to - from];
    const who = describe(start, victim);
    this.cycles++;
    // A cycle the shell changed between two of its frames (a pause clears attack buffers) is not the one the rows replay.
    if (replayed === undefined || !sameGameplay(replayed, end)) {
      this.unreplayed++;
      return [];
    }
    const escape = escapeFrames(report.frames);
    // A cycle free throughout is the fighter idling; one it could act on more often than a frame-tight input is escapable.
    if (escape > TIGHT_ESCAPE || escape === report.frames.length) return [];
    const di = report.frames.filter(({ agency }) => agency === "di").length;
    const percent = (state: Readonly<ReplayState>) => fighterAt(state.world, victim).status.damage.toFixed(0);
    const others = PARTICIPANT_SLOTS.filter((slot) => slot !== victim && isActive(start.world, slot)).map((slot) => describe(start, slot)).join(" and ");
    const influence = escape > 0 ? `it could act on only ${escape} of its frames`
      : di === 0 ? "no input changed anything" : `only the stick changed anything, on ${di} of them`;
    return [`${who} was caught by ${others} in a ${to - from}-frame loop, frames ${from} to ${to}, ${percent(start)}% to ${percent(end)}%: ${influence}`];
  }
}
