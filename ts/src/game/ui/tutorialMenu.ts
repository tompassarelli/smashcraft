// The tutorial menu on fighter selection (#306): a lesson choice, Start and
// Not now. It opens by itself for a player who has never started a match or
// answered it (a local file remembers that), and from the Tutorial button that
// training shows. Opening is presentation only; its buttons are synchronized
// clicks that act on the match rules.
import { f32 } from "wisp/src/sim/f32";
import { readChunks, writeChunks } from "wisp/src/platform/fileio";
import { LESSONS, lessonChoiceText } from "../match/tutorial";
import { MENU_FONT } from "./hudLayout";
import { createBackdrop, createText, placeTopLeft } from "./frames";

export type TutorialButton = { kind: "tutorialOpen" } | { kind: "tutorialStep"; direction: -1 | 1 } | { kind: "tutorialStart" } | { kind: "tutorialClose" };

const PANEL_TEXTURE = "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp";
const SEEN_FILE = "SmashcraftTutorial.pld";
const SEEN = "seen";

export interface TutorialMenuFrames {
  readonly root: framehandle;
  readonly lesson: framehandle;
  /** The Tutorial button among training's rules. */
  readonly open: framehandle;
}

function text(parent: framehandle, name: string, x: number, y: number, width: number, height: number, size: number): framehandle {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetFont(frame, MENU_FONT, size, 0);
  BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
  BlzFrameSetEnable(frame, false);
  return frame;
}

function button(parent: framehandle, x: number, y: number, width: number, height: number, label: string): framehandle {
  const frame = BlzCreateFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetText(frame, label);
  return frame;
}

/** The menu over the roster, hidden, and the Tutorial button on `rules`. */
export function createTutorialMenu(owner: framehandle, rules: framehandle, suffix: string, add: (frame: framehandle, target: TutorialButton) => framehandle): TutorialMenuFrames {
  const root = createBackdrop(`MeleeTutorialMenu${suffix}`, owner, 0);
  BlzFrameSetTexture(root, PANEL_TEXTURE, 0, true);
  placeTopLeft(root, f32(0.2), f32(0.47));
  BlzFrameSetSize(root, f32(0.4), f32(0.2));
  BlzFrameSetLevel(root, 20);
  BlzFrameSetText(text(root, `MeleeTutorialTitle${suffix}`, f32(0.21), f32(0.46), f32(0.38), f32(0.03), f32(0.018)), "Tutorial");
  BlzFrameSetText(text(root, `MeleeTutorialBody${suffix}`, f32(0.215), f32(0.43), f32(0.37), f32(0.05), f32(0.011)),
    `New to Smashcraft? Learn the basics in ${LESSONS.length} short lessons with a training partner. Pick any lesson to play it again.`);
  add(button(root, f32(0.23), f32(0.37), f32(0.03), f32(0.03), "−"), { kind: "tutorialStep", direction: -1 });
  const lesson = text(root, `MeleeTutorialLesson${suffix}`, f32(0.26), f32(0.37), f32(0.28), f32(0.03), f32(0.012));
  add(button(root, f32(0.54), f32(0.37), f32(0.03), f32(0.03), "+"), { kind: "tutorialStep", direction: 1 });
  add(button(root, f32(0.23), f32(0.315), f32(0.16), f32(0.035), "Start tutorial"), { kind: "tutorialStart" });
  add(button(root, f32(0.41), f32(0.315), f32(0.16), f32(0.035), "Not now"), { kind: "tutorialClose" });
  BlzFrameSetVisible(root, false);
  const open = add(button(rules, f32(0.24), f32(0.519), f32(0.105), f32(0.027), "Tutorial"), { kind: "tutorialOpen" });
  return { root, lesson, open };
}

export function showTutorialLesson(frames: TutorialMenuFrames, lesson: number): void {
  BlzFrameSetText(frames.lesson, lessonChoiceText(lesson));
}

// This client's answer; read from its file on first use.
let seen: boolean | undefined;

/** Whether this client's player has started a match or answered the tutorial's offer. */
export function tutorialSeen(): boolean {
  seen ??= readChunks(SEEN_FILE).join("") === SEEN;
  return seen;
}

/** Remembers on this client that its player needs no offer again. */
export function markTutorialSeen(): void {
  if (tutorialSeen()) return;
  seen = true;
  writeChunks(SEEN_FILE, [SEEN]);
}
