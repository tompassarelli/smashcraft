// The spike census (#168) in headless clients of the playable build, for
// `bun wisp perf census` in 32-bit Lua: one player's fighter in a training
// match against a standing partner on the Sky Deck plays each of its moves
// from close range, and a fighter standing on each stage measures its
// hazards. Before every move both fighters go back to the start (training's
// reset), the player dashes in and stands, and those standing frames are the
// move's baseline. Each entry prints a `census` line naming its baseline and
// move frames; scripts/wisp/perfCensus.ts reads them beside the frames'
// samples. Plain TypeScript and Warcraft natives, so it compiles to Lua.
import type { Lockstep } from "wisp/src/headless/lockstep";
import type { PerfMeasure } from "wisp/src/headless/luaPerf";
import { Phase, type MatchState } from "../../src/game/match/rules";
import { Character } from "../../src/game/sim/codes";
import { canAttack } from "../../src/game/sim/conditions";
import type { Roster } from "../../src/game/sim/roster";
import { fighterAt } from "../../src/game/sim/roster";
import { PartnerBehaviour } from "../../src/game/match/trainingState";

/** Lua's print: the census lines go to the program's output beside the frame samples. */
declare function print(this: void, ...values: unknown[]): void;

/** The standard key layout (src/game/input/keyBindings.ts). */
const KEY = {
  left: 0x57, right: 0x52, down: 0x45, up: 0x20, jump: 0x49, attack: 0x4e, special: 0x55, grab: 0x4f,
  shieldLeft: 0x51, shieldRight: 0x37, cLeft: 0x42, cRight: 0x4d, cUp: 0x4a, cDown: 0x48, walk: 0x50,
} as const;

/** A key event `at` frames after the move starts: a tap presses and releases before that frame. */
type KeyStep = readonly [at: number, key: number, kind: "tap" | "down" | "up"];

interface CensusMove {
  readonly name: string;
  readonly keys: readonly KeyStep[];
}

const tap = (at: number, key: number): KeyStep => [at, key, "tap"];
const hold = (from: number, to: number, ...keys: number[]): KeyStep[] => [...keys.map((key): KeyStep => [from, key, "down"]), ...keys.map((key): KeyStep => [to, key, "up"])];
const JUMP_LEAD = 6;

/** A special in a direction (undefined: neutral), on the ground or after a jump, with what follows it. */
function special(name: string, direction: number | undefined, air: boolean, follow: readonly KeyStep[] = []): CensusMove {
  const at = air ? JUMP_LEAD : 0;
  const lead = air ? [tap(0, KEY.jump)] : [];
  const press = direction === undefined ? [tap(at, KEY.special)] : [...hold(at, at + 2, direction), tap(at + 1, KEY.special)];
  return { name: `${air ? "air " : ""}${name}`, keys: [...lead, ...press, ...follow.map(([offset, key, kind]): KeyStep => [at + offset, key, kind])] };
}

const SPECIALS: readonly (readonly [string, number | undefined])[] = [["neutral special", undefined], ["side special", KEY.right], ["up special", KEY.up], ["down special", KEY.down]];

