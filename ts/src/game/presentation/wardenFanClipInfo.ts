
import { f32 } from "wisp/src/sim/f32";
export const WARDEN_FAN_CLIPS = {
  ground: { index: 53, seconds: f32(0.633) },
  air: { index: 54, seconds: f32(0.633) },
} as const;
