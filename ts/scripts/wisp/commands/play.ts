// `bun wisp play`: from Tom's desktop to a match against a computer, played
// on the keyboard, or on his Xbox controller when the controller service has
// one (wisp:docs/play.md). Wisp hosts the map once Warcraft
// III has read its ladder maps; the map reads the playtest request at its
// start and starts the match on the go-ahead
// (src/platform/shell/playtest.ts). The map, its helper and the computer's
// slot are declared here and change with each candidate.
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Effect, Option, Schema } from "effect";
import { linePreloadFile } from "wisp/scripts/wisp/boundary";
import { makePlay } from "wisp/scripts/wisp/commands/play";
import { documentsFolder, launcherHealth, launcherLogDirectory, newestLauncherLog } from "wisp/scripts/warcraft/battleNet";
import { type Client, enterLoginField, findWindows } from "wisp/scripts/warcraft/desktop";
import { GameFiles, dataDirectory, readGameFile } from "wisp/scripts/wisp/gameFiles";
import { type PlayDeclaration, type PlayGame, PlayProblem } from "wisp/scripts/wisp/play";
import { CPU_OPPONENT_DEFAULT, CPU_TIER_DEFAULT, type CpuOpponentChoice, type CpuTier } from "../../../src/game/match/cpuProfiles";
import { playtestRequest } from "../../../src/game/shell/playtest";
import { MeleeReady, PLAYTEST_GO_FILE, PLAYTEST_REQUEST_FILE, playtestReceiptFile } from "../boundary";
import { MELEE_READY_FILE } from "../../../src/runtime/gameFiles";
import { clientState, gameFilesLayer } from "../project";
import { accountField, smashcraftWatch } from "../doctor";
import { currentPlaytest } from "../currentPlaytest";
import { optionalController } from "../controllerService";
import { pollUntil } from "../../hostPoll";
import { installLatest } from "../mapLibrary";
import type { Command } from "wisp/scripts/wisp/command";
import { PLAYABLE_BUILD } from "../../../src/game/shell/currentBuild";
import type { PlayTools } from "wisp/scripts/wisp/playHost";

interface Playtest {
  /** The map build's ID, which its ready file names. */
  readonly build: string;
  readonly map: PlayDeclaration["map"];
  /** The Linux helper for the build, when it built; the always-on controller service runs it when a controller is plugged in. */
  readonly helper: string | undefined;
  /** The computer's slot from 0; Tom's own is 0. */
  readonly computerSlot: number;
  readonly computerOpponent: CpuOpponentChoice;
  readonly computerTier: CpuTier;
  /** The report port of the Wisp page installed on Tom's prefix: play hosts only through it, as a private game. */
  readonly menuReportPort: number;
}

/** Tom's own Warcraft III install. */
export const PLAYTEST_PREFIX = join(homedir(), ".local/share/Steam/steamapps/compatdata/3516115571/pfx");

/** The current playable build; map and helper resolve from main at invocation. */
export const PLAYTEST: Omit<Playtest, "map" | "helper"> = {
  build: PLAYABLE_BUILD.id,
  computerSlot: 2,
  computerOpponent: CPU_OPPONENT_DEFAULT,
  computerTier: CPU_TIER_DEFAULT,
  // Tom's install is not a test client, so the clients file doesn't list it.
  menuReportPort: 47124,
};

/**
 * Tom's display settings for his 2880x1920 screen (his 6 Oct file). Play writes
 * them in before each launch: on 7 Oct his prefix held a test desktop's
 * windowed 1920x1080 settings.
 */
const TOM_DISPLAY = {
  windowmode: "1", windowwidth: "2876", windowheight: "1916", windowx: "2", windowy: "2",
  reswidth: "1920", resheight: "1280", refreshrate: "120",
} as const;

/**
 * Recommended player graphics (smashcraft:docs/graphics-settings.md): written
 * only for keys Tom's file has no value for, never over his own choices.
 */
const RECOMMENDED_GRAPHICS = {
  lightingquality: "2", texquality: "1", shadowquality: "0", pointlightshadowquality: "0",
  foliagequality: "0", waterquality: "0", vsync: "0",
} as const;

/** Seconds the map has to reach fighter selection, and to take the go-ahead. */
const LOAD_SECONDS = 120;
const MATCH_SECONDS = 15;

const problem = (cause: { readonly message: string }) => new PlayProblem({ problem: cause.message });

/** Polls until `observe` returns a value; after `seconds` fails with `text`. */
const until = <A, R>(seconds: number, observe: Effect.Effect<A | undefined, PlayProblem, R>, text: string) =>
  pollUntil(observe, { every: "250 millis", within: `${seconds} seconds`, orElse: () => Effect.fail(new PlayProblem({ problem: text })) });

export function playtest({ build, map, helper, computerSlot, computerOpponent, computerTier, menuReportPort }: Playtest): PlayDeclaration<GameFiles> {
  /** The ready file the map writes at fighter selection; one being written reads as absent. */
  const ready = (game: PlayGame) => readGameFile(join(dataDirectory(game.documents), MELEE_READY_FILE), MeleeReady).pipe(
    Effect.catchTag("MalformedGameFile", () => Effect.succeed(undefined)),
    Effect.mapError(problem),
  );
  const request = playtestRequest(1 << computerSlot, computerOpponent, computerTier);
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
    menuReportPort,
    displaySettings: { ...TOM_DISPLAY, assao: "0" },
    graphicsMode: "reforged",
    recommendedSettings: RECOMMENDED_GRAPHICS,
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
    started: (game, since) => until(LOAD_SECONDS, ready(game).pipe(Effect.map((file) => (file !== undefined && file.modified > since && file.value.build === build ? true : undefined))),
      `Smashcraft didn't reach fighter selection within ${LOAD_SECONDS} s (no new ${MELEE_READY_FILE} for ${build})`),
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
      return `${computerOpponent} ${computerTier} computer as Player ${computerSlot + 1}, match started`;
    }),
    // The keyboard always plays. The always-on controller service finds this
    // game and a pad by itself; without one, play goes on.
    helper: { service: (game) => helper === undefined ? Effect.succeed("keyboard (this build has no controller helper)") : optionalController(helper, game.pid, build) },
  };
}

