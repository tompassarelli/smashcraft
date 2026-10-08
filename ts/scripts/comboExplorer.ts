// The combo explorer (smashcraft:docs/design/balance.md, "Combo potential"):
// each fighter's combo potential measured from the deterministic match frame
// executor, independent of how well any computer player combos. From every
// opener that lands, at a grid of percents, two stage positions and three
// opponent bodies, with the defender holding each of five DI directions, it
// branches from the saved state the frame a hit lands: every follow-up the
// attacker can start (stand, dash, short or full hop toward, full hop in
// place, drift, double jump; each attack at every press frame the hitstun
// window allows) is played from that state, and a follow-up whose hit lands
// before the defender could act extends a true combo. A beam keeps the most
// damaging branches at each depth. A combo that ends with the defender
// landing in tumble is a tech chase: the attacker's read of one of the four
// tech options is searched the same way and counted as another opening.
import { f32 } from "wisp/src/sim/f32";
import { Action, bit } from "../src/game/input/actions";
import { type ComboRoute, type ComboSetup, comboScene, heldRuns } from "../src/game/match/comboRoute";
import { resetMatchFrameInput } from "../src/game/match/frameInput";
import { setHumanMask } from "../src/game/match/rules";
import { type Scene, fighter, frameMasks } from "../src/game/match/padScene";
import { type ReplayState, captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../src/game/replay/snapshot";
import { AttackStyle, Character, DownState, GrabAction, LedgeState, SpecialAction } from "../src/game/sim/codes";
import { canAttack, canBeGrabbed, canStartAttack } from "../src/game/sim/conditions";
import type { Fighter } from "../src/game/sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { attackStartupFrames } from "../src/game/sim/moves";
import { mainDeckLeft, mainDeckRight } from "../src/game/sim/stage";

const STAGE = 0;
/** Percents an opener is measured at; a kill confirm is reported at this resolution. */
export const PERCENTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180] as const;
/** Light and fast-falling, middle-weight and floaty, heaviest: the roster's spread of weight and fall speed. */
export const OPPONENTS: readonly Character[] = [ Character.rifleman, Character.cairne];
export const POSITIONS = ["centre", "ledge"] as const;
export type Position = (typeof POSITIONS)[number];
/** Held during hitlag, hitstun and a grab: in and out are toward and away from the attacker. */
export const DIS = ["out", "up", "down", "in", "none"] as const;
export type Di = (typeof DIS)[number];

/** Follow-ups searched per hit, and hits per combo after the opener. */
const BEAM = 4;
const DEPTH = 8;
/** Frames a line runs at most: the longest hitstun the grid reaches, and a launch's flight to a blast zone. */
const LINE_LIMIT = 150;
const FLIGHT_LIMIT = 120;
/** A press is played only when the defender is this near where the attack will be on its first active frame. */
const GATE_X = 260.0;
const GATE_Z = 320.0;
/** Frames before landing a tech-chase read presses its tech, inside the 20-frame tech window. */
const TECH_LEAD = 2;
/** Press frames after the earliest searched one by one; later ones every other frame. */
const FINE_FRAMES = 6;
/** A grabbed defender is thrown within this many frames. */
const THROW_LIMIT = 60;

const ATTACK = bit(Action.attack);
const SPECIAL = bit(Action.special);
const JUMP = bit(Action.jump);
const GRAB = bit(Action.grab);
const WALK = bit(Action.walk);
const LEFT = bit(Action.moveLeft);
const RIGHT = bit(Action.moveRight);
const UP = bit(Action.moveUp);
const DOWN = bit(Action.moveDown);
const SHIELD = bit(Action.rightTrigger);
const SMASH_LEFT = bit(Action.smashLeft);
const SMASH_RIGHT = bit(Action.smashRight);
const SMASH_UP = bit(Action.smashUp);
const SMASH_DOWN = bit(Action.smashDown);

const toward = (self: Readonly<Fighter>, other: Readonly<Fighter>): number => (other.motion.x >= self.motion.x ? RIGHT : LEFT);
const away = (self: Readonly<Fighter>, other: Readonly<Fighter>): number => (other.motion.x >= self.motion.x ? LEFT : RIGHT);
const smashToward = (self: Readonly<Fighter>, other: Readonly<Fighter>): number => (other.motion.x >= self.motion.x ? SMASH_RIGHT : SMASH_LEFT);
const forward = (self: Readonly<Fighter>): number => (self.facing > 0 ? RIGHT : LEFT);
const backward = (self: Readonly<Fighter>): number => (self.facing > 0 ? LEFT : RIGHT);

// ------------------------------------------------------------------ moves

type Throw = "forward" | "back" | "up" | "down";
interface Move {
  readonly name: string;
  readonly kind: "ground" | "air" | "special" | "dash" | "grab";
  readonly style?: AttackStyle;
  /** The buttons that start it this frame. */
  readonly press: (self: Readonly<Fighter>, other: Readonly<Fighter>) => number;
}

const ground = (name: string, style: AttackStyle, press: Move["press"]): Move => ({ name, kind: "ground", style, press });
const aerial = (name: string, style: AttackStyle, press: Move["press"]): Move => ({ name, kind: "air", style, press });
const special = (name: string, press: Move["press"]): Move => ({ name, kind: "special", press });

