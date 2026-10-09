import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { Phase } from "../src/game/match/rules";
import { Character } from "../src/game/sim/codes";
import { fighterPortrait } from "../src/game/sim/heroes/registry";
import { fighterModel } from "../src/game/render/combatEffects";
import { FighterHud } from "../src/game/ui/matchHud";
import { ClassicPresentation } from "../src/game/render/classicPresentation";
import { MatchPresentation } from "../src/game/render/matchPresentation";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("Forsaken selection, HUD, stock, ending and victory use the Forsaken model and cutouts [repro #327]", () => {
  const clients = headless.clients({ install, start: () => startBuild(PLAYABLE_BUILD) }, [0]);
  const client = clients.client(0), textures: string[] = [], models: string[] = [];
  const setTexture = client.natives.BlzFrameSetTexture;
  client.natives.BlzFrameSetTexture = (frame, path, flag, blend) => {
    textures.push(path as string);
    return setTexture(frame, path, flag, blend);
  };
  const addEffect = client.natives.AddSpecialEffect;
  client.natives.AddSpecialEffect = (path, x, y) => {
    models.push(path as string);
    return addEffect(path, x, y);
  };
  clients.start();
  clients.frames(2);
  client.run(() => {
    const game = shell().game;
    game.computerMask = 14;
    for (const slot of PARTICIPANT_SLOTS) {
      game.characterChoices[slot] = Character.forsakenPaladin;
      game.characterReadiness[slot] = true;
    }
  });
  clients.frames(2);
  client.run(() => {
    const game = shell().game, origin = { x: 0, y: 0, z: 0 };
    for (const slot of PARTICIPANT_SLOTS) {
      const hud = new FighterHud(slot, 4);
      hud.update(true, Character.forsakenPaladin, 0, 3);
      const ending = new ClassicPresentation(origin);
      game.phase = Phase.result;
      game.run.active = true;
      game.run.cleared = true;
      game.run.fighter = Character.forsakenPaladin;
      game.run.player = slot;
      ending.updateCard(game);
    }
    const victory = new MatchPresentation(origin);
    victory.beginResults({ winner: Character.forsakenPaladin, winnerSlot: 0, rows: [], x: 0, z: 0 }, 0);
    expect(victory.tick()).toBe(true);
  });
  expect(fighterModel(Character.forsakenPaladin)).toContain("ForsakenPaladin");
  expect(models).toContain(fighterModel(Character.forsakenPaladin));
  expect(textures).toContain(fighterPortrait(Character.forsakenPaladin, "Tile"));
  for (const slot of PARTICIPANT_SLOTS) for (const kind of ["Card", "Bust", "Stock"] as const) {
    const expected = fighterPortrait(Character.forsakenPaladin, kind, slot);
    expect(expected).toContain("ForsakenPaladin");
    expect(textures).toContain(expected);
  }
  expect(textures.some(path => path.includes("BTNHeroPaladin"))).toBe(false);
  expect(client.errors).toEqual([]);
});
