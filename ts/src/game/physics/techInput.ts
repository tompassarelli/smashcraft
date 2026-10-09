



export const TECH_WINDOW_FRAMES = 20;
export const TECH_REPEAT_MINIMUM_AGE_FRAMES = 40;

export const TECH_PRESS_AGE_LIMIT = 255;

export interface TechInput {
  pressAge: number;

  previousPressAge: number;

  accumulatedPress: boolean;
}

export function emptyTechInput(): TechInput {
  return { pressAge: TECH_PRESS_AGE_LIMIT, previousPressAge: TECH_PRESS_AGE_LIMIT, accumulatedPress: false };
}

export function clearTechInput(state: TechInput): void {
  state.pressAge = TECH_PRESS_AGE_LIMIT;
  state.previousPressAge = TECH_PRESS_AGE_LIMIT;
  state.accumulatedPress = false;
}


export function advanceTechInput(state: TechInput, freshPress: boolean, frozen: boolean): void {
  const pressed = freshPress || (frozen && state.accumulatedPress);
  if (pressed) {
    state.previousPressAge = state.pressAge;
    state.pressAge = 0;
  } else {
    state.pressAge = Math.min(TECH_PRESS_AGE_LIMIT, state.pressAge + 1);
  }
  state.accumulatedPress = frozen && pressed;
}

export function techInputEligible({ pressAge, previousPressAge }: Readonly<TechInput>): boolean {
  return pressAge < TECH_WINDOW_FRAMES && previousPressAge >= TECH_REPEAT_MINIMUM_AGE_FRAMES;
}


export function techContactWindow(state: Readonly<TechInput>): number {
  return techInputEligible(state) ? TECH_WINDOW_FRAMES - state.pressAge : 0;
}
