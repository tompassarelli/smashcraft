import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { createRoster, fighterAt, neutralControls, sameControls } from "../sim/roster";
import { sameAttackBuffer } from "../input/attackBuffer";
import { produceComputerInput } from "./botPlay";
import { BOT_DIRECTION_FRAMES, commitBotDirection, createBotMemory, observeOpponents, perceivedOpponent } from "./botPerception";
import { cpuSkill } from "./cpuLevel";
import { createFrameControls } from "./controls";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { createMatchState, Phase } from "./rules";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { replayChecksum } from "../replay/matchReplay";
import { canonicalState } from "../replay/canonical";

const SURPRISE_FRAME = 50;

function setup(level: number) {
  const own = createFighter(Character.archer, -150.0, 1);
  const target = createFighter(Character.rifleman, 150.0, -1);
  const world = createRoster(3, [own, target]);
  const game = createMatchState();
  game.phase = Phase.match;
  game.cpuLevels[0] = level;
  return { own, target, world, game, runtime: createPacingAndPresentation(), controls: createFrameControls() };
}

const surprises: readonly ((target: Fighter) => void)[] = [
  target => { target.attack.style = AttackStyle.forwardSmash; target.attack.serial++; target.attack.frame = 0; },
  target => { target.shield.raised = true; },
  target => { target.motion.grounded = false; target.motion.z = 220.0; target.motion.vz = 8.0; },
  target => { target.motion.x = -300.0; target.motion.deltaX = -10.0; },
  target => { target.special.action = SpecialAction.riflemanBlaster; target.special.frame = 0;
    const p = at(target.projectiles, 0); p.life = 100; p.x = 0.0; p.z = 45.0; p.direction = -1; p.velocityX = -12.0; p.serial++; },
];

test("replay state checks detect delayed observations and direction commitment independently of current fighters", () => {
  const expected = setup(9);
  const changed = setup(9);
  observeOpponents(expected.runtime.botMemory, expected.world, 1);
  changed.target.motion.x = -300.0;
  observeOpponents(changed.runtime.botMemory, changed.world, 1);
  changed.target.motion.x = expected.target.motion.x;
  const checksum = (game: ReturnType<typeof setup>) => replayChecksum(game.world, game.game, game.runtime);
  const canonical = (game: ReturnType<typeof setup>) => canonicalState({ world: game.world, match: game.game, controls: game.controls, runtime: game.runtime });
  assertTrue(checksum(expected) !== checksum(changed));
  assertTrue(canonical(expected) !== canonical(changed));
  changed.runtime.botMemory.history = expected.runtime.botMemory.history;
  assertEquals(checksum(expected), checksum(changed));
  changed.runtime.botMemory.directions[0] = -1;
  assertTrue(checksum(expected) !== checksum(changed));
  changed.runtime.botMemory.directions[0] = 0;
  changed.runtime.botMemory.directionFrames[0] = 5;
  assertTrue(checksum(expected) !== checksum(changed));
});

test("45 surprise-action traces: no computer input responds before its level's observation delay", () => {
  let early = 0;
  for (let level = 1; level <= 9; level++) {
    const delay = cpuSkill(level).reactionFrames;
    assertEquals(delay, 39 - 3 * level);
    for (const surprise of surprises) {
      const changed = setup(level);
      const quiet = setup(level);
      for (let frame = 1; frame < SURPRISE_FRAME + delay; frame++) {
        if (frame === SURPRISE_FRAME) surprise(changed.target);
        for (const game of [changed, quiet]) produceComputerInput(game.game, game.world, game.runtime, 0, frame, game.controls.inputs[0], game.controls.commands[0]);
        if (!sameControls(changed.controls.inputs[0], quiet.controls.inputs[0]) || !sameAttackBuffer(changed.controls.commands[0], quiet.controls.commands[0])) early++;
      }
      assertEquals(perceivedOpponent(changed.runtime.botMemory, changed.own, 0, SURPRISE_FRAME + delay - 1, delay)?.motion.z, 0.0);
      observeOpponents(changed.runtime.botMemory, changed.world, SURPRISE_FRAME + delay);
      const seen = assertDefined(perceivedOpponent(changed.runtime.botMemory, changed.own, 0, SURPRISE_FRAME + delay, delay));
      assertEquals(seen.motion.x, changed.target.motion.x);
      assertEquals(seen.motion.z, changed.target.motion.z);
      assertEquals(seen.shield.raised, changed.target.shield.raised);
      assertEquals(seen.attack.style, changed.target.attack.style);
      assertEquals(at(seen.projectiles, 0).life, at(changed.target.projectiles, 0).life);
    }
  }
  assertEquals(early, 0);
});

