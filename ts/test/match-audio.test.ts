import { afterAll, expect } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { Phase } from "../src/game/match/rules";
import { stageMusic } from "../src/game/presentation/matchAudio";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { sweep } from "./sweep";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

const HELLFIRE = 14;
const PROMO = `-dev quick promo stage ${HELLFIRE} pair Illidan / Pit Lord`;
const PLAY_FRAMES = 3 * 60 * 60;
const MUSIC = "Sound\\Music\\";
const FANFARE = "Sound\\Interface\\GameFound.flac";

sweep("3 minutes of Hellfire play: its theme loops from each match start to the results, and no music or fanfare plays mid-match [spec #361]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(1);
  const phase = (): Phase => {
    let current: Phase = Phase.characterMenu;
    clients.clients[0]!.run(() => { current = shell().game.phase; });
    return current;
  };
  let played = 0;
  let matches = 0;
  while (played < PLAY_FRAMES || matches < 2) {
    if (matches > 0) {
      clients.chat(0, "-dev reset");
      clients.frames(2);
    }
    clients.chat(0, PROMO);
    clients.frames(2);
    expect(phase()).toBe(Phase.match);
    matches++;
    while (phase() === Phase.match) {
      clients.frames(60);
      played += 60;
    }
    clients.frames(120);
  }
  const theme = stageMusic(HELLFIRE);
  for (const client of clients.clients) {
    const log = client.soundLog.filter(row => row.event !== "create");
    let inMatch = false;
    let starts = 0;
    for (const row of log) {
      const source = row.source ?? row.label ?? "";
      if (row.kind === "music" && row.event === "start" && source === theme) {
        expect(row.looping).toBe(true);
        inMatch = true;
        starts++;
        continue;
      }
      if (!inMatch) continue;
      if (row.kind === "music") {

        if (row.event === "start") {
          expect(source).toMatch(/Victory\.flac$/);
          expect(row.looping).toBe(false);
          inMatch = false;
        } else expect(row.event).toBe("stop");
        continue;
      }
      if (row.event !== "start") continue;
      expect(source).not.toBe(FANFARE);
      expect(source.startsWith(MUSIC)).toBe(false);
    }
    expect(starts).toBe(matches);
  }
});
