



import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { stageInPool, stagePoolCount } from "../menu/stagePool";
import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type MatchState, Phase, humanActive } from "../match/rules";
import { pointerX, pointerY } from "../menu/pointer";
import { type StageChoice, clearStageDrag, stageDrag, stageTileLeft, stageTileTop, updateStageDrag } from "../menu/stageSelection";
import { RANDOM_STAGE, STAGE_CATALOG, STAGE_CHOICES, selectableStageChoice, stageInfo } from "../menu/stageCatalog";
import { dropsSetting, hazardsSetting, rulesSummary } from "../shell/messages";
import { ButtonClicks, type MenuControls, bindSyncHandler, consoleUi, coverScreen, createBackdrop, createSyncTrigger, createText, gameUi, highlightText, placeTopLeft, setFrameText } from "./frames";
import { MENU_FONT, PANEL_TEXTURE } from "./hudLayout";
import { StageCard } from "./stageCard";



export interface StageActions {
  selectStage(participantId: number, choice: StageChoice): void;
  togglePoolMode(participantId: number): void;
  togglePoolStage(participantId: number, choice: number): void;
  start(participantId: number): void;
  back(participantId: number): void;
  toggleHazards(participantId: number): void;
  toggleDrops(participantId: number): void;
}

type StageButton = { kind: "stage"; choice: StageChoice } | { kind: "hazards" } | { kind: "drops" } | { kind: "start" } | { kind: "back" } | { kind: "poolOpen" } | { kind: "poolClose" } | { kind: "poolMode" } | { kind: "poolStage"; choice: number };

export const HAZARDS_BUTTON = { x: f32(0.225), y: f32(0.082), width: f32(0.19), height: f32(0.037) } as const;
export const DROPS_BUTTON = { x: f32(0.42), y: f32(0.082), width: f32(0.12), height: f32(0.037) } as const;


