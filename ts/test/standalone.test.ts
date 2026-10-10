import { readFileSync } from "node:fs";
import { expect } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { createStandaloneSession, NEUTRAL_INPUT } from "../scripts/wisp/standalone";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { nativeDriverCommand } from "../src/platform/nativeDriver";
import { install, start } from "../src/platform/nativeDriverMain";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { shell } from "../src/platform/shell/state";
import { value } from "./rematch/playableMatch";
import { sweep } from "./sweep";


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
