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

// Match receipts let `client chat` and Return reach a running match (wisp:docs/watch.md, "Typing only into a match").
export const client: Command = (args) => Effect.gen(function*() {
  const selected = yield* Effect.try({ try: () => clientArguments(args), catch: cause => cause instanceof UsageFailure ? cause : new UsageFailure({ problem: String(cause) }) });
  return yield* makeClient(selected.clientsFile, { filePrefix: "smashcraft" }, doctorForClients(selected.clientsFile), signOutForClients(selected.clientsFile))(selected.args);
});
