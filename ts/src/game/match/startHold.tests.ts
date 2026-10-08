import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { queueAttack } from "../input/attackBuffer";
import { MatchCue } from "../presentation/matchAudio";
import { countdownCue } from "../presentation/matchCues";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { copyControls, createRoster, fighterAt, neutralControls } from "../sim/roster";
import { createFrameControls } from "./controls";
import { MATCH_TICKS_PER_SECOND, Phase, START_HOLD_FRAMES, createMatchState, holdingStart, requestStart, setParticipants } from "./rules";
import { initializeMatchFighters, matchSpawnX, stepMatch } from "./step";

/** Two players past selection, started the way the stage menu starts a match, with a one-minute clock. */
function startedMatch(humans = 3) {
  const game = createMatchState();
  setParticipants(game, humans, 0);
  game.characterReadiness.fill(true);
  game.timeLimitMinutes = 1;
  game.stageChoice = 0;
  game.phase = Phase.stageMenu;
  assertTrue(requestStart(game, 0));
  const world = createRoster(humans, [createFighter(Character.archer, matchSpawnX(0), 1), createFighter(Character.rifleman, matchSpawnX(1), -1)]);
  initializeMatchFighters(game, world);
  return { game, world, controls: createFrameControls() };
}

test("a competitive match holds every fighter for 180 frames, with the clock stopped until GO! [spec #129]", () => {
  const { game, world, controls } = startedMatch();
  assertEquals(game.startHold, START_HOLD_FRAMES);
  assertEquals(START_HOLD_FRAMES, 180);
  const clock = game.remainingFrames;
  // Settle onto the deck, then hold right and jump every frame of the countdown.
  const held = neutralControls();
  held.direction = 1;
  for (let frame = 1; frame <= START_HOLD_FRAMES; frame++) {
    copyControls(controls.inputs[0], held);
    controls.inputs[0].jumpPressed = frame > 90;
    if (frame === 175) queueAttack(controls.commands[0], { style: 5, facing: 0, frame, mayCharge: false });
    const x = fighterAt(world, 0).motion.x;
    stepMatch(game, world, controls, frame);
    assertTrue(holdingStart(game) || frame === START_HOLD_FRAMES + 1);
    if (frame > 30) assertEquals(fighterAt(world, 0).motion.x, x, `frame ${frame}`);
  }
  const fighter = fighterAt(world, 0);
  assertEquals(game.remainingFrames, clock);
  assertEquals(fighter.jump.serial, 0);
  assertEquals(fighter.attack.serial, 0);
  // GO!: the stick held through it moves at once; the press made during the hold is gone.
  copyControls(controls.inputs[0], held);
  stepMatch(game, world, controls, START_HOLD_FRAMES + 1);
  assertFalse(holdingStart(game));
  assertEquals(game.remainingFrames, clock - 1);
  for (let frame = START_HOLD_FRAMES + 2; frame <= START_HOLD_FRAMES + 4; frame++) stepMatch(game, world, controls, frame);
  assertEquals(fighter.motion.x > matchSpawnX(0), true, `moved to ${fighter.motion.x}`);
  assertEquals(fighter.jump.serial, 0);
  assertEquals(fighter.attack.serial, 0);
  // A fresh press after GO! acts.
  copyControls(controls.inputs[0], neutralControls());
  controls.inputs[0].jumpPressed = true;
  for (let frame = START_HOLD_FRAMES + 5; frame < START_HOLD_FRAMES + 12; frame++) {
    stepMatch(game, world, controls, frame);
    controls.inputs[0].jumpPressed = false;
  }
  assertEquals(fighter.jump.serial > 0, true, "fresh jump");
});

test("practice starts at once, with no countdown [spec #129]", () => {
  const { game } = startedMatch(1);
  assertTrue(game.practice);
  assertEquals(game.startHold, 0);
  assertFalse(holdingStart(game));
});

test("the countdown calls 3, 2 and 1 a second apart and GO! on the first frame fighters act [spec #129]", () => {
  const { game, world, controls } = startedMatch();
  const calls: string[] = [];
  for (let frame = 1; frame <= START_HOLD_FRAMES + MATCH_TICKS_PER_SECOND; frame++) {
    stepMatch(game, world, controls, frame);
    const cue = countdownCue(game);
    if (cue !== undefined) calls.push(`${cue}@${game.matchFrame}`);
  }
  assertEquals(calls.join(" "), `${MatchCue.three}@1 ${MatchCue.two}@61 ${MatchCue.one}@121 ${MatchCue.go}@181`);
});
