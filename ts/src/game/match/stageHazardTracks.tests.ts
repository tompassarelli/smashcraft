







import { test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { stageWarning } from "../presentation/stageHazards";
import { createReplaySnapshot } from "../replay/snapshot";
import { surfaceCount, surfaceLeft, surfaceMoves, surfaceRight, surfaceZ } from "../sim/stage";
import { fighterAt } from "../sim/roster";
import { SEA_SURFACE_Z, cannonAim, cannonOn, cannonX, hasCannon, hasTide, hasWind, tideDirection, tidePush, windDirection, windOn, windPhase, windPush } from "../sim/stageHazards";
import { useMatchSeed } from "./botRandom";
import { Phase, stageClock } from "./rules";
import { stepMatch } from "./step";


const FRAMES = 920;
const SEEDS = [3, 777] as const;
const WIND_PROBES = [-560.0, -300.0, -40.0, 40.0, 300.0, 560.0];
const SEA_PROBES = [-1500.0, -700.0, 0.0, 700.0, 1500.0];

type Track = Record<string, string[]>;

function hazardNames(stage: number): string[] {
  const names: string[] = [];
  for (let deck = 1; deck < surfaceCount(stage); deck++) if (surfaceMoves(stage, deck)) names.push(`moving platform ${deck}`);
  if (hasWind(stage)) names.push("wind");
  if (hasCannon(stage)) names.push("cannon");
  if (hasTide(stage)) names.push("tide", "hydra");
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
  const swimmer = fighterAt(world, 1);
  if (hasTide(stage)) {
    swimmer.motion.x = -1000.0; swimmer.motion.z = SEA_SURFACE_Z; swimmer.motion.grounded = false; swimmer.motion.surface = undefined;
  }
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
    if (hasTide(stage)) {
      let push = `${tideDirection(match.matchFrame)}`;
      for (const x of SEA_PROBES) push = `${push},${tidePush(stage, match.matchFrame, x, SEA_SURFACE_Z - 10.0)}`;
      track["tide"]?.push(push);
      const { motion, water, status } = swimmer;
      track["hydra"]?.push(`${motion.x},${motion.z},${status.damage},${status.out},${water.inWater},${water.frames},${water.entries},${water.hydraFrame},${water.hydraX}`);
    }
    track["warning"]?.push(stageWarning(match, world));
    useMatchSeed(0);
  }
  return track;
}

const hazardStages = STAGE_CATALOG.filter(stage => hazardNames(stage.id).length > 0);

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
