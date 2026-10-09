import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { createStandaloneSession, NEUTRAL_INPUT } from "../scripts/wisp/standalone";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { nativeDriverCommand } from "../src/platform/nativeDriver";
import { install, start } from "../src/platform/nativeDriverMain";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { shell } from "../src/platform/shell/state";
import { Character } from "../src/game/sim/codes";
import { value } from "./rematch/playableMatch";
import { sweep } from "./sweep";

async function fourFighterMatch(frames: number): Promise<void> {
  const session = await createStandaloneSession({ fourFighters: true });
  try {
    const { client } = session;
    expect(value(client, () => shell().game.stockCount)).toBe(99);
    expect(value(client, () => shell().game.computerMask)).toBe(14);
    expect(value(client, () => shell().game.characterChoices.slice(0, 4))).toEqual([Character.demonHunter, Character.rifleman, Character.demonHunter, Character.warden]);
    const x = value(client, () => shell().world.fighters[0]?.motion.x);
    for (let frame = 0; frame < frames; frame++) {
      session.step(NEUTRAL_INPUT);

      if (frame === 112) expect(value(client, () => shell().world.fighters[0]?.motion.x)).toBeGreaterThan(x ?? Infinity);
    }
    expect(value(client, () => shell().world.fighters.filter(fighter => fighter !== undefined && fighter.status.stocks > 0).length)).toBe(4);
    expect(session.finished()).toBe(false);
    expect(client.errors).toEqual([]);
  } finally { session.close(); }
}

test("standalone four-fighter match starts a human and three computers on stage [repro #242]", () => fourFighterMatch(1));

sweep("standalone four-fighter match moves the human on its first dash and keeps all four fighters playing for 600 frames [repro #242]", () => fourFighterMatch(600));


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

sweep("standalone CPU fixture matches the native pad driver at all 1070 frames [invariant]", () => matchesNativeDriver(1070), 120000);
