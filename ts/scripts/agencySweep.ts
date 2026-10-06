// The false-agency sweep (#68): every shipped fighter's grab and throws,
// ground normals and specials against every fighter at 0-150%, jab resets
// on a fighter lying down, and the bounded true links of the move
// comparisons (scripts/moveComparisons.ts), each analysed by
// scripts/agency.ts. A starter is played from a standing start; once it
// catches the victim (a hit, a grab or a freeze), the analysis begins. The
// attacker then tries to catch the victim again with the same starter, from
// several reaches, standing or approaching: a follow-up that catches the
// victim before it can act extends the stretch, and a stretch that comes back
// to an equivalent situation is a loop, which is checked again with the
// victim holding each DI direction. `bun wisp agency` prints the result.
import { Action, bit } from "../src/game/input/actions";
import { ATTACK_BUFFER_FRAMES } from "../src/game/input/attackBuffer";
import { type InputRow, emptyInput, inputRow } from "../src/game/input/inputRow";
import { createFrameControls } from "../src/game/match/controls";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { Phase, createMatchState, setHumanMask } from "../src/game/match/rules";
import type { ReplayState } from "../src/game/replay/snapshot";
import { beginFighterAttack, resolveAttacks } from "../src/game/sim/attacks";
import { AttackStyle, Character, DownState, GrabAction } from "../src/game/sim/codes";
import { canAttack } from "../src/game/sim/conditions";
import { type Fighter, createFighter } from "../src/game/sim/fighter";
import { attackStartupFrames } from "../src/game/sim/moves";
import { createRoster, fighterAt } from "../src/game/sim/roster";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { type AgencyReport, ESCAPE_FRAMES, type Loop, TIGHT_ESCAPE, agencyLetters, analyzeAgency, runFrame, sameGameplay, snapshotOf } from "./agency";
import { exportComparisons } from "./moveComparisons";

interface Entry {
  readonly name: string;
  readonly character: Character;
}

/** Every selectable fighter: the original three and each complete hero. */
export const FIGHTERS: readonly Entry[] = SELECTABLE_CHARACTERS.map((character) => ({ name: fighterName(character), character }));
const nameOf = (character: number) => FIGHTERS.find((entry) => entry.character === character)?.name ?? "fighter";

const PERCENTS = Array.from({ length: 16 }, (_, index) => index * 10);

/**
 * Stretches longer than this are reported: about a visual reaction (250-333
 * ms). A lock shorter than a reaction ends before a player could try an
 * input and see it do nothing, so it can't leave them believing they could
 * have acted; a longer one can.
 */
export const REPORTED_FRAMES = 20;

/** Frames a stretch is followed for: two cycles of the slowest loop the sweep can make, a 300-frame freeze. */
const WINDOW = 720;
/** A follow-up catching the victim this many frames after the starter's stretch ended may still be a true one: a tech press or a buffered button counts as acting up to 20 frames before it shows. */
const LATE_FOLLOW_UP = 25;
const ATTACKER = 0;
const VICTIM = 1;
/** The two settling frames before the starter. */
const SETTLE = 2;

/** A controller row pressing `buttons` with the stick at whole directions (x, z), pressed from a neutral row. */
function pad(buttons: number, x = 0, z = 0): InputRow {
  const held = buttons | (x < 0 ? bit(Action.moveLeft) : 0) | (x > 0 ? bit(Action.moveRight) : 0) | (z < 0 ? bit(Action.moveDown) : 0) | (z > 0 ? bit(Action.moveUp) : 0);
  const special = (buttons & bit(Action.special)) !== 0;
  const row = inputRow({ held, pressed: held, axisX: x * 127, axisZ: z * 127, specialX: special ? x : 0, specialZ: special ? z : 0 });
  if (row === undefined) throw new Error(`no controller sends ${buttons} with stick ${x},${z}`);
  return row;
}

/** A starter: the buttons pressed, where the stick points on that frame, and for a grab the throw once holding. */
interface Starter {
  readonly name: string;
  readonly buttons: number;
  readonly aim: "toward" | "up" | "down" | "neutral";
  readonly throw?: "forward" | "back" | "up" | "down";
}

const ATTACK = bit(Action.attack);
const WALK = bit(Action.walk);
const SPECIAL = bit(Action.special);
const GRAB = bit(Action.grab);

