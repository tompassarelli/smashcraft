import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "../attacks";
import { Character } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus } from "../heroSpecialRules";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";

const H = HERO_REFERENCE_HEIGHT;

function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls(), stage = 0): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, stage, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, stage, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, stage, 0, inputs);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function lichPair(gap: number, opponent: Character = Character.rifleman): { world: Roster; lich: Fighter; target: Fighter } {
  const lich = createFighter(Character.lich, f32(-gap * 0.5), 1);
  lich.mana.points = 100;
  const target = createFighter(opponent, f32(gap * 0.5), -1);
  const world = createRoster(3, [lich, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, lich, target };
}

const sideForward = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

test("replaying Lich's nova, armor and ascent from a restored snapshot reproduces both fighters [invariant]", () => {
  const { world, lich, target } = lichPair(f32(H * f32(1.5)));
  const savedLich = createFighter(Character.lich, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(savedLich, lich, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    frame(world, sideForward);
    for (let f = 2; f <= 60; f++) frame(world);
    frame(world, down);
    for (let f = 2; f <= 50; f++) frame(world);
    frame(world, up);
    for (let f = 2; f <= 40; f++) frame(world, controls({ direction: 1 }));
  };
  run();
  assertGreaterThan(target.status.damage, 0.0);
  assertGreaterThan(lich.status.armorFrames, 0);
  const endLich = createFighter(Character.lich, 0.0, 1);
  const endTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(endLich, lich, 3);
  copyFighterState(endTarget, target, 3);
  copyFighterState(lich, savedLich, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endLich, lich, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

