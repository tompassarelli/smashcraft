import { assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { copyImpactState, createImpactState, emitImpacts, firstImpactDifference, IMPACT_COUNT, projectImpact, advanceImpacts } from "./impactState";
import { createImpactEvents } from "./impactEvents";

function emptyEvents() {
  return createImpactEvents();
}
test("impact pool projection is read only and expires on its source lifetime", () => {
  const state = createImpactState();
  const events = emptyEvents();
  events.hit = true;
  events.x = 100.0;
  events.z = 20.0;
  events.landing = 1;
  emitImpacts(state, events, 0);
  const saved = copyImpactState(state);
  const first = projectImpact(state, 0);
  assertTrue(first.visible);
  assertEquals(first.alpha, 255);
  assertEquals(first.x, 100.0);
  assertEquals(first.z, 70.0);
  projectImpact(state, 0);
  assertEquals(firstImpactDifference(saved, state), undefined);
  for (let age = 0; age < 9; age++) advanceImpacts(state);
  assertFalse(projectImpact(state, 0).visible);
  assertEquals(state.ages.length, IMPACT_COUNT);
});

test("impact snapshots copy pool arrays and preserve ring pointers", () => {
  const state = createImpactState();
  const events = emptyEvents();
  events.dodge = 1;
  emitImpacts(state, events, 0);
  const saved = copyImpactState(state);
  state.nextSlot[3] = 7;
  assertEquals(firstImpactDifference(saved, state), "nextSlot[3]");
  assertEquals(saved.nextSlot[3], 2);
});
