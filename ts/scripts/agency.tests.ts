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

test("a hit's hitlag leaves the victim only the stick, its hitstun nothing, and then it can act", () => {
  const start = standingMatch(Character.demonHunter, Character.rifleman, 0, 40);
  const jab = attackerPlan("jab", start.runtime.simulationFrame + 1);
  const state = snapshotOf(start);
  for (let index = 0; index < 20 && fighterAt(state.world, VICTIM).visuals.hit === 0; index++) {
    const frame = state.runtime.simulationFrame + 1;
    runFrame(state, (slot) => (slot === ATTACKER ? jab(state, frame) : emptyInput()));
  }
  const report = analyzeAgency({ start: state, victim: VICTIM, frames: 30, horizon: 30, untilFree: 1, row: (slot, frame, at) => (slot === ATTACKER ? jab(at, frame) : emptyInput()) });
  expect(agencyLetters(report.frames)).toMatch(/^d+\.+A$/);
  // SDI moves it during hitlag; on hitlag's last frame DI turns its launch too.
  expect(report.frames[0]?.classes).toContain("SDI up");
  expect(report.frames.filter(({ agency }) => agency === "di").at(-1)?.classes).toContain("DI up");
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

// About 1.2 s alone; a loaded host takes a test several times that, past Bun's 5 s default.
test("the soak's detector flags a loop the victim can't act out of, and passes one it can", () => {
  // Uther regrabs Rifleman after each up throw at 50%: only buttons get the victim out of the cycle.
  const start = standingMatch(Character.uther, Character.rifleman, 50, 40);
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
  // With only the stick to move, nothing could get the victim out; with the buttons too, it can act on frames between throw and regrab.
  const stickOnly = watch(INPUT_CLASSES.filter(({ changes }) => changes === "stick"));
  expect(stickOnly.found.length).toBe(1);
  expect(stickOnly.found[0]).toMatch(/^p1 \(Rifleman\) was caught by p0 \(Uther\) in a \d+-frame loop.*only the stick changed anything/);
  // The cycle is the throw and the regrab, not a moment the fighters stood still.
  expect(Number(/in a (\d+)-frame loop/.exec(stickOnly.found[0] ?? "")?.[1])).toBeGreaterThan(30);
  const every = watch(INPUT_CLASSES.filter(({ changes }) => changes !== "both"));
  expect(every.cycles).toBe(1);
  expect(every.found).toEqual([]);
}, 30_000);
