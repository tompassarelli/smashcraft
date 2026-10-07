// `wisp online`: direct play by join code (#142; scripts/wisp/online.ts).
// The client's Online page runs these and shows their output lines, which are
// written for players; the technical reason for a failure goes to stderr.
//   setup [--client NAME]                 the menu page and Allow Local Files, after the player agrees
//   host [--client NAME] [--repair]       hosts the newest Smashcraft map, prints "Join code: ABCD-EFGH",
//                                         starts once the opponent is in (or on a "start" line on stdin)
//   join CODE [--client NAME] [--repair]  joins by code and waits for the host to start
// Without --client it is Tom's own install (play's prefix and report port);
// with it, a client of ~/.local/state/smashcraft/clients.json.
import { readFileSync } from "node:fs";
import { Console, Effect, Option, Schema } from "effect";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { type Command, UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { MenuFailure, installMenuPage, reportedMenus } from "wisp/scripts/wisp/menus";
import { readJoinCode } from "../joinCode";
import { newestPlayable } from "../mapLibrary";
import { retailFolder, setUpMenuPage } from "../menuPageSetup";
import { hostMatch, joinMatch } from "../online";
import { clientState, gameFilesLayer } from "../project";
import { PLAYTEST, PLAYTEST_PREFIX } from "./play";

interface Install {
  readonly prefix: string;
  readonly documents: string;
  readonly menuReportPort: number;
}

const DOCUMENTS_IN_PREFIX = "/drive_c/users/steamuser/Documents/Warcraft III";
const ClientsFile = Schema.Struct({
  clients: Schema.Array(Schema.Struct({ name: Schema.String, documents: Schema.String, menuReportPort: Schema.optional(Schema.Int) })),
});

const installOf = (args: readonly string[]) => Effect.gen(function*() {
  const name = flagValues(args, "client")[0];
  if (name === undefined) {
    return { prefix: PLAYTEST_PREFIX, documents: documentsFolder(PLAYTEST_PREFIX), menuReportPort: PLAYTEST.menuReportPort } satisfies Install;
  }
  const clients = Schema.decodeUnknownOption(ClientsFile)((() => {
    try {
      return JSON.parse(readFileSync(clientState, "utf8"));
    } catch {
      return undefined;
    }
  })());
  const client = Option.isSome(clients) ? clients.value.clients.find((entry) => entry.name === name) : undefined;
  if (client === undefined) return yield* new UsageFailure({ problem: `${clientState} has no client ${name}` });
  if (client.menuReportPort === undefined) return yield* new UsageFailure({ problem: `client ${name} has no menuReportPort in ${clientState}` });
  if (!client.documents.endsWith(DOCUMENTS_IN_PREFIX)) return yield* new UsageFailure({ problem: `client ${name}'s documents aren't in a Wine prefix: ${client.documents}` });
  return { prefix: client.documents.slice(0, -DOCUMENTS_IN_PREFIX.length), documents: client.documents, menuReportPort: client.menuReportPort } satisfies Install;
});

const say = (line: string) => Console.log(line);

/** A failure, as the player reads it. */
export function playerProblem(failure: MenuFailure): string {
  const { operation, problem } = failure;
  if (operation === "find the menus") return "Warcraft III isn't open, or its menus aren't set up for Smashcraft. Open Warcraft III, sign in and try again; after setting up, restart Warcraft III once.";
  if (operation.startsWith("host ") || operation === "find the map" || operation === "list maps") return "Warcraft III didn't create the game. Go to Warcraft III's main menu and try again.";
  if (operation.startsWith("join ")) return "Couldn't join that game. Check the code with your opponent; their game may have closed.";
  if (operation === "wait for the opponent") return problem === "the lobby closed" ? "The game closed before your opponent joined." : "Your opponent didn't join in time.";
  if (operation === "wait for the host to start") return problem === "the lobby closed" ? "The host closed the game." : "The host didn't start the match in time.";
  if (operation === "start the game") return "The match didn't start. Your opponent may still be getting the map; press Start again.";
  if (operation === "reach fighter selection") return "The match didn't reach fighter selection.";
  if (operation === "set Allow Local Files" || operation === "install the menu page") return "Smashcraft couldn't set up Warcraft III's menus.";
  return "Something went wrong; the client's log has the details.";
}

/** Prints the player's line for a failure, then fails as before so stderr gets the reason. */
const explained = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.tapError((error) => (error instanceof MenuFailure ? say(playerProblem(error)) : Effect.void)));

/** Succeeds when a "start" line arrives on stdin: the client's Start now. */
const startLine = Effect.callback<void>((resume) => {
  let text = "";
  const read = (chunk: Buffer) => {
    text += chunk.toString();
    if (/^start\s*$/m.test(text)) resume(Effect.void);
  };
  process.stdin.on("data", read);
  return Effect.sync(() => {
    process.stdin.off("data", read);
    process.stdin.pause();
  });
});

const menusOf = (install: Install, repair: boolean) => Effect.gen(function*() {
  // A Warcraft III update can drop the page; writing it again takes effect at the game's next start.
  if (repair) yield* installMenuPage(retailFolder(install.prefix), install.menuReportPort).pipe(Effect.ignore);
  const menus = yield* reportedMenus(install.menuReportPort);
  if (menus === undefined) return yield* new MenuFailure({ operation: "find the menus", problem: `no menu page reported to 127.0.0.1:${install.menuReportPort} within 3 s` });
  return menus;
});

export const online: Command = ([action, ...args]) => Effect.gen(function*() {
  const install = yield* installOf(args);
  const repair = args.includes("--repair");
  switch (action) {
    case "setup": {
      const result = yield* explained(setUpMenuPage(install.prefix, install.menuReportPort));
      if (result === "ready") {
        yield* say("Warcraft III's menus are set up for Smashcraft. Restart Warcraft III if it is open.");
        return;
      }
      yield* say("Almost done: close Warcraft III and Battle.net, then press Set up again.");
      return yield* new MenuFailure({ operation: "set Allow Local Files", problem: `${install.prefix} is in use; user.reg was left unchanged` });
    }
    case "host": {
      const file = newestPlayable(install.documents);
      if (file === undefined) {
        yield* say("Smashcraft isn't in Warcraft III's maps yet. Press Play once to add it.");
        return yield* new UsageFailure({ problem: `no Smashcraft X.Y.Z.w3x in ${install.documents}/Maps/00-Smashcraft` });
      }
      yield* explained(Effect.scoped(Effect.gen(function*() {
        const menus = yield* menusOf(install, repair);
        yield* hostMatch({ menus, map: { folder: "00-Smashcraft", file }, documents: install.documents, say, startNow: startLine });
      }))).pipe(Effect.provide(gameFilesLayer));
      return;
    }
    case "join": {
      const [typed] = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--client");
      const code = typed === undefined ? undefined : readJoinCode(typed);
      if (code === undefined) {
        yield* say("That isn't a join code. Codes look like ABCD-EFGH.");
        return yield* new UsageFailure({ problem: `join takes a code like ABCD-EFGH${typed === undefined ? "" : `, not ${typed}`}` });
      }
      yield* explained(Effect.scoped(Effect.gen(function*() {
        const menus = yield* menusOf(install, repair);
        yield* joinMatch({ menus, code, documents: install.documents, say });
      }))).pipe(Effect.provide(gameFilesLayer));
      return;
    }
    default:
      return yield* new UsageFailure({ problem: `unknown online action ${action ?? ""}`.trim() });
  }
});
