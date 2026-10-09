


import { expect, test } from "bun:test";
import { hurtCapsule } from "../src/game/physics/contactGeometry";
import { clipFor } from "../src/game/presentation/fighterClips";
import { characterModelScale } from "../src/game/presentation/modelScale";
import { Character } from "../src/game/sim/codes";
import { HERO_ROSTER } from "../src/game/sim/heroes/registry";







const IDLE_TOPS: readonly { readonly character: Character; readonly idleClip: number; readonly top: number }[] = [
  { character: Character.anubarak, idleClip: 0, top: 155.479248046875 },
  { character: Character.rifleman, idleClip: 0, top: 87 },
  { character: Character.demonHunter, idleClip: 0, top: 186 },
  { character: Character.blademaster, idleClip: 9, top: 180 },
  { character: Character.mountainKing, idleClip: 1, top: 99 },
  { character: Character.warden, idleClip: 4, top: 146 },
  { character: Character.lich, idleClip: 1, top: 175 },
  { character: Character.forsakenPaladin, idleClip: 1, top: 110.1 },
  { character: Character.dreadlord, idleClip: 1, top: 161 },
  { character: Character.shadowHunter, idleClip: 7, top: 138 },
  { character: Character.pitLord, idleClip: 2, top: 180 },
  { character: Character.beastmaster, idleClip: 9, top: 168 },
  { character: Character.lichKing, idleClip: 3, top: 192 },
  { character: Character.thrall, idleClip: 0, top: 154 },
  { character: Character.jaina, idleClip: 0, top: 116 },
  { character: Character.sylvanas, idleClip: 9, top: 138 },
  { character: Character.cairne, idleClip: 0, top: 202 },
  { character: Character.chen, idleClip: 9, top: 150 },
  { character: Character.peon, idleClip: 9, top: 89 },
  { character: Character.tinker, idleClip: 6, top: 145 },
  { character: Character.kaelthas, idleClip: 0, top: 140 },
  { character: Character.murloc, idleClip: 2, top: 76.3 },
  { character: Character.kobold, idleClip: 0, top: 72.11871337890625 },
  { character: Character.grom, idleClip: 8, top: 189.2610626220703 },
  { character: Character.malfurion, idleClip: 0, top: 159.57972717285156 },
  { character: Character.medivh, idleClip: 0, top: 144.29507446289062 },
];


const LOWEST = 0.9;

const HIGHEST = 1.3;

const DEPARTURES: { readonly [character: number]: string } = {
  [Character.blademaster]: "the banner on his back stands about 60 units over his head",
  [Character.lichKing]: "Frostmourne, raised in Stand Ready, stands about 50 units over his helm; the blade is never body",
  [Character.cairne]: "the carried back totem rises above his head and chest",
  [Character.chen]: "his hat rises about 12 units above his drawn head",
  [Character.tinker]: "the raised backpack claw extends above the goblin and lower backpack body",
  [Character.grom]: "the carried banner rises about 50 units above his drawn head",
  [Character.malfurion]: "the carried staff rises above his drawn head",
};

test("every fighter's drawn standing height meets its hurt capsule's top [spec #97]", () => {
  const off = IDLE_TOPS.flatMap(({ character, idleClip, top }) => {
    if (clipFor(character, "idle").index !== idleClip) return [`${character}: idle clip changed, measure again`];
    const capsule = hurtCapsule(character);
    const ratio = (top * characterModelScale(character)) / (capsule.z2 + capsule.radius);
    if (ratio < LOWEST) return [`${character}: drawn ${ratio.toFixed(2)} of its hurt top`];
    if (ratio > HIGHEST && DEPARTURES[character] === undefined) return [`${character}: drawn ${ratio.toFixed(2)} of its hurt top`];
    return [];
  });
  expect(off).toEqual([]);

  expect(IDLE_TOPS.map(({ character }) => character).sort((a, b) => a - b)).toEqual([Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(({ character }) => character)].sort((a, b) => a - b));
});
