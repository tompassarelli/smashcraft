import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { captureScene } from "wisp/scripts/wisp/headlessRender";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { createStandaloneSession, NEUTRAL_INPUT, standaloneArguments } from "../scripts/wisp/standalone";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { nativeDriverCommand } from "../src/platform/nativeDriver";
import { install, start } from "../src/platform/nativeDriverMain";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { activeRollback, shell } from "../src/platform/shell/state";
import { Character } from "../src/game/sim/codes";
import { value } from "./rematch/playableMatch";
import { sweep } from "./sweep";

sweep("standalone keyboard play runs a full three-stock Archer versus CPU Rifleman match with scene and sound", async () => {
  const session = await createStandaloneSession();
  try {
    const { client } = session;
    expect(value(client, () => shell().game.stockCount)).toBe(3);
    expect(value(client, () => shell().game.characterChoices.slice(0, 2))).toEqual([Character.archer, Character.rifleman]);
    expect(value(client, () => shell().game.computerMask)).toBe(2);
    const x = value(client, () => shell().world.fighters[0]?.motion.x);
    for (let frame = 0; frame < 12; frame++) session.step({ ...NEUTRAL_INPUT, axisX: 1 });
    expect(value(client, () => shell().world.fighters[0]?.motion.x)).not.toBe(x);
    const scene = captureScene(client);
    expect(scene.effects.length).toBeGreaterThan(0);
    expect(scene.ui.some(frame => frame.visible && frame.text !== "")).toBe(true);
    for (let frame = 0; frame < 25200 && !session.finished(); frame++) session.step(NEUTRAL_INPUT);
    expect(session.finished()).toBe(true);
    expect(client.soundLog.some(cue => cue.event === "start")).toBe(true);
    expect(client.errors).toEqual([]);
  } finally { session.close(); }
});

test("standalone four-fighter match keeps one human and three computers on stage", async () => {
  const session = await createStandaloneSession({ fourFighters: true });
  try {
    const { client } = session;
    expect(value(client, () => shell().game.stockCount)).toBe(99);
    expect(value(client, () => shell().game.computerMask)).toBe(14);
    expect(value(client, () => shell().game.characterChoices.slice(0, 4))).toEqual([Character.archer, Character.rifleman, Character.demonHunter, Character.archer]);
    const x = value(client, () => shell().world.fighters[0]?.motion.x);
    for (let frame = 0; frame < 600; frame++) session.step(NEUTRAL_INPUT);
    expect(value(client, () => shell().world.fighters.filter(fighter => fighter !== undefined && fighter.status.stocks > 0).length)).toBe(4);
    expect(value(client, () => shell().world.fighters[0]?.motion.x)).not.toBe(x);
    expect(session.finished()).toBe(false);
    expect(client.errors).toEqual([]);
  } finally { session.close(); }
});

/** The standalone CPU fixture's confirmed checksum equals the native pad driver's on each of the first `frames` frames. */
async function matchesNativeDriver(frames: number): Promise<void> {
  const script = readFileSync(new URL("./native/pads/cpu-expert.pad", import.meta.url), "utf8");
  const checksums: string[] = [];
  const session = await createStandaloneSession({ script });
  try {
    for (let frame = 1; frame <= frames; frame++) {
      session.step(NEUTRAL_INPUT);
      expect(session.frame()).toBe(frame);
      checksums.push(session.checksum());
    }
  } finally { session.close(); }
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install, start }, [0, 1], { keepCalls: 0 });
    clients.start();
    clients.frames(30);
    clients.everywhere(() => nativeDriverCommand(script));
    clients.everywhere(() => nativeDriverCommand("resume"));
    for (let frame = 1; frame <= frames; frame++) {
      clients.frames(1);
      for (const client of clients.clients) expect(value(client, () => confirmedChecksum(shell())), `frame ${frame} p${client.slot}`).toBe(checksums[frame - 1]);
    }
    for (const client of clients.clients) expect(client.errors).toEqual([]);
  } finally { runtime.restore(); }
}

sweep("standalone CPU fixture matches the native pad driver over its first 300 frames", () => matchesNativeDriver(300), 120000);

sweep("standalone CPU fixture matches the native pad driver at all 1070 frames", () => matchesNativeDriver(1070), 120000);

test("standalone arguments require a complete headless capture", () => {
  expect(standaloneArguments(["--standalone", "--four-fighters", "--frames", "7200", "--out", "build/four"])).toEqual({ fourFighters: true, headless: false, frames: 7200, out: "build/four" });
  expect(() => standaloneArguments(["--four-fighters", "--script", "a.pad"])).toThrow("--four-fighters plays its own inputs");
  expect(standaloneArguments(["--standalone", "--headless", "--frames", "1070", "--out", "build/cpu", "--capture-frames", "200,600,1000"])).toEqual({ headless: true, frames: 1070, out: "build/cpu", captureFrames: [200, 600, 1000] });
  expect(() => standaloneArguments(["--headless"])).toThrow("--headless needs");
});

test("standalone presentation arguments accept the map profiles", () => {
  for (const presentation of ["native", "pool-confirmed", "pool-predicted"]) {
    expect(standaloneArguments(["--standalone", "--presentation", presentation])).toEqual({ headless: false, presentation });
  }
  expect(() => standaloneArguments(["--presentation"])).toThrow("needs a value");
  expect(() => standaloneArguments(["--presentation", "pool"])).toThrow("needs native, pool-confirmed or pool-predicted");
});

test("standalone presentation overrides keep the authored driver and logical capture frames", async () => {
  const script = readFileSync(new URL("./native/pads/cpu-expert.pad", import.meta.url), "utf8");
  for (const presentation of ["native", "pool-confirmed", "pool-predicted"] as const) {
    const session = await createStandaloneSession({ script, presentation });
    try {
      expect(value(session.client, () => shell().build.presentation)).toBe(presentation);
      expect(value(session.client, () => shell().build.inputProfile)).toBe("native-driver");
      expect(value(session.client, () => shell().build.input.kind)).toBe("callback");
      session.step(NEUTRAL_INPUT);
      expect(session.frame()).toBe(1);
      expect(captureScene(session.client).frame).toBe(31);
      expect(session.client.errors).toEqual([]);
    } finally { session.close(); }
  }
});

test("standalone presentation defaults keep live prediction and native scripts", async () => {
  const script = readFileSync(new URL("./native/pads/cpu-expert.pad", import.meta.url), "utf8");
  for (const options of [{}, { script }]) {
    const session = await createStandaloneSession(options);
    try {
      expect(value(session.client, () => shell().build.presentation)).toBe("script" in options ? "native" : "pool-predicted");
      expect(session.client.errors).toEqual([]);
    } finally { session.close(); }
  }
});

test("standalone live presentation reports the frame its fighters show", async () => {
  for (const presentation of ["native", "pool-confirmed", "pool-predicted"] as const) {
    const session = await createStandaloneSession({ presentation });
    try {
      session.step(NEUTRAL_INPUT);
      const confirmed = value(session.client, () => shell().runtime.simulationFrame);
      const predicted = value(session.client, () => activeRollback(shell())?.speculative.runtime.simulationFrame);
      expect(predicted).toBeGreaterThan(confirmed);
      expect(session.frame()).toBe(presentation === "pool-predicted" ? predicted : confirmed);
      expect(session.client.errors).toEqual([]);
    } finally { session.close(); }
  }
});
