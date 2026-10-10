import { f32 } from "wisp/src/sim/f32";
import { creepRigClips, creepRigDamageClips } from "./creepRig";
import type { HeroClip } from "./hero";
export const MURLOC_MODEL_FILE = "units\\creeps\\Murloc\\Murloc.mdl";
export const MURLOC_FALLBACK: HeroClip = { index: 2, seconds: 1.0 };
export const MURLOC_CLIPS = creepRigClips({ idle: MURLOC_FALLBACK, walkSeconds: f32(0.667), koIndex: 6, sideSpecialSeconds: f32(0.667), downSpecialSeconds: f32(0.633) });
export const MURLOC_DAMAGE_CLIPS = creepRigDamageClips();
