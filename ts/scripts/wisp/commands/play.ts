






import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Effect, Layer, Option, Schema } from "effect";
import { linePreloadFile } from "wisp/scripts/wisp/preloadRecord";
import { makePlay } from "wisp/scripts/wisp/commands/play";
import { documentsFolder, launcherHealth, launcherLogDirectory, newestLauncherLog } from "wisp/scripts/warcraft/battleNet";
import { type Client, enterLoginField, runTool } from "wisp/scripts/warcraft/desktop";
import { platformLayer } from "wisp/scripts/platform/layer";
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
import type { PlayTools } from "wisp/scripts/platform/play";

interface Playtest {

  readonly build: string;
  readonly map: PlayDeclaration["map"];

  readonly helper: string | undefined;

  readonly computerSlot: number;
  readonly computerOpponent: CpuOpponentChoice;
  readonly computerTier: CpuTier;

  readonly menuReportPort: number;
}


export const PLAYTEST_PREFIX = join(homedir(), ".local/share/Steam/steamapps/compatdata/3516115571/pfx");


export const PLAYTEST: Omit<Playtest, "map" | "helper"> = {
  build: PLAYABLE_BUILD.id,
  computerSlot: 2,
  computerOpponent: CPU_OPPONENT_DEFAULT,
  computerTier: CPU_TIER_DEFAULT,

  menuReportPort: 47124,
};






const TOM_DISPLAY = {
  windowmode: "1", windowwidth: "2876", windowheight: "1916", windowx: "2", windowy: "2",
  reswidth: "1920", resheight: "1280", refreshrate: "120",
} as const;





const RECOMMENDED_GRAPHICS = {
  lightingquality: "2", texquality: "1", shadowquality: "0", pointlightshadowquality: "0",
  foliagequality: "0", waterquality: "0", vsync: "0",
} as const;


const LOAD_SECONDS = 120;
const MATCH_SECONDS = 15;

const problem = (cause: { readonly message: string }) => new PlayProblem({ problem: cause.message });


const until = <A, R>(seconds: number, observe: Effect.Effect<A | undefined, PlayProblem, R>, text: string) =>
  pollUntil(observe, { every: "250 millis", within: `${seconds} seconds`, orElse: () => Effect.fail(new PlayProblem({ problem: text })) });

export function playtest({ build, map, helper, computerSlot, computerOpponent, computerTier, menuReportPort }: Playtest): PlayDeclaration<GameFiles> {

  const ready = (game: PlayGame) => readGameFile(join(dataDirectory(game.documents), MELEE_READY_FILE), MeleeReady).pipe(
    Effect.catchTag("MalformedGameFile", () => Effect.void),
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

    prepare: (documents) => Effect.gen(function*() {
      const gameFiles = yield* GameFiles;
      const { request: requestFile, go, receipt } = files(documents);
      for (const path of [go, receipt]) if ((yield* gameFiles.read(path)) !== undefined) yield* gameFiles.remove(path);
      yield* gameFiles.write(requestFile, linePreloadFile(request));
    }).pipe(Effect.mapError(problem)),

    cleanup: (documents) => Effect.gen(function*() {
      const gameFiles = yield* GameFiles;
      for (const path of Object.values(files(documents))) if ((yield* gameFiles.read(path)) !== undefined) yield* gameFiles.remove(path);
    }).pipe(Effect.mapError(problem)),
    started: (game, since) => until(LOAD_SECONDS, ready(game).pipe(Effect.map((file) => (file !== undefined && file.modified > since && file.value.build === build ? true : undefined))),
      `Smashcraft didn't reach fighter selection within ${LOAD_SECONDS} s (no new ${MELEE_READY_FILE} for ${build})`),

    match: (game) => Effect.gen(function*() {
      const gameFiles = yield* GameFiles;
      const { request: requestFile, go, receipt } = files(game.documents);
      const since = yield* Clock.currentTimeMillis;
      yield* gameFiles.write(go, linePreloadFile("GO")).pipe(Effect.mapError(problem));
      const answer = yield* until(MATCH_SECONDS, gameFiles.read(receipt).pipe(Effect.mapError(problem), Effect.map((file) => (file !== undefined && file.modified >= since ? file.text : undefined))),
        `Smashcraft didn't take the playtest request within ${MATCH_SECONDS} s; a map built before it read requests ignores them`);

      for (const path of [requestFile, go]) if ((yield* gameFiles.read(path).pipe(Effect.mapError(problem))) !== undefined) yield* gameFiles.remove(path).pipe(Effect.mapError(problem));
      if (!answer.includes(`${request} started`)) return yield* new PlayProblem({ problem: `Smashcraft refused the playtest request "${request}": fighter selection had moved on or a human holds Player ${computerSlot + 1}` });
      return `${computerOpponent} ${computerTier} computer as Player ${computerSlot + 1}, match started`;
    }),


    helper: { service: (game) => optionalController({ pid: game.pid, build }) },
  };
}

