import { f32 } from "wisp/src/sim/f32";
import { consoleUi, createBackdrop, createText, placeTopLeft } from "./frames";
import { MENU_FONT } from "./hudLayout";

export class PauseMenu {
  private readonly root: framehandle;
  private readonly heading: framehandle;
  private readonly options: framehandle;
  private readonly help: framehandle;
  private readonly controls: framehandle;

  constructor() {
    this.root = createBackdrop("SmashcraftPause", consoleUi(), 1800);
    BlzFrameSetTexture(this.root, "UI\\Widgets\\EscMenu\\Human\\human-options-menu-background.blp", 0, true);
    placeTopLeft(this.root, f32(0.08), f32(0.53));
    BlzFrameSetSize(this.root, f32(0.64), f32(0.46));
    BlzFrameSetLevel(this.root, 20);
    const label = (name: string, y: number, height: number, size: number) => {
      const frame = createText(name, this.root, 1801);
      placeTopLeft(frame, f32(0.26), y);
      BlzFrameSetSize(frame, f32(0.28), height);
      BlzFrameSetFont(frame, MENU_FONT, size, 0);
      BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      BlzFrameSetEnable(frame, false);
      return frame;
    };
    this.heading = label("SmashcraftPauseHeading", f32(0.42), f32(0.04), f32(0.023));
    this.options = label("SmashcraftPauseOptions", f32(0.37), f32(0.13), f32(0.018));
    this.help = label("SmashcraftPauseHelp", f32(0.23), f32(0.05), f32(0.010));
    this.controls = label("SmashcraftPauseControls", f32(0.49), f32(0.1), f32(0.009));
    placeTopLeft(this.controls, f32(0.10), f32(0.18));
    BlzFrameSetSize(this.controls, f32(0.60), f32(0.10));
    BlzFrameSetVisible(this.root, false);
  }

  update(paused: boolean, choice: number, title: boolean, training = false, hints = false): void {
    BlzFrameSetVisible(this.root, paused || title);
    if (!paused && !title) return;
    BlzFrameSetText(this.heading, title ? "Smashcraft" : "Paused");
    BlzFrameSetText(this.options, title ? "> Play <" : ["Resume", "Character select", "Main menu"].map((text, row) => row === choice ? `|cffffcc00> ${text} <|r` : text).join("\n\n"));
    BlzFrameSetText(this.help, title ? "A / Enter / Start: play" : "Stick / arrows: choose    A / Enter: select\nStart / Y: resume    Escape: character select\nIJKL: camera    +/-: zoom    O/P: tilt    H: HUD");
    BlzFrameSetVisible(this.controls, !title);
    BlzFrameSetText(this.controls, "Q: full shield    T: light shield    P: tilt    Z / L3: short hop\n"
      + "Shield before landing: tech; hold left/right for a tech roll.\n"
      + "Shield + neutral/side Special: EX, 25 extra meter. Shield + left/right: roll; down: dodge.\n"
      + "Knocked down: Attack/Special to strike; Up/Jump/Shield to stand; left/right to roll.\n"
      + "Ledge: Up/toward stage to climb; Jump to leap; Shield to roll; Attack to strike; Down/away to let go."
      + (training ? `\nF2: training hints ${hints ? "On" : "Off"}` : ""));
  }
}
