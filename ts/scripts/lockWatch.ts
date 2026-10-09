








import { type InputRow, emptyInput } from "../src/game/input/inputRow";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { Phase } from "../src/game/match/rules";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../src/game/replay/snapshot";
import { fighterName } from "../src/game/sim/heroes/registry";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { ESCAPE_FRAMES, INPUT_CLASSES, type InputClass, TIGHT_ESCAPE, analyzeAgency, escapeFrames, runFrame, sameGameplay, situationKey, snapshotOf, underControl } from "./agency";


const LONGEST_STRETCH = 600;

const AFTER_CYCLE = 120;

const LONGEST_GAP = 60;


interface Cycle {
  readonly start: ReplayState;
  readonly end: ReplayState;
}


interface Stretch {
  readonly states: ReplayState[];
  readonly firstSeen: Map<string, number>;
  cycle: Cycle | undefined;

  found: boolean;

  free: number;
}


export type RecordedRows = (frame: number, slot: number) => Readonly<InputRow> | undefined;

const describe = (state: Readonly<ReplayState>, slot: number) => `p${slot} (${fighterName(fighterAt(state.world, slot).character)})`;

export class LockWatch {
  constructor(private readonly classes: readonly InputClass[] = INPUT_CLASSES) {}

  private readonly last = createReplaySnapshot();
  private readonly replay = createReplaySnapshot();
  private lastFrame: number | undefined;

  private seen = 0;
  private readonly stretches = new Map<number, Stretch>();
  private readonly pool: ReplayState[] = [];

  cycles = 0;
  unreplayed = 0;






  advance(confirmed: Readonly<ReplayState>, rows: RecordedRows): string[] {
    const frame = confirmed.runtime.simulationFrame;
    const found: string[] = [];
    let follows = this.lastFrame !== undefined && frame >= this.lastFrame && frame - this.lastFrame <= LONGEST_GAP;
    if (follows && this.lastFrame !== undefined) {
      copyReplayState(this.replay, this.last);
      for (let next = this.lastFrame + 1; next <= frame; next++) {
        runFrame(this.replay, (slot) => rows(next, slot) ?? emptyInput());

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

    if (replayed === undefined || !sameGameplay(replayed, end)) {
      this.unreplayed++;
      return [];
    }
    const escape = escapeFrames(report.frames);

    if (escape > TIGHT_ESCAPE || escape === report.frames.length) return [];
    const di = report.frames.filter(({ agency }) => agency === "di").length;
    const percent = (state: Readonly<ReplayState>) => fighterAt(state.world, victim).status.damage.toFixed(0);
    const others = PARTICIPANT_SLOTS.filter((slot) => slot !== victim && isActive(start.world, slot)).map((slot) => describe(start, slot)).join(" and ");
    const influence = escape > 0 ? `it could act on only ${escape} of its frames`
      : di === 0 ? "no input changed anything" : `only the stick changed anything, on ${di} of them`;
    return [`${who} was caught by ${others} in a ${to - from}-frame loop, frames ${from} to ${to}, ${percent(start)}% to ${percent(end)}%: ${influence}`];
  }
}
