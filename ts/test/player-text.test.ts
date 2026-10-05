// What a player of the playable build can read. Two simulated clients play
// its entry through fighter selection, a one-stock match that ends when
// Player 1 walks off, and the results, while an emulated controller helper
// types each player's journal into the edit box as the native helper does.
// No text a frame shows and no message the map displays may contain what the
// developer line prints; the development and integrity builds still show it.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { Action, bit } from "../src/game/input/actions";
import { inputRow } from "../src/game/input/inputRow";
import { encodePacket, inputPacket } from "../src/game/input/wire";
import { Phase } from "../src/game/match/rules";
import { TEXT_WINDOW, textEnvelope } from "../src/game/netcode/journal/text";
import type { MapBuild } from "../src/game/shell/build";
import { CURRENT_BUILD, INTEGRITY_BUILD, PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { quiescentFile } from "../src/game/shell/journalFiles";
import { install, startBuild } from "../src/platform/main";
import { install as installPlayable, start as startPlayable } from "../src/platform/playableMain";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { journalLifecycleFile, journalReadyFile } from "../src/runtime/gameFiles";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

/** Every field the developer line prints, by its label. */
const DEVELOPER_LINE_TERMS = [
  "Developer test", "player=", "phase=", "x=", "z=", "input=", "mode=", "normal=", "move=", "attack-frame=",
  "simulation=", "predicted=", "serial=", "down=", "DI=", "Ctrl+R",
];
/** The values it names: the build's identity and, with journal input, its input and presentation profiles. */
const BUILD_TERMS = [CURRENT_BUILD.id, INTEGRITY_BUILD.id, PLAYABLE_BUILD.id, PLAYABLE_BUILD.inputProfile, PLAYABLE_BUILD.presentation];
/** How the playable build works underneath, which its players never need to read. */
const IMPLEMENTATION_TERMS = ["journal", "editbox", "rollback", "presentation"];
const DENIED = [...DEVELOPER_LINE_TERMS, ...BUILD_TERMS, ...IMPLEMENTATION_TERMS].map((term) => term.toLowerCase());

type Native = (...args: unknown[]) => unknown;

interface ShownFrame {
  /** Undefined for a frame a template made, which the map finds by name. */
  readonly parent: unknown;
  text: string;
  visible: boolean;
}

/**
 * The frames one client's map created and the text and visibility it gave
 * them. Frames of unknown parentage count as shown while their own flag is
 * set, so the text this reports is at least what a player can see.
 */
class FrameView {
  private readonly frames = new Map<unknown, ShownFrame>();
  /** The edit box the helper types into. */
  editbox: unknown;

  constructor(client: HeadlessClient) {
    const { natives } = client;
    const created = (name: string, parentArg: number) => {
      const create = natives[name] as Native;
      natives[name] = (...args: unknown[]) => {
        const frame = create(...args);
        this.frames.set(frame, { parent: args[parentArg], text: "", visible: true });
        if (name === "BlzCreateFrameByType" && args[0] === "EDITBOX") this.editbox = frame;
        return frame;
      };
    };
    created("BlzCreateFrameByType", 2);
    created("BlzCreateFrame", 1);
    created("BlzCreateSimpleFrame", 1);
    const destroy = natives.BlzDestroyFrame as Native;
    natives.BlzDestroyFrame = (frame: unknown) => {
      this.frames.delete(frame);
      return destroy(frame);
    };
    natives.BlzFrameSetText = (frame: unknown, text: string) => {
      this.frame(frame).text = text;
    };
    natives.BlzFrameGetText = (frame: unknown) => this.frame(frame).text;
    natives.BlzFrameSetVisible = (frame: unknown, visible: boolean) => {
      this.frame(frame).visible = visible;
    };
  }

  private frame(handle: unknown): ShownFrame {
    let known = this.frames.get(handle);
    if (known === undefined) {
      known = { parent: undefined, text: "", visible: true };
      this.frames.set(handle, known);
    }
    return known;
  }

  private shown(handle: unknown): boolean {
    for (let at = this.frames.get(handle); at !== undefined; at = this.frames.get(at.parent)) if (!at.visible) return false;
    return true;
  }

  /** The non-empty text of every shown frame. */
  texts(): string[] {
    return [...this.frames].filter(([handle, { text }]) => text !== "" && this.shown(handle)).map(([, { text }]) => text);
  }

  /** What the helper types: appended to the edit box's text, which the map drains. */
  type(text: string): void {
    this.frame(this.editbox).text += text;
  }
}

/** Frames the helper waits before walking its player off the stage. */
const WALK_AFTER = 10;

/**
 * The companion helper of one client, as wc3-journal --follow-matches serves
 * it: on each match's ready file it types its readiness, then one journal row
 * per frame, at most a text window ahead of the map's receipt; on the end
 * receipt it types the terminal marker and publishes its quiescent file.
 */
class Helper {
  private epoch = 0;
  private sequence = 0;
  private frame = 1;
  private live = false;

  constructor(
    private readonly client: HeadlessClient,
    private readonly view: FrameView,
    private readonly build: string,
    /** Whether this client's player walks off in a match: left from slot 0, right from slot 1. */
    private readonly walks: (epoch: number, slot: number) => boolean,
  ) {}

  private type(payload: string): void {
    const envelope = textEnvelope(this.epoch, ++this.sequence, payload);
    if (envelope === undefined) throw new Error(`no text envelope for ${payload}`);
    this.view.type(envelope);
  }

  private consumed(): number {
    const receipt = this.client.files.get(`smashcraft-journal-text-ack-${this.build}-e${this.epoch}-p${this.client.slot}.txt`)?.[0] ?? "";
    return Number(/ consumed=(\d+) /.exec(receipt)?.[1] ?? 0);
  }

  step(): void {
    const { client, build } = this;
    const { slot } = client;
    if (!this.live) {
      if (!client.files.has(journalReadyFile(build, this.epoch + 1, slot))) return;
      this.epoch++;
      this.sequence = 0;
      this.frame = 1;
      this.live = true;
      this.type(`JR1${this.epoch}`);
      return;
    }
    if (client.files.has(journalLifecycleFile(build, this.epoch, slot, "end"))) {
      this.type(`JE1${this.epoch}`);
      client.published.set(quiescentFile({ build, epoch: this.epoch, slot }), ["Q"]);
      this.live = false;
      return;
    }
    if (this.sequence - this.consumed() >= TEXT_WINDOW - 4) return;
    const walking = this.walks(this.epoch, slot) && this.frame > WALK_AFTER;
    const row = inputRow(walking ? { held: bit(slot === 0 ? Action.moveLeft : Action.moveRight), axisX: slot === 0 ? -127 : 127 } : {});
    const packet = row === undefined ? undefined : inputPacket(this.epoch, this.frame, [row]);
    if (packet === undefined) throw new Error(`no journal row for frame ${this.frame}`);
    this.type(encodePacket(packet));
    this.frame++;
  }
}

/** Distinct texts the clients showed, frame texts and messages, after each frame. */
function recordShown(clients: Lockstep, views: readonly FrameView[], shown: Set<string>): void {
  for (const view of views) for (const text of view.texts()) shown.add(text);
  for (const client of clients.clients) for (const message of client.messages) shown.add(message);
}

const developerText = (text: string) => DENIED.filter((term) => text.toLowerCase().includes(term));

test("the playable build shows players no developer text through selection, a match and its results", () => {
  const clients = headless.clients({ install: installPlayable, start: startPlayable });
  const views = clients.clients.map((client) => new FrameView(client));
  // The first match's walking player is Player 1, as the native capture's.
  const helpers = clients.clients.map((client, index) => new Helper(client, views[index] ?? new FrameView(client), PLAYABLE_BUILD.id, (epoch, slot) => slot === (epoch % 2 === 1 ? 0 : 1)));
  const shown = new Set<string>();
  const frames = (count: number) => {
    for (let frame = 0; frame < count; frame++) {
      clients.frames(1);
      for (const helper of helpers) helper.step();
      recordShown(clients, views, shown);
    }
  };
  const phases = () => clients.clients.map((client) => {
    let phase: Phase = Phase.characterMenu;
    client.run(() => {
      phase = shell().game.phase;
    });
    return phase;
  });

  clients.start();
  frames(30);
  for (const slot of [0, 1]) clients.press(slot, Key.n);
  frames(10);
  clients.press(0, Key.y);
  frames(10);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  clients.everywhere(() => {
    const { stage } = panelActions();
    stage.changeStocks(0, -1);
    stage.changeStocks(0, -1);
  });
  frames(10);
  clients.press(0, Key.y);
  expect(phases()).toEqual([Phase.match, Phase.match]);
  for (let frame = 0; frame < 1200 && !phases().every((phase) => phase === Phase.result); frame++) frames(1);
  expect(phases()).toEqual([Phase.result, Phase.result]);
  frames(15);

  // Predicted presentation draws each client's own prediction, so only the confirmed match must agree.
  expect(clients.clients.map((client) => {
    let winner: number | undefined;
    client.run(() => {
      winner = shell().game.winner;
    });
    return winner;
  })).toEqual([1, 1]);
  // Both clients' end receipts name the winner the result screen shows, for the playable result gate.
  expect(clients.clients.map((client) => client.files.get(journalLifecycleFile(PLAYABLE_BUILD.id, 1, client.slot, "end"))?.[0]?.split(" ").at(-1))).toEqual(["winner=P2", "winner=P2"]);
  expect(shown.has("Player 2 wins!")).toBe(true);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect([...shown].filter((text) => developerText(text).length > 0)).toEqual([]);
});

/** A quick match of `build`: the developer line it shows. */
function developerLine(build: MapBuild): string | undefined {
  const clients = headless.clients({ install, start: () => startBuild(build) });
  const view = new FrameView(clients.clients[0] as HeadlessClient);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(60);
  return view.texts().find((text) => text.startsWith("Developer test: "));
}

test("development and integrity builds still show the developer line, with every term the playable build denies", () => {
  expect(developerLine(CURRENT_BUILD)).toStartWith(`Developer test: ${CURRENT_BUILD.id} |`);
  const integrity = developerLine(INTEGRITY_BUILD);
  for (const term of [...DEVELOPER_LINE_TERMS, INTEGRITY_BUILD.id]) expect(integrity).toContain(term);
  expect(integrity).toContain(`mode=${INTEGRITY_BUILD.inputProfile} ${INTEGRITY_BUILD.presentation}`);
});
