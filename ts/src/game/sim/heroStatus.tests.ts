// Hero statuses: a body hit applies one, a shield stops it, a later damaging
// hit or its timer ends it, its group's immunity prevents chaining, and
// rollback and the canonical record carry it.
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { attackBuffer } from "../input/attackBuffer";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";
import { stateChecksum } from "../replay/canonical";
import { createReplaySnapshot } from "../replay/snapshot";
import { Character, ContactKind, HeroStatusGroup, HeroStatusKind } from "./codes";
import { beginDamageContacts, collectDamageContact, finishDamageContacts } from "./contacts";
import { createFighter } from "./fighter";
import { advanceHeroStatus } from "./heroSpecialRules";
import { type AppliedStatus, applyHeroStatus, clearHeroStatus, maskHeroStatusControls } from "./heroStatus";
import { createRoster, fighterAt } from "./roster";
import { controls } from "./testWorld";

const SLEEP: AppliedStatus = { kind: HeroStatusKind.sleep, frames: 20, group: HeroStatusGroup.sleep, immunityFrames: 180 };
const TAP = { damage: 2.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;
const JAB = { damage: 4.0, growth: 40.0, base: 10.0, launchX: f32(0.8), launchZ: f32(0.6), electric: false } as const;

function pair() {
  const owner = createFighter(Character.dreadlord, -100.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  return { world: createRoster(2, [owner, target]), owner, target };
}

function contact(world: ReturnType<typeof pair>["world"], effect: typeof TAP | typeof JAB, status?: AppliedStatus, shield = false): void {
  beginDamageContacts();
  collectDamageContact(world, 0, 1, effect, 1, ContactKind.launch, false, undefined, shield, status);
  finishDamageContacts(world);
}

test("a body hit applies its status, a shield stops it and the hit that applies it does not end it [spec docs/design/roster.md]", () => {
  const blocked = pair();
  contact(blocked.world, TAP, SLEEP, true);
  assertEquals(blocked.target.status.condition, HeroStatusKind.none);
  const { world, target } = pair();
  contact(world, TAP, SLEEP);
  assertEquals(target.status.condition, HeroStatusKind.sleep);
  assertEquals(target.status.conditionFrames, 20);
  assertEquals(target.status.damage, 2.0);
});

test("a status lasts its frames, then its group's immunity refuses a reapplication until it runs out [spec docs/design/roster.md]", () => {
  const { world, target } = pair();
  contact(world, TAP, SLEEP);
  for (let frame = 1; frame < 20; frame++) advanceHeroStatus(target);
  assertEquals(target.status.condition, HeroStatusKind.sleep);
  advanceHeroStatus(target);
  assertEquals(target.status.condition, HeroStatusKind.none);
  assertEquals(target.status.conditionImmunity[HeroStatusGroup.sleep], 180);
  assertEquals(target.status.conditionImmunity[HeroStatusGroup.silence], 0);
  contact(world, TAP, SLEEP);
  assertEquals(target.status.condition, HeroStatusKind.none);
  for (let frame = 0; frame < 180; frame++) advanceHeroStatus(target);
  contact(world, TAP, SLEEP);
  assertEquals(target.status.condition, HeroStatusKind.sleep);
});

test("the next damaging hit ends sleep and the same orb cannot put the target back to sleep [spec docs/design/roster.md]", () => {
  const { world, target } = pair();
  contact(world, TAP, SLEEP);
  advanceHeroStatus(target);
  contact(world, JAB);
  assertEquals(target.status.condition, HeroStatusKind.none);
  assertEquals(target.status.conditionImmunity[HeroStatusGroup.sleep], 180);
  const chained = pair();
  contact(chained.world, TAP, SLEEP);
  contact(chained.world, TAP, SLEEP);
  assertEquals(chained.target.status.condition, HeroStatusKind.none);
});

test("a sleeping fighter's inputs are discarded while its motion continues [spec docs/design/roster.md]", () => {
  const { target } = pair();
  target.motion.grounded = false;
  target.motion.vx = 3.0;
  target.motion.vz = -2.0;
  applyHeroStatus(target, SLEEP);
  assertEquals(target.motion.vx, 3.0);
  assertEquals(target.motion.vz, -2.0);
  const input = controls({ jumpPressed: true, specialPressed: true, specialZ: 1, attackPressed: true, shield: true, direction: 1 });
  maskHeroStatusControls(target, input, attackBuffer(0));
  assertFalse(input.jumpPressed);
  assertFalse(input.specialPressed);
  assertFalse(input.attackPressed);
  assertFalse(input.shield);
  assertEquals(input.direction, 0);
  clearHeroStatus(target);
  const free = controls({ jumpPressed: true });
  maskHeroStatusControls(target, free, attackBuffer(0));
  assertTrue(free.jumpPressed);
});

test("a status and its immunity are rollback state and enter the canonical record only while live [invariant] [spec docs/design/roster.md]", () => {
  const live = createReplaySnapshot();
  const target = fighterAt(live.world, 1);
  const quiet = stateChecksum(live);
  const { world, target: slept } = pair();
  contact(world, TAP, SLEEP);
  const saved = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(saved, slept, 3);
  assertEquals(firstFighterDifference(saved, slept, 3, 3), undefined);
  assertEquals(saved.status.condition, HeroStatusKind.sleep);
  target.status.conditionImmunity[HeroStatusGroup.sleep] = 5;
  assertTrue(stateChecksum(live) !== quiet);
  clearHeroStatus(target);
  assertEquals(stateChecksum(live), quiet);
});
