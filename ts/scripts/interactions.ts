// The interaction graph (#67): for each situation, the options both players
// have, which option beats which and by how many frames, and the frames in
// which a punish lands. Every number comes from playing the situation through
// the match frame executor (src/game/match/padScene.ts) from controller rows, so it reads
// the authored move data, physics, input buffers and contacts that a match
// uses. smashcraft:docs/design/interaction-graph.md defines the model.
import { Schema } from "effect";
import { Action } from "../src/game/input/actions";
import type { InputRow } from "../src/game/input/inputRow";
import { AttackPhase, AttackStyle, Character, DownState, LedgeState } from "../src/game/sim/codes";
import { attackPhase, canAttack, canShieldGrab, isIntangible } from "../src/game/sim/conditions";
import type { Fighter } from "../src/game/sim/fighter";
import { LEDGE_INTANGIBLE_FRAMES } from "../src/game/sim/ledge";
import { attackStartupFrames } from "../src/game/sim/moves";
import { mainDeckRight, mainDeckZ } from "../src/game/sim/stage";
import { resetMatchFrameInput } from "../src/game/match/frameInput";
import { type ReplayState, captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../src/game/replay/snapshot";
import { type Placement, type Scene, airborne, fighter, frameRows, projectileShieldActions, scene, tumbling } from "../src/game/match/padScene";

// ------------------------------------------------------------------ playing a situation

export type Held = readonly Action[];
type Side = 0 | 1;
/** A side's inputs on frame n (from 1), seeing both fighters as frame n - 1 left them. */
type Policy = (n: number, self: Fighter, other: Fighter) => Held;

const idle: Policy = () => [];

export interface Situation {
  readonly placements: readonly [Placement, Placement];
  /** Places the fighters before frame 1. */
  readonly prepare?: (first: Fighter, second: Fighter) => void;
  /** Each side's inputs while none of its options runs. */
  readonly policies: readonly [Policy, Policy];
  /** A continuation begins in the full state left by the previous contact. */
  readonly initial?: ReplayState;
  readonly previous?: readonly number[];
  /** SDI pulses and throw taps are independent of held buttons. */
  readonly amend?: (n: number, self: Fighter, other: Fighter, row: InputRow, side: Side) => void;
}

/** What starting an option changes, so a search can tell whether a press started it on its own frame. */
type StartKind = "attack" | "act" | "jump" | "dodge" | "shield" | "ledge" | "none";

export interface Option {
  readonly name: string;
  readonly kind: StartKind;
  /** The attack the press starts, when it starts one directly. */
  readonly style?: AttackStyle;
  /** Held i frames after the option's press (i = 0 is the press); `base` is what the side holds without it. */
  readonly input: (i: number, self: Fighter, other: Fighter, base: Held) => Held;
}

interface Choice {
  readonly option: Option;
  readonly start: number;
}

/** A side's options; each, from its start, decides the inputs, given those of the options started before it. */
type Plan = readonly Choice[];
type Plans = readonly [Plan, Plan];

const NONE: Plans = [[], []];

function policyWith(base: Policy, plan: Plan): Policy {
  if (plan.length === 0) return base;
  const ordered = [...plan].sort((a, b) => a.start - b.start);
  return (n, self, other) => {
    let held = base(n, self, other);
    for (const choice of ordered) if (choice.start <= n) held = choice.option.input(n - choice.start, self, other, held);
    return held;
  };
}

const plansWith = (plans: Plans, side: Side, choice: Choice): Plans => (side === 0 ? [[...plans[0], choice], plans[1]] : [plans[0], [...plans[1], choice]]);
const sideOf = (side: Side, plan: Plan, other: Plan = []): Plans => (side === 0 ? [plan, other] : [other, plan]);

interface Signature {
  readonly attackSerial: number;
  readonly attackStyle: AttackStyle | undefined;
  readonly squat: number;
  readonly jumpSerial: number;
  readonly groundDodge: number;
  readonly shield: boolean;
  readonly ledge: LedgeState;
}

const signature = (f: Fighter): Signature => ({
  attackSerial: f.attack.serial, attackStyle: f.attack.style, squat: f.jump.squat, jumpSerial: f.jump.serial,
  groundDodge: f.dodge.groundFrame, shield: f.shield.raised, ledge: f.ledge.state,
});

function began(kind: StartKind, before: Signature, after: Signature): boolean {
  switch (kind) {
    case "attack": return after.attackSerial !== before.attackSerial;
    // A get-up or ledge attack is the down or ledge option the press chose, not the fighter acting freely.
    case "act": return after.attackSerial !== before.attackSerial && after.attackStyle !== AttackStyle.getupAttack && after.attackStyle !== AttackStyle.ledgeAttack;
    case "jump": return (after.squat > 0 && before.squat === 0) || after.jumpSerial !== before.jumpSerial;
    case "dodge": return after.groundDodge === 1;
    case "shield": return after.shield && !before.shield;
    case "ledge": return before.ledge === LedgeState.hang && after.ledge !== LedgeState.hang;
    case "none": return true;
  }
}

/** Attack pressed on top of whatever the side holds: a jab, an aerial, or in a shield a shield grab. The first frame it starts on is when the side can act. */
const ACT_PROBE: Option = { name: "act", kind: "act", input: (i, _self, _other, base) => (i === 0 ? [...base, Action.attack] : base) };

/** A decisive contact: `by` hit or grabbed the other side on `frame`. */
interface Contact {
  readonly frame: number;
  readonly by: Side;
  readonly kind: "hit" | "grab";
}

interface Counters {
  readonly hit: number;
  readonly grab: number;
  readonly shield: number;
}

const counters = (f: Fighter): Counters => ({ hit: f.visuals.hit, grab: f.visuals.grab, shield: f.visuals.shield + f.visuals.shieldReflect });

interface Played {
  /** The first decisive contact; contacts on one frame from both sides are a trade. */
  readonly first: Contact | undefined;
  readonly trade: boolean;
  /** Frames on which a side's attack met the other's shield. */
  readonly shieldContacts: readonly { readonly frame: number; readonly by: Side }[];
}

/**
 * A situation played once with no options, keeping the state at the start of
 * every frame. A run with options branches from the first frame an option
 * starts, since every earlier frame is the same, and replays only the rest.
 */
/** States that released timelines hand back: allocating one costs more than playing a frame. */
const spareStates: ReplayState[] = [];

/** Free to start an attack, or a shield grab: the options it ran can no longer land. */
const settled = (f: Fighter): boolean => canAttack(f) || canShieldGrab(f);

export class Timeline {
  private readonly live: Scene;
  private readonly states: ReplayState[] = [];
  private readonly held: number[][] = [];

  constructor(private readonly sit: Situation, readonly last: number, retention: "all" | "first" = "all") {
    this.live = scene(0, sit.placements);
    if (sit.initial !== undefined) restoreReplaySnapshot(sit.initial, this.live.world, this.live.game, this.live.controls, this.live.runtime);
    if (sit.previous !== undefined) this.live.previous.splice(0, this.live.previous.length, ...sit.previous);
    const [a, b] = this.fighters();
    sit.prepare?.(a, b);
    // Combo candidates all branch on frame 1; they need no later baseline snapshots.
    for (let n = 1; n <= (retention === "first" ? 1 : last); n++) {
      const snapshot = spareStates.pop() ?? createReplaySnapshot();
      captureReplaySnapshot(snapshot, this.live.world, this.live.game, this.live.controls, this.live.runtime);
      this.states[n] = snapshot;
      this.held[n] = [...this.live.previous];
      this.step(n, sit.policies[0](n, a, b), sit.policies[1](n, b, a));
    }
  }

  private step(n: number, first: Held, second: Held): void {
    const [a, b] = this.fighters();
    frameRows(this.live, [first, second], (row, slot) => {
      if (slot === 0 || slot === 1) this.sit.amend?.(n, slot === 0 ? a : b, slot === 0 ? b : a, row, slot);
    });
  }

  /** Copies the current branch after its last executed frame. */
  capture(): { readonly state: ReplayState; readonly previous: readonly number[] } {
    const state = createReplaySnapshot();
    captureReplaySnapshot(state, this.live.world, this.live.game, this.live.controls, this.live.runtime);
    return { state, previous: [...this.live.previous] };
  }

  /** Returns the kept states for later timelines; this one can't be played again. */
  release(): void {
    for (const state of this.states) if (state !== undefined) spareStates.push(state);
    this.states.length = 0;
  }

  private fighters(): readonly [Fighter, Fighter] {
    return [fighter(this.live, 0), fighter(this.live, 1)];
  }

  private restore(n: number): void {
    const state = this.states[n];
    const held = this.held[n];
    if (state === undefined || held === undefined) throw new Error(`frame ${n} is outside the timeline's ${this.last} frames`);
    restoreReplaySnapshot(state, this.live.world, this.live.game, this.live.controls, this.live.runtime);
    this.live.previous.splice(0, this.live.previous.length, ...held);
    // The restored frame may be one the scene already captured a row for.
    resetMatchFrameInput(this.live.row);
  }

  /** Both fighters as they start frame n with no options. */
  at(n: number): readonly [Fighter, Fighter] {
    this.restore(n);
    return this.fighters();
  }

  /**
   * Plays frames until `last` with the plans, stopping after the first
   * decisive contact unless `throughContacts`; `each` sees every frame after
   * it runs and may stop the run.
   */
  play(plans: Plans, last: number, each?: (n: number, first: Fighter, second: Fighter) => boolean, throughContacts = false): Played {
    const from = firstStart(plans);
    this.restore(from);
    const [a, b] = this.fighters();
    const policies = [policyWith(this.sit.policies[0], plans[0]), policyWith(this.sit.policies[1], plans[1])] as const;
    let first: Contact | undefined;
    let trade = false;
    const shieldContacts: { frame: number; by: Side }[] = [];
    let before = [counters(a), counters(b)] as const;
    for (let n = from; n <= last; n++) {
      this.step(n, policies[0](n, a, b), policies[1](n, b, a));
      const after = [counters(a), counters(b)] as const;
      const contacts: Contact[] = [];
      for (const side of [0, 1] as const) {
        const by: Side = side === 0 ? 1 : 0;
        if (after[side].grab !== before[side].grab) contacts.push({ frame: n, by, kind: "grab" });
        else if (after[side].hit !== before[side].hit) contacts.push({ frame: n, by, kind: "hit" });
        if (after[side].shield !== before[side].shield) shieldContacts.push({ frame: n, by });
      }
      before = after;
      if (contacts.length > 0 && first === undefined) {
        first = contacts[0];
        trade = contacts.length > 1;
        if (!throughContacts) break;
      }
      if (each?.(n, a, b) === true) break;
    }
    return { first, trade, shieldContacts };
  }

  /**
   * The side's signature after each frame lo-1..hi following the plans (frame
   * 0 is the start), and the first frame at or past lo after which `enough`
   * holds, where the run stops.
   */
  private signatures(plans: Plans, side: Side, lo: number, hi: number, enough?: (self: Fighter) => boolean): { readonly after: readonly (Signature | undefined)[]; readonly stopped: number | undefined } {
    const from = firstStart(plans);
    const after: (Signature | undefined)[] = [];
    for (let n = Math.max(0, lo - 1); n < Math.min(from, hi + 1); n++) {
      const self = this.at(n + 1)[side];
      after[n] = signature(self);
      if (n >= lo && enough?.(self) === true) return { after, stopped: n };
    }
    let stopped: number | undefined;
    if (from <= hi) this.play(plans, hi, (n, a, b) => {
      const self = side === 0 ? a : b;
      after[n] = signature(self);
      if (n < lo || enough?.(self) !== true) return false;
      stopped = n;
      return true;
    }, true);
    return { after, stopped };
  }

  /**
   * The first frame in lo..hi on which a press of `option` starts it for
   * `side` after its plan so far, or undefined; a press on any later frame
   * starts it too. A start counts only when the press causes it: an action
   * the plan was starting anyway on that frame is not the press's. A guess
   * from the state, with the signatures up to it, is checked first.
   */
  earliest(plans: Plans, side: Side, option: Option, lo: number, hi: number, known?: { readonly guess: number; readonly after: readonly (Signature | undefined)[] }): number | undefined {
    if (option.kind === "none") return lo;
    let unpressed = known?.after ?? this.signatures(plans, side, lo, hi).after;
    const startsOn = (k: number): boolean => {
      const before = unpressed[k - 1];
      if (before === undefined) return false;
      let pressed: Signature | undefined;
      this.play(plansWith(plans, side, { option, start: k }), k, (n, a, b) => {
        if (n === k) pressed = signature(side === 0 ? a : b);
        return false;
      }, true);
      const anyway = unpressed[k];
      return pressed !== undefined && began(option.kind, before, pressed) && !(anyway !== undefined && began(option.kind, before, anyway));
    };
    if (known !== undefined) {
      const { guess } = known;
      if (startsOn(guess) && (guess === lo || !startsOn(guess - 1))) return guess;
      unpressed = this.signatures(plans, side, lo, hi).after;
    }
    let low = lo;
    let high = hi + 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (startsOn(middle)) high = middle;
      else low = middle + 1;
    }
    if (low > hi) return undefined;
    // A press that worked earlier but not later breaks the bisection's premise; scan instead.
    if (low > lo && startsOn(low - 1)) {
      for (let k = lo; k <= hi; k++) if (startsOn(k)) return k;
    }
    return low;
  }

  /** The first frame in lo..hi on which `side` can act while running its plan; undefined when it can't by hi. */
  actionable(plans: Plans, side: Side, lo: number, hi: number): number | undefined {
    // The state after a frame tells when a press on it would start an attack; the search confirms that guess.
    const { after, stopped } = this.signatures(plans, side, lo, hi, settled);
    return this.earliest(plans, side, ACT_PROBE, lo, hi, stopped === undefined ? undefined : { guess: stopped, after });
  }

  /** The same situation with `side` following `plan` as its own, so runs against that plan branch where they start. */
  following(side: Side, plan: Plan): Timeline {
    const [first, second] = this.sit.policies;
    return new Timeline({ ...this.sit, policies: side === 0 ? [policyWith(first, plan), second] : [first, policyWith(second, plan)] }, this.last);
  }

  /** Start frames from..until-1 at which `punisher`, started by `side`, lands on a frame from `landsFrom` to before `until`. */
  punishStarts(side: Side, punisher: Option, from: number, until: number, landsFrom = 0): number[] {
    const starts: number[] = [];
    for (let s = from; s < until; s++) {
      if (punisher.style !== undefined && s + attackStartupFrames(punisher.style) >= until) break;
      const before = signature(this.at(s)[side]);
      let pressed = false;
      let serial: number | undefined;
      const { first, trade } = this.play(sideOf(side, [{ option: punisher, start: s }]), until, (n, a, b) => {
        const self = side === 0 ? a : b;
        // A press that doesn't start the punish on its own frame starts it later, which a later s counts.
        if (n === s) {
          pressed = began(punisher.kind, before, signature(self));
          if (!pressed) return true;
        }
        // Once the punisher's attack has left its active frames it can no longer land.
        if (serial === undefined && self.attack.style !== undefined && self.attack.frame === 0) serial = self.attack.serial;
        return serial !== undefined && self.attack.serial === serial && (self.attack.style === undefined || attackPhase(self) === AttackPhase.recovery);
      });
      if (pressed && first !== undefined && first.by === side && !trade && first.frame >= landsFrom && first.frame < until) starts.push(s);
    }
    return starts;
  }
}

