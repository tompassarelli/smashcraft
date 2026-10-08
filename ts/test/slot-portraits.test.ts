import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { Character } from "../src/game/sim/codes";
import { fighterPortrait } from "../src/game/sim/heroes/registry";
import { FighterHud } from "../src/game/ui/matchHud";
import { OffscreenBubble } from "../src/game/ui/offscreenBubble";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("picked cards, HUD busts, stock icons and off-screen portraits send the fighter slot's outfit to Warcraft [spec #161]", () => {
  const clients = headless.clients({ install, start: () => startBuild(PLAYABLE_BUILD) });
  const textures = new Map<number, string[]>();
  for (const client of clients.clients) {
    const paths: string[] = [];
    textures.set(client.slot, paths);
    const setTexture = client.natives.BlzFrameSetTexture as (frame: unknown, path: string, flag: number, blend: boolean) => void;
    client.natives.BlzFrameSetTexture = (frame: unknown, path: string, flag: number, blend: boolean) => {
      paths.push(path);
      setTexture(frame, path, flag, blend);
    };
  }
  clients.start();
  clients.frames(2);
  clients.everywhere(() => {
    const game = shell().game;
    game.computerMask = 12;
    for (const slot of PARTICIPANT_SLOTS) {
      game.characterChoices[slot] = Character.rifleman;
      game.characterReadiness[slot] = true;
    }
  });
  clients.frames(2);
  clients.everywhere(() => {
    for (const slot of PARTICIPANT_SLOTS) {
      const hud = new FighterHud(slot, 4);
      hud.update(true, Character.rifleman, 0, 3);
      const bubble = new OffscreenBubble(slot);
      bubble.update(true, Character.rifleman, 2, 0, 1);
    }
  });
  for (const client of clients.clients) {
    const paths = textures.get(client.slot) ?? [];
    expect(paths).toContain(fighterPortrait(Character.rifleman, "Tile"));
    for (const slot of PARTICIPANT_SLOTS) {
      for (const kind of ["Card", "Bust", "Stock", "Tile"] as const) {
        expect(paths).toContain(fighterPortrait(Character.rifleman, kind, slot));
      }
    }
    expect(client.errors).toEqual([]);
  }
});
