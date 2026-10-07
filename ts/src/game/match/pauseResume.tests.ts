import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, bit } from "../input/actions";
import { participantInputs } from "../input/participants";
import { captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { consumeResumeFrame, createMatchControls, startKeyDown, startKeyUp } from "./controls";
import { Phase } from "./rules";
import { createTapeWorld } from "../replay/tapeWorld";
import { fighterAt } from "../sim/roster";

export const PAUSE_DASH_PAD = `#! chat -dev quick hero archer
160 a stick 1 0
168 a press START
169 a release START
348 a press START
349 a release START
350 a stick 0 0
390 a press VIEW
460 a release VIEW
`;

test("three-second pad pause holds every fighter through its first unpaused callback", () => {
  const { live } = createTapeWorld({ stocks: 99, humans: 2 });
  live.match.stageChoice = 0;
  const session = createMatchControls();
  const input = createMatchFrameInput();
  const rows = participantInputs();
  const edges = PAUSE_DASH_PAD.trim().split("\n").slice(1).map(line => line.split(" "));
  let edge = 0;
  let simulation = 0;
  let pausedX = 0.0;
  let pausedZ = 0.0;
  let otherX = 0.0;
  let otherZ = 0.0;
  for (let callback = 1; callback <= 349; callback++) {
    while (Number(edges[edge]?.[0]) === callback) {
      const words = edges[edge];
      if (words !== undefined) {
        if (words[2] === "stick") { rows[0].held = Number(words[3]) > 0 ? bit(Action.moveRight) : 0; rows[0].axisX = Number(words[3]) * 127; }
        else if (words[3] === "START") {
          if (words[2] === "press") startKeyDown(session, 0, Phase.match, false);
          else startKeyUp(session, 0);
        }
      }
      edge++;
    }
    const resumed = consumeResumeFrame(session);
    if (!session.paused && !resumed) {
      simulation++;
      assertTrue(captureNetworkFrame(input, simulation, rows, live.world, 3));
      assertTrue(executeMatchFrame(input, live.match, live.world, live.controls, live.runtime, simulation));
    }
    const first = fighterAt(live.world, 0).motion;
    const second = fighterAt(live.world, 1).motion;
    if (callback === 167) {
      pausedX = first.x; pausedZ = first.z;
      otherX = second.x; otherZ = second.z;
      assertGreaterThan(first.vx, 0.0);
    }
    if (callback >= 168 && callback <= 348) {
      assertEquals(first.x, pausedX); assertEquals(first.z, pausedZ);
      assertEquals(second.x, otherX); assertEquals(second.z, otherZ);
      assertEquals(simulation, 167);
    }
    if (callback === 349) {
      assertEquals(simulation, 168);
      assertGreaterThan(first.x, pausedX);
    }
  }
});