/** Releases `line` once `value`, computed from it, is ready. */
function released<T>(line: Timeline, value: T): T {
  line.release();
  return value;
}

function firstStart(plans: Plans): number {
  const starts = [...plans[0], ...plans[1]].map((choice) => choice.start);
  return starts.length === 0 ? 1 : Math.max(1, Math.min(...starts));
}


// ------------------------------------------------------------------ options

const towardOf = (self: Fighter, other: Fighter): Action => (other.motion.x >= self.motion.x ? Action.moveRight : Action.moveLeft);
const awayOf = (self: Fighter, other: Fighter): Action => (other.motion.x >= self.motion.x ? Action.moveLeft : Action.moveRight);
const smashToward = (self: Fighter, other: Fighter): Action => (other.motion.x >= self.motion.x ? Action.smashRight : Action.smashLeft);

const press = (name: string, kind: StartKind, held: (self: Fighter, other: Fighter) => Held): Option =>
  ({ name, kind, input: (i, self, other) => (i === 0 ? held(self, other) : []) });

/** Keeps doing what the side was doing: standing, holding its shield, hanging. */
const waiting = (name: string): Option => ({ name, kind: "none", input: (_i, _self, _other, base) => base });

const WAIT = waiting("wait");
const attack = (name: string, style: AttackStyle, held: (self: Fighter, other: Fighter) => Held): Option => ({ ...press(name, "attack", held), style });

const JAB = attack("jab", AttackStyle.jab, () => [Action.attack]);
const FTILT = attack("forward tilt", AttackStyle.forwardTilt, (self, other) => [Action.walk, towardOf(self, other), Action.attack]);
const UTILT = attack("up tilt", AttackStyle.upTilt, () => [Action.walk, Action.moveUp, Action.attack]);
const DTILT = attack("down tilt", AttackStyle.downTilt, () => [Action.walk, Action.moveDown, Action.attack]);
const FSMASH = attack("forward smash", AttackStyle.forwardSmash, (self, other) => [smashToward(self, other)]);
const USMASH = attack("up smash", AttackStyle.upSmash, () => [Action.smashUp]);
const DSMASH = attack("down smash", AttackStyle.downSmash, () => [Action.smashDown]);
const GRAB = attack("grab", AttackStyle.grab, () => [Action.grab]);
const SHIELD: Option = { name: "shield", kind: "shield", input: () => [Action.rightTrigger] };
const SPOT_DODGE = press("spot dodge", "dodge", () => [Action.rightTrigger, Action.moveDown]);
const ROLL_IN = press("roll in", "dodge", (self, other) => [Action.rightTrigger, towardOf(self, other)]);
const ROLL_AWAY = press("roll away", "dodge", (self, other) => [Action.rightTrigger, awayOf(self, other)]);

/** The punishes every situation tries: a standing fighter's ground attacks and grab. */
const GROUND_ATTACKS: readonly Option[] = [JAB, FTILT, UTILT, DTILT, FSMASH, USMASH, DSMASH, GRAB];

const AERIALS = [
  { style: AttackStyle.neutralAir, name: "neutral air" },
  { style: AttackStyle.forwardAir, name: "forward air" },
  { style: AttackStyle.backAir, name: "back air" },
  { style: AttackStyle.upAir, name: "up air" },
  { style: AttackStyle.downAir, name: "down air" },
] as const;
type Aerial = (typeof AERIALS)[number];

/** The press that starts `style` in the air: attack alone for a neutral air, the C-stick otherwise, leaving the stick free to drift. */
function aerialPress(self: Fighter, style: AttackStyle): Held {
  switch (style) {
    case AttackStyle.neutralAir: return [Action.attack];
    case AttackStyle.forwardAir: return [self.facing > 0 ? Action.smashRight : Action.smashLeft];
    case AttackStyle.backAir: return [self.facing > 0 ? Action.smashLeft : Action.smashRight];
    case AttackStyle.upAir: return [Action.smashUp];
    default: return [Action.smashDown];
  }
}

/** Out of shield: a short hop with the aerial buffered in jump squat, drifting toward the attacker once airborne. */
const oosAerial = (aerial: Aerial): Option => ({
  name: `jump ${aerial.name}`,
  kind: "jump",
  input: (i, self, other) => (i === 0 ? [Action.jump] : i === 1 ? aerialPress(self, aerial.style) : self.motion.grounded ? [] : [towardOf(self, other)]),
});

const SHIELD_GRAB = attack("shield grab", AttackStyle.grab, () => [Action.rightTrigger, Action.attack]);
const OUT_OF_SHIELD: readonly Option[] = [waiting("hold shield"), SHIELD_GRAB, ...AERIALS.map(oosAerial), SPOT_DODGE, ROLL_IN, ROLL_AWAY];
const OOS_PUNISH_TARGETS: readonly Option[] = [SHIELD_GRAB, SPOT_DODGE, ROLL_IN, ROLL_AWAY];
const AFTER_AERIAL: readonly Option[] = [WAIT, JAB, GRAB, SHIELD, SPOT_DODGE, ROLL_AWAY];

// ------------------------------------------------------------------ rows

export const FIGHTERS = [
  { character: Character.rifleman, name: "Rifleman", slug: "rifleman" },
  { character: Character.demonHunter, name: "Illidan", slug: "illidan" },
] as const;
export type FighterEntry = (typeof FIGHTERS)[number];

/** One option pair played from each option's earliest start. */
interface Cell {
  readonly row: string;
  readonly column: string;
  /** Who landed first: the row's option, the column's, both on one frame, or neither within the horizon. */
  readonly winner: "row" | "column" | "trade" | "none";
  readonly kind: "hit" | "grab" | "none";
  /** The decisive contact's frame; for "none", the row's lead in frames to act afterwards (negative: the column acts first). */
  readonly frame: number | undefined;
  /** An attack met a shield before the decision. */
  readonly blocked: boolean;
}

