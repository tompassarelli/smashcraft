// How far each original fighter's drawn silhouette swings toward its strike
// (#156, the move-legibility measure): every frame of the move played through
// production pose selection, the packaged model's opaque geosets skinned at
// the clip time shown, projected onto the direction from the chest to the far
// end of the move's first active strike capsule. Contact never reads the
// model; this checks that the body visibly travels toward the volume that hits.
import { AttackPhase, AttackStyle, Character } from "../../src/game/sim/codes";
import { HERO_ROSTER } from "../../src/game/sim/heroes/registry";
import { type DrawnModel, type PoseFrame, sampleAttack } from "./hurtboxView";

/** Chest height of the reference fighter, the point a strike's direction is taken from. */
const CHEST = 50.0;
/** A later frame within this much of the farthest reach still counts as the peak. */
const PEAK = 0.5;

const AERIAL_STYLES: readonly AttackStyle[] = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];

interface DrawnReach {
  /** The clip shown on the first active frame. */
  readonly clip: number | undefined;
  /** Farthest minus nearest silhouette reach toward the strike over the move, in world units. */
  readonly swing: number;
  /** First attack frame within half a unit of the farthest reach. */
  readonly peakFrame: number;
  /** First and last active attack frames. */
  readonly firstActive: number;
  readonly lastActive: number;
  /** How far forward of the fighter's centre the silhouette draws on the active frames (#163: a jab draws shorter than its forward tilt). */
  readonly forward: number;
}

/** The silhouette's farthest point ahead of the fighter's centre, facing right. */
function forwardOf(model: DrawnModel, frame: PoseFrame): number {
  if (frame.clip === undefined) return Number.NEGATIVE_INFINITY;
  const triangles = model.triangles(frame.clip, frame.seconds, frame.facing);
  let forward = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < triangles.length; i += 2) forward = Math.max(forward, triangles[i] ?? 0);
  return forward;
}

function reachToward(model: DrawnModel, frame: PoseFrame, towardX: number, towardZ: number): number {
  if (frame.clip === undefined) return Number.NEGATIVE_INFINITY;
  const triangles = model.triangles(frame.clip, frame.seconds, frame.facing);
  let reach = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < triangles.length; i += 2) {
    reach = Math.max(reach, (triangles[i] ?? 0) * towardX + ((triangles[i + 1] ?? 0) - CHEST) * towardZ);
  }
  return reach;
}

/** The move's drawn swing toward its first active strike, facing right from the stage origin. */
export function measureDrawnReach(model: DrawnModel, character: Character, style: AttackStyle): DrawnReach {
  const frames = sampleAttack(character, style, 1, AERIAL_STYLES.includes(style));
  const active = frames.filter((frame) => frame.phase === AttackPhase.active);
  const first = active.find((frame) => frame.strikes.length > 0);
  const strike = first?.strikes[0];
  if (first === undefined || strike === undefined) throw new Error(`${character}/${style}: no active strike`);
  const [x1, z1, x2, z2] = [strike.x1 - first.x, strike.z1 - first.z, strike.x2 - first.x, strike.z2 - first.z];
  const [farX, farZ] = Math.hypot(x2, z2 - CHEST) >= Math.hypot(x1, z1 - CHEST) ? [x2, z2] : [x1, z1];
  const length = Math.hypot(farX, farZ - CHEST) || 1;
  const reaches = frames.map((frame) => reachToward(model, frame, farX / length, (farZ - CHEST) / length));
  const most = Math.max(...reaches);
  const peak = reaches.findIndex((reach) => reach >= most - PEAK);
  return {
    clip: first.clip,
    // A frame that draws nothing (no clip, or every geoset hidden) has no reach and does not count.
    swing: most - Math.min(...reaches.filter(Number.isFinite)),
    peakFrame: frames[peak]?.frame ?? -1,
    firstActive: first.frame,
    lastActive: active.at(-1)?.frame ?? first.frame,
    forward: Math.max(...active.map((frame) => forwardOf(model, frame))),
  };
}

/** Each hero's ground normals (#151), drawn by its stock model's sequences. */
const HERO_GROUND: readonly AttackStyle[] = [AttackStyle.jab, AttackStyle.jab2, AttackStyle.jab3, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack];

/** The moves #156 re-authored or re-chose a sequence for, and every hero's ground normals. */
export const REACH_CHECKED: readonly { readonly character: Character; readonly styles: readonly AttackStyle[] }[] = [
  { character: Character.archer, styles: [AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.getupAttack] },
  { character: Character.rifleman, styles: [AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.neutralAir, AttackStyle.upAir, AttackStyle.downAir] },
  { character: Character.demonHunter, styles: [AttackStyle.jab, AttackStyle.jab2, AttackStyle.jab3, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.downTilt, AttackStyle.downSmash] },
  // A hero's chain has two or three jabs.
  ...HERO_ROSTER.map((hero) => ({ character: hero.character, styles: hero.character === Character.lichKing
    ? [...HERO_GROUND, ...AERIAL_STYLES, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.grab, AttackStyle.getupAttack, AttackStyle.ledgeAttack]
    : HERO_GROUND.filter((style) => hero.moves.normals[style] !== undefined) })),
];

export interface DrawnReachRow extends DrawnReach {
  readonly character: Character;
  readonly style: AttackStyle;
  /** The model measured: an original's packaged file, a hero's stock model; a re-export makes the row stale. */
  readonly model: string;
}

export function drawnReachSource(rows: readonly DrawnReachRow[]): string {
  return [
    "// Generated by `bun wisp view reach --assets DIR` from the packaged fighter models; regenerate instead of editing.",
    "",
    "/** Per original-fighter move (#156): the model and clip measured, the drawn swing toward the strike and its peak and active frames. */",
    "export const DRAWN_REACH: readonly { readonly character: number; readonly style: number; readonly model: string; readonly clip: number; readonly swing: number; readonly peakFrame: number; readonly firstActive: number; readonly lastActive: number; readonly forward: number }[] = [",
    ...rows.map((row) => `  { character: ${row.character}, style: ${row.style}, model: ${JSON.stringify(row.model)}, clip: ${row.clip ?? -1}, swing: ${row.swing.toFixed(1)}, peakFrame: ${row.peakFrame}, firstActive: ${row.firstActive}, lastActive: ${row.lastActive}, forward: ${row.forward.toFixed(1)} },`),
    "];",
    "",
  ].join("\n");
}
