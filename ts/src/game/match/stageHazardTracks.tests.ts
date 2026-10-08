// Stage hazards follow the match clock, never a random draw (#274,
// smashcraft:docs/design/stage-art.md rule 13): every selectable stage with a
// hazard plays under two match seeds, with the fighters standing at centre
// and pressing nothing, and every hazard's track must agree frame by frame.
// The bots' random source is seeded with each match's seed while the hazards
// are read, so a hazard that draws from it diverges.
import { test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { stageWarning } from "../presentation/stageHazards";
import { createReplaySnapshot } from "../replay/snapshot";
import { surfaceCount, surfaceLeft, surfaceMoves, surfaceRight, surfaceZ } from "../sim/stage";
import { cannonAim, cannonOn, cannonX, hasCannon, hasWind, windDirection, windOn, windPhase, windPush } from "../sim/stageHazards";
import { useMatchSeed } from "./botRandom";
import { Phase, stageClock } from "./rules";
import { stepMatch } from "./step";

/** Every hazard's longest cycle: the carried platform's 920 frames covers the wind's warning and first gust and the cannon's full swing. */
const FRAMES = 920;
const SEEDS = [3, 777] as const;
const WIND_PROBES = [-560.0, -300.0, -40.0, 40.0, 300.0, 560.0];

type Track = Record<string, string[]>;

function hazardNames(stage: number): string[] {
  const names: string[] = [];
  for (let deck = 1; deck < surfaceCount(stage); deck++) if (surfaceMoves(stage, deck)) names.push(`moving platform ${deck}`);
  if (hasWind(stage)) names.push("wind");
  if (hasCannon(stage)) names.push("cannon");
  if (names.length > 0) names.push("warning");
  return names;
}

function hazardTrack(stage: number, seed: number): Track {
  const names = hazardNames(stage);
  const track: Track = {};
  for (const name of names) track[name] = [];
  const live = createReplaySnapshot();
  const { match, world, controls } = live;
  match.phase = Phase.match; match.stageChoice = stage; match.matchSeed = seed;
  match.humanMask = 3; match.humanFighterMask = 3;
  for (let frame = 1; frame <= FRAMES; frame++) {
    stepMatch(match, world, controls, frame);
    useMatchSeed(match.matchSeed);
    const clock = stageClock(match);
    for (let deck = 1; deck < surfaceCount(stage); deck++) {
      if (surfaceMoves(stage, deck)) track[`moving platform ${deck}`]?.push(`${surfaceLeft(stage, deck, clock)},${surfaceRight(stage, deck, clock)},${surfaceZ(stage, deck, clock)}`);
    }
    if (hasWind(stage)) {
      let push = `${windOn(stage, clock)},${windPhase(clock)},${windDirection(clock)}`;
      for (const x of WIND_PROBES) push = `${push},${windPush(stage, clock, x, 10.0)}`;
      track["wind"]?.push(push);
    }
    if (hasCannon(stage)) track["cannon"]?.push(`${cannonOn(stage, clock)},${cannonX(clock)},${cannonAim(clock)}`);
    track["warning"]?.push(stageWarning(match, world));
    useMatchSeed(0);
  }
  return track;
}

const hazardStages = STAGE_CATALOG.filter(stage => hazardNames(stage.id).length > 0);

test("the stage list has hazard stages to check [spec #274]", () => {
  if (hazardStages.length < 2) throw new Error(`only ${hazardStages.length} selectable stages have hazards; #194 built at least two`);
});

for (const stage of hazardStages) {
  test(`${stage.name}'s hazards follow the match clock: two match seeds give identical hazard tracks every frame [spec #274] [invariant]`, () => {
    const first = hazardTrack(stage.id, SEEDS[0]);
    const second = hazardTrack(stage.id, SEEDS[1]);
    for (const name of hazardNames(stage.id)) {
      const a = first[name] ?? [];
      const b = second[name] ?? [];
      if (a.length !== FRAMES || b.length !== FRAMES) throw new Error(`${stage.name} ${name}: recorded ${a.length} and ${b.length} frames, want ${FRAMES}`);
      for (let frame = 0; frame < FRAMES; frame++) {
        if (a[frame] !== b[frame]) throw new Error(`${stage.name} ${name} depends on the match seed: frame ${frame + 1} reads ${b[frame]} under seed ${SEEDS[1]}, ${a[frame]} under seed ${SEEDS[0]}`);
      }
    }
  });
}
