import { f32 } from "wisp/src/sim/f32";
import type { TextBox } from "./hudLayout";


export const CPU_SETTINGS_PANEL: TextBox = { left: f32(0.12), top: f32(0.44), width: f32(0.56), height: f32(0.34) };
export const CPU_SETTINGS_ROWS = [f32(0.377), f32(0.333)] as const;
export const CPU_SETTINGS_PREVIEW: TextBox = { left: f32(0.15), top: f32(0.287), width: f32(0.5), height: f32(0.127) };
export const CPU_SETTINGS_DONE: TextBox = { left: f32(0.33), top: f32(0.151), width: f32(0.14), height: f32(0.027) };
export const CPU_SETTINGS_PROMPT: TextBox = { left: f32(0.13), top: f32(0.119), width: f32(0.54), height: f32(0.018) };