const GROUND_MOVES: readonly Move[] = [
  ground("jab", AttackStyle.jab, () => ATTACK),
  ground("forward tilt", AttackStyle.forwardTilt, (a, b) => WALK | toward(a, b) | ATTACK),
  ground("up tilt", AttackStyle.upTilt, () => WALK | UP | ATTACK),
  ground("down tilt", AttackStyle.downTilt, () => WALK | DOWN | ATTACK),
  ground("forward smash", AttackStyle.forwardSmash, smashToward),
  ground("up smash", AttackStyle.upSmash, () => SMASH_UP),
  ground("down smash", AttackStyle.downSmash, () => SMASH_DOWN),
];
const GRAB_MOVE: Move = { name: "grab", kind: "grab", style: AttackStyle.grab, press: () => GRAB };
const DASH_ATTACK: Move = { name: "dash attack", kind: "dash", style: AttackStyle.dashAttack, press: (a, b) => toward(a, b) | ATTACK };
const DASH_GRAB: Move = { name: "dash grab", kind: "grab", style: AttackStyle.grab, press: (a, b) => toward(a, b) | GRAB };
const AERIALS: readonly Move[] = [
  aerial("neutral air", AttackStyle.neutralAir, () => ATTACK),
  aerial("forward air", AttackStyle.forwardAir, (a) => (a.facing > 0 ? SMASH_RIGHT : SMASH_LEFT)),
  aerial("back air", AttackStyle.backAir, (a) => (a.facing > 0 ? SMASH_LEFT : SMASH_RIGHT)),
  aerial("up air", AttackStyle.upAir, () => SMASH_UP),
  aerial("down air", AttackStyle.downAir, () => SMASH_DOWN),
];
const SPECIALS: readonly Move[] = [
  special("neutral special", () => SPECIAL),
  special("side special", (a, b) => SPECIAL | toward(a, b)),
  special("up special", () => SPECIAL | UP),
  special("down special", () => SPECIAL | DOWN),
];
const THROWS: readonly Throw[] = ["forward", "back", "up", "down"];
const throwMask = (self: Readonly<Fighter>, direction: Throw): number =>
  direction === "up" ? UP : direction === "down" ? DOWN : direction === "back" ? backward(self) : forward(self);

/** An opener: its first press, the stick it holds before (a dash), and its setup. */
interface Opener {
  readonly name: string;
  readonly move: Move;
  readonly throw?: Throw;
  /** Frames of dash before the press. */
  readonly dash?: number;
  readonly airborne?: boolean;
  readonly facingAway?: boolean;
}

export const OPENERS: readonly Opener[] = [
  ...GROUND_MOVES.map((move) => ({ name: move.name, move })),
  { name: "dash attack", move: DASH_ATTACK, dash: 6 },
  ...THROWS.map((direction) => ({ name: `${direction} throw`, move: GRAB_MOVE, throw: direction })),
  ...AERIALS.map((move) => ({ name: move.name, move, airborne: true, facingAway: move.style === AttackStyle.backAir })),
  ...SPECIALS.map((move) => ({ name: move.name, move })),
];

// ------------------------------------------------------------------ the simulator

/** Saved states are reused: allocating one costs more than playing a frame. */
const spare: ReplayState[] = [];

interface Saved {
  readonly state: ReplayState;
  readonly previous: readonly number[];
}

class Sim {
  readonly scene: Scene;
  /** A match from the setup, or from `from`: a saved state of any two-fighter match with the setup's fighters. */
  constructor(readonly setup: ComboSetup, from?: ReplayState) {
    this.scene = comboScene(setup);
    if (from !== undefined) {
      const s = this.scene;
      restoreReplaySnapshot(from, s.world, s.game, s.controls, s.runtime);
      setHumanMask(s.game, s.world.mask);
    }
  }
  get a(): Fighter {
    return fighter(this.scene, 0);
  }
  get b(): Fighter {
    return fighter(this.scene, 1);
  }
  save(): Saved {
    const state = spare.pop() ?? createReplaySnapshot();
    const s = this.scene;
    captureReplaySnapshot(state, s.world, s.game, s.controls, s.runtime);
    return { state, previous: [...s.previous] };
  }
  load(saved: Saved): void {
    const s = this.scene;
    restoreReplaySnapshot(saved.state, s.world, s.game, s.controls, s.runtime);
    s.previous.splice(0, s.previous.length, ...saved.previous);
    resetMatchFrameInput(s.row);
  }
  step(first: number, second: number): void {
    frameMasks(this.scene, (slot) => (slot === 0 ? first : slot === 1 ? second : 0));
  }
}

const free = (saved: Saved): void => {
  spare.push(saved.state);
};

// ------------------------------------------------------------------ the defender

/** What the defender holds: DI while the hits own it, then (offstage) a jump and up special back toward the stage. */
interface Defender {
  readonly name: string;
  readonly di: Di;
  /** A tech-chase read: the tech option pressed TECH_LEAD frames before the landing frame, from the line's start. */
  readonly tech?: { readonly option: TechOption; readonly landing: number };
}

export const TECH_OPTIONS = ["tech in place", "tech in", "tech away", "missed tech"] as const;
type TechOption = (typeof TECH_OPTIONS)[number];

const owned = (b: Readonly<Fighter>): boolean => b.launch.hitlag > 0 || b.launch.hitstun > 0 || b.grab.owner !== undefined;

function diMask(di: Di, b: Readonly<Fighter>, a: Readonly<Fighter>): number {
  switch (di) {
    case "in": return toward(b, a);
    case "out": return away(b, a);
    case "up": return UP;
    case "down": return DOWN;
    default: return 0;
  }
}

const offstage = (b: Readonly<Fighter>): boolean => b.motion.x < mainDeckLeft(STAGE) || b.motion.x > mainDeckRight(STAGE) || b.motion.z < -20.0;

