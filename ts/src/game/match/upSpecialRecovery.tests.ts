






import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
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
import { RECOVERY_BANDS, recoveryArchetype, upSpecialRoute } from "./recoveryEnvelope";
import { testMatch } from "./testMatch";
import { sweep } from "../../runtime/sweep";

const CHARGED_ANGLE: readonly Character[] = [Character.rifleman, Character.warden, Character.blademaster, Character.mountainKing, Character.shadowHunter, Character.kaelthas];


const check = (ok: boolean, label: string): void => assertEquals(ok ? "" : label, "");

const START_X = 700.0;
const START_Z = 300.0;


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


function offstage(character: Character, mana: number): ReturnType<typeof testMatch> {
  const match = testMatch(3, character);
  match.game.stageChoice = 0;
  const fighter = createFighter(character, START_X, 1);
  match.world.fighters[0] = fighter;
  match.world.fighters[1] = createFighter(Character.rifleman, -400.0, 1);
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

test("Anubarak's ordinary eruption stays in the heavy recovery band with zero or full meter [k3 measure #252]", () => {
  const band = assertDefined(RECOVERY_BANDS[recoveryArchetype(Character.anubarak)], "band");
  const full = upSpecialRoute(Character.anubarak, 100);
  check(full.rise >= band.riseMin && full.rise <= band.riseMax, `Anubarak rise ${full.rise}`);
  check(full.reach >= band.reachMin && full.reach <= band.reachMax, `Anubarak reach ${full.reach}`);
  const free = upSpecialRoute(Character.anubarak, 0);
  assertEquals(free.rise, full.rise, "zero/full meter rise");
  assertEquals(free.reach, full.reach, "zero/full meter reach");
});

sweep("every fighter's full up special recovers within its archetype's band equally at zero and full meter [k3 measure #252]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const band = assertDefined(RECOVERY_BANDS[recoveryArchetype(character)], "band");
    const name = `${fighterName(character)} (${band.name})`;
    const full = upSpecialRoute(character, 100);
    check(full.rise >= band.riseMin && full.rise <= band.riseMax, `${name} rise ${full.rise}`);
    check(full.reach >= band.reachMin && full.reach <= band.reachMax, `${name} reach ${full.reach}`);
    const free = upSpecialRoute(character, 0);
    check(free.rise === full.rise && free.reach === full.reach, `${name} zero meter ${free.rise}/${free.reach}, full ${full.rise}/${full.reach}`);
  }
});


function launchStep(driver: Driver, aimX: number, aimZ: number): { x: number; z: number } {
  const { fighter } = driver;
  driver.play({ x: 0, z: 1, special: true });
  let best = { x: 0.0, z: 0.0 };
  let previousX = fighter.motion.x;
  let previousZ = fighter.motion.z;
  for (let frame = 2; frame <= 60; frame++) {
    driver.play(frame <= 10 ? { x: aimX, z: aimZ } : { x: 0, z: 0 });
    const x = fighter.motion.x - previousX;
    const z = fighter.motion.z - previousZ;
    if (x * x + z * z > 225.0) return { x, z };
    previousX = fighter.motion.x;
    previousZ = fighter.motion.z;
  }
  return best;
}


const component = (value: number, length: number): number => (Math.abs(value) < 0.25 * length ? 0 : value < 0 ? -1 : 1);

test("a charged-angle up special flies any of eight directions held in its startup, with keys or a stick [k3 measure #189]", () => {
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

test("a guided up special steers toward the held side while it travels, with keys or a stick [k3 measure #189]", () => {
  const H = HERO_REFERENCE_HEIGHT;
  for (const character of SELECTABLE_CHARACTERS) {
    if (CHARGED_ANGLE.includes(character)) continue;
    for (const driver of DRIVERS) {
      const endX = (side: number) => {
        const run = driver(character, 100);
        for (let frame = 1; frame <= 40; frame++) run.play(frame === 1 ? { x: 0, z: 1, special: true } : { x: side, z: 1 });
        return run.fighter.motion.x;
      };
      const right = endX(1);
      const left = endX(-1);
      const label = `${fighterName(character)} ${driver === stickDriver ? "stick" : "keys"}`;
      check(right - left > 0.5 * H, `${label} steered ${right - left}`);
      check(left < START_X + 0.5 * H, `${label} back ${left}`);
    }
  }
});
