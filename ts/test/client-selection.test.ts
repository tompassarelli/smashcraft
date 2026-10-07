import { expect, test } from "bun:test";
import { clientArguments } from "../scripts/wisp/commands/client";
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
