import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { fighterAt } from "../src/game/sim/roster";
import { renderPersistentPresentation } from "../src/platform/shell/view";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);
const markerModel = "Abilities\\Spells\\Other\\GeneralAuraTarget\\GeneralAuraTarget.mdl";

test("both clients show both locked markers on each fighter and remove them on control return", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(1);
  clients.chat(0, "-dev quick");
  for (const character of ["archer", "rifleman", "illidan"]) {
    for (const mode of ["none", "di", "act"]) {
      const before = clients.clients.map(client => client.log.length);
      clients.chat(0, `-dev agency ${character} ${mode}`);
      clients.frames(1);
      for (const [index, client] of clients.clients.entries()) {
        expect(client.files.get(`smashcraft-agency-p${client.slot}.txt`)?.[0]).toContain(`p0=${mode},`);
        const shown = client.effectPoses().filter(pose => pose.model === markerModel && pose.scale > 0);
        expect(shown.length).toBe(mode === "act" ? 0 : 2);
        if (mode !== "act") {
          const calls = client.log.slice(before[index]).filter(call => call.name === "BlzSetSpecialEffectColor");
          expect(calls.some(call => call.args.slice(1).join(",") === (mode === "none" ? "255,100,40" : "0,255,0"))).toBe(true);
          for (const halo of shown) {
            // A paused sample must hold a drawable Stand interval, facing the
            // side camera above the floor rather than showing the aura edge-on.
            expect(halo.timeScale).toBe(0);
            const nativeCalls = client.log.filter(call => call.args[0] === halo.handle);
            expect(nativeCalls.some(call => call.name === "BlzSetSpecialEffectAnimation" && call.args[1] === "Stand")).toBe(true);
            expect(nativeCalls.some(call => call.name === "BlzSetSpecialEffectTime" && call.args[1] === 0.5)).toBe(true);
            expect(nativeCalls.some(call => call.name === "BlzSetSpecialEffectRoll" && call.args[1] === Math.fround(Math.PI / 2))).toBe(true);
            client.run(() => {
              const s = shell();
              expect(halo.y).toBe(s.origin.y + 40);
              expect(halo.z).toBeGreaterThan(s.origin.z + 70);
            });
          }
        }
      }
    }
    clients.chat(0, `-dev agency ${character} thaw`);
    expect(clients.clients[0]?.effectPoses().filter(pose => pose.model === markerModel && pose.scale > 0).length).toBe(2);
    clients.frames(190);
    for (const client of clients.clients) {
      expect(client.effectPoses().filter(pose => pose.model === markerModel && pose.scale > 0)).toEqual([]);
      client.run(() => {
        const s = shell();
        // Presenting a forecast must leave all observed simulation state intact.
        const victim = fighterAt(s.world, 1);
        const before = JSON.stringify(victim);
        renderPersistentPresentation(s);
        expect(JSON.stringify(victim)).toBe(before);
      });
      expect(client.errors).toEqual([]);
    }
  }
  expect(clients.firstDivergence()).toBeUndefined();
});
