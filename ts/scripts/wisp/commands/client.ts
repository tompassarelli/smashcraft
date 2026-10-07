import { makeClient } from "wisp/scripts/wisp/commands/client";
import { Effect } from "effect";
import { type Command, UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { doctorForClients, signOutForClients } from "../clientDoctorCommand";
import { clientState } from "../project";

/** An explicit selector never falls back to the signed-in clients. */
export function clientArguments(args: readonly string[]): { readonly clientsFile: string; readonly args: readonly string[] } {
  const values = flagValues(args, "clients-file");
  const flags = args.filter(arg => arg === "--clients-file" || arg.startsWith("--clients-file="));
  if (flags.length > 0 && (flags.length !== 1 || values.length !== 1 || values[0] === "")) {
    throw new UsageFailure({ problem: "--clients-file takes one client configuration path" });
  }
  return {
    clientsFile: values[0] ?? clientState,
    args: args.filter((arg, index) => arg !== "--clients-file" && !arg.startsWith("--clients-file=") && args[index - 1] !== "--clients-file"),
  };
}

interface ClientFactories {
  readonly make: typeof makeClient;
  readonly doctor: typeof doctorForClients;
  readonly signOut: typeof signOutForClients;
}

/** Bind observation, input and recovery to one selected clients file before any driver runs. */
export const clientWith = (factories: ClientFactories): Command => (args) => Effect.gen(function*() {
  const selected = yield* Effect.try({ try: () => clientArguments(args), catch: cause => cause instanceof UsageFailure ? cause : new UsageFailure({ problem: String(cause) }) });
  return yield* factories.make(selected.clientsFile, { filePrefix: "smashcraft" }, factories.doctor(selected.clientsFile), factories.signOut(selected.clientsFile))(selected.args);
});

// Match receipts let `client chat` and Return reach a running match (wisp:docs/watch.md, "Typing only into a match").
export const client = clientWith({ make: makeClient, doctor: doctorForClients, signOut: signOutForClients });
