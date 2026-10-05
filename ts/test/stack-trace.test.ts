// The stack-trace profile's `-dev stack-demo` command on two simulated clients,
// as a chat event reaches the map's real entry. Wisp's headless runtime stands
// in for Warcraft, and nothing here is compiled with the stack plugin, so the report
// shows the thrown error without frames; test/stack/entry.ts checks those in
// emitted Lua.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { MapEntry } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import * as development from "../src/platform/main";
import * as playable from "../src/platform/playableMain";
import { STACK_DEMO_COMMAND, STACK_DEMO_HANDLER } from "../src/platform/stackDemo";
import * as stackTrace from "../src/platform/stackTraceMain";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

function typeCommand(entry: MapEntry): Lockstep {
  const clients = headless.clients(entry);
  clients.start();
  clients.frames(30);
  clients.chat(0, STACK_DEMO_COMMAND);
  clients.frames(2);
  return clients;
}

const reports = (clients: Lockstep) => clients.clients.map((client) => client.files.get(`smashcraft-error-p${client.slot}.txt`));

test("the stack-trace profile's demo command fails on every client through the dispatch boundary", () => {
  const clients = typeCommand(stackTrace);
  const message = `Error: stack demo failure: ${STACK_DEMO_COMMAND}`;
  for (const client of clients.clients) {
    expect(client.errors.filter((text) => text.startsWith("error in"))).toEqual([`error in ${STACK_DEMO_HANDLER}: ${message}`]);
  }
  expect(reports(clients).map((report) => report?.slice(0, 2))).toEqual([
    [`error 1 in ${STACK_DEMO_HANDLER}`, message],
    [`error 1 in ${STACK_DEMO_HANDLER}`, message],
  ]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("the development and playable entries have no demo command", () => {
  for (const entry of [development, playable]) {
    const clients = typeCommand(entry);
    for (const client of clients.clients) expect(client.errors).toEqual([]);
    expect(reports(clients)).toEqual([undefined, undefined]);
  }
});
