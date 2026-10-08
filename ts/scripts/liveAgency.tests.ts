import { expect, test } from "bun:test";
import { emptyInput } from "../src/game/input/inputRow";
import { FighterAgencyForecast } from "../src/game/presentation/fighterAgency";
import { Character, DownState, GrabAction } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { analyzeAgency, agencyLetters, runFrame } from "./agency";
import { attackerPlan, standingMatch } from "./agencySweep";
import { sweep } from "../test/sweep";

const THROWS = [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown];

/** Compares each scenario for each victim; `throws` names the committed throws to compare. */
function compareLiveAgency(victims: readonly Character[], throws: readonly GrabAction[], scenarios = true): void {
  const forecast = new FighterAgencyForecast();
  const failures: string[] = [];
  let frames = 0;
  const compare = (name: string, start: ReturnType<typeof standingMatch>, length: number,
    row: Parameters<typeof analyzeAgency>[0]["row"] = () => emptyInput()) => {
    const report = analyzeAgency({ start, victim: 1, frames: length, horizon: 90, row });
    const live = report.frames.map((sample, index) => {
      const state = report.states[index];
      if (state === undefined) throw new Error("missing oracle state");
      const actual = forecast.classify(state.world, 1, state.match.stageChoice, state.match.matchFrame, state.controls.commands[1].graceFrames);
      if (actual !== sample.agency) failures.push(`${name} f${index + 1}: ${actual} != ${sample.agency} (${sample.classes.join(", ")})`);
      frames++;
      return { ...sample, agency: actual };
    });
    console.log(`${name}: ${agencyLetters(report.frames)} / ${agencyLetters(live)}`);
  };
  for (const character of victims) {
    const setup = () => standingMatch(Character.archer, character, 0, 400);
    if (scenarios) {
      const frozen = setup();
      fighterAt(frozen.world, 1).status.frozenFrames = 15;
      compare(`${character} freeze`, frozen, 18);
      const stunned = setup();
      fighterAt(stunned.world, 1).launch.hitstun = 20;
      compare(`${character} grounded buffer`, stunned, 23);
      const forced = setup();
      fighterAt(forced.world, 1).down.state = DownState.damage;
      compare(`${character} jab reset forced stand`, forced, 48);
      for (const lockout of [false, true]) {
        const falling = setup();
        const victim = fighterAt(falling.world, 1);
        victim.motion.grounded = false;
        victim.motion.surface = undefined;
        victim.motion.z = 450.0;
        victim.motion.vz = -8.0;
        victim.launch.hitstun = 60;
        victim.down.state = DownState.tumble;
        if (lockout) victim.tech.pressAge = 0;
        compare(`${character} tumble tech${lockout ? " lockout" : ""}`, falling, 42);
      }
      const hit = standingMatch(Character.demonHunter, character, 0, 40);
      const jab = attackerPlan("jab", hit.runtime.simulationFrame + 1);
      for (let index = 0; index < 20 && fighterAt(hit.world, 1).visuals.hit === 0; index++) {
        runFrame(hit, (slot) => slot === 0 ? jab(hit, hit.runtime.simulationFrame + 1) : emptyInput());
      }
      compare(`${character} actual jab hitlag`, hit, 30);
    }
    for (const action of throws) {
      const thrown = setup();
      const owner = fighterAt(thrown.world, 0);
      const victim = fighterAt(thrown.world, 1);
      owner.grab.target = 1;
      owner.grab.action = action;
      owner.grab.frame = 1;
      victim.grab.owner = 0;
      victim.grab.grabbedFrames = 120;
      compare(`${character} committed throw ${action}`, thrown, 55);
    }
    if (scenarios) {
      const held = setup();
      fighterAt(held.world, 0).grab.target = 1;
      fighterAt(held.world, 0).grab.action = GrabAction.hold;
      fighterAt(held.world, 1).grab.owner = 0;
      fighterAt(held.world, 1).grab.grabbedFrames = 80;
      compare(`${character} mashable hold`, held, 3);
    }
  }
  console.log(`live agency: ${frames} frames, ${failures.length} mismatches`);
  expect(failures).toEqual([]);
}

test("live locked marker matches the agency replay for buffers, tech, grabs, release, hitlag, freeze and forced stand", () => {
  compareLiveAgency([Character.archer], [GrabAction.throwForward]);
}, 120_000);

sweep("live locked marker matches the agency replay for Archer's other throws and for Rifleman and Illidan victims", () => {
  compareLiveAgency([Character.archer], THROWS.slice(1), false);
  compareLiveAgency([Character.rifleman, Character.demonHunter], THROWS);
}, 120_000);
