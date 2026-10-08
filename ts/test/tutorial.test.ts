// #306: the whole tutorial on one headless client of the integrity build. The
// player opens it from fighter selection with the menu's Start button, a pad
// plays every lesson, and pausing and leaving returns to fighter selection
// with Training on.
import { afterAll, expect } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { floorMod } from "wisp/src/sim/intMath";
import { Action, bit } from "../src/game/input/actions";
import { type InputRow, type RowFields, inputRow } from "../src/game/input/inputRow";
import { Phase } from "../src/game/match/rules";
import { LESSONS, LessonAction, TUTORIAL_STAGE, tutorialFinished, tutorialText } from "../src/game/match/tutorial";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { LedgeState } from "../src/game/sim/codes";
import type { Fighter } from "../src/game/sim/fighter";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { mainDeckLeft } from "../src/game/sim/stage";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { shows, value } from "./rematch/playableMatch";
import { sweep } from "./sweep";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

// The menu's Start tutorial button (ui/tutorialMenu.ts): top-left (0.23, 0.315), 0.16 by 0.035.
const START_BUTTON = { x: 0.23 + 0.16 / 2, y: 0.315 - 0.035 / 2 };
const LEFT = bit(Action.moveLeft);
const RIGHT = bit(Action.moveRight);
const SHIELD = bit(Action.rightTrigger);

const side = (toward: number) => toward < 0 ? LEFT : RIGHT;
const row = (fields: RowFields): InputRow => {
  const made = inputRow(fields);
  if (made === undefined) throw new Error(`no row for ${JSON.stringify(fields)}`);
  return made;
};
const NEUTRAL = row({});
/** Walk toward x, as a held half stick. */
const walk = (toward: number): InputRow => row({ held: side(toward) | bit(Action.walk), axisX: toward * 64 });

/** The pad: what the player's controller sends on `frame`, from what it sees of the player and partner in `lesson`. */
function pad(action: LessonAction, frame: number, player: Readonly<Fighter>, partner: Readonly<Fighter>): InputRow {
  const toward = partner.motion.x < player.motion.x ? -1 : 1;
  const distance = Math.abs(partner.motion.x - player.motion.x);
  if (action !== LessonAction.ledge && player.ledge.state === LedgeState.hang) return row({ pressed: side(-player.ledge.side), released: side(-player.ledge.side) });
  switch (action) {
    case LessonAction.dash: {
      // A full stick flick from neutral, each way in turn.
      const direction = floorMod(frame, 80) < 40 ? 1 : -1;
      if (floorMod(frame, 40) >= 12) return NEUTRAL;
      return row({ held: side(direction), pressed: floorMod(frame, 40) === 0 ? side(direction) : 0, axisX: direction * 127 });
    }
    case LessonAction.doubleJump: {
      const at = floorMod(frame, 60);
      return row({ held: at < 30 ? bit(Action.jump) : 0, pressed: at === 0 || at === 20 ? bit(Action.jump) : 0, released: at === 19 || at === 30 ? bit(Action.jump) : 0 });
    }
    case LessonAction.hit:
      if (distance > 40.0) return walk(toward);
      return floorMod(frame, 30) === 0 ? row({ pressed: bit(Action.attack), released: bit(Action.attack) }) : NEUTRAL;
    case LessonAction.special:
      return floorMod(frame, 90) === 0 ? row({ pressed: bit(Action.special), released: bit(Action.special) }) : NEUTRAL;
    case LessonAction.dodge: {
      // Shield held, rolling one way then the other every second.
      const at = floorMod(frame, 60);
      if (at === 59) return row({ released: SHIELD });
      const direction = floorMod(frame, 120) < 60 ? -1 : 1;
      const roll = at === 30 ? side(direction) : 0;
      return row({ held: SHIELD | roll, pressed: (at === 0 ? SHIELD : 0) | roll, axisX: roll === 0 ? 0 : direction * 127 });
    }
    case LessonAction.throw:
      if (player.grab.target !== undefined) return floorMod(frame, 10) === 0 ? row({ pressed: side(toward), released: side(toward) }) : NEUTRAL;
      // A grab reaches where the player faces: turn first. Stop short of the partner's body, which a
      // walk pushes (#338) and could shove off the edge; the grab box still reaches it (#337).
      if (distance > 60.0 || player.facing !== toward) return walk(toward);
      return floorMod(frame, 20) === 0 ? row({ pressed: bit(Action.grab), released: bit(Action.grab) }) : NEUTRAL;
    case LessonAction.ledge: {
      // Walk to the left edge, face the stage, jump backward off it, drift back onto the ledge, jumping again if low.
      const edge = mainDeckLeft(TUTORIAL_STAGE);
      if (player.ledge.state === LedgeState.hang) return floorMod(frame, 10) === 0 ? row({ pressed: RIGHT, released: RIGHT }) : NEUTRAL;
      if (player.ledge.state !== LedgeState.none) return NEUTRAL;
      if (player.motion.grounded && player.motion.x > edge + 60.0) return walk(-1);
      if (player.motion.grounded && player.facing < 0) return walk(1);
      if (player.motion.grounded) return row({ pressed: bit(Action.jump), released: bit(Action.jump) });
      const drift = player.motion.x > edge - 60.0 && player.motion.z > -40.0 ? -1 : 1;
      const jump = player.motion.z < -150.0 && player.motion.vz < 0 && player.jump.remaining > 0 && floorMod(frame, 4) === 0;
      return row({ held: side(drift), pressed: jump ? bit(Action.jump) : 0, released: jump ? bit(Action.jump) : 0, axisX: drift * 127 });
    }
    case LessonAction.knockout: {
      // The ledge lesson ends on the ledge: climb up first.
      if (player.ledge.state === LedgeState.hang) return floorMod(frame, 10) === 0 ? row({ pressed: RIGHT, released: RIGHT }) : NEUTRAL;
      if (player.ledge.state !== LedgeState.none) return NEUTRAL;
      if (distance > 40.0) return walk(toward);
      const smash = toward < 0 ? bit(Action.smashLeft) : bit(Action.smashRight);
      return floorMod(frame, 60) === 0 ? row({ pressed: smash, released: smash }) : NEUTRAL;
    }
  }
}

