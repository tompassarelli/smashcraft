// Drawn size against the hurt capsule (#144, the #97 rule that correct spacing
// must not lose to a body the player cannot see): each fighter's drawn
// standing height, at its model scale, meets its standing hurt capsule's top.
import { expect, test } from "bun:test";
import { hurtCapsule } from "../src/game/physics/contactGeometry";
import { clipFor } from "../src/game/presentation/fighterClips";
import { characterModelScale } from "../src/game/presentation/modelScale";
import { Character } from "../src/game/sim/codes";
import { HERO_ROSTER } from "../src/game/sim/heroes/registry";

/**
 * Highest drawn point of each fighter's idle clip 0.1 s in, at model scale 1:
 * the model the clients draw (the packaged fighter models, the heroes' classic
 * stock models) skinned by scripts/wisp/hurtboxView.ts DrawnModel, additive
 * glow layers left out. A changed idle clip needs a new measurement.
 */
const IDLE_TOPS: readonly { readonly character: Character; readonly idleClip: number; readonly top: number }[] = [
  { character: Character.archer, idleClip: 0, top: 120 },
  { character: Character.rifleman, idleClip: 0, top: 87 },
  { character: Character.demonHunter, idleClip: 0, top: 186 },
  { character: Character.blademaster, idleClip: 9, top: 180 },
  { character: Character.mountainKing, idleClip: 1, top: 99 },
  { character: Character.warden, idleClip: 4, top: 146 },
  { character: Character.lich, idleClip: 1, top: 175 },
  { character: Character.uther, idleClip: 0, top: 111 },
  { character: Character.dreadlord, idleClip: 1, top: 161 },
  { character: Character.shadowHunter, idleClip: 7, top: 138 },
  { character: Character.pitLord, idleClip: 2, top: 180 },
  { character: Character.beastmaster, idleClip: 9, top: 168 },
  { character: Character.lichKing, idleClip: 3, top: 192 },
];

/** The hurt capsule's top may sit at most a tenth above the drawn head. */
const LOWEST = 0.9;
/** Hair, hoods, crowns and folded wings may stand up to 0.3 of the body above it, as #97 rule 6 allows a limb. */
const HIGHEST = 1.3;
/** Named departures: drawn parts that rise higher and are not body. */
const DEPARTURES: { readonly [character: number]: string } = {
  [Character.blademaster]: "the banner on his back stands about 60 units over his head",
  [Character.lichKing]: "Frostmourne, raised in Stand Ready, stands about 50 units over his helm; the blade is never body",
};

test("every fighter's drawn standing height meets its hurt capsule's top", () => {
  const off = IDLE_TOPS.flatMap(({ character, idleClip, top }) => {
    if (clipFor(character, "idle").index !== idleClip) return [`${character}: idle clip changed, measure again`];
    const capsule = hurtCapsule(character);
    const ratio = (top * characterModelScale(character)) / (capsule.z2 + capsule.radius);
    if (ratio < LOWEST) return [`${character}: drawn ${ratio.toFixed(2)} of its hurt top`];
    if (ratio > HIGHEST && DEPARTURES[character] === undefined) return [`${character}: drawn ${ratio.toFixed(2)} of its hurt top`];
    return [];
  });
  expect(off).toEqual([]);
  // The original three and every registered hero.
  expect(IDLE_TOPS.map(({ character }) => character).sort((a, b) => a - b)).toEqual([Character.archer, Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(({ character }) => character)].sort((a, b) => a - b));
});
