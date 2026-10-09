


import { floorMod } from "wisp/src/sim/intMath";
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import type { Direction } from "../input/inputRow";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { LedgeState } from "../sim/codes";
import { type Controls, copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { mainDeckLeft } from "../sim/stage";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { produceComputerInput } from "./botPlay";
import { Phase, computerActive, createMatchState, leaveMatch, requestStart, setParticipants, setTraining } from "./rules";
import { LESSONS, LessonAction, LESSON_CHEER_FRAMES, TUTORIAL_STAGE, prepareTutorial, stepTutorialLesson, tutorialFinished, tutorialText } from "./tutorial";

const NEUTRAL = neutralControls();
const NEUTRAL_FIGHTER = createFighter(Character.rifleman, 0.0, 1);
type Script = (input: Controls, frame: number, queue: (style: AttackStyle, facing: Direction) => void, player: Readonly<Fighter>, partner: Readonly<Fighter>) => void;


function lessonMatch(lesson: number, gap = 30.0) {
  const world = createRoster(3, [createFighter(Character.rifleman, -gap / 2, 1), createFighter(Character.rifleman, gap / 2, -1)]);
  const game = createMatchState();
  game.phase = Phase.match;
  game.stageChoice = TUTORIAL_STAGE;
  game.humanMask = 1;
  game.humanFighterMask = 1;
  game.computerMask = 2;
  game.training = true;
  game.trainer.lesson = lesson;
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const run = (frames: number, script?: Script) => {
    for (let i = 0; i < frames; i++) {
      const frame = runtime.simulationFrame + 1;
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        copyControls(produced.inputs[slot], NEUTRAL);
        clearAttackBuffer(produced.commands[slot]);
        if (slot === 1) produceComputerInput(game, world, runtime, 1, frame, produced.inputs[1], produced.commands[1]);
        else script?.(produced.inputs[0], i, (style, facing) => queueAttack(produced.commands[0], { style, facing, frame, mayCharge: false }), fighterAt(world, 0), fighterAt(world, 1));
      }
      assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
      assertTrue(executeMatchFrame(row, game, world, controls, runtime, frame));
    }
  };
  return { world, game, run, player: fighterAt(world, 0), partner: fighterAt(world, 1) };
}


const SCRIPTS: Record<LessonAction, { readonly frames: number; readonly script: Script }> = {

  [LessonAction.dash]: { frames: 240, script: (input, frame) => { input.direction = floorMod(frame, 40) < 12 ? (floorMod(frame, 80) < 40 ? 1 : -1) : 0; } },

  [LessonAction.doubleJump]: { frames: 300, script: (input, frame) => { input.jumpPressed = floorMod(frame, 60) === 0 || floorMod(frame, 60) === 20; input.jumpHeld = floorMod(frame, 60) < 30; } },
  [LessonAction.hit]: { frames: 300, script: (input, frame, queue, player, partner) => {
    const toward: Direction = partner.motion.x < player.motion.x ? -1 : 1;
    if (Math.abs(partner.motion.x - player.motion.x) > 30.0) { input.direction = toward; input.walking = true; }
    if (floorMod(frame, 30) === 0) queue(AttackStyle.jab, toward);
  } },
  [LessonAction.special]: { frames: 300, script: (input, frame) => { input.specialPressed = floorMod(frame, 90) === 0; } },

  [LessonAction.dodge]: { frames: 300, script: (input, frame) => {
    input.shield = true;
    input.shieldTriggerActive = true;
    input.shieldStrength = 1.0;
    input.shieldPressed = frame === 0;
    input.groundDodgePressed = floorMod(frame, 60) === 30;
    input.groundDodgeDirection = floorMod(frame, 120) < 60 ? -1 : 1;
  } },

  [LessonAction.throw]: { frames: 900, script: (input, frame, queue, player, partner) => {
    const toward: Direction = partner.motion.x < player.motion.x ? -1 : 1;
    if (player.grab.target !== undefined) input.grabThrowX = toward;
    else if (Math.abs(partner.motion.x - player.motion.x) > 25.0) { input.direction = toward; input.walking = true; }
    else if (floorMod(frame, 20) === 0) queue(AttackStyle.grab, toward);
  } },

  [LessonAction.ledge]: { frames: 1200, script: (input, _, __, player) => {
    const edge = mainDeckLeft(TUTORIAL_STAGE);
    if (player.ledge.state === LedgeState.hang) { input.getupDirectionPressed = true; input.getupDirection = 1; }
    else if (player.ledge.state !== LedgeState.none) input.direction = 0;
    else if (player.motion.grounded && player.motion.x > edge + 60.0) { input.direction = -1; input.walking = true; }
    else if (player.motion.grounded && player.facing < 0) { input.direction = 1; input.walking = true; }
    else if (player.motion.grounded) input.jumpPressed = true;
    else {
      input.direction = player.motion.x > edge - 60.0 && player.motion.z > -40.0 ? -1 : 1;
      input.jumpPressed = player.motion.z < -150.0 && player.motion.vz < 0 && player.jump.remaining > 0;
    }
    input.jumpHeld = input.jumpPressed;
  } },
  [LessonAction.knockout]: { frames: 300, script: (_, frame, queue) => { if (floorMod(frame, 60) === 0) queue(AttackStyle.forwardSmash, 1); } },
};

