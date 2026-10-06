// Smashcraft's soak matches (scripts/wisp/soak.ts, wisp:docs/soak.md): the
// playable build with the scene recorder in two headless clients. Each
// player's helper is the journal stand-in (test/rematch/journalHelper.ts) on
// the soak's wall clock: it types rows from the fuzzed controller ("fuzz"),
// neutral rows while the player's fighter is a computer ("cpu"), or nothing,
// as when no helper runs ("absent"). Loaded only by the soak's worker
// processes, so the host type check never reads map code.
import { appendFileSync } from "node:fs";
import { type SoakDriver, type SoakEdge, type SoakMatch, defineSoakGame } from "wisp/scripts/wisp/soak";
import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { originalClip, originalClipCount } from "../../src/game/assets/fighterOriginalClipInfo";
import { Action, bit } from "../../src/game/input/actions";
import { type InputRow, emptyInput, inputRow } from "../../src/game/input/inputRow";
import { PARTICIPANT_SLOTS } from "../../src/game/input/participants";
import { MATCH_TICKS_PER_SECOND, Phase } from "../../src/game/match/rules";
import { PLAYABLE_BUILD } from "../../src/game/shell/currentBuild";
import { AttackStyle, Character, DownState, GrabAction, HippogryphKind, ProjectileKind, SpecialAction } from "../../src/game/sim/codes";
import type { Fighter } from "../../src/game/sim/fighter";
import { fighterAt, isActive } from "../../src/game/sim/roster";
import { mainDeckLeft, mainDeckRight } from "../../src/game/sim/stage";
import { install as installGame, startBuild } from "../../src/platform/main";
import { installSceneReport, startMatchSceneReport } from "../../src/platform/sceneReport";
import { confirmedChecksum } from "../../src/platform/shell/diagnostics";
import { Key } from "../../src/platform/shell/keyEvents";
import { panelActions } from "../../src/platform/shell/menus";
import { shell } from "../../src/platform/shell/state";
import { JournalHelpers } from "../rematch/journalHelper";
import { SOAK_BUTTONS, STICK_DEAD_ZONE } from "./controller";

const CHARACTERS: Readonly<Record<string, Character>> = { archer: Character.archer, rifleman: Character.rifleman, illidan: Character.demonHunter };
const NAMES: Readonly<Record<number, string>> = { [Character.archer]: "Archer", [Character.rifleman]: "Rifleman", [Character.demonHunter]: "Illidan" };
const STAGES: Readonly<Record<string, number>> = { "sky-deck": 0, "three-bridges": 1, "drifting-deck": 3, "patterned-decks": 4 };
const FRAME_MS = 1000 / 60;
/** A one-stock match with a one-minute clock: each ends by a KO or by time. */
const STOCKS = 1;
const MINUTES = 1;
/** Half a second in, the camera has framed the fighters and their clips are posed. */
const SETTLED_FRAME = 30;

const ACTIONS: readonly Action[] = SOAK_BUTTONS.map((name) => Action[name]);
/** A flick from inside the dead zone to past this is a smash. */
const SMASH_REACH = 101;

/** Each pooled fighter's clip models, which follow it all match. */
const clipModels = (character: Character) =>
  Array.from({ length: originalClipCount(character) }, (_, index) => originalClip(character, index)?.modelPath ?? "").filter((path) => path !== "");

const sign = (value: number) => (value > STICK_DEAD_ZONE ? 1 : value < -STICK_DEAD_ZONE ? -1 : 0);

/** One player's fuzzed controller as journal rows, frame by frame of their helper's clock. */
class ControllerRows {
  private buttons = 0;
  private readonly axes = [0, 0];
  private smash = 0;
  private readonly pending = new Map<number, SoakEdge[]>();

  edges(frame: number, edges: readonly SoakEdge[]): void {
    this.pending.set(frame, [...(this.pending.get(frame) ?? []), ...edges]);
  }

  private held(): number {
    const [x = 0, z = 0] = this.axes;
    return this.buttons | this.smash
      | (sign(x) < 0 ? bit(Action.moveLeft) : 0) | (sign(x) > 0 ? bit(Action.moveRight) : 0)
      | (sign(z) < 0 ? bit(Action.moveDown) : 0) | (sign(z) > 0 ? bit(Action.moveUp) : 0);
  }

