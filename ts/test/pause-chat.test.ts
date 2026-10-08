import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("sending chat with Enter keeps the pause menu paused, while menu Enter still resumes [repro #332]", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0]);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu wren rookie");
  clients.frames(30);
  const client = clients.client(0);
  let root!: framehandle;
  let chat!: framehandle;
  let text!: framehandle;
  client.run(() => {
    root = BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0);
    const frame = (parent: framehandle, type = "FRAME") => BlzCreateFrameByType(type, "", parent, "", 0);
    chat = frame(root);
    frame(chat);
    const entry = frame(chat);
    text = frame(entry, "EDITBOX");
    for (let index = 0; index < 3; index++) frame(entry);
    for (let index = 0; index < 5; index++) frame(text);
    BlzFrameSetVisible(chat, false);
  });
  const getChild = client.natives.BlzFrameGetChild as typeof BlzFrameGetChild;
  const countChildren = client.natives.BlzFrameGetChildrenCount as typeof BlzFrameGetChildrenCount;
  client.natives.BlzFrameGetChild = (parent: framehandle, index: number) => parent === root ? chat : getChild(parent, index);
  client.natives.BlzFrameGetChildrenCount = (parent: framehandle) => parent === root ? 1 : countChildren(parent);
  clients.press(0, Key.y);
  clients.frames(1);
  expect(value(client, () => shell().session.paused)).toBe(true);
  const pausedFrame = value(client, () => shell().runtime.simulationFrame);
  client.run(() => {
    BlzFrameSetVisible(chat, true);
    BlzFrameSetFocus(text, true);
  });
  clients.type(0, "-dev view far");
  expect(value(client, () => BlzFrameGetText(text))).toBe("-dev view far");
  clients.press(0, Key.enter);
  clients.chat(0, value(client, () => BlzFrameGetText(text)));
  client.run(() => {
    BlzFrameSetFocus(text, false);
    BlzFrameSetVisible(chat, false);
  });
  clients.frames(5);
  expect(value(client, () => shell().viewExtreme)).toBe("far");
  expect(value(client, () => shell().session.paused)).toBe(true);
  expect(value(client, () => shell().runtime.simulationFrame)).toBe(pausedFrame);
  clients.press(0, Key.enter);
  clients.frames(5);
  expect(value(client, () => shell().session.paused)).toBe(false);
  expect(client.errors).toEqual([]);
});
