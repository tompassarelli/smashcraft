// Habits are learned only from delayed visible samples. A read commits to a
// forecast, so a changed habit can bait it before the new evidence arrives.
import { at } from "wisp/src/runtime/lookup";
import { floorDiv } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import type { Direction } from "../input/inputRow";
import { AttackStyle, DownState, LedgeState, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { attackStartupFrames } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { moveReachAhead, moveReaches } from "./botMoves";
import { botChance } from "./botRandom";
import { steerOnGround, slideStaysOnDeck } from "./botFooting";
import type { CpuDecisionPolicy } from "./cpuDecisionPolicy";
import { HabitChoice, habitContext } from "./botHabits";

const HISTORY_LIMIT = 128;

export interface BotHabit {
  readonly frame: number;
  readonly context: number;
  readonly choice: HabitChoice;
  readonly interval: number;
}

export interface BotRead {
  readonly choice: HabitChoice;
  readonly context: number;
  readonly expectedFrame: number;
  readonly expires: number;
  readonly confidence: number;
  acted: boolean;
  actionFrame: number;
  actionSerial: number;
  actionStyle: number;
  actionFacing: Direction;
}

export interface BotStrategy {
  history: readonly BotHabit[];
  observedFrame: number;
  opponent: number;
  lastChoice: HabitChoice;
  lastContext: number;
  lastSerial: number;
  events: number;
  read: BotRead | undefined;
  lastOption: number;
}

export function createBotStrategy(): BotStrategy {
  return { history: [], observedFrame: -1, opponent: -1, lastChoice: HabitChoice.none, lastContext: 0, lastSerial: -1, events: 0, read: undefined, lastOption: -1 };
}

export function copyBotStrategy(target: BotStrategy, source: Readonly<BotStrategy>): void {
  target.history = source.history;
  target.observedFrame = source.observedFrame;
  target.opponent = source.opponent;
  target.lastChoice = source.lastChoice;
  target.lastContext = source.lastContext;
  target.lastSerial = source.lastSerial;
  target.events = source.events;
  target.lastOption = source.lastOption;
  const read = source.read;
  target.read = read === undefined ? undefined : { ...read };
}

export function clearBotStrategy(state: BotStrategy): void {
  copyBotStrategy(state, createBotStrategy());
}

/** Dense scalar enumeration is shared by canonical/difference and periodic replay checks. */
export function botStrategyValues(state: Readonly<BotStrategy>): number[] {
  const read = state.read;
  const values = [state.observedFrame, state.opponent, state.lastChoice, state.lastContext, state.lastSerial, state.events, state.lastOption,
    read === undefined ? 0 : 1, read?.choice ?? 0, read?.context ?? 0, read?.expectedFrame ?? 0, read?.expires ?? 0, read?.confidence ?? 0, read?.acted ? 1 : 0,
    read?.actionFrame ?? -1, read?.actionSerial ?? -1, read?.actionStyle ?? -1, read?.actionFacing ?? 0, state.history.length];
  for (const habit of state.history) values.push(habit.frame, habit.context, habit.choice, habit.interval);
  return values;
}

function visibleChoice(own: Readonly<Fighter>, target: Readonly<Fighter>): HabitChoice {
  if (target.ledge.state !== LedgeState.none) return HabitChoice.ledge;
  if (target.shield.raised) return HabitChoice.shield;
  if (target.attack.style !== undefined || target.special.action !== SpecialAction.none) return HabitChoice.attack;
  if (!target.motion.grounded && target.motion.vz > 0.0) return HabitChoice.jump;
  if (!target.motion.grounded && target.motion.vz < 0.0) return HabitChoice.landing;
  const toward = target.motion.x < own.motion.x ? 1 : -1;
  const moving = f32(target.motion.deltaX * toward);
  return moving > 1.0 ? HabitChoice.approach : moving < -1.0 ? HabitChoice.retreat : HabitChoice.none;
}

/** Processes a known sample once; an opponent change starts a new bounded history. */
export function learnBotHabit(state: BotStrategy, ownObserved: Readonly<Fighter>, target: Readonly<Fighter>, opponent: number, observedFrame: number, policy: CpuDecisionPolicy): void {
  if (observedFrame <= state.observedFrame) return;
  if (opponent !== state.opponent) {
    clearBotStrategy(state);
    state.opponent = opponent;
  }
  const choice = visibleChoice(ownObserved, target);
  const context = habitContext(ownObserved, target);
  const changed = choice !== state.lastChoice || (choice === HabitChoice.attack && target.attack.serial !== state.lastSerial);
  if (changed && choice !== HabitChoice.none) {
    state.events++;
    if (floorDiv(state.events, policy.historyStride) !== floorDiv(state.events - 1, policy.historyStride)) {
      const fromContext = state.observedFrame < 0 ? context : state.lastContext;
      let previous = -1;
      for (let index = state.history.length - 1; index >= 0; index--) {
        const habit = at(state.history, index);
        if (habit.context === fromContext && habit.choice === choice) { previous = habit.frame; break; }
      }
      let kept = 0;
      const history: BotHabit[] = [];
      for (let index = state.history.length - 1; index >= 0 && history.length < HISTORY_LIMIT - 1; index--) {
        const habit = at(state.history, index);
        if (habit.context === fromContext && ++kept >= policy.historyCapacity) continue;
        history.push(habit);
      }
      history.reverse();
      history.push({ frame: observedFrame, context: fromContext, choice, interval: previous < 0 ? 0 : observedFrame - previous });
      state.history = history;
    }
  }
  state.observedFrame = observedFrame;
  state.lastChoice = choice;
  state.lastContext = context;
  state.lastSerial = target.attack.serial;
}

/** Revises an expired plan from historical evidence; a held plan does not track new inputs. */
export function prepareBotRead(state: BotStrategy, own: Readonly<Fighter>, target: Readonly<Fighter>, frame: number, delay: number, policy: CpuDecisionPolicy): void {
  if (state.read !== undefined && frame <= state.read.expires) return;
  state.read = undefined;
  const context = habitContext(own, target);
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];
  const intervals = [0, 0, 0, 0, 0, 0, 0, 0];
  const timed = [0, 0, 0, 0, 0, 0, 0, 0];
  const latest = [0, 0, 0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const habit of state.history) {
    if (habit.context !== context) continue;
    counts[habit.choice] = at(counts, habit.choice) + 1;
    if (habit.interval > 0) {
      intervals[habit.choice] = at(intervals, habit.choice) + habit.interval;
      timed[habit.choice] = at(timed, habit.choice) + 1;
    }
    latest[habit.choice] = habit.frame;
    total++;
  }
  let choice: HabitChoice = HabitChoice.none;
  for (const candidate of [HabitChoice.attack, HabitChoice.shield, HabitChoice.jump, HabitChoice.retreat, HabitChoice.approach, HabitChoice.landing, HabitChoice.ledge]) {
    if (at(counts, candidate) > at(counts, choice)) choice = candidate;
  }
  const count = at(counts, choice);
  const confidence = total === 0 ? 0 : floorDiv(count * 100, total);
  const learned = count >= policy.readEvidence && confidence >= policy.readConfidence;
  const guessed = !learned && total > 0 && botChance(floorDiv(frame, 30), own.character * 31 + state.events, policy.guessPercent, 100);
  if ((!learned && !guessed) || !botChance(floorDiv(frame, 30), own.character * 17 + state.events, Math.min(90, learned ? confidence : 35), 100)) return;
  const interval = at(timed, choice) === 0 ? 40 : Math.max(12, floorDiv(at(intervals, choice), at(timed, choice)));
  let expectedFrame = at(latest, choice) + interval;
  while (expectedFrame <= frame) expectedFrame += interval;
  if (expectedFrame > frame + 90) return;
  state.read = { choice, context, expectedFrame, expires: expectedFrame + delay + 6, confidence, acted: false, actionFrame: -1, actionSerial: -1, actionStyle: -1, actionFacing: 0 };
}

