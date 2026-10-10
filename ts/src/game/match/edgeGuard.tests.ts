import { assertDefined, assertEquals, test } from "wisp/src/runtime/testing";
import { sweep } from "../../runtime/sweep";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { EDGE_GUARD_SCENARIOS, MIXED_PLANS, OPENING_MIN, PREDICTABLE, guardedReturn, playScenario, recoveryProfile, unguarded } from "./edgeGuardScenarios";

const check = (ok: boolean, label: string): void => assertEquals(ok ? "" : label, "");

function gimped(character: Character): void {
  const name = fighterName(character);
  const scenario = assertDefined(EDGE_GUARD_SCENARIOS[character], `${name} scenario`);
  check(playScenario(character, scenario, false).recovered, `${name} recovers when unguarded`);
  const guarded = playScenario(character, scenario, true);
  check(guarded.killed, `${name} at 40% is killed by ${fighterName(scenario.guarder)}'s edge-guard tool`);
  check(guarded.hitFrame >= PREDICTABLE.wait, `${name} is hit during its up special, frame ${guarded.hitFrame}`);
}

function beatable(character: Character): void {
  const profile = recoveryProfile(character);
  const name = fighterName(character);
  check(profile.opening >= OPENING_MIN, `${name} up special opening ${profile.opening} frames`);
  check(profile.endsAt !== "none", `${name} recovers from the probe`);
}

function mixedReturns(victim: Character, guarders: readonly Character[]): number {
  let returned = 0;
  for (const guarder of guarders) for (let seed = 0; seed < MIXED_PLANS.length; seed++) if (guardedReturn(victim, guarder, seed, "expert").recovered) returned++;
  return returned;
}

test("Rifleman's predictable recovery at 40% is killed by his own down air in a recorded edge-guard [spec #387]", () => {
  gimped(Character.rifleman);
});

sweep("every fighter's predictable recovery at 40% is killed by a roster fighter's recorded edge-guard tool [spec #387]", () => {
  for (const character of SELECTABLE_CHARACTERS) gimped(character);
});

test("Rifleman's Recoil Shot leaves a 15-frame hittable opening around its intangible frames 4 to 7 [spec #387] [spec #127]", () => {
  beatable(Character.rifleman);
});

sweep("every up special leaves a 15-frame hittable opening before it can act [spec #387] [spec #69]", () => {
  for (const character of SELECTABLE_CHARACTERS) beatable(character);
});

test("every mixed recovery plan returns unguarded for Thrall and Warden [invariant]", () => {
  for (const character of [Character.thrall, Character.warden]) {
    for (const plan of MIXED_PLANS) check(unguarded(character, plan).recovered, `${fighterName(character)} wait ${plan.wait} drift ${plan.drift}`);
  }
});

for (const victim of SELECTABLE_CHARACTERS) {
  sweep(`${fighterName(victim)}'s well-mixed recovery returns at least half the time against the seeded Wren Expert field [spec #387]`, () => {
    const returned = mixedReturns(victim, SELECTABLE_CHARACTERS);
    const trials = SELECTABLE_CHARACTERS.length * MIXED_PLANS.length;
    check(returned * 2 >= trials, `${fighterName(victim)} returned ${returned}/${trials}`);
  });
}

test("Wren Shadow Hunter at Advanced and Expert goes off stage and kills Rifleman's predictable recovery at 40% during its up special; at Intermediate it stays home [spec #387]", () => {
  for (const tier of ["advanced", "expert"] as const) {
    const outcome = guardedReturn(Character.rifleman, Character.shadowHunter, 0, tier, PREDICTABLE);
    check(outcome.killed && outcome.hitFrame >= PREDICTABLE.wait, `${tier} kills, hit frame ${outcome.hitFrame}`);
  }
  const home = guardedReturn(Character.rifleman, Character.shadowHunter, 0, "intermediate", PREDICTABLE);
  check(home.recovered && home.hitFrame < 0, "Intermediate leaves the recovery alone");
});

test("Mountain King's mixed recovery returns at least half the time against three Wren Expert edge-guarders [spec #387]", () => {
  const guarders = [Character.mountainKing, Character.warden, Character.jaina] as const;
  check(mixedReturns(Character.mountainKing, guarders) * 2 >= guarders.length * MIXED_PLANS.length, "Mountain King mixed returns");
});
