// What a player of the playable build can read. Two simulated clients play
// its entry through fighter selection, a one-stock match that ends when
// Player 1 walks off, and the results, on the keyboard alone.
// No text a frame shows and no message the map displays may contain what the
// developer line prints; the development and integrity builds still show it.
// Neither may it show a runtime error report, which the error file keeps.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { on } from "wisp/src/platform/dispatch";
import { Phase, holdingStart } from "../src/game/match/rules";
import { CURRENT_BUILD, INTEGRITY_BUILD, PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install as installPlayable, start as startPlayable } from "../src/platform/playableMain";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
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

  constructor(client: HeadlessClient) {
    const { natives } = client;
    const created = (name: string, parentArg: number) => {
      const create = natives[name] as Native;
      natives[name] = (...args: unknown[]) => {
        const frame = create(...args);
        this.frames.set(frame, { parent: args[parentArg], text: "", visible: true });
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

}

/** Distinct texts the clients showed, frame texts and messages, after each frame. */
function recordShown(clients: Lockstep, views: readonly FrameView[], shown: Set<string>): void {
  for (const view of views) for (const text of view.texts()) shown.add(text);
  for (const client of clients.clients) for (const message of client.messages) shown.add(message);
}

const developerText = (text: string) => DENIED.filter((term) => text.toLowerCase().includes(term));

test("the playable build shows players no developer text through selection, a match and its results [spec docs/playable-0047.md]", () => {
  const clients = headless.clients({ install: installPlayable, start: startPlayable });
  const views = clients.clients.map((client) => new FrameView(client));
  const shown = new Set<string>();
  const frames = (count: number) => {
    for (let frame = 0; frame < count; frame++) {
      clients.frames(1);
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
  // Move right picks each player's next fighter.
  for (const slot of [0, 1]) clients.press(slot, Key.r);
  frames(10);
  clients.everywhere(() => {
    panelActions().selection.changeStocks(0, -1);
    panelActions().selection.changeStocks(0, -1);
  });
  clients.press(0, Key.y);
  frames(10);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  frames(10);
  clients.press(0, Key.y);
  for (let frame = 0; frame < 120 && !phases().every((phase) => phase === Phase.match); frame++) frames(1);
  expect(phases()).toEqual([Phase.match, Phase.match]);
  for (let frame = 0; frame < 240 && clients.clients.some((client) => { let held = true; client.run(() => { held = holdingStart(shell().game); }); return held; }); frame++) frames(1);
  // Player 1 holds Move left (W) until they walk off the stage.
  for (const client of clients.clients) client.key(0, Key.w, 0, true);
  for (let frame = 0; frame < 1200 && !phases().every((phase) => phase === Phase.result); frame++) frames(1);
  expect(phases()).toEqual([Phase.result, Phase.result]);
  frames(15);

  expect(clients.clients.map((client) => {
    let winner: number | undefined;
    client.run(() => {
      winner = shell().game.winner;
    });
    return winner;
  })).toEqual([1, 1]);
  expect(shown.has("Player 2 wins!")).toBe(true);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect([...shown].filter((text) => developerText(text).length > 0)).toEqual([]);
});

/** The shell's per-frame handler, which every frame of a started map runs (src/platform/shell/shell.ts). */
const SHELL_TICK = "shell.tick";
const DELIBERATE_FAILURE = "deliberate failure";
const REPORT_TEXT = `error in ${SHELL_TICK}: Error: ${DELIBERATE_FAILURE}`;

/** Makes the shell's per-frame handler fail in every client for three frames, recording what they show. */
function failFrames(clients: Lockstep, views: readonly FrameView[], shown: Set<string>): void {
  clients.everywhere(() => {
    on(SHELL_TICK, () => {
      throw new Error(DELIBERATE_FAILURE);
    });
  });
  for (let frame = 0; frame < 3; frame++) {
    clients.frames(1);
    recordShown(clients, views, shown);
  }
}

/** The first two lines of a client's error file: the report's heading and its message. */
const errorReport = (client: HeadlessClient) => client.files.get(`smashcraft-error-p${client.slot}.txt`)?.slice(0, 2);
const REPORT_LINES = [`error 1 in ${SHELL_TICK}`, `Error: ${DELIBERATE_FAILURE}`];

test("a failing handler in the playable build shows players no error text, and each client still writes its error report [spec docs/typescript.md]", () => {
  const clients = headless.clients({ install: installPlayable, start: startPlayable });
  const shown = new Set<string>();
  clients.start();
  failFrames(clients, clients.clients.map((client) => new FrameView(client)), shown);
  expect([...shown].filter((text) => text.includes(SHELL_TICK) || text.includes(DELIBERATE_FAILURE))).toEqual([]);
  for (const client of clients.clients) {
    expect(errorReport(client)).toEqual(REPORT_LINES);
    expect(client.errors).toEqual([REPORT_TEXT]);
  }
});

