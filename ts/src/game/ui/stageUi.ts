// The stage panel all players share, which also shows the rules chosen at
// fighter selection. Its buttons are synchronized frame clicks any player may
// press; dragging the stage chip is local cursor art until a finished choice
// crosses the "stage-drop" sync event.
import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type MatchState, Phase, humanActive } from "../match/rules";
import { pointerX, pointerY } from "../menu/pointer";
import { type StageTile, clearStageDrag, stageDrag, stageTileLeft, stageTileTop, updateStageDrag } from "../menu/stageSelection";
import { STAGE_CATALOG, selectableStage, stageInfo } from "../menu/stageCatalog";
import { rulesSummary } from "../shell/messages";
import { ButtonClicks, MENU_FONT, type MenuControls, bindSyncHandler, consoleUi, coverScreen, createBackdrop, createSyncTrigger, createText, gameUi, placeTopLeft } from "./frames";

/** What the stage panel asks the game to do; each call comes from a synchronized event. */
export interface StageActions {
  selectStage(participantId: number, choice: StageTile): void;
  start(participantId: number): void;
  back(participantId: number): void;
}

type StageButton = { kind: "start" } | { kind: "back" };

function stageText(parent: framehandle, name: string, x: number, y: number, width: number, height: number, fontSize: number, text: string): framehandle {
  const label = createText(name, parent, 0);
  placeTopLeft(label, x, y);
  BlzFrameSetSize(label, width, height);
  BlzFrameSetText(label, text);
  BlzFrameSetEnable(label, false);
  BlzFrameSetFont(label, MENU_FONT, fontSize, 0);
  BlzFrameSetTextAlignment(label, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
  return label;
}

function stageButton(parent: framehandle, x: number, y: number, width: number, height: number, text: string): framehandle {
  const control = BlzCreateFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(control, x, y);
  BlzFrameSetSize(control, width, height);
  BlzFrameSetText(control, text);
  return control;
}

export class StagePanel {
  private readonly root: framehandle;
  private readonly backdrop: framehandle;
  private readonly preview: framehandle;
  private readonly previewName: framehandle;
  private readonly previewDescription: framehandle;
  private readonly ruleLabel: framehandle;
  private readonly chip: framehandle;
  private readonly clicks: ButtonClicks<StageButton>;
  private readonly sync: trigger;
  private readonly drag = stageDrag();
  private lastPhase: Phase | undefined;
  private lastChoice: number | undefined;
  private lastRules: string | undefined;

  constructor(
    private actions: StageActions,
    controls: MenuControls,
  ) {
    const journal = controls === "journal";
    this.clicks = new ButtonClicks("ui.stage.click", (button, clicker) => this.click(button, GetPlayerId(clicker)));
    const root = BlzCreateFrameByType("FRAME", "MeleeStageRoot", gameUi(), "", 0);
    this.root = root;
    this.backdrop = createBackdrop("MeleeStageBackdrop", consoleUi(), 800);
    BlzFrameSetTexture(this.backdrop, "war3mapImported\\StageBackdrop.tga", 0, false);
    coverScreen(this.backdrop);
    this.ruleLabel = stageText(root, "MeleeStageRules", f32(0.41), f32(0.584), f32(0.35), f32(0.025), f32(0.016), "");
    this.preview = createBackdrop("MeleeStagePreview", root, 0);
    placeTopLeft(this.preview, f32(0.042), f32(0.445));
    BlzFrameSetSize(this.preview, f32(0.372), 0.25);
    BlzFrameSetEnable(this.preview, false);
    this.previewName = stageText(root, "MeleeStagePreviewName", f32(0.045), f32(0.19), f32(0.37), f32(0.036), f32(0.022), "");
    this.previewDescription = stageText(root, "MeleeStageDescription", f32(0.045), f32(0.148), f32(0.36), f32(0.05), f32(0.011), "");
    stageText(root, "MeleeStageGridTitle", f32(0.454), f32(0.48), f32(0.3), f32(0.022), f32(0.012), "CHOOSE A STAGE");
    for (const stage of STAGE_CATALOG) {
      const choice = stage.id;
      const tile = createBackdrop(`MeleeStageTile${I2S(choice)}`, root, choice);
      BlzFrameSetTexture(tile, stageInfo(choice).texture, 0, true);
      placeTopLeft(tile, stageTileLeft(choice), stageTileTop(choice));
      BlzFrameSetSize(tile, f32(0.094), f32(0.078));
      BlzFrameSetEnable(tile, false);
      stageText(root, `MeleeStageTileName${I2S(choice)}`, stageTileLeft(choice), f32(stageTileTop(choice) - f32(0.08)), f32(0.094), f32(0.022), f32(0.008), stageInfo(choice).name);
    }
    this.chip = createBackdrop("MeleeStageChip", root, 0);
    BlzFrameSetTexture(this.chip, "war3mapImported\\StageChip.tga", 0, true);
    BlzFrameSetSize(this.chip, f32(0.04), f32(0.04));
    BlzFrameSetEnable(this.chip, false);
    const help = journal
      ? "Click a stage or move the stick.\nAny player can choose.\nA or Start: start · X: back"
      : "Click a stage or move the chip.\nAny player can choose.\nLeft/Right: change stage · Y: start";
    stageText(root, "MeleeStageHelp", f32(0.454), f32(0.132), f32(0.3), f32(0.036), f32(0.008), help);
    this.clicks.add(stageButton(root, f32(0.545), f32(0.092), f32(0.21), f32(0.048), journal ? "START MATCH [A]" : "START MATCH"), { kind: "start" });
    this.clicks.add(stageButton(root, f32(0.045), f32(0.082), f32(0.17), f32(0.037), journal ? "BACK [X]" : "BACK TO FIGHTERS"), { kind: "back" });
    this.sync = createSyncTrigger("ui.stage.drop", "stage-drop", PARTICIPANT_SLOTS, (sender, data) => {
      const choice = S2I(data);
      if (I2S(choice) === data && selectableStage(choice)) this.actions.selectStage(sender, choice);
    });
    BlzFrameSetVisible(root, false);
    BlzFrameSetVisible(this.backdrop, false);
  }

  bindActions(actions: StageActions): void {
    this.actions = actions;
    bindPrototype(this.clicks, ButtonClicks.prototype);
    this.clicks.bindHandler((button, clicker) => this.click(button, GetPlayerId(clicker)));
    bindSyncHandler("ui.stage.drop", (sender, data) => {
      const choice = S2I(data);
      if (I2S(choice) === data && selectableStage(choice)) this.actions.selectStage(sender, choice);
    });
  }

  destroy(): void {
    this.clicks.destroy();
    DestroyTrigger(this.sync);
    BlzDestroyFrame(this.root);
    BlzDestroyFrame(this.backdrop);
  }

  private click(button: StageButton, actor: number): void {
    if (button.kind === "start") this.actions.start(actor);
    else this.actions.back(actor);
  }

  /** Every rendered frame on every client. */
  update(game: Readonly<MatchState>): void {
    const enabled = game.phase === Phase.stageMenu && humanActive(game, GetPlayerId(GetLocalPlayer()));
    if (this.lastPhase !== game.phase) {
      BlzFrameSetVisible(this.root, enabled);
      BlzFrameSetVisible(this.backdrop, enabled);
      this.lastPhase = game.phase;
    }
    if (!enabled) {
      clearStageDrag(this.drag);
      return;
    }
    if (this.lastChoice !== game.stageChoice) {
      const stage = stageInfo(game.stageChoice);
      BlzFrameSetTexture(this.preview, stage.texture, 0, true);
      BlzFrameSetText(this.previewName, stage.name);
      BlzFrameSetText(this.previewDescription, stage.description);
      this.lastChoice = game.stageChoice;
    }
    const rules = rulesSummary(game);
    if (this.lastRules !== rules) {
      BlzFrameSetText(this.ruleLabel, rules);
      this.lastRules = rules;
    }
    let x = stageTileLeft(game.stageChoice) + f32(0.047);
    let y = f32(stageTileTop(game.stageChoice) - f32(0.039));
    const width = I2R(BlzGetLocalClientWidth());
    const height = I2R(BlzGetLocalClientHeight());
    if (width > 0 && height > 0) {
      const pointerAtX = pointerX(I2R(BlzGetMouseScreenPosX()), width, height);
      const pointerAtY = pointerY(I2R(BlzGetMouseScreenPosY()), height);
      const dropped = updateStageDrag(this.drag, BlzIsMouseButtonPressed(MOUSE_BUTTON_TYPE_LEFT), pointerAtX, pointerAtY, game.stageChoice);
      if (dropped !== undefined) BlzSendSyncData("stage-drop", I2S(dropped));
      if (this.drag.gesture?.kind === "carry") {
        x = pointerAtX;
        y = pointerAtY;
      }
    }
    placeTopLeft(this.chip, x - f32(0.02), y + f32(0.02));
  }
}
