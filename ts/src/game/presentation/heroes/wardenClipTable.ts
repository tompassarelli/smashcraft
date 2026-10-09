
import type { HeroClipTable } from "../../sim/heroes/hero";
import { WARDEN_CLIPS } from "./wardenClips";
import { WARDEN_FAN_CLIPS } from "../wardenFanClipInfo";

const c = WARDEN_CLIPS;

export const WARDEN_CLIP_TABLE: HeroClipTable = {
  ...c,
  smashCharge: c.forwardSmash,
  ledgeRoll: c.roll, rollForward: c.roll, rollBackward: c.roll, downDamage: c.knockdown,
  victimPummel: c.grabbed, victimThrowForward: c.damageAir, victimThrowBack: c.damageAir,
  victimThrowUp: c.damageAir, victimThrowDown: c.knockdown,
  neutralSpecial: c.shadowStrike, sideSpecial: c.pursuitLunge, upSpecial: c.blink, downSpecial: WARDEN_FAN_CLIPS.ground,
  neutralSpecialAir: c.shadowStrike, sideSpecialAir: c.pursuitLunge, upSpecialAir: c.blink, downSpecialAir: WARDEN_FAN_CLIPS.air,
};
