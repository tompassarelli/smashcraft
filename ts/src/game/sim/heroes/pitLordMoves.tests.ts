import { assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { hurtCapsule } from "../../physics/contactGeometry";
import { Character } from "../codes";
import { heroBody } from "./heroBodies";

test("Pit Lord is the roster's largest, heaviest and slowest body [spec docs/design/roster.md]", () => {
  const pitLord = heroBody(Character.pitLord);
  assertTrue(pitLord !== undefined);
  for (const character of [Character.mountainKing, Character.forsakenPaladin, Character.dreadlord]) {
    const other = heroBody(character);
    if (pitLord === undefined || other === undefined) return;
    assertGreaterThan(pitLord.weight, other.weight);
    assertGreaterThan(pitLord.width, other.width);
    assertLessThan(pitLord.air, other.air);
    assertGreaterThan(hurtCapsule(Character.pitLord).radius, hurtCapsule(character).radius);
  }
});
