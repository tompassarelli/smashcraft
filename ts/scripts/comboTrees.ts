// Combo trees (#83): finite attacker menus and defender scripts played through
// the interaction graph's Timeline. The report states the search bounds; a
// missing sampled path is never a claim that no player can make one.
import { Action } from "../src/game/input/actions";
import type { Direction } from "../src/game/input/inputRow";
import { AttackStyle, Character, DownState, GrabAction } from "../src/game/sim/codes";
import { canAttack } from "../src/game/sim/conditions";
import type { Fighter } from "../src/game/sim/fighter";
import type { ReplayState } from "../src/game/replay/snapshot";
import { fighterAt } from "../src/game/sim/roster";
import { Timeline, type FighterEntry, type Held, type Option, type Situation } from "./interactions";
import { airborne } from "./frameScene";

const COMBO_PERCENTS = [0, 30, 60, 90, 120] as const;
const HORIZON = 120;
const STRING_LIMIT = 6;
const PATH_HITS = 12;
const PATH_READS = 3;
const BEAM = 2;
const DIRECTIONS = [
  { name: "none", x: 0, z: 0 }, { name: "left", x: -1, z: 0 }, { name: "right", x: 1, z: 0 },
  { name: "up", x: 0, z: 1 }, { name: "down", x: 0, z: -1 },
  { name: "up-left", x: -1, z: 1 }, { name: "up-right", x: 1, z: 1 },
  { name: "down-left", x: -1, z: -1 }, { name: "down-right", x: 1, z: -1 },
] as const;
const RESPONSES = ["hold", "SDI", "tech in place", "tech left", "tech right", "missed tech", "jump", "air dodge", "mash"] as const;
const VICTIM_CHOICES = DIRECTIONS.flatMap((di) => RESPONSES.map((response) => ({ name: `DI ${di.name}; ${response}`, di, response })));
type VictimChoice = (typeof VICTIM_CHOICES)[number];

interface Move {
  readonly name: string;
  readonly style?: AttackStyle;
  readonly aerial?: boolean;
  readonly throw?: "forward" | "back" | "up" | "down";
  readonly dash?: boolean;
}
const COMBO_OPENINGS: readonly Move[] = [
  { name: "jab", style: AttackStyle.jab },
  { name: "forward tilt", style: AttackStyle.forwardTilt }, { name: "up tilt", style: AttackStyle.upTilt }, { name: "down tilt", style: AttackStyle.downTilt },
  { name: "forward tilt up", style: AttackStyle.forwardTiltUp }, { name: "forward tilt down", style: AttackStyle.forwardTiltDown },
  { name: "forward smash", style: AttackStyle.forwardSmash }, { name: "up smash", style: AttackStyle.upSmash }, { name: "down smash", style: AttackStyle.downSmash },
  { name: "dash attack", dash: true },
  { name: "grab", style: AttackStyle.grab },
  { name: "neutral air", style: AttackStyle.neutralAir, aerial: true }, { name: "forward air", style: AttackStyle.forwardAir, aerial: true },
  { name: "back air", style: AttackStyle.backAir, aerial: true }, { name: "up air", style: AttackStyle.upAir, aerial: true }, { name: "down air", style: AttackStyle.downAir, aerial: true },
  { name: "forward throw", throw: "forward" }, { name: "back throw", throw: "back" }, { name: "up throw", throw: "up" }, { name: "down throw", throw: "down" },
];
const FOLLOWUPS = COMBO_OPENINGS;
const toward = (a: Fighter, b: Fighter): Action => b.motion.x >= a.motion.x ? Action.moveRight : Action.moveLeft;
const stick = (x: Direction, z: Direction): Held => [
  ...(x < 0 ? [Action.moveLeft] : x > 0 ? [Action.moveRight] : []),
  ...(z < 0 ? [Action.moveDown] : z > 0 ? [Action.moveUp] : []),
];

