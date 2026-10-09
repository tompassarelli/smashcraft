import { modelReach } from "wisp/scripts/wisp/models";
import { boxSeen } from "wisp/scripts/wisp/visibility";
import { ARENA_CAMERA, PLAYABLE_BOUNDS, WORLD_BOUNDS, extremeCamera } from "../src/game/presentation/arenaCamera";
import { hiddenBelow, type SceneryPiece, type StageScenery } from "../src/game/presentation/stageScenery";
import { MAIN_DECK_BODY_SURFACES, solidSurfaceAt } from "../src/game/sim/stage";
import { stageBounds } from "../src/game/sim/stageBounds";
import { MATCH_CAMERA_ASPECT, createMatchCamera } from "../src/game/sim/matchCamera";
import { MODEL_FACTS } from "./wisp/modelFacts";
import { SMASHCRAFT_SCENE } from "./wisp/playerView";
import { MAIN_DECK_HALF_DEPTH, mainDeckOutlineStage } from "./stageDeck";

type Box = { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] };

export const TEMPLE_OF_TIDES = "Buildings\\Naga\\TempleOfTides\\TempleOfTides.mdx";

export const STAND_BOUNDS: Readonly<Record<string, Box>> = {
  [TEMPLE_OF_TIDES]: { min: [-180.0, -170.0, -91.0], max: [176.0, 183.0, 374.0] },
};

export function insideWorld(x: number, y: number): boolean {
  const nativeY = y + PLAYABLE_BOUNDS.centreY;
  return x >= WORLD_BOUNDS.left && x <= WORLD_BOUNDS.right && nativeY >= WORLD_BOUNDS.front && nativeY <= WORLD_BOUNDS.back;
}

export function worldProblems(name: string, origin: { readonly x: number; readonly y: number }, pieces: readonly SceneryPiece[]): readonly string[] {
  return pieces.filter(piece => !insideWorld(origin.x + piece.x, origin.y + piece.y)).map(piece => `${name}: ${piece.model} stands outside the world bounds`);
}

export function behindProblems(stage: number, name: string, scenery: Pick<StageScenery, "fog" | "pieces">): readonly string[] {
  const visibility = SMASHCRAFT_SCENE.visibility;
  if (visibility === undefined) throw new Error("missing visibility");
  const problems: string[] = [];
  const corners = (box: { min: readonly [number, number, number]; max: readonly [number, number, number] }) =>
    [box.min[0], box.max[0]].flatMap(x => [box.min[1], box.max[1]].flatMap(y => [box.min[2], box.max[2]].map(z => [x, y, z] as const)));
  const radians = (degrees: number) => degrees * Math.PI / 180;
  for (const camera of visibility.cameras) {
    const pitch = radians(camera.angleOfAttack > 180 ? camera.angleOfAttack - 360 : camera.angleOfAttack);
    const yaw = radians(camera.rotation);
    const forward = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)] as const;
    const along = ([x, y, z]: readonly [number, number, number]) => x * forward[0] + y * forward[1] + z * forward[2];
    const blast = stageBounds(stage).blast;
    const fight = { min: [blast.left - 200, -200, blast.bottom - 200], max: [blast.right + 200, 200, blast.top + 200] } as const;
    const farthestFighter = Math.max(...corners(fight).map(along));
    const [tx, ty, tz] = camera.target;
    const eye = [tx - camera.distance * forward[0], ty - camera.distance * forward[1], tz - camera.distance * forward[2]] as const;
    if (scenery.fog !== undefined && !(farthestFighter - along(eye) < scenery.fog.start)) problems.push(`${name}: fog starts inside the fight`);
    for (const piece of scenery.pieces) {
      const turn = radians(piece.yaw);
      const turned = (x: number, y: number) => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)] as const;
      const facts = MODEL_FACTS[piece.model];
      if (facts === undefined) throw new Error(`missing facts for ${piece.model}`);
      const reach = modelReach(facts);
      if (reach.unknown.length > 0) problems.push(`${name}: ${piece.model} has unknown reach ${reach.unknown.join(", ")}`);
      for (const box of reach.boxes) {
        const flat = [box.min[0], box.max[0]].flatMap(x => [box.min[1], box.max[1]].map(y => turned(x, y)));
        const placed = {
          min: [Math.min(...flat.map(p => p[0])) * piece.scale + piece.x, Math.min(...flat.map(p => p[1])) * piece.scale + piece.y, box.min[2] * piece.scale + piece.z] as const,
          max: [Math.max(...flat.map(p => p[0])) * piece.scale + piece.x, Math.max(...flat.map(p => p[1])) * piece.scale + piece.y, box.max[2] * piece.scale + piece.z] as const,
        };
        if (boxSeen(placed, camera) && Math.min(...corners(placed).map(along)) <= farthestFighter) problems.push(`${name}: ${piece.model} stands in front of the fight`);
      }
    }
  }
  return [...new Set(problems)];
}

