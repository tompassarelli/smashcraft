import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { EditboxIngress } from "../src/platform/editboxJournal";
import { nativeChatFile } from "../src/runtime/gameFiles";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { nativeChatEntryReceipt } from "../scripts/wisp/boundary";

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