/** Punisher start frames that land before the target can act; frames count from the situation's frame 0. */
interface Window {
  readonly punisher: string;
  readonly starts: readonly number[];
}

interface OptionStart {
  readonly option: string;
  /** The first frame the option starts on, from frame 0; undefined when it can't start in the searched frames. */
  readonly start: number | undefined;
  /** The first frame its user can act again; undefined when not by the horizon. */
  readonly acts: number | undefined;
}

interface AerialRow {
  readonly kind: "aerial-on-shield";
  readonly fighter: string;
  readonly aerial: string;
  readonly spacing: "unspaced" | "spaced";
  readonly drift: string;
  /** Standing start distance, world units, between the fighters' centres. */
  readonly distance: number;
  /** The aerial's press, on the hop's frames from the jump press (frame 1). */
  readonly press: number;
  readonly attackFrame: number;
  /** Defender minus attacker x at contact. */
  readonly separation: number;
  readonly shieldstun: number;
  readonly attackerActs: number | undefined;
  readonly defenderActs: number | undefined;
  /** defenderActs - attackerActs read from the attacker's side: negative means the defender acts first. */
  readonly advantage: number | undefined;
  readonly defender: readonly OptionStart[];
  readonly attacker: readonly OptionStart[];
  /** Rows are the defender's options, columns the attacker's follow-ups. */
  readonly cells: readonly Cell[];
  /** The defender's options that land before the attacker can act. */
  readonly punishes: readonly Window[];
  /** For each listed defender option, the attacker's punishes of it. */
  readonly oosPunishes: readonly { readonly option: string; readonly acts: number | undefined; readonly punishes: readonly Window[] }[];
}

interface ParryRow {
  readonly kind: "aerial-on-powershield";
  readonly fighter: string;
  readonly aerial: string;
  readonly spacing: "unspaced" | "spaced";
  readonly drift: string;
  readonly distance: number;
  readonly press: number;
  /** The shield press, frames from the contact: -1 is the frame before. */
  readonly raise: number;
  /** The timed press parried the aerial rather than blocking it. */
  readonly parried: boolean;
  readonly attackerActs: number | undefined;
  readonly defenderActs: number | undefined;
  /** defenderActs - attackerActs: negative means the defender acts first. */
  readonly advantage: number | undefined;
  readonly defender: readonly OptionStart[];
  /** The defender's options out of the parry that land before the attacker can act. */
  readonly punishes: readonly Window[];
}

interface ReachRow {
  readonly kind: "aerial-reach";
  readonly fighter: string;
  readonly aerial: string;
  /** Start distances from which the aerial, approaching, meets the shield, as spans of the swept step. */
  readonly distances: string;
}

interface NeutralRow {
  readonly kind: "neutral";
  readonly fighter: string;
  readonly distance: number;
  readonly options: readonly OptionStart[];
  /** Rows are the fighter's options, columns the opponent's. */
  readonly cells: readonly Cell[];
  /** For each option, the opponent's punishes of it. */
  readonly punishes: readonly { readonly option: string; readonly punishes: readonly Window[] }[];
}

interface StateRow {
  readonly kind: "landing" | "ledge" | "tech";
  readonly fighter: string;
  readonly variant: string;
  readonly option: string;
  /** Frame 0's frame in the situation: touchdown, or the ledge option's start. */
  readonly zero: number;
  readonly acts: number | undefined;
  readonly intangible: string;
  /** Where the option leaves its user, world units from its start (landing, tech) or inward from the ledge. */
  readonly travel: number;
  /** The option's own hit on the waiting opponent, if it lands one. */
  readonly hits: number | undefined;
  readonly punishes: readonly Window[];
}

export type Row = AerialRow | ParryRow | ReachRow | NeutralRow | StateRow | ProjectileRow;

const relative = (frame: number | undefined, zero: number): number | undefined => (frame === undefined ? undefined : frame - zero);
const window = (punisher: string, starts: readonly number[], zero: number): Window => ({ punisher, starts: starts.map((s) => s - zero) });
const landed = (windows: readonly Window[]): Window[] => windows.filter((entry) => entry.starts.length > 0);
const round = (value: number): number => Math.round(value * 100) / 100;

function cellOf(row: string, column: string, played: Played, zero: number, lead: () => number | undefined): Cell {
  const blocked = played.shieldContacts.length > 0;
  const { first } = played;
  if (first === undefined) return { row, column, winner: "none", kind: "none", frame: lead(), blocked };
  return { row, column, winner: played.trade ? "trade" : first.by === 0 ? "column" : "row", kind: first.kind, frame: first.frame - zero, blocked };
}

// ------------------------------------------------------------------ aerial on shield

/**
 * The attacker approaches until its aerial meets the shield; then each drift
 * holds its own stick, and picks its press in the hop, after the terms in
 * smashcraft:docs/design/platform-fighters.md: an advancing aerial hits as low
 * as it can and lands in front, an early advancing one as high as it can and
 * lands in front, a fade hits as early as it can and drifts the rest of the
 * fall away from the shield (fade-back) or on through it (fade-forward).
 */
const DRIFTS = [
  { name: "advancing", after: 0, press: "latest" },
  { name: "early advancing", after: 0, press: "earliest" },
  { name: "fade-back", after: -1, press: "earliest" },
  { name: "fade-forward", after: 1, press: "earliest" },
] as const;
type Drift = (typeof DRIFTS)[number];

/** The shielding defender stands here, facing left; the attacker starts `distance` to its left. */
const DEFENDER_X = 150.0;
/** Start distances swept for each aerial, outward from 48, where two references' hurt capsules (radius 24) touch. */
const APPROACH_STEP = 6;
const APPROACH_DISTANCES = Array.from({ length: 43 }, (_, index) => 48 + APPROACH_STEP * index);
/** Frames after the contact that the options, cells and punishes are played. */
const SHIELD_HORIZON = 70;

const shieldMet = (defender: Fighter): boolean => defender.visuals.shield + defender.visuals.shieldReflect > 0;

/** The attacker starts left of the shield, so its approach and a fade-forward hold right and a fade-back left, wherever it ends up. */
function driftStick(drift: Drift, defender: Fighter): Held {
  const direction = shieldMet(defender) ? drift.after : 1;
  return direction === 0 ? [] : [direction > 0 ? Action.moveRight : Action.moveLeft];
}

/** A short hop from standing, released in jump squat, drifting by `drift` until it lands. */
const hop = (drift: Drift): Policy => (n, self, other) => {
  if (n === 1) return [Action.jump, ...driftStick(drift, other)];
  return self.motion.grounded && self.jump.squat === 0 ? [] : driftStick(drift, other);
};

/** The aerial pressed during the hop, which keeps drifting. */
const aerialOption = (aerial: Aerial): Option => ({
  name: aerial.name,
  kind: "attack",
  input: (i, self, _other, base) => (i > 0 ? base : aerial.style === AttackStyle.neutralAir ? [Action.attack] : [...base, ...aerialPress(self, aerial.style)]),
});

/** A back air is thrown with the back to the shield. */
const facingFor = (aerial: Aerial): number => (aerial.style === AttackStyle.backAir ? -1 : 1);

const holdShield: Policy = () => [Action.rightTrigger];

function approachSituation(character: Character, drift: Drift, distance: number, facing: number, aerial?: { readonly aerial: Aerial; readonly press: number }): Situation {
  const attacker = hop(drift);
  return {
    placements: [{ character, x: DEFENDER_X - distance, facing }, { character, x: DEFENDER_X, facing: -1 }],
    policies: [aerial === undefined ? attacker : policyWith(attacker, [{ option: aerialOption(aerial.aerial), start: aerial.press }]), holdShield],
  };
}

interface ShieldContact {
  readonly frame: number;
  readonly attackFrame: number;
  readonly separation: number;
  readonly shieldstun: number;
}

/** The first contact of an aerial pressed on frame `press` with the shield, made by that aerial. */
function shieldContact(line: Timeline, aerial: Aerial, press: number): ShieldContact | undefined {
  let contact: ShieldContact | undefined;
  let serial = -1;
  line.play(sideOf(0, [{ option: aerialOption(aerial), start: press }]), line.last + 2, (n, a, b) => {
    if (n === press) {
      if (a.attack.style !== aerial.style || a.attack.frame !== 0) return true;
      serial = a.attack.serial;
    }
    if (shieldMet(b)) {
      if (a.attack.serial === serial) contact = { frame: n, attackFrame: a.attack.frame, separation: b.motion.x - a.motion.x, shieldstun: b.shield.stun };
      return true;
    }
    return n > press && a.motion.grounded;
  });
  return contact;
}

/** The frames a short hop leaves the ground and lands back on it, and its height. */
function hopFrames(character: Character): { readonly takeoff: number; readonly landing: number; readonly apex: number } {
  const line = new Timeline(approachSituation(character, DRIFTS[0], 400.0, 1), 1);
  let takeoff = 0;
  let landing = 0;
  let apex = 0.0;
  line.play(NONE, 120, (n, a) => {
    if (takeoff === 0 && !a.motion.grounded) takeoff = n;
    apex = Math.max(apex, a.motion.z);
    if (takeoff > 0 && a.motion.grounded) landing = n;
    return landing > 0;
  });
  return { takeoff, landing, apex };
}

interface Found {
  readonly distance: number;
  readonly press: number;
  readonly contact: ShieldContact;
}

/** From one start distance, the latest and the earliest press in the hop that meet the shield. */
interface Reach {
  readonly latest: Found;
  readonly earliest: Found;
}

/** For each aerial, the start distances that reach the shield. Every drift approaches until contact, so one search serves them all. */
function searchApproaches(character: Character, aerials: readonly Aerial[], distances: readonly number[] = APPROACH_DISTANCES): ReadonlyMap<Aerial, readonly Reach[]> {
  const { takeoff, landing } = hopFrames(character);
  const found = new Map<Aerial, Reach[]>(aerials.map((aerial) => [aerial, []]));
  for (const distance of distances) {
    const lines = new Map<number, Timeline>();
    for (const aerial of aerials) {
      const facing = facingFor(aerial);
      const line = lines.get(facing) ?? new Timeline(approachSituation(character, DRIFTS[0], distance, facing), landing);
      lines.set(facing, line);
      const meets = (press: number): Found | undefined => {
        const contact = shieldContact(line, aerial, press);
        return contact === undefined ? undefined : { distance, press, contact };
      };
      let latest: Found | undefined;
      for (let press = landing - 1 - attackStartupFrames(aerial.style); press >= takeoff && latest === undefined; press--) latest = meets(press);
      if (latest === undefined) continue;
      let earliest = latest;
      for (let press = takeoff; press < latest.press; press++) {
        const met = meets(press);
        if (met === undefined) continue;
        earliest = met;
        break;
      }
      found.get(aerial)?.push({ latest, earliest });
    }
    for (const line of lines.values()) line.release();
  }
  return found;
}

