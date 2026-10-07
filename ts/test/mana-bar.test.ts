import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { Frame } from "wisp/src/headless/frames";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { beginFighterAttack, resolveAttacks } from "../src/game/sim/attacks";
import { AttackStyle } from "../src/game/sim/codes";
import { resolveGrabs } from "../src/game/sim/grabs";
import { attackStartupFrames } from "../src/game/sim/moves";
import { fighterAt } from "../src/game/sim/roster";
import { MANA_BAR_SEGMENTS, MANA_DRAIN_UPDATES, OVERHEAD_MANA_WIDTH, advanceManaFeedback, manaDrainLit, manaFeedback } from "../src/game/presentation/manaBar";
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

/** Top and bottom of a frame placed by its centre. */
function span(frame: Frame): { readonly top: number; readonly bottom: number; readonly centerX: number } {
  const center = [...frame.points.values()][0]!;
  return { top: center.y + frame.height / 2, bottom: center.y - frame.height / 2, centerX: center.x };
}

function forBoth(clients: Clients, change: (slot: number) => void): void {
  for (const client of clients.clients) client.run(() => change(0));
}

test("every fighter's mana shows as a segmented bar over its head and on its plate, filled to its mana", () => {
  const clients = quickMatch();
  forBoth(clients, () => {
    fighterAt(shell().world, 0).mana.points = 40;
    fighterAt(shell().world, 1).mana.points = 100;
  });
  clients.frames(1);
  for (const client of clients.clients) {
    for (const [slot, points] of [[0, 40], [1, 100]] as const) {
      const back = overhead(client, "Back", slot, 0);
      const fill = overhead(client, "Fill", slot, 1);
      expect(back && fill).toBeTruthy();
      expect(client.frames.shown(back!)).toBe(true);
      expect(fill!.width).toBeCloseTo((OVERHEAD_MANA_WIDTH * points) / 100, 4);
      // Nine lines split the bar into ten segments of 10 mana.
      expect(overhead(client, "Line", slot, 2 + MANA_BAR_SEGMENTS - 1)).toBeTruthy();
      const plate = hud(client, "Fill", slot, 1);
      expect(client.frames.shown(plate!)).toBe(true);
      expect(plate!.width).toBeCloseTo((plateManaSlot(slot, 2).width * points) / 100, 4);
    }
    expect(client.errors).toEqual([]);
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

test("both mana bars show a visible EX cue only for affordable neutral and side specials", () => {
  const clients = quickMatch();
  for (const [points, text] of [[27, ""], [28, "EX N"], [37, "EX N + S"]] as const) {
    forBoth(clients, () => { fighterAt(shell().world, 0).mana.points = points; });
    clients.frames(1);
    for (const client of clients.clients) for (const label of [
      overhead(client, "Ex", 0, 4 + MANA_BAR_SEGMENTS),
      hud(client, "Ex", 0, 4 + MANA_BAR_SEGMENTS),
    ]) {
      expect(label).toBeDefined();
      expect(client.frames.shown(label!)).toBe(text !== "");
      expect(label!.text).toBe(`|cffffdd55${text}|r`);
      if (text !== "") {
        expect(label!.width).toBeGreaterThan(0);
        expect(label!.height).toBeGreaterThan(0);
      }
    }
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

test("a refused special flashes both of the fighter's bars; a paid hit makes them glow", () => {
  const clients = quickMatch();
  forBoth(clients, () => { fighterAt(shell().world, 0).visuals.manaDenied++; });
  clients.frames(1);
  for (const client of clients.clients) {
    expect(client.frames.shown(overhead(client, "Flash", 0, 2 + MANA_BAR_SEGMENTS)!)).toBe(true);
    expect(client.frames.shown(hud(client, "Flash", 0, 2 + MANA_BAR_SEGMENTS)!)).toBe(true);
    expect(client.frames.shown(overhead(client, "Flash", 1, 2 + MANA_BAR_SEGMENTS)!)).toBe(false);
  }
  clients.frames(60);
  for (const client of clients.clients) expect(client.frames.shown(overhead(client, "Flash", 0, 2 + MANA_BAR_SEGMENTS)!)).toBe(false);
  forBoth(clients, () => { fighterAt(shell().world, 1).mana.points = 50; });
  clients.frames(1);
  forBoth(clients, () => { fighterAt(shell().world, 1).mana.points = 60; });
  clients.frames(1);
  for (const client of clients.clients) {
    expect(client.frames.shown(overhead(client, "Glow", 1, 2)!)).toBe(true);
    expect(client.frames.shown(overhead(client, "Glow", 0, 2)!)).toBe(false);
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

test("a held fighter's mana bar stacks just above its escape meter, never over it", () => {
  const clients = quickMatch();
  for (const client of clients.clients) {
    client.run(() => {
      const { world } = shell();
      const owner = fighterAt(world, 0);
      const target = fighterAt(world, 1);
      owner.facing = 1;
      target.facing = -1;
      target.motion.x = owner.motion.x + 50.0;
      beginFighterAttack(world, 0, AttackStyle.grab, false);
      owner.attack.frame = attackStartupFrames(AttackStyle.grab, owner.tuning.moves);
      resolveAttacks(world);
      resolveGrabs(world);
      expect(target.grab.owner).toBe(0);
    });
  }
  clients.frames(2);
  for (const client of clients.clients) {
    const escape = client.frames.named("EscapeMeterBack1", 1120)!;
    const mana = overhead(client, "Back", 1, 0)!;
    expect(client.frames.shown(escape)).toBe(true);
    expect(client.frames.shown(mana)).toBe(true);
    const below = span(escape);
    const above = span(mana);
    expect(above.bottom).toBeGreaterThan(below.top);
    expect(above.bottom - below.top).toBeLessThan(0.01);
    expect(above.centerX).toBeCloseTo(below.centerX, 4);
  }
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("an opponent's draining hit burns the bar purple for a moment", () => {
  const feedback = manaFeedback();
  advanceManaFeedback(feedback, 50, 0, 0);
  expect(manaDrainLit(feedback)).toBe(false);
  advanceManaFeedback(feedback, 44, 0, 1);
  expect(manaDrainLit(feedback)).toBe(true);
  for (let update = 1; update < MANA_DRAIN_UPDATES; update++) advanceManaFeedback(feedback, 44, 0, 1);
  expect(manaDrainLit(feedback)).toBe(true);
  advanceManaFeedback(feedback, 44, 0, 1);
  expect(manaDrainLit(feedback)).toBe(false);
});