test("level 9 changes its approach on frame 12 after a surprise side change", () => {
  const changed = setup(9);
  const quiet = setup(9);
  let first: number | undefined;
  for (let frame = 1; frame <= SURPRISE_FRAME + 20; frame++) {
    if (frame === SURPRISE_FRAME) at(surprises, 3)(changed.target);
    for (const game of [changed, quiet]) produceComputerInput(game.game, game.world, game.runtime, 0, frame, game.controls.inputs[0], game.controls.commands[0]);
    if (first === undefined && changed.controls.inputs[0].direction !== quiet.controls.inputs[0].direction) first = frame - SURPRISE_FRAME;
  }
  assertEquals(first, 12);
});

test("rapid grounded and airborne requests, including neutral braking, have zero reversals before five frames", () => {
  const memory = createBotMemory();
  const input = neutralControls();
  let previous = 0;
  let chosen = 0;
  let reversals = 0;
  let early = 0;
  for (let frame = 1; frame <= 500; frame++) {
    input.direction = floorMod(frame, 3) === 0 ? 0 : floorMod(frame, 2) === 0 ? -1 : 1;
    commitBotDirection(memory, 0, frame, input);
    if (input.direction !== 0 && input.direction !== previous) {
      if (previous !== 0) { reversals++; if (frame - chosen < BOT_DIRECTION_FRAMES) early++; }
      previous = input.direction;
      chosen = frame;
    }
  }
  assertTrue(reversals > 50);
  assertEquals(early, 0);
});

test("all 13 fighters' approach, retreat, air steering and recovery traces have zero early direction reversals", () => {
  let frames = 0;
  let reversals = 0;
  let early = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const game = setup(9);
    game.world.fighters[0] = createFighter(character, -150.0, 1);
    const own = fighterAt(game.world, 0);
    const row = createMatchFrameInput();
    let previous = 0;
    let chosen = 0;
    for (let frame = 1; frame <= 360; frame++) {
      // An idle target crosses the computer, stands above it, then moves away.
      game.target.motion.x = frame < 120 ? 280.0 : frame < 240 ? -280.0 : 400.0;
      game.target.motion.z = frame >= 120 && frame < 240 ? 170.0 : 0.0;
      if (frame === 240) { own.motion.grounded = false; own.motion.x = 900.0; own.motion.z = 110.0; own.motion.vx = -4.0; own.motion.vz = -1.0; }
      produceComputerInput(game.game, game.world, game.runtime, 0, frame, game.controls.inputs[0], game.controls.commands[0]);
      const direction = game.controls.inputs[0].direction;
      if (own.launch.hitlag <= 0 && own.grab.owner === undefined && direction !== 0 && direction !== previous) {
        if (previous !== 0) { reversals++; if (frame - chosen < BOT_DIRECTION_FRAMES) early++; }
        previous = direction;
        chosen = frame;
      }
      assertTrue(captureFrame(row, frame, game.world.mask, game.controls, game.runtime));
      assertTrue(executeMatchFrame(row, game.game, game.world, game.controls, game.runtime, frame));
      frames++;
    }
  }
  assertEquals(frames, 4680);
  assertTrue(reversals > 13);
  assertEquals(early, 0);
});
