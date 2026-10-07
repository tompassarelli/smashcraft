// `bun wisp accept [--only ID...] [--dry-run] [--out DIR]`: every open native
// check Smashcraft declares (smashcraft:ts/scripts/wisp/acceptChecks.ts), run
// on clients A and B in as few fresh matches as their maps allow.
// Evidence goes to ~/.local/state/smashcraft/accept/RUN/ (wisp:docs/accept.md).
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { AcceptFailure, type AcceptSuite } from "wisp/scripts/wisp/accept";
import { liveAcceptDriver } from "wisp/scripts/wisp/acceptLive";
import { Clients } from "wisp/scripts/wisp/clients";
import { type Command, UsageFailure, flagValues, describeCause } from "wisp/scripts/wisp/command";
import { makeAccept } from "wisp/scripts/wisp/commands/accept";
import { lan } from "wisp/scripts/wisp/commands/lan";
import { step } from "wisp/scripts/wisp/timings";
import { MAP_PROFILES, SMASHCRAFT_ACCEPT } from "../acceptChecks";
import { rebuildMap } from "../mapInputs";
import { clientState, gameFilesLayer } from "../project";
import { freshMatch, sendDevCommand } from "./fresh";
import { profileOptions } from "./map";
import { onHealthyClients, readClientsFile, smashcraftWatch } from "../doctor";
import { LAN_POOL_FILE, lanPairs, withTools } from "../padBatch";

/** Client names from the clients file, for the plan; reading it touches no client. */
const clientNames = (clientsFile: string): [string, ...string[]] => {
  try {
    const [first, ...rest] = readClientsFile(clientsFile).clients.map(({ name }) => name);
    return first === undefined ? ["a", "b"] : [first, ...rest];
  } catch {
    return ["a", "b"];
  }
};

/** Checks name the two player positions a and b; a pool uses its actual client names. */
export const acceptForClients = (suite: AcceptSuite, clients: readonly [string, ...string[]]): AcceptSuite => {
  const rename = <T extends { readonly client?: string }>(entry: T): T => entry.client === undefined ? entry : {
    ...entry, client: entry.client === "a" ? clients[0] : entry.client === "b" ? clients[1] ?? clients[0] : entry.client,
  };
  return { ...suite, checks: suite.checks.map(check => ({ ...check,
    ...(check.setup === undefined ? {} : { setup: check.setup.map(step => "client" in step ? rename(step) : step) }),
    ...(check.capture === undefined ? {} : { capture: check.capture.map(rename) }),
    ...(check.pass === undefined ? {} : { pass: check.pass.map(rule => "client" in rule ? rename(rule) : rule) }),
  })) };
};

// Doctor heals the clients before the run and once after a failure
// (wisp:docs/doctor.md): before Clients' layer finds each client's window, so
// a client it relaunches is driven by its new window. A run's failures are
// its checks' verdicts, so the run isn't repeated. The watch decides that
// each session's match runs and that no client crashed or dropped.

export const accept: Command = (args) => Effect.gen(function*() {
  const requested = flagValues(args, "pair");
  if (args.some(arg => arg === "--pair" || arg.startsWith("--pair=")) && (requested.length !== 1 || !/^\d+$/.test(requested[0] ?? ""))) return yield* new UsageFailure({ problem: "--pair takes one offline pool pair number" });
  const id = requested[0] === undefined ? undefined : Number(requested[0]);
  const pair = id === undefined ? undefined : yield* Effect.try({
    try: () => {
      const selected = lanPairs(LAN_POOL_FILE, { ids: [id] })[0];
      if (selected === undefined) throw new Error(`no offline pair ${id}`);
      return args.includes("--dry-run") ? selected : withTools(selected, clientState, flagValues(args, "out")[0] ?? join(homedir(), ".local/state/smashcraft/accept", `pair-${id}`));
    },
    catch: cause => new UsageFailure({ problem: describeCause(cause) }),
  });
  const selectedClients = pair?.clients ?? clientState;
  const names = clientNames(selectedClients);
  const forwarded = args.filter((arg, index) => arg !== "--pair" && !arg.startsWith("--pair=") && args[index - 1] !== "--pair");
  const rebuilt = new Set<string>();
  const start = (map: string) => Effect.gen(function*() {
    const profile = MAP_PROFILES[map];
    if (profile === undefined) return yield* new AcceptFailure({ operation: "start", problem: `unknown map profile ${map}` });
    const options = yield* profileOptions(profile.rebuild === undefined ? [] : ["--profile", profile.rebuild]);
    yield* Effect.gen(function*() {
      if (profile.rebuild !== undefined && !rebuilt.has(profile.path)) {
        yield* rebuildMap(profile.path).pipe(step("map rebuilt"));
        rebuilt.add(profile.path);
      }
      if (pair?.lan === undefined) yield* freshMatch(profile.path);
      else yield* lan(["fresh", profile.path, "--pair", String(pair.lan)]);
      yield* sendDevCommand(profile.quick).pipe(step(profile.quick));
    }).pipe(Effect.provide(Layer.merge(options.services.pipe(Layer.provideMerge(Clients.layer(selectedClients))), smashcraftWatch())));
  });
  const driver = liveAcceptDriver({
    start,
    receipt: (name) => name.startsWith("smashcraft-dev-") || name.startsWith("smashcraft-error-") || name.startsWith("smashcraft-render-clock-"),
  }).pipe(Layer.provide(Layer.mergeAll(Clients.layer(selectedClients), gameFilesLayer, smashcraftWatch())));
  const run = makeAccept({ suite: acceptForClients(SMASHCRAFT_ACCEPT, names), evidenceRoot: join(homedir(), ".local/state/smashcraft/accept"), driver, clients: names })(forwarded);
  // A dry run touches no client.
  return yield* (args.includes("--dry-run") ? run : onHealthyClients(run, { retry: false, clientsFile: selectedClients }));
});
