




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