/** The defender's held buttons on line frame n (from 1), given whether it has been free since frame `freedAt`. */
function defenderMask(d: Defender, n: number, freedAt: number | undefined, b: Readonly<Fighter>, a: Readonly<Fighter>): number {
  if (d.tech !== undefined && d.tech.option !== "missed tech" && n === d.tech.landing - TECH_LEAD) {
    return SHIELD | (d.tech.option === "tech in" ? toward(b, a) : d.tech.option === "tech away" ? away(b, a) : 0);
  }
  if (owned(b) || freedAt === undefined) return owned(b) ? diMask(d.di, b, a) : 0;
  if (!offstage(b) || b.motion.grounded) return 0;
  // A free defender off the stage recovers: double jump on its first free frame, up special twelve frames later.
  const home = b.motion.x > 0 ? LEFT : RIGHT;
  const since = n - freedAt;
  return since === 1 ? home | JUMP : since === 13 ? home | UP | SPECIAL : home;
}

/** Free to act on the next frame: it can attack, jump, dodge or shield, chose a get-up, or holds the ledge. */
const settled = (b: Readonly<Fighter>): boolean => canStartAttack(b) || b.down.state === DownState.wait || b.ledge.state === LedgeState.hang;

// ------------------------------------------------------------------ routes and nodes

interface Inputs {
  readonly attacker: readonly number[];
  readonly defender: readonly number[];
}

const joined = (base: Inputs, attacker: readonly number[], defender: readonly number[]): Inputs => ({
  attacker: [...base.attacker, ...attacker], defender: [...base.defender, ...defender],
});

/** A state just after a hit landed, with the inputs from the setup that reach it. */
interface Node {
  readonly saved: Saved;
  readonly inputs: Inputs;
  readonly moves: readonly string[];
  readonly reads: number;
  /** The defender's damage on landing the hit. */
  readonly damage: number;
  /** The defender's hit count then. */
  readonly hits: number;
}

export type Situation = "none" | "tech chase" | "ledge";

export interface Ending {
  /** Damage the route dealt, opener included. */
  readonly damage: number;
  readonly ko: boolean;
  readonly moves: readonly string[];
  readonly reads: number;
  /** Hits that landed, as Slippi counts a conversion's moves: a multi-hit move's every hit. */
  readonly hits: number;
  /** What the defender faces when the combo ends: a tech chase or the ledge, a 50/50 the attacker can read. */
  readonly situation: Situation;
  readonly route: ComboRoute;
}

const better = (x: Ending | undefined, y: Ending): boolean =>
  x === undefined || (y.ko !== x.ko ? y.ko : y.ko ? y.reads < x.reads || (y.reads === x.reads && y.moves.length < x.moves.length) : y.damage > x.damage);

interface Line {
  /** Press frames from 1: whether the attacker can start an attack then. */
  readonly canPress: boolean[];
  /** The first frame on which the defender could act; a hit on an earlier frame is true. */
  readonly free: number;
  readonly attacker: number[];
  readonly defender: number[];
  readonly bx: number[];
  readonly bz: number[];
  /** The defender's damage after each frame, until it lost a stock. */
  readonly damage: number[];
  /** After each frame: the defender lies after a missed tech, or holds the ledge. */
  readonly situation: Situation[];
  /** The frame the defender lost a stock on, if it did. */
  readonly ko: number | undefined;
  /** The defender's hit count after each frame. */
  readonly hits: number[];
  readonly ax: number[];
  readonly az: number[];
  readonly avx: number[];
  readonly grounded: boolean[];
  /** States at the start of each kept frame. */
  readonly saved: (Saved | undefined)[];
}

function emptyLine(): Line {
  return { canPress: [], free: LINE_LIMIT + 1, attacker: [], defender: [], bx: [], bz: [], damage: [], situation: [], ko: undefined, hits: [], ax: [], az: [], avx: [], grounded: [], saved: [] };
}

function releaseLine(line: Line): void {
  for (const saved of line.saved) if (saved !== undefined) free(saved);
  line.saved.length = 0;
}

/** Attacker plans the search moves under: the stick before the press and after it. */
interface Mode {
  readonly name: string;
  /** The attacker's buttons on line frame n when it presses nothing; `start` is its first press frame. */
  readonly hold: (n: number, start: number, a: Readonly<Fighter>, b: Readonly<Fighter>) => number;
  /** The stick held after the press. */
  readonly after: (a: Readonly<Fighter>, b: Readonly<Fighter>) => number;
  readonly moves: (a: Readonly<Fighter>) => readonly Move[];
  /** The earliest press frame from the first frame the attacker can act. */
  readonly earliest: (start: number, a: Readonly<Fighter>) => number;
}

const STAND: Mode = {
  name: "stand", hold: () => 0, after: () => 0, earliest: (start) => start,
  moves: (a) => (a.motion.grounded ? [...GROUND_MOVES, GRAB_MOVE, ...SPECIALS] : [...AERIALS, ...SPECIALS]),
};
const DASH: Mode = {
  name: "dash", hold: (n, start, a, b) => (n >= start ? toward(a, b) : 0), after: () => 0, earliest: (start) => start + 1,
  moves: (a) => (a.motion.grounded ? [DASH_ATTACK, DASH_GRAB] : []),
};
const squat = (a: Readonly<Fighter>): number => a.tuning.physics.jumpSquatFrames;
const hop = (name: string, delay: number, full: boolean, drift: boolean): Mode => ({
  name: `${name}${delay > 0 ? ` +${delay}` : ""}`,
  hold: (n, start, a, b) => {
    const jump = start + delay;
    if (n < jump) return 0;
    const stick = drift ? toward(a, b) : 0;
    return n === jump || (full && n <= jump + squat(a) + 1) ? JUMP | stick : stick;
  },
  after: (a, b) => (drift ? toward(a, b) : 0),
  earliest: (start, a) => start + delay + squat(a) + 1,
  moves: (a) => (a.motion.grounded ? [] : drift ? [...AERIALS, ...SPECIALS] : AERIALS),
});
const DRIFT: Mode = { name: "drift", hold: (n, start, a, b) => (n >= start ? toward(a, b) : 0), after: toward, earliest: (start) => start, moves: (a) => (a.motion.grounded ? [] : AERIALS) };
const DOUBLE_JUMP: Mode = {
  name: "double jump", hold: (n, start, a, b) => (n === start ? JUMP | toward(a, b) : n > start ? toward(a, b) : 0), after: toward,
  earliest: (start) => start + 1, moves: (a) => (a.motion.grounded || a.jump.remaining <= 0 ? [] : AERIALS),
};
const GROUND_MODES: readonly Mode[] = [STAND, DASH, hop("short hop", 0, false, true), hop("full hop", 0, true, true), hop("full hop in place", 0, true, false), hop("short hop", 4, false, true), hop("full hop", 4, true, true)];
const AIR_MODES: readonly Mode[] = [STAND, DRIFT, DOUBLE_JUMP];

