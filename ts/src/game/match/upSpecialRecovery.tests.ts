// Up specials (#189, smashcraft:docs/gameplay-design.md, "Up specials"):
// every selectable fighter's up special recovers within the roster band, and
// both control styles answer keyboard keys and a controller stick through the
// real input path (a helper journal for the stick, the keyboard sampler for
// keys): a charged-angle up special flies any of eight directions picked in
// its startup, and a guided one steers while it travels.
import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, bit } from "../input/actions";
import { copyInput } from "../input/inputRow";
import { type KeyboardCapture, commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";
import { participantInputs } from "../input/participants";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { HERO_REFERENCE_HEIGHT } from "../sim/heroMoves";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { captureNetworkFrame, executeMatchFrame } from "./frameInput";
import { type PadMatch, padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

/** The documented band, world units from where the up special starts. */
const VERTICAL_MIN = 320.0;
const VERTICAL_MAX = 480.0;
const HORIZONTAL_MIN = 320.0;
const HORIZONTAL_MAX = 900.0;
/** The zero-mana form's floor on both axes. */
const FREE_MIN = 200.0;
/** Height a fighter may sink below its start and still count as level with it. */
const LEVEL_TOLERANCE = 10.0;

const CHARGED_ANGLE: readonly Character[] = [Character.rifleman, Character.warden, Character.blademaster, Character.mountainKing, Character.shadowHunter];

/** Fails naming `label` when `ok` is false. */
const check = (ok: boolean, label: string): void => assertEquals(ok ? "" : label, "");

const START_X = 700.0;
const START_Z = 300.0;

/** One frame's controls: a stick in [-1, 1] (keys hold its signs), the special and jump buttons. */
interface Hold {
  readonly x: number;
  readonly z: number;
  readonly special?: boolean;
  readonly jump?: boolean;
}

interface Driver {
  readonly name: string;
  readonly play: (hold: Hold) => void;
  readonly fighter: Fighter;
}

/** The fighter airborne at rest beside the stage's right ledge, facing away from it, its jumps spent. */
function offstage(character: Character, mana: number): ReturnType<typeof testMatch> {
  const match = testMatch(3, character);
  match.game.stageChoice = 0;
  const fighter = createFighter(character, START_X, 1);
  match.world.fighters[0] = fighter;
  match.world.fighters[1] = createFighter(Character.archer, -400.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  fighter.motion.z = START_Z;
  fighter.jump.remaining = 0;
  fighter.mana.points = mana;
  return match;
}

function stickDriver(character: Character, mana: number): Driver {
  const match = offstage(character, mana);
  const run: PadMatch = padMatch(match, "up-special");
  return {
    name: "stick",
    fighter: assertDefined(match.world.fighters[0], "fighter"),
    play: (hold) => playPads(run, { x: hold.x, y: hold.jump === true ? 1 : hold.z, special: hold.special === true }, {}),
  };
}

function keysDriver(character: Character, mana: number): Driver {
  const match = offstage(character, mana);
  const capture: KeyboardCapture = keyboardCapture();
  const rows = participantInputs();
  return {
    name: "keys",
    fighter: assertDefined(match.world.fighters[0], "fighter"),
    play: (hold) => {
      let held = 0;
      if (hold.x < 0) held |= bit(Action.moveLeft);
      if (hold.x > 0) held |= bit(Action.moveRight);
      if (hold.z < 0) held |= bit(Action.moveDown);
      if (hold.z > 0) held |= bit(Action.moveUp);
      if (hold.special === true) held |= bit(Action.special);
      if (hold.jump === true) held |= bit(Action.jump);
      assertTrue(sampleKeys(capture, held));
      const frame = match.runtime.simulationFrame + 1;
      copyInput(rows[0], capture.row);
      assertTrue(captureNetworkFrame(match.row, frame, rows, match.world, 3));
      assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, frame));
      commitEdges(capture);
    },
  };
}

const DRIVERS = [stickDriver, keysDriver] as const;

/** Presses up special with the stick up, then holds `hold(frame)`; the highest rise and farthest level reach. */
function recover(driver: Driver, hold: (frame: number) => Hold): { rise: number; reach: number } {
  const { fighter } = driver;
  let rise = 0.0;
  let reach = 0.0;
  driver.play({ x: 0, z: 1, special: true });
  for (let frame = 2; frame <= 300 && !fighter.motion.grounded && !fighter.status.out; frame++) {
    driver.play(hold(frame));
    const height = fighter.motion.z - START_Z;
    rise = Math.max(rise, height);
    if (height >= -LEVEL_TOLERANCE) reach = Math.max(reach, fighter.motion.x - START_X);
  }
  return { rise, reach };
}

const UP: Hold = { x: 0, z: 1 };
const AWAY_UP: Hold = { x: 1, z: 1 };
const AWAY: Hold = { x: 1, z: 0 };

/** Vertical: up held throughout. Horizontal: the farthest of the ordinary returns, a glide jump included. */
function band(character: Character, mana: number): { vertical: number; horizontal: number } {
  const vertical = recover(stickDriver(character, mana), () => UP).rise;
  const plans: ((frame: number) => Hold)[] = [
    () => AWAY_UP,
    () => AWAY,
    (frame) => frame === 20 ? { ...AWAY, jump: true } : AWAY,
  ];
  let horizontal = 0.0;
  for (const plan of plans) horizontal = Math.max(horizontal, recover(stickDriver(character, mana), plan).reach);
  return { vertical, horizontal };
}

test("every fighter's up special recovers within the documented band, and its zero-mana form above the floor", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const full = band(character, 100);
    const name = fighterName(character);
    check(full.vertical >= VERTICAL_MIN && full.vertical <= VERTICAL_MAX, `${name} vertical ${full.vertical}`);
    check(full.horizontal >= HORIZONTAL_MIN && full.horizontal <= HORIZONTAL_MAX, `${name} horizontal ${full.horizontal}`);
    const free = band(character, 0);
    check(free.vertical >= FREE_MIN && free.horizontal >= FREE_MIN, `${name} free ${free.vertical} ${free.horizontal}`);
  }
});