function attackButtons(move: Move, self: Fighter, other: Fighter): Held {
  if (move.throw !== undefined || move.style === AttackStyle.grab) return [Action.grab];
  switch (move.style) {
    case AttackStyle.forwardTilt: return [Action.walk, toward(self, other), Action.attack];
    case AttackStyle.forwardTiltUp: return [Action.walk, toward(self, other), Action.moveUp, Action.attack];
    case AttackStyle.forwardTiltDown: return [Action.walk, toward(self, other), Action.moveDown, Action.attack];
    case AttackStyle.upTilt: return [Action.walk, Action.moveUp, Action.attack];
    case AttackStyle.downTilt: return [Action.walk, Action.moveDown, Action.attack];
    case AttackStyle.forwardSmash: return [other.motion.x >= self.motion.x ? Action.smashRight : Action.smashLeft];
    case AttackStyle.upSmash: case AttackStyle.upAir: return [Action.smashUp];
    case AttackStyle.downSmash: case AttackStyle.downAir: return [Action.smashDown];
    case AttackStyle.forwardAir: return [self.facing > 0 ? Action.smashRight : Action.smashLeft];
    case AttackStyle.backAir: return [self.facing > 0 ? Action.smashLeft : Action.smashRight];
    default: return [Action.attack];
  }
}

function throwButtons(move: Move, self: Fighter): Held {
  switch (move.throw) {
    case "up": return [Action.moveUp];
    case "down": return [Action.moveDown];
    case "back": return [self.facing > 0 ? Action.moveLeft : Action.moveRight];
    default: return [self.facing > 0 ? Action.moveRight : Action.moveLeft];
  }
}

function matchesMove(move: Move, self: Fighter): boolean {
  if (move.throw !== undefined) {
    const action = move.throw === "up" ? GrabAction.throwUp : move.throw === "down" ? GrabAction.throwDown : move.throw === "back" ? GrabAction.throwBack : GrabAction.throwForward;
    return self.grab.action === action;
  }
  if (move.dash) {
    return self.character === Character.demonHunter && self.attack.style === AttackStyle.demonHunterDashAttack;
  }
  if (move.style === AttackStyle.grab) return self.grab.action === GrabAction.hold;
  return self.attack.style === move.style;
}

/** One committed move, approaching and trying on alternating frames; no move chosen from the defender's script. */
export function moveOption(move: Move, opening: boolean): Option {
  return {
    name: move.name, kind: "none",
    input: (i, self, other) => {
      if (self.grab.action === GrabAction.hold) return i % 2 === 0 ? throwButtons(move, self) : [];
      if (i % 2 !== 0) return self.motion.grounded || !opening ? [toward(self, other)] : [];
      if (move.dash && self.ground.dashFrame === 0) return [toward(self, other)];
      if (!canAttack(self)) return [];
      if (move.aerial && self.motion.grounded) return [Action.jump];
      if (!move.aerial && !self.motion.grounded) return [toward(self, other)];
      if (!opening && Math.abs(other.motion.x - self.motion.x) > 90) return [toward(self, other)];
      return move.dash ? [Action.attack] : attackButtons(move, self, other);
    },
  };
}

function victimButtons(choice: VictimChoice, n: number, self: Fighter): Held {
  // DI is held while the hit owns the victim; a completed choice does not
  // become a walk off the stage that the report could mistake for a combo KO.
  const held = self.launch.hitlag > 0 || self.launch.hitstun > 0 ? stick(choice.di.x, choice.di.z) : [];
  switch (choice.response) {
    case "jump": return n % 2 === 1 ? [...held, Action.jump] : held;
    case "air dodge": return n % 2 === 1 && canAttack(self) && !self.motion.grounded ? [...held, Action.rightTrigger] : held;
    case "mash": return n % 2 === 1 ? [...held, Action.attack, Action.special, Action.jump, Action.grab] : held;
    case "tech in place": case "tech left": case "tech right": {
      if (self.down.state === DownState.tumble && self.motion.z < 90 && self.motion.vz < 0) {
        const direction = choice.response === "tech left" ? [Action.moveLeft] : choice.response === "tech right" ? [Action.moveRight] : [];
        if (self.tech.pressAge > 40) return [Action.rightTrigger, ...direction];
        if (self.tech.pressAge < 20) return direction;
      }
      return held;
    }
    default: return held;
  }
}

