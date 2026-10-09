
import { f32 } from "wisp/src/sim/f32";
import type { HeroClipTable } from "../sim/heroes/hero";
export const JUMP_CLIPS = {
  3: {
    doubleJump: { index: 55, seconds: 0.5 },
  },
  5: {
    doubleJump: { index: 52, seconds: 0.5 },
  },
  6: {
    doubleJump: { index: 50, seconds: 0.5 },
  },
  8: {
    jump: { index: 52, seconds: f32(0.4) },
    doubleJump: { index: 53, seconds: 0.5 },
  },
  9: {
    jump: { index: 54, seconds: f32(0.4) },
    doubleJump: { index: 55, seconds: 0.5 },
  },
} as const satisfies Readonly<Record<number, HeroClipTable>>;
