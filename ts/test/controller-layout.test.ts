import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { setControllerLayout } from "../scripts/wisp/controllerLayout";
const scratch = mkdtempSync(join(tmpdir(), "smashcraft-layout-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
test("offline layout saves preserve tap jump and both trigger choices [spec docs/play.md] [invariant]", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("missing port");
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const file = join(scratch, "controller.json");
  const settings = { pad_preset: "standard", tap_jump: true, triggers: { left: "light", right: "full" } };
  writeFileSync(file, JSON.stringify(settings));
  expect(await Effect.runPromise(setControllerLayout("z-jump", file, port))).toBe("saved");
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ ...settings, pad_preset: "z-jump" });
  expect(await Effect.runPromise(setControllerLayout("standard", file, port))).toBe("saved");
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(settings);
});
test("live layout waits for service confirmation and leaves its file to the service [spec docs/play.md]", async () => {
  let received = "";
  const server = createServer((socket) => {
    socket.on("data", (data) => {
      received += data;
      socket.write(JSON.stringify({ status: { settings: { pad_preset: "standard" } } }) + "\n");
      socket.write(JSON.stringify({ status: { settings: { pad_preset: "z-jump" } } }) + "\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("missing port");
  const file = join(scratch, "live.json");
  writeFileSync(file, "unchanged");
  try {
    expect(await Effect.runPromise(setControllerLayout("z-jump", file, address.port))).toBe("live");
    expect(JSON.parse(received)).toEqual({ pad_preset: "z-jump" });
    expect(readFileSync(file, "utf8")).toBe("unchanged");
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
