// Training's readout (#120) in the top-left corner, or the tutorial's lesson (#306): the last move's frames,
// the advantage after the last hit or shielded hit, and the combo, on a dark
// panel so the text stays legible over bright sky.
import { f32 } from "wisp/src/sim/f32";
import { type TrainingState, copyTrainingState, createTrainingState } from "../match/trainingState";
import { trainingReadout } from "../shell/messages";
import { tutorialOn, tutorialText } from "../match/tutorial";
import { createBackdrop, createText, gameUi, placeTopLeft } from "./frames";
import { MENU_FONT } from "./hudLayout";
import { TRAINING_READOUT_BOX, TRAINING_READOUT_PANEL, TRAINING_READOUT_PANEL_ALPHA } from "./hudLayout";

/** The dark tooltip texture the results panel and meters draw behind their text. */
const PANEL_TEXTURE = "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp";

export class TrainingReadout {
  private readonly panel: framehandle;
  private readonly label: framehandle;
  /** The state its text was last built from; the text changes only with it. */
  private readonly shown = createTrainingState();
  private built = false;
  /** Whether the last built text was empty; the panel hides with no text on it. */
  private empty = true;

  constructor() {
    this.panel = createBackdrop("TrainingReadoutPanel", gameUi(), 892);
    BlzFrameSetTexture(this.panel, PANEL_TEXTURE, 0, true);
    BlzFrameSetAlpha(this.panel, TRAINING_READOUT_PANEL_ALPHA);
    placeTopLeft(this.panel, TRAINING_READOUT_PANEL.left, TRAINING_READOUT_PANEL.top);
    BlzFrameSetSize(this.panel, TRAINING_READOUT_PANEL.width, TRAINING_READOUT_PANEL.height);
    BlzFrameSetEnable(this.panel, false);
    BlzFrameSetVisible(this.panel, false);
    this.label = createText("TrainingReadout", this.panel, 891);
    placeTopLeft(this.label, TRAINING_READOUT_BOX.left, TRAINING_READOUT_BOX.top);
    BlzFrameSetSize(this.label, TRAINING_READOUT_BOX.width, TRAINING_READOUT_BOX.height);
    BlzFrameSetFont(this.label, MENU_FONT, f32(0.011), 1);
    BlzFrameSetTextAlignment(this.label, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.label, false);
  }

  destroy(): void {
    BlzDestroyFrame(this.label);
    BlzDestroyFrame(this.panel);
  }

  update(visible: boolean, state: Readonly<TrainingState>): void {
    if (!visible) {
      BlzFrameSetVisible(this.panel, false);
      return;
    }
    const last = this.shown;
    if (!(this.built && last.moveStyle === state.moveStyle && last.moveSpecial === state.moveSpecial && last.moveForm === state.moveForm
      && last.moveCharacter === state.moveCharacter && last.moveStartup === state.moveStartup && last.moveActive === state.moveActive
      && last.moveTotal === state.moveTotal && last.advantageKind === state.advantageKind && last.advantage === state.advantage
      && last.comboHits === state.comboHits && last.comboDamage === state.comboDamage
      && last.lesson === state.lesson && last.lessonCount === state.lessonCount && (last.lessonCheer > 0) === (state.lessonCheer > 0))) {
      copyTrainingState(last, state);
      this.built = true;
      // The tutorial's lesson takes the readout's place.
      const text = tutorialOn(state) ? tutorialText(state) : trainingReadout(state);
      this.empty = text === "";
      BlzFrameSetText(this.label, text);
    }
    BlzFrameSetVisible(this.panel, !this.empty);
  }
}
