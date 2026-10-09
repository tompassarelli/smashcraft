import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { fighterAt } from "../src/game/sim/roster";
import { MANA_BAR_SEGMENTS } from "../src/game/presentation/manaBar";
import { views } from "../src/platform/shell/ui";
import { ROSTER_MANA, gainMana } from "../src/game/sim/mana";
import { MatchCue, cueSound } from "../src/game/presentation/matchAudio";
import { plateManaSlot } from "../src/game/ui/matchHud";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

type Clients = ReturnType<typeof headless.clients>;
type Client = Clients["clients"][number];

function quickMatch(): Clients {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(1);
  clients.chat(0, "-dev quick");
  clients.frames(5);
  return clients;
}

const overhead = (client: Client, part: string, slot: number, offset: number) => client.frames.named(`ManaBar${part}Overhead${slot}`, 1200 + slot * 20 + offset);
const hud = (client: Client, part: string, slot: number, offset: number) => client.frames.named(`ManaBar${part}Hud${slot}`, 1300 + slot * 20 + offset);

function forBoth(clients: Clients, change: (slot: number) => void): void {
  for (const client of clients.clients) client.run(() => change(0));
}

test("every fighter's HUD meter shows three segments filled to its current points [spec #335]", () => {
  const clients = quickMatch();
  forBoth(clients, () => {
    fighterAt(shell().world, 0).mana.points = 40;
    fighterAt(shell().world, 1).mana.points = ROSTER_MANA.max;
  });
  clients.frames(1);
  for (const client of clients.clients) {
    for (const [slot, points] of [[0, 40], [1, ROSTER_MANA.max]] as const) {
      const fill = hud(client, "Fill", slot, 1)!;
      expect(client.frames.shown(fill)).toBe(true);
      expect(fill.width).toBeCloseTo((plateManaSlot(slot, 2).width * points) / ROSTER_MANA.max, 4);
      expect(hud(client, "Line", slot, 2 + MANA_BAR_SEGMENTS - 1)).toBeTruthy();
    }
    expect(client.errors).toEqual([]);
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

test("full super meter glows on the HUD, flashes the fighter and sounds once with no EX label [spec #335]", () => {
  const clients = quickMatch();
  forBoth(clients, () => { fighterAt(shell().world, 0).mana.points = ROSTER_MANA.max - 2; });
  clients.frames(1);
  for (const client of clients.clients) client.run(() => {
    const state = shell();
    const presentation = views(state).match;
    presentation.observe(state.game, state.world);
    gainMana(fighterAt(state.world, 0), 2);
    expect(presentation.presentConfirmed(state.game, state.world)).toContain(MatchCue.meterReady);
    presentation.observe(state.game, state.world);
    expect(presentation.presentConfirmed(state.game, state.world)).not.toContain(MatchCue.meterReady);
  });
  clients.frames(1);
  for (const client of clients.clients) {
    expect(client.frames.shown(hud(client, "Glow", 0, 2)!)).toBe(true);
    expect(overhead(client, "Ex", 0, 4 + MANA_BAR_SEGMENTS)).toBeUndefined();
    expect(hud(client, "Ex", 0, 4 + MANA_BAR_SEGMENTS)).toBeUndefined();
    expect(client.log.some(call => call.name === "BlzSetSpecialEffectAlpha" && call.args[1] === 230)).toBe(true);
    expect(client.soundLog.filter(cue => cue.event === "start" && cue.source === cueSound(MatchCue.meterReady))).toHaveLength(1);
  }
  clients.frames(14);
  for (const client of clients.clients) expect(client.frames.shown(hud(client, "Glow", 0, 2)!)).toBe(true);
  expect(clients.firstDivergence()).toBeUndefined();
});