interface Checkpoint { readonly state: ReplayState; readonly previous: readonly number[] }
interface Link {
  readonly move: string;
  readonly frame: number;
  readonly damage: number;
  readonly trueLink: boolean;
  readonly ko: boolean;
  readonly koAfterFrames: number | undefined;
  readonly after: Checkpoint;
}
interface LinkRecord { readonly move: string; readonly frame: number; readonly damage: number; readonly trueLink: boolean; readonly ko: boolean; readonly koAfterFrames: number | undefined }
const record = ({ move, frame, damage, trueLink, ko, koAfterFrames }: Link): LinkRecord => ({ move, frame, damage, trueLink, ko, koAfterFrames });
const compareLinks = (a: Link, b: Link): number => Number(b.ko) - Number(a.ko) || b.damage - a.damage || a.frame - b.frame || a.move.localeCompare(b.move);

function placements(entry: FighterEntry, back = false): Situation["placements"] {
  return [{ character: entry.character, x: 0, facing: back ? -1 : 1 }, { character: entry.character, x: 40, facing: -1 }];
}

/** One defender script, with a fresh SDI pulse every other hitlag frame and a legal tech press while descending near the floor. */
function situation(entry: FighterEntry, start: Checkpoint, choice: VictimChoice): Situation {
  return {
    placements: placements(entry), initial: start.state, previous: start.previous,
    policies: [() => [], (n, self) => victimButtons(choice, n, self)],
    amend: (n, self, _other, row, side) => {
      if (side !== 1) return;
      if (self.grab.owner !== undefined) {
        row.axisX = choice.di.x * 127;
        row.axisZ = choice.di.z * 127;
      }
      if (choice.response === "SDI" && self.launch.hitlag > 0 && n % 2 === 1) {
        const x = choice.di.x === 0 && choice.di.z === 0 ? 1 : choice.di.x;
        row.sdi = true; row.sdiX = x; row.sdiZ = choice.di.z;
      }
    },
  };
}

function openingState(entry: FighterEntry, move: Move, percent: number, throwDI?: VictimChoice["di"]): Checkpoint | undefined {
  const line = new Timeline({
    placements: placements(entry, move.style === AttackStyle.backAir),
    prepare: (a, b) => {
      b.status.damage = percent;
      if (move.aerial) { airborne(a, 0, 50); airborne(b, 40, 50); }
    },
    policies: [() => [], () => []],
    amend: (_n, self, _other, row, side) => {
      if (side !== 1 || throwDI === undefined || self.grab.owner === undefined) return;
      row.axisX = throwDI.x * 127;
      row.axisZ = throwDI.z * 127;
    },
  }, HORIZON, "first");
  let landed = false;
  line.play([[{ option: moveOption(move, true), start: 1 }], []], HORIZON, (_n, a, b) => {
    const caught = b.visuals.hit > 0 || (move.style === AttackStyle.grab && b.visuals.grab > 0);
    landed = caught && matchesMove(move, a);
    return caught || b.status.out;
  }, true);
  const result = landed ? line.capture() : undefined;
  line.release();
  return result;
}

