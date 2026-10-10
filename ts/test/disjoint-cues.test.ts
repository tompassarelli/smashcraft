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
import { Character } from "../src/game/sim/codes";
import { sweep } from "./sweep";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

function checkNormalRegions(characters: readonly Character[]): void {
  const clients = headless.clients({ start: () => {}, install: () => {} });
  clients.start();
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing headless client");
  let measured = 0;
  client.run(() => {
    effectMotion().tracking = true;
    effectMotion().smoothing = true;
    for (const character of characters) {
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
            expect(effect.z, `character ${character}, style ${style}, facing ${facing}, frame ${frame}, region ${index}`).toBeCloseTo(expected[index]?.[1] ?? 0, 3);
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
}

test("headless renderer places one visible effect at every live Warden and Shadow Hunter disjoint normal region [k3 measure docs/disjoint-legibility.md]", () => {
  checkNormalRegions([Character.warden, Character.shadowHunter]);
});

sweep("headless renderer places one visible effect at every fighter's live disjoint normal region [k3 measure docs/disjoint-legibility.md]", () => {
  checkNormalRegions(SELECTABLE_CHARACTERS);
});