/** The largest single-frame step after the press: the direction the up special flew. */
function launchStep(driver: Driver, aimX: number, aimZ: number): { x: number; z: number } {
  const { fighter } = driver;
  driver.play({ x: 0, z: 1, special: true });
  let best = { x: 0.0, z: 0.0 };
  let previousX = fighter.motion.x;
  let previousZ = fighter.motion.z;
  for (let frame = 2; frame <= 24; frame++) {
    driver.play(frame <= 10 ? { x: aimX, z: aimZ } : { x: 0, z: 0 });
    const x = fighter.motion.x - previousX;
    const z = fighter.motion.z - previousZ;
    if (x * x + z * z > best.x * best.x + best.z * best.z) best = { x, z };
    previousX = fighter.motion.x;
    previousZ = fighter.motion.z;
  }
  return best;
}

/** -1, 0 or 1: a component under a quarter of the step counts as none. */
const component = (value: number, length: number): number => (Math.abs(value) < 0.25 * length ? 0 : value < 0 ? -1 : 1);

test("a charged-angle up special flies any of eight directions held in its startup, with keys or a stick", () => {
  for (const character of CHARGED_ANGLE) {
    for (const driver of DRIVERS) {
      for (let aimX = -1; aimX <= 1; aimX++) {
        for (let aimZ = -1; aimZ <= 1; aimZ++) {
          if (aimX === 0 && aimZ === 0) continue;
          const run = driver(character, 100);
          const step = launchStep(run, aimX, aimZ);
          const length = Math.sqrt(step.x * step.x + step.z * step.z);
          const label = `${fighterName(character)} ${run.name} ${aimX},${aimZ}`;
          check(length > 15.0, label);
          check(component(step.x, length) === aimX && component(step.z, length) === aimZ, `${label} flew ${step.x},${step.z}`);
        }
      }
    }
  }
});

test("a stick a little off a direction still picks that direction's aim", () => {
  for (const character of CHARGED_ANGLE) {
    // About 17 degrees above level and 17 degrees off vertical.
    for (const [x, z, aimX, aimZ] of [[0.95, 0.3, 1, 0], [0.3, 0.95, 0, 1], [0.95, -0.3, 1, 0]] as const) {
      const step = launchStep(stickDriver(character, 100), x, z);
      const length = Math.sqrt(step.x * step.x + step.z * step.z);
      check(component(step.x, length) === aimX && component(step.z, length) === aimZ, `${fighterName(character)} ${x},${z} flew ${step.x},${step.z}`);
    }
  }
});

test("a guided up special steers toward the held side while it travels, with keys or a stick", () => {
  const H = HERO_REFERENCE_HEIGHT;
  for (const character of SELECTABLE_CHARACTERS) {
    if (CHARGED_ANGLE.includes(character)) continue;
    for (const driver of DRIVERS) {
      const endX = (side: number) => {
        const run = driver(character, 100);
        for (let frame = 1; frame <= 40; frame++) run.play(frame === 1 ? { x: 0, z: 1, special: true } : { x: side, z: 1 });
        return run.fighter.motion.x;
      };
      const label = `${fighterName(character)} ${driver(character, 100).name}`;
      check(endX(1) - endX(-1) > 0.5 * H, `${label} steered ${endX(1) - endX(-1)}`);
      check(endX(-1) < START_X + 0.5 * H, `${label} back ${endX(-1)}`);
    }
  }
});