// ------------------------------------------------------------------ the search

interface Counter { frames: number }
export const cost: Counter = { frames: 0 };

interface Started { readonly attack: number; readonly grab: number; readonly special: number; readonly specialFrame: number }
const startedOf = (a: Readonly<Fighter>): Started => ({ attack: a.attack.serial, grab: a.grab.serial, special: a.special.action, specialFrame: a.special.frame });
const started = (a: Readonly<Fighter>, before: Started): boolean =>
  a.attack.serial !== before.attack || a.grab.serial !== before.grab
  || (a.special.action !== SpecialAction.none && (a.special.action !== before.special || a.special.frame < before.specialFrame));

class Explorer {
  constructor(private readonly sim: Sim) {}

  /**
   * Plays a line from `from`: the attacker holding `hold` for each frame, the
   * defender following `d`. Keeps a state at the start of every frame in
   * `keep` and stops when `stop` says so after a frame.
   */
  private line(from: Saved, d: Defender, hold: (n: number, a: Fighter, b: Fighter) => number, keep: (n: number) => boolean, limit: number, flight: boolean): Line {
    const { sim } = this;
    sim.load(from);
    const line = emptyLine();
    let freeAt = LINE_LIMIT + 1;
    let freedAt: number | undefined;
    let ko: number | undefined;
    const stocks = sim.b.status.stocks;
    const attackerStocks = sim.a.status.stocks;
    let wasTumbling = sim.b.down.state === DownState.tumble && !sim.b.motion.grounded;
    for (let n = 1; n <= limit; n++) {
      const a = sim.a;
      const b = sim.b;
      line.canPress[n] = canAttack(a);
      line.ax[n] = a.motion.x;
      line.az[n] = a.motion.z;
      line.avx[n] = a.motion.vx;
      line.grounded[n] = a.motion.grounded;
      if (n < freeAt && keep(n)) line.saved[n] = sim.save();
      const am = hold(n, a, b);
      const bm = defenderMask(d, n, freedAt, b, a);
      line.attacker.push(am);
      line.defender.push(bm);
      sim.step(am, bm);
      cost.frames++;
      if (sim.a.status.stocks < attackerStocks) break;
      if (sim.b.status.stocks < stocks) {
        ko = n;
        break;
      }
      line.bx[n] = b.motion.x;
      line.bz[n] = b.motion.z;
      line.damage[n] = b.status.damage;
      line.hits[n] = b.visuals.hit;
      line.situation[n] = b.ledge.state === LedgeState.hang ? "ledge" : b.down.state === DownState.bound ? "tech chase" : "none";
      // Landing in tumble is a tech chance, unless this line already chose its tech.
      const landed = wasTumbling && b.motion.grounded && d.tech === undefined;
      wasTumbling = b.down.state === DownState.tumble && !b.motion.grounded;
      if (freeAt > LINE_LIMIT && landed) freeAt = n;
      else if (freeAt > LINE_LIMIT && settled(b)) freeAt = n + 1;
      if (freedAt === undefined && freeAt <= n + 1) freedAt = n;
      if (freeAt <= n + 1) {
        // A free defender over the deck and below a launch's peak is safe; off the stage or high, its flight may still take the stock.
        if (!flight || b.motion.grounded || b.ledge.state === LedgeState.hang || (!offstage(b) && b.motion.z < 400.0)) break;
      }
    }
    return { ...line, free: freeAt, ko };
  }

  /** Where the combo stands if the attacker stops: the defender's damage before its first free frame, or the stock it loses in flight. */
  private ending(node: Node, d: Defender, root: number): { readonly ending: Ending; readonly line: Line } {
    const line = this.line(node.saved, d, () => 0, () => true, LINE_LIMIT + FLIGHT_LIMIT, true);
    const ko = line.ko !== undefined;
    // Damage counts until the defender could act: hits after that weren't guaranteed.
    const counted = line.ko ?? Math.min(line.attacker.length, Math.max(0, line.free - 1));
    const last = ko ? counted - 1 : counted;
    const damage = last >= 1 ? line.damage[last] ?? node.damage : node.damage;
    const hits = last >= 1 ? line.hits[last] ?? node.hits : node.hits;
    const situation = ko ? "none" : line.situation[line.free] === "tech chase" ? "tech chase" : line.situation[line.free - 1] ?? "none";
    const inputs = joined(node.inputs, line.attacker.slice(0, counted), line.defender.slice(0, counted));
    return {
      ending: {
        damage: f32(damage - root), ko, moves: node.moves, reads: node.reads, hits, situation,
        route: { setup: this.sim.setup, held: heldRuns(inputs.attacker, inputs.defender) },
      },
      line,
    };
  }

