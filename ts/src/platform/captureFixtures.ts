// The pad scripts a native capture map plays, with the frames it holds for the
// host to capture. `bun scripts/nativeCapture.ts build PAD...` rewrites this
// list for one build and restores it; the checked-in list is the control: the
// same walk twice around a different fighter, so a capture that shows an
// earlier scene can't match its twin (smashcraft:ts/scripts/nativeCapture.ts).
export interface CaptureFixture {
  readonly name: string;
  readonly frames: readonly number[];
  readonly script: string;
}

const WALK = "#! chat -dev quick hero rifleman\n40 a stick 1 0\n70 a stick 0 0\n90 b tap X 2\n";
const OTHER = "#! chat -dev quick hero mountain king\n40 b stick -1 0\n70 b stick 0 0\n";

export const CAPTURE_FIXTURES: readonly CaptureFixture[] = [
  { name: "control-walk", frames: [30, 31, 62, 100, 101], script: WALK },
  { name: "control-other", frames: [30, 62, 100], script: OTHER },
  { name: "control-walk-again", frames: [30, 31, 62, 100, 101], script: WALK },
];