const ClientSettings = Schema.Struct({
  tools: Schema.Struct({ grim: Schema.String, xdotool: Schema.String, tesseract: Schema.String, nsenter: Schema.optional(Schema.String) }),
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

/** The clients file's tool paths that typing into a sign-in form uses. */
const LoginTools = Schema.Struct({ tools: Schema.Struct({ grim: Schema.String, xdotool: Schema.String, wlrctl: Schema.String, tesseract: Schema.String }) });

/** Seconds Battle.net has to move from one sign-in page to the next. */
const SIGN_IN_PAGE_SECONDS = 30;

/** Battle.net's state on Tom's install by its newest log. */
const launcherNow = Effect.try({
  try: () => {
    const logs = launcherLogDirectory(PLAYTEST_PREFIX);
    const log = newestLauncherLog(readdirSync(logs));
    return log === undefined ? undefined : launcherHealth(readFileSync(join(logs, log), "utf8"));
  },
  catch: (cause) => new PlayProblem({ problem: `can't read Battle.net's log: ${String(cause)}` }),
});

/**
 * Account a, Tom's own, typed into his Battle.net's sign-in form on display :0
 * when it shows one (Tom, 8 Oct): the account page, then the password page.
 * The fields come from accountField's command straight to xdotool, never printed.
 */
const signInTom = Effect.gen(function*() {
  let health = yield* launcherNow;
  if (health?.kind !== "sign-in form") return;
  const fileTools = yield* Effect.try({
    try: () => Schema.decodeUnknownSync(LoginTools)(JSON.parse(readFileSync(clientState, "utf8"))).tools,
    catch: (cause) => new PlayProblem({ problem: `can't read the sign-in tools from ${clientState}: ${String(cause)}` }),
  });
  const x11 = { DISPLAY: ":0" };
  const title = "Battle.net Login";
  // A form in the log of a launcher that isn't running: play starts it and waits for its sign-in.
  if ((yield* findWindows(fileTools, "tom", x11, title).pipe(Effect.mapError(problem))).length === 0) return;
  const enter = (field: "username" | "password") => Effect.gen(function*() {
    const [window] = yield* findWindows(fileTools, "tom", x11, title).pipe(Effect.mapError(problem));
    if (window === undefined) return yield* new PlayProblem({ problem: `Battle.net's "${title}" window closed on display :0` });
    const command = accountField("a", field);
    const printed = Bun.spawnSync(command, { stdin: "ignore", stdout: "pipe", stderr: "ignore" });
    const bytes = new Uint8Array(printed.stdout);
    if (printed.exitCode !== 0) {
      bytes.fill(0);
      return yield* new PlayProblem({ problem: `account a's ${field} command (${command[0]}) exited ${printed.exitCode}` });
    }
    let end = bytes.length;
    while (end > 0 && (bytes[end - 1] === 0x0a || bytes[end - 1] === 0x0d)) end--;
    const secret = bytes.slice(0, end);
    bytes.fill(0);
    if (secret.length === 0) return yield* new PlayProblem({ problem: `account a's ${field} command printed nothing` });
    const desktop: Client = { name: "tom", documents: documentsFolder(PLAYTEST_PREFIX), tools: fileTools, x11, wayland: {}, window };
    yield* enterLoginField(desktop, title, field === "password" ? /^Password$/ : undefined, secret).pipe(Effect.mapError(problem));
  });
  const next = (wanted: (now: typeof health) => boolean, after: string) => until(SIGN_IN_PAGE_SECONDS, launcherNow.pipe(Effect.map((now) => (wanted(now) ? now : undefined))), after);
  if (health.form === "Login") {
    console.log("Battle.net: typing Tom's account name");
    yield* enter("username");
    health = yield* next((now) => (now?.kind === "sign-in form" && now.form === "LoginCredential") || now?.kind === "signed in",
      `Battle.net didn't show its password page within ${SIGN_IN_PAGE_SECONDS} s of the account name`);
  }
  if (health?.kind === "sign-in form" && health.form === "LoginCredential") {
    console.log("Battle.net: typing Tom's password");
    yield* enter("password");
    yield* next((now) => now?.kind === "signed in", `Battle.net didn't sign in within ${SIGN_IN_PAGE_SECONDS} s of the password; check its sign-in window on display :0`);
  }
  console.log("Battle.net: signed in");
});

export const play: Command = (args) => Effect.gen(function*() {
  if (args.includes("--standalone")) {
    const { standalonePlay } = yield* Effect.tryPromise({ try: () => import("../standalone"), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
    return yield* standalonePlay(args);
  }
  yield* signInTom;
  const current = yield* currentPlaytest(join(documentsFolder(PLAYTEST_PREFIX), "Maps/00-Smashcraft"));
  const declaration = playtest({ ...PLAYTEST, ...current });
  yield* Effect.try({ try: () => installLatest(documentsFolder(declaration.prefix), current.map.source), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
  return yield* makePlay(declaration, gameFilesLayer, tools, smashcraftWatch())(args);
});
