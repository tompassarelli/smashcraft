



import { assertEquals, test } from "wisp/src/runtime/testing";
import { joinReplay, parseReplayHeader, parseReplayPart, replayMatch } from "./matchReplay";
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

test("#69 a test build's replay records every frame's digest and replays with none divergent [invariant]", () => {
  const result = replayMatch(joinedTape());
  assertEquals(result.problems.join("; "), "");
  assertEquals(result.digests, FRAMES);
  assertEquals(result.divergent, 0);
});