  /** Every follow-up from the node that hits before the line's free frame. */
  private followUps(node: Node, d: Defender, idle: Line): Node[] {
    const { sim } = this;
    sim.load(node.saved);
    const start = idle.canPress.findIndex((can, n) => n >= 1 && can);
    if (start < 1 || start >= idle.free) return [];
    const children: Node[] = [];
    const seen = new Set<string>();
    const lastJab = sim.a.attack.style === AttackStyle.jab || sim.a.attack.style === AttackStyle.jab2;
    const modes = sim.a.motion.grounded || idle.grounded[start] === true ? GROUND_MODES : AIR_MODES;
    for (const mode of modes) {
      const earliest = mode.earliest(start, sim.a);
      if (earliest >= idle.free) continue;
      const line = mode === STAND ? idle : this.line(node.saved, d, (n, a, b) => mode.hold(n, start, a, b), (n) => n >= earliest, idle.free - 1, false);
      if (line.ko !== undefined) { releaseLine(line); continue; }
      // Every press frame near the earliest; every other one later in a long window.
      for (let k = mode === STAND && lastJab ? 1 : earliest; k < idle.free; k += k < earliest + FINE_FRAMES ? 1 : 2) {
        const saved = line.saved[k];
        if (saved === undefined) continue;
        sim.load(saved);
        for (const move of mode.moves(sim.a)) {
          if (move.kind === "grab" && !canBeGrabbed(sim.b)) continue;
          if (k < earliest && move.style !== AttackStyle.jab) continue;
          const startup = move.style === undefined ? 1 : attackStartupFrames(move.style, sim.a.tuning.moves);
          const contact = k + startup;
          if (contact >= idle.free) continue;
          if (move.kind !== "special") {
            const ahead = f32((line.ax[k] ?? 0) + f32((line.avx[k] ?? 0) * startup));
            if (Math.abs((idle.bx[contact] ?? 0) - ahead) > GATE_X || Math.abs((idle.bz[contact] ?? 0) - (line.az[k] ?? 0)) > GATE_Z) continue;
          }
          for (const child of this.branch(node, d, line, k, mode, move, idle.free)) {
            const b = (() => { sim.load(child.saved); return sim.b; })();
            const key = `${child.moves.at(-1)}|${Math.round(child.damage * 10)}|${Math.round(b.motion.x / 8)}|${Math.round(b.motion.z / 8)}|${b.launch.hitstun}`;
            if (seen.has(key)) { free(child.saved); continue; }
            seen.add(key);
            children.push(child);
          }
          sim.load(saved);
        }
      }
      if (line !== idle) releaseLine(line);
    }
    return children;
  }

  /** The move pressed on frame k of the mode's line; a landed hit before `limit` is a child (a grab gives one per throw). */
  private branch(node: Node, d: Defender, line: Line, k: number, mode: Mode, move: Move, limit: number): Node[] {
    const { sim } = this;
    const saved = line.saved[k];
    if (saved === undefined) return [];
    sim.load(saved);
    const before = startedOf(sim.a);
    let hits = sim.b.visuals.hit;
    const holds = sim.b.grab.owner;
    const attacker = line.attacker.slice(0, k - 1);
    const defender = line.defender.slice(0, k - 1);
    let begun = false;
    for (let n = k; n < limit; n++) {
      const a = sim.a;
      const b = sim.b;
      const stick = mode.after(a, b);
      const am = n === k ? move.press(a, b) | (move.kind === "air" && move.style !== AttackStyle.neutralAir ? stick : 0) : stick;
      const bm = defenderMask(d, n, undefined, b, a);
      attacker.push(am);
      defender.push(bm);
      sim.step(am, bm);
      cost.frames++;
      if (!begun && started(sim.a, before)) begun = true;
      if (move.kind === "grab" && begun && sim.b.grab.owner === 0 && holds === undefined) {
        return this.throws(node, d, attacker, defender, move, n + 1);
      }
      if (sim.b.visuals.hit !== hits) {
        if (begun) {
          return [{ saved: sim.save(), inputs: joined(node.inputs, attacker, defender), moves: [...node.moves, `${mode === STAND ? "" : `${mode.name}, `}${move.name}`], reads: node.reads, damage: sim.b.status.damage, hits: sim.b.visuals.hit }];
        }
        hits = sim.b.visuals.hit;
      }
      if (begun && canAttack(sim.a) && !sim.a.projectiles.some((p) => p.life > 0)) return [];
    }
    return [];
  }

  /** A caught defender thrown each way: the throw's hit is the child. */
  private throws(node: Node, d: Defender, attacker: readonly number[], defender: readonly number[], move: Move, from: number): Node[] {
    const { sim } = this;
    const caught = sim.save();
    const children: Node[] = [];
    for (const direction of THROWS) {
      sim.load(caught);
      const hits = sim.b.visuals.hit;
      const a2 = [...attacker];
      const d2 = [...defender];
      for (let n = 0; n < THROW_LIMIT; n++) {
        const a = sim.a;
        const b = sim.b;
        const am = a.grab.action === GrabAction.hold && n % 2 === 0 ? throwMask(a, direction) : 0;
        const bm = defenderMask(d, from + n, undefined, b, a);
        a2.push(am);
        d2.push(bm);
        sim.step(am, bm);
        cost.frames++;
        if (sim.b.visuals.hit !== hits) {
          children.push({ saved: sim.save(), inputs: joined(node.inputs, a2, d2), moves: [...node.moves, `${move.name}, ${direction} throw`], reads: node.reads, damage: sim.b.status.damage, hits: sim.b.visuals.hit });
          break;
        }
      }
    }
    free(caught);
    return children;
  }