/** Tests all committed follow-up moves from one exact state against one victim script. */
function links(entry: FighterEntry, start: Checkpoint, choice: VictimChoice): Link[] {
  const line = new Timeline(situation(entry, start, choice), HORIZON, "first");
  const old = fighterAt(start.state.world, 1);
  const oldAttacker = fighterAt(start.state.world, 0);
  if (old.status.out || old.status.respawn > 0) { line.release(); return []; }
  const results: Link[] = [];
  for (const move of FOLLOWUPS) {
    let acted = canAttack(old);
    let contact: number | undefined;
    let hit = false;
    line.play([[{ option: moveOption(move, false), start: 1 }], []], HORIZON, (n, a, b) => {
      if (canAttack(b) || b.jump.serial !== old.jump.serial || b.attack.serial !== old.attack.serial
        || b.dodge.airFrame > 0 || b.dodge.groundFrame > 0 || b.down.state === DownState.tech || b.down.state === DownState.techRoll) acted = true;
      if (a.visuals.hit !== oldAttacker.visuals.hit || a.status.stocks < oldAttacker.status.stocks) return true;
      const fresh = b.visuals.hit !== old.visuals.hit || (move.style === AttackStyle.grab && b.visuals.grab !== old.visuals.grab);
      const started = a.attack.serial !== oldAttacker.attack.serial || (move.throw !== undefined && a.grab.serial !== oldAttacker.grab.serial);
      hit = fresh && started && matchesMove(move, a);
      if (fresh && !hit) return true;
      if (hit || b.status.stocks < old.status.stocks) { contact = n; return true; }
      return false;
    }, true);
    if (contact !== undefined && hit) {
      const after = line.capture();
      const target = fighterAt(after.state.world, 1);
      const damage = target.status.damage - old.status.damage;
      const flight = new Timeline(situation(entry, after, choice), HORIZON, "first");
      let koAfterFrames: number | undefined;
      flight.play([[], []], HORIZON, (n, _a, b) => {
        if (b.status.stocks >= old.status.stocks) return false;
        koAfterFrames = n;
        return true;
      }, true);
      const ko = koAfterFrames !== undefined;
      flight.release();
      results.push({ move: move.name, frame: contact, damage, trueLink: !acted, ko, koAfterFrames, after });
    }
  }
  line.release();
  return results;
}

interface ChoiceResult { readonly victim: string; readonly best: LinkRecord | undefined }
interface StringResult { readonly damage: number; readonly followups: number; readonly moves: readonly string[]; readonly capped: boolean; readonly ko: boolean }
interface ReadWitness { readonly move: string; readonly beats: string; readonly escapes: string }
interface Path { readonly reads: number; readonly moves: readonly string[]; readonly victimChoices: readonly string[]; readonly readWitnesses: readonly ReadWitness[]; readonly damage: number; readonly ko: boolean; readonly koAfterFrames: number | undefined }
interface TreeNode { readonly moves: readonly string[]; readonly victimChoices: readonly string[]; readonly reads: number; readonly percent: number; readonly choices: readonly ChoiceResult[] }
export interface ComboRow {
  readonly kind: "combo";
  readonly fighter: string;
  readonly opening: string;
  readonly percent: number;
  readonly openingLands: boolean;
  readonly openingDamage: number;
  readonly choices: readonly ChoiceResult[];
  readonly guaranteed: StringResult;
  readonly stockPath: Path | undefined;
  readonly tree: readonly TreeNode[];
  readonly violations: readonly string[];
}