/** A prepared read may position or buffer before its expected event, and may miss. */
export function pressBotRead(state: BotStrategy, own: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, matchFrame: number, frame: number, input: Controls, commands: AttackBuffer): boolean {
  const read = state.read;
  if (read === undefined || frame > read.expires || !own.motion.grounded || own.down.state !== DownState.none || own.launch.hitstun > 0) return false;
  const ahead = read.expectedFrame - frame;
  const dx = f32(target.motion.x - own.motion.x);
  const toward = dx < 0 ? -1 : 1;
  if (read.choice === HabitChoice.attack) {
    if (ahead > 8 || ahead < -8) return false;
    input.shield = true;
    read.acted = true;
    return true;
  }
  if (read.acted) {
    if (read.actionFrame < 0 || frame - read.actionFrame > 6 || own.attack.serial !== read.actionSerial) return false;
    queueAttack(commands, { style: read.actionStyle, facing: read.actionFacing, frame: read.actionFrame, mayCharge: false });
    input.attackHeld = true;
    return true;
  }
  const style = read.choice === HabitChoice.shield ? AttackStyle.grab
    : read.choice === HabitChoice.jump || read.choice === HabitChoice.landing ? AttackStyle.upTilt : AttackStyle.forwardTilt;
  const startup = attackStartupFrames(style, own.tuning.moves);
  const reach = moveReachAhead(own.character, style, target, own.tuning.moves);
  const goal = f32(target.motion.x - f32(toward * Math.max(20.0, f32(reach - 45.0))));
  if (ahead > startup + 2) {
    if (!canAttack(own)) return false;
    steerOnGround(own, stage, goal, input);
    return true;
  }
  if (ahead < -4 || !slideStaysOnDeck(own, stage, matchFrame)) return false;
  const anticipatedZ = read.choice === HabitChoice.jump ? 70.0 : read.choice === HabitChoice.landing ? 0.0 : f32(target.motion.z - own.motion.z);
  if (!moveReaches(own.character, style, target, Math.abs(dx), anticipatedZ, own.tuning.moves)) return false;
  queueAttack(commands, { style, facing: toward, frame, mayCharge: false });
  input.attackHeld = true;
  read.acted = true;
  read.actionFrame = frame;
  read.actionSerial = own.attack.serial;
  read.actionStyle = style;
  read.actionFacing = toward;
  return true;
}