const STARTERS: readonly Starter[] = [
  { name: "jab", buttons: ATTACK, aim: "neutral" },
  { name: "forward tilt", buttons: ATTACK | WALK, aim: "toward" },
  { name: "up tilt", buttons: ATTACK | WALK, aim: "up" },
  { name: "down tilt", buttons: ATTACK | WALK, aim: "down" },
  { name: "forward smash", buttons: ATTACK, aim: "toward" },
  { name: "up smash", buttons: ATTACK, aim: "up" },
  { name: "down smash", buttons: ATTACK, aim: "down" },
  { name: "neutral special", buttons: SPECIAL, aim: "neutral" },
  { name: "side special", buttons: SPECIAL, aim: "toward" },
  { name: "up special", buttons: SPECIAL, aim: "up" },
  { name: "down special", buttons: SPECIAL, aim: "down" },
  { name: "forward throw", buttons: GRAB, aim: "neutral", throw: "forward" },
  { name: "back throw", buttons: GRAB, aim: "neutral", throw: "back" },
  { name: "up throw", buttons: GRAB, aim: "neutral", throw: "up" },
  { name: "down throw", buttons: GRAB, aim: "neutral", throw: "down" },
];

const toward = (attacker: Readonly<Fighter>, victim: Readonly<Fighter>) => (victim.motion.x >= attacker.motion.x ? 1 : -1);

function aimed(starter: Starter, attacker: Readonly<Fighter>, victim: Readonly<Fighter>): InputRow {
  const x = starter.aim === "toward" ? toward(attacker, victim) : 0;
  const z = starter.aim === "up" ? 1 : starter.aim === "down" ? -1 : 0;
  return pad(starter.buttons, x, z);
}

/**
 * How the attacker plays: the starter on `first`, then, when `repeat` names a
 * reach, again whenever it can act and the victim is that close, holding the
 * stick toward it meanwhile when `approach`. A held victim is thrown at once.
 * A pure function of the match, as replays need.
 */
interface Plan {
  readonly starter: Starter;
  readonly first: number;
  readonly repeat: number | undefined;
  readonly approach: boolean;
}

function attackerRow(plan: Plan, state: Readonly<ReplayState>, frame: number): InputRow {
  const attacker = fighterAt(state.world, ATTACKER);
  const victim = fighterAt(state.world, VICTIM);
  const { starter } = plan;
  if (attacker.grab.target !== undefined && attacker.grab.action === GrabAction.hold) {
    const direction = starter.throw ?? "forward";
    return direction === "up" ? pad(0, 0, 1) : direction === "down" ? pad(0, 0, -1) : pad(0, direction === "forward" ? attacker.facing : -attacker.facing, 0);
  }
  if (frame === plan.first) return aimed(starter, attacker, victim);
  // Presses come on even frames only, so a press that starts nothing is released before the next, as on a pad.
  if (plan.repeat === undefined || frame < plan.first || !canAttack(attacker) || victim.status.out) return emptyInput();
  if (Math.abs(victim.motion.x - attacker.motion.x) <= plan.repeat) return frame % 2 === 0 ? aimed(starter, attacker, victim) : emptyInput();
  return plan.approach ? pad(0, toward(attacker, victim), 0) : emptyInput();
}

function match(world: ReplayState["world"], percent: number): ReplayState {
  const state = createMatchState();
  setHumanMask(state, 3);
  state.phase = Phase.match;
  state.timeLimitMinutes = 0;
  state.stageChoice = 0;
  const controls = createFrameControls();
  for (const commands of controls.commands) commands.graceFrames = ATTACK_BUFFER_FRAMES;
  fighterAt(world, VICTIM).status.damage = percent;
  return { world, match: state, controls, runtime: createPacingAndPresentation() };
}

/** Two fighters `gap` apart at the middle of the flat stage, facing each other, the victim at `percent`, settled. */
export function standingMatch(attacker: Character, victim: Character, percent: number, gap: number): ReplayState {
  const state = match(createRoster(3, [createFighter(attacker, -gap / 2, 1), createFighter(victim, gap / 2, -1)]), percent);
  for (let frame = 0; frame < SETTLE; frame++) runFrame(state, () => emptyInput());
  return state;
}

