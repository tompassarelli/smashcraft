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
import type { StageTile } from "../../src/game/menu/stageSelection";
import { MATCH_TICKS_PER_SECOND, Phase } from "../../src/game/match/rules";
import { PLAYABLE_BUILD } from "../../src/game/shell/currentBuild";
import { Character } from "../../src/game/sim/codes";
import { fighterAt, isActive } from "../../src/game/sim/roster";
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
const STAGES: Readonly<Record<string, StageTile>> = { "sky-deck": 0, "three-bridges": 1 };
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
function matchChoices(match: SoakMatch): { readonly fighters: readonly Character[]; readonly stage: StageTile } {
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
    actions.selectStage(0, stage);
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

/**
 * Appends the match's result to `file` as one JSON line, once the result
 * shows: the winner and, per player, the damage and hits taken and each
 * stock lost. It reads the host's confirmed state after every frame; frames
 * count from the match's start. scripts/soakOutcomes.ts summarizes the file.
 */
function outcomeRecorder(match: SoakMatch, file: string): (client: HeadlessClient, over: boolean) => void {
  const players = new Map<number, { baseHits: number; hits: number; lastHit: number | undefined; damage: number; damageTaken: number; out: boolean; losses: StockLoss[] }>();
  let written = false;
  return (client, over) => {
    if (client.slot !== 0 || written) return;
    const { game, world } = shell();
    if (game.phase !== Phase.match && game.phase !== Phase.result) return;
    const frame = game.timeLimitMinutes * 60 * MATCH_TICKS_PER_SECOND - game.remainingFrames;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      const { visuals, status } = fighterAt(world, slot);
      const seen = players.get(slot) ?? { baseHits: visuals.hit, hits: visuals.hit, lastHit: undefined, damage: status.damage, damageTaken: 0, out: false, losses: [] };
      if (visuals.hit !== seen.hits) seen.lastHit = frame;
      seen.hits = visuals.hit;
      // A respawn resets the percent; only rises are damage taken.
      seen.damageTaken += Math.max(0, status.damage - seen.damage);
      seen.damage = status.damage;
      if (status.out && !seen.out) seen.losses.push({ frame, percent: status.damage, sinceHit: seen.lastHit === undefined ? undefined : frame - seen.lastHit });
      seen.out = status.out;
      players.set(slot, seen);
    }
    if (!over) return;
    written = true;
    const outcome = {
      index: match.index, seed: match.seed, stage: match.stage, fighters: match.fighters, policies: match.policies,
      winner: game.winner ?? null, timedOut: game.timedOut, interrupted: game.interrupted, frames: frame,
      players: [...players].map(([slot, seen]) => ({ slot, damageTaken: seen.damageTaken, hitsTaken: seen.hits - seen.baseHits, stockLosses: seen.losses })),
    };
    appendFileSync(file, `${JSON.stringify(outcome)}\n`);
  };
}

export default defineSoakGame({
  entry: SOAK_ENTRY,
  begin: (clients, match) => {
    const helpers = new JournalHelpers(PLAYABLE_BUILD.id, true);
    helpers.pairsOnly = true;
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
      observe: (client) => {
        const seen = view.observe(client);
        record?.(client, seen.over);
        return seen;
      },
    };
  },
});
