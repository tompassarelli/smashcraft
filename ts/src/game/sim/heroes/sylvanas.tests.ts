import { assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { attackBuffer } from "../../input/attackBuffer";
import { firstFighterDifference } from "../../replay/difference";
import { copyFighterState } from "../../replay/fighterState";
import { resolveAttacks } from "../attacks";
import { Character } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { advanceHeroStatus } from "../heroSpecialRules";
import { maskHeroStatusControls } from "../heroStatus";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, fighterAt } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls, testWorld } from "../testWorld";

function frame(world: Roster, press: Readonly<Controls> = controls(), response: Readonly<Controls> = controls()): void {
  const inputs = [{ ...press }, { ...response }];
  for (let slot = 0; slot < 2; slot++) {
    const input = inputs[slot]!;
    maskHeroStatusControls(fighterAt(world, slot), input, attackBuffer(0));
    advanceFighter(world, slot, 0, input, slot === 0 ? -240.0 : 240.0);
  }
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(fighterAt(world, slot), 0, 0, inputs[slot]!);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0, inputs);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) advanceHeroStatus(fighterAt(world, slot));
}
function pair(gap = 100.0, facing = 1) {
  const owner = createFighter(Character.sylvanas, f32(-gap * 0.5 * facing), facing);
  owner.mana.points = 100;
  const target = createFighter(Character.rifleman, f32(gap * 0.5 * facing), -facing);
  const world = testWorld(owner, target);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

test("Sylvanas has Pit's weight, run and air speed in world units [reference] [spec docs/design/sylvanas.md]", () => {
  const { owner } = pair();
  assertNear(owner.tuning.physics.weight, 96.0, f32(0.00002));
  assertNear(owner.tuning.physics.runSpeed, f32(10.968), f32(0.00002));
  assertNear(owner.tuning.physics.airSpeed, f32(5.61), f32(0.00002));
});

test("Sylvanas projectile and charge replay state restores exactly [invariant]", () => {
  const { world, owner } = pair(300.0);
  frame(world, controls({ specialPressed: true }));
  for (let i = 0; i < 19; i++) frame(world);
  const restored = createFighter(Character.sylvanas, 0.0, 1);
  copyFighterState(restored, owner, 3);
  assertEquals(firstFighterDifference(owner, restored, 3, 3), undefined);
});