  /** The row for `frame`, after the rows of every earlier frame. */
  row(frame: number): InputRow {
    const before = this.held();
    let pressed = 0;
    let released = 0;
    for (const edge of this.pending.get(frame) ?? []) {
      if ("button" in edge) {
        const action = bit(ACTIONS[edge.button] ?? Action.jump);
        if (edge.down) pressed |= action;
        else released |= action;
        this.buttons = edge.down ? this.buttons | action : this.buttons & ~action;
        continue;
      }
      const was = this.axes[edge.axis] ?? 0;
      this.axes[edge.axis] = edge.value;
      const [negative, positive] = edge.axis === 0 ? [bit(Action.smashLeft), bit(Action.smashRight)] : [bit(Action.smashDown), bit(Action.smashUp)];
      const toward = edge.value < 0 ? negative : positive;
      // A smash holds while the stick stays past its reach on the side it was flicked to.
      this.smash &= ~((Math.abs(edge.value) < SMASH_REACH ? negative | positive : 0) | (toward === negative ? positive : negative));
      if (Math.abs(was) <= STICK_DEAD_ZONE && Math.abs(edge.value) >= SMASH_REACH) this.smash |= toward;
    }
    this.pending.delete(frame);
    const held = this.held();
    pressed |= held & ~before;
    released |= before & ~held;
    const [x = 0, z = 0] = this.axes;
    const special = (pressed & bit(Action.special)) !== 0;
    const dodge = (pressed & (bit(Action.leftTrigger) | bit(Action.rightTrigger))) !== 0;
    const row = inputRow({
      held, pressed, released, axisX: x, axisZ: z,
      triggerLeft: (held & bit(Action.leftTrigger)) !== 0 ? 255 : 0,
      triggerRight: (held & bit(Action.rightTrigger)) !== 0 ? 255 : 0,
      specialX: special ? sign(x) : 0, specialZ: special ? sign(z) : 0,
      dodgeX: dodge ? sign(x) : 0, dodgeZ: dodge ? sign(z) : 0,
    });
    if (row === undefined) throw new Error(`frame ${frame}: no journal row holds held ${held} pressed ${pressed} released ${released} stick ${x},${z}`);
    return row;
  }
}

/** The playable build with the scene recorder: what players run, reporting what it draws. */
export const SOAK_ENTRY = {
  start: () => {
    startBuild(PLAYABLE_BUILD);
    startMatchSceneReport();
  },
  install: () => {
    installGame(PLAYABLE_BUILD);
    installSceneReport();
  },
};

function readIn<T>(client: HeadlessClient, body: () => T): T {
  let result: T | undefined;
  client.run(() => {
    result = body();
  });
  return result as T;
}

/** A match's fighters and stage as the game numbers them. */
function matchChoices(match: SoakMatch): { readonly fighters: readonly Character[]; readonly stage: number } {
  const fighters = match.fighters.map((name) => {
    const character = CHARACTERS[name];
    if (character === undefined) throw new Error(`no fighter named ${name}`);
    return character;
  });
  const stage = STAGES[match.stage];
  if (stage === undefined) throw new Error(`no stage named ${match.stage}`);
  return { fighters, stage };
}

/**
 * Fighter and stage selection through each slot's menus as every client takes
 * them, to the match's first frame; `frame` runs one frame with whatever
 * types for the players.
 */