/** A fighter lying on the deck after a missed tech, `gap` in front of the attacker. */
function lyingMatch(attacker: Character, victim: Character, percent: number, gap: number): ReplayState {
  const state = standingMatch(attacker, victim, percent, gap);
  const lying = fighterAt(state.world, VICTIM);
  // Tumbling just above the deck with no tech pressed: it lands, bounces and lies there.
  lying.motion.grounded = false;
  lying.motion.surface = undefined;
  lying.motion.z = 2.0;
  lying.down.state = DownState.tumble;
  lying.launch.hitstun = 400;
  const lyingDown = () => fighterAt(state.world, VICTIM).down.state === DownState.wait;
  for (let frame = 0; frame < 60 && !lyingDown(); frame++) runFrame(state, () => emptyInput());
  if (!lyingDown()) throw new Error("the victim did not come to lie on the deck");
  return state;
}

/** What the victim showed after the previous frame: a new hit, a new hold or a longer freeze is a new catch. */
interface Catches {
  hits: number;
  grabbed: boolean;
  frozenFrames: number;
}

/** Whether the victim was caught again this frame: hit, grabbed or frozen, including a freeze renewed as the last one ended. */
function caught(f: Readonly<Fighter>, seen: Catches): boolean {
  const grabbed = f.grab.owner !== undefined;
  const fresh = f.visuals.hit !== seen.hits || (grabbed && !seen.grabbed) || f.status.frozenFrames > seen.frozenFrames;
  seen.hits = f.visuals.hit;
  seen.grabbed = grabbed;
  seen.frozenFrames = f.status.frozenFrames;
  return fresh;
}

const catchesOf = (f: Readonly<Fighter>): Catches => ({ hits: f.visuals.hit, grabbed: f.grab.owner !== undefined, frozenFrames: f.status.frozenFrames });

/** Plays `plan` from `start` for `frames` frames, the victim neutral: the frames it catches the victim on, and the match after the first. */
function play(start: Readonly<ReplayState>, plan: Plan, frames: number): { readonly catchFrames: readonly number[]; readonly afterFirst: ReplayState | undefined; readonly end: ReplayState } {
  const state = snapshotOf(start);
  const seen = catchesOf(fighterAt(state.world, VICTIM));
  const catchFrames: number[] = [];
  let afterFirst: ReplayState | undefined;
  for (let index = 0; index < frames; index++) {
    const frame = state.runtime.simulationFrame + 1;
    runFrame(state, (slot) => (slot === ATTACKER ? attackerRow(plan, state, frame) : emptyInput()));
    const victim = fighterAt(state.world, VICTIM);
    if (caught(victim, seen)) {
      catchFrames.push(frame);
      afterFirst ??= snapshotOf(state);
    }
    if (victim.status.out) break;
  }
  return { catchFrames, afterFirst, end: state };
}

/** The victim's stretch from just after a catch while `attacker` plays on and the victim holds `victimRow`. */
const neutral = () => emptyInput();

/** The stick pushed to (x, z) on the frame after the catch and held there: directional influence held through everything. */
function holding(caughtState: Readonly<ReplayState>, x: number, z: number): (frame: number) => InputRow {
  const first = caughtState.runtime.simulationFrame + 1;
  const pressed = pad(0, x, z);
  const held = inputRow({ ...pressed, pressed: 0, throwX: 0, throwZ: 0 });
  if (held === undefined) throw new Error(`no controller holds the stick at ${x},${z}`);
  return (frame) => (frame === first ? pressed : held);
}

function stretchAfter(caughtState: Readonly<ReplayState>, attacker: (state: Readonly<ReplayState>, frame: number) => InputRow, victimRow: (frame: number) => InputRow, untilFree: number): AgencyReport {
  return analyzeAgency({
    start: caughtState, victim: VICTIM, frames: WINDOW, horizon: 30, untilFree,
    row: (slot, frame, state) => (slot === ATTACKER ? attacker(state, frame) : victimRow(frame)),
  });
}

const DI = [["up", 0, 1], ["up-right", 1, 1], ["right", 1, 0], ["down-right", 1, -1], ["down", 0, -1], ["down-left", -1, -1], ["left", -1, 0], ["up-left", -1, 1]] as const;

