import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { createReferenceContactFighter } from "../referenceRig";
import { advanceHeroStatus } from "../heroSpecialRules";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";

function frame(world: Roster, first: Readonly<Controls> = controls(), strike?: AttackStyle, second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  beginFighterAttack(world, 1, strike, false);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0, inputs);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap: number, opponent: Character = Character.sylvanas): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.forsakenPaladin, f32(-gap * 0.5), 1);
  owner.mana.points = 100;
  const target = opponent === Character.sylvanas ? createReferenceContactFighter(f32(gap * 0.5), -1) : createFighter(opponent, f32(gap * 0.5), -1);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

const side = controls({ specialPressed: true, specialX: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

test("replaying Forsaken Paladin's Consecration and Righteous Fury restores every fighter field [invariant]", () => {
  const { world, owner, target } = pair(70.0);
  frame(world, down);
  const savedOwner = createFighter(Character.forsakenPaladin, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, -1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => { for (let f = 2; f <= 130; f++) frame(world, f === 50 ? side : controls()); };
  run();
  const endOwner = createFighter(Character.forsakenPaladin, 0.0, 1);
  const endTarget = createFighter(Character.rifleman, 0.0, -1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(target.status.damage, 0.0);
  assertEquals(owner.mana.points, 100);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});
