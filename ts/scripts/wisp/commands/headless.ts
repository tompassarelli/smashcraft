// Headless journeys and optional frames drawn from the map's actual assets.
import { type Command } from "wisp/scripts/wisp/command";
import { makeHeadless } from "wisp/scripts/wisp/commands/headless";
import { SMASHCRAFT_PERF } from "./perf";

export const headless: Command = (args) => makeHeadless(async () => {
  const project = (await import("../journeys")).SMASHCRAFT_JOURNEYS;
  return args.includes("--render")
    ? { ...project, render: (await import("../headlessRender")).headlessRender() }
    : project;
}, SMASHCRAFT_PERF)(args);