export function beginMatch(clients: Lockstep, match: SoakMatch, frame: () => void): void {
  const { fighters, stage } = matchChoices(match);
  const frames = (count: number) => {
    for (let index = 0; index < count; index++) frame();
  };
  const host = clients.client(0);
  const until = (what: string, done: () => boolean) => {
    for (let index = 0; index < 120 && !done(); index++) frame();
    if (!done()) throw new Error(`${what} not reached`);
  };
  frames(30);
  for (const client of clients.clients) clients.press(client.slot, Key.n);
  frames(5);
  clients.clients.forEach(({ slot }) => {
    const character = fighters[slot] ?? Character.archer;
    if (match.policies[slot] === "cpu") {
      clients.everywhere(() => panelActions().selection.cycleMode(slot, slot));
      clients.everywhere(() => panelActions().selection.selectCpuChoice(slot, slot, character));
    } else clients.everywhere(() => panelActions().selection.selectChoice(slot, character));
  });
  const chosen = readIn(host, () => shell().game.characterChoices.slice(0, fighters.length));
  if (chosen.join() !== fighters.join()) throw new Error(`fighters ${chosen.join()} chosen, not ${fighters.join()}`);
  clients.press(0, Key.y);
  until("stage selection", () => readIn(host, () => shell().game.phase) === Phase.stageMenu);
  clients.everywhere(() => {
    const { game } = shell();
    const { stage: actions } = panelActions();
    if (stage === 0 || stage === 1) actions.selectStage(0, stage);
    else game.stageChoice = stage;
    while (game.stockCount > STOCKS) actions.changeStocks(0, -1);
    while (game.timeLimitMinutes > MINUTES) actions.changeTime(0, -1);
  });
  clients.press(0, Key.y);
  until("the match", () => readIn(host, () => shell().game.phase) === Phase.match);
}

/**
 * What the soak reads in each client: progress, the waiting notice, the
 * confirmed state and the fighters in play. `journaled` is the frame a
 * player's input source has sent through, when the soak can see it.
 */
export function matchView(journaled: (slot: number) => number | undefined): Pick<SoakDriver, "observe" | "confirmed" | "bodies"> {
  const stalled = new Map<HeadlessClient, { progress: number | undefined; frames: number }>();
  return {
    observe: (client) => {
      const s = shell();
      const playing = s.game.phase === Phase.match && !s.session.paused;
      const progress = playing ? s.runtime.simulationFrame : undefined;
      const last = stalled.get(client) ?? { progress: undefined, frames: 0 };
      last.frames = progress === last.progress ? last.frames + 1 : 0;
      last.progress = progress;
      stalled.set(client, last);
      const sent = journaled(client.slot);
      return {
        progress,
        // What the player sees only matters once the match has stood still a moment.
        waiting: last.frames >= 30 ? client.frames.shownText().find((text) => text.includes("Waiting for")) : undefined,
        ...(playing && sent !== undefined ? { backlog: sent - s.runtime.simulationFrame } : {}),
        over: s.game.phase === Phase.result,
      };
    },
    confirmed: () => {
      const s = shell();
      return s.game.phase === Phase.match || s.game.phase === Phase.result ? { frame: s.runtime.simulationFrame, checksum: confirmedChecksum(s) } : undefined;
    },
    bodies: () => {
      const s = shell();
      if (s.game.phase !== Phase.match || s.runtime.simulationFrame < SETTLED_FRAME) return [];
      const predicted = s.rollback?.speculative.world;
      return PARTICIPANT_SLOTS.flatMap((slot) => {
        if (!isActive(s.world, slot)) return [];
        const out = (world: typeof s.world | undefined) => world !== undefined && isActive(world, slot) && fighterAt(world, slot).status.out;
        if (fighterAt(s.world, slot).status.stocks <= 0 || out(s.world) || out(predicted)) return [];
        const character = s.game.characterChoices[slot];
        return [{ name: `${NAMES[character] ?? "fighter"} (Player ${slot + 1})`, models: clipModels(character) }];
      });
    },
  };
}

interface StockLoss {
  /** Match frames from the start. */
  readonly frame: number;
  readonly percent: number;
  /** Frames since the fighter last took a hit, as observed after each frame; undefined when it never did. */
  readonly sinceHit: number | undefined;
}