function stageText(parent: framehandle, name: string, x: number, y: number, width: number, height: number, fontSize: number, text: string): framehandle {
  const label = createText(name, parent, 0);
  placeTopLeft(label, x, y);
  BlzFrameSetSize(label, width, height);
  setFrameText(label, text);
  BlzFrameSetEnable(label, false);
  BlzFrameSetFont(label, MENU_FONT, fontSize, 0);
  BlzFrameSetTextAlignment(label, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
  return label;
}

function stageButton(parent: framehandle, x: number, y: number, width: number, height: number, text: string): framehandle {
  const control = BlzCreateFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(control, x, y);
  BlzFrameSetSize(control, width, height);
  setFrameText(control, text);
  return control;
}

export class StagePanel {
  private readonly root: framehandle;
  private readonly backdrop: framehandle;
  private readonly preview: StageCard;
  private readonly previewName: framehandle;
  private readonly previewDescription: framehandle;
  private readonly ruleLabel: framehandle;
  private readonly chip: framehandle;
  private readonly hazardsToggle: framehandle;
  private readonly dropsToggle: framehandle;
  private readonly clicks: ButtonClicks<StageButton>;
  private readonly tileNames: framehandle[] = [];
  private readonly sync: trigger;
  private readonly poolRoot: framehandle;
  private readonly poolMode: framehandle;
  private readonly poolSummary: framehandle;
  private readonly poolStages: readonly framehandle[];
  private poolOpen = false;
  private readonly drag = stageDrag();
  private lastPhase: Phase | undefined;
  private lastChoice: number | undefined;
  private lastRules: string | undefined;
  private lastHazards: boolean | undefined;
  private lastDrops: boolean | undefined;

  constructor(
    private actions: StageActions,
    controls: MenuControls,
  ) {
    const journal = controls === "journal";
    this.clicks = new ButtonClicks("ui.stage.click", (button, clicker) => this.click(button, GetPlayerId(clicker)), button => this.highlightStage(button?.kind === "stage" ? button.choice : undefined));
    const root = BlzCreateFrameByType("FRAME", "MeleeStageRoot", gameUi(), "", 0);
    this.root = root;
    this.backdrop = createBackdrop("MeleeStageBackdrop", consoleUi(), 800);
    BlzFrameSetTexture(this.backdrop, "war3mapImported\\StageBackdrop.tga", 0, false);
    coverScreen(this.backdrop);
    this.ruleLabel = stageText(root, "MeleeStageRules", f32(0.41), f32(0.575), f32(0.35), f32(0.025), f32(0.012), "");
    this.preview = new StageCard(root, "MeleeStagePreview", f32(0.042), f32(0.445), f32(0.372), 0.25, false);
    this.previewName = stageText(root, "MeleeStagePreviewName", f32(0.045), f32(0.19), f32(0.37), f32(0.036), f32(0.022), "");
    this.previewDescription = stageText(root, "MeleeStageDescription", f32(0.045), f32(0.148), f32(0.36), f32(0.05), f32(0.011), "");
    stageText(root, "MeleeStageGridTitle", f32(0.454), f32(0.48), f32(0.3), f32(0.022), f32(0.012), "CHOOSE A STAGE");
    for (const stage of STAGE_CHOICES) {
      const choice = stage.id;
      const button = BlzCreateFrameByType("BUTTON", `MeleeStageTileButton${I2S(choice)}`, root, "", 0);
      placeTopLeft(button, stageTileLeft(choice), stageTileTop(choice));
      BlzFrameSetSize(button, f32(0.094), choice === RANDOM_STAGE ? f32(0.08) : f32(0.059));
      this.clicks.add(button, { kind: "stage", choice });
      if (choice !== RANDOM_STAGE) {
        new StageCard(root, `MeleeStageTile${I2S(choice)}`, stageTileLeft(choice), stageTileTop(choice), f32(0.094), f32(0.059), true).show(choice);
        this.tileNames[choice] = BlzGetFrameByName(`MeleeStageTile${I2S(choice)}Name`, 0);
        setFrameText(this.tileNames[choice], stage.name);
        continue;
      }
      const tile = createBackdrop(`MeleeStageTile${I2S(choice)}`, root, choice);
      BlzFrameSetTexture(tile, stageInfo(choice).texture, 0, true);
      placeTopLeft(tile, stageTileLeft(choice), stageTileTop(choice));
      BlzFrameSetSize(tile, f32(0.094), f32(0.059));
      BlzFrameSetEnable(tile, false);
      this.tileNames[choice] = stageText(root, `MeleeStageTileName${I2S(choice)}`, stageTileLeft(choice), f32(stageTileTop(choice) - f32(0.06)), f32(0.094), f32(0.02), f32(0.009), stageInfo(choice).name);
    }
    this.clicks.add(stageButton(root, f32(0.454), f32(0.514), f32(0.3), f32(0.027), "Stage pool"), { kind: "poolOpen" });
    this.poolRoot = BlzCreateFrameByType("FRAME", "MeleeStagePoolRoot", root, "", 0);
    BlzFrameSetLevel(this.poolRoot, 30);
    const poolBackdrop = createBackdrop("MeleeStagePoolBackdrop", this.poolRoot, 0);
    BlzFrameSetTexture(poolBackdrop, PANEL_TEXTURE, 0, true);
    placeTopLeft(poolBackdrop, f32(0.1), f32(0.49));
    BlzFrameSetSize(poolBackdrop, f32(0.6), f32(0.35));
    stageText(this.poolRoot, "MeleeStagePoolTitle", f32(0.14), f32(0.47), f32(0.4), f32(0.025), f32(0.016), "Stage pool");
    this.clicks.add(stageButton(this.poolRoot, f32(0.575), f32(0.47), f32(0.085), f32(0.027), "Done"), { kind: "poolClose" });
    this.poolMode = this.clicks.add(stageButton(this.poolRoot, f32(0.14), f32(0.425), f32(0.52), f32(0.027), ""), { kind: "poolMode" });
    stageText(this.poolRoot, "MeleeStagePoolHelp", f32(0.14), f32(0.385), f32(0.52), f32(0.028), f32(0.009), "Choose stages for random matches.\nKeep at least one stage in the pool.");
    this.poolStages = STAGE_CATALOG.map((stage, index) => this.clicks.add(
      stageButton(this.poolRoot, f32(f32(0.14) + floorMod(index, 3) * f32(0.18)), f32(f32(0.34) - floorDiv(index, 3) * f32(0.045)), f32(0.16), f32(0.032), ""),
      { kind: "poolStage", choice: stage.id },
    ));
    this.poolSummary = stageText(this.poolRoot, "MeleeStagePoolSummary", f32(0.14), f32(0.2), f32(0.52), f32(0.042), f32(0.009), "");
    BlzFrameSetVisible(this.poolRoot, false);
    this.chip = createBackdrop("MeleeStageChip", root, 0);
    BlzFrameSetTexture(this.chip, "war3mapImported\\StageChip.tga", 0, true);
    BlzFrameSetSize(this.chip, f32(0.04), f32(0.04));
    BlzFrameSetEnable(this.chip, false);
    const help = journal
      ? "Click a stage or move the stick.\nAny player can choose.\nA or Start: start · X: back"
      : "Click a stage or move the chip.\nAny player can choose.\nMovement controls: change stage · Y: start";
    stageText(root, "MeleeStageHelp", f32(0.454), f32(0.119), f32(0.3), f32(0.025), f32(0.008), help);
    const startButton = this.clicks.add(stageButton(root, f32(0.545), f32(0.092), f32(0.21), f32(0.048), journal ? "START MATCH [A]" : "START MATCH"), { kind: "start" });
    BlzFrameSetLevel(startButton, 1);
    this.clicks.add(stageButton(root, f32(0.045), f32(0.082), f32(0.17), f32(0.037), journal ? "BACK [X]" : "BACK TO FIGHTERS"), { kind: "back" });
    this.hazardsToggle = stageButton(root, HAZARDS_BUTTON.x, HAZARDS_BUTTON.y, HAZARDS_BUTTON.width, HAZARDS_BUTTON.height, "");
    this.clicks.add(this.hazardsToggle, { kind: "hazards" });
    this.dropsToggle = stageButton(root, DROPS_BUTTON.x, DROPS_BUTTON.y, DROPS_BUTTON.width, DROPS_BUTTON.height, "");
    this.clicks.add(this.dropsToggle, { kind: "drops" });
    this.sync = createSyncTrigger("ui.stage.drop", "stage-drop", PARTICIPANT_SLOTS, (sender, data) => {
      const choice = S2I(data);
      if (I2S(choice) === data && selectableStageChoice(choice)) this.actions.selectStage(sender, choice);
    });
    BlzFrameSetVisible(root, false);
    BlzFrameSetVisible(this.backdrop, false);
  }

  bindActions(actions: StageActions): void {
    this.actions = actions;
    bindPrototype(this.clicks, ButtonClicks.prototype);
    bindPrototype(this.preview, StageCard.prototype);
    this.clicks.bindHandler((button, clicker) => this.click(button, GetPlayerId(clicker)), button => this.highlightStage(button?.kind === "stage" ? button.choice : undefined));
    bindSyncHandler("ui.stage.drop", (sender, data) => {
      const choice = S2I(data);
      if (I2S(choice) === data && selectableStageChoice(choice)) this.actions.selectStage(sender, choice);
    });
  }

  destroy(): void {
    this.clicks.destroy();
    DestroyTrigger(this.sync);
    BlzDestroyFrame(this.root);
    BlzDestroyFrame(this.backdrop);
  }

  private highlightStage(choice: number | undefined): void {
    for (const stage of STAGE_CHOICES) {
      const name = this.tileNames[stage.id];
      if (name !== undefined) highlightText(name, stage.id === choice);
    }
  }

  private click(button: StageButton, actor: number): void {
    if (button.kind === "stage") this.actions.selectStage(actor, button.choice);
    else if (button.kind === "start") this.actions.start(actor);
    else if (button.kind === "hazards") this.actions.toggleHazards(actor);
    else if (button.kind === "drops") this.actions.toggleDrops(actor);
    else if (button.kind === "back") this.actions.back(actor);
    else if (button.kind === "poolOpen") this.poolOpen = true;
    else if (button.kind === "poolClose") this.poolOpen = false;
    else if (button.kind === "poolMode") this.actions.togglePoolMode(actor);
    else this.actions.togglePoolStage(actor, button.choice);

  }


  update(game: Readonly<MatchState>): void {
    const enabled = game.phase === Phase.stageMenu && humanActive(game, GetPlayerId(GetLocalPlayer()));
    if (this.lastPhase !== game.phase) {
      BlzFrameSetVisible(this.root, enabled);
      BlzFrameSetVisible(this.backdrop, enabled);
      this.lastPhase = game.phase;
    }
    if (!enabled) {
      clearStageDrag(this.drag);
      this.poolOpen = false;
      BlzFrameSetVisible(this.poolRoot, false);
      return;
    }
    if (this.lastChoice !== game.stageChoice) {
      const stage = stageInfo(game.stageChoice);
      this.preview.show(game.stageChoice);
      setFrameText(this.previewName, stage.name);
      setFrameText(this.previewDescription, stage.description);
      this.lastChoice = game.stageChoice;
    }
    if (this.lastHazards !== game.hazards) {
      setFrameText(this.hazardsToggle, hazardsSetting(game.hazards));
      this.lastHazards = game.hazards;
    }
    if (this.lastDrops !== game.drops.on) {
      setFrameText(this.dropsToggle, dropsSetting(game.drops.on));
      this.lastDrops = game.drops.on;
    }
    const rules = rulesSummary(game);
    if (this.lastRules !== rules) {
      setFrameText(this.ruleLabel, rules);
      this.lastRules = rules;
    }
    BlzFrameSetVisible(this.poolRoot, this.poolOpen);
    BlzFrameSetVisible(this.chip, !this.poolOpen);
    if (this.poolOpen) {
      clearStageDrag(this.drag);
      const pool = game.stagePool;
      const count = stagePoolCount(pool);
      setFrameText(this.poolMode, pool.only ? "Only these" : "All except these");
      for (let index = 0; index < STAGE_CATALOG.length; index++) {
        const stage = STAGE_CATALOG[index];
        const frame = this.poolStages[index];
        if (stage === undefined || frame === undefined) continue;
        const selected = (pool.selectedMask & (1 << stage.id)) !== 0;
        setFrameText(frame, `${selected ? "Yes" : "No"}: ${stage.name}`);
        BlzFrameSetEnable(frame, count > 1 || !stageInPool(pool, stage.id));
      }
      setFrameText(this.poolSummary, `${I2S(count)} ${count === 1 ? "stage" : "stages"} in the pool.\nEach plays once before the pool repeats.`);
      this.clicks.refreshHover();
      return;
    }
    let x = stageTileLeft(game.stageChoice) + f32(0.047);
    let y = f32(stageTileTop(game.stageChoice) - f32(0.0295));
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
    this.clicks.refreshHover();
  }
}