/** Every move a player can start from standing near the partner, facing it (the partner is to the right). */
export const CENSUS_MOVES: readonly CensusMove[] = [
  { name: "jab", keys: [tap(0, KEY.attack)] },
  { name: "jab chain", keys: [tap(0, KEY.attack), tap(8, KEY.attack), tap(16, KEY.attack)] },
  { name: "forward tilt", keys: [...hold(0, 3, KEY.walk, KEY.right), tap(2, KEY.attack)] },
  { name: "up tilt", keys: [...hold(0, 3, KEY.walk, KEY.up), tap(2, KEY.attack)] },
  { name: "down tilt", keys: [...hold(0, 3, KEY.walk, KEY.down), tap(2, KEY.attack)] },
  { name: "forward smash", keys: [tap(0, KEY.cRight)] },
  { name: "up smash", keys: [tap(0, KEY.cUp)] },
  { name: "down smash", keys: [tap(0, KEY.cDown)] },
  { name: "dash attack", keys: [...hold(0, 11, KEY.right), tap(10, KEY.attack)] },
  { name: "neutral air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.attack)] },
  { name: "forward air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.cRight)] },
  { name: "back air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.cLeft)] },
  { name: "up air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.cUp)] },
  { name: "down air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.cDown)] },
  { name: "grab", keys: [tap(0, KEY.grab)] },
  { name: "pummel", keys: [tap(0, KEY.grab), tap(12, KEY.attack)] },
  { name: "forward throw", keys: [tap(0, KEY.grab), tap(12, KEY.right)] },
  { name: "back throw", keys: [tap(0, KEY.grab), tap(12, KEY.left)] },
  { name: "up throw", keys: [tap(0, KEY.grab), tap(12, KEY.up)] },
  { name: "down throw", keys: [tap(0, KEY.grab), tap(12, KEY.down)] },
  ...SPECIALS.flatMap(([name, direction]) => [false, true].flatMap((air) => [
    special(name, direction, air),
    special(`${name}, again`, direction, air, direction === undefined ? [tap(20, KEY.special)] : [...hold(20, 22, direction), tap(21, KEY.special)]),
  ])),
  special("side special, then attack", KEY.right, false, [tap(12, KEY.attack)]),
  special("up special, then jump", KEY.up, false, [tap(25, KEY.jump)]),
  special("up special, then attack", KEY.up, false, [tap(25, KEY.attack)]),
];

/** Frames measured from a move's first key: long enough for its projectiles, summons and the partner's landing. */
const MOVE_FRAMES = 150;
/** Standing frames before a move: its baseline. */
const BASELINE_FRAMES = 30;
/** The player stops dashing this close to the partner. */
const NEAR = 140;
/** Frames a stage's hazards are watched: Nordrassil's gusts and the moving decks repeat within it. */
const STAGE_FRAMES = 1200;
/** The Sky Deck: one platform, no hazards. */
export const CENSUS_STAGE = 0;
/** The partner every fighter's moves land on, and the fighter that watches each stage. */
const PARTNER = Character.archer;

interface Shell {
  readonly game: MatchState;
  readonly world: Roster;
}

const isShell = (value: unknown): value is Shell => typeof value === "object" && value !== null && "game" in value && "world" in value;

function shellOf(clients: Lockstep): Shell {
  const shell = clients.client(0).natives.__smashcraftShell;
  if (!isShell(shell)) throw new Error("p0 has no shell");
  return shell;
}

function keyEvent(clients: Lockstep, key: number, down: boolean): void {
  for (const client of clients.clients) client.key(0, key, 0, down);
}

/** Starts a training match of `fighter` against a standing partner on `stage`, its frames counted from the first. */
function startTraining(clients: Lockstep, measure: PerfMeasure, fighter: Character, stage: number): void {
  const until = (what: string, done: () => boolean) => {
    for (let index = 0; index < 120 && !done(); index++) clients.frames(1);
    if (!done()) throw new Error(`${what} not reached`);
  };
  clients.start();
  clients.frames(30);
  clients.press(0, KEY.right);
  clients.frames(5);
  for (const client of clients.clients) {
    const shell = client.natives.__smashcraftShell;
    if (!isShell(shell)) throw new Error(`p${client.slot} has no shell`);
    const game = shell.game;
    game.characterChoices[0] = fighter;
    game.characterReadiness[0] = true;
    game.computerMask |= 1 << 1;
    game.characterChoices[1] = PARTNER;
    game.characterReadiness[1] = true;
    game.training = true;
    game.trainer.behaviour = PartnerBehaviour.stand;
  }
  clients.press(0, 0x59);
  until("stage selection", () => shellOf(clients).game.phase === Phase.stageMenu);
  for (const client of clients.clients) {
    const shell = client.natives.__smashcraftShell;
    if (!isShell(shell)) throw new Error(`p${client.slot} has no shell`);
    shell.game.stageChoice = stage;
  }
  clients.press(0, 0x59);
  until("the match", () => shellOf(clients).game.phase === Phase.match);
  if (shellOf(clients).game.stageChoice !== stage) throw new Error(`the census did not start on stage ${stage}`);
  measure.begin();
}

/** Training's reset: both shields held as attack is pressed. */
function reset(clients: Lockstep): void {
  keyEvent(clients, KEY.shieldLeft, true);
  keyEvent(clients, KEY.shieldRight, true);
  clients.frames(1);
  clients.press(0, KEY.attack);
  clients.frames(1);
  keyEvent(clients, KEY.shieldLeft, false);
  keyEvent(clients, KEY.shieldRight, false);
}

/** Back to the start, dash toward the partner, stand: returns the standing frames' first and last. */
function approach(clients: Lockstep): readonly [number, number] {
  reset(clients);
  clients.frames(20);
  const gap = () => {
    const { world } = shellOf(clients);
    return fighterAt(world, 1).motion.x - fighterAt(world, 0).motion.x;
  };
  keyEvent(clients, KEY.right, true);
  for (let index = 0; index < 120 && gap() > NEAR; index++) clients.frames(1);
  keyEvent(clients, KEY.right, false);
  for (let index = 0; index < 60 && !canAttack(fighterAt(shellOf(clients).world, 0)); index++) clients.frames(1);
  clients.frames(20);
  const first = clients.frame + 1;
  clients.frames(BASELINE_FRAMES);
  return [first, clients.frame];
}

function playMove(clients: Lockstep, move: CensusMove): readonly [number, number] {
  const first = clients.frame + 1;
  for (let at = 0; at < MOVE_FRAMES; at++) {
    for (const [when, key, kind] of move.keys) {
      if (when !== at) continue;
      if (kind === "tap") clients.press(0, key);
      else keyEvent(clients, key, kind === "down");
    }
    clients.frames(1);
  }
  return [first, clients.frame];
}

function problemsOf(clients: Lockstep): { problems: number; lines: string[] } {
  const lines: string[] = [];
  for (const client of clients.clients) for (const error of client.errors) lines.push(`p${client.slot}: ${error}`);
  return { problems: lines.length, lines };
}

/** Every census move of `fighter`, each after its own standing baseline. */
export function playFighterCensus(clients: Lockstep, measure: PerfMeasure, fighter: Character, label: string): { problems: number; lines: string[] } {
  startTraining(clients, measure, fighter, CENSUS_STAGE);
  for (const move of CENSUS_MOVES) {
    const [baseFirst, baseLast] = approach(clients);
    const [moveFirst, moveLast] = playMove(clients, move);
    print(`census\t${label}\t${move.name}\t${baseFirst}\t${baseLast}\t${moveFirst}\t${moveLast}`);
  }
  return problemsOf(clients);
}

/** A fighter standing on `stage` for STAGE_FRAMES: its hazards against the stage's own median frame. */
export function playStageCensus(clients: Lockstep, measure: PerfMeasure, stage: number, label: string): { problems: number; lines: string[] } {
  startTraining(clients, measure, PARTNER, stage);
  clients.frames(60);
  const first = clients.frame + 1;
  clients.frames(STAGE_FRAMES);
  print(`census\tstage\t${label}\t${first}\t${clients.frame}\t${first}\t${clients.frame}`);
  return problemsOf(clients);
}