/** Attack styles by the move names of the move data (scripts/moveData.ts). */
const MOVE_NAMES: Readonly<Record<number, string>> = {
  [AttackStyle.jab]: "jab", [AttackStyle.forwardTilt]: "forward-tilt", [AttackStyle.forwardTiltUp]: "forward-tilt-up",
  [AttackStyle.forwardTiltDown]: "forward-tilt-down", [AttackStyle.upTilt]: "up-tilt", [AttackStyle.downTilt]: "down-tilt",
  [AttackStyle.forwardSmash]: "forward-smash", [AttackStyle.upSmash]: "up-smash", [AttackStyle.downSmash]: "down-smash",
  [AttackStyle.neutralAir]: "neutral-air", [AttackStyle.forwardAir]: "forward-air", [AttackStyle.backAir]: "back-air",
  [AttackStyle.upAir]: "up-air", [AttackStyle.downAir]: "down-air", [AttackStyle.demonHunterDashAttack]: "dash-attack",
  [AttackStyle.getupAttack]: "get-up-attack", [AttackStyle.ledgeAttack]: "ledge-attack",
};
const THROW_NAMES: Readonly<Record<number, string>> = {
  [GrabAction.throwForward]: "forward-throw", [GrabAction.throwBack]: "back-throw", [GrabAction.throwUp]: "up-throw", [GrabAction.throwDown]: "down-throw",
};
/** The special each projectile flies from. */
const PROJECTILE_MOVES: Readonly<Record<number, string>> = {
  [ProjectileKind.arrow]: "neutral-special", [ProjectileKind.blaster]: "neutral-special", [ProjectileKind.manaBurn]: "neutral-special",
  [ProjectileKind.fanArrow]: "side-special", [ProjectileKind.recoil]: "up-special",
};
/** Specials with nothing that strikes: Archer's mount and Illidan's ascent count once started. */
const STRIKELESS_SPECIALS: Readonly<Record<number, string>> = { [SpecialAction.archerRecovery]: "up-special", [SpecialAction.demonHunterWingAscent]: "up-special" };
/** A fighter that leaves the stage this long after the last hit it took left on its own. */
const UNFORCED_FRAMES = 60;

/** One player's record, and what its fighter showed at the previous observation. */
interface Seen {
  readonly baseHits: number;
  hits: number;
  lastHit: number | undefined;
  damage: number;
  damageTaken: number;
  out: boolean;
  readonly losses: StockLoss[];
  frame: number;
  registry: number | undefined;
  blocks: number;
  grabs: number;
  throws: number;
  parries: number;
  frozen: boolean;
  bearHits: number;
  specialHit: boolean;
  special: number;
  readonly projectiles: number[];
  groundDodging: boolean;
  airDodging: boolean;
  offStage: boolean;
  downDamage: boolean;
  /** Moves this player's fighter landed on the opponent, by name. */
  readonly landed: Record<string, number>;
  /** Match frames the fighter left the stage on its own while the opponent stood on it. */
  readonly departures: number[];
  /** Attacks this player's shield stopped, and dodges started. */
  blocked: number;
  dodges: number;
  /** Jab resets taken: weak hits that kept the fighter lying down. */
  resets: number;
}

function firstSight(f: Readonly<Fighter>, frame: number): Seen {
  return {
    baseHits: f.visuals.hit, hits: f.visuals.hit, lastHit: undefined, damage: f.status.damage, damageTaken: 0, out: false, losses: [], frame,
    registry: f.hits.lastAttackSerial, blocks: f.visuals.shield + f.visuals.shieldReflect, grabs: f.visuals.grab, throws: f.visuals.throw,
    parries: f.visuals.parry, frozen: f.status.frozenFrames > 0, bearHits: f.bear.hitSerial, specialHit: f.special.hit, special: f.special.action,
    projectiles: f.projectiles.map((projectile) => projectile.life), groundDodging: false, airDodging: false, offStage: false,
    downDamage: false, landed: {}, departures: [], blocked: 0, dodges: 0, resets: 0,
  };
}

const land = (seen: Seen, move: string | undefined) => {
  if (move !== undefined) seen.landed[move] = (seen.landed[move] ?? 0) + 1;
};

/**
 * The move that struck `victim` since the previous observation, credited to
 * its attacker: a normal by the attack the victim's hit registry names, else
 * a throw, a pummel, a projectile that ended early, the bear or a special's
 * own contact.
 */
