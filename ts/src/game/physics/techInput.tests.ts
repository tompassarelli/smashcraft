import { assertEquals, test } from "wisp/src/runtime/testing";
import { TECH_PRESS_AGE_LIMIT, type TechInput, advanceTechInput, emptyTechInput, techContactWindow, techInputEligible } from "./techInput";

function pressedOnce(): TechInput {
  const state = emptyTechInput();
  advanceTechInput(state, true, false);
  return state;
}

test("tech input ages through hitlag and repeats a press made while frozen [reference]", () => {
  const existing: TechInput = { pressAge: 10, previousPressAge: 255, accumulatedPress: false };
  const early = emptyTechInput();
  const last = emptyTechInput();
  for (let tick = 1; tick <= 4; tick++) {
    const frozen = tick < 4;
    advanceTechInput(existing, false, frozen);
    assertEquals(existing.pressAge, 10 + tick);
    advanceTechInput(early, tick === 1, frozen);
    assertEquals(early.pressAge, tick < 4 ? 0 : 1);
    assertEquals(early.previousPressAge, tick === 1 ? TECH_PRESS_AGE_LIMIT : 0);
    assertEquals(techInputEligible(early), tick === 1);
    advanceTechInput(last, tick === 3, frozen);
  }
  assertEquals(last.pressAge, 1);
  assertEquals(last.previousPressAge, TECH_PRESS_AGE_LIMIT);
  assertEquals(techContactWindow(last), 19);
});

test("the repeat lockout compares the previous press's age on the frame before [reference]", () => {
  for (let gap = 40; gap <= 41; gap++) {
    const state = pressedOnce();
    for (let elapsed = 1; elapsed <= gap - 1; elapsed++) advanceTechInput(state, false, false);
    advanceTechInput(state, true, false);
    assertEquals(state.previousPressAge, gap - 1);
    assertEquals(techInputEligible(state), gap === 41);
  }
});

test("the tech window includes age 19 and excludes age 20 [reference]", () => {
  const state = pressedOnce();
  for (let age = 0; age <= 20; age++) {
    assertEquals(state.pressAge, age);
    assertEquals(techContactWindow(state), age < 20 ? 20 - age : 0);
    advanceTechInput(state, false, false);
  }
});
