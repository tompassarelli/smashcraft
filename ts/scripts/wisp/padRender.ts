import { join } from "node:path";
import { renameSync, writeFileSync } from "node:fs";
import { Effect } from "effect";
import { linePreloadFile } from "wisp/scripts/wisp/boundary";
import { captureScene, renderScenes, RenderFailure, type RenderScene } from "wisp/scripts/wisp/headlessRender";
import type { Graphics } from "wisp/scripts/wisp/graphicsProfiles";
import { drawnFrameFile } from "../../src/runtime/gameFiles";
import { visualReleaseFile } from "../../src/game/shell/visualCapture";
import { drawnFrom } from "../integrity/drawnCapture";
import type { PadStep } from "../integrity/padScript";
import { headlessRender } from "./headlessRender";
type HeadlessClient = Parameters<typeof captureScene>[0];

/** Captures the exact predicted frames that the native pad capture waits for. */
export function padRender(sessionDirectory: string, build: string, steps: readonly PadStep[], token: string, frames?: readonly number[]) {
  const requested = steps.filter((step) => step.kind === "capture" && (frames === undefined || frames.includes(step.frame)));
  const wanted = new Set(requested.map(({ slot, frame }) => `${slot}:${frame}`));
  const armed = new Set(steps.filter((step) => step.kind === "capture").map(({ slot, frame }) => `${slot}:${frame}`));
  const released = new Set<string>();
  const readers = [0, 1].map((slot) => drawnFrom(join(sessionDirectory, `client-${slot}`, "CustomMapData", drawnFrameFile(build, slot))));
  const scenes = new Map<string, RenderScene>();
  const soundOffsets = new Map<number, number>();
  const sounds: (HeadlessClient["soundLog"][number] & { readonly client: number; readonly matchFrame: number | undefined })[] = [];
  return {
    afterDraw(clients: readonly HeadlessClient[]): void {
      for (const client of clients) {
        const drawn = readers[client.slot]?.();
        for (const cue of client.soundLog.slice(soundOffsets.get(client.slot) ?? 0)) sounds.push({ ...cue, client: client.slot, matchFrame: drawn?.frame });
        soundOffsets.set(client.slot, client.soundLog.length);
        if (drawn === undefined) continue;
        const key = `${client.slot}:${drawn.frame}`;
        if (wanted.has(key) && !scenes.has(key)) scenes.set(key, { ...captureScene(client), frame: drawn.frame });
        if (armed.has(key) && !released.has(key)) {
          const path = join(sessionDirectory, `client-${client.slot}`, "CustomMapData", visualReleaseFile(token, client.slot, drawn.frame));
          writeFileSync(`${path}.next`, linePreloadFile(token));
          renameSync(`${path}.next`, path);
          released.add(key);
        }
      }
    },
    render(directory: string, graphics: readonly Graphics[] = ["classic"]) {
      const missing = [...wanted].filter((key) => !scenes.has(key));
      if (missing.length > 0) return Effect.fail(new RenderFailure({ cause: `headless pad did not draw requested capture frames: ${missing.join(", ")}` }));
      const frames = [...scenes.values()].sort((a, b) => a.frame - b.frame || a.client - b.client);
      const project = headlessRender();
      return Effect.forEach(graphics, (profile) => renderScenes(project, frames, graphics.length === 1 ? directory : join(directory, profile), profile)).pipe(
        Effect.tap(() => Effect.tryPromise({
          try: () => Bun.write(join(directory, "sound-cues.json"), JSON.stringify(sounds, null, 2) + "\n"),
          catch: (cause) => new RenderFailure({ cause }),
        })),
      );
    },
  };
}
