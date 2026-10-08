// wisp#69: a test build's replay records every frame's digest, and a replay
// that parts from it names its first divergent frame and field. The canary
// rewrites one recorded digest as the game would have written it had a field
// differed, so a replay that stopped comparing digests fails here.
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { fighterAt } from "../sim/roster";
import { frameDigest, significandUnit } from "./frameDigest";
import { createFrameScratch, joinReplay, parseReplay, parseReplayHeader, parseReplayPart, replayMatch, runReplayFrame } from "./matchReplay";
import { copyReplayState, createReplaySnapshot } from "./snapshot";
import { TAPE_REPLAY_SERIAL, recordTapeReplay } from "./tapeReplay";

const FRAMES = 250;

function joinedTape(): string[] {
  const recorded = recordTapeReplay(FRAMES, 122);
  const header = parseReplayHeader(recorded.manifest);
  if (typeof header === "string") throw new Error(header);
  return joinReplay(header, recorded.parts.map((part, index) => {
    const body = parseReplayPart(part, TAPE_REPLAY_SERIAL, index + 1);
    if (typeof body === "string") throw new Error(body);
    return body;
  }));
}

/** The joined replay with frame `frame`'s recorded digest replaced by the one `change` makes of the replayed match there. */
function withNativeChange(lines: readonly string[], frame: number, change: (this: void, fighter: ReturnType<typeof fighterAt>) => void): string[] {
  const replay = parseReplay(lines);
  if (typeof replay === "string") throw new Error(replay);
  const state = createReplaySnapshot();
  const scratch = createFrameScratch();
  let recorded = "";
  let native = "";
  for (const segment of replay.segments) {
    copyReplayState(state, segment.state);
    segment.frames.forEach((rows, index) => {
      const at = segment.start + index + 1;
      if (at > frame) return;
      assertTrue(runReplayFrame(state, replay.input, scratch, rows, at));
      if (at !== frame) return;
      recorded = segment.digests[index] ?? "";
      const changed = createReplaySnapshot();
      copyReplayState(changed, state);
      change(fighterAt(changed.world, 0));
      native = frameDigest(changed.world, frame);
    });
  }
  assertTrue(recorded.length === 6 && native !== recorded);
  let replaced = false;
  return lines.map((line) => {
    if (replaced || !line.startsWith("digests ") || !line.includes(recorded)) return line;
    replaced = true;
    return line.replace(recorded, native);
  });
}

test("#69 a test build's replay records every frame's digest and replays with none divergent", () => {
  const result = replayMatch(joinedTape());
  assertEquals(result.problems.join("; "), "");
  assertEquals(result.digests, FRAMES);
  assertEquals(result.divergent, 0);
});

test("#69 a native field an ulp off names its first divergent frame and field", () => {
  const cases: readonly { name: string; change: (this: void, fighter: ReturnType<typeof fighterAt>) => void; want: string }[] = [
    { name: "one position ulp", change: (fighter) => { fighter.motion.x += significandUnit(fighter.motion.x); }, want: "p0 motion.x +1 ulp" },
    { name: "an attack frame", change: (fighter) => { fighter.attack.frame += 2; }, want: "p0 attack.frame +2" },
    { name: "a velocity and the position it moved", change: (fighter) => {
      fighter.motion.vx += significandUnit(fighter.motion.vx);
      fighter.motion.x -= 3 * significandUnit(fighter.motion.x);
    }, want: "p0 motion.x -3 ulp" },
  ];
  for (const { name, change, want } of cases) {
    const result = replayMatch(withNativeChange(joinedTape(), 180, change));
    const first = result.problems[0] ?? "";
    assertEquals(first.startsWith("first divergent frame 180: ") && first.includes(want), true, `${name}: got "${first}", want frame 180 and "${want}"`);
    assertEquals(result.divergent, 1, name);
  }
});
