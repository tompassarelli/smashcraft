import { mutableProjectile } from "../sim/fighterProjectiles";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { createFighter } from "../sim/fighter";
import { AttackStyle, Character, ProjectileKind, SpecialAction } from "../sim/codes";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { attackDurationFramesForGrounding } from "../sim/moves";
import { heroProjectileArt } from "./projectileArt";
import { projectedProjectile } from "./projectilePose";
import { disjointNormals, fanKnifePose, hitAreaPose, specialAreaRegion, type FanKnifePose, type HitAreaPose } from "./disjointCues";
import { specialForm, specialKit } from "../sim/heroSpecials";

const pose: HitAreaPose = { visible: false, x: 0.0, z: 0.0, scale: 0.0 };

test("Fan of Knives sprays seven oriented knives to its authored endpoints in both facings [spec docs/design/warden-fan-of-knives.md]", () => {
  const knife: FanKnifePose = { ...pose, yaw: 0.0, pitch: 0.0, alpha: 0 };
  for (const facing of [-1, 1]) {
    const fighter = createFighter(Character.warden, 0.0, facing);
    fighter.special.action = SpecialAction.heroDown;
    for (let index = 0; index < 7; index++) {
      fighter.special.frame = 8;
      assertEquals(fanKnifePose(fighter, index, knife).visible, false);
      fighter.special.frame = 9;
      const start = fanKnifePose(fighter, index, knife).x;
      assertTrue(knife.visible);
      fighter.special.frame = 11;
      fanKnifePose(fighter, index, knife);
      const ray = fighter.tuning.specials?.down.ground.regions?.[index]?.hit.strike;
      assertTrue(ray !== undefined);
      if (ray === undefined) continue;
      assertEquals(knife.x, f32(ray.x2 * facing));
      assertEquals(knife.z, ray.z2);
      assertTrue(Math.abs(knife.x) >= Math.abs(start));
      assertEquals(knife.yaw, ray.x2 * facing < 0.0 ? f32(Math.PI) : 0.0);
      fighter.special.frame = 15;
      assertEquals(fanKnifePose(fighter, index, knife).visible, false);
    }
  }
});

test("every disjoint normal marks each active region centre every frame in both facings [spec docs/disjoint-legibility.md]", () => {
  let checked = 0;
  const scratch = emptyHitRegion();
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 417.0, 1);
    fighter.motion.z = 193.0;
    const styles = disjointNormals(fighter);
    for (const style of styles) for (const facing of [-1, 1]) {
      fighter.facing = facing;
      fighter.attack.style = style;
      const duration = attackDurationFramesForGrounding(style, true, fighter.tuning.moves);
      for (let frame = 0; frame < duration; frame++) {
        fighter.attack.frame = frame;
        for (let index = 0; index < authoredHitRegionCount(style, fighter.tuning.moves); index++) {
          const region = authoredHitRegion(scratch, character, style, frame, 0, index, fighter.tuning.moves);
          const actual = hitAreaPose(fighter, region, pose);
          assertEquals(actual.visible, region.effect.damage > 0.0);
          if (!actual.visible) continue;
          assertEquals(actual.x, f32(417.0 + f32(facing * f32(f32(region.minX + region.maxX) * 0.5))));
          assertEquals(actual.z, f32(193.0 + f32(f32(region.minZ + region.maxZ) * 0.5)));
          assertTrue(actual.scale > 0.0);
          checked++;
        }
      }
    }
  }
  assertTrue(checked > 1000);
  const lich = createFighter(Character.lich, 0.0, 1);
  assertTrue(disjointNormals(lich).includes(AttackStyle.forwardSmash));
  assertTrue(disjointNormals(lich).includes(AttackStyle.downSmash));
});

test("every authored special form marks each live strike centre on the collision frame [spec docs/disjoint-legibility.md]", () => {
  let checked = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, -321.0, -1);
    const specials = fighter.tuning.specials;
    if (specials === undefined) continue;
    for (let slot = 0; slot < 4; slot++) for (let form = 0; form < 7; form++) {
      fighter.special.action = [SpecialAction.heroNeutral, SpecialAction.heroSide, SpecialAction.heroUp, SpecialAction.heroDown][slot] ?? SpecialAction.heroNeutral;
      fighter.special.form = form;
      const move = specialForm(specialKit(specials, slot), form);
      fighter.special.duration = move.endFrame;
      for (let frame = 1; frame <= move.endFrame; frame++) {
        fighter.special.frame = frame;
        for (let index = 0; index < (move.regions?.length ?? 0); index++) {
          const authored = move.regions?.[index];
          if (authored === undefined) continue;
          const active = frame - 1 >= authored.firstFrame && frame - 1 <= authored.lastFrame && authored.hit.effect.damage > 0.0;
          const actual = hitAreaPose(fighter, specialAreaRegion(fighter, index), pose);
          assertEquals(actual.visible, active);
          if (!active) continue;
          assertEquals(actual.x, f32(-321.0 - f32(f32(authored.hit.minX + authored.hit.maxX) * 0.5)));
          assertEquals(actual.z, f32(f32(authored.hit.minZ + authored.hit.maxZ) * 0.5));
          checked++;
        }
      }
    }
  }
  assertTrue(checked > 100);
});

test("every hero spell projectile marks its collision centre on every live frame including Lich remote bursts [spec docs/disjoint-legibility.md]", () => {
  let checked = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 0.0, 1);
    const specials = fighter.tuning.specials;
    const projectile = mutableProjectile(fighter, 0);
    if (specials === undefined || projectile === undefined) continue;
    for (const { spec } of heroProjectileArt(specials)) {
      projectile.kind = ProjectileKind.hero;
      projectile.spec = spec;
      projectile.x = 701.0;
      projectile.z = 227.0;
      projectile.velocityX = spec.velocityX;
      projectile.velocityZ = spec.velocityZ;
      for (let life = spec.life; life > 0; life--) {
        projectile.life = life;
        const actual = projectedProjectile(fighter, 0, true);
        assertTrue(actual.visible);
        assertEquals(actual.x, projectile.x);
        assertEquals(actual.z, projectile.z);
        checked++;
      }
      projectile.life = 0;
      assertEquals(projectedProjectile(fighter, 0, true).visible, false);
    }
  }
  assertTrue(checked > 1000);
});

test("the original fighters' missiles mark their live collision centre every frame [spec docs/disjoint-legibility.md]", () => {
  const cases = [
    { character: Character.archer, kind: ProjectileKind.arrow },
    { character: Character.archer, kind: ProjectileKind.homingArrow },
    { character: Character.rifleman, kind: ProjectileKind.blaster },
    { character: Character.rifleman, kind: ProjectileKind.recoil },
    { character: Character.demonHunter, kind: ProjectileKind.manaBurn },
  ] as const;
  for (const entry of cases) {
    const fighter = createFighter(entry.character, -400.0, 1);
    const projectile = mutableProjectile(fighter, 0);
    if (projectile === undefined) throw new Error("missing projectile slot");
    projectile.kind = entry.kind;
    for (let life = 80; life > 0; life--) {
      projectile.life = life;
      projectile.x = 701.0 + life;
      projectile.z = 227.0;
      const actual = projectedProjectile(fighter, 0, true);
      assertTrue(actual.visible);
      assertEquals(actual.x, projectile.x);
      assertEquals(actual.z, projectile.z);
    }
  }
});
