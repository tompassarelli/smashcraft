import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { fighterAt } from "../src/game/sim/roster";
import { createFighter } from "../src/game/sim/fighter";
import { SpecialSlot, specialKit, type AuthoredSpecial } from "../src/game/sim/heroSpecials";
import { startFighterSpecial } from "../src/game/sim/specials";
import { controls } from "../src/game/sim/testWorld";
import { firstFighterDifference } from "../src/game/replay/difference";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

function expectAuthoredEx(move: AuthoredSpecial, label: string): void {
  expect(move.ex, label).toBeDefined();
  expect(move.ex, label).not.toBe(move);
  expect(move.ex?.endFrame, label).toBe(move.endFrame);
  expect(move.ex?.landingLag, label).toBe(move.landingLag);
  expect(move.ex?.helpless, label).toBe(move.helpless);
  expect(move.ex?.oncePerAirtime, label).toBe(move.oncePerAirtime);
}

test("every selectable fighter has four authored EX specials including air recall and marked forms [spec #329]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
      const owner = createFighter(character, 0.0, 1);
      const specials = owner.tuning.specials;
      if (specials === undefined) continue;
      for (const slot of [SpecialSlot.neutral, SpecialSlot.side, SpecialSlot.up, SpecialSlot.down]) {
        const kit = specialKit(specials, slot);
        const label = `${fighterName(character)}:${slot}`;
        expectAuthoredEx(kit.ground, label);
        if (kit.air !== undefined) expectAuthoredEx(kit.air, `${label}:air`);
        if (kit.recall !== undefined) expectAuthoredEx(kit.recall, `${label}:recall`);
        if (kit.marked !== undefined) expectAuthoredEx(kit.marked.special, `${label}:marked`);
      }
  }
});

test.each(SELECTABLE_CHARACTERS)("real Wisp map fires fighter %i's four EX specials with matching two-client state and no errors [spec #329] [invariant]", character => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(1);
  let casts = 0;
  for (const slot of [SpecialSlot.neutral, SpecialSlot.side, SpecialSlot.up, SpecialSlot.down]) {
    clients.chat(0, "-dev reset");
    clients.frames(1);
    clients.chat(0, `-dev quick hero ${fighterName(character)}`);
    clients.frames(5);
    let duration = 0;
    const fighters = clients.clients.map(client => {
      let observed: ReturnType<typeof fighterAt> | undefined;
      client.run(() => {
        const { world } = shell();
        const owner = fighterAt(world, 0);
        expect(owner.character).toBe(character);
        owner.mana.points = 100;
        expect(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, shield: true,
          specialX: slot === SpecialSlot.side ? 1 : 0,
          specialZ: slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0 }), world), `${fighterName(character)}:${slot}`).toBe(true);
        expect(owner.special.ex).toBe(true);
        expect(owner.mana.points).toBe(67);
        duration = owner.special.duration;
        observed = owner;
      });
      return observed;
    });
    clients.frames(duration + 2);
    for (const client of clients.clients) expect(client.errors, `${fighterName(character)}:${slot}`).toEqual([]);
    const [first, second] = fighters;
    if (first === undefined || second === undefined) throw new Error("missing EX fighter");
    expect(firstFighterDifference(first, second, 0, 0), `${fighterName(character)}:${slot}`).toBeUndefined();
    expect(clients.firstDivergence(), `${fighterName(character)}:${slot}`).toBeUndefined();
    casts++;
  }
  expect(casts).toBe(4);
  console.log(`EX real map: ${fighterName(character)}, ${casts} casts, 0 errors or divergent states`);
});
