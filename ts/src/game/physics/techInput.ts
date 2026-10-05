// Melee's tech input, after NTSC 1.02 input-driver observations: a press
// techs within 20 frames, unless the previous press was under 40 frames
// earlier. Ages count input frames, including frozen ones during hitlag.

export const TECH_WINDOW_FRAMES = 20;
export const TECH_REPEAT_MINIMUM_AGE_FRAMES = 40;
/** Ages saturate here; every age past the lockout means the same. */
const AGE_LIMIT = 255;

export interface TechInput {
  pressAge: number;
  /** The age the previous press had reached when the latest one came. */
  previousPressAge: number;
  /** A press during frozen frames, which counts as pressed again on every frozen frame after it. */
  accumulatedPress: boolean;
}

export function emptyTechInput(): TechInput {
  return { pressAge: AGE_LIMIT, previousPressAge: AGE_LIMIT, accumulatedPress: false };
}

export function clearTechInput(state: TechInput): void {
  state.pressAge = AGE_LIMIT;
  state.previousPressAge = AGE_LIMIT;
  state.accumulatedPress = false;
}

/** Advances one input frame in place: every fighter advances every frame, again in rollback replays. */
export function advanceTechInput(state: TechInput, freshPress: boolean, frozen: boolean): void {
  const pressed = freshPress || (frozen && state.accumulatedPress);
  if (pressed) {
    state.previousPressAge = state.pressAge;
    state.pressAge = 0;
  } else {
    state.pressAge = Math.min(AGE_LIMIT, state.pressAge + 1);
  }
  state.accumulatedPress = frozen && pressed;
}

export function techInputEligible({ pressAge, previousPressAge }: Readonly<TechInput>): boolean {
  return pressAge < TECH_WINDOW_FRAMES && previousPressAge >= TECH_REPEAT_MINIMUM_AGE_FRAMES;
}

/** Frames left in which a contact techs; 0 when the input is not eligible. */
export function techContactWindow(state: Readonly<TechInput>): number {
  return techInputEligible(state) ? TECH_WINDOW_FRAMES - state.pressAge : 0;
}
