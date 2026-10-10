import { assertEquals, test } from "wisp/src/runtime/testing";
import { resolveAttacks } from "../attacks";
import { Character } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { createReferenceContactFighter } from "../referenceRig";
import { advanceGrabs, captureGrabPauses, resolveGrabs } from "../grabs";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus } from "../heroSpecialRules";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { DREADLORD_SPECIALS } from "./dreadlordSpecials";
import { firstFighterDifference } from "../../replay/difference";

const H = HERO_REFERENCE_HEIGHT;
const BITE = DREADLORD_SPECIALS.side.ground.commandGrab!;

function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  captureGrabPauses(world);
  resolveGrabs(world);
  beginDamageContacts();
  advanceGrabs(world, inputs);
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0, inputs);
  updateProjectiles(world);
  for (let slot = 0; slot < 2; slot++) {
    advanceHeroStatus(world.fighters[slot]!);
  }
  finishDamageContacts(world);
  resolveGrabs(world);
}

function pair(gap: number, target: Character = Character.sylvanas): { world: Roster; owner: Fighter; victim: Fighter } {
  const owner = createFighter(Character.dreadlord, -gap * 0.5, 1);
  owner.mana.points = 100;
  const victim = target === Character.sylvanas ? createReferenceContactFighter(gap * 0.5, -1) : createFighter(target, gap * 0.5, -1);
  const world = createRoster(3, [owner, victim]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, victim };
}

const side = controls({ specialPressed: true, specialX: 1, direction: 1 });

function play(world: Roster, last: number, first = controls(), second = controls()): void {
  for (let f = 2; f <= last; f++) frame(world, first, second);
}

test("replaying Vampiric Pounce from a restored snapshot reproduces both fighters [k1 scenario]", () => {
  const { world, owner, victim } = pair(H);
  const savedOwner = createFighter(Character.dreadlord, 0.0, 1);
  const savedVictim = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedVictim, victim, 3);
  const run = () => {
    frame(world, side);
    play(world, 70);
  };
  run();
  const endOwner = createFighter(Character.dreadlord, 0.0, 1);
  const endVictim = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endVictim, victim, 3);
  assertEquals(victim.status.damage, BITE.effect.damage);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(victim, savedVictim, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endVictim, victim, 3, 3), undefined);
});
