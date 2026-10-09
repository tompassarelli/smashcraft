import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { PlacedObjectEffects } from "../src/game/render/placedObjectEffects";
import { Character } from "../src/game/sim/codes";
import { createFighter, placedObject } from "../src/game/sim/fighter";
import { BEAR_PLACEMENT, QUILBEAST_PLACEMENT, HAWK_PLACEMENT } from "../src/game/sim/heroes/beastmasterSpecials";
import { CompanionMode } from "../src/game/sim/heroSpecials";
import { BEAR_IMPACT_MODEL, BEAR_ROAR_MODEL } from "../src/game/presentation/bearFeedback";

const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: {} });
afterAll(headless.restore);

test("Bear command draws a large rear-up, one roar and a bite-only impact [spec #336]", () => {
  const clients = headless.clients({ install() {}, start() {} });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing client");
  client.run(() => {
    const effects = new PlacedObjectEffects({ x: 0.0, y: 0.0, z: 0.0 });
    const fighter = createFighter(Character.beastmaster, 0.0, 1);
    const bear = fighter.placed;
    bear.spec = BEAR_PLACEMENT;
    bear.life = 600;
    bear.durability = 30.0;
    effects.presentConfirmed(0, fighter, 0);
    effects.present(fighter, 0);
    const body = () => client.effectPoses().find(pose => pose.model.includes("GrizzlyBear"));
    const followingScale = body()?.scale ?? 0.0;
    bear.mode = CompanionMode.lunge;
    bear.age = 100;
    bear.modeFrame = 1;
    effects.presentConfirmed(100, fighter, 0);
    effects.presentConfirmed(100, fighter, 0);
    effects.present(fighter, 0);
    expect(body()?.pitch).toBeLessThan(-0.8);
    expect(body()?.scale).toBeGreaterThan(followingScale * 1.2);
    expect(client.effectPoses().some(pose => pose.model === BEAR_ROAR_MODEL && pose.scale > 0 && pose.z > 0)).toBe(true);
    bear.modeFrame = 11;
    bear.age = 110;
    bear.bitten = 2;
    effects.presentConfirmed(110, fighter, 0);
    effects.present(fighter, 0);
    expect(client.effectPoses().some(pose => pose.model === BEAR_IMPACT_MODEL && pose.scale > 0 && pose.z > 0)).toBe(true);
    bear.modeFrame = 15;
    bear.age = 114;
    effects.presentConfirmed(114, fighter, 0);
    effects.present(fighter, 0);
    const labels = client.log.filter(call => call.name === "SetTextTagText").map(call => call.args[1]);
    expect(labels).toEqual([]);
    const sounds = client.log.filter(call => call.name === "CreateSoundFromLabel").map(call => call.args[0]);
    expect(sounds).toEqual(["BattleRoar", "MetalHeavySliceFlesh"]);
    bear.life = 0;
    effects.present(fighter, 0);
    expect(body()?.scale).toBe(0);
    effects.destroy();
  });
});

test("predicted Beastmaster summons create no effects before their confirmed frame [repro #69] [invariant]", () => {
  const clients = headless.clients({ install() {}, start() {} });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing client");
  client.run(() => {
    const effects = new PlacedObjectEffects({ x: 0.0, y: 0.0, z: 0.0 });
    const fighter = createFighter(Character.beastmaster, 0.0, 1);
    effects.presentConfirmed(0, fighter, 0);
    effects.present(fighter, 0);
    for (const [animal, spec] of [[1, QUILBEAST_PLACEMENT], [2, HAWK_PLACEMENT]] as const) {
      const placed = placedObject(fighter, animal);
      placed.spec = spec;
      placed.life = 600;
      placed.durability = spec.durability;
    }
    const count = () => client.log.filter(call => call.name === "AddSpecialEffect" || call.name === "DestroyEffect").length;
    const before = count();
    effects.present(fighter, 0);
    expect(count()).toBe(before);
    effects.presentConfirmed(1, fighter, 0);
    const confirmed = count();
    expect(confirmed).toBeGreaterThan(before);
    effects.present(fighter, 0);
    expect(count()).toBe(confirmed);
    for (const name of ["QuillBeast", "WarEagle"]) expect(client.effectPoses().some(pose => pose.model.includes(name) && pose.scale > 0)).toBe(true);
    effects.destroy();
  });
});
