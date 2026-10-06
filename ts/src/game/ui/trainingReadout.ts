// Training's readout (#120) in the top-left corner: the last move's frames,
// the advantage after the last hit or shielded hit, and the combo.
import { f32 } from "wisp/src/sim/f32";
import { type TrainingState, copyTrainingState, createTrainingState } from "../match/trainingState";
import { trainingReadout } from "../shell/messages";
import { MENU_FONT, createText, gameUi, placeTopLeft } from "./frames";

export class TrainingReadout {
  private readonly label: framehandle;
  /** The state its text was last built from; the text changes only with it. */
  private readonly shown = createTrainingState();
  private built = false;

  constructor() {
    this.label = createText("TrainingReadout", gameUi(), 891);
    placeTopLeft(this.label, f32(0.02), f32(0.55));
    BlzFrameSetSize(this.label, f32(0.4), f32(0.06));
    BlzFrameSetFont(this.label, MENU_FONT, f32(0.011), 1);
    BlzFrameSetTextAlignment(this.label, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.label, false);
    BlzFrameSetVisible(this.label, false);
  }

  destroy(): void {
    BlzDestroyFrame(this.label);
  }

  update(visible: boolean, state: Readonly<TrainingState>): void {
    BlzFrameSetVisible(this.label, visible);
    if (!visible) return;
    const last = this.shown;
    if (this.built && last.moveStyle === state.moveStyle && last.moveSpecial === state.moveSpecial && last.moveForm === state.moveForm
      && last.moveCharacter === state.moveCharacter && last.moveStartup === state.moveStartup && last.moveActive === state.moveActive
      && last.moveTotal === state.moveTotal && last.advantageKind === state.advantageKind && last.advantage === state.advantage
      && last.comboHits === state.comboHits && last.comboDamage === state.comboDamage) return;
    copyTrainingState(last, state);
    this.built = true;
    BlzFrameSetText(this.label, trainingReadout(state));
  }
}
