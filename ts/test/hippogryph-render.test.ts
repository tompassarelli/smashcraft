import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { NATIVE_DRIVER_BUILD } from "../src/game/shell/currentBuild";
import { HIPPOGRYPH_MODEL, HIPPOGRYPH_RIDER_MODEL } from "../src/game/presentation/hippogryphPose";
import { install as installGame, startBuild } from "../src/platform/main";
import { installSmashcraftNativeDriver, nativeDriverCommand, startSmashcraftNativeDriver } from "../src/platform/nativeDriver";
import { shell } from "../src/platform/shell/state";
import { value } from "./rematch/playableMatch";
import { originalClip, originalClipCount } from "../src/game/assets/fighterOriginalClipInfo";
import { Character } from "../src/game/sim/codes";

const script = readFileSync(new URL("./native/pads/232/hippogryph-ride.pad", import.meta.url), "utf8");
const archerClips = new Set(Array.from({ length: originalClipCount(Character.archer) }, (_, index) => originalClip(Character.archer, index)?.modelPath));

for (const presentation of ["native", "pool-confirmed", "pool-predicted"] as const) {
  test(`${presentation}: mounted ride replaces Archer and bird; jump-off restores two separate bodies [spec #232]`, () => {
    const runtime = installHeadless(SMASHCRAFT_HEADLESS);
    try {
      const build = { ...NATIVE_DRIVER_BUILD, presentation };
      const clients = runtime.clients({
        install() { installGame(build); installSmashcraftNativeDriver(); },
        start() { startBuild(build); installSmashcraftNativeDriver(); startSmashcraftNativeDriver(); },
      }, [0, 1], { keepCalls: 0 });
      clients.start();
      clients.frames(30);
      clients.everywhere(() => nativeDriverCommand(script));
      clients.everywhere(() => nativeDriverCommand("resume"));
      for (let frame = 1; frame <= 88; frame++) {
        clients.frames(1);
        if (![62, 70, 80, 84, 88].includes(frame)) continue;
        for (const client of clients.clients) {
          const effects = client.effectPoses().filter(effect => effect.scale > 0 && effect.alpha > 0);
          const riding = frame <= 80;
          const riders = effects.filter(effect => effect.model === HIPPOGRYPH_RIDER_MODEL);
          const birds = effects.filter(effect => effect.model === HIPPOGRYPH_MODEL);
          expect(riders.length).toBe(riding ? 1 : 0);
          expect(birds.length).toBe(riding ? 0 : 1);
          const fighterX = value(client, () => shell().world.fighters[0]?.motion.x);
          const unit = client.unitPoses().find(unit => unit.x === fighterX);
          expect(unit?.visible).toBe(presentation === "native" && !riding);
          const bodies = effects.filter(effect => effect.x === fighterX && archerClips.has(effect.model));
          expect(bodies.length).toBe(presentation !== "native" && !riding ? 1 : 0);
          if (frame === 62) expect(riders[0]?.animation).toBe("Stand");
          if (frame === 70 || frame === 80) {
            expect(riders[0]?.animation).toBe("Walk");
            expect(riders[0]?.roll === 0).toBe(false);
          }
          if (!riding) expect(birds[0]?.animation).toBe("Attack");
        }
      }
      for (const client of clients.clients) expect(client.errors).toEqual([]);
    } finally { runtime.restore(); }
  });
}
