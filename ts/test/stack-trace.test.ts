// The stack-trace profile's `-dev stack-demo` command on two simulated clients,
// as a chat event reaches the map's real entry. Host stubs stand in for
// Warcraft, and nothing here is compiled with the stack plugin, so the report
// shows the thrown error without frames; test/stack/entry.ts checks those in
// emitted Lua.
import { afterAll, expect, test } from "bun:test";
import { start as startDevelopment } from "../src/platform/main";
import { start as startPlayable } from "../src/platform/playableMain";
import { STACK_DEMO_COMMAND, STACK_DEMO_HANDLER } from "../src/platform/stackDemo";
import { start as startStackTrace } from "../src/platform/stackTraceMain";
import { Lockstep, installNatives } from "./desync/twoClients";

const restoreNatives = installNatives();
afterAll(restoreNatives);

function typeCommand(start: () => void): Lockstep {
  const clients = new Lockstep([0, 1]);
  clients.everywhere(start);
  clients.ticks(30);
  clients.chat(0, STACK_DEMO_COMMAND);
  clients.ticks(2);
  return clients;
}

const reports = (clients: Lockstep) => clients.clients.map((client) => client.files.get(`smashcraft-error-p${client.slot}.txt`));

test("the stack-trace profile's demo command fails on every client through the dispatch boundary", () => {
  const clients = typeCommand(startStackTrace);
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
  for (const start of [startDevelopment, startPlayable]) {
    const clients = typeCommand(start);
    for (const client of clients.clients) expect(client.errors).toEqual([]);
    expect(reports(clients)).toEqual([undefined, undefined]);
  }
});
