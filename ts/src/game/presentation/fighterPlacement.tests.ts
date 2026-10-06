import { assertEquals, assertFalse, test } from "wisp/src/runtime/testing";
import { Character, LedgeState, SurfaceContact } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { MAIN_DECK_BODY_SURFACES, MAIN_DECK_UNDERSIDE_Z, mainDeckLeft, mainDeckRight, solidSurfaceAt } from "../sim/stage";
import { BODY_HALF_WIDTH, bodyTop } from "../sim/surfaces";
import { melee } from "../sim/tuning";
import { fighterBodyEnvelope, fitFighterPlacement } from "./fighterPlacement";
import { characterModelScale } from "./modelScale";

function insideDeck(x: number, z: number): boolean {
  let inside = false;
  for (let index = 0; index <= MAIN_DECK_BODY_SURFACES; index++) {
    const face = index < MAIN_DECK_BODY_SURFACES ? solidSurfaceAt(0, index) : undefined;
    const x0 = face?.startX ?? mainDeckLeft(0);
    const z0 = face?.startZ ?? 0.0;
    const x1 = face?.endX ?? mainDeckRight(0);
    const z1 = face?.endZ ?? 0.0;
    if ((z0 > z) !== (z1 > z) && x < x0 + (x1 - x0) * (z - z0) / (z1 - z0)) inside = !inside;
  }
  return inside;
}

test("each fighter's visible envelope clears the main underside and every side face at its unchanged ECB contact, both facings", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    for (const facing of [-1, 1]) {
      const fighter = createFighter(character, 0.0, facing);
      fighter.motion.grounded = false;
      const body = fighterBodyEnvelope(character);
      const scale = characterModelScale(character);
      const left = (facing > 0 ? body.left : -body.right) * scale;
      const right = (facing > 0 ? body.right : -body.left) * scale;
      const placement = { x: 0.0, z: 0.0 };
      for (let surface = 0; surface <= MAIN_DECK_BODY_SURFACES; surface++) {
        const face = surface < MAIN_DECK_BODY_SURFACES ? solidSurfaceAt(0, surface) : undefined;
        if (face !== undefined && face.kind !== SurfaceContact.wall) continue;
        fighter.motion.x = face === undefined ? 0.0 : (face.startX + face.endX) / 2 + (face.normalX > 0 ? 1 : -1) * melee(BODY_HALF_WIDTH);
        fighter.motion.z = face === undefined ? MAIN_DECK_UNDERSIDE_Z - melee(bodyTop(character)) : (face.startZ + face.endZ) / 2;
        const x = fighter.motion.x;
        const z = fighter.motion.z;
        fitFighterPlacement(placement, fighter, 0);
        assertEquals(fighter.motion.x, x);
        assertEquals(fighter.motion.z, z);
        // Sample the entire conservative body rectangle, including weapons.
        for (let column = 0; column <= 8; column++) {
          for (let row = 0; row <= 8; row++) {
            const px = placement.x + left + (right - left) * column / 8;
            const pz = placement.z + body.bottom * scale + (body.top - body.bottom) * scale * row / 8;
            assertFalse(insideDeck(px, pz));
          }
        }
      }
    }
  }
});

test("body fitting preserves grounded and deliberately attached ledge poses", () => {
  const fighter = createFighter(Character.archer, mainDeckRight(0) - 1.0, -1);
  const placement = { x: 0.0, z: 0.0 };
  fitFighterPlacement(placement, fighter, 0);
  assertEquals(placement.x, fighter.motion.x);
  assertEquals(placement.z, fighter.motion.z);
  fighter.motion.grounded = false;
  fighter.motion.z = -20.0;
  fighter.ledge.state = LedgeState.hang;
  fitFighterPlacement(placement, fighter, 0);
  assertEquals(placement.x, fighter.motion.x);
  assertEquals(placement.z, fighter.motion.z);
});
