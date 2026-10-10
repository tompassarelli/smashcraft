import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { Phase } from "../match/rules";
import { stepMatch } from "../match/step";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { fighterAt } from "./roster";
import { TOMB_OF_SARGERAS_STAGE, mainDeckZ } from "./stage";
import { advanceSolo, controls } from "./testWorld";
import { f32 } from "wisp/src/sim/f32";
import { HYDRA_TELL_FRAMES, HYDRA_TRIGGER_FRAMES } from "./water";
import { SEA_SURFACE_Z, TIDE_SPEED } from "./stageHazards";
import { hydraStrikeZ } from "../presentation/stageHazards";

const TOMB = TOMB_OF_SARGERAS_STAGE;
const HYDRA_STRIKE = HYDRA_TRIGGER_FRAMES + HYDRA_TELL_FRAMES;

function seaMatch(x: number, z: number): ReplayState {
  const state = createReplaySnapshot();
  state.match.phase = Phase.match; state.match.stageChoice = TOMB;
  state.match.humanMask = 3; state.match.humanFighterMask = 3; state.match.practice = true;
  const f = fighterAt(state.world, 0);
  f.motion.x = x; f.motion.z = z; f.motion.grounded = false; f.motion.surface = undefined;
  return state;
}

function play(state: ReplayState, from: number, to: number, each?: (frame: number, f: Fighter) => void): void {
  for (let frame = from; frame <= to; frame++) {
    stepMatch(state.match, state.world, state.controls, frame);
    each?.(frame, fighterAt(state.world, 0));
  }
}

const NEUTRAL = controls();
const JUMP = controls({ jumpPressed: true, jumpHeld: true });
const OPEN_SEA = 900.0;

function floater(character: Character): Fighter {
  const f = createFighter(character, OPEN_SEA, -1);
  f.motion.grounded = false; f.motion.surface = undefined; f.motion.z = SEA_SURFACE_Z;
  advanceSolo(f, TOMB, NEUTRAL, 0.0);
  return f;
}

test("every fighter's water jump and double jump from the surface reach above the deck [k3 measure docs/design/water-stage.md]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const f = floater(character);
    f.water.entries = 1;
    advanceSolo(f, TOMB, JUMP, 0.0);
    let highest = f.motion.z;
    let doubled = false;
    for (let frame = 0; frame < 180 && (f.motion.z > SEA_SURFACE_Z || frame === 0); frame++) {
      const press = !doubled && f.motion.vz <= 0;
      if (press) doubled = true;
      advanceSolo(f, TOMB, press ? JUMP : controls({ jumpHeld: true }), 0.0);
      highest = Math.max(highest, f.motion.z);
    }
    if (!(doubled && highest > mainDeckZ(TOMB))) throw new Error(`fighter ${character} reaches ${highest} from the surface, below the deck at ${mainDeckZ(TOMB)}`);
  }
});

test("a hydra strike replays through rollback with no difference, and a dodged lunge at its drifting mark submerges after 18 frames and restores through rollback [k1 scenario]", () => {
  const live = seaMatch(-1000.0, SEA_SURFACE_Z);
  const saved = createReplaySnapshot(); const replay = createReplaySnapshot();
  play(live, 1, 170);
  copyReplayState(saved, live);
  play(live, 171, 230);
  copyReplayState(replay, saved);
  play(replay, 171, 230);
  assertGreaterThan(fighterAt(live.world, 0).status.damage, 0.0);
  assertEquals(firstStateDifference(live, replay), undefined);
  assertEquals(stateChecksum(live), stateChecksum(replay));
  const dodged = seaMatch(-1000.0, SEA_SURFACE_Z);
  play(dodged, 1, HYDRA_STRIKE - 1);
  const fighter = fighterAt(dodged.world, 0);
  const mark = fighter.water.hydraX;
  fighter.motion.x += 200.0;
  const dodgedSaved = createReplaySnapshot();
  copyReplayState(dodgedSaved, dodged);
  play(dodged, HYDRA_STRIKE, HYDRA_STRIKE + 17, (frame, f) => {
    assertEquals(f.status.damage, 0.0);
    assertEquals(f.water.hydraStrikeFrame, HYDRA_STRIKE);
    assertEquals(f.water.hydraX, f32(mark + TIDE_SPEED));
    assertEquals(hydraStrikeZ(TOMB, f.water, frame), -210.0 - (frame - HYDRA_STRIKE) * 20.0);
  });
  const dodgedReplay = createReplaySnapshot();
  copyReplayState(dodgedReplay, dodgedSaved);
  play(dodgedReplay, HYDRA_STRIKE, HYDRA_STRIKE + 17);
  assertEquals(firstStateDifference(dodged, dodgedReplay), undefined);
  assertEquals(stateChecksum(dodged), stateChecksum(dodgedReplay));
  play(dodged, HYDRA_STRIKE + 18, HYDRA_STRIKE + 18);
  assertEquals(hydraStrikeZ(TOMB, fighter.water, HYDRA_STRIKE + 18), undefined);
});
