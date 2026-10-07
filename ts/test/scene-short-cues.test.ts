import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { readSceneLines } from "wisp/scripts/wisp/scene";
import { configureRuntime } from "wisp/src/runtime/config";
import { installSceneReport, startSceneReport } from "wisp/src/platform/scene";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { effectMotion, placeEffect } from "../src/game/render/effects";

const runtime = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(runtime.restore);

test("the scene recorder sees short cues when effect motion starts before native wrapping", () => {
  let frame = 0;
  const clients = runtime.clients({
    install: () => {
      configureRuntime({ filePrefix: "short-cues", globalPrefix: "__smashcraft", readyPrefix: "CUES" });
      installSceneReport();
    },
    start: () => {
      configureRuntime({ filePrefix: "short-cues", globalPrefix: "__smashcraft", readyPrefix: "CUES" });
      effectMotion();
      startSceneReport({ frame: () => frame, parked: (_x, _y, z) => z < 0 });
      const throughMotion = AddSpecialEffect("short-motion.mdx", 0, 0);
      const direct = AddSpecialEffect("short-direct.mdx", 0, 0);
      frame = 1;
      placeEffect(throughMotion, 0, 0, 10);
      BlzSetSpecialEffectPosition(direct, 0, 0, 10);
      frame = 14;
      BlzSetSpecialEffectPosition(throughMotion, 0, 0, -10);
      BlzSetSpecialEffectPosition(direct, 0, 0, -10);
    },
  }, [0]);
  clients.start();
  clients.frames(30);
  const report = readSceneLines(clients.client(0).files.get("short-cues-scene-p0.txt") ?? []);
  if ("problem" in report) throw new Error(report.problem);
  expect(report.models.find(model => model.model === "short-direct.mdx")?.longest).toBe(13);
  expect(report.models.find(model => model.model === "short-motion.mdx")?.longest).toBe(13);
});
