

import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";
import { stateChecksum } from "../replay/canonical";
import { createReplaySnapshot } from "../replay/snapshot";
import { Character, ContactKind, HeroStatusGroup, HeroStatusKind } from "./codes";
import { beginDamageContacts, collectDamageContact, finishDamageContacts } from "./contacts";
import { createFighter } from "./fighter";
import { type AppliedStatus, clearHeroStatus } from "./heroStatus";
import { createRoster, fighterAt } from "./roster";

const SLEEP: AppliedStatus = { kind: HeroStatusKind.sleep, frames: 20, group: HeroStatusGroup.sleep, immunityFrames: 180 };
const TAP = { damage: 2.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

function pair() {
  const owner = createFighter(Character.dreadlord, -100.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  return { world: createRoster(2, [owner, target]), owner, target };
}

function contact(world: ReturnType<typeof pair>["world"], effect: typeof TAP, status?: AppliedStatus, shield = false): void {
  beginDamageContacts();
  collectDamageContact(world, 0, 1, effect, 1, ContactKind.launch, false, undefined, shield, status);
  finishDamageContacts(world);
}

test("a body hit applies its status, a shield stops it and the hit that applies it does not end it [k3 measure docs/design/roster.md]", () => {
  const blocked = pair();
  contact(blocked.world, TAP, SLEEP, true);
  assertEquals(blocked.target.status.condition, HeroStatusKind.none);
  const { world, target } = pair();
  contact(world, TAP, SLEEP);
  assertEquals(target.status.condition, HeroStatusKind.sleep);
  assertEquals(target.status.conditionFrames, 20);
  assertEquals(target.status.damage, 2.0);
});
