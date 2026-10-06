// Warden's pose families as the shared hero clip table (sim/heroes/hero.ts).
import type { HeroClipTable } from "../../sim/heroes/hero";
import { WARDEN_CLIPS } from "./wardenClips";

const c = WARDEN_CLIPS;

export const WARDEN_CLIP_TABLE: HeroClipTable = {
  ...c,
  forwardTiltUp: c.forwardTilt, forwardTiltDown: c.forwardTilt,
  ledgeRoll: c.roll, rollForward: c.roll, rollBackward: c.roll, downDamage: c.knockdown,
  victimPummel: c.grabbed, victimThrowForward: c.damageAir, victimThrowBack: c.damageAir,
  victimThrowUp: c.damageAir, victimThrowDown: c.knockdown,
  neutralSpecial: c.shadowStrike, sideSpecial: c.pursuitLunge, upSpecial: c.blink, downSpecial: c.fanOfKnives,
  neutralSpecialAir: c.shadowStrike, sideSpecialAir: c.pursuitLunge, upSpecialAir: c.blink, downSpecialAir: c.fanOfKnives,
};
