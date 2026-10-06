// `bun wisp play`: from Tom's desktop to a match against a computer, with
// his Xbox controller (wisp:docs/play.md). Wisp hosts the map once Warcraft
// III has read its ladder maps; the map reads the playtest request at its
// start and starts the match on the go-ahead
// (src/platform/shell/playtest.ts). The map, its helper and the computer's
// slot are declared here and change with each candidate.
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Effect, Option, Schema } from "effect";
import { linePreloadFile } from "wisp/scripts/wisp/boundary";
import { makePlay } from "wisp/scripts/wisp/commands/play";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { GameFiles, dataDirectory, readGameFile } from "wisp/scripts/wisp/gameFiles";
import { type PlayDeclaration, type PlayGame, PlayProblem } from "wisp/scripts/wisp/play";
import { playtestRequest } from "../../../src/game/shell/playtest";
import { JournalMenu, PLAYTEST_GO_FILE, PLAYTEST_REQUEST_FILE, journalMenuFile, playtestReceiptFile } from "../boundary";
import { clientState, gameFilesLayer } from "../project";
import { smashcraftWatch } from "../doctor";
import { currentPlaytest } from "../currentPlaytest";
import { installLatest } from "../mapLibrary";
import type { Command } from "wisp/scripts/wisp/command";
import { PLAYABLE_BUILD } from "../../../src/game/shell/currentBuild";
import type { PlayTools } from "wisp/scripts/wisp/playHost";

interface Playtest {
  /** The map build's ID: its journal files and the helper's --build. */
  readonly build: string;
  readonly map: PlayDeclaration["map"];
  /** The Linux helper for the build. */
  readonly helper: string;
  /** The computer's slot from 0; Tom's own is 0. */
  readonly computerSlot: number;
  /** The computer's level, 1-9: 9 plays its fighter's gameplan at full strength. */
  readonly computerLevel: number;
  /** Where the controller's stable device links are. */
  readonly inputDevices: string;
  /** The report port of the Wisp page installed on Tom's prefix; absent uses ordinary menu controls. */
  readonly menuReportPort?: number;
}

/** Tom's own Warcraft III install. */
const PLAYTEST_PREFIX = join(homedir(), ".local/share/Steam/steamapps/compatdata/3516115571/pfx");

/** Journal identity of the current playable profile; map and helper resolve from main at invocation. */
export const PLAYTEST: Omit<Playtest, "map" | "helper"> = {
  build: PLAYABLE_BUILD.id,
  computerSlot: 2,
  computerLevel: 9,
  inputDevices: "/dev/input/by-id",
  // Tom's install is not a test client, so the clients file doesn't list it.
  menuReportPort: 47124,
};

/** Seconds the map has to reach fighter selection, and to take the go-ahead. */
const LOAD_SECONDS = 120;
const MATCH_SECONDS = 15;

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

