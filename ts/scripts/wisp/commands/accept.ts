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
import { ClientWatch } from "wisp/scripts/wisp/watch";
import { MAP_PROFILES, SMASHCRAFT_ACCEPT } from "../acceptChecks";
import { rebuildMap } from "../mapInputs";
import { clientState, gameFilesLayer } from "../project";
import { freshMatch, sendDevCommand } from "./fresh";
import { profileOptions } from "./map";

/** Client names from the clients file, for the plan; reading it touches no client. */
const clientNames = (): [string, ...string[]] => {
  try {
    const names = (JSON.parse(readFileSync(clientState, "utf8")) as { clients?: { name?: unknown }[] }).clients?.flatMap(({ name }) => (typeof name === "string" ? [name] : [])) ?? [];
    return names.length > 0 ? [names[0]!, ...names.slice(1)] : ["a", "b"];
  } catch {
    return ["a", "b"];
  }
};

// wisp watch's live client states (wisp#21) aren't in Wisp yet; a live run stops here with this line until they are.
const watchLayer = Layer.effect(ClientWatch, Effect.fail(new AcceptFailure({ operation: "watch clients", problem: "this Wisp has no live `wisp watch` states yet (wisp#21); --dry-run works" })));

export const accept: Command = (args) => Effect.gen(function*() {
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
  }).pipe(Layer.provide(Layer.mergeAll(Clients.layer(clientState), gameFilesLayer, watchLayer)));
  yield* makeAccept({ suite: SMASHCRAFT_ACCEPT, evidenceRoot: join(homedir(), ".local/state/smashcraft/accept"), driver, clients: clientNames() })(args);
});
