import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { fighterAt } from "../src/game/sim/roster";
import { SpecialSlot } from "../src/game/sim/heroSpecials";
import { startFighterSpecial } from "../src/game/sim/specials";
import { controls } from "../src/game/sim/testWorld";
import { firstFighterDifference } from "../src/game/replay/difference";
import { ROSTER_MANA } from "../src/game/sim/mana";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test.each(SELECTABLE_CHARACTERS)("real Wisp map fires fighter %i's four EX specials with matching two-client state and no errors [k1 scenario]", character => {
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
        expect(owner.mana.points).toBe(ROSTER_MANA.max - ROSTER_MANA.exCost);
        duration = owner.special.duration;
        observed = owner;
      });
      return observed;
    });
    clients.frames(duration + 2);
    for (const client of clients.clients) expect(client.errors, `${fighterName(character)}:${slot}`).toEqual([]);
    const [first, second] = fighters;
    if (first === undefined || second === undefined) throw new Error("missing EX fighter");
    expect(firstFighterDifference(first, second, 3, 3), `${fighterName(character)}:${slot}`).toBeUndefined();
    expect(clients.firstDivergence(), `${fighterName(character)}:${slot}`).toBeUndefined();
    casts++;
  }
  expect(casts).toBe(4);
  console.log(`EX real map: ${fighterName(character)}, ${casts} casts, 0 errors or divergent states`);
});