export function playtest({ build, map, helper, computerSlot, computerLevel, inputDevices, menuReportPort }: Playtest): PlayDeclaration<GameFiles> {
  const name = journalMenuFile(build, 0);
  /** The host's menu file; one being written reads as absent. */
  const menu = (game: PlayGame) => readGameFile(join(dataDirectory(game.documents), name), JournalMenu).pipe(
    Effect.catchTag("MalformedGameFile", () => Effect.succeed(undefined)),
    Effect.mapError(problem),
  );
  const request = playtestRequest(1 << computerSlot, computerLevel);
  const files = (documents: string) => ({
    request: join(dataDirectory(documents), PLAYTEST_REQUEST_FILE),
    go: join(dataDirectory(documents), PLAYTEST_GO_FILE),
    receipt: join(dataDirectory(documents), playtestReceiptFile(0)),
  });
  return {
    prefix: PLAYTEST_PREFIX,
    display: ":0",
    shortcut: { appId: 3775098022, name: "Warcraft III (Battle.net)" },
    map,
    gameName: "Smashcraft",
    ...(menuReportPort === undefined ? {} : { menuReportPort }),
    debugDirectory: join(homedir(), ".local/state/smashcraft/play-debug"),
    // The request, read once at map start; no go-ahead or receipt from an earlier run.
    prepare: (documents) => Effect.gen(function*() {
      const gameFiles = yield* GameFiles;
      const { request: requestFile, go, receipt } = files(documents);
      for (const path of [go, receipt]) if ((yield* gameFiles.read(path)) !== undefined) yield* gameFiles.remove(path);
      yield* gameFiles.write(requestFile, linePreloadFile(request));
    }).pipe(Effect.mapError(problem)),
    // A request left behind would have the map's next session look for a go-ahead twice a second at fighter selection.
    cleanup: (documents) => Effect.gen(function*() {
      const gameFiles = yield* GameFiles;
      for (const path of Object.values(files(documents))) if ((yield* gameFiles.read(path)) !== undefined) yield* gameFiles.remove(path);
    }).pipe(Effect.mapError(problem)),
    started: (game, since) => until(LOAD_SECONDS, menu(game).pipe(Effect.map((file) => (file !== undefined && file.modified > since && file.value.phase === "CHARACTER" ? true : undefined))),
      `Smashcraft didn't reach fighter selection within ${LOAD_SECONDS} s (no new ${name})`),
    // The go-ahead: the map sends the request to every client and starts the match; its receipt says how it went.
    match: (game) => Effect.gen(function*() {
      const gameFiles = yield* GameFiles;
      const { request: requestFile, go, receipt } = files(game.documents);
      const since = yield* Clock.currentTimeMillis;
      yield* gameFiles.write(go, linePreloadFile("GO")).pipe(Effect.mapError(problem));
      const answer = yield* until(MATCH_SECONDS, gameFiles.read(receipt).pipe(Effect.mapError(problem), Effect.map((file) => (file !== undefined && file.modified >= since ? file.text : undefined))),
        `Smashcraft didn't take the playtest request within ${MATCH_SECONDS} s; a map built before it read requests ignores them`);
      // Later sessions of the map start at fighter selection as usual.
      for (const path of [requestFile, go]) if ((yield* gameFiles.read(path).pipe(Effect.mapError(problem))) !== undefined) yield* gameFiles.remove(path).pipe(Effect.mapError(problem));
      if (!answer.includes(`${request} started`)) return yield* new PlayProblem({ problem: `Smashcraft refused the playtest request "${request}": fighter selection had moved on or a human holds Player ${computerSlot + 1}` });
      return `level ${computerLevel} computer as Player ${computerSlot + 1}, match started`;
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

const ClientSettings = Schema.Struct({
  tools: Schema.Struct({ grim: Schema.String, xdotool: Schema.String, wlrctl: Schema.String, tesseract: Schema.String, nsenter: Schema.optional(Schema.String) }),
});

/** The tool paths the clients file records; the commands on PATH without one. */
function clientTools(): Partial<PlayTools> {
  try {
    const decoded = Schema.decodeUnknownOption(ClientSettings)(JSON.parse(readFileSync(clientState, "utf8")));
    if (Option.isNone(decoded)) return {};
    const { nsenter, ...tools } = decoded.value.tools;
    return { ...tools, ...(nsenter === undefined ? {} : { nsenter }) };
  } catch {
    return {};
  }
}

const tools = clientTools();
// Doctor checks the prefix before play and once after a failure (wisp:docs/doctor.md).
export const play: Command = (args) => Effect.gen(function*() {
  const current = yield* currentPlaytest(join(documentsFolder(PLAYTEST_PREFIX), "Maps/00-Smashcraft"));
  const declaration = playtest({ ...PLAYTEST, ...current });
  yield* Effect.try({ try: () => installLatest(documentsFolder(declaration.prefix), current.map.source), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
  return yield* makePlay(declaration, gameFilesLayer, tools, smashcraftWatch())(args);
});
