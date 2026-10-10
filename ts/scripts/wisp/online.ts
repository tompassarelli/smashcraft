




import { join } from "node:path";
import { Clock, Effect, Schedule } from "effect";
import { dataDirectory, readGameFile } from "wisp/scripts/wisp/gameFiles";
import { type MenuEvent, MenuFailure, type MenuSocket, type Outcome, hostLobby, joinLobby, startLobby } from "wisp/scripts/wisp/menus";
import { MELEE_READY_FILE } from "../../src/runtime/gameFiles";
import { pollUntil } from "../hostPoll";
import { MeleeReady } from "./boundary";
import { type JoinCode, newJoinCode } from "./joinCode";

interface OnlineTimes {

  readonly opponentSeconds: number;

  readonly startSeconds: number;

  readonly hostStartSeconds: number;

  readonly loadSeconds: number;
}

const ONLINE_TIMES: OnlineTimes = { opponentSeconds: 30 * 60, startSeconds: 5 * 60, hostStartSeconds: 30 * 60, loadSeconds: 5 * 60 };


type Say = (line: string) => Effect.Effect<void>;

const record = (value: unknown): Readonly<Record<string, unknown>> => (typeof value === "object" && value !== null ? Object.fromEntries(Object.entries(value)) : {});
const screen = (event: MenuEvent) => (event.messageType === "SetGlueScreen" ? record(event.payload)["screen"] : undefined);
const CREATE_TRIES = 3;


const hostWithCode = (menus: MenuSocket, map: { readonly folder: string; readonly file: string }, makeCode: () => JoinCode = newJoinCode, password?: string) =>
  Effect.suspend(() => {
    const generated = makeCode();
    const code = password === undefined ? generated : { ...generated, password };
    return hostLobby(menus, { folder: map.folder, file: map.file, gameName: code.gameName, password: code.password }).pipe(Effect.as(code));
  }).pipe(Effect.retry({ times: CREATE_TRIES - 1, while: (failure) => failure._tag === "MenuFailure" && failure.problem.includes("refused") }));





const hostLoading = (event: MenuEvent): Outcome<"loading"> => {
  if (screen(event) === "LOADING_SCREEN") return { done: "loading" };
  if (event.messageType === "MultiplayerGameLeave") return { failed: "the lobby closed" };
  return undefined;
};





const startWhenReady = (menus: MenuSocket, seconds: number, say: Say) =>
  Effect.suspend(() => {
    let refusals = 0;

    return startLobby(menus).pipe(Effect.retry({
      schedule: Schedule.during(`${seconds} seconds`),
      while: (failure) => {
        if (failure._tag === "MenuFailure" && failure.problem.includes("closed the menu socket")) return false;
        return ++refusals === 1 ? say("Waiting for your opponent to finish getting the map").pipe(Effect.as(true)) : true;
      },
    }));
  });


const reachMatch = (documents: string, since: number, seconds: number) => {
  const path = join(dataDirectory(documents), MELEE_READY_FILE);
  return pollUntil(
    readGameFile(path, MeleeReady).pipe(
      Effect.map((ready) => (ready !== undefined && ready.modified > since ? true : undefined)),
      Effect.catchTag("MalformedGameFile", () => Effect.void),
    ),
    {
      every: "250 millis",
      within: `${seconds} seconds`,
      orElse: () => Effect.fail(new MenuFailure({ operation: "reach fighter selection", problem: `no new ${MELEE_READY_FILE} within ${seconds} s of the loading screen` })),
    },
  ).pipe(Effect.asVoid);
};





export const hostMatch = (options: {
  readonly menus: MenuSocket;
  readonly map: { readonly folder: string; readonly file: string };
  readonly documents: string;
  readonly say: Say;

  readonly startNow: Effect.Effect<void>;
  readonly times?: OnlineTimes;
  readonly makeCode?: () => JoinCode;
  readonly password?: string;
}) => Effect.gen(function*() {
  const { menus, say } = options;
  const times = options.times ?? ONLINE_TIMES;
  const code = yield* hostWithCode(menus, options.map, options.makeCode, options.password);
  yield* say(`Join code: ${code.text}`);
  yield* say(`Waiting for your opponent; press Start now once they have joined (in Warcraft III they can also join "${code.gameName}" with password ${code.password})`);
  const arrival = yield* Effect.raceFirst(
    menus.expect("wait for the opponent", times.opponentSeconds, hostLoading),
    options.startNow.pipe(Effect.as("asked" as const)),
  );
  const since = yield* Clock.currentTimeMillis;
  if (arrival !== "loading") {
    yield* say("Starting the match");
    yield* startWhenReady(menus, times.startSeconds, say);
  }
  yield* say("Loading the match");
  yield* reachMatch(options.documents, since, times.loadSeconds);
  yield* say("In the match");
  return code;
});


export const joinMatch = (options: {
  readonly menus: MenuSocket;
  readonly code: JoinCode;
  readonly documents: string;
  readonly say: Say;
  readonly times?: OnlineTimes;
}) => Effect.gen(function*() {
  const { menus, code, say } = options;
  const times = options.times ?? ONLINE_TIMES;
  yield* joinLobby(menus, code.gameName, code.password, 10).pipe(Effect.retry({ times: 2, schedule: Schedule.spaced("2 seconds") }));
  yield* say("In the lobby; waiting for the host to start");
  const loading = menus.expect("wait for the host to start", times.hostStartSeconds, (event): Outcome<void> => {
    if (screen(event) === "LOADING_SCREEN") return { done: undefined };
    if (event.messageType === "MultiplayerGameLeave") return { failed: "the lobby closed" };
    return undefined;
  });
  yield* loading;
  const since = yield* Clock.currentTimeMillis;
  yield* say("Loading the match");
  yield* reachMatch(options.documents, since, times.loadSeconds);
  yield* say("In the match");
});