function guaranteedString(entry: FighterEntry, opening: Move, percent: number, initial: readonly Checkpoint[], first: readonly (readonly Link[])[]): StringResult {
  let states = [...initial];
  let candidates = first;
  const moves = [opening.name];
  let damage = Math.min(...initial.map((state) => fighterAt(state.state.world, 1).status.damage - percent));
  let ko = false;
  for (let depth = 0; depth < STRING_LIMIT; depth++) {
    const universal = FOLLOWUPS.flatMap((move) => {
      const found = candidates.map((rows) => rows.find((row) => row.move === move.name && row.trueLink));
      if (found.some((row) => row === undefined)) return [];
      const complete = found.filter((row): row is Link => row !== undefined);
      return [{ move: move.name, links: complete, damage: Math.min(...complete.map((row) => row.damage)) }];
    }).sort((a, b) => b.damage - a.damage || a.move.localeCompare(b.move));
    const best = universal[0];
    if (best === undefined) return { damage, followups: moves.length - 1, moves, capped: false, ko };
    moves.push(best.move);
    states = best.links.map((link) => link.after);
    damage = Math.min(...states.map((at) => fighterAt(at.state.world, 1).status.damage - percent));
    ko = best.links.every((link) => link.ko);
    if (ko) return { damage, followups: moves.length - 1, moves, capped: false, ko };
    if (depth + 1 < STRING_LIMIT) candidates = states.map((state, index) => {
      const choice = VICTIM_CHOICES[index];
      if (choice === undefined) throw new Error("missing victim choice");
      return links(entry, state, choice);
    });
  }
  return { damage, followups: moves.length - 1, moves, capped: true, ko };
}

interface SearchNode { readonly at: Checkpoint; readonly path: Path }
/** A read needs an observed escape; acting before a hit does not by itself establish a read. */
export function comboExtension(outcomes: readonly ({ readonly trueLink: boolean } | undefined)[]): "guaranteed" | "read" | "unclassified" | "miss" {
  if (outcomes.length === 0 || outcomes.every((outcome) => outcome === undefined)) return "miss";
  if (outcomes.every((outcome) => outcome?.trueLink === true)) return "guaranteed";
  return outcomes.some((outcome) => outcome === undefined) ? "read" : "unclassified";
}

function stockPath(entry: FighterEntry, opening: Move, initial: Checkpoint, first: readonly (readonly Link[])[]): { readonly path: Path | undefined; readonly tree: readonly TreeNode[] } {
  let frontier: SearchNode[] = [{ at: initial, path: { reads: 0, moves: [opening.name], victimChoices: [], readWitnesses: [], damage: fighterAt(initial.state.world, 1).status.damage, ko: false, koAfterFrames: undefined } }];
  let found: Path | undefined;
  const tree: TreeNode[] = [];
  for (let depth = 0; depth < PATH_HITS - 1 && frontier.length > 0; depth++) {
    const next: SearchNode[] = [];
    for (const node of frontier) {
      const choices = depth === 0 ? first : VICTIM_CHOICES.map((choice) => links(entry, node.at, choice));
      tree.push({ moves: node.path.moves, victimChoices: node.path.victimChoices, reads: node.path.reads, percent: fighterAt(node.at.state.world, 1).status.damage, choices: bestChoices(choices) });
      const classifications = new Map(FOLLOWUPS.map((move) => [move.name, comboExtension(choices.map((rows) => rows.find((row) => row.move === move.name)))]));
      for (const [index, rows] of choices.entries()) {
        const victim = VICTIM_CHOICES[index];
        if (victim === undefined) throw new Error("missing victim choice");
        for (const link of rows) {
          // Every sampled script gets hit after becoming free: neither a proven
          // true link nor a read with an observed escaping choice.
          if (classifications.get(link.move) === "unclassified") continue;
          const reads = node.path.reads + (classifications.get(link.move) === "guaranteed" ? 0 : 1);
          if (reads > PATH_READS) continue;
          const escapedIndex = choices.findIndex((options) => options.every((option) => option.move !== link.move));
          const escaping = VICTIM_CHOICES[escapedIndex];
          const witnesses = escaping === undefined ? node.path.readWitnesses : [...node.path.readWitnesses, { move: link.move, beats: victim.name, escapes: escaping.name }];
          const path: Path = { reads, moves: [...node.path.moves, link.move], victimChoices: [...node.path.victimChoices, victim.name], readWitnesses: witnesses, damage: node.path.damage + link.damage, ko: link.ko, koAfterFrames: link.koAfterFrames };
          if (link.ko) {
            if (found === undefined || reads < found.reads || (reads === found.reads && path.moves.length < found.moves.length)) found = path;
          } else next.push({ at: link.after, path });
        }
      }
    }
    // A fixed-width beam is the named sampled search, not exhaustive absence proof.
    next.sort((a, b) => b.path.damage - a.path.damage || a.path.reads - b.path.reads || a.path.moves.join().localeCompare(b.path.moves.join()) || a.path.victimChoices.join().localeCompare(b.path.victimChoices.join()));
    frontier = next.filter((node, index, all) => all.findIndex((other) => other.path.moves.join() === node.path.moves.join() && other.path.reads === node.path.reads) === index).slice(0, BEAM);
    if (found?.reads === 0) break;
  }
  return { path: found, tree };
}