sweep("the whole tutorial plays through on one client from the menu's Start button, every lesson passing, and leaving returns to fighter selection in Training [spec #306]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0]);
  const client = clients.client(0);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  const read = <T>(body: () => T) => value(client, body);
  helpers.rows = (slot, frame) => slot !== 0 ? NEUTRAL : read(() => {
    const { game, world } = shell();
    const info = LESSONS[game.trainer.lesson];
    if (game.phase !== Phase.match || info === undefined || game.trainer.lessonCheer > 0) return NEUTRAL;
    const partnerSlot = [1, 2, 3].find(other => isActive(world, other));
    if (partnerSlot === undefined) return NEUTRAL;
    return pad(info.action, frame, fighterAt(world, 0), fighterAt(world, partnerSlot));
  });
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const until = (what: string, done: () => boolean, n: number) => {
    for (let i = 0; i < n && !done(); i++) frames(1);
    expect(done(), what).toBe(true);
  };
  clients.start();
  frames(30);
  // A fresh profile: the tutorial menu is open by itself on fighter selection.
  expect(shows(client, "Start tutorial")).toBe(true);
  expect(clients.click(0, START_BUTTON.x, START_BUTTON.y)).toBe(true);
  until("the tutorial's match", () => read(() => shell().game.phase) === Phase.match, 600);
  const seen: string[] = [];
  for (let lesson = 0; lesson < LESSONS.length; lesson++) {
    until(`lesson ${lesson + 1} starts`, () => read(() => shell().game.trainer.lesson) === lesson, 300);
    seen.push(read(() => tutorialText(shell().game.trainer)).split("\n")[0] ?? "");
    until(`lesson ${lesson + 1}, ${LESSONS[lesson]?.name}, passes`, () => read(() => shell().game.trainer.lesson !== lesson || shell().game.trainer.lessonCheer > 0), 3000);
    console.log(`lesson ${lesson + 1} passed by match frame ${read(() => shell().runtime.simulationFrame)}`);
  }
  until("the tutorial finishes", () => read(() => tutorialFinished(shell().game.trainer)), 300);
  frames(2);
  expect(shows(client, "Tutorial complete!")).toBe(true);
  expect(seen).toEqual(LESSONS.map((info, index) => `Lesson ${index + 1} of ${LESSONS.length}: ${info.name}`));
  helpers.pressStart(0);
  until("paused", () => read(() => shell().session.paused), 120);
  clients.press(0, Key.escape);
  until("fighter selection", () => read(() => shell().game.phase) === Phase.characterMenu, 300);
  expect(read(() => [shell().game.training, shell().game.trainer.lesson])).toEqual([true, -1]);
  expect(client.errors).toEqual([]);
}, 120_000);
