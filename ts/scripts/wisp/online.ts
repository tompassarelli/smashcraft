// Direct play (#142): one player's Warcraft III hosts a private Battle.net
// game of Smashcraft through Wisp's menu page and shows a join code; the
// other's joins by that code. No server of ours is involved: the code names
// the game and carries its password (joinCode.ts). The steps are Wisp's
// hostLobby, joinLobby and startLobby (wisp:docs/driving-warcraft.md).
import { join } from "node:path";
import { Clock, Effect, Schedule } from "effect";
import { dataDirectory, readGameFile } from "wisp/scripts/wisp/gameFiles";
import { type MenuEvent, MenuFailure, type MenuSocket, type Outcome, hostLobby, joinLobby, startLobby } from "wisp/scripts/wisp/menus";
import { MELEE_READY_FILE } from "../../src/runtime/gameFiles";
import { MeleeReady } from "./boundary";
import { type JoinCode, newJoinCode, readyLine } from "./joinCode";

export interface OnlineTimes {
  /** How long a host waits for its opponent. */
  readonly opponentSeconds: number;
  /** How long a lobby may take to start: a guest without this build downloads it from the host first. */
  readonly startSeconds: number;
  /** How long a guest waits for the host to start. */
  readonly hostStartSeconds: number;
  /** From the loading screen to fighter selection. */
  readonly loadSeconds: number;
}

export const ONLINE_TIMES: OnlineTimes = { opponentSeconds: 30 * 60, startSeconds: 5 * 60, hostStartSeconds: 30 * 60, loadSeconds: 5 * 60 };

/** What a player reads; each line is one step. */
export type Say = (line: string) => Effect.Effect<void>;

const record = (value: unknown): Readonly<Record<string, unknown>> => (typeof value === "object" && value !== null ? Object.fromEntries(Object.entries(value)) : {});
const screen = (event: MenuEvent) => (event.messageType === "SetGlueScreen" ? record(event.payload)["screen"] : undefined);
const CREATE_TRIES = 3;

/** Hosts a lobby of the map under a new code; a refused name (another game has it) gets a new code. */
export const hostWithCode = (menus: MenuSocket, map: { readonly folder: string; readonly file: string }, makeCode: () => JoinCode = newJoinCode) => Effect.gen(function*() {
  for (let attempt = 1; ; attempt++) {
    const code = makeCode();
    const hosted = yield* hostLobby(menus, { folder: map.folder, file: map.file, gameName: code.gameName, password: code.password }).pipe(
      Effect.as(true),
      Effect.catchTag("MenuFailure", (failure) => (attempt < CREATE_TRIES && failure.problem.includes("refused") ? Effect.succeed(false) : Effect.fail(failure))),
    );
    if (hosted) return code;
  }
});

/**
 * The opponent is in when its ready line reaches the lobby chat. The host
 * starting the game in Warcraft III itself counts too; the lobby closing ends
 * the wait.
 */
export const opponentArrived = (code: JoinCode) => (event: MenuEvent): Outcome<"in lobby" | "loading"> => {
  if (event.messageType === "ChatMessage" && JSON.stringify(event.payload ?? {}).includes(readyLine(code))) return { done: "in lobby" };
  if (screen(event) === "LOADING_SCREEN") return { done: "loading" };
  if (event.messageType === "MultiplayerGameLeave") return { failed: "the lobby closed" };
  return undefined;
};

/**
 * Starts the hosted lobby. The game ignores a start while a player is still
 * downloading the map, so it is asked again until the loading screen shows.
 */
export const startWhenReady = (menus: MenuSocket, seconds: number, say: Say) => Effect.gen(function*() {
  const deadline = (yield* Clock.currentTimeMillis) + seconds * 1000;
  for (let attempt = 0; ; attempt++) {
    const started = yield* startLobby(menus).pipe(Effect.as(true), Effect.catchTag("MenuFailure", (failure) => Effect.gen(function*() {
      if (failure.problem.includes("closed the menu socket") || (yield* Clock.currentTimeMillis) >= deadline) return yield* failure;
      return false;
    })));
    if (started) return;
    if (attempt === 0) yield* say("Waiting for your opponent to finish getting the map");
  }
});