/** One spacing's row; without `full`, only the frame advantage and the punishes of the aerial, leaving out the cells and what punishes the defender. */
function aerialRow(entry: FighterEntry, aerial: Aerial, drift: Drift, spacing: AerialRow["spacing"], found: Found, full: boolean): AerialRow {
  const sit = approachSituation(entry.character, drift, found.distance, facingFor(aerial), { aerial, press: found.press });
  const zero = found.contact.frame;
  const end = zero + SHIELD_HORIZON;
  const line = new Timeline(sit, end);
  const startsOf = (side: Side, options: readonly Option[], within: number): (number | undefined)[] =>
    options.map((option) => line.earliest(NONE, side, option, zero + 1, zero + within));
  const defenderStarts = startsOf(1, OUT_OF_SHIELD, 45);
  const attackerStarts = startsOf(0, AFTER_AERIAL, 60);
  const actsAfter = (side: Side, options: readonly Option[], starts: readonly (number | undefined)[]): (number | undefined)[] => options.map((option, index) => {
    const start = starts[index];
    return start === undefined ? undefined : line.actionable(sideOf(side, [{ option, start }]), side, start + 1, end);
  });
  const defenderAfter = full ? actsAfter(1, OUT_OF_SHIELD, defenderStarts) : [];
  const attackerAfter = full ? actsAfter(0, AFTER_AERIAL, attackerStarts) : [];
  const firstOf = (starts: readonly (number | undefined)[]): number | undefined => {
    const defined = starts.slice(1).filter((start): start is number => start !== undefined);
    return defined.length === 0 ? undefined : Math.min(...defined);
  };
  const attackerActs = firstOf(attackerStarts);
  const defenderActs = firstOf(defenderStarts);
  const cells: Cell[] = [];
  if (full) OUT_OF_SHIELD.forEach((defend, row) => {
    const defendStart = defenderStarts[row];
    if (defendStart === undefined) return;
    AFTER_AERIAL.forEach((follow, column) => {
      const followStart = attackerStarts[column];
      if (followStart === undefined) return;
      const plans: Plans = [[{ option: follow, start: followStart }], [{ option: defend, start: defendStart }]];
      const played = line.play(plans, end, (n, a, b) => n > Math.max(followStart, defendStart) && settled(a) && settled(b));
      cells.push(cellOf(defend.name, follow.name, played, zero, () => {
        // An option that met a shield can act again only after its last contact.
        const lastShield = Math.max(0, ...played.shieldContacts.map((contact) => contact.frame));
        const attackerAgain = line.actionable(plans, 0, Math.max(followStart, lastShield) + 1, end);
        const defenderAgain = line.actionable(plans, 1, Math.max(defendStart, lastShield) + 1, end);
        return attackerAgain === undefined || defenderAgain === undefined ? undefined : attackerAgain - defenderAgain;
      }));
    });
  });
  const punishes = attackerActs === undefined ? [] : OUT_OF_SHIELD.slice(1).flatMap((option, index) => {
    const start = defenderStarts[index + 1];
    return start === undefined ? [] : [window(option.name, line.punishStarts(1, option, start, attackerActs), zero)];
  });
  const oosPunishes = !full ? [] : OOS_PUNISH_TARGETS.map((option) => {
    const index = OUT_OF_SHIELD.indexOf(option);
    const start = defenderStarts[index];
    const acts = defenderAfter[index];
    if (start === undefined || acts === undefined || attackerActs === undefined) return { option: option.name, acts: relative(acts, zero), punishes: [] };
    const against = line.following(1, [{ option, start }]);
    const from = against.actionable(NONE, 0, zero + 1, end) ?? attackerActs;
    return released(against, { option: option.name, acts: acts - zero, punishes: landed(GROUND_ATTACKS.map((punisher) => window(punisher.name, against.punishStarts(0, punisher, from, acts), zero))) });
  });
  const startsRow = (options: readonly Option[], starts: readonly (number | undefined)[], after: readonly (number | undefined)[]): OptionStart[] =>
    options.map((option, index) => ({ option: option.name, start: relative(starts[index], zero), acts: relative(after[index], zero) }));
  return released(line, {
    kind: "aerial-on-shield", fighter: entry.name, aerial: aerial.name, spacing, drift: drift.name, distance: found.distance, press: found.press,
    attackFrame: found.contact.attackFrame, separation: round(found.contact.separation), shieldstun: found.contact.shieldstun,
    attackerActs: relative(attackerActs, zero), defenderActs: relative(defenderActs, zero),
    advantage: attackerActs === undefined || defenderActs === undefined ? undefined : defenderActs - attackerActs,
    defender: startsRow(OUT_OF_SHIELD, defenderStarts, defenderAfter), attacker: startsRow(AFTER_AERIAL, attackerStarts, attackerAfter),
    cells, punishes: landed(punishes), oosPunishes,
  });
}

/** Values as "a..b" spans of consecutive steps: frames step by 1, swept distances by their step. */
function spans(values: readonly number[], step = 1): string {
  const parts: string[] = [];
  let index = 0;
  while (index < values.length) {
    const start = values[index] ?? 0;
    let end = start;
    while (values[index + 1] === end + step) {
      end += step;
      index++;
    }
    parts.push(start === end ? `${start}` : `${start}..${end}`);
    index++;
  }
  return parts.join(", ");
}

/** The press a drift uses from one reach: the lowest hit for advancing, the earliest for early advancing and a fade. */
const pressFor = (drift: Drift, reach: Reach): Found => (drift.press === "latest" ? reach.latest : reach.earliest);

/** Each aerial on a shield: the start distances it reaches it from, and each drift's rows for the nearest (unspaced) and farthest (spaced). */
function aerialRows(entry: FighterEntry): Row[] {
  const found = searchApproaches(entry.character, AERIALS);
  return AERIALS.flatMap((aerial) => {
    const reaches = found.get(aerial) ?? [];
    const nearest = reaches[0];
    const farthest = reaches[reaches.length - 1];
    return [
      { kind: "aerial-reach", fighter: entry.name, aerial: aerial.name, distances: spans(reaches.map((reach) => reach.latest.distance), APPROACH_STEP) },
      ...DRIFTS.flatMap((drift) => [
        ...(nearest === undefined ? [] : [aerialRow(entry, aerial, drift, "unspaced", pressFor(drift, nearest), true)]),
        ...(farthest === undefined || farthest === nearest ? [] : [aerialRow(entry, aerial, drift, "spaced", pressFor(drift, farthest), true)]),
      ]),
      ...DRIFTS.flatMap((drift) => [
        ...(nearest === undefined ? [] : [parryRow(entry, aerial, drift, "unspaced", pressFor(drift, nearest))]),
        ...(farthest === undefined || farthest === nearest ? [] : [parryRow(entry, aerial, drift, "spaced", pressFor(drift, farthest))]),
      ]),
    ];
  });
}

/**
 * One aerial and drift on a shield from one start distance, as the graph's
 * row for that spacing would hold it without the follow-up cells: frame
 * advantage and the defender's punishes. Undefined when no press in the hop
 * meets the shield from there.
 */
export function aerialOnShield(fighter: string, aerial: string, drift: string, distance: number, spacing: AerialRow["spacing"]): AerialRow | undefined {
  const entry = fighterNamed(fighter);
  const move = AERIALS.find((candidate) => candidate.name === aerial);
  const path = DRIFTS.find((candidate) => candidate.name === drift);
  if (entry === undefined || move === undefined || path === undefined) throw new Error(`no aerial ${aerial} for ${fighter} with drift ${drift}`);
  const reach = searchApproaches(entry.character, [move], [distance]).get(move)?.[0];
  return reach === undefined ? undefined : aerialRow(entry, move, path, spacing, pressFor(path, reach), false);
}

// ------------------------------------------------------------------ aerial on a powershield

/** A parry's options: every ground attack as well as the out-of-shield ones, since a parry drops the shield without release lag. */
const OUT_OF_PARRY: readonly Option[] = [SHIELD_GRAB, ...GROUND_ATTACKS.filter((option) => option !== GRAB), ...AERIALS.map(oosAerial), SPOT_DODGE, ROLL_IN, ROLL_AWAY];

/** Stands without a shield, then raises it on `raise` and holds it: a full press, so the hit on the next frame is parried. */
const parryOn = (raise: number): Policy => (n) => (n >= raise ? [Action.rightTrigger] : []);

/**
 * The same approach as the held-shield row, with the defender pressing its
 * shield the frame before the aerial meets it. Frame 0 is the parried contact;
 * `parried` is false when the timed press blocked instead.
 */
function parryRow(entry: FighterEntry, aerial: Aerial, drift: Drift, spacing: ParryRow["spacing"], found: Found): ParryRow {
  const held = approachSituation(entry.character, drift, found.distance, facingFor(aerial), { aerial, press: found.press });
  const raise = found.contact.frame - 1;
  const line = new Timeline({ ...held, policies: [held.policies[0], parryOn(raise)] }, found.contact.frame + SHIELD_HORIZON + 2);
  let zero = found.contact.frame;
  let parried = false;
  line.play(NONE, line.last, (n, _a, b) => {
    if (b.visuals.shieldReflect + b.visuals.shield + b.visuals.hit === 0) return false;
    zero = n;
    parried = b.visuals.shieldReflect > 0;
    return true;
  }, true);
  const end = Math.min(line.last, zero + SHIELD_HORIZON);
  const defenderStarts = OUT_OF_PARRY.map((option) => line.earliest(NONE, 1, option, zero + 1, zero + 45));
  const attackerStarts = AFTER_AERIAL.slice(1).map((option) => line.earliest(NONE, 0, option, zero + 1, zero + 60));
  const firstOf = (starts: readonly (number | undefined)[]): number | undefined => {
    const defined = starts.filter((start): start is number => start !== undefined);
    return defined.length === 0 ? undefined : Math.min(...defined);
  };
  const attackerActs = firstOf(attackerStarts);
  const defenderActs = firstOf(defenderStarts);
  const punishes = attackerActs === undefined ? [] : OUT_OF_PARRY.flatMap((option, index) => {
    const start = defenderStarts[index];
    return start === undefined ? [] : [window(option.name, line.punishStarts(1, option, start, Math.min(attackerActs, end)), zero)];
  });
  return released(line, {
    kind: "aerial-on-powershield", fighter: entry.name, aerial: aerial.name, spacing, drift: drift.name, distance: found.distance, press: found.press,
    raise: raise - zero, parried, attackerActs: relative(attackerActs, zero), defenderActs: relative(defenderActs, zero),
    advantage: attackerActs === undefined || defenderActs === undefined ? undefined : defenderActs - attackerActs,
    defender: OUT_OF_PARRY.map((option, index) => ({ option: option.name, start: relative(defenderStarts[index], zero), acts: undefined })),
    punishes: landed(punishes),
  });
}

