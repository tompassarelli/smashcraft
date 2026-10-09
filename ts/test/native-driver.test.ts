import { readFileSync, readdirSync } from "node:fs";
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { parseRepro } from "wisp/src/runtime/repro";
import { replayRepro } from "../src/game/replay/moment";
import { nativeDriverCommand } from "../src/platform/nativeDriver";
import { install, start } from "../src/platform/nativeDriverMain";
import { shell } from "../src/platform/shell/state";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { fighterAt } from "../src/game/sim/roster";
import { clipFor } from "../src/game/presentation/fighterClips";
import { sweep } from "./sweep";
import { TRACE_FILE, parseExpectations, parseTrace, unmetExpectations } from "../scripts/integrity/padParity";
import { value } from "./rematch/playableMatch";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { NATIVE_DRIVER_BUILD } from "../src/game/shell/currentBuild";
import { install as installGame, startBuild } from "../src/platform/main";
import { installSmashcraftNativeDriver, startSmashcraftNativeDriver } from "../src/platform/nativeDriver";

const runtime = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(runtime.restore);

test("[native] capture driver shows Cairne jab and roll on adjacent held frames (wisp#84)", () => {
  const captured = installHeadless(PREDICTED_HEADLESS);
  const build = { ...NATIVE_DRIVER_BUILD, presentation: "pool-predicted" as const };
  try {
    const clients = captured.clients({
      install() { installGame(build); installSmashcraftNativeDriver(); },
      start() { startBuild(build); installSmashcraftNativeDriver(); startSmashcraftNativeDriver(); },
    }, [0]);
    const client = clients.client(0);
    clients.start();
    clients.frames(3);
    clients.everywhere(() => nativeDriverCommand("#! chat -dev quick hero cairne bloodhoof\n30 a tap A 2\n70 a shield 1\n71 a stick -1 0\n76 a stick 0 0\n"));
    const held = (frame: number) => {
      clients.everywhere(() => nativeDriverCommand(`resume ${frame}`));
      clients.frames(frame + 3);
      expect(value(client, () => shell().runtime.simulationFrame)).toBe(frame);
      const body = client.effectPoses({ visibleOnly: true }).find(pose => pose.model.includes("CairneBloodhoofTimelineBody") && pose.teamColor === 0);
      if (body === undefined) throw new Error("Cairne body missing");
      return body;
    };
    // Warcraft 3.0.1: ref-84-cairne/cairne84.pad and jab-startup-f33, jab-startup-last-f35, roll-first-active-f74.
    const jab33 = held(33);
    const jab35 = held(35);
    expect(jab35.animationElapsed).not.toBe(jab33.animationElapsed);
    expect(held(36).animationElapsed).not.toBe(jab35.animationElapsed);
    expect(held(73).alpha).toBe(255);
    expect(held(74).alpha).toBe(140);
    expect(client.errors).toEqual([]);
  } finally {
    captured.restore();
  }
});

function checkMovementRolls(file: string): void {
  const clients = runtime.clients({ install, start }, [0]);
  const client = clients.client(0);
  const command = (text: string) => clients.everywhere(() => nativeDriverCommand(text));
  const fighter = () => fighterAt(shell().world, 0);
  clients.start();
  clients.frames(3);
  command(readFileSync(new URL(`./native/pads/171/${file}`, import.meta.url), "utf8"));
  command("resume 212");
  clients.frames(215);
  expect(value(client, () => fighter().dodge.groundDirection)).toBe(-1);
  expect(value(client, () => fighter().shield.raised)).toBe(false);
  command("resume 256");
  clients.frames(45);
  expect(value(client, () => fighter().dodge.groundDirection)).toBe(1);
  expect(value(client, () => fighter().dodge.groundFrame)).toBe(6);
  expect(value(client, () => fighter().shield.raised)).toBe(false);
  expect(value(client, () => shell().runtime.poses[0].clipIndex)).toBe(value(client, () => clipFor(fighter().character, "rollForward").index));
  const before = value(client, () => fighter().motion.x);
  const clipTime = value(client, () => shell().runtime.poses[0].clipTime);
  command("resume 262");
  clients.frames(7);
  expect(value(client, () => fighter().dodge.groundFrame)).toBe(12);
  expect(value(client, () => fighter().motion.x)).toBeGreaterThan(before);
  expect(value(client, () => shell().runtime.poses[0].clipTime)).toBeGreaterThan(clipTime);
  expect(client.errors).toEqual([]);
}

test("movement capture script completes its backward roll before starting its forward roll [repro #171]", () => {
  checkMovementRolls("rifleman.pad");
});

sweep("every movement capture script plays and advances the forward roll after its backward roll [repro #171]", () => {
  for (const file of readdirSync(new URL("./native/pads/171/", import.meta.url)).filter(file => file.endsWith(".pad"))) checkMovementRolls(file);
});