function creditStrike(victim: Readonly<Fighter>, victimSeen: Seen, attackerSlot: number, attacker: Readonly<Fighter>, attackerSeen: Seen, elapsed: number): void {
  const struck = victim.visuals.hit !== victimSeen.hits;
  const registry = victim.hits.lastAttackSerial;
  if (registry !== undefined && registry !== victimSeen.registry && victim.hits.lastAttacker === attackerSlot) {
    const style = attacker.attack.serial === registry ? attacker.attack.style : undefined;
    if (struck && style !== undefined) land(attackerSeen, MOVE_NAMES[style]);
    return;
  }
  if (!struck) return;
  if (victim.visuals.throw !== victimSeen.throws) return land(attackerSeen, THROW_NAMES[attacker.grab.action]);
  if (attacker.grab.action === GrabAction.pummel) return land(attackerSeen, "pummel");
  const ended = attacker.projectiles.findIndex((projectile, index) => projectile.life === 0 && (attackerSeen.projectiles[index] ?? 0) > elapsed);
  const projectile = attacker.projectiles[ended];
  if (projectile !== undefined) return land(attackerSeen, PROJECTILE_MOVES[projectile.kind]);
  if (attacker.bear.hitSerial !== attackerSeen.bearHits) return land(attackerSeen, "side-special");
  const disengage = attacker.hippogryph.kind === HippogryphKind.strike || attacker.special.action === SpecialAction.archerDisengage;
  if (attacker.special.hit && !attackerSeen.specialHit && (disengage || attacker.special.action === SpecialAction.demonHunterImmolate)) land(attackerSeen, "down-special");
}

/**
 * Appends the match's result to `file` as one JSON line, once the result
 * shows: the winner and, per player, the damage and hits taken, each stock
 * lost, the moves its fighter landed, the attacks it blocked, dodges it
 * started and jab resets it took, and when it left the stage on its own while
 * its opponent stood on it. It reads the host's confirmed state after every frame; frames count
 * from the match's start. scripts/soakOutcomes.ts summarizes the file.
 */
function outcomeRecorder(match: SoakMatch, file: string): (client: HeadlessClient, over: boolean) => void {
  const players = new Map<number, Seen>();
  let written = false;
  return (client, over) => {
    if (client.slot !== 0 || written) return;
    const { game, world } = shell();
    if (game.phase !== Phase.match && game.phase !== Phase.result) return;
    const frame = game.timeLimitMinutes * 60 * MATCH_TICKS_PER_SECOND - game.remainingFrames;
    const left = mainDeckLeft(game.stageChoice);
    const right = mainDeckRight(game.stageChoice);
    const active = PARTICIPANT_SLOTS.filter((slot) => isActive(world, slot));
    for (const slot of active) if (!players.has(slot)) players.set(slot, firstSight(fighterAt(world, slot), frame));
    const seenOf = (slot: number): Seen => {
      const seen = players.get(slot);
      if (seen === undefined) throw new Error(`slot ${slot} has no record`);
      return seen;
    };
    // Soak matches have two players: each one's opponent is the other.
    const [first, second] = active;
    if (active.length === 2 && first !== undefined && second !== undefined) {
      for (const [victimSlot, attackerSlot] of [[first, second], [second, first]] as const) {
        const victim = fighterAt(world, victimSlot);
        const attacker = fighterAt(world, attackerSlot);
        const victimSeen = seenOf(victimSlot);
        const attackerSeen = seenOf(attackerSlot);
        creditStrike(victim, victimSeen, attackerSlot, attacker, attackerSeen, frame - victimSeen.frame);
        if (victim.visuals.grab !== victimSeen.grabs) land(attackerSeen, "grab");
        if (victim.status.frozenFrames > 0 && !victimSeen.frozen && attacker.character === Character.rifleman) land(attackerSeen, "down-special");
      }
    }
    for (const slot of active) {
      const f = fighterAt(world, slot);
      const { visuals, status, motion } = f;
      const seen = seenOf(slot);
      if (visuals.parry > seen.parries) land(seen, "side-special");
      if (f.special.action !== seen.special) land(seen, STRIKELESS_SPECIALS[f.special.action]);
      if (visuals.shield + visuals.shieldReflect !== seen.blocks) seen.blocked++;
      if ((f.dodge.groundFrame > 0 && !seen.groundDodging) || (f.dodge.airDodging && !seen.airDodging)) seen.dodges++;
      const downDamage = f.down.state === DownState.damage;
      if (downDamage && !seen.downDamage) seen.resets++;
      seen.downDamage = downDamage;
      if (visuals.hit !== seen.hits) seen.lastHit = frame;
      seen.hits = visuals.hit;
      // A respawn resets the percent; only rises are damage taken.
      seen.damageTaken += Math.max(0, status.damage - seen.damage);
      seen.damage = status.damage;
      if (status.out && !seen.out) seen.losses.push({ frame, percent: status.damage, sinceHit: seen.lastHit === undefined ? undefined : frame - seen.lastHit });
      seen.out = status.out;
      const offStage = !status.out && !motion.grounded && (motion.x < left || motion.x > right);
      const opponent = active.find((other) => other !== slot);
      const rival = opponent === undefined ? undefined : fighterAt(world, opponent);
      const rivalOnStage = rival !== undefined && !rival.status.out && (rival.motion.grounded || (rival.motion.x >= left && rival.motion.x <= right));
      const unforced = seen.lastHit === undefined || frame - seen.lastHit > UNFORCED_FRAMES;
      if (offStage && !seen.offStage && unforced && rivalOnStage) seen.departures.push(frame);
      seen.offStage = offStage;
      seen.frame = frame;
      seen.registry = f.hits.lastAttackSerial;
      seen.blocks = visuals.shield + visuals.shieldReflect;
      seen.grabs = visuals.grab;
      seen.throws = visuals.throw;
      seen.parries = visuals.parry;
      seen.frozen = status.frozenFrames > 0;
      seen.bearHits = f.bear.hitSerial;
      seen.specialHit = f.special.hit;
      seen.special = f.special.action;
      f.projectiles.forEach((projectile, index) => {
        seen.projectiles[index] = projectile.life;
      });
      seen.groundDodging = f.dodge.groundFrame > 0;
      seen.airDodging = f.dodge.airDodging;
    }
    if (!over) return;
    written = true;
    const outcome = {
      index: match.index, seed: match.seed, stage: match.stage, fighters: match.fighters, policies: match.policies,
      winner: game.winner ?? null, timedOut: game.timedOut, interrupted: game.interrupted, frames: frame,
      players: [...players].map(([slot, seen]) => ({
        slot, damageTaken: seen.damageTaken, hitsTaken: seen.hits - seen.baseHits, stockLosses: seen.losses,
        landed: seen.landed, departures: seen.departures, blocked: seen.blocked, dodges: seen.dodges, resets: seen.resets,
      })),
    };
    appendFileSync(file, `${JSON.stringify(outcome)}\n`);
  };
}

