import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { EditboxIngress } from "../src/platform/editboxJournal";
import { nativeChatFile } from "../src/runtime/gameFiles";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { nativeChatEntryReceipt, nativeScript, type NativeSession } from "../scripts/wisp/commands/pad";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePadScript } from "../scripts/integrity/padScript";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("selection chat receipt stays closed after a missed Return and opens only when Warcraft's entry becomes visible [provisional]", () => {
  const clients = headless.clients({ start() {}, install() {} }, [0]);
  clients.start();
  const client = clients.client(0);
  client.run(() => {
    const root = BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0);
    const frame = (parent: framehandle) => BlzCreateFrameByType("FRAME", "", parent, "", 0);
    const chat = frame(root), label = frame(chat), entry = frame(chat), text = frame(entry);
    const children = new Map<framehandle, readonly framehandle[]>([
      [root, [chat]], [chat, [label, entry]], [label, []],
      [entry, [text, frame(entry), frame(entry), frame(entry)]],
      [text, [frame(text), frame(text), frame(text), frame(text), frame(text)]],
    ]);
    const getChild = BlzFrameGetChild, countChildren = BlzFrameGetChildrenCount;
    globalThis.BlzFrameGetChild = (parent, index) => children.get(parent)?.[index] ?? getChild(parent, index);
    globalThis.BlzFrameGetChildrenCount = (parent) => children.get(parent)?.length ?? countChildren(parent);
    try {
      const ingress = new EditboxIngress();
      const path = nativeChatFile("test", 0);
      const read = () => nativeChatEntryReceipt(`function PreloadFiles takes nothing returns nothing\n${(client.files.get(path) ?? []).map((line) => `call Preload( "${line}" )`).join("\n")}\nendfunction\n`);
      BlzFrameSetVisible(chat, false);
      ingress.publishChat("test", 0);
      expect(read()).toEqual({ revision: 1, available: "1", open: "0" });
      const closed = client.files.get(path);
      ingress.publishChat("test", 0);
      expect(client.files.get(path)).toBe(closed);
      BlzFrameSetVisible(chat, true);
      ingress.publishChat("test", 0);
      expect(read()).toEqual({ revision: 2, available: "1", open: "1" });
      BlzFrameSetVisible(chat, false);
      ingress.publishChat("test", 0);
      expect(read()).toEqual({ revision: 3, available: "1", open: "0" });
    } finally {
      globalThis.BlzFrameGetChild = getChild;
      globalThis.BlzFrameGetChildrenCount = countChildren;
    }
  });
});

test("native setup failure retains INVALID at the selected chat boundary without starting the pad timeline [spec AGENTS.md]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-setup-"));
  const data = [join(root, "a"), join(root, "b")] as const;
  data.forEach(dir => mkdirSync(dir));
  const client = (name: string) => ({ name, documents: root, window: "0", x11: {}, wayland: {}, tools: { grim: "/unreachable", xdotool: "/unreachable", wlrctl: "/unreachable", tesseract: "/unreachable" } });
  const session = { clients: [client("lan2a"), client("lan2b")], data, pads: [], build: "test", logs: () => ["", ""], startedMs: 0 } satisfies NativeSession;
  const out = join(root, "out");
  writeFileSync(join(data[0], nativeChatFile("test", 0)), 'function PreloadFiles takes nothing returns nothing\ncall Preload( "SMASHCRAFT CHAT v=1 revision=1 available=0 open=0" )\nendfunction\n');
  try {
    const result = await Effect.runPromise(Effect.gen(function*() {
      const fiber = yield* Effect.forkChild(nativeScript(session, { scriptPath: "unreached.pad", steps: parsePadScript("150 a press A"), helper: "/unreachable", build: "test", out, chat: "-dev quick hero archer" }), { startImmediately: true });
      yield* TestClock.adjust("2 seconds");
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer())));
    expect(result).toBe("invalid");
    const recorded = JSON.parse(readFileSync(join(out, "result.json"), "utf8"));
    expect(recorded.status).toBe("INVALID");
    expect(recorded.invalid[0]).toContain("open chat entry");
    expect(recorded.invalid[0]).toContain("lan2a");
    expect(recorded.edges).toEqual([]);
    expect(existsSync(join(out, "producer.jsonl"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
