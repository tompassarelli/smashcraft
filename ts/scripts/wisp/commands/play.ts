// `bun wisp play`: from Tom's desktop to a match of the current playable
// candidate against a computer, with his Xbox controller (wisp:docs/play.md).
// The candidate, its helper and the computer's slot are declared here and
// change with each candidate.
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Effect, Option, Schema } from "effect";
import { makePlay } from "wisp/scripts/wisp/commands/play";
import { type GameFiles, dataDirectory, readGameFile } from "wisp/scripts/wisp/gameFiles";
import { type PlayDeclaration, type PlayGame, PlayProblem } from "wisp/scripts/wisp/play";
import { cardX } from "../../../src/game/menu/selectionDrag";
import { JournalMenu, journalMenuFile } from "../boundary";
import { clientState, gameFilesLayer } from "../project";

interface Playtest {
  readonly build: string;
  readonly map: PlayDeclaration["map"];
  /** The candidate's Linux helper. */
  readonly helper: string;
  /** The computer's slot from 0; Tom's own is 0. */
  readonly computerSlot: number;
  /** Where the controller's stable device links are. */
  readonly inputDevices: string;
}

const inputs = join(homedir(), ".local/share/smashcraft-build-inputs/playable-0047");

export const PLAYTEST: Playtest = {
  build: "playable-0047",
  map: { folder: "00-Smashcraft", file: "Smashcraft 0.0.47.w3x", title: "Smashcraft 0.0.47" },
  helper: join(inputs, "wc3-journal-0.0.47-fix1"),
  computerSlot: 2,
  inputDevices: "/dev/input/by-id",
};

/** Seconds the map has from Start to fighter selection, and a slot tag click to its new menu file. */
const LOAD_SECONDS = 120;
const TAG_SECONDS = 5;

const problem = (cause: { readonly message: string }) => new PlayProblem({ problem: cause.message });

/** Polls until `observe` returns a value; after `seconds` fails with `text`. */
const until = <A, R>(seconds: number, observe: Effect.Effect<A | undefined, PlayProblem, R>, text: string) => Effect.gen(function*() {
  const deadline = (yield* Clock.currentTimeMillis) + seconds * 1000;
  while (true) {
    const value = yield* observe;
    if (value !== undefined) return value;
    if ((yield* Clock.currentTimeMillis) >= deadline) return yield* new PlayProblem({ problem: text });
    yield* Effect.sleep("250 millis");
  }
});

/**
 * A card's mode tag (src/game/ui/selectionUi.ts: 0.132 by 0.027 from
 * cardX + 0.014, 0.27). Each click cycles its slot HMN, CPU, EMPTY.
 */
const tagCentre = (slot: number) => ({ x: cardX(slot) + 0.014 + 0.066, y: 0.27 - 0.0135 });

/** The widescreen margin right of the 4:3 area, which no frame covers; undefined on a 4:3 window. */
function margin(game: PlayGame) {
  const unit = game.xWindow.height / 0.6;
  const width = (game.xWindow.width / unit - 0.8) / 2;
  return width > 0.01 ? { x: 0.8 + width / 2, y: 0.5167 } : undefined;
}

export function playtest({ build, map, helper, computerSlot, inputDevices }: Playtest): PlayDeclaration<GameFiles> {
  const name = journalMenuFile(build, 0);
  /** The host's menu file; one being written reads as absent. */
  const menu = (game: PlayGame) => readGameFile(join(dataDirectory(game.documents), name), JournalMenu).pipe(
    Effect.catchTag("MalformedGameFile", () => Effect.succeed(undefined)),
    Effect.mapError(problem),
  );
  const bit = 1 << computerSlot;
  const player = `Player ${computerSlot + 1}`;
  return {
    prefix: join(homedir(), ".local/share/Steam/steamapps/compatdata/3516115571/pfx"),
    display: ":0",
    shortcut: { appId: 3775098022, name: "Warcraft III (Battle.net)" },
    map,
    gameName: "Smashcraft",
    debugDirectory: join(homedir(), ".local/state/smashcraft/play-debug"),
    started: (game, since) => until(LOAD_SECONDS, menu(game).pipe(Effect.map((file) => (file !== undefined && file.modified > since && file.value.phase === "CHARACTER" ? true : undefined))),
      `Smashcraft didn't reach fighter selection within ${LOAD_SECONDS} s (no new ${name})`),
    opponent: (game) => Effect.gen(function*() {
      // From EMPTY a computer is two clicks away; from HMN, one.
      for (let click = 0; click < 3; click++) {
        const shown = yield* menu(game);
        if (shown === undefined) return yield* new PlayProblem({ problem: `fighter selection has no ${name}` });
        if ((shown.value.computers & bit) !== 0) return `computer as ${player}`;
        const aside = margin(game);
        // Mouse focus on the inert margin first, as the native slot journeys do.
        if (aside !== undefined) yield* game.clickUi(aside.x, aside.y);
        const tag = tagCentre(computerSlot);
        yield* game.clickUi(tag.x, tag.y);
        yield* until(TAG_SECONDS, menu(game).pipe(Effect.map((file) => (file !== undefined && file.modified > shown.modified ? true : undefined))),
          `clicking ${player}'s card tag didn't change fighter selection`);
      }
      return yield* new PlayProblem({ problem: `no computer appeared as ${player} after 3 clicks on its card tag` });
    }),
    helper: {
      binary: helper,
      ready: /waiting_for_match/,
      log: join(homedir(), ".local/state/smashcraft/play-helper.log"),
      args: (game) => Effect.gen(function*() {
        const pads = yield* Effect.sync(() => {
          try {
            return readdirSync(inputDevices).filter((entry) => /Microsoft.*event-joystick$/.test(entry)).sort();
          } catch {
            return [];
          }
        });
        const [pad] = pads;
        if (pad === undefined) return yield* new PlayProblem({ problem: `no Xbox controller in ${inputDevices}; plug it in and run play again` });
        const device = yield* Effect.try({ try: () => realpathSync(join(inputDevices, pad)), catch: () => new PlayProblem({ problem: `the controller link ${pad} is broken; reconnect it and run play again` }) });
        return [
          "--follow-matches", "--build", build, "--slot", "0", "--device", device, "--out", dataDirectory(game.documents),
          "--editbox-display", game.display, "--x11-window", game.xWindow.id, "--pid", String(game.pid), "--niri-window", String(game.window),
        ];
      }),
    },
  };
}

const ClientTools = Schema.Struct({ tools: Schema.Struct({ grim: Schema.String, xdotool: Schema.String, wlrctl: Schema.String, tesseract: Schema.String }) });

/** The tool paths the clients file records; the commands on PATH without one. */
function clientTools() {
  try {
    const decoded = Schema.decodeUnknownOption(ClientTools)(JSON.parse(readFileSync(clientState, "utf8")));
    return Option.isSome(decoded) ? decoded.value.tools : {};
  } catch {
    return {};
  }
}

export const play = makePlay(playtest(PLAYTEST), gameFilesLayer, clientTools());
