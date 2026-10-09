


import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { joinReplay, parseReplayHeader, parseReplayPart } from "./matchReplay";
import { TAPE_REPLAY_SERIAL, recordTapeReplay } from "./tapeReplay";
import { type ReplayScene, openReplay } from "./viewer";

function joined(): string[] {
  const recorded = recordTapeReplay(700, 401);
  const header = parseReplayHeader(recorded.manifest);
  if (typeof header === "string") throw new Error(header);
  return joinReplay(header, recorded.parts.map((part, index) => {
    const body = parseReplayPart(part, TAPE_REPLAY_SERIAL, index + 1);
    if (typeof body === "string") throw new Error(body);
    return body;
  }));
}


const sceneText = (scene: ReplayScene) =>
  `${scene.frame} ${scene.fighters.map((f) => `${f.slot}:${f.x},${f.z},${f.damage},${f.stocks},${f.parts.length},${f.strikes.length}`).join(" ")}`;

test("replay viewer: stepping and seeking either way show the same frames [invariant]", () => {
  const viewer = openReplay(joined());
  if (typeof viewer === "string") throw new Error(viewer);
  assertEquals(`${viewer.first} ${viewer.last} ${viewer.frame}`, "0 700 0");
  const stepped = new Map<number, string>();
  const sampled = [1, 299, 300, 400, 401, 402, 650, 700];
  let struck = false;
  while (viewer.step()) {
    const scene = viewer.scene();
    if (scene.fighters.some((f) => f.strikes.length > 0)) struck = true;
    if (sampled.includes(viewer.frame)) stepped.set(viewer.frame, sceneText(scene));
  }
  assertEquals(viewer.frame, 700);
  assertTrue(struck);
  assertEquals(viewer.scene().fighters.length, 2);
  for (const frame of [650, 300, 402, 1, 401, 700, 299, 400]) {
    viewer.seek(frame);
    assertEquals(sceneText(viewer.scene()), stepped.get(frame) ?? "");
  }
  viewer.seek(10_000);
  assertEquals(viewer.frame, 700);
  viewer.seek(-5);
  assertEquals(viewer.frame, 0);
  assertTrue(viewer.scene().surfaces.length > 0);
});
