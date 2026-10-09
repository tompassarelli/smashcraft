




import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { MapEntry } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
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

test("the stack-trace profile's demo command fails on every client through the dispatch boundary [invariant]", () => {
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