export default defineSoakGame({
  entry: SOAK_ENTRY,
  begin: (clients, match) => {
    if (match.typed === true) {
      // Played through the real helpers (test/soak/helper.ts): the soak types what they typed, so no stand-in types.
      beginMatch(clients, match, () => clients.frames(1));
      return { input: () => undefined, ...matchView(() => undefined) };
    }
    const helpers = new JournalHelpers(PLAYABLE_BUILD.id, true);
    const controllers = new Map<number, ControllerRows>();
    match.policies.forEach((policy, slot) => {
      if (policy === "fuzz") controllers.set(slot, new ControllerRows());
      if (policy === "absent") helpers.silent.add(slot);
    });
    helpers.rows = (slot, frame) => controllers.get(slot)?.row(frame) ?? emptyInput();
    beginMatch(clients, match, () => {
      clients.frames(1);
      helpers.service(clients);
    });
    // From here the helpers live on the soak's wall clock, from the frame the match began.
    const began = clients.frame;
    let clock = began;
    helpers.clock = () => clock;
    let silent: ReadonlySet<number> = new Set();
    // A quiet helper's rows wait in it, so only a typing helper's count as sent.
    const view = matchView((slot) => (helpers.silent.has(slot) ? undefined : helpers.journaled(slot)));
    const outcomes = process.env.SOAK_OUTCOMES;
    const record = outcomes === undefined || outcomes === "" ? undefined : outcomeRecorder(match, outcomes);
    return {
      input: (step) => {
        clock = began + step.wallMs / FRAME_MS;
        const frame = Math.floor(step.wallMs / FRAME_MS) + 1;
        for (const [slot, edges] of step.edges) controllers.get(slot)?.edges(frame, edges);
        for (const slot of silent) if (match.policies[slot] !== "absent" && !step.silent.has(slot)) helpers.silent.delete(slot);
        for (const slot of step.silent) helpers.silent.add(slot);
        silent = new Set(step.silent);
        helpers.service(clients);
      },
      ...view,
      typed: (slot) => helpers.typed.get(slot) ?? 0,
      observe: (client) => {
        const seen = view.observe(client);
        record?.(client, seen.over);
        return seen;
      },
    };
  },
});