// ------------------------------------------------------------------ neutral: both fighters act on frame 1

const NEUTRAL_DISTANCES = [60, 120] as const;
const NEUTRAL_OPTIONS: readonly Option[] = [WAIT, JAB, FTILT, UTILT, DTILT, FSMASH, USMASH, DSMASH, GRAB, SHIELD, SPOT_DODGE, ROLL_IN, ROLL_AWAY];
const NEUTRAL_HORIZON = 100;

function neutralRow(entry: FighterEntry, distance: number): NeutralRow {
  const half = distance / 2;
  const line = new Timeline({
    placements: [{ character: entry.character, x: -half, facing: 1 }, { character: entry.character, x: half, facing: -1 }],
    policies: [idle, idle],
  }, NEUTRAL_HORIZON);
  const choice = (option: Option): Choice => ({ option, start: 1 });
  const acts = NEUTRAL_OPTIONS.map((option) => line.actionable([[choice(option)], []], 0, 2, NEUTRAL_HORIZON));
  const cells: Cell[] = [];
  NEUTRAL_OPTIONS.forEach((mine, row) => NEUTRAL_OPTIONS.forEach((theirs, column) => {
    // The column's fighter takes slot 0 so that winner "row" is slot 1, as in the other situations' cells.
    const plans: Plans = [[choice(theirs)], [choice(mine)]];
    const played = line.play(plans, NEUTRAL_HORIZON, (n, a, b) => n > 1 && settled(a) && settled(b));
    cells.push(cellOf(mine.name, theirs.name, played, 0, () => {
      // An option that met a shield can act again only after its last contact.
      const lastShield = Math.max(0, ...played.shieldContacts.map((contact) => contact.frame));
      const columnActs = line.actionable(plans, 0, Math.max(1, lastShield) + 1, NEUTRAL_HORIZON);
      const rowActs = line.actionable(plans, 1, Math.max(1, lastShield) + 1, NEUTRAL_HORIZON);
      return columnActs === undefined || rowActs === undefined ? undefined : columnActs - rowActs;
    }));
  }));
  const punishes = NEUTRAL_OPTIONS.flatMap((option, index) => {
    const ready = acts[index];
    if (option === WAIT || option === SHIELD || ready === undefined) return [];
    const against = line.following(0, [choice(option)]);
    return [released(against, { option: option.name, punishes: landed(GROUND_ATTACKS.map((punisher) => window(punisher.name, against.punishStarts(1, punisher, 1, ready), 0))) })];
  });
  return released(line, {
    kind: "neutral", fighter: entry.name, distance, cells, punishes,
    options: NEUTRAL_OPTIONS.map((option, index) => ({ option: option.name, start: 1, acts: acts[index] })),
  });
}

// ------------------------------------------------------------------ landing, ledge and tech

interface StateSituation {
  readonly kind: StateRow["kind"];
  readonly variant: string;
  readonly line: Timeline;
  readonly options: readonly { readonly option: Option; readonly start: number }[];
  /** Frame 0 for one option's row, given its plan: from it the option's user is committed, so only contacts from it count as punishes. */
  readonly zero: (plan: Plan) => number;
  /** Where its user ends, measured as the row's travel. */
  readonly travel: (self: Fighter, startX: number) => number;
  /** The last frame a punish is tried when the option's user doesn't act by then. */
  readonly cap: number;
  readonly horizon: number;
}

function stateRows(entry: FighterEntry, sit: StateSituation): StateRow[] {
  return sit.options.map(({ option, start }) => {
    const plan: Plan = [{ option, start }];
    const zero = sit.zero(plan);
    const startX = sit.line.at(start)[0].motion.x;
    const line = sit.line.following(0, plan);
    const acts = line.actionable(NONE, 0, Math.max(start + 1, zero), sit.horizon);
    const until = Math.min(acts ?? sit.cap, sit.cap);
    const flags: boolean[] = [];
    let travel = 0.0;
    const own = line.play(NONE, until, (n, a) => {
      if (n >= zero) flags[n - zero] = isIntangible(a);
      travel = sit.travel(a, startX);
      return false;
    });
    const hits = own.first !== undefined && own.first.by === 0 ? own.first.frame - zero : undefined;
    const intangible = flags.flatMap((flag, index) => (flag ? [index] : []));
    return released(line, {
      kind: sit.kind, fighter: entry.name, variant: sit.variant, option: option.name, zero, acts: relative(acts, zero),
      intangible: intangible.length === 0 ? "none" : spans(intangible), travel: round(travel), hits,
      punishes: landed(GROUND_ATTACKS.map((punisher) => window(punisher.name, line.punishStarts(1, punisher, Math.max(1, start), until, zero), zero))),
    });
  });
}

/** The first frame on which `side`'s fighter stands on a deck after frame `after`, following `plan`. */
function touchdown(line: Timeline, plan: Plan, after: number, last: number): number {
  let landing = last;
  line.play(sideOf(0, plan), last, (n, a) => {
    if (n > after && a.motion.grounded) {
      landing = n;
      return true;
    }
    return false;
  }, true);
  return landing;
}

const LANDING_GAP = 60.0;
const OPPONENT_X = 150.0;

function landingRows(entry: FighterEntry): StateRow[] {
  const { apex } = hopFrames(entry.character);
  const horizon = 90;
  const line = new Timeline({
    placements: [{ character: entry.character, x: OPPONENT_X - LANDING_GAP, facing: 1 }, { character: entry.character, x: OPPONENT_X, facing: -1 }],
    prepare: (lander) => airborne(lander, OPPONENT_X - LANDING_GAP, apex),
    policies: [idle, idle],
  }, horizon);
  const holding = (name: string, held: (self: Fighter, other: Fighter) => Held): Option => ({ name, kind: "none", input: (_i, self, other) => held(self, other) });
  const options: Option[] = [
    { ...WAIT, name: "empty landing" },
    holding("fast fall", () => [Action.moveDown]),
    holding("drift away", (self, other) => (self.motion.grounded ? [] : [awayOf(self, other)])),
    ...AERIALS.map((aerial): Option => ({ name: `${aerial.name} landing`, kind: "attack", input: (i, self) => (i === 0 ? aerialPress(self, aerial.style) : []) })),
    press("air dodge down", "none", () => [Action.leftTrigger, Action.moveDown]),
  ];
  return released(line, stateRows(entry, {
    kind: "landing", variant: `from a short hop's apex, ${LANDING_GAP} in front`, line, horizon, cap: horizon,
    options: options.map((option) => ({ option, start: 1 })),
    zero: (plan) => touchdown(line, plan, 0, horizon),
    travel: (self, startX) => self.motion.x - startX,
  }));
}

const LEDGE_X = mainDeckRight(0);
/** The opponent waits this far inside the ledge, facing it. */
const LEDGE_GUARD = 70.0;

function ledgeRows(entry: FighterEntry): StateRow[] {
  const sit: Situation = {
    placements: [{ character: entry.character, x: LEDGE_X + 30.0, facing: -1 }, { character: entry.character, x: LEDGE_X - LEDGE_GUARD, facing: 1 }],
    prepare: (hanger) => {
      airborne(hanger, LEDGE_X + 30.0, mainDeckZ(0));
      hanger.jump.remaining = 1;
    },
    policies: [idle, idle],
  };
  let caught = 0;
  new Timeline(sit, 1).play(NONE, 60, (n, a) => {
    if (a.ledge.state === LedgeState.hang) caught = n;
    return caught > 0;
  });
  if (caught === 0) throw new Error(`${entry.name} never caught the ledge`);
  const horizon = caught + LEDGE_INTANGIBLE_FRAMES + 120;
  const line = new Timeline(sit, horizon);
  const options: Option[] = [
    waiting("hang"),
    press("climb", "ledge", () => [Action.moveUp]),
    press("roll", "ledge", () => [Action.rightTrigger]),
    press("ledge attack", "ledge", () => [Action.attack]),
    press("jump", "ledge", () => [Action.jump]),
    press("drop", "ledge", () => [Action.moveDown]),
  ];
  return released(line, [
    { variant: "on the catch", from: caught + 1 },
    { variant: `after ${LEDGE_INTANGIBLE_FRAMES} frames hanging`, from: caught + LEDGE_INTANGIBLE_FRAMES },
  ].flatMap(({ variant, from }) => stateRows(entry, {
    kind: "ledge", variant, line, horizon, cap: from + 90,
    options: options.map((option) => ({ option, start: line.earliest(NONE, 0, option, from, from + 10) ?? from })),
    zero: (plan) => plan[0]?.start ?? from,
    travel: (self) => LEDGE_X - self.motion.x,
  })));
}

const TECH_GAP = 70.0;

function techRows(entry: FighterEntry): StateRow[] {
  const horizon = 400;
  const line = new Timeline({
    placements: [{ character: entry.character, x: 0.0, facing: 1 }, { character: entry.character, x: TECH_GAP, facing: -1 }],
    prepare: (downed) => tumbling(downed, 0.0, 30.0),
    policies: [idle, idle],
  }, horizon);
  const scripted = (name: string, held: (i: number, self: Fighter, other: Fighter) => Held): Option => ({ name, kind: "none", input: held });
  const bound = (self: Fighter): boolean => self.motion.grounded && self.down.state === DownState.bound;
  const options: Option[] = [
    scripted("tech in place", (i) => (i === 0 ? [Action.leftTrigger] : [])),
    scripted("tech roll in", (i, self, other) => (i === 0 ? [Action.leftTrigger, towardOf(self, other)] : self.motion.grounded ? [] : [towardOf(self, other)])),
    scripted("tech roll away", (i, self, other) => (i === 0 ? [Action.leftTrigger, awayOf(self, other)] : self.motion.grounded ? [] : [awayOf(self, other)])),
    scripted("missed tech, lie", () => []),
    scripted("missed tech, stand", (_i, self) => (self.down.state === DownState.wait ? [Action.moveUp] : [])),
    scripted("missed tech, roll in", (_i, self, other) => (bound(self) ? [towardOf(self, other)] : [])),
    scripted("missed tech, roll away", (_i, self, other) => (bound(self) ? [awayOf(self, other)] : [])),
    scripted("missed tech, get-up attack", (_i, self) => (bound(self) ? [Action.attack] : [])),
  ];
  return released(line, stateRows(entry, {
    kind: "tech", variant: `tumbling onto the stage, ${TECH_GAP} from the opponent`, line, horizon, cap: 120,
    options: options.map((option) => ({ option, start: 1 })),
    zero: (plan) => touchdown(line, plan, 0, horizon),
    travel: (self, startX) => self.motion.x - startX,
  }));
}