test("Defile's ground effect stays upright and starts the boundary's visible Stand pose [repro #174]", () => {
  const clients = runtime.clients({ install, start }, [0]);
  clients.start();
  clients.frames(3);
  clients.everywhere(() => nativeDriverCommand("#! chat -dev quick hero lich king\n40 a stick 0 -1\n40 a tap X 2\n41 a stick 0 0\n"));
  clients.everywhere(() => nativeDriverCommand("resume 60"));
  clients.frames(65);
  const effects = clients.client(0).effectPoses({ visibleOnly: true });
  const pool = effects.find(pose => pose.model.includes("DarkPortalTarget"));
  const boundary = effects.find(pose => pose.model.includes("ImpactDefile"));
  expect(pool).toBeDefined();
  expect(pool?.pitch).toBe(0);
  expect(boundary).toBeDefined();
  expect(boundary?.animation).toBe("stand");
  expect(boundary?.animationElapsed).toBe(0);
  expect(boundary?.timeScale).toBe(0);
  expect(clients.client(0).errors).toEqual([]);
});

// Real shell callback, capture and replay; command delivery itself belongs to Wisp.
test("native driver sets up pad rows, holds the whole callback, and stepped and free runs replay equally [invariant]", () => {
  const clients = runtime.clients({ install, start }, [0, 1]);
  const command = (text: string) => clients.everywhere(() => nativeDriverCommand(text));
  clients.start();
  clients.frames(3);
  const script = "#! chat -dev quick hero rifleman\n1 a stick 0.6 0\n10 a tap A 2\n20 a press VIEW\n20 a stick 0 0\n40 b tap B 8\n70 a cstick 0 1\n75 a cstick 0 0\n90 a release VIEW\n120 a capture\n";
  command(script);
  clients.frames(20);
  for (const client of clients.clients) expect(value(client, () => shell().runtime.simulationFrame)).toBe(0);
  command("step 10");
  clients.frames(25);
  for (const client of clients.clients) expect(value(client, () => shell().runtime.simulationFrame)).toBe(10);
  command("step 110");
  clients.frames(140);
  const stepped = clients.clients.map(client => value(client, () => confirmedChecksum(shell())));
  for (const client of clients.clients) {
    expect(value(client, () => shell().runtime.simulationFrame)).toBe(120);
    const filename = [...client.files.keys()].find(name => name.startsWith("smashcraft-repro-") && name.includes("-f120-"));
    expect(filename).toBeDefined();
    const repro = parseRepro(client.files.get(filename ?? "") ?? []);
    if (typeof repro === "string") throw new Error(repro);
    const replay = replayRepro(repro);
    expect(replay.problems).toEqual([]);
    expect(replay.checksum).toBe(repro.checksum);
  }
  command(script);
  command("resume 120");
  clients.frames(150);
  for (const [index, client] of clients.clients.entries()) {
    expect(value(client, () => shell().runtime.simulationFrame)).toBe(120);
    expect(value(client, () => confirmedChecksum(shell()))).toBe(stepped[index]);
    expect(client.errors).toEqual([]);
  }
  expect([...clients.client(0).files.keys()].some(name => name.startsWith("smashcraft-repro-") && name.includes("-f80-"))).toBe(true);
  expect(stepped[0]).toBe(stepped[1]);
  command("capture");
  clients.frames(5);
  for (const client of clients.clients) expect(value(client, () => shell().runtime.simulationFrame)).toBe(120);
  command("reset");
  clients.frames(5);
  for (const client of clients.clients) expect(value(client, () => shell().runtime.simulationFrame)).toBe(0);
  command("#! chat -dev quick\n1 a tap START 1\n");
  command("step 1");
  clients.frames(5);
  for (const client of clients.clients) expect(value(client, () => shell().session.paused)).toBe(true);
  command("resume 2");
  clients.frames(5);
  for (const client of clients.clients) expect(value(client, () => shell().runtime.simulationFrame)).toBe(2);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("native driver retains the complete 460-frame pad trace and its normal expectations [provisional]", () => {
  const clients = runtime.clients({ install, start }, [0, 1]);
  clients.start();
  clients.frames(3);
  const script = readFileSync(new URL("./native/pads/rifleman-neutral.pad", import.meta.url), "utf8");
  clients.everywhere(() => nativeDriverCommand(script));
  clients.everywhere(() => nativeDriverCommand("resume 460"));
  clients.frames(490);
  clients.everywhere(() => nativeDriverCommand("capture"));
  for (const client of clients.clients) {
    const lines = client.files.get(TRACE_FILE) ?? [];
    expect(lines).toContain("dropped 0");
    expect(unmetExpectations(parseTrace(lines), parseExpectations(script), "native-driver")).toEqual([]);
    expect(value(client, () => shell().runtime.simulationFrame)).toBe(460);
    expect(client.errors).toEqual([]);
  }
  expect(clients.firstDivergence()).toBeUndefined();
});
