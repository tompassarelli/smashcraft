// Headless scenes played through the match frame executor from controller
// rows, as a pad reports them. The Melee oracle (meleeOracle.ts) and the
// interaction graph (interactions.ts) share it, so both measure the frame
// order, input buffers and contacts that a match runs.
import { Action, has } from "../src/game/input/actions";
import { type InputRow, emptyInput } from "../src/game/input/inputRow";
import { type ParticipantInputs, participantInputs } from "../src/game/input/participants";
import { type FrameControls, createBufferedFrameControls } from "../src/game/match/controls";
import { type MatchFrameInput, captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { type PacingAndPresentation, createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { type MatchState, Phase, createMatchState, setHumanMask } from "../src/game/match/rules";
import { Character, DownState } from "../src/game/sim/codes";
import { type Fighter, createFighter } from "../src/game/sim/fighter";
import { type Roster, createRoster, fighterAt } from "../src/game/sim/roster";

export interface Scene {
  readonly world: Roster;
  readonly game: MatchState;
  readonly controls: FrameControls;
  readonly runtime: PacingAndPresentation;
  readonly row: MatchFrameInput;
  readonly source: ParticipantInputs;
  readonly previous: number[];
}

export interface Placement {
  readonly character: Character;
  readonly x: number;
  readonly facing: number;
}

/** A match on `stage` with the given fighters in slots 0.., every slot a human playing from controller rows with a live match's attack buffer. */
export function scene(stage: number, placements: readonly Placement[]): Scene {
  const mask = (1 << placements.length) - 1;
  const world = createRoster(mask, placements.map(({ character, x, facing }) => createFighter(character, x, facing)));
  const game = createMatchState();
  setHumanMask(game, mask);
  game.phase = Phase.match;
  game.timeLimitMinutes = 0;
  game.stageChoice = stage;
  return {
    world, game, controls: createBufferedFrameControls(), runtime: createPacingAndPresentation(), row: createMatchFrameInput(),
    source: participantInputs(), previous: placements.map(() => 0),
  };
}

/** One fighter in slot 0 and an idle Rifleman across the stage, since a match with one fighter left is over. */
export const solo = (stage: number, character: Character, x = 0.0, facing = 1): Scene =>
  scene(stage, [{ character, x, facing }, { character: Character.rifleman, x: x < 0 ? 450.0 : -450.0, facing: -1 }]);

export const fighter = (s: Scene, slot = 0): Fighter => fighterAt(s.world, slot);

const maskOf = (actions: readonly Action[]): number => actions.reduce<number>((mask, action) => mask | (1 << action), 0);

const axis = (held: number, negative: Action, positive: Action): number => (has(held, positive) ? 127 : 0) - (has(held, negative) ? 127 : 0);

/** A controller row holding `actions`; presses and releases come from the slot's previous row, as a pad reports them. */
function padRow(target: InputRow, held: number, previous: number): void {
  const pressed = held & ~previous;
  Object.assign(target, emptyInput());
  target.held = held;
  target.pressed = pressed;
  target.released = previous & ~held;
  target.axisX = axis(held, Action.moveLeft, Action.moveRight);
  target.axisZ = axis(held, Action.moveDown, Action.moveUp);
  const sign = (value: number) => (value > 0 ? 1 : value < 0 ? -1 : 0);
  if (has(pressed, Action.leftTrigger) || has(pressed, Action.rightTrigger)) {
    target.dodgeX = sign(target.axisX);
    target.dodgeZ = sign(target.axisZ);
  }
  if (has(pressed, Action.special)) {
    target.specialX = sign(target.axisX);
    target.specialZ = sign(target.axisZ);
  }
  target.ledgeVertical = has(pressed, Action.moveUp) ? 1 : has(pressed, Action.moveDown) ? -1 : 0;
}

/** Runs one frame with each slot holding its listed actions. */
export function frame(s: Scene, ...held: (readonly Action[])[]): void {
  s.source.forEach((row, slot) => {
    if (slot >= s.previous.length) return;
    const mask = maskOf(held[slot] ?? []);
    padRow(row, mask, s.previous[slot] ?? 0);
    s.previous[slot] = mask;
  });
  const next = s.runtime.simulationFrame + 1;
  if (!captureNetworkFrame(s.row, next, s.source, s.world, s.world.mask)) throw new Error(`frame ${next} not captured`);
  if (!executeMatchFrame(s.row, s.game, s.world, s.controls, s.runtime, next)) throw new Error(`frame ${next} not executed`);
}

/** Frames run until `done`, or undefined after `limit` frames; the frame that satisfied it counts. */
export function framesUntil(s: Scene, done: () => boolean, limit: number, held: (frame: number) => readonly Action[] = () => []): number | undefined {
  for (let n = 1; n <= limit; n++) {
    frame(s, held(n));
    if (done()) return n;
  }
  return undefined;
}

export function airborne(f: Fighter, x: number, z: number): void {
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.x = x;
  f.motion.z = z;
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
}

/** Tumbling in hitstun, so a shield press techs instead of air dodging. */
export function tumbling(f: Fighter, x: number, z: number): void {
  airborne(f, x, z);
  f.down.state = DownState.tumble;
  f.launch.hitstun = 400;
}