// ------------------------------------------------------------------ rows for a fighter

// ------------------------------------------------------------------ projectiles (#98)

/**
 * The special inputs a fighter fires projectiles from. Rows for a source are
 * played from these spacings: point blank, mid range and long range.
 */
const SPECIAL_INPUTS = [
  { name: "neutral special", held: (): Held => [Action.special] },
  { name: "side special", held: (self: Fighter): Held => [self.facing > 0 ? Action.moveRight : Action.moveLeft, Action.special] },
  { name: "up special", held: (): Held => [Action.moveUp, Action.special] },
  { name: "down special", held: (): Held => [Action.moveDown, Action.special] },
] as const;
type SpecialInput = (typeof SPECIAL_INPUTS)[number];
/** Feral Spirit follows the roster's summon rule even while its wolves run. */
export const isProjectileSummon = (character: Character, source: string): boolean => character === Character.thrall && source === "side special";
export const PROJECTILE_SPACINGS = [60, 240, 480] as const;
/** The shooter fires on this frame, so a shield held from frame 1 has left its powershield frames. */
const FIRE = 10;
const PROJECTILE_HORIZON = 150;
/** Full hop: jump held through jump squat. */
const FULL_JUMP: Option = { name: "jump", kind: "jump", input: (i) => (i < 8 ? [Action.jump] : []) };
const PROJECTILE_ANSWERS: readonly Option[] = [FULL_JUMP, SPOT_DODGE, ROLL_IN, ROLL_AWAY];
const OOS_PUNISHERS: readonly Option[] = [SHIELD_GRAB, ...AERIALS.map(oosAerial)];

interface ProjectileRow {
  readonly kind: "projectile";
  readonly fighter: string;
  /** Source and spacing: "neutral special at 60". */
  readonly variant: string;
  readonly source: string;
  readonly distance: number;
  /** Frames the projectile lives, flying clear of everyone. */
  readonly flight: number;
  readonly traveling: boolean;
  /** The most of the fighter's projectiles out at once with this source pressed as often as it starts. */
  readonly mostOut: number;
  /** Frames from the press to the projectile meeting a shield held from frame 1; undefined when it never reaches one. */
  readonly arrives: number | undefined;
  /** It passed the shrinking shield and hit the body behind it. */
  readonly pokes: boolean;
  /** Whether a standing defender that does nothing is hit. */
  readonly hitsIdle: boolean;
  /** From the shield contact (frame 0). */
  readonly shooterActs: number | undefined;
  readonly defenderActs: number | undefined;
  readonly advantage: number | undefined;
  /** Out-of-shield options that land before the shooter can act, by start frame from the contact. */
  readonly punishes: readonly Window[];
  /** Shield presses, from the contact frame, that reflect it. */
  readonly powershield: readonly number[];
  /** Options other than a shield that leave a standing defender unhit, by press frame from the contact frame. */
  readonly answers: readonly { readonly option: string; readonly starts: readonly number[] }[];
}

const shooterPolicy = (input: SpecialInput, fire: number, every = 0): Policy => (n, self) =>
  (n === fire || (every > 0 && n > fire && (n - fire) % every === 0) ? input.held(self) : []);

const liveProjectiles = (f: Fighter): number => f.projectiles.filter((projectile) => projectile.life > 0).length;

/**
 * Fired away from everyone: how long the first projectile lives (its own
 * slot, not a stream of later shots overlapping it), whether it moves, and
 * the most out while the input repeats. A projectile sent backward
 * (Thunder Clap's rear wave) can reach the idle fighter behind; the flight
 * runs through that contact, which ends the projectile, instead of stopping
 * there and reading the projectile as never ending.
 */
function projectileFlight(character: Character, input: SpecialInput): { readonly flight: number; readonly traveling: boolean; readonly mostOut: number } | undefined {
  const away = (every: number): Timeline => new Timeline({
    placements: [{ character, x: 0.0, facing: 1 }, { character, x: -400.0, facing: 1 }],
    policies: [shooterPolicy(input, 1, every), idle],
  }, 1);
  const once = away(0);
  let born: number | undefined;
  let died: number | undefined;
  let traveling = false;
  let slot = -1;
  let life = 0;
  once.play(NONE, PROJECTILE_HORIZON, (n, a) => {
    if (born === undefined) {
      const first = a.projectiles.find((projectile) => projectile.life > 0);
      if (first === undefined) return false;
      slot = a.projectiles.indexOf(first);
      born = n;
      life = first.life;
      traveling = !isProjectileSummon(character, input.name) && (first.velocityX !== 0 || first.velocityZ !== 0);
      return false;
    }
    // A slot whose life rises was retired and refilled by a later shot.
    const next = a.projectiles[slot]?.life ?? 0;
    if (next <= 0 || next > life) died = n;
    life = next;
    return died !== undefined;
  }, true);
  once.release();
  if (born === undefined) return undefined;
  const spam = away(2);
  let mostOut = 0;
  spam.play(NONE, 300, (_n, a) => {
    mostOut = Math.max(mostOut, liveProjectiles(a));
    return false;
  });
  spam.release();
  return { flight: (died ?? PROJECTILE_HORIZON + 1) - born, traveling, mostOut };
}

/** One source fired from `distance` at a mirror defender. */
function projectileRow(character: Character, name: string, input: SpecialInput, distance: number, flight: { readonly flight: number; readonly traveling: boolean; readonly mostOut: number }): ProjectileRow {
  const placements: Situation["placements"] = [{ character, x: -distance / 2, facing: 1 }, { character, x: distance / 2, facing: -1 }];
  const last = FIRE + PROJECTILE_HORIZON;
  const projectileShield: Option = { name: "shield", kind: "shield", input: (_i, _self, shooter) => projectileShieldActions(shooter) };
  const shielded = new Timeline({ placements, policies: [shooterPolicy(input, FIRE), (_n, _self, shooter) => projectileShieldActions(shooter)] }, last);
  let contact: number | undefined;
  let pokes = false;
  shielded.play(NONE, last, (n, _a, b) => {
    if (n > FIRE && b.visuals.shield + b.visuals.shieldReflect > 0) contact = n;
    if (n > FIRE && contact === undefined && b.status.damage > 0) {
      contact = n;
      pokes = true;
    }
    return contact !== undefined;
  }, true);
  const base = { kind: "projectile", fighter: name, variant: `${input.name} at ${distance}`, source: input.name, distance, ...flight } as const;
  const standing = new Timeline({ placements, policies: [shooterPolicy(input, FIRE), idle] }, last);
  /** Whether the standing defender is hit; once the projectile has met someone, a run ends when the shooter has none left. */
  const hit = (plans: Plans, after = last): boolean => {
    let hurt = false;
    standing.play(plans, last, (n, a, b) => {
      hurt = b.status.damage > 0;
      return hurt || (n > after && liveProjectiles(a) === 0);
    }, true);
    return hurt;
  };
  const hitsIdle = hit(NONE);
  if (contact === undefined) {
    shielded.release();
    standing.release();
    return { ...base, arrives: undefined, pokes, hitsIdle, shooterActs: undefined, defenderActs: undefined, advantage: undefined, punishes: [], powershield: [], answers: [] };
  }
  const zero = contact;
  const shooterActs = pokes ? undefined : shielded.actionable(NONE, 0, zero, last);
  const defenderActs = pokes ? undefined : shielded.actionable(NONE, 1, zero, last);
  const punishes = shooterActs === undefined ? [] : OOS_PUNISHERS.flatMap((option) => {
    const start = shielded.earliest(NONE, 1, option, zero, Math.min(last, zero + 45));
    return start === undefined ? [] : [window(option.name, shielded.punishStarts(1, option, start, shooterActs), zero)];
  });
  const presses = Array.from({ length: zero - FIRE + 1 }, (_, index) => FIRE + index);
  const powershield = presses.filter((start) => {
    let reflected = false;
    standing.play(sideOf(1, [{ option: projectileShield, start }]), last, (n, a, b) => {
      reflected = b.visuals.shieldReflect > 0;
      return reflected || b.status.damage > 0 || (n > zero && liveProjectiles(a) === 0);
    }, true);
    return reflected;
  }).map((start) => start - zero);
  const answers = PROJECTILE_ANSWERS.map((option) => ({
    option: option.name,
    starts: presses.filter((start) => !hit(sideOf(1, [{ option, start }]), zero)).map((start) => start - zero),
  }));
  shielded.release();
  standing.release();
  return {
    ...base, arrives: zero - FIRE, pokes, hitsIdle, shooterActs: relative(shooterActs, zero), defenderActs: relative(defenderActs, zero),
    advantage: shooterActs === undefined || defenderActs === undefined ? undefined : defenderActs - shooterActs,
    punishes: landed(punishes), powershield, answers,
  };
}

/** Each out-of-shield option and the first frame a press starts it from a shield held since frame 1; undefined when it never does. */
export function outOfShieldStarts(character: Character): { readonly option: string; readonly start: number | undefined }[] {
  const line = new Timeline({
    placements: [{ character, x: 0.0, facing: 1 }, { character, x: 400.0, facing: -1 }],
    policies: [() => [Action.rightTrigger], idle],
  }, 60);
  return released(line, OUT_OF_SHIELD.slice(1).map((option) => ({ option: option.name, start: line.earliest(NONE, 0, option, 12, 60) })));
}

/** Every projectile source of a fighter, fired at a mirror defender from each spacing. */
export function projectileRows(character: Character, name: string): ProjectileRow[] {
  return SPECIAL_INPUTS.flatMap((input) => {
    const flight = projectileFlight(character, input);
    return flight === undefined ? [] : PROJECTILE_SPACINGS.map((distance) => projectileRow(character, name, input, distance, flight));
  });
}

export function fighterNamed(name: string): FighterEntry | undefined {
  return FIGHTERS.find((entry) => entry.name.toLowerCase() === name.toLowerCase() || entry.slug === name.toLowerCase());
}

