import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { createRoster, fighterAt, neutralControls, sameControls } from "../sim/roster";
import { sameAttackBuffer } from "../input/attackBuffer";
import { produceComputerInput } from "./botPlay";
import { BOT_DIRECTION_FRAMES, type BotMemory, commitBotDirection, copyBotMemory, createBotMemory, observeOpponents, perceivedOpponent } from "./botPerception";
import { cpuSkill } from "./cpuSkill";
import { CPU_PROFILES, type CpuOpponentId, type CpuTier } from "./cpuProfiles";
import { createFrameControls } from "./controls";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { createMatchState, Phase } from "./rules";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { replayChecksum } from "../replay/matchReplay";
import { botObservationCanonical, canonicalState } from "../replay/canonical";
import { sweep } from "../../runtime/sweep";

const SURPRISE_FRAME = 50;

function setup(opponent: CpuOpponentId = "wren", tier: CpuTier = "expert") {
  const own = createFighter(Character.archer, -150.0, 1);
  const target = createFighter(Character.rifleman, 150.0, -1);
  const world = createRoster(3, [own, target]);
  const game = createMatchState();
  game.phase = Phase.match;
  game.cpuOpponents[0] = opponent;
  game.cpuResolvedOpponents[0] = opponent;
  game.cpuTiers[0] = tier;
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

test("retained observations survive storage reuse, restored plain history and rollback [invariant]", () => {
  const game = setup();
  const saved = createBotMemory();
  for (let frame = 1; frame <= 43; frame++) {
    game.target.motion.x = frame;
    game.target.attack.style = AttackStyle.forwardSmash;
    const projectile = at(game.target.projectiles, 0);
    projectile.life = frame;
    projectile.x = frame;
    observeOpponents(game.runtime.botMemory, game.world, frame);
  }
  copyBotMemory(saved, game.runtime.botMemory);
  const original = saved.history.map(sample => botObservationCanonical(sample));
  for (let frame = 44; frame <= 300; frame++) {
    game.target.motion.x = frame;
    game.target.attack.style = undefined;
    at(game.target.projectiles, 0).life = 0;
    observeOpponents(game.runtime.botMemory, game.world, frame);
  }
  for (let index = 0; index < saved.history.length; index++) {
    assertEquals(botObservationCanonical(at(saved.history, index)), at(original, index));
    assertEquals(at(saved.history, index).opponents[1]?.motion.x, index + 1);
  }
  assertEquals(game.runtime.botMemory.history.length, 43);
  const latest = at(game.runtime.botMemory.history, 42);
  assertEquals(latest.opponents[1]?.attack.style, undefined);
  assertEquals(at(assertDefined(latest.opponents[1]).projectiles, 0).life, 0);
  assertEquals(at(assertDefined(latest.opponents[1]).projectiles, 0).x, 0);
  // Decoded moment records carry no private ownership metadata.
  const plain: BotMemory = { history: saved.history, directions: [0, 0, 0, 0], directionFrames: [0, 0, 0, 0] };
  copyBotMemory(game.runtime.botMemory, plain);
  observeOpponents(game.runtime.botMemory, game.world, 44);
  assertEquals(at(game.runtime.botMemory.history, 41).opponents[1]?.motion.x, 43);
  assertEquals(botObservationCanonical(at(saved.history, 42)), at(original, 42));
});

test("replay state checks detect delayed observations and direction commitment independently of current fighters [invariant]", () => {
  const expected = setup();
  const changed = setup();
  observeOpponents(expected.runtime.botMemory, expected.world, 1);
  changed.target.motion.x = -300.0;
  observeOpponents(changed.runtime.botMemory, changed.world, 1);
  changed.target.motion.x = expected.target.motion.x;
  const checksum = (game: ReturnType<typeof setup>) => replayChecksum(game.world, game.game, game.runtime);
  const canonical = (game: ReturnType<typeof setup>) => canonicalState({ world: game.world, match: game.game, controls: game.controls, runtime: game.runtime });
  assertTrue(checksum(expected) !== checksum(changed));
  assertTrue(canonical(expected) !== canonical(changed));
  copyBotMemory(changed.runtime.botMemory, expected.runtime.botMemory);
  assertEquals(checksum(expected), checksum(changed));
  changed.runtime.botMemory.directions[0] = -1;
  assertTrue(checksum(expected) !== checksum(changed));
  changed.runtime.botMemory.directions[0] = 0;
  changed.runtime.botMemory.directionFrames[0] = 5;
  assertTrue(checksum(expected) !== checksum(changed));
});

sweep("150 surprise-action traces: no computer input responds before its authored observation delay [spec #176] [spec #184]", () => {
  let early = 0;
  for (const profile of CPU_PROFILES) {
    const delay = cpuSkill(profile.opponent, profile.tier).reactionFrames;
    assertTrue(delay >= 12);
    for (const surprise of surprises) {
      const changed = setup(profile.opponent, profile.tier);
      const quiet = setup(profile.opponent, profile.tier);
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

// Wren Expert's authored idle stretch for this slot and fighter covers frames 60-89, during
// which it stands still whatever it perceives; this response window precedes it. Its spacing
// gameplan keeps the same stick direction on either side, so any changed input counts.
const RESPONSE_SURPRISE_FRAME = 35;

test("Wren Expert first responds on frame 12 after a surprise side change [spec #176]", () => {
  const changed = setup();
  const quiet = setup();
  let first: number | undefined;
  for (let frame = 1; frame <= RESPONSE_SURPRISE_FRAME + 20; frame++) {
    if (frame === RESPONSE_SURPRISE_FRAME) at(surprises, 3)(changed.target);
    for (const game of [changed, quiet]) produceComputerInput(game.game, game.world, game.runtime, 0, frame, game.controls.inputs[0], game.controls.commands[0]);
    if (first === undefined && (!sameControls(changed.controls.inputs[0], quiet.controls.inputs[0]) || !sameAttackBuffer(changed.controls.commands[0], quiet.controls.commands[0]))) first = frame - RESPONSE_SURPRISE_FRAME;
  }
  assertEquals(first, 12);
});

test("rapid grounded and airborne requests, including neutral braking, have zero reversals before five frames [spec #176]", () => {
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

sweep("all 21 fighters' approach, retreat, air steering and recovery traces have zero early direction reversals [spec #176]", () => {
  let frames = 0;
  let reversals = 0;
  let early = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const game = setup();
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
  assertEquals(frames, 7560);
  assertTrue(reversals > 13);
  assertEquals(early, 0);
});
