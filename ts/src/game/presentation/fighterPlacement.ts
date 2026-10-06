// The drawn body stays outside nearby stage faces without changing its ECB.
// Combat uses the simulation origin and authored hurt volumes (docs/hurtboxes.md).
import { Character, LedgeState } from "../sim/codes";
import { heroBody } from "../sim/heroes/heroBodies";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { mainDeckZ, solidSurfaceAt, solidSurfaceCount } from "../sim/stage";
import { characterModelScale } from "./modelScale";
import { hitlagShake } from "./hitPresentation";

interface BodyEnvelope {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}

// Rounded outward from visible, skinned vertices across every frame of the
// standing, jump, fall and airborne damage clips, including held weapons.
// smashcraft:evidence/fighter-placement-20261006/body-bounds.json
const BODY_ENVELOPES: readonly BodyEnvelope[] = [
  { left: -49.0, right: 91.0, bottom: -4.0, top: 106.0 },
  { left: -53.0, right: 77.0, bottom: -1.0, top: 128.0 },
  { left: -101.0, right: 100.0, bottom: -6.0, top: 185.0 },
];

/** Hero envelopes, made on first use. */
const heroEnvelopes: (BodyEnvelope | undefined)[] = [];

/**
 * A hero's envelope is Archer's, the roster's reference body, stretched by
 * the hero's width and height multipliers, in its own model's units.
 */
function heroEnvelope(character: Character): BodyEnvelope {
  const reference = BODY_ENVELOPES[Character.archer] ?? { left: 0.0, right: 0.0, bottom: 0.0, top: 0.0 };
  const body = heroBody(character);
  const width = (body?.width ?? 1.0) / characterModelScale(character);
  const height = (body?.height ?? 1.0) / characterModelScale(character);
  return { left: reference.left * width, right: reference.right * width, bottom: reference.bottom * height, top: reference.top * height };
}

/** The drawn body's extent around the fighter's origin, in its model's units. */
export function fighterBodyEnvelope(character: Character): Readonly<BodyEnvelope> {
  const original = BODY_ENVELOPES[character];
  if (original !== undefined) return original;
  const known = heroEnvelopes[character];
  if (known !== undefined) return known;
  const made = heroEnvelope(character);
  heroEnvelopes[character] = made;
  return made;
}

interface FighterPlacement {
  x: number;
  z: number;
}

/** Fills a caller-owned render origin; neither fighter state nor stage collision moves. */
export function fitFighterPlacement(out: FighterPlacement, fighter: Readonly<Fighter>, stage: number): void {
  const { motion } = fighter;
  out.x = motion.x + hitlagShake(fighter);
  out.z = motion.z;
  // Grounded and ledge poses deliberately meet the walking plane or ledge.
  if (motion.grounded || motion.z >= mainDeckZ(stage) || fighter.ledge.state !== LedgeState.none) return;
  const body = fighterBodyEnvelope(fighter.character);
  const scale = characterModelScale(fighter.character);
  const facing = fighterPoseFacing(fighter);
  const left = (facing > 0 ? body.left : -body.right) * scale;
  const right = (facing > 0 ? body.right : -body.left) * scale;
  const bottom = body.bottom * scale;
  const top = body.top * scale;
  const count = solidSurfaceCount(stage);
  // A second pass handles the neighbour of a sloping face after its correction.
  for (let pass = 0; pass < 2; pass++) {
    for (let index = 0; index < count; index++) {
      const surface = solidSurfaceAt(stage, index);
      const { normalX: nx, normalZ: nz, startX, startZ, endX, endZ } = surface;
      const x = out.x - startX;
      const z = out.z - startZ;
      const distance = x * nx + z * nz;
      if (distance < 0.0) continue;
      const alongX = endX - startX;
      const alongZ = endZ - startZ;
      const along = x * alongX + z * alongZ;
      const low = along + (alongX > 0 ? left : right) * alongX + (alongZ > 0 ? bottom : top) * alongZ;
      const high = along + (alongX > 0 ? right : left) * alongX + (alongZ > 0 ? top : bottom) * alongZ;
      if (high < 0.0 || low > alongX * alongX + alongZ * alongZ) continue;
      const nearest = distance + (nx > 0 ? left : right) * nx + (nz > 0 ? bottom : top) * nz;
      const correction = 2.0 - nearest;
      if (correction <= 0.0) continue;
      out.x += nx * correction;
      out.z += nz * correction;
    }
  }
}
