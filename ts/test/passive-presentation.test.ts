import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { PassivePresentation } from "../src/game/render/passivePresentation";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster } from "../src/game/sim/roster";
import { passiveSpec } from "../src/game/sim/passives";
import { PASSIVE_MODELS, passiveLook } from "../src/game/presentation/passiveLook";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";

const runtime = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(runtime.restore);

test("ready and proc effects use stock Warcraft models [native]", () => {
  expect(Object.values(PASSIVE_MODELS).filter(model => MODEL_FACTS[model] === undefined)).toEqual([]);
});

test("counted passive ready and proc cues survive hidden time, reset and replay without duplicate bursts [spec #148]", () => {
  const clients = runtime.clients({ install() {}, start() {} }, [0]);
  const client = clients.client(0);
  client.run(() => {
    for (const character of [Character.blademaster, Character.mountainKing, Character.warden, Character.rifleman, Character.rifleman, Character.lich, Character.forsakenPaladin, Character.dreadlord, Character.shadowHunter, Character.pitLord, Character.beastmaster]) {
      const fighter = createFighter(character, 0.0, 1);
      const world = createRoster(1, [fighter]);
      const renderer = new PassivePresentation(character, { x: 0.0, y: 0.0, z: 0.0 });
      renderer.present(world, 0, true);
      const look = passiveLook(character);
      expect(look.ready).toBeDefined();
      expect(look.proc).toBeDefined();
      fighter.passive.stacks = passiveSpec(character).stacks;
      fighter.passive.window = 40;
      fighter.passive.used = false;
      renderer.present(world, 0, true);
      expect(client.effectPoses({ visibleOnly: true }).some(pose => pose.model === look.ready)).toBe(true);
      fighter.passive.stacks = 0;
      fighter.passive.window = 0;
      fighter.passive.used = true;
      const start = client.log.length;
      fighter.passive.serial = 1;
      renderer.present(world, 0, true);
      const restarts = () => client.log.slice(start).filter(call => call.name === "BlzSetSpecialEffectTime" && call.args[1] === 0.0);
      expect(restarts()).toHaveLength(1);
      expect(client.effectPoses({ visibleOnly: true }).some(pose => pose.model === look.proc)).toBe(true);
      for (let frame = 0; frame < 35; frame++) renderer.present(world, 0, true);
      expect(client.effectPoses({ visibleOnly: true })).toHaveLength(0);
      fighter.passive.serial = 0;
      renderer.present(world, 0, true);
      fighter.passive.serial = 1;
      renderer.present(world, 0, true);
      expect(restarts()).toHaveLength(1);
      fighter.passive.serial = 2;
      renderer.present(world, 0, true);
      expect(restarts()).toHaveLength(2);
      renderer.present(world, 0, false);
      expect(client.effectPoses({ visibleOnly: true })).toHaveLength(0);
      renderer.destroy();
    }
  });
});
