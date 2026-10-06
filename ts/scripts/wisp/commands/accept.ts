// `bun wisp accept [--only ID...] [--dry-run] [--out DIR]`: every open native
// check Smashcraft declares (smashcraft:ts/scripts/wisp/acceptChecks.ts), run
// on clients A and B in as few fresh matches as their maps allow.
// Evidence goes to ~/.local/state/smashcraft/accept/RUN/ (wisp:docs/accept.md).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { AcceptFailure } from "wisp/scripts/wisp/accept";
import { liveAcceptDriver } from "wisp/scripts/wisp/acceptLive";
import { Clients } from "wisp/scripts/wisp/clients";
import type { Command } from "wisp/scripts/wisp/command";
import { makeAccept } from "wisp/scripts/wisp/commands/accept";
import { step } from "wisp/scripts/wisp/timings";
import { MAP_PROFILES, SMASHCRAFT_ACCEPT } from "../acceptChecks";
import { rebuildMap } from "../mapInputs";
import { clientState, gameFilesLayer } from "../project";
import { freshMatch, sendDevCommand } from "./fresh";
import { profileOptions } from "./map";
import { onHealthyClients, smashcraftWatch } from "../doctor";

/** Client names from the clients file, for the plan; reading it touches no client. */
const clientNames = (): [string, ...string[]] => {
  try {
    const names = (JSON.parse(readFileSync(clientState, "utf8")) as { clients?: { name?: unknown }[] }).clients?.flatMap(({ name }) => (typeof name === "string" ? [name] : [])) ?? [];
    return names.length > 0 ? [names[0]!, ...names.slice(1)] : ["a", "b"];
  } catch {
    return ["a", "b"];
  }
};

// Doctor heals the clients before the run and once after a failure
// (wisp:docs/doctor.md): before Clients' layer finds each client's window, so
// a client it relaunches is driven by its new window. A run's failures are
// its checks' verdicts, so the run isn't repeated. The watch decides that
// each session's match runs and that no client crashed or dropped.

export const accept: Command = (args) => {
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
      yield* freshMatch(profile.path, false);
      yield* sendDevCommand(profile.quick).pipe(step(profile.quick));
    }).pipe(Effect.provide(options.services.pipe(Layer.provideMerge(Clients.layer(clientState)))));
  });
  const driver = liveAcceptDriver({
    start,
    receipt: (name) => name.startsWith("smashcraft-dev-") || name.startsWith("smashcraft-error-"),
  }).pipe(Layer.provide(Layer.mergeAll(Clients.layer(clientState), gameFilesLayer, smashcraftWatch())));
  const run = makeAccept({ suite: SMASHCRAFT_ACCEPT, evidenceRoot: join(homedir(), ".local/state/smashcraft/accept"), driver, clients: clientNames() })(args);
  // A dry run touches no client.
  return args.includes("--dry-run") ? run : onHealthyClients(run, { retry: false });
};