export function floatingProblems(stage: number, name: string, pieces: readonly SceneryPiece[]): readonly string[] {
  const tilt = (10 * Math.PI) / 180;
  const problems: string[] = [];
  const placed = pieces.flatMap((piece) => {
    const bounds = STAND_BOUNDS[piece.model] ?? MODEL_FACTS[piece.model]?.bounds;
    if (bounds === undefined) return [];
    const turn = (piece.yaw * Math.PI) / 180;
    const flat = [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[1], bounds.max[1]].map(y => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)] as const));
    const stretch = (piece.matrixScale?.[2] ?? 1) * piece.scale;
    return [{
      model: piece.model,
      left: Math.min(...flat.map(p => p[0])) * piece.scale + piece.x, right: Math.max(...flat.map(p => p[0])) * piece.scale + piece.x,
      front: Math.min(...flat.map(p => p[1])) * piece.scale + piece.y,
      bottom: bounds.min[2] * stretch + piece.z, top: bounds.max[2] * stretch + piece.z,
    }];
  });
  for (const extreme of ["near", "far"] as const) {
    const camera = createMatchCamera();
    extremeCamera(camera, stage, MATCH_CAMERA_ASPECT, extreme);
    const depth = (y: number, z: number) => camera.distance + y * Math.cos(tilt) - (z - camera.z) * Math.sin(tilt);
    const project = (x: number, y: number, z: number) => [
      0.5 + (x - camera.x) / (2 * depth(y, z) * camera.tangent * MATCH_CAMERA_ASPECT),
      0.5 - (y * Math.sin(tilt) + (z - camera.z) * Math.cos(tilt)) / (2 * depth(y, z) * camera.tangent),
    ] as const;
    const deck = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index) => solidSurfaceAt(mainDeckOutlineStage(stage), index)).map(line => project(line.startX, -MAIN_DECK_HALF_DEPTH, line.startZ));
    const behindDeck = ([column, row]: readonly [number, number]) => deck.reduce((inside, [x1, y1], index) => {
      const [x2, y2] = deck.at(index - 1) ?? [x1, y1];
      return (y1 > row) !== (y2 > row) && column < ((x2 - x1) * (row - y1)) / (y2 - y1) + x1 ? !inside : inside;
    }, false);
    for (const piece of placed) {
      const surface = hiddenBelow(stage);
      if (surface !== undefined && piece.bottom < surface) continue;
      const shown = Array.from({ length: 21 }, (_, step) => piece.left + ((piece.right - piece.left) * step) / 20).filter((x) => {
        if (depth(piece.front, piece.bottom) > ARENA_CAMERA.farZ) return false;
        const at = project(x, piece.front, piece.bottom);
        if (at[0] < 0 || at[0] > 1 || at[1] < 0 || at[1] > 1 || behindDeck(at)) return false;
        return !placed.some((other) => other !== piece && other.front <= piece.front && x >= other.left && x <= other.right && piece.bottom >= other.bottom && piece.bottom <= other.top);
      });
      if (shown.length > 0) problems.push(`${name} ${extreme}: ${piece.model} base at z ${Math.round(piece.bottom)}`);
    }
  }
  return problems;
}
