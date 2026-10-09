import { PATTERNED_DECKS_STAGE, surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";

export const STAGE_EDGE_LIGHT_MODEL = "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareTarget.mdx";


export function stageEdgeLight(stage: number, index: number, frame: number): { readonly x: number; readonly y: number; readonly z: number } | undefined {
  if (stage !== PATTERNED_DECKS_STAGE || index < 0 || index >= 6) return undefined;
  const surface = index < 2 ? 0 : index < 4 ? 1 : 2;
  const left = index === 0 || index === 2 || index === 4;

  return { x: left ? surfaceLeft(stage, surface, frame) : surfaceRight(stage, surface, frame), y: surface === 0 ? -75.0 : -45.0, z: surfaceZ(stage, surface, frame) - 7.0 };
}