/** Waits until this player's Smashcraft writes its ready file after `since`: fighter selection. */
export const reachMatch = (documents: string, since: number, seconds: number) => Effect.gen(function*() {
  const path = join(dataDirectory(documents), MELEE_READY_FILE);
  const deadline = (yield* Clock.currentTimeMillis) + seconds * 1000;
  while (true) {
    const ready = yield* readGameFile(path, MeleeReady).pipe(Effect.catchTag("MalformedGameFile", () => Effect.succeed(undefined)));
    if (ready !== undefined && ready.modified > since) return;
    if ((yield* Clock.currentTimeMillis) >= deadline) return yield* new MenuFailure({ operation: "reach fighter selection", problem: `no new ${MELEE_READY_FILE} within ${seconds} s of the loading screen` });
    yield* Effect.sleep("250 millis");
  }
});

/**
 * The host's whole flow: a lobby under a new code, the code shown, then the
 * match once the opponent is in or the player asks to start now.
 */
export const hostMatch = (options: {
  readonly menus: MenuSocket;
  readonly map: { readonly folder: string; readonly file: string };
  readonly documents: string;
  readonly say: Say;
  /** Succeeds when the player asks to start without waiting for the opponent's ready line. */
  readonly startNow: Effect.Effect<void>;
  readonly times?: OnlineTimes;
  readonly makeCode?: () => JoinCode;
}) => Effect.gen(function*() {
  const { menus, say } = options;
  const times = options.times ?? ONLINE_TIMES;
  const code = yield* hostWithCode(menus, options.map, options.makeCode);
  yield* say(`Join code: ${code.text}`);
  yield* say(`Waiting for your opponent (in Warcraft III they can also join "${code.gameName}" with password ${code.password})`);
  const arrival = yield* Effect.raceFirst(
    menus.expect("wait for the opponent", times.opponentSeconds, opponentArrived(code)),
    options.startNow.pipe(Effect.as("asked" as const)),
  );
  const since = yield* Clock.currentTimeMillis;
  if (arrival !== "loading") {
    yield* say(arrival === "asked" ? "Starting the match" : "Your opponent is in; starting the match");
    yield* startWhenReady(menus, times.startSeconds, say);
  }
  yield* say("Loading the match");
  yield* reachMatch(options.documents, since, times.loadSeconds);
  yield* say("In the match");
  return code;
});

/** The guest's whole flow: into the lobby by its code, the ready line, then the match the host starts. */
export const joinMatch = (options: {
  readonly menus: MenuSocket;
  readonly code: JoinCode;
  readonly documents: string;
  readonly say: Say;
  readonly times?: OnlineTimes;
}) => Effect.gen(function*() {
  const { menus, code, say } = options;
  const times = options.times ?? ONLINE_TIMES;
  // A join sent as the host's lobby appeared went unanswered once (7 Oct, client B); the same join a second later entered it.
  yield* joinLobby(menus, code.gameName, code.password, 10).pipe(Effect.retry({ times: 2, schedule: Schedule.spaced("2 seconds") }));
  yield* say("In the lobby; waiting for the host to start");
  // The ready line again a few seconds later, in case the lobby wasn't taking chat yet; the loading screen ends the wait.
  const tell = Effect.gen(function*() {
    yield* Effect.sleep("1 second");
    yield* menus.send("SendGameChatMessage", { content: readyLine(code) });
    yield* Effect.sleep("5 seconds");
    yield* menus.send("SendGameChatMessage", { content: readyLine(code) });
    return yield* Effect.never;
  });
  const loading = menus.expect("wait for the host to start", times.hostStartSeconds, (event): Outcome<void> => {
    if (screen(event) === "LOADING_SCREEN") return { done: undefined };
    if (event.messageType === "MultiplayerGameLeave") return { failed: "the lobby closed" };
    return undefined;
  });
  yield* Effect.raceFirst(loading, tell);
  const since = yield* Clock.currentTimeMillis;
  yield* say("Loading the match");
  yield* reachMatch(options.documents, since, times.loadSeconds);
  yield* say("In the match");
});