/** A stretch: its length, the frames where only the stick mattered, its loop, and where it ended. */
interface StretchResult {
  readonly length: number;
  readonly diFrames: number;
  readonly letters: string;
  readonly loop: Loop | undefined;
  readonly endPercent: number;
  readonly knockedOut: boolean;
  /** For a loop: each DI direction held from the catch, the stretch it gets, and the frames a cycle lets the victim act on if the loop still comes round. */
  readonly underDi: readonly { readonly direction: string; readonly length: number; readonly loopEscapeFrames: number | undefined; readonly plan: string }[];
}

function summarize(report: AgencyReport, caughtState: Readonly<ReplayState>, underDi: StretchResult["underDi"] = []): StretchResult {
  const first = report.stretches[0];
  const length = first === undefined || first.from !== caughtState.runtime.simulationFrame + 1 ? 0 : first.length;
  const last = report.states[length];
  const victim = last === undefined ? undefined : fighterAt(last.world, VICTIM);
  return {
    length, diFrames: length === 0 ? 0 : first?.diFrames ?? 0, letters: agencyLetters(report.frames), loop: report.loop,
    endPercent: victim?.status.damage ?? 0, knockedOut: victim !== undefined && (victim.status.out || victim.status.stocks < fighterAt(caughtState.world, VICTIM).status.stocks),
    underDi,
  };
}

/**
 * Checks a loop again with the victim holding each DI direction from the
 * catch, against each repeating plan (`plans`, the loop's own first): the
 * attacker sees the DI and may follow it. For each direction, the loop with
 * the fewest escape frames any plan keeps, if one does.
 */
function loopUnderDi(caughtState: Readonly<ReplayState>, plans: readonly Plan[]): StretchResult["underDi"] {
  return DI.map(([direction, x, z]) => {
    let best: { readonly length: number; readonly loopEscapeFrames: number | undefined; readonly plan: string } | undefined;
    for (const plan of plans) {
      const report = stretchAfter(caughtState, (state, frame) => attackerRow(plan, state, frame), holding(caughtState, x, z), ESCAPE_FRAMES + 1);
      const escape = report.loop?.escapeFrames;
      if (best !== undefined && (escape === undefined || (best.loopEscapeFrames !== undefined && best.loopEscapeFrames <= escape))) continue;
      best = { length: report.stretches[0]?.length ?? 0, loopEscapeFrames: escape, plan: describePlan(plan) };
      if (escape === 0) break;
    }
    return { direction, length: best?.length ?? 0, loopEscapeFrames: best?.loopEscapeFrames, plan: best?.plan ?? "" };
  });
}

const describePlan = ({ starter, repeat, approach }: Plan) => `${starter.name} again ${approach ? "approaching, " : ""}within ${repeat ?? 0} units`;

/** One starter for one pair at one percent: the stretch it starts, and the longest a repeating follow-up made. */
export interface StarterResult {
  readonly attacker: string;
  readonly victim: string;
  readonly starter: string;
  readonly percent: number;
  readonly alone: StretchResult;
  readonly followUp: (StretchResult & { readonly plan: string; readonly catches: number }) | undefined;
}


const REACHES = [25, 40, 60, 80, 110, 150];

/** How much a follow-up locks the victim: looping first, then fewer escape frames a cycle, then the longer stretch. */
const rank = ({ loop, length }: StretchResult) => (loop === undefined ? 0 : 1_000_000 - loop.escapeFrames * 1000) + length;

