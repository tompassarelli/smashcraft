/** Authoring checks for situations deliberately requiring a reaction or precision input (#69). */
type InteractionTiming =
  | { readonly kind: "reaction"; readonly cueFrame: number; readonly lastResponseFrame: number; readonly choices: 1 | 4 }
  | { readonly kind: "required-link" | "required-precision"; readonly acceptedFrames: number };

export function interactionTimingProblem(timing: InteractionTiming): string | undefined {
  if (timing.kind === "reaction") {
    const budget = timing.choices === 1 ? 15 : 25;
    const available = timing.lastResponseFrame - timing.cueFrame;
    return available < budget ? `reaction offers ${available} frames after the cue; needs ${budget} for ${timing.choices} choices` : undefined;
  }
  return timing.acceptedFrames < 3 ? `${timing.kind} offers ${timing.acceptedFrames} accepted frames; needs at least 3` : undefined;
}
