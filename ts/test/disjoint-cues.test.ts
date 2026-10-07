import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { SELECTABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { createFighter } from "../src/game/sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../src/game/sim/hitRegions";
import { attackDurationFramesForGrounding } from "../src/game/sim/moves";
import { disjointNormals } from "../src/game/presentation/disjointCues";
import { HitAreaEffects } from "../src/game/render/hitAreaEffects";
import { effectMotion } from "../src/game/render/effects";
import { Character, HippogryphKind, ProjectileKind, SpecialAction } from "../src/game/sim/codes";
import { specialForm, specialKit } from "../src/game/sim/heroSpecials";
import { heroProjectileArt } from "../src/game/presentation/projectileArt";
import { ProjectilePresentation } from "../src/game/render/projectilePresentation";
import { IMPACT_DEFILE_MODEL } from "../src/game/assets/impactAssetInfo";
import { SpecialEffects } from "../src/game/render/specialEffects";
import { FrostEffects } from "../src/game/render/frostEffects";
import { advanceSummons, createSummonState } from "../src/game/presentation/summonState";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("headless renderer places one visible effect at every live disjoint normal region", () => {
  const clients = headless.clients({ start: () => {}, install: () => {} });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing headless client");
  let measured = 0;
  client.run(() => {
    effectMotion().tracking = true;
    effectMotion().smoothing = true;
    for (const character of SELECTABLE_CHARACTERS) {
      const fighter = createFighter(character, 417, 1);
      fighter.motion.z = 193;
      const renderer = new HitAreaEffects(character, { x: 0, y: 0, z: 0 });
      const scratch = emptyHitRegion();
      for (const style of disjointNormals(fighter)) for (const facing of [-1, 1]) {
        fighter.facing = facing;
        fighter.attack.style = style;
        for (let frame = 0; frame < attackDurationFramesForGrounding(style, true, fighter.tuning.moves); frame++) {
          fighter.attack.frame = frame;
          effectMotion().beginFrame();
          const expected: number[][] = [];
          for (let index = 0; index < authoredHitRegionCount(style, fighter.tuning.moves); index++) {
            const region = authoredHitRegion(scratch, character, style, frame, 0, index, fighter.tuning.moves);
            if (region.effect.damage > 0) expected.push([417 + facing * Math.fround(Math.fround(region.minX + region.maxX) * 0.5), 193 + Math.fround(Math.fround(region.minZ + region.maxZ) * 0.5)]);
          }
          renderer.present(fighter, true);
          const actual = client.effectPoses().filter(effect => effect.scale > 0 && effect.z > 0);
          expect(actual).toHaveLength(expected.length);
          for (const [index, effect] of actual.entries()) {
            expect(effect.x).toBeCloseTo(expected[index]?.[0] ?? 0, 3);
            expect(effect.z).toBeCloseTo(expected[index]?.[1] ?? 0, 3);
            expect(effect.alpha).toBe(255);
            measured++;
          }
        }
      }
      renderer.destroy();
    }
    effectMotion().tracking = false;
    effectMotion().smoothing = false;
  });
  console.log(`disjoint presentation: ${measured} active region frames checked, 0 missing or misplaced`);
});

test("headless renderer places each hero special strike on its active collision frame", () => {
  const clients = headless.clients({ start: () => {}, install: () => {} });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing headless client");
  let measured = 0;
  client.run(() => {
    for (const character of SELECTABLE_CHARACTERS) {
      const fighter = createFighter(character, 417, 1);
      fighter.motion.z = 193;
      const specials = fighter.tuning.specials;
      if (specials === undefined) continue;
      const renderer = new HitAreaEffects(character, { x: 0, y: 0, z: 0 });
      for (let slot = 0; slot < 4; slot++) for (let form = 0; form < 7; form++) for (const facing of [-1, 1]) {
        fighter.facing = facing;
        fighter.special.action = [SpecialAction.heroNeutral, SpecialAction.heroSide, SpecialAction.heroUp, SpecialAction.heroDown][slot] ?? SpecialAction.heroNeutral;
        fighter.special.form = form;
        const move = specialForm(specialKit(specials, slot), form);
        for (let frame = 1; frame <= move.endFrame; frame++) {
          fighter.special.frame = frame;
          const regions = (move.regions ?? []).filter(region => frame - 1 >= region.firstFrame && frame - 1 <= region.lastFrame && region.hit.effect.damage > 0);
          renderer.present(fighter, true);
          const actual = client.effectPoses().filter(effect => effect.scale > 0 && effect.z > 0);
          expect(actual).toHaveLength(regions.length);
          for (const [index, effect] of actual.entries()) {
            const region = regions[index]?.hit;
            if (region === undefined) throw new Error("missing expected region");
            expect(effect.x).toBeCloseTo(417 + facing * (region.minX + region.maxX) * 0.5, 3);
            expect(effect.z).toBeCloseTo(193 + (region.minZ + region.maxZ) * 0.5, 3);
            expect(effect.alpha).toBe(255);
            measured++;
          }
        }
      }
      renderer.destroy();
    }
  });
  console.log(`special presentation: ${measured} active region frames checked, 0 missing or misplaced`);
});

test("headless spell models and stationary field rims remain at their live projectile centre", () => {
  const clients = headless.clients({ start: () => {}, install: () => {} });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing headless client");
  let measured = 0;
  client.run(() => {
    effectMotion().tracking = true;
    effectMotion().smoothing = true;
    for (const character of SELECTABLE_CHARACTERS) {
      const fighter = createFighter(character, 417, 1);
      const specials = fighter.tuning.specials;
      const projectile = fighter.projectiles[0];
      if (specials === undefined || projectile === undefined) continue;
      const renderer = new ProjectilePresentation(character, { x: 0, y: 0, z: 0 });
      for (const { spec } of heroProjectileArt(specials)) {
        if (spec.model === undefined) continue;
        projectile.kind = ProjectileKind.hero;
        projectile.spec = spec;
        projectile.serial++;
        projectile.velocityX = spec.velocityX;
        projectile.velocityZ = spec.velocityZ;
        for (let life = spec.life; life > 0; life--) {
          projectile.life = life;
          projectile.x = 701 + spec.life - life;
          projectile.z = 227;
          effectMotion().beginFrame();
          renderer.present(fighter, true, false);
          const actual = client.effectPoses().filter(effect => effect.model === spec.model && effect.scale > 0);
          expect(actual).toHaveLength(1);
          expect(actual[0]?.x).toBe(projectile.x);
          expect(actual[0]?.z).toBe(projectile.z);
          if (spec.velocityX === 0 && spec.velocityZ === 0) {
            const rim = client.effectPoses().find(effect => effect.model === IMPACT_DEFILE_MODEL && effect.scale > 0);
            expect(rim?.x).toBe(projectile.x);
            expect(rim?.z).toBe(projectile.z);
            expect(rim?.scale).toBeGreaterThan(0);
          }
          measured++;
        }
        projectile.life = 0;
        renderer.present(fighter, true, false);
        expect(client.effectPoses().filter(effect => effect.scale > 0)).toHaveLength(0);
      }
      renderer.destroy();
    }
    effectMotion().tracking = false;
    effectMotion().smoothing = false;
  });
  console.log(`projectile presentation: ${measured} live frames checked, 0 missing or misplaced`);
});

test("existing bear, hippogryph and freeze trap art follows the remote contact centre each frame", () => {
  const clients = headless.clients({ start: () => {}, install: () => {} });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing headless client");
  client.run(() => {
    const fighter = createFighter(Character.rifleman, -400, 1);
    const summons = createSummonState();
    const renderer = new SpecialEffects({ x: 0, y: 0, z: 0 });
    const frost = new FrostEffects({ x: 0, y: 0, z: 0 });
    fighter.bear.life = 150;
    fighter.hippogryph.life = 150;
    fighter.hippogryph.kind = HippogryphKind.strike;
    fighter.freezeTrap.life = 150;
    fighter.freezeTrap.arming = 0;
    for (let frame = 1; frame <= 150; frame++) {
      fighter.bear.x = 2 * frame;
      fighter.bear.z = 193;
      fighter.hippogryph.x = 3 * frame;
      fighter.hippogryph.z = 227;
      fighter.freezeTrap.x = 400;
      fighter.freezeTrap.z = 30;
      if (frame === 50) fighter.hippogryph.kind = HippogryphKind.dive;
      if (frame === 100) fighter.hippogryph.kind = HippogryphKind.released;
      advanceSummons(summons, fighter, 0);
      renderer.presentSummons(summons, fighter, 0);
      renderer.presentConfirmedAnimated(frame, fighter, 0);
      frost.present(fighter, 0);
      const actual = client.effectPoses().filter(effect => effect.scale > 0 && effect.z > 0);
      expect(actual).toHaveLength(3);
      expect(actual.some(effect => effect.x === fighter.bear.x && effect.z === fighter.bear.z)).toBe(true);
      expect(actual.some(effect => effect.x === fighter.hippogryph.x && effect.z === fighter.hippogryph.z)).toBe(true);
      expect(actual.some(effect => effect.x === fighter.freezeTrap.x && effect.z === fighter.freezeTrap.z)).toBe(true);
    }
    renderer.destroy();
    frost.destroy();
  });
  console.log("summon presentation: 450 live frames checked, 0 missing or misplaced");
});
