



import { join } from "node:path";
import type { FrameDefinition, FrameNode } from "wisp/scripts/wisp/frames";
import { writeFrames } from "wisp/scripts/wisp/frames";
import { CPU_SETTINGS_DONE, CPU_SETTINGS_PANEL, CPU_SETTINGS_PREVIEW, CPU_SETTINGS_PROMPT, CPU_SETTINGS_ROWS } from "../../src/game/ui/cpuSettingsLayout";
import { MENU_FONT } from "../../src/game/ui/hudLayout";

const PANEL = CPU_SETTINGS_PANEL;
const BUTTON_HEIGHT = 0.027;

const at = (x: number, y: number) => [{ point: "TOPLEFT", relative: "root", x: x - PANEL.left, y: y - PANEL.top }] as const;
const label = (key: string, x: number, y: number, width: number, height: number, size: number): FrameNode =>
  ({ key, type: "TEXT", width, height, font: { file: MENU_FONT, size }, enabled: false, points: at(x, y) });
const button = (key: string, text: string, x: number, y: number, width: number): FrameNode =>
  ({ key, type: "GLUETEXTBUTTON", inherits: "ScriptDialogButton", text, width, height: BUTTON_HEIGHT, points: at(x, y) });
const row = (name: string, caption: string, y: number): FrameNode[] => [
  { ...label(`${name}Caption`, 0.15, y, 0.16, BUTTON_HEIGHT, 0.012), text: caption },
  button(`${name}Previous`, "<", 0.325, y, 0.04),
  button(`${name}Next`, ">", 0.605, y, 0.04),
  label(`${name}Value`, 0.37, y, 0.23, BUTTON_HEIGHT, 0.012),
];


export const OPPONENT_SETTINGS: FrameDefinition = {
  name: "OpponentSettings",
  type: "FRAME",
  width: PANEL.width,
  height: PANEL.height,
  at: { point: "TOPLEFT", x: PANEL.left, y: PANEL.top },
  level: 100,
  children: [
    { key: "backdrop", type: "BACKDROP", width: PANEL.width, height: PANEL.height, texture: "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp", enabled: false, points: at(PANEL.left, PANEL.top) },
    label("title", 0.15, 0.431, 0.42, 0.03, 0.014),
    button("close", "Close", 0.575, 0.431, 0.075),
    ...row("opponent", "Opponent", CPU_SETTINGS_ROWS[0]),
    ...row("difficulty", "Difficulty", CPU_SETTINGS_ROWS[1]),
    { ...label("preview", CPU_SETTINGS_PREVIEW.left, CPU_SETTINGS_PREVIEW.top, CPU_SETTINGS_PREVIEW.width, CPU_SETTINGS_PREVIEW.height, 0.012), justify: { horizontal: "LEFT", vertical: "TOP" } },
    button("done", "Done", CPU_SETTINGS_DONE.left, CPU_SETTINGS_DONE.top, CPU_SETTINGS_DONE.width),
    label("prompt", CPU_SETTINGS_PROMPT.left, CPU_SETTINGS_PROMPT.top, CPU_SETTINGS_PROMPT.width, CPU_SETTINGS_PROMPT.height, 0.01),
  ],
};

export const UI_FRAMES: readonly { readonly definition: FrameDefinition; readonly bindings: string }[] = [
  { definition: OPPONENT_SETTINGS, bindings: "src/game/ui/opponentSettingsFrames.ts" },
];


export const UI_FRAMES_IMPORTS = "../tools/selection/art";

if (import.meta.main) {
  const ts = join(import.meta.dir, "../..");
  for (const { definition, bindings } of UI_FRAMES) writeFrames(definition, join(ts, UI_FRAMES_IMPORTS), join(ts, bindings));
}