function lessonPassesOnlyOnItsAction(lesson: number): void {
  const info = LESSONS[lesson];
  if (info === undefined) throw new Error(`no lesson ${lesson}`);
  const { frames, script } = SCRIPTS[info.action];
  const idle = lessonMatch(lesson);
  idle.run(frames);
  assertEquals(idle.game.trainer.lesson, lesson);
  assertEquals(idle.game.trainer.lessonCount, 0);
  const played = lessonMatch(lesson);
  played.run(frames, script);
  assertTrue(played.game.trainer.lessonCheer > 0 || played.game.trainer.lesson === lesson + 1);
}

for (let lesson = 0; lesson < LESSONS.length; lesson++) {
  test(`lesson ${lesson + 1}, ${LESSONS[lesson]?.name ?? ""}, passes on its action and not on idle play [spec #306]`, () => lessonPassesOnlyOnItsAction(lesson));
}

test("a passed lesson says well done, then the next lesson starts from zero; the last one finishes the tutorial [spec #306]", () => {
  const { game, run } = lessonMatch(0);
  for (let frame = 0; frame < 240 && game.trainer.lessonCheer === 0; frame++) run(1, (input) => SCRIPTS[LessonAction.dash].script(input, frame, () => undefined, NEUTRAL_FIGHTER, NEUTRAL_FIGHTER));
  assertTrue(tutorialText(game.trainer).includes("Well done!"));
  run(LESSON_CHEER_FRAMES);
  assertEquals(game.trainer.lesson, 1);
  assertEquals(game.trainer.lessonCount, 0);
  assertTrue(tutorialText(game.trainer).startsWith("Lesson 2 of 8: Jump and double jump"));
  const last = lessonMatch(LESSONS.length - 1);
  last.run(300, SCRIPTS[LessonAction.knockout].script);
  last.run(LESSON_CHEER_FRAMES);
  assertTrue(tutorialFinished(last.game.trainer));
  assertTrue(tutorialText(last.game.trainer).startsWith("Tutorial complete!"));
});

test("the knockout lesson starts the partner badly hurt [spec #306]", () => {
  const { run, partner } = lessonMatch(LESSONS.length - 1);
  run(1);
  assertEquals(partner.status.damage, LESSONS[LESSONS.length - 1]?.partnerDamage);
});

test("the tutorial menu starts any lesson on the Training stage with a computer partner, and leaving ends it [spec #306]", () => {
  const game = createMatchState();
  setParticipants(game, 1, 0);
  stepTutorialLesson(game, 0, -1);
  assertEquals(game.trainer.lesson, LESSONS.length - 1);
  stepTutorialLesson(game, 0, 1);
  stepTutorialLesson(game, 0, 1);
  assertEquals(game.trainer.lesson, 1);
  assertTrue(prepareTutorial(game, 0));
  assertTrue(game.training);
  assertTrue(computerActive(game, 1));
  assertEquals(game.phase, Phase.stageMenu);
  assertEquals(game.stageChoice, TUTORIAL_STAGE);
  assertTrue(requestStart(game, 0));
  assertEquals(game.trainer.lesson, 1);
  assertTrue(leaveMatch(game, 0));
  assertEquals(game.trainer.lesson, -1);
  setTraining(game, 0, false);
  assertFalse(game.training);
});
