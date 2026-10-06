import { expect, test } from "bun:test";
import { emptyInput } from "../src/game/input/inputRow";
import type { ReplayState } from "../src/game/replay/snapshot";
import { Character } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { INPUT_CLASSES, agencyLetters, analyzeAgency, runFrame, snapshotOf } from "./agency";
import { attackerPlan, standingMatch } from "./agencySweep";
import { LockWatch } from "./lockWatch";

const ATTACKER = 0;
const VICTIM = 1;

/** The attacker's plan played until the victim is first grabbed: the match just after. */
function grabbed(start: ReplayState, attacker: (state: Readonly<ReplayState>, frame: number) => ReturnType<typeof emptyInput>): ReplayState {
  const state = snapshotOf(start);
  for (let index = 0; index < 30 && fighterAt(state.world, VICTIM).grab.owner === undefined; index++) {
    const frame = state.runtime.simulationFrame + 1;
    runFrame(state, (slot) => (slot === ATTACKER ? attacker(state, frame) : emptyInput()));
  }
  expect(fighterAt(state.world, VICTIM).grab.owner).toBe(ATTACKER);
  return state;
}

test("a standing fighter can act on every frame", () => {
  const start = standingMatch(Character.archer, Character.rifleman, 0, 200);
  const report = analyzeAgency({ start, victim: VICTIM, frames: 4, row: () => emptyInput() });
  expect(agencyLetters(report.frames)).toBe("AAAA");
  expect(report.frames[0]?.classes).toContain("jump");
});

test("a thrown fighter can't act until its throw has launched it; only the stick matters as the throw lets go", () => {
  const start = standingMatch(Character.archer, Character.rifleman, 0, 40);
  const attacker = attackerPlan("up throw", start.runtime.simulationFrame + 1);
  const held = grabbed(start, attacker);
  const report = analyzeAgency({ start: held, victim: VICTIM, frames: 60, horizon: 30, untilFree: 1, row: (slot, frame, state) => (slot === ATTACKER ? attacker(state, frame) : emptyInput()) });
  const letters = agencyLetters(report.frames);
  // The hold and the throw: nothing matters but DI on the frame the throw lets go, then the victim can act again.
  expect(letters).toMatch(/^\.+d\.+A$/);
  expect(report.frames.find(({ agency }) => agency === "di")?.classes).toContain("DI left");
});

test("mashing out of a hold the attacker keeps is acting", () => {
  const start = standingMatch(Character.archer, Character.rifleman, 0, 40);
  const grab = attackerPlan("forward throw", start.runtime.simulationFrame + 1);
  const held = grabbed(start, grab);
  // The attacker never throws: the hold runs down, sooner for every press.
  const report = analyzeAgency({ start: held, victim: VICTIM, frames: 1, horizon: 120, row: () => emptyInput() });
  expect(report.frames[0]?.agency).toBe("act");
  expect(report.frames[0]?.classes).toContain("attack (mash)");
});

test("the soak's detector flags a loop the victim can't act out of, and passes one it can", () => {
  // Archer regrabs Rifleman after each up throw at 0%: the victim may act on 7 frames of each cycle.
  const start = standingMatch(Character.archer, Character.rifleman, 0, 40);
  const attacker = attackerPlan("up throw", start.runtime.simulationFrame + 1, 80);
  const watch = (classes: typeof INPUT_CLASSES) => {
    const lockWatch = new LockWatch(classes);
    const state = snapshotOf(start);
    const rows = new Map<number, ReturnType<typeof emptyInput>>();
    const found: string[] = [];
    lockWatch.advance(state, () => undefined);
    // The cycle comes round within 60 frames and is replayed two seconds later.
    for (let index = 0; index < 200 && found.length === 0; index++) {
      const frame = state.runtime.simulationFrame + 1;
      rows.set(frame, attacker(state, frame));
      runFrame(state, (slot) => (slot === ATTACKER ? rows.get(frame) ?? emptyInput() : emptyInput()));
      found.push(...lockWatch.advance(state, (at, slot) => (slot === ATTACKER ? rows.get(at) : emptyInput())));
    }
    return { found, cycles: lockWatch.cycles };
  };
  // Without the buttons that act, nothing but the stick could change it.
  const stickOnly = watch(INPUT_CLASSES.filter(({ changes }) => changes === "stick"));
  expect(stickOnly.found.length).toBe(1);
  expect(stickOnly.found[0]).toMatch(/^p1 \(Rifleman\) was caught by p0 \(Archer\) in a \d+-frame loop.*only the stick changed anything/);
  const every = watch(INPUT_CLASSES);
  expect(every.cycles).toBe(1);
  expect(every.found).toEqual([]);
});
