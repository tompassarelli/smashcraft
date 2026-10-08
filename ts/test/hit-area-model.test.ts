import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { HitAreaEffects } from "../src/game/render/hitAreaEffects";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { install, start } from "../src/platform/main";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("Peon forward tilt draws a stock accent instead of an empty asset in both facings [repro #309]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  const client = clients.client(0);
  client.run(() => {
    const areas = new HitAreaEffects(Character.peon, { x: 0, y: 0, z: 0 });
    const fighter = createFighter(Character.peon, 0, 1);
    fighter.attack.style = AttackStyle.forwardTilt;
    fighter.attack.frame = 8;
    for (const facing of [-1, 1]) {
      fighter.facing = facing;
      areas.present(fighter, true);
      const drawn = client.effectPoses({ visibleOnly: true }).filter(pose => pose.scale > 0);
      expect(drawn.some(pose => pose.model === "Abilities\\Weapons\\GyroCopter\\GyroCopterMissile.mdx")).toBe(true);
      expect(drawn.filter(pose => pose.model === "")).toEqual([]);
    }
    areas.destroy();
  });
});