/** Every situation's rows for one fighter, in its mirror match. */
export function interactionRows(entry: FighterEntry): Row[] {
  return [
    ...aerialRows(entry),
    ...NEUTRAL_DISTANCES.map((distance) => neutralRow(entry, distance)),
    ...landingRows(entry),
    ...ledgeRows(entry),
    ...techRows(entry),
    ...projectileRows(entry.character, entry.name),
  ];
}

// ------------------------------------------------------------------ tables and graphs

const table = (header: readonly string[], body: readonly (readonly string[])[]): string[] =>
  [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...body.map((cells) => `| ${cells.join(" | ")} |`)];
const show = (value: number | undefined): string => (value === undefined ? "-" : String(value));
const signed = (value: number | undefined): string => (value === undefined ? "-" : value > 0 ? `+${value}` : String(value));
const windowsText = (windows: readonly Window[], none = "none"): string =>
  windows.length === 0 ? none : windows.map((entry) => `${entry.punisher} ${spans(entry.starts)}`).join("; ");
const unique = (names: readonly string[]): string[] => [...new Set(names)];

function cellText(cell: Cell): string {
  const grab = cell.kind === "grab" ? " grab" : "";
  const shield = cell.blocked ? " (shield)" : "";
  switch (cell.winner) {
    case "row": return `W ${cell.frame ?? "-"}${grab}${shield}`;
    case "column": return `L ${cell.frame ?? "-"}${grab}${shield}`;
    case "trade": return `T ${cell.frame ?? "-"}`;
    case "none": return `${signed(cell.frame)}${shield}`;
  }
}

function matrix(cells: readonly Cell[]): string[] {
  const columns = unique(cells.map((cell) => cell.column));
  return table(["", ...columns], unique(cells.map((cell) => cell.row)).map((row) =>
    [row, ...columns.map((column) => {
      const cell = cells.find((candidate) => candidate.row === row && candidate.column === column);
      return cell === undefined ? "-" : cellText(cell);
    })]));
}

interface Edge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly dashed?: boolean;
}

const nodeId = (name: string): string => name.replace(/[^a-z0-9]+/gi, "_");

/** A Mermaid flowchart: each edge runs from the option that beats to the option it beats. */
function mermaid(nodes: ReadonlyMap<string, string>, edges: readonly Edge[]): string[] {
  return [
    "```mermaid",
    "flowchart LR",
    ...[...nodes].map(([id, label]) => `  ${nodeId(id)}["${label}"]`),
    ...edges.map((edge) => `  ${nodeId(edge.from)} ${edge.dashed === true ? "-.->" : "-->"}|"${edge.label}"| ${nodeId(edge.to)}`),
    "```",
  ];
}

const isRow = <K extends Row["kind"]>(kind: K) => (row: Row): row is Extract<Row, { kind: K }> => row.kind === kind;

function aerialSection(entry: FighterEntry, rows: readonly Row[]): string[] {
  const reach = rows.filter(isRow("aerial-reach"));
  const pressure = rows.filter(isRow("aerial-on-shield"));
  const variant = (row: AerialRow): string => `${row.spacing}, ${row.drift}`;
  const lines = [
    "## Aerial on shield", "",
    `${entry.name} short hops at a shielding ${entry.name} from a standing start, approaching until the aerial meets the shield. Advancing presses the aerial as late in the hop as still meets the shield and holds no stick after; early advancing presses it as early as meets the shield and holds no stick after, landing in front; fade-back and fade-forward press it as early as meets the shield, then hold away or on through for the rest of the fall. Unspaced starts from the nearest distance that reaches the shield, spaced from the farthest. Frame 0 is the frame the aerial meets the shield; the other frames count from it. Advantage is the defender's first action minus the attacker's: negative means the defender acts first. Punish start frames are when the defender's option can start and still land before the attacker can act.`, "",
    "### Start distances that reach the shield", "",
    ...table(["Aerial", "Start distances"], AERIALS.map((aerial) =>
      [aerial.name, reach.find((row) => row.aerial === aerial.name)?.distances || "none"])),
    "", "### Frame advantage and punishes", "",
    ...table(["Aerial", "Spacing", "Drift", "Start", "Hit at", "Separation", "Shieldstun", "Attacker acts", "Defender acts", "Advantage", "Punished by (start frames)"],
      pressure.map((row) => [row.aerial, row.spacing, row.drift, String(row.distance), `${row.press} + ${row.attackFrame}`, String(row.separation), String(row.shieldstun),
        show(row.attackerActs), show(row.defenderActs), signed(row.advantage), windowsText(row.punishes, "safe")])),
    "", "### Out of shield, and the attacker's punishes", "",
    "Each cell: the frame the defender's option lets it act again, then the attacker's ground options that land before that, with their start frames; or, when the option lands on an attacker who waits, that contact.", "",
    ...table(["Aerial", "Spacing", "Drift", ...OOS_PUNISH_TARGETS.map((option) => option.name)], pressure.map((row) => [row.aerial, row.spacing, row.drift,
      ...OOS_PUNISH_TARGETS.map((option) => {
        const entry = row.oosPunishes.find((candidate) => candidate.option === option.name);
        const alone = row.cells.find((cell) => cell.row === option.name && cell.column === WAIT.name);
        if (alone?.winner === "row") return `lands on a waiting attacker: ${cellText(alone)}`;
        return entry === undefined ? "-" : `acts ${show(entry.acts)}: ${windowsText(entry.punishes, "safe")}`;
      })])),
    "", "### Follow-ups: the defender's options against the attacker's", "",
    "Rows are the defender's options, columns the attacker's, each from the first frame it can start. W/L: the row lands first (W) or is hit first (L) on that frame; T: both on one frame; a signed number: neither lands and the row can act that many frames before (+) or after (-) the column; (shield): an attack met a shield first.", "",
    ...pressure.flatMap((row) => ["<details>", `<summary>${row.aerial}, ${variant(row)}</summary>`, "", ...matrix(row.cells), "", "</details>", ""]),
    "### Graph", "",
    "Each arrow runs from an out-of-shield option to an aerial it punishes, labelled with the spacings and drifts it punishes it at.", "",
  ];
  const nodes = new Map<string, string>();
  const edges: Edge[] = [];
  for (const aerial of AERIALS) {
    const own = pressure.filter((row) => row.aerial === aerial.name);
    const advantages = own.flatMap((row) => (row.advantage === undefined ? [] : [row.advantage]));
    const [least = 0, most = 0] = [Math.min(...advantages), Math.max(...advantages)];
    const range = advantages.length === 0 ? "never meets a shield" : least === most ? `${signed(least)} on shield` : `${signed(least)} to ${signed(most)} on shield`;
    nodes.set(`a ${aerial.name}`, `${aerial.name}<br/>${range}`);
  }
  for (const option of OUT_OF_SHIELD.slice(1)) {
    for (const aerial of AERIALS) {
      const punished = pressure.filter((row) => row.aerial === aerial.name && row.punishes.some((entry) => entry.punisher === option.name));
      if (punished.length === 0) continue;
      nodes.set(`o ${option.name}`, option.name);
      edges.push({ from: `o ${option.name}`, to: `a ${aerial.name}`, label: punished.map((row) => variant(row)).join("<br/>") });
    }
  }
  return [...lines, ...mermaid(nodes, edges), ""];
}

function parrySection(entry: FighterEntry, rows: readonly Row[]): string[] {
  const parries = rows.filter(isRow("aerial-on-powershield"));
  const blocks = rows.filter(isRow("aerial-on-shield"));
  const variant = (row: ParryRow): string => `${row.spacing}, ${row.drift}`;
  const heldAdvantage = (row: ParryRow): number | undefined =>
    blocks.find((block) => block.aerial === row.aerial && block.spacing === row.spacing && block.drift === row.drift)?.advantage;
  const lines = [
    "## Aerial on a powershield (parry)", "",
    `The same approaches as on a held shield, but the defending ${entry.name} stands unshielded and presses its shield the frame before the aerial meets it, so the hit is parried: no shieldstun, and the shield drops with no release lag into any grounded option. Frame 0 is the parried contact. Its options are every ground attack as well as the out-of-shield ones. Advantage reads as above; "held" is the same approach's advantage on a held shield. Punish start frames are when the defender's option can start and still land before the attacker can act.`, "",
    ...table(["Aerial", "Spacing", "Drift", "Start", "Parried", "Attacker acts", "Defender acts", "Advantage", "Held", "Punished by (start frames)"],
      parries.map((row) => [row.aerial, row.spacing, row.drift, String(row.distance), row.parried ? "yes" : "no, blocked", show(row.attackerActs), show(row.defenderActs),
        signed(row.advantage), signed(heldAdvantage(row)), windowsText(row.punishes, "safe")])),
    "", "### Graph", "",
    "Each arrow runs from an option out of the parry to an aerial it punishes, labelled with the spacings and drifts it punishes it at.", "",
  ];
  const nodes = new Map<string, string>();
  const edges: Edge[] = [];
  for (const aerial of AERIALS) {
    const own = parries.filter((row) => row.aerial === aerial.name);
    const advantages = own.flatMap((row) => (row.advantage === undefined ? [] : [row.advantage]));
    const [least = 0, most = 0] = [Math.min(...advantages), Math.max(...advantages)];
    const range = advantages.length === 0 ? "never meets a shield" : least === most ? `${signed(least)} parried` : `${signed(least)} to ${signed(most)} parried`;
    nodes.set(`a ${aerial.name}`, `${aerial.name}<br/>${range}`);
  }
  for (const option of OUT_OF_PARRY) {
    for (const aerial of AERIALS) {
      const punished = parries.filter((row) => row.aerial === aerial.name && row.punishes.some((entry) => entry.punisher === option.name));
      if (punished.length === 0) continue;
      nodes.set(`o ${option.name}`, option.name);
      edges.push({ from: `o ${option.name}`, to: `a ${aerial.name}`, label: punished.map((row) => variant(row)).join("<br/>") });
    }
  }
  return [...lines, ...mermaid(nodes, edges), ""];
}

