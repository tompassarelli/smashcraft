import { f32 } from "wisp/src/sim/f32";
import type { HeroClipTable } from "../../sim/heroes/hero";
import { TINKER_AUTHORED_CLIPS } from "./tinkerClipInfo";
export const TINKER_FALLBACK_CLIP = { index: 6, seconds: f32(0.666) };

export const TINKER_CLIPS: HeroClipTable = {
  idle: TINKER_FALLBACK_CLIP,
  walk: { index: 0, seconds: 1.0 },
  dash: { index: 0, seconds: 1.0 },
  run: { index: 0, seconds: 1.0 },
  ko: { index: 3, seconds: f32(1.166) },
  ...TINKER_AUTHORED_CLIPS,
  fallSpecial: TINKER_AUTHORED_CLIPS.fall,
  damageGround: TINKER_AUTHORED_CLIPS.grabbed,
  damageAir: TINKER_AUTHORED_CLIPS.grabbed,
  damageTumble: TINKER_AUTHORED_CLIPS.knockdown,
  neutralSpecialAir: TINKER_AUTHORED_CLIPS.neutralSpecial,
  sideSpecialAir: TINKER_AUTHORED_CLIPS.sideSpecial,
  sideSpecialFollowUpAir: TINKER_AUTHORED_CLIPS.sideSpecialFollowUp,
  upSpecialAir: TINKER_AUTHORED_CLIPS.upSpecial,
  downSpecialAir: TINKER_AUTHORED_CLIPS.downSpecial,
};