function bestChoices(rowsByChoice: readonly (readonly Link[])[]): ChoiceResult[] {
  return rowsByChoice.map((rows, index) => {
    const victim = VICTIM_CHOICES[index];
    if (victim === undefined) throw new Error("missing victim choice");
    const best = [...rows].sort(compareLinks)[0];
    return { victim: victim.name, best: best === undefined ? undefined : record(best) };
  });
}

function comboRow(entry: FighterEntry, move: Move, percent: number): ComboRow {
  const initial = openingState(entry, move, percent);
  if (initial === undefined) return { kind: "combo", fighter: entry.name, opening: move.name, percent, openingLands: false, openingDamage: 0, choices: VICTIM_CHOICES.map((choice) => ({ victim: choice.name, best: undefined })), guaranteed: { damage: 0, followups: 0, moves: [], capped: false, ko: false }, stockPath: undefined, tree: [], violations: ["opening does not land in this setup"] };
  const roots = VICTIM_CHOICES.map((choice) => {
    const root = move.throw === undefined ? initial : openingState(entry, move, percent, choice.di);
    if (root === undefined) throw new Error(`${entry.name} ${move.name} stopped landing with DI ${choice.di.name}`);
    return root;
  });
  const first = VICTIM_CHOICES.map((choice, index) => {
    const root = roots[index];
    if (root === undefined) throw new Error("missing opening state");
    return links(entry, root, choice);
  });
  const guaranteed = guaranteedString(entry, move, percent, roots, first);
  const search = percent === 0 ? stockPath(entry, move, initial, first) : undefined;
  const path = search?.path;
  const violations = [
    ...(guaranteed.followups > 2 ? ["more than 2 guaranteed follow-ups"] : []),
    ...(percent < 100 && guaranteed.damage > 30 ? ["more than 30% guaranteed damage below 100%"] : []),
    ...(percent === 0 && path === undefined ? ["no 0-to-death path found with at most 3 reads in the sampled search"] : []),
    ...(path !== undefined && path.reads < 2 ? ["sampled 0-to-death takes fewer than 2 reads"] : []),
  ];
  const choices = bestChoices(first);
  const tree = search?.tree ?? [{ moves: [move.name], victimChoices: [], reads: 0, percent: fighterAt(initial.state.world, 1).status.damage, choices }];
  return { kind: "combo", fighter: entry.name, opening: move.name, percent, openingLands: true, openingDamage: fighterAt(initial.state.world, 1).status.damage - percent, choices, guaranteed, stockPath: path, tree, violations };
}

export function comboRows(entry: FighterEntry, progress?: (opening: string, rows: number) => void): ComboRow[] {
  const rows: ComboRow[] = [];
  for (const opening of COMBO_OPENINGS.filter((move) => !move.dash || entry.character === Character.demonHunter)) {
    for (const percent of COMBO_PERCENTS) rows.push(comboRow(entry, opening, percent));
    progress?.(opening.name, rows.length);
  }
  return rows;
}

