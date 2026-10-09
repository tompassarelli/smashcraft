import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DrawTiming } from "wisp/scripts/wisp/headlessInput";
import { captureScene, type RenderScene } from "wisp/scripts/wisp/headlessRender";
import { FIGHTER_OBJECTS } from "../../src/game/objectData";
type HeadlessClient = Parameters<typeof captureScene>[0];


export function pauseDraws(directory: string) {
  const held = new Map<number, { timing: DrawTiming; scene: RenderScene }>();
  const boundaries: RenderScene[] = [];
  const fighterTypes = new Set(Object.values(FIGHTER_OBJECTS).map(fighter => fighter.id));
  const file = join(directory, "pause-draws.jsonl");
  writeFileSync(file, "");
  return {
    afterDraw(clients: readonly HeadlessClient[], timing: DrawTiming): void {
      for (const client of clients) {
        const paused = client.frames.shownText().includes("Paused");
        if (paused) {
          held.set(client.slot, { timing, scene: captureScene(client, { visibleOnly: true }) });
          continue;
        }
        const last = held.get(client.slot);
        if (last === undefined) continue;
        held.delete(client.slot);
        const scene = captureScene(client, { visibleOnly: true });
        const fighters = (draw: RenderScene) => draw.units.filter(unit => fighterTypes.has(unit.typeId))
          .map(unit => ({ handle: unit.handle.id, x: unit.x, y: unit.y, z: unit.z, animation: unit.animation,
            animationElapsed: unit.animationElapsed, animationClock: unit.animationClock }));
        const effects = (draw: RenderScene) => draw.effects.filter(pose => pose.timeScale === 0).map(pose => ({ model: pose.model, x: pose.x, y: pose.y, z: pose.z,
          animation: pose.animation, animationElapsed: pose.animationElapsed, animationClock: pose.animationClock }));
        const before = fighters(last.scene), after = fighters(scene);
        const frozenEffects = effects(last.scene), resumedEffects = effects(scene);
        const equal = before.length > 0 && JSON.stringify(before) === JSON.stringify(after)
          && JSON.stringify(frozenEffects) === JSON.stringify(resumedEffects);
        const record = { client: client.slot, lastPaused: { ...last.timing, fighters: before, effects: frozenEffects },
          firstResumed: { ...timing, fighters: after, effects: resumedEffects }, equal };
        appendFileSync(file, JSON.stringify(record) + "\n");
        boundaries.push(last.scene, scene);
        console.log(`pause draw p${client.slot}: callback ${last.timing.callbackFrame} -> ${timing.callbackFrame}, fighters ${before.length}, ${equal ? "equal" : "changed"}; ${file}`);
      }
    },
    scenes: () => boundaries,
  };
}
