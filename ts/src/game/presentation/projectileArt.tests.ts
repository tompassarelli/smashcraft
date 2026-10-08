import { mutableProjectile } from "../sim/fighterProjectiles";
// Each projectile-firing move draws its own stock missile, and a live
// projectile finds it from its authored record, a reflected one included.
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ProjectileKind } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { ORIGINAL_PROJECTILE_MODELS, fighterProjectileModels, heroProjectileArt, projectileModelOf } from "./projectileArt";

/**
 * Moves that are deliberately the same spell and so may share a missile, as
 * "Fighter slot" names; none yet. Projectiles of one move (Thunder Clap's two
 * waves, Death and Decay's two strikes) share theirs.
 */
const SAME_SPELL: readonly (readonly string[])[] = [];

test("every projectile-firing move names its own stock missile [spec #144]", () => {
  const owner = new Map<string, string>();
  for (const kind of [ProjectileKind.arrow, ProjectileKind.homingArrow, ProjectileKind.blaster, ProjectileKind.recoil, ProjectileKind.manaBurn] as const) {
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
    // A reflected projectile sits in another fighter's slots with its record unchanged.
    const holder = createFighter(Character.archer, 0.0, 1);
    const projectile = mutableProjectile(holder, 0);
    if (projectile === undefined) continue;
    for (const { spec } of heroProjectileArt(hero.specials)) {
      projectile.kind = ProjectileKind.hero;
      projectile.spec = spec;
      assertEquals(projectileModelOf(projectile), spec.model);
      assertTrue(spec.model !== undefined && fighterProjectileModels(hero.character).includes(spec.model));
    }
  }
  const archer = createFighter(Character.archer, 0.0, 1);
  const arrow = mutableProjectile(archer, 0);
  if (arrow === undefined) return;
  arrow.kind = ProjectileKind.homingArrow;
  assertEquals(projectileModelOf(arrow), ORIGINAL_PROJECTILE_MODELS[ProjectileKind.homingArrow]);
  assertEquals(fighterProjectileModels(Character.archer)[0], ORIGINAL_PROJECTILE_MODELS[ProjectileKind.arrow]);
});
