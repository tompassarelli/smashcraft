import { expect, test } from "bun:test";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { cameraPoint, extremeCamera, localCamera } from "../src/game/presentation/arenaCamera";
import { CLOSEST_BODY_SHARE, FRAMING_MARGIN, fitFighterFrames, lookFrame } from "../src/game/presentation/fighterFraming";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { advanceMatchCamera, createMatchCamera } from "../src/game/sim/matchCamera";
import { createRoster } from "../src/game/sim/roster";
import { stageBounds } from "../src/game/sim/stageBounds";

const ASPECTS = [16 / 9, 16 / 10, 4 / 3] as const;
const ZOOMS = ["played", "near", "far"] as const;
const LOOKS = ["classic", "definitive"] as const;
const HEAD_ROOM = 0.03;
const POSITIONS_PER_STAGE = 3;
const STAGE_WIDTH_SLACK = 80;

interface Framed { readonly stage: number; readonly aspect: number; readonly zoom: string; readonly held: boolean; readonly camera: ReturnType<typeof createMatchCamera>; readonly placed: readonly ReturnType<typeof createFighter>[] }

function framings(visit: (framed: Framed) => void): { changedState: number } {
  const characters = Object.values(Character);
  const stages = STAGE_CATALOG.map(({ id }) => id).filter((id) => id >= 0);
  let seed = 398;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let changedState = 0;
  for (const [index, a] of characters.entries()) for (const b of characters.slice(index)) for (const stage of stages) {
    const region = stageBounds(stage).camera;
    for (let sample = 0; sample < POSITIONS_PER_STAGE; sample++) {
      const placed = [a, b].map((character) => {
        const classic = lookFrame(character, "classic"), definitive = lookFrame(character, "definitive");
        const half = Math.max(-classic.left, classic.right, -definitive.left, definitive.right) + FRAMING_MARGIN.side + STAGE_WIDTH_SLACK;
        const fighter = createFighter(character, region.left + half + (region.right - region.left - 2 * half) * random(), random() < 0.5 ? -1 : 1);
        fighter.motion.z = region.bottom + (region.top - Math.max(classic.top, definitive.top) - FRAMING_MARGIN.top - region.bottom) * random();
        return fighter;
      });
      const world = createRoster(3, placed);
      const played = createMatchCamera();
      advanceMatchCamera(played, world, stage);
      const simBefore = JSON.stringify([played, placed.map(({ motion, facing }) => [motion, facing])]);
      for (const aspect of ASPECTS) for (const zoom of ZOOMS) {
        const camera = createMatchCamera();
        localCamera(camera, played, stage, aspect);
        if (zoom !== "played") extremeCamera(camera, stage, aspect, zoom);
        const held = fitFighterFrames(camera, world, stage, aspect);
        visit({ stage, aspect, zoom, held, camera, placed });
      }
      if (JSON.stringify([played, placed.map(({ motion, facing }) => [motion, facing])]) !== simBefore) changedState++;
    }
  }
  return { changedState };
}

test("within the stage's zoom limit every fighter pair's whole body and head room stay in view under the closest-zoom height share, in both looks at 16:9, 16:10 and 4:3, close and far, without touching match state [spec docs/player-view.md]", () => {
  const failures: string[] = [];
  let checked = 0, limited = 0;
  const { changedState } = framings(({ stage, aspect, zoom, held, camera, placed }) => {
    if (!held) { limited++; return; }
    for (const look of LOOKS) for (const fighter of placed) {
      const bounds = lookFrame(fighter.character, look);
      const { x, z } = fighter.motion;
      const left = x + (fighter.facing > 0 ? bounds.left : -bounds.right), right = x + (fighter.facing > 0 ? bounds.right : -bounds.left);
      const low = cameraPoint(camera, aspect, left, z + bounds.bottom), lowRight = cameraPoint(camera, aspect, right, z + bounds.bottom);
      const head = cameraPoint(camera, aspect, left, z + bounds.top), headRight = cameraPoint(camera, aspect, right, z + bounds.top);
      checked++;
      const inside = [low, lowRight, head, headRight].every((point) => point.column >= 0 && point.column <= 1 && point.row <= 1 + 1e-9) && Math.min(head.row, headRight.row) >= HEAD_ROOM && low.row - head.row <= CLOSEST_BODY_SHARE + 1e-9;
      if (!inside && failures.length < 10) failures.push(`${fighter.character} ${look} on stage ${stage} at (${x.toFixed(0)}, ${z.toFixed(0)}), aspect ${aspect.toFixed(2)}, ${zoom}: head row ${head.row.toFixed(3)}, columns ${low.column.toFixed(3)}..${lowRight.column.toFixed(3)}, feet row ${low.row.toFixed(3)}`);
    }
  });
  expect(failures).toEqual([]);
  expect(changedState).toBe(0);
  expect(checked).toBeGreaterThan(50000);
  expect(limited).toBeLessThan(checked);
});
