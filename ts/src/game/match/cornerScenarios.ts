// Seeded corner situations (#386): one computer starts cornered at a stage
// edge, the other at mid-stage, both at the same identity and tier. The
// measurements read only simulation state, so the same seeds measure any
// computer: how often a fighter edge-cancels a lag it began by the ledge the
// opponent stands at, and how long the cornered fighter stays in the band.
export { CORNER_BAND } from "./botCorner";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackPhase } from "../sim/codes";
import { attackPhase } from "../sim/conditions";
import { type Fighter, createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight } from "../sim/stage";
import { CORNER_BAND, insideLip } from "./botCorner";
import { produceComputerInput } from "./botPlay";
import { createFrameControls } from "./controls";
import type { CpuOpponentId, CpuTier } from "./cpuProfiles";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";

const STAGE = 0;
/** A lag begun this close to the lip can slide off it. */
export const NEAR_LIP = 90.0;
/** How far past the lip an opponent still counts as at the ledge. */
const PAST_LIP = 200.0;
export const CORNER_START = 40.0;
const ATTACKER_START = 300.0;
export const CORNER_FRAMES = 240;
const NEUTRAL = neutralControls();

const lipSide = (x: number): number => (x < 0.0 ? -1 : 1);

export interface CornerOutcome {
  /** Lags begun on the main deck within NEAR_LIP of the lip whose ledge the opponent is at. */
  readonly eligible: number;
  /** Of those, the lags that ended by sliding off the lip with lag left. */
  readonly cancelled: number;
  /** Frames the cornered fighter stayed inside CORNER_BAND before reaching the centre side, or CORNER_FRAMES. */
  readonly cornered: number;
}

export const inLag = (f: Readonly<Fighter>): boolean => f.landing.lag > 0 || attackPhase(f) === AttackPhase.recovery;

/** Situation `seed`: identities and side vary with the seed; slot 0 starts cornered. */
export function playCorner(seed: number, opponent: CpuOpponentId, tier: CpuTier): CornerOutcome {
  const side = floorMod(seed, 2) === 0 ? 1 : -1;
  const lip = side > 0 ? mainDeckRight(STAGE) : mainDeckLeft(STAGE);
  const cornered = at(SELECTABLE_CHARACTERS, floorMod(seed * 7 + 3, SELECTABLE_CHARACTERS.length));
  const attacker = at(SELECTABLE_CHARACTERS, floorMod(seed, SELECTABLE_CHARACTERS.length));
  const world = createRoster(3, [
    createFighter(cornered, f32(lip - f32(side * CORNER_START)), -side),
    createFighter(attacker, f32(lip - f32(side * ATTACKER_START)), side),
  ]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = STAGE;
  match.timeLimitMinutes = 0;
  match.matchSeed = seed;
  for (const slot of PARTICIPANT_SLOTS) {
    match.cpuOpponents[slot] = opponent;
    match.cpuResolvedOpponents[slot] = opponent;
    match.cpuTiers[slot] = tier;
  }
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const open = [false, false];
  const wasGrounded = [true, true];
  const wasLagging = [false, false];
  let eligible = 0;
  let cancelled = 0;
  let escaped = -1;
  const stocks = fighterAt(world, 0).status.stocks;
  for (let frame = 1; frame <= CORNER_FRAMES; frame++) {
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
    }
    if (!captureFrame(row, frame, world.mask, produced, runtime) || !executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error("corner frame rejected");
    for (const slot of [0, 1]) {
      const f = fighterAt(world, slot);
      const other = fighterAt(world, 1 - slot);
      const lagging = inLag(f);
      const { motion } = f;
      // An approach or a landing: a lag begun on touching down or while moving, not a standing poke.
      if (motion.grounded && lagging && !wasLagging[slot] && motion.surface === 0 && (!wasGrounded[slot] || motion.deltaX !== 0.0)) {
        const inside = insideLip(STAGE, motion.x);
        const otherInside = insideLip(STAGE, other.motion.x);
        if (inside <= NEAR_LIP && lipSide(other.motion.x) === lipSide(motion.x) && otherInside <= CORNER_BAND && otherInside >= -PAST_LIP) {
          open[slot] = true;
          eligible++;
        }
      }
      if (open[slot]) {
        if (wasGrounded[slot] && !motion.grounded && wasLagging[slot] && !lagging && f.launch.hitstun <= 0 && !f.special.fall) {
          cancelled++;
          open[slot] = false;
        } else if (!lagging || f.launch.hitstun > 0) open[slot] = false;
      }
      wasGrounded[slot] = motion.grounded;
      wasLagging[slot] = lagging;
    }
    const held = fighterAt(world, 0);
    if (escaped < 0 && (held.status.out || held.status.stocks < stocks)) escaped = CORNER_FRAMES;
    if (escaped < 0 && insideLip(STAGE, held.motion.x) > CORNER_BAND) escaped = frame;
  }
  return { eligible, cancelled, cornered: escaped < 0 ? CORNER_FRAMES : escaped };
}

export interface CornerTally {
  readonly situations: number;
  readonly eligible: number;
  readonly cancelled: number;
  readonly medianCornered: number;
}

export function tallyCorners(first: number, count: number, opponent: CpuOpponentId, tier: CpuTier): CornerTally {
  let eligible = 0;
  let cancelled = 0;
  const cornered: number[] = [];
  for (let seed = first; seed < first + count; seed++) {
    const outcome = playCorner(seed, opponent, tier);
    eligible += outcome.eligible;
    cancelled += outcome.cancelled;
    cornered.push(outcome.cornered);
  }
  cornered.sort((a, b) => a - b);
  return { situations: count, eligible, cancelled, medianCornered: at(cornered, floorDiv(count - 1, 2)) };
}