function neutralSection(entry: FighterEntry, rows: readonly Row[]): string[] {
  return [
    "## Neutral: both fighters act on frame 1", "",
    `Two standing ${entry.name}s face each other, each option starting on frame 1. Cells read as in the follow-up tables above, from the row fighter's side. Punish start frames are when the opponent's option can start and still land before the fighter can act again.`, "",
    ...rows.filter(isRow("neutral")).flatMap((row) => {
      const nodes = new Map(unique(row.cells.map((cell) => cell.row)).map((name) => [name, name] as const));
      const defensive = new Set([SHIELD.name, SPOT_DODGE.name, ROLL_IN.name, ROLL_AWAY.name]);
      const edges: Edge[] = row.cells.flatMap((cell): Edge[] => {
        if (cell.winner === "row") return [{ from: cell.row, to: cell.column, label: `${cell.kind === "grab" ? "grabs" : "hits"} ${show(cell.frame)}` }];
        if (cell.winner === "none" && defensive.has(cell.row) && !defensive.has(cell.column) && cell.column !== WAIT.name && (cell.frame ?? 0) > 0) {
          return [{ from: cell.row, to: cell.column, label: `${cell.blocked ? "blocks" : "avoids"}, acts ${signed(cell.frame)}`, dashed: true }];
        }
        return [];
      });
      return [
        `### ${row.distance} apart`, "",
        ...matrix(row.cells), "",
        ...table(["Option", "Acts again", "Punished by (start frames)"], row.options.filter((option) => option.option !== WAIT.name).map((option) =>
          [option.option, show(option.acts), windowsText(row.punishes.find((entry) => entry.option === option.option)?.punishes ?? [], option.option === SHIELD.name ? "-" : "safe")])),
        "", "Solid arrows: the option lands first. Dashed: a shield or dodge that leaves the attack without a hit and acts first.", "",
        ...mermaid(nodes, edges), "",
      ];
    }),
  ];
}

function projectileSection(entry: FighterEntry, rows: readonly Row[]): string[] {
  const own = rows.filter(isRow("projectile"));
  if (own.length === 0) return [];
  return [
    "## Projectiles", "",
    `Each special that makes a projectile is fired on frame ${FIRE} at a mirror ${entry.name} the listed distance away. Frame 0 is the frame the projectile meets a shield held from frame 1. `
      + "Flight and most out are measured firing away from everyone, the most out with the special pressed every other frame. "
      + "Punish start frames are out-of-shield options that land before the shooter can act. Powershield and answer frames are presses, from frame 0, of a standing defender that leave it unhit.", "",
    ...table(["Source", "Distance", "Flight", "Most out", "Arrives", "Hits a standing defender", "Advantage", "Punished by (start frames)", "Powershield", "Answers (press frames)"], own.map((row) => [
      row.source, String(row.distance), `${row.flight}${row.traveling ? "" : " (object)"}`, String(row.mostOut), show(row.arrives), row.hitsIdle ? "yes" : "no", signed(row.advantage),
      row.arrives === undefined ? "-" : row.pokes ? "pokes the shield" : windowsText(row.punishes, "safe"), row.arrives === undefined ? "-" : spans(row.powershield) || "never",
      row.arrives === undefined ? "-" : row.answers.filter((answer) => answer.starts.length > 0).map((answer) => `${answer.option} ${spans(answer.starts)}`).join("; ") || "none",
    ])), "",
  ];
}

const STATE_TITLES: Readonly<Record<StateRow["kind"], { readonly title: string; readonly zero: string }>> = {
  landing: { title: "Landing", zero: "Frame 0 is the touchdown. Punish start frames, also from the touchdown, are when the opponent's option can start and land during the landing, before the lander can act" },
  ledge: { title: "Ledge", zero: "Frame 0 is the ledge option's start. Punish start frames are when the opponent's option can start and land before the option's user can act" },
  tech: { title: "Tech situations", zero: "Frame 0 is the touchdown. Punish start frames are when the opponent's option can start and land, from the touchdown, before the downed fighter can act" },
};

function stateSection(kind: StateRow["kind"], rows: readonly Row[]): string[] {
  const own = rows.filter(isRow(kind)).filter((row) => row.kind === kind);
  const { title, zero } = STATE_TITLES[kind];
  return [
    `## ${title}`, "",
    `${zero}. Travel is world units ${kind === "ledge" ? "inward from the ledge" : "from the option's start"}.`, "",
    ...unique(own.map((row) => row.variant)).flatMap((variant) => {
      const rowsOf = own.filter((row) => row.variant === variant);
      const nodes = new Map<string, string>(rowsOf.map((row) => [`t ${row.option}`, `${row.option}<br/>acts ${show(row.acts)}`]));
      const edges = rowsOf.flatMap((row) => row.punishes.map((entry): Edge => {
        nodes.set(`p ${entry.punisher}`, entry.punisher);
        return { from: `p ${entry.punisher}`, to: `t ${row.option}`, label: spans(entry.starts) };
      }));
      return [
        `### ${variant}`, "",
        ...table(["Option", "Acts", "Intangible", "Travel", "Hits the opponent", "Punished by (start frames)"], rowsOf.map((row) =>
          [row.option, show(row.acts), row.intangible, String(row.travel), show(row.hits), windowsText(row.punishes, "safe")])),
        "", ...mermaid(nodes, edges), "",
      ];
    }),
  ];
}

/** One fighter's page: every situation's tables and graphs. */
export function fighterPage(entry: FighterEntry, rows: readonly Row[]): string {
  return [
    `# ${entry.name}: interaction graph`, "",
    "Generated by `bun wisp interactions` (smashcraft:ts/scripts/interactions.ts) from the match frame executor and the authored move data; do not edit. "
      + "The model, its conditions and how to read it: [the interaction graph](../../../docs/design/interaction-graph.md). "
      + `${entry.name} against ${entry.name} on the flat stage; frames are match frames, 60 a second; distances are world units.`, "",
    ...aerialSection(entry, rows),
    ...parrySection(entry, rows),
    ...neutralSection(entry, rows),
    ...stateSection("landing", rows),
    ...stateSection("ledge", rows),
    ...stateSection("tech", rows),
    ...projectileSection(entry, rows),
  ].join("\n");
}

// ------------------------------------------------------------------ evaluating a move against the graph

/** What one move does in every situation of its fighter's graph. */
export function moveProfile(rows: readonly Row[], move: string): string[] {
  const lines: string[] = [];
  const asPunisher = (situation: string, target: string, windows: readonly Window[]): void => {
    for (const entry of windows) if (entry.punisher === move || entry.punisher === `jump ${move}`) lines.push(`${situation}: ${entry.punisher} punishes ${target}, starts ${spans(entry.starts)}`);
  };
  for (const row of rows) {
    switch (row.kind) {
      case "aerial-reach":
        if (row.aerial === move) lines.push(`on shield: reaches it from ${row.distances || "nowhere"}`);
        break;
      case "aerial-on-shield": {
        const variant = `${row.aerial} ${row.spacing} ${row.drift}`;
        if (row.aerial === move) lines.push(`on shield, ${row.spacing} ${row.drift} from ${row.distance}: advantage ${signed(row.advantage)}, punished by ${windowsText(row.punishes, "nothing")}`);
        asPunisher("out of shield", variant, row.punishes);
        for (const entry of row.oosPunishes) asPunisher(`after ${variant}`, entry.option, entry.punishes);
        break;
      }
      case "aerial-on-powershield": {
        const variant = `${row.aerial} ${row.spacing} ${row.drift}`;
        if (row.aerial === move) lines.push(`on a powershield, ${row.spacing} ${row.drift} from ${row.distance}: advantage ${signed(row.advantage)}, punished by ${windowsText(row.punishes, "nothing")}`);
        asPunisher("out of a parry", variant, row.punishes);
        break;
      }
      case "projectile":
        if (row.source === move) lines.push(`projectile from ${row.distance}: arrives ${show(row.arrives)}, advantage ${signed(row.advantage)}, punished by ${windowsText(row.punishes, "nothing")}, powershield ${spans(row.powershield) || "never"}`);
        break;
      case "neutral":
        for (const cell of row.cells) if (cell.row === move) lines.push(`neutral at ${row.distance}, against ${cell.column}: ${cellText(cell)}`);
        for (const entry of row.punishes) {
          if (entry.option === move) lines.push(`neutral at ${row.distance}: punished by ${windowsText(entry.punishes, "nothing")}`);
          asPunisher(`neutral at ${row.distance}`, entry.option, entry.punishes);
        }
        break;
      default:
        if (row.option === move || row.option === `${move} landing`) lines.push(`${row.kind}, ${row.option}: acts ${show(row.acts)}, punished by ${windowsText(row.punishes, "nothing")}`);
        asPunisher(`${row.kind}, ${row.variant}`, row.option, row.punishes);
    }
  }
  return lines;
}

const RowIdentity = Schema.Struct({
  kind: Schema.String, fighter: Schema.String, aerial: Schema.optionalKey(Schema.String), spacing: Schema.optionalKey(Schema.String),
  drift: Schema.optionalKey(Schema.String), distance: Schema.optionalKey(Schema.Finite), variant: Schema.optionalKey(Schema.String), option: Schema.optionalKey(Schema.String),
});

/** What identifies a row across generations: its situation and option, not its numbers. */
function rowKey(row: typeof RowIdentity.Type): string {
  return [row.kind, row.fighter, row.aerial, row.spacing, row.drift, row.kind === "neutral" ? row.distance : undefined, row.variant, row.option]
    .filter((part) => part !== undefined).join(" | ");
}

export function parseRows(text: string): Record<string, unknown>[] {
  return text.split("\n").filter((line) => line.trim() !== "").map((line) => {
    const value: unknown = JSON.parse(line);
    Schema.asserts(RowIdentity, value);
    return value;
  });
}

/** Rows added, removed or changed from `before` to `after`, with each changed row's changed fields. */
export function rowChanges(before: readonly Record<string, unknown>[], after: readonly Row[]): string[] {
  const keyed = (rows: readonly Record<string, unknown>[]): Map<string, Record<string, unknown>> =>
    new Map(rows.map((row) => { Schema.asserts(RowIdentity, row); return [rowKey(row), row]; }));
  const old = keyed(before);
  const now = keyed(after.map((row): Record<string, unknown> => ({ ...row })));
  const changes: string[] = [];
  for (const [key, row] of now) {
    const previous = old.get(key);
    if (previous === undefined) {
      changes.push(`added ${key}`);
      continue;
    }
    const fields = unique([...Object.keys(previous), ...Object.keys(row)]).filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(row[field]));
    if (fields.length === 0) continue;
    const describe = (field: string): string => {
      const was = previous[field];
      const is = row[field];
      return typeof was === "object" || typeof is === "object" ? `${field} changed` : `${field} ${String(was)} -> ${String(is)}`;
    };
    changes.push(`changed ${key}: ${fields.map(describe).join(", ")}`);
  }
  for (const key of old.keys()) if (!now.has(key)) changes.push(`removed ${key}`);
  return changes;
}
