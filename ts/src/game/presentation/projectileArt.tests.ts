import { mutableProjectile } from "../sim/fighterProjectiles";


import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ProjectileKind } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { ORIGINAL_PROJECTILE_MODELS, fighterProjectileModels, heroProjectileArt, projectileModelOf } from "./projectileArt";






const SAME_SPELL: readonly (readonly string[])[] = [];

test("every projectile-firing move names its own stock missile [spec #144]", () => {
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

test("a live projectile draws its move's missile, wherever it flies [spec #144]", () => {
  for (const hero of HERO_ROSTER) {
    if (hero.specials === undefined) continue;

    const holder = createFighter(Character.rifleman, 0.0, 1);
    const projectile = mutableProjectile(holder, 0);
    if (projectile === undefined) continue;
    for (const { spec } of heroProjectileArt(hero.specials)) {
      projectile.kind = ProjectileKind.hero;
      projectile.spec = spec;
      assertEquals(projectileModelOf(projectile), spec.model);
      assertTrue(spec.model !== undefined && fighterProjectileModels(hero.character).includes(spec.model));
    }
  }
  const rifleman = createFighter(Character.rifleman, 0.0, 1);
  const shot = mutableProjectile(rifleman, 0);
  if (shot === undefined) return;
  shot.kind = ProjectileKind.blaster;
  assertEquals(projectileModelOf(shot), ORIGINAL_PROJECTILE_MODELS[ProjectileKind.blaster]);
  assertEquals(fighterProjectileModels(Character.rifleman)[0], ORIGINAL_PROJECTILE_MODELS[ProjectileKind.blaster]);
});
