import { expect, test } from "bun:test";
import { Effect } from "effect";
import { type Command } from "wisp/scripts/wisp/command";
import { clientArguments, clientWith } from "../scripts/wisp/commands/client";
import { clientState } from "../scripts/wisp/project";

test("every client action retains an explicit client configuration", () => {
  const path = "/home/tom/.local/state/wisp/lan/pair-3/clients.json";
  for (const action of ["watch", "wait", "doctor", "sign-out", "look", "keys", "chat"]) {
    expect(clientArguments([action, "a", "--clients-file", path])).toEqual({ clientsFile: path, args: [action, "a"] });
    expect(clientArguments([`--clients-file=${path}`, action, "a"])).toEqual({ clientsFile: path, args: [action, "a"] });
  }
  expect(clientArguments(["watch", "--once"])).toEqual({ clientsFile: clientState, args: ["watch", "--once"] });
});

test("an incomplete or repeated explicit selector fails instead of reaching default clients", () => {
  for (const args of [["watch", "--clients-file"], ["--clients-file=", "doctor"], ["doctor", "--clients-file", "--once"], ["watch", "--clients-file=a", "--clients-file=b"]]) {
    expect(() => clientArguments(args)).toThrow("--clients-file takes one client configuration path");
  }
});

test("watch, doctor and input bind observation and nested recovery to the selected client set", async () => {
  const sets = new Map([
    ["/home/tom/.local/state/smashcraft/selection-fixture/offline.json", [1101, 1102]],
    ["/home/tom/.local/state/smashcraft/selection-fixture/other.json", [2101, 2102]],
  ]);
  const calls: { readonly action: string; readonly clientsFile: string; readonly pids: readonly number[] }[] = [];
  const observe = (action: string, clientsFile: string): Command => () => Effect.sync(() => {
    const pids = sets.get(clientsFile);
    if (pids === undefined) throw new Error(`unselected or missing client set: ${clientsFile}`);
    calls.push({ action, clientsFile, pids });
  });
  const run = clientWith({
    make: (clientsFile, _watch, doctor) => (args) => Effect.gen(function*() {
      if (args[0] === "doctor" || args[0] === "keys") {
        if (doctor === undefined) throw new Error("no selected doctor");
        yield* doctor(args.slice(1));
      }
      if (args[0] !== "doctor") yield* observe(args[0] ?? "", clientsFile)(args.slice(1));
    }),
    doctor: clientsFile => observe("doctor", clientsFile),
    signOut: clientsFile => observe("sign-out", clientsFile),
  });
  for (const [clientsFile, pids] of sets) {
    calls.length = 0;
    for (const action of ["watch", "doctor", "keys"]) await Effect.runPromise(run([action, "a", "--clients-file", clientsFile]));
    expect(calls).toEqual([
      { action: "watch", clientsFile, pids },
      { action: "doctor", clientsFile, pids },
      { action: "doctor", clientsFile, pids },
      { action: "keys", clientsFile, pids },
    ]);
  }
  calls.length = 0;
  await expect(Effect.runPromise(run(["doctor", "--clients-file"]))).rejects.toThrow("--clients-file takes one client configuration path");
  await expect(Effect.runPromise(run(["doctor", "--clients-file", "/home/tom/.local/state/smashcraft/selection-fixture/missing.json"]))).rejects.toThrow("unselected or missing client set");
  expect(calls).toEqual([]);
});