export function comboPage(entry: FighterEntry, rows: readonly ComboRow[]): string {
  const table = (head: readonly string[], body: readonly (readonly string[])[]) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...body.map((row) => `| ${row.join(" | ")} |`)];
  const number = (value: number) => String(Math.round(value * 100) / 100);
  return [
    `# ${entry.name}: combo trees`, "",
    "Generated by `bun wisp interactions` from the match frame executor; do not edit. Full choice rows: smashcraft:tools/move-data/interactions/combos.jsonl. Targets: [combo structure](../../../docs/gameplay-design.md#combo-structure).", "",
    `${entry.name} mirror match on the flat stage. ${rows.length / COMBO_PERCENTS.length} openings at ${COMBO_PERCENTS.join("/")}%; ${VICTIM_CHOICES.length} victim scripts (all nine DI directions, each with hold, SDI, four tech choices, jump, air dodge and mash). Every move in the opening menu is tested as a follow-up; only Illidan has an authored dash attack.`, "",
    `An opening starts 40 units apart; aerials start both fighters airborne at height 50. Its landed contact is the conditional root; defender choices start in the next frame, with throw DI supplied on the release frame. DI stops when hitstun ends, preventing a voluntary walk off the stage from counting as a combo KO. Each link searches ${HORIZON} frames of approach and alternating presses, then ${HORIZON} frames of the defender's flight with no further attacker input to observe a stock loss. A true link must catch every sampled defender before a free attack, jump, dodge or tech; strings keep the same defender script through at most ${STRING_LIMIT} follow-ups. These are sampled guarantees, not proof over arbitrary defender timing or switching scripts.`, "",
    `For 0-to-death, defender scripts may change at each link. The beam retains ${BEAM} routes per depth, up to ${PATH_HITS} hits including the opening and ${PATH_READS} reads. Each extension costs a read unless its committed move is a true link against all victim scripts at that state. No path means none found in this bounded menu and beam, not an exhaustive impossibility claim. No arbitrary jump, dodge, tech timings, specials, projectiles, other matchups or stages are claimed.`, "",
    "Damage includes the opening. The guaranteed column uses the same chosen move on every sampled branch and reports the least damage. Best follow-ups maximize stock loss, then damage, then speed. A capped string is a lower bound. Balance violations are findings, not regeneration failures. #68's separate agency sweep is retained in smashcraft:evidence/false-agency-20261006/.", "",
    ...table(["Opening", "Victim %", "Guaranteed damage", "Guaranteed follow-ups", "String", "0-to-death reads", "Findings"], rows.map((row) => [row.opening, String(row.percent), number(row.guaranteed.damage), `${row.guaranteed.followups}${row.guaranteed.capped ? "+" : ""}`, row.guaranteed.moves.join(" → ") || "opening misses", row.percent !== 0 ? "—" : row.stockPath === undefined ? "no sampled path" : String(row.stockPath.reads), row.violations.join("; ") || "within measured targets"])), "",
    "## Stock paths from 0%", "",
    ...rows.filter((row) => row.percent === 0 && row.stockPath !== undefined).map((row) => `${row.opening}: ${row.stockPath?.moves.join(" → ")}; ${row.stockPath?.reads} reads; defender scripts: ${row.stockPath?.victimChoices.join(" → ")}; stock lost ${row.stockPath?.koAfterFrames} frames after the last hit. Read witnesses: ${row.stockPath?.readWitnesses.map((witness) => `${witness.move} beats ${witness.beats}, escaped by ${witness.escapes}`).join("; ")}.`), "",
    "## Best follow-up for each victim choice", "",
    ...rows.flatMap((row) => ["<details>", `<summary>${row.opening}, ${row.percent}%</summary>`, "", ...table(["Victim", "Best follow-up", "Contact frame", "Damage", "True link", "Stock lost"], row.choices.map((choice) => [choice.victim, choice.best?.move ?? "no follow-up in menu", choice.best === undefined ? "—" : String(choice.best.frame), choice.best === undefined ? "—" : number(choice.best.damage), choice.best === undefined ? "—" : String(choice.best.trueLink), choice.best === undefined ? "—" : String(choice.best.ko)])), "", "</details>", ""]),
  ].join("\n");
}
