

import { at } from "wisp/src/runtime/lookup";
import { Character, LedgeState } from "../sim/codes";
import { heroBody } from "../sim/heroes/heroBodies";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { mainDeckZ, solidSurfaceAt, solidSurfaceCount } from "../sim/stage";
import { characterModelScale } from "./modelScale";
import { hitlagShake } from "./hitPresentation";
import { TOMB_OF_SARGERAS_STAGE } from "../sim/stage";

interface BodyEnvelope {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}




const BODY_ENVELOPES: Readonly<Record<number, BodyEnvelope>> = {
  1: { left: -53.0, right: 77.0, bottom: -1.0, top: 128.0 },
  2: { left: -101.0, right: 100.0, bottom: -6.0, top: 185.0 },
};







function heroEnvelope(character: Character): BodyEnvelope {
  const reference = { left: -49.0, right: 91.0, bottom: -4.0, top: 106.0 };
  const body = heroBody(character);
  const width = (body?.width ?? 1.0) / characterModelScale(character);
  const height = (body?.height ?? 1.0) / characterModelScale(character);
  return { left: reference.left * width, right: reference.right * width, bottom: reference.bottom * height, top: reference.top * height };
}

function createBodyEnvelopes(): readonly BodyEnvelope[] {
  const envelopes: BodyEnvelope[] = [];
  for (const character of Object.values(Character)) envelopes[character] = BODY_ENVELOPES[character] ?? heroEnvelope(character);
  return envelopes;
}


const heroEnvelopes = createBodyEnvelopes();


export function fighterBodyEnvelope(character: Character): Readonly<BodyEnvelope> {
  return at(heroEnvelopes, character);
}

interface FighterPlacement {
  x: number;
  z: number;
}


export function fitFighterPlacement(out: FighterPlacement, fighter: Readonly<Fighter>, stage: number): void {
  const { motion } = fighter;
  out.x = motion.x + hitlagShake(fighter);
  out.z = motion.z;
  if (stage === TOMB_OF_SARGERAS_STAGE && fighter.water.inWater) out.z -= fighterBodyEnvelope(fighter.character).top * characterModelScale(fighter.character) / 2.0;

  if (motion.grounded || motion.z >= mainDeckZ(stage) || fighter.ledge.state !== LedgeState.none) return;
  const body = fighterBodyEnvelope(fighter.character);
  const scale = characterModelScale(fighter.character);
  const facing = fighterPoseFacing(fighter);
  const left = (facing > 0 ? body.left : -body.right) * scale;
  const right = (facing > 0 ? body.right : -body.left) * scale;
  const bottom = body.bottom * scale;
  const top = body.top * scale;
  const count = solidSurfaceCount(stage);

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