  /** The best combo from a node: a beam over true follow-ups, each ending scored as if the attacker stopped there. */
  search(root: Node, d: Defender, rootPercent: number, stopAbove?: Ending): { readonly best: Ending; readonly nodes: number } {
    let frontier: Node[] = [root];
    let best: Ending | undefined;
    let nodes = 0;
    for (let depth = 0; depth <= DEPTH && frontier.length > 0; depth++) {
      const next: Node[] = [];
      for (const node of frontier) {
        nodes++;
        const { ending, line } = this.ending(node, d, rootPercent);
        if (better(best, ending)) best = ending;
        if (!ending.ko && depth < DEPTH) next.push(...this.followUps(node, d, line));
        releaseLine(line);
        if (node !== root) free(node.saved);
      }
      frontier = next.sort((x, y) => y.damage - x.damage).slice(0, BEAM);
      for (const dropped of next.slice(BEAM)) free(dropped.saved);
      next.length = 0;
      // A defender DI already worse for the attacker than another's best can't be the escape-optimal one.
      if (stopAbove !== undefined && best !== undefined && better(stopAbove, best)) break;
    }
    for (const node of frontier) if (node !== root) free(node.saved);
    if (best === undefined) throw new Error("a search with a root has an ending");
    return { best, nodes };
  }

  /** The attacker's best read of a tech chase at the end of `ending`: one tech option's punish, searched as a combo. */
  readTechChase(ending: Ending, di: Di, percent: number): Ending | undefined {
    const { sim } = this;
    // Replays the route but the last stretch, to the state before the landing.
    const held = expand(ending.route.held);
    // The route stops the frame before the defender lands; the tech press leads that landing.
    const landing = held.attacker.length + 1;
    let best: Ending | undefined;
    for (const option of TECH_OPTIONS) {
      const from = Math.max(0, landing - TECH_LEAD - 1);
      const replay = new Sim(sim.setup);
      for (let n = 0; n < from; n++) replay.step(held.attacker[n] ?? 0, held.defender[n] ?? 0);
      const start = replay.save();
      sim.load(start);
      const root: Node = { saved: start, inputs: { attacker: held.attacker.slice(0, from), defender: held.defender.slice(0, from) }, moves: [...ending.moves, `read ${option}`], reads: ending.reads + 1, damage: sim.b.status.damage, hits: sim.b.visuals.hit };
      const d: Defender = { name: option, di, tech: { option, landing: landing - from } };
      const { best: found } = this.search(root, d, percent);
      free(start);
      if (found.moves.length > root.moves.length && better(best, found)) best = found;
    }
    return best;
  }
}

function expand(held: readonly number[]): Inputs {
  const attacker: number[] = [];
  const defender: number[] = [];
  for (let run = 0; run + 2 < held.length; run += 3) {
    for (let n = 0; n < (held[run + 2] ?? 0); n++) {
      attacker.push(held[run] ?? 0);
      defender.push(held[run + 1] ?? 0);
    }
  }
  return { attacker, defender };
}

// ------------------------------------------------------------------ openers

const SPACINGS = [40, 70, 100, 20, 140, 200, 300] as const;
const OPENER_LIMIT = 90;

/** Aerial openers: a short hop's low and high strike on a standing defender, then air to air. */
const AERIAL_HEIGHTS: readonly (readonly [attacker: number, defender: number])[] = [[40, 0], [100, 0], [60, 60]];

function setupFor(attacker: Character, defender: Character, opener: Opener, percent: number, position: Position, spacing: number, heights: readonly [number, number]): ComboSetup {
  const ledge = mainDeckRight(STAGE) - 60;
  const defenderX = position === "ledge" ? ledge : spacing / 2;
  return {
    stage: STAGE, attacker, defender, attackerX: f32(defenderX - spacing), defenderX, facing: opener.facingAway === true ? -1 : 1,
    attackerZ: heights[0], defenderZ: heights[1], percent,
  };
}

/** Plays the opener from the setup; the root is the state just after its hit, or undefined when it doesn't land. */
function openerRoot(setup: ComboSetup, opener: Opener, d: Defender): { readonly sim: Sim; readonly root: Node } | undefined {
  const sim = new Sim(setup);
  const attacker: number[] = [];
  const defender: number[] = [];
  const before = startedOf(sim.a);
  let begun = false;
  for (let n = 1; n <= OPENER_LIMIT; n++) {
    const a = sim.a;
    const b = sim.b;
    const dash = opener.dash ?? 0;
    let am = 0;
    if (opener.throw !== undefined && a.grab.action === GrabAction.hold) am = n % 2 === 0 ? throwMask(a, opener.throw) : 0;
    else if (n <= dash) am = toward(a, b);
    else if (n === dash + 1) am = opener.move.press(a, b);
    const bm = defenderMask(d, n, undefined, b, a);
    attacker.push(am);
    defender.push(bm);
    sim.step(am, bm);
    cost.frames++;
    if (!begun && started(sim.a, before)) begun = true;
    if (sim.b.visuals.hit > 0) {
      const style = sim.a.attack.style;
      const own = opener.throw !== undefined ? sim.a.grab.action !== GrabAction.none || sim.b.launch.hitstun > 0
        : opener.move.kind === "special" ? begun
        : opener.move.style === AttackStyle.dashAttack ? style !== undefined && style !== AttackStyle.jab
        : style === opener.move.style;
      if (!begun || !own) return undefined;
      return { sim, root: { saved: sim.save(), inputs: { attacker, defender }, moves: [opener.name], reads: 0, damage: sim.b.status.damage, hits: sim.b.visuals.hit } };
    }
  }
  return undefined;
}

