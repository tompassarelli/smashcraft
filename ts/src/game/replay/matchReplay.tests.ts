// #141's round trip in Bun and in 32-bit Lua: the replay a recorder writes of
// a whole match, in parts and with a segment break where the match changed
// between frames, replays to every checksum it recorded.
import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { stateChecksum } from "./canonical";
import { createFrameScratch, joinReplay, parseReplay, parseReplayHeader, parseReplayPart, replayMatch, replayPartLines, runReplayFrame } from "./matchReplay";
import { copyReplayState, createReplaySnapshot } from "./snapshot";
import { TAPE_REPLAY_SERIAL, recordTapeReplay } from "./tapeReplay";

test("match replay: a rollback match recorded in parts, paused once, replays to every checksum", () => {
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
  // Two segment starts, a checkpoint every two seconds of each, both segment ends and the manifest's.
  assertEquals(result.recorded, 2 + 3 + 2 + 2 + 1);
  // The written state is the whole state: the last segment replays to the canonical checksum the match ended on.
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

test("match replay: a part cut short or from another replay is refused", () => {
  const part = replayPartLines(3, 1, ["rows 1:0:"]);
  assertEquals(typeof parseReplayPart(part, 3, 1), "object");
  assertEquals(parseReplayPart(part.slice(0, part.length - 1), 3, 1), "part 1 is cut short");
  assertEquals(parseReplayPart(part, 4, 1), "part 1 isn't part 1 of replay 4");
});

test("match replay: a segment ending during a checkpoint keeps every saved checksum", () => {
  const recorded = recordTapeReplay(250, 122);
  const header = parseReplayHeader(recorded.manifest);
  if (typeof header === "string") throw new Error(header);
  const bodies = recorded.parts.map((part, index) => {
    const body = parseReplayPart(part, TAPE_REPLAY_SERIAL, index + 1);
    if (typeof body === "string") throw new Error(body);
    return body;
  });
  const result = replayMatch(joinReplay(header, bodies));
  assertEquals(result.problems.join("; "), "");
  assertEquals(result.frames, 250);
  assertEquals(result.recorded, 2 + 2 + 2 + 1);
  assertEquals(result.reached, result.recorded);
});
