import { f32 } from "wisp/src/sim/f32";
import { creepRigClips, creepRigDamageClips } from "./creepRig";
import type { HeroClip } from "./hero";
export const KOBOLD_MODEL_FILE = "units\\creeps\\Kobold\\Kobold.mdl";
export const KOBOLD_FALLBACK: HeroClip = { index: 0, seconds: 1.0 };
export const KOBOLD_CLIPS = creepRigClips({ idle: KOBOLD_FALLBACK, walkSeconds: 1.0, koIndex: 5, sideSpecialSeconds: f32(0.533), downSpecialSeconds: f32(0.567) });
export const KOBOLD_DAMAGE_CLIPS = creepRigDamageClips();