/** The spacing (and for an aerial, defender height) at which the opener lands with no DI, if any. */
function landingSetup(attacker: Character, defender: Character, opener: Opener, percent: number, position: Position): ComboSetup | undefined {
  const heights = opener.airborne === true ? AERIAL_HEIGHTS : [[0, 0] as const];
  for (const height of heights) for (const spacing of SPACINGS) {
    const setup = setupFor(attacker, defender, opener, percent, position, spacing, height);
    const played = openerRoot(setup, opener, { name: "none", di: "none" });
    if (played !== undefined) {
      free(played.root.saved);
      return setup;
    }
  }
  return undefined;
}

// ------------------------------------------------------------------ measuring a fighter

export interface Cell {
  readonly opener: string;
  readonly opponent: string;
  readonly position: Position;
  readonly percent: number;
  /** The combo the attacker gets against the DI that holds it to the least; undefined when the opener doesn't land. */
  readonly escape: Ending | undefined;
  readonly escapeDi: Di | undefined;
  /** The best combo against each DI searched to the end (others stopped once they beat the escape DI). */
  readonly byDi: Readonly<Partial<Record<Di, { readonly damage: number; readonly ko: boolean }>>>;
  readonly nodes: number;
}

export function measureCell(attacker: Character, defender: Character, opener: Opener, percent: number, position: Position): Cell {
  const base = { opener: opener.name, opponent: fighterName(defender), position, percent };
  const setup = landingSetup(attacker, defender, opener, percent, position);
  if (setup === undefined) return { ...base, escape: undefined, escapeDi: undefined, byDi: {}, nodes: 0 };
  let escape: Ending | undefined;
  let escapeDi: Di | undefined;
  let nodes = 0;
  const byDi: Partial<Record<Di, { readonly damage: number; readonly ko: boolean }>> = {};
  for (const di of DIS) {
    const d: Defender = { name: di, di };
    const played = openerRoot(setup, opener, d);
    if (played === undefined) continue;
    const explorer = new Explorer(played.sim);
    const found = explorer.search(played.root, d, percent, escape);
    free(played.root.saved);
    nodes += found.nodes;
    byDi[di] = { damage: found.best.damage, ko: found.best.ko };
    if (escape === undefined || better(found.best, escape)) {
      escape = found.best;
      escapeDi = di;
    }
  }
  return { ...base, escape, escapeDi, byDi, nodes };
}

// ------------------------------------------------------------------ a fighter against one opponent at one position

/** A conversion (Slippi's opening): the best opener's true combo and, through a tech chase, the attacker's reads, until the defender is free or loses the stock. */
export interface Conversion {
  readonly percent: number;
  readonly moves: readonly string[];
  readonly damage: number;
  readonly hits: number;
  readonly reads: number;
  readonly ko: boolean;
}

export interface CellSummary {
  readonly opener: string;
  readonly percent: number;
  readonly damage: number;
  readonly ko: boolean;
  readonly hits: number;
  readonly di: Di;
  readonly situation: Situation;
  readonly moves: readonly string[];
}

export interface RouteRecord {
  readonly opener: string;
  readonly percent: number;
  readonly moves: readonly string[];
  readonly damage: number;
  readonly ko: boolean;
  readonly di: Di;
  readonly route: ComboRoute;
}

export interface UnitReport {
  readonly attacker: string;
  readonly opponent: string;
  readonly position: Position;
  readonly cells: readonly CellSummary[];
  /** The lowest grid percent at which one opening takes the stock against escape-optimal DI. */
  readonly killPercent: number | undefined;
  readonly conversions: readonly Conversion[];
  /** Whether the chain reached a kill within MAX_CONVERSIONS. */
  readonly kills: boolean;
  /** Each opener's best route over the grid, for reference and replay. */
  readonly routes: readonly RouteRecord[];
  readonly frames: number;
}

/** Conversions a chain plays before it stops counting: a fighter this far from a kill is far outside every target. */
export const MAX_CONVERSIONS = 12;
/** Reads a conversion may chain through tech chases. */
const MAX_READS = 2;

const gridAt = (percent: number): number => {
  let at: number = PERCENTS[0];
  for (const grid of PERCENTS) if (grid <= percent) at = grid;
  return at;
};

/** Every opener at every grid percent, then the chain of conversions from 0% to the kill. */
export function measureUnit(attacker: Character, opponent: Character, position: Position, progress?: (opener: string) => void): UnitReport {
  const before = cost.frames;
  const cells: CellSummary[] = [];
  const endings = new Map<number, { readonly ending: Ending; readonly di: Di }>();
  const routes: RouteRecord[] = [];
  for (const opener of OPENERS) {
    let best: RouteRecord | undefined;
    for (const percent of PERCENTS) {
      const cell = measureCell(attacker, opponent, opener, percent, position);
      const { escape, escapeDi } = cell;
      if (escape === undefined || escapeDi === undefined) continue;
      cells.push({ opener: opener.name, percent, damage: escape.damage, ko: escape.ko, hits: escape.hits, di: escapeDi, situation: escape.situation, moves: escape.moves });
      const kept = endings.get(percent);
      if (kept === undefined || better(kept.ending, escape)) endings.set(percent, { ending: escape, di: escapeDi });
      const record: RouteRecord = { opener: opener.name, percent, moves: escape.moves, damage: escape.damage, ko: escape.ko, di: escapeDi, route: escape.route };
      if (best === undefined || (record.ko !== best.ko ? record.ko : record.ko ? record.percent < best.percent : record.damage > best.damage)) best = record;
    }
    if (best !== undefined) routes.push(best);
    progress?.(opener.name);
  }
  const killPercent = PERCENTS.find((percent) => endings.get(percent)?.ending.ko === true);
  const conversions: Conversion[] = [];
  let percent = 0;
  while (conversions.length < MAX_CONVERSIONS) {
    const grid = gridAt(percent);
    const start = endings.get(grid);
    if (start === undefined) break;
    let ending = start.ending;
    // A tech chase keeps the conversion going: the defender never gets 45 frames of grounded control.
    for (let reads = 0; reads < MAX_READS && !ending.ko && ending.situation === "tech chase"; reads++) {
      const read = new Explorer(new Sim(ending.route.setup)).readTechChase(ending, start.di, grid);
      if (read === undefined || !better(ending, read)) break;
      ending = read;
    }
    conversions.push({ percent, moves: ending.moves, damage: ending.damage, hits: ending.hits, reads: ending.reads, ko: ending.ko });
    if (ending.ko) break;
    percent = f32(percent + ending.damage);
  }
  return {
    attacker: fighterName(attacker), opponent: fighterName(opponent), position, cells, killPercent, conversions,
    kills: conversions.at(-1)?.ko === true, routes, frames: cost.frames - before,
  };
}

