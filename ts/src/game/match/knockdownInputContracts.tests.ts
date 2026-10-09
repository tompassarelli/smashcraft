

import { assertDefined, assertEquals, test } from "wisp/src/runtime/testing";
import { Character, DownState } from "../sim/codes";
import { isTumbling } from "../sim/conditions";
import { DOWN_BOUND_FRAMES, DOWN_WAIT_FRAMES } from "../sim/down";
import { type Fighter } from "../sim/fighter";
import { createReferenceFighter } from "../sim/referenceRig";
import { type Pad, type PadMatch, padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

interface Run extends PadMatch {
  readonly victim: Fighter;
}

const ATTACKER_X = -560.0;
const VICTIM_X = -460.0;


function startRun(victimCharacter: Character, percent: number): Run {
  const match = testMatch(3, Character.sylvanas);
  match.world.fighters[0] = createReferenceFighter(Character.sylvanas, ATTACKER_X, 1);
  const victim = createReferenceFighter(victimCharacter, VICTIM_X, -1);
  victim.status.damage = percent;
  match.world.fighters[1] = victim;
  return { ...padMatch(match, "knockdown"), victim };
}


function knockDown(run: Run, strike: Pad, victimPadAt: (frame: number) => Pad): number {
  for (let frame = 1; frame <= 120; frame++) {
    playPads(run, frame === 1 ? strike : {}, victimPadAt(frame));
    const { victim } = run;
    if (frame > 1 && victim.motion.grounded && victim.launch.hitlag === 0 && !isTumbling(victim) && victim.down.state !== DownState.none) return frame;
  }
  throw new Error("the victim never landed from tumble");
}


function playThrough(run: Run, last: number, victimPadAt: (frame: number) => Pad): void {
  for (let frame = run.match.runtime.simulationFrame + 1; frame <= last; frame++) playPads(run, {}, victimPadAt(frame));
}

interface Knockdown {
  readonly name: string;
  readonly victim: Character;
  readonly percent: number;

  readonly strike: Pad;
}

const KNOCKDOWNS: readonly Knockdown[] = [
  { name: "low", victim: Character.sylvanas, percent: 10.0, strike: { cx: 1.0 } },
  { name: "mid", victim: Character.sylvanas, percent: 50.0, strike: { cx: 1.0 } },
  { name: "high", victim: Character.demonHunter, percent: 100.0, strike: { attack: true } },
];

const NEUTRAL = (): Pad => ({});


function missedTechLanding(knockdown: Knockdown): number {
  const run = startRun(knockdown.victim, knockdown.percent);
  const landing = knockDown(run, knockdown.strike, NEUTRAL);
  assertEquals(run.victim.down.state, DownState.bound, knockdown.name);
  return landing;
}


const boundEnd = (landing: number) => landing + DOWN_BOUND_FRAMES;

test("a trigger press before a tumble landing techs through the journal path at low, medium and high percent [reference]", () => {
  for (const knockdown of KNOCKDOWNS) {
    const landing = missedTechLanding(knockdown);
    const run = startRun(knockdown.victim, knockdown.percent);

    assertEquals(knockDown(run, knockdown.strike, (frame) => ({ trigger: frame === landing - 5 })), landing, knockdown.name);
    assertEquals(run.victim.down.state, DownState.tech, knockdown.name);
  }
});

test("an attack pressed during the bound starts the get-up attack as Melee's bound ends [reference]", () => {
  for (const knockdown of KNOCKDOWNS) {
    const run = startRun(knockdown.victim, knockdown.percent);
    const landing = knockDown(run, knockdown.strike, NEUTRAL);
    const pad = (frame: number): Pad => ({ attack: frame === landing + 5 });
    playThrough(run, boundEnd(landing) - 1, pad);
    assertEquals(run.victim.down.state, DownState.bound, knockdown.name);
    playThrough(run, boundEnd(landing), pad);
    assertEquals(run.victim.down.state, DownState.attack, knockdown.name);
  }
});

test("a stick held sideways rolls forward or back, and held up stands, as Melee's bound ends [reference]", () => {
  for (const knockdown of KNOCKDOWNS) {
    for (const [stick, state, direction] of [[{ x: -1.0 }, DownState.roll, -1], [{ x: 1.0 }, DownState.roll, 1], [{ y: 1.0 }, DownState.stand, 0]] as const) {
      const run = startRun(knockdown.victim, knockdown.percent);
      const landing = knockDown(run, knockdown.strike, NEUTRAL);
      const pad = (frame: number): Pad => (frame >= landing + 5 ? stick : {});
      playThrough(run, boundEnd(landing) - 1, pad);
      assertEquals(run.victim.down.state, DownState.bound, knockdown.name);
      playThrough(run, boundEnd(landing), pad);
      assertEquals(run.victim.down.state, state, knockdown.name);
      assertEquals(run.victim.down.direction, direction, knockdown.name);
    }
  }
});

test("the down wait takes Special, takes a trigger press, and stands by itself after Melee's 220 frames [reference]", () => {

  const [low, mid, high] = [assertDefined(KNOCKDOWNS[0]), assertDefined(KNOCKDOWNS[1]), assertDefined(KNOCKDOWNS[2])];
  for (const [knockdown, pad, state] of [[low, { special: true }, DownState.attack], [mid, { trigger: true }, DownState.stand]] as const) {
    const run = startRun(knockdown.victim, knockdown.percent);
    const landing = knockDown(run, knockdown.strike, NEUTRAL);
    const pressAt = boundEnd(landing) + 20;
    playThrough(run, pressAt - 1, NEUTRAL);
    assertEquals(run.victim.down.state, DownState.wait, knockdown.name);
    playThrough(run, pressAt, (frame) => (frame === pressAt ? pad : {}));
    assertEquals(run.victim.down.state, state, knockdown.name);
  }
  const run = startRun(high.victim, high.percent);
  const landing = knockDown(run, high.strike, NEUTRAL);
  playThrough(run, boundEnd(landing) + DOWN_WAIT_FRAMES - 1, NEUTRAL);
  assertEquals(run.victim.down.state, DownState.wait);
  playThrough(run, boundEnd(landing) + DOWN_WAIT_FRAMES, NEUTRAL);
  assertEquals(run.victim.down.state, DownState.stand);
});

test("a C-stick up flick during the wait starts the get-up attack and a sideways flick rolls that way [reference]", () => {


  for (const knockdown of KNOCKDOWNS) {
    for (const [flick, state, direction] of [[{ cy: 1.0 }, DownState.attack, 0], [{ cx: -1.0 }, DownState.roll, -1], [{ cx: 1.0 }, DownState.roll, 1]] as const) {
      const run = startRun(knockdown.victim, knockdown.percent);
      const landing = knockDown(run, knockdown.strike, NEUTRAL);
      const flickAt = boundEnd(landing) + 20;
      const pad = (frame: number): Pad => (frame >= flickAt ? flick : {});
      playThrough(run, flickAt - 1, pad);
      assertEquals(run.victim.down.state, DownState.wait, knockdown.name);
      playThrough(run, flickAt, pad);
      assertEquals(run.victim.down.state, state, knockdown.name);
      assertEquals(run.victim.down.direction, direction, knockdown.name);
    }
  }
});

test("a C-stick flick as Melee's bound ends gets up, and one held through the wait does nothing [reference]", () => {
  for (const [flick, state, direction] of [[{ cy: 1.0 }, DownState.attack, 0], [{ cx: 1.0 }, DownState.roll, 1]] as const) {
    const run = startRun(Character.sylvanas, 10.0);
    const landing = knockDown(run, { cx: 1.0 }, NEUTRAL);
    const pad = (frame: number): Pad => (frame === boundEnd(landing) ? flick : {});
    playThrough(run, boundEnd(landing), pad);
    assertEquals(run.victim.down.state, state);
    assertEquals(run.victim.down.direction, direction);
  }
  const run = startRun(Character.sylvanas, 10.0);
  const landing = knockDown(run, { cx: 1.0 }, NEUTRAL);
  const held = (frame: number): Pad => (frame >= landing + 5 ? { cy: 1.0 } : {});
  playThrough(run, boundEnd(landing) + 20, held);
  assertEquals(run.victim.down.state, DownState.wait);
});