/** One starter: its stretch with no follow-up, then each repeating plan whose second catch could come before the victim acts. */
function sweepStarter(start: Readonly<ReplayState>, attacker: string, victim: string, starter: Starter, percent: number): StarterResult | undefined {
  const firstFrame = start.runtime.simulationFrame + 1;
  const once: Plan = { starter, first: firstFrame, repeat: undefined, approach: false };
  const opened = play(start, once, 120);
  const caughtState = opened.afterFirst;
  if (caughtState === undefined) return undefined;
  const caughtFrame = caughtState.runtime.simulationFrame;
  const alone = summarize(stretchAfter(caughtState, (state, frame) => attackerRow(once, state, frame), neutral, 1), caughtState);
  const latest = caughtFrame + alone.length + 1 + LATE_FOLLOW_UP;
  const ownCatches = play(start, once, latest - start.runtime.simulationFrame).catchFrames.length;
  const plans = REACHES.flatMap((repeat) => [false, true].map((approach): Plan => ({ starter, first: firstFrame, repeat, approach })));
  let best: { readonly result: StretchResult; readonly plan: Plan } | undefined;
  // Plans that reach the same match by the latest frame a follow-up could count play on alike; one analysis each.
  const tried: ReplayState[] = [];
  for (const plan of plans) {
    const trial = play(start, plan, latest - start.runtime.simulationFrame);
    // Only a plan that catches the victim more often than the starter alone, before it could act, can extend the stretch.
    if (trial.catchFrames.length <= ownCatches || tried.some((end) => sameGameplay(end, trial.end))) continue;
    tried.push(trial.end);
    const result = summarize(stretchAfter(caughtState, (state, frame) => attackerRow(plan, state, frame), neutral, ESCAPE_FRAMES + 1), caughtState);
    // A loop beats no loop, fewer escape frames a loop with more; then the longer stretch.
    if (result.length <= alone.length && result.loop === undefined) continue;
    if (best === undefined || rank(result) > rank(best.result)) best = { result, plan };
  }
  if (best === undefined) return { attacker, victim, starter: starter.name, percent, alone, followUp: undefined };
  const { result, plan } = best;
  const lastFrame = Math.max(caughtFrame + result.length, result.loop?.to ?? 0);
  const catches = play(start, plan, lastFrame - start.runtime.simulationFrame).catchFrames.length;
  // A loop the victim can act out of only frame-tightly, or not at all, is checked against every DI and every plan.
  const underDi = result.loop !== undefined && result.loop.escapeFrames <= TIGHT_ESCAPE ? loopUnderDi(caughtState, [plan, ...plans.filter((other) => other !== plan)]) : [];
  return { attacker, victim, starter: starter.name, percent, alone, followUp: { ...result, underDi, plan: describePlan(plan), catches } };
}

/**
 * Every starter of `attackers` against every fighter: throws and jab resets
 * at each percent from 0 to 150, other starters at 0, 50, 100 and 150, as
 * their stretches change less with percent than throws' do. `only` names
 * the starters to sweep, "jab reset" included; absent, every one.
 */
export function sweepStarters(attackers: readonly Entry[] = FIGHTERS, only?: readonly string[]): StarterResult[] {
  const results: StarterResult[] = [];
  const reset: Starter = { name: "jab reset", buttons: ATTACK, aim: "neutral" };
  const starters = STARTERS.filter(({ name }) => only === undefined || only.includes(name));
  const resets = only === undefined || only.includes(reset.name);
  for (const attacker of attackers) {
    for (const victim of FIGHTERS) {
      for (const percent of PERCENTS) {
        const coarse = percent % 50 === 0;
        for (const starter of starters) {
          if (starter.throw === undefined && !coarse) continue;
          const result = sweepStarter(standingMatch(attacker.character, victim.character, percent, 40), attacker.name, victim.name, starter, percent);
          if (result !== undefined) results.push(result);
        }
        if (!resets) continue;
        const lying = sweepStarter(lyingMatch(attacker.character, victim.character, percent, 40), attacker.name, victim.name, reset, percent);
        if (lying !== undefined) results.push(lying);
      }
    }
  }
  return results;
}

/** A bounded true link of the move comparisons, played through the frame executor with every input class. */
export interface LinkResult {
  readonly name: string;
  /** The tick the comparison's follow-up first contacted, and the frame it did here. */
  readonly comparisonContact: number;
  readonly contact: number | undefined;
  readonly stretch: StretchResult;
  /** Each DI direction held from the first contact: whether the link still caught the victim before it could act. */
  readonly holdsUnderDi: readonly { readonly direction: string; readonly holds: boolean }[];
}

interface ComparisonRow {
  readonly kind: string;
  readonly verdict?: string;
  readonly character: number;
  readonly category: string;
  readonly spacing: number;
  readonly percent: number;
  readonly candidateStyle: number;
  readonly delay: number;
  readonly approach: boolean;
  readonly scheduledStart: number;
  readonly firstContact: number;
  readonly opponentReady: number;
}

const isComparisonRow = (value: unknown): value is ComparisonRow => typeof value === "object" && value !== null && "kind" in value && "verdict" in value;

