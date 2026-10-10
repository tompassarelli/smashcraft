


import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { stateChecksum } from "./canonical";
import { createFrameScratch, joinReplay, parseReplay, parseReplayHeader, parseReplayPart, replayMatch, runReplayFrame } from "./matchReplay";
import { copyReplayState, createReplaySnapshot } from "./snapshot";
import { TAPE_REPLAY_SERIAL, recordTapeReplay } from "./tapeReplay";

test("match replay: a rollback match recorded in parts, paused once, replays to every checksum [k1 scenario]", () => {
  const frames = 700;
  const recorded = recordTapeReplay(frames, 401);
  assertEquals(recorded.segments, 2);
  assertTrue(recorded.parts.length > 1);
  const header = parseReplayHeader(recorded.manifest);
  if (typeof header === "string") throw new Error(header);
  assertEquals(header.parts, recorded.parts.length);
  assertEquals(header.repro.frame, frames);
  const bodies = recorded.parts.map((part, index) => {
    const body = parseReplayPart(part, TAPE_REPLAY_SERIAL, index + 1);
    if (typeof body === "string") throw new Error(body);
    return body;
  });
  const joined = joinReplay(header, bodies);
  const result = replayMatch(joined);
  assertEquals(result.problems.join("; "), "");
  assertEquals(result.frames, frames);
  assertEquals(result.reached, result.recorded);

  assertEquals(result.recorded, 2 + 3 + 2 + 2 + 1);

  const replay = parseReplay(joined);
  if (typeof replay === "string") throw new Error(replay);
  assertEquals(replay.segments.length, 2);
  const segment = assertDefined(replay.segments[1], "segment");
  const state = createReplaySnapshot();
  copyReplayState(state, segment.state);
  const frameScratch = createFrameScratch();
  segment.frames.forEach((saved, index) => assertTrue(runReplayFrame(state, replay.input, frameScratch, saved, segment.start + index + 1)));
  const replayed = createReplaySnapshot();
  copyReplayState(replayed, state);
  assertEquals(stateChecksum(replayed), recorded.finalChecksum);
});
