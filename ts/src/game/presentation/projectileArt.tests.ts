import { mutableProjectile } from "../sim/fighterProjectiles";


import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ProjectileKind } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { ORIGINAL_PROJECTILE_MODELS, fighterProjectileModels, heroProjectileArt, projectileModelOf } from "./projectileArt";






const SAME_SPELL: readonly (readonly string[])[] = [];

test("every projectile-firing move names its own stock missile [k3 measure #144]", () => {
  const owner = new Map<string, string>();
  for (const kind of [ProjectileKind.blaster, ProjectileKind.recoil, ProjectileKind.manaBurn] as const) {
    const model = ORIGINAL_PROJECTILE_MODELS[kind];
    assertEquals(owner.get(model), undefined, `kind ${kind} shares ${model}`);
    owner.set(model, `kind ${kind}`);
  }
  let named = 0;
  for (const hero of HERO_ROSTER) {
    if (hero.specials === undefined) continue;
    for (const { slot, spec } of heroProjectileArt(hero.specials)) {
      const move = `${hero.name} ${slot}`;
      assertEquals(spec.model !== undefined, true, `${move} fires a projectile without a model`);
      if (spec.model === undefined) continue;
      const first = owner.get(spec.model);
      const same = first === undefined || first === move || SAME_SPELL.some((group) => group.includes(move) && group.includes(first));
      assertEquals(same, true, `${move} shares ${spec.model} with ${first ?? ""}`);
      owner.set(spec.model, move);
      named++;
    }
  }
  assertTrue(named > 0);
});