/** The comparison's contact state (scripts/moveComparisons.ts, Rig): the first contact already resolved, on stage 0. */
function comparisonContact(row: ComparisonRow): ReplayState {
  const character = FIGHTERS.find((entry) => entry.character === row.character)?.character;
  if (character === undefined) throw new Error(`the comparisons name fighter ${row.character}, which isn't shipped`);
  const attacker = createFighter(character, 0, 1);
  const defender = createFighter(Character.rifleman, row.spacing, -1);
  const state = match(createRoster(3, [attacker, defender]), row.percent);
  const style = row.category === "smash" ? AttackStyle.forwardSmash : row.category === "normal" ? AttackStyle.forwardTilt : AttackStyle.neutralAir;
  const aerial = style === AttackStyle.neutralAir;
  attacker.motion.grounded = !aerial;
  attacker.motion.surface = aerial ? undefined : 0;
  attacker.motion.z = aerial ? 20 : 0;
  attacker.motion.vz = aerial ? -2 : 0;
  defender.motion.surface = 0;
  beginFighterAttack(state.world, ATTACKER, style, false);
  const contact = aerial ? 20 : attackStartupFrames(style);
  attacker.attack.frame = contact;
  attacker.attack.cooldown = attacker.attack.duration - contact;
  resolveAttacks(state.world);
  return state;
}

/** Each bounded true link of the move comparisons. */
export function sweepComparisonLinks(): LinkResult[] {
  const links = exportComparisons().map((line): unknown => JSON.parse(line)).filter(isComparisonRow).filter((row) => row.verdict === "bounded-true-link");
  return links.map((row) => {
    const contactState = comparisonContact(row);
    const tilt = row.candidateStyle === AttackStyle.forwardTilt;
    // The comparison holds the stick toward the defender from the attacker's normal-ready tick until its scheduled start.
    const ready = row.scheduledStart - row.delay;
    const attacker = (state: Readonly<ReplayState>, frame: number): InputRow => {
      const tick = frame - contactState.runtime.simulationFrame;
      const self = fighterAt(state.world, ATTACKER);
      const side = toward(self, fighterAt(state.world, VICTIM));
      if (tick === row.scheduledStart) return tilt ? pad(ATTACK | WALK, side, 0) : pad(ATTACK);
      return row.approach && tick >= ready && tick < row.scheduledStart ? pad(0, side, 0) : emptyInput();
    };
    const report = stretchAfter(contactState, attacker, neutral, 1);
    const seen = catchesOf(fighterAt(contactState.world, VICTIM));
    const contact = report.states.findIndex((state, index) => index > 0 && caught(fighterAt(state.world, VICTIM), seen));
    const stretch = summarize(report, contactState);
    const holdsUnderDi = DI.map(([direction, x, z]) => {
      const held = stretchAfter(contactState, attacker, holding(contactState, x, z), 1);
      const heldSeen = catchesOf(fighterAt(contactState.world, VICTIM));
      const heldContact = held.states.findIndex((state, index) => index > 0 && caught(fighterAt(state.world, VICTIM), heldSeen));
      return { direction, holds: heldContact > 0 && heldContact <= (held.stretches[0]?.length ?? 0) };
    });
    const name = `${nameOf(row.character)} ${row.category === "late-aerial" ? "late neutral air" : row.category === "smash" ? "forward smash" : "forward tilt"}`
      + ` into ${tilt ? "forward tilt" : "jab"} on Rifleman at ${row.percent}%, ${row.spacing} apart, delay ${row.delay}${row.approach ? " approaching" : ""}`;
    return { name, comparisonContact: row.firstContact, contact: contact > 0 ? contact : undefined, stretch, holdsUnderDi };
  });
}

/** Every starter's name, "jab reset" included. */
export const STARTER_NAMES: readonly string[] = [...STARTERS.map(({ name }) => name), "jab reset"];

/** The attacker's rows for a starter named `name`, pressed on `first` and, with `repeat`, again whenever the victim is that close. */
export function attackerPlan(name: string, first: number, repeat?: number, approach = false): (state: Readonly<ReplayState>, frame: number) => InputRow {
  const starter = STARTERS.find((candidate) => candidate.name === name);
  if (starter === undefined) throw new Error(`no starter named ${name}`);
  const plan: Plan = { starter, first, repeat, approach };
  return (state, frame) => attackerRow(plan, state, frame);
}