// ------------------------------------------------------------------ a fighter's summary

export interface FighterSummary {
  readonly fighter: string;
  /** The most damage any opener's true combo deals against escape-optimal DI. */
  readonly maxDamage: number;
  /** The median over opponents, positions and 0-120% of the best opener's true-combo damage. */
  readonly typicalDamage: number;
  /** The median over opponents and positions of the kill-confirm percent; undefined past the grid. */
  readonly killPercent: number | undefined;
  /** Mean conversions per kill from 0% (Slippi's count), over opponents and positions. */
  readonly openingsPerKill: number;
  /** Mean conversions of two or more hits per kill (pokes deal damage but aren't counted). */
  readonly multiHitOpeningsPerKill: number;
  /** Mean openings per kill counting each tech-chase read as an opening of its own. */
  readonly openingsWithReads: number;
  readonly damagePerOpening: number;
  /** Whether every chain reached a kill within MAX_CONVERSIONS. */
  readonly complete: boolean;
  readonly openers: readonly { readonly opener: string; readonly maxDamage: number; readonly typicalDamage: number; readonly killPercent: number | undefined }[];
  readonly bestRoute: RouteRecord | undefined;
}

const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] ?? 0 : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};
const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);

export function summarize(fighter: string, units: readonly UnitReport[]): FighterSummary {
  const cells = units.flatMap((unit) => unit.cells);
  const openerNames = OPENERS.map((opener) => opener.name).filter((name) => cells.some((cell) => cell.opener === name));
  const openers = openerNames.map((opener) => {
    const own = cells.filter((cell) => cell.opener === opener);
    const kills = units.map((unit) => unit.cells.find((cell) => cell.opener === opener && cell.ko)?.percent).filter((value): value is number => value !== undefined);
    return {
      opener, maxDamage: Math.max(...own.map((cell) => cell.damage)), typicalDamage: median(own.filter((cell) => cell.percent <= 120).map((cell) => cell.damage)),
      killPercent: kills.length === 0 ? undefined : median(kills),
    };
  });
  const bestPunish = units.flatMap((unit) => PERCENTS.filter((percent) => percent <= 120).map((percent) => Math.max(0, ...unit.cells.filter((cell) => cell.percent === percent).map((cell) => cell.damage))));
  const killPercents = units.map((unit) => unit.killPercent ?? Number.POSITIVE_INFINITY);
  const killMedian = median(killPercents);
  const conversions = units.flatMap((unit) => unit.conversions);
  const routes = units.flatMap((unit) => unit.routes);
  const bestRoute = routes.reduce<RouteRecord | undefined>((best, route) => (best === undefined || route.damage > best.damage ? route : best), undefined);
  return {
    fighter, maxDamage: Math.max(0, ...cells.map((cell) => cell.damage)), typicalDamage: median(bestPunish),
    killPercent: Number.isFinite(killMedian) ? killMedian : undefined,
    openingsPerKill: mean(units.map((unit) => unit.conversions.length)),
    multiHitOpeningsPerKill: mean(units.map((unit) => unit.conversions.filter((conversion) => conversion.hits >= 2).length)),
    openingsWithReads: mean(units.map((unit) => unit.conversions.reduce((sum, conversion) => sum + 1 + conversion.reads, 0))),
    damagePerOpening: mean(conversions.map((conversion) => conversion.damage)),
    complete: units.every((unit) => unit.kills), openers, bestRoute,
  };
}

/**
 * The best true combo from a state of another match, the frame after a hit's
 * hitlag ends: the root of the seeded-match check, where a real combo's
 * follow-ups must be among what the explorer finds.
 */
export function exploreFrom(setup: ComboSetup, state: ReplayState): Ending {
  const sim = new Sim(setup, state);
  const saved = sim.save();
  const root: Node = { saved, inputs: { attacker: [], defender: [] }, moves: ["real hit"], reads: 0, damage: sim.b.status.damage, hits: sim.b.visuals.hit };
  const { best } = new Explorer(sim).search(root, { name: "none", di: "none" }, sim.b.status.damage);
  free(saved);
  return best;
}

export { Explorer, Sim, openerRoot, expand, settled };
export type { Defender, Opener };
export const fighterNamed = (name: string): Character | undefined =>
  SELECTABLE_CHARACTERS.find((character) => fighterName(character).toLowerCase() === name.toLowerCase() || fighterName(character).split(" ")[0]?.toLowerCase() === name.toLowerCase());