const ClientSettings = Schema.Struct({
  tools: Schema.Struct({ grim: Schema.String, xdotool: Schema.String, tesseract: Schema.String, nsenter: Schema.optional(Schema.String) }),
});


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


const findWindows = (tools: { readonly xdotool: string }, name: string, x11: Record<string, string>, title: string) =>
  runTool(name, `find ${title} window`, [tools.xdotool, "search", "--name", `^${title.replace(/[.\\^$|?*+()[\]{}]/g, "\\$&")}$`], x11).pipe(
    Effect.map((bytes) => new TextDecoder().decode(bytes).split("\n").filter((line) => line !== "")),
    Effect.catchTag("DesktopFailure", () => Effect.succeed<readonly string[]>([])),
  );

const LoginTools = Schema.Struct({ tools: Schema.Struct({ grim: Schema.String, xdotool: Schema.String, wlrctl: Schema.String, tesseract: Schema.String }) });


const SIGN_IN_PAGE_SECONDS = 30;


const launcherNow = Effect.try({
  try: () => {
    const logs = launcherLogDirectory(PLAYTEST_PREFIX);
    const log = newestLauncherLog(readdirSync(logs));
    return log === undefined ? undefined : launcherHealth(readFileSync(join(logs, log), "utf8"));
  },
  catch: (cause) => new PlayProblem({ problem: `can't read Battle.net's log: ${String(cause)}` }),
});






const signInTom = Effect.gen(function*() {
  let health = yield* launcherNow;
  if (health?.kind !== "sign-in form") return;
  const unreadable = (cause: unknown) => new PlayProblem({ problem: `can't read the sign-in tools from ${clientState}: ${String(cause)}` });
  const fileTools = (yield* Effect.try({ try: () => readFileSync(clientState, "utf8"), catch: unreadable }).pipe(
    Effect.flatMap((text) => Schema.decodeEffect(Schema.fromJsonString(LoginTools))(text).pipe(Effect.mapError(unreadable))),
  )).tools;
  const x11 = { DISPLAY: ":0" };
  const title = "Battle.net Login";

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
  if (args.includes("--install-green")) {
    const { installGreen } = yield* Effect.tryPromise({ try: () => import("../installGreen"), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
    console.log(`Controller helper: ${yield* optionalController()}`);
    return yield* installGreen(documentsFolder(PLAYTEST_PREFIX));
  }
  yield* signInTom;
  const current = yield* currentPlaytest(join(documentsFolder(PLAYTEST_PREFIX), "Maps/00-Smashcraft"));
  const declaration = playtest({ ...PLAYTEST, ...current });
  yield* Effect.try({ try: () => installLatest(documentsFolder(declaration.prefix), current.map.source), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
  return yield* makePlay(declaration, gameFilesLayer, tools, smashcraftWatch.pipe(Layer.provide(platformLayer())))(args);
});
