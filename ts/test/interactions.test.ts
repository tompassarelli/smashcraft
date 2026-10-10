import { expect, test } from "bun:test";
import { interactionTimingProblem } from "../scripts/interactionTiming";

test("authored reaction options allow the adopted budget after their first visible cue [spec docs/design/execution-windows.md]", () => {
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 21, choices: 1 })).toBeDefined();
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 22, choices: 1 })).toBeUndefined();
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 31, choices: 4 })).toBeDefined();
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 32, choices: 4 })).toBeUndefined();
});

test("required links and unaided precision inputs reject one- and two-frame windows [spec docs/design/execution-windows.md]", () => {
  for (const kind of ["required-link", "required-precision"] as const) {
    for (const acceptedFrames of [1, 2]) expect(interactionTimingProblem({ kind, acceptedFrames })).toBeDefined();
    expect(interactionTimingProblem({ kind, acceptedFrames: 3 })).toBeUndefined();
    expect(interactionTimingProblem({ kind, acceptedFrames: 12 })).toBeUndefined();
  }
});
