import { nextMatchCharacter, selectableMatchCharacter } from "../match/rules";
import { RULE_BUTTONS, RULE_HEIGHT, type RuleBox, type TrainingSetting, cpuSettingsBox } from "./ruleButtons";
import { RULE_HELP_HEIGHT, RULE_HELP_WIDTH, hoveredRule, ruleHelp, visibleRuleGroups } from "./ruleHelp";





import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { Action } from "../input/actions";
import { type KeyBindings, keyFor, keyLabel } from "../input/keyBindings";
import { CPU_OPPONENT_COPY } from "./cpuOpponentCopy";
import { createOpponentSettings } from "./opponentSettingsFrames";
import { CPU_OPPONENT_DEFAULT, CPU_TIER_DEFAULT } from "../match/cpuProfiles";
import { bindPrototype } from "../../platform/rebind";
import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS } from "../input/participants";
import {
  type MatchState,
  Phase,
  allCharactersReady,
  canChooseComputer,
  canCycleSlotMode,
  characterFor,
  characterReady,
  fighterActive,
  fighterMask,
  hasUnassignedHuman,
  humanActive,
  humanFighterActive,
  humanPresent,
} from "../match/rules";
import { pointerX, pointerY } from "../menu/pointer";
import {
  type Placement,
  type Roster,
  type RosterChip,
  type RosterTile,
  cardX,
  HAND_SIZE,
  carriedChipLeft,
  carriedChipTop,
  chipX,
  chipY,
  handLeft,
  handTop,
  clearSelectionDrag,
  decodeCpuPlacement,
  placeHovered,
  selectionDrag,
  updateSelectionDrag,
} from "../menu/selectionDrag";
import { cellRect, rosterGrid } from "../menu/selectionGrid";
import { MENU_FONT, type TextBox } from "./hudLayout";
import { MOVES_BODY_BOX, MOVES_BUTTON_HEIGHT, MOVES_BUTTON_TOP, MOVES_TITLE_BOX, selectionTitleBox } from "./selectionLayout";
import { PLAYABLE_CHARACTERS, fighterName, fighterPortrait, nextSelectableCharacter } from "../sim/heroes/registry";
import {
  MOVES_HEADER, itemsSetting, ultimatesSetting, itemKindSetting, automaticRematchSetting, movesPage, selectionModeLabel, endlessSetting, hitAreasSetting, partnerBehaviourSetting, partnerDamageSetting, partnerEscapeSetting,
  partnerTechSetting, stockSetting, timeSetting, modeSetting, trainingSpeedSetting,
} from "../shell/messages";
import { classicRouteSummary, classicTierSetting } from "../classic/classicText";
import { loreBattle, loreBattleSetting, loreBattleSummary } from "../classic/loreBattles";
import { loreClears } from "../classic/loreClears";
import { Character, ItemKind, itemBit } from "../sim/codes";
import { TILE_PORTRAIT_SLOT, cardPortrait, tilePortrait } from "./portraitFrames";
import { slotColor } from "./slotColors";
import { type TutorialButton, type TutorialMenuFrames, createTutorialMenu, markTutorialSeen, showTutorialLesson, tutorialSeen } from "./tutorialMenu";
import { ButtonClicks, type MenuControls, bindSyncHandler, consoleUi, coverScreen, createBackdrop, createSyncTrigger, createText, gameUi, placeTopLeft } from "./frames";


export interface SelectionActions {
  selectChoice(participantId: number, choice: RosterTile): void;
  selectCpuChoice(participantId: number, cpu: number, choice: RosterTile): void;
  cycleMode(actorId: number, fighterSlot: number): void;
  recallChoice(actorId: number, chipSlot: number): void;
  openSettings(participantId: number): void;
  start(participantId: number): void;
  changeStocks(participantId: number, direction: -1 | 1): void;
  changeTime(participantId: number, direction: -1 | 1): void;
  toggleEndless(participantId: number): void;
  toggleAutomaticRematch(participantId: number): void;
  toggleItems(participantId: number): void;
  toggleUltimates(participantId: number): void;
  toggleItemKind(participantId: number, kind: ItemKind): void;
  cycleMatchMode(participantId: number): void;
  stepClassicTier(participantId: number, direction: -1 | 1): void;
  stepTraining(participantId: number, setting: TrainingSetting, direction: -1 | 1): void;
  toggleHitAreas(participantId: number): void;
  stepSpeed(participantId: number): void;
  changeCpuOpponent(actorId: number, cpuSlot: number, direction: -1 | 1): void;
  changeCpuTier(actorId: number, cpuSlot: number, direction: -1 | 1): void;
  stepTutorial(participantId: number, direction: -1 | 1): void;
  startTutorial(participantId: number): void;
  closeTutorial(participantId: number): void;
}

type RuleButton = { kind: "stocks"; direction: -1 | 1 } | { kind: "time"; direction: -1 | 1 } | { kind: "endless" } | { kind: "automaticRematch" }
  | { kind: "items" } | { kind: "ultimates" } | { kind: "itemKind"; item: ItemKind } | { kind: "training" } | { kind: "partner"; setting: TrainingSetting; direction: -1 | 1 } | { kind: "hitAreas" } | { kind: "speed" }
  | { kind: "classicTier"; direction: -1 | 1 };
type SelectionButton = { kind: "mode"; slot: number } | { kind: "cpuSettings"; slot: number } | { kind: "cpuStep"; row: 0 | 1; direction: -1 | 1 } | { kind: "cpuClose" } | { kind: "start" } | { kind: "settings" } | RuleButton
  | { kind: "moves" } | { kind: "movesBack" } | { kind: "movesStep"; direction: -1 | 1 } | TutorialButton;

type MenuFocus = { readonly kind: "fighter" | "settings"; readonly slot: number };
const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
function cpuCardSummary(game: Readonly<MatchState>, slot: number): string {
  return `${titleCase(game.cpuOpponents[slot] ?? CPU_OPPONENT_DEFAULT)}\n${titleCase(game.cpuTiers[slot] ?? CPU_TIER_DEFAULT)}`;
}


interface CardFrames {
  readonly card: framehandle;
  readonly tag: framehandle;
  readonly mode: framehandle;
  readonly portrait: framehandle;
  readonly name: framehandle;
  readonly status: framehandle;
  readonly chip: framehandle;
  readonly summary: framehandle;
  readonly settings: framehandle;
}

const portraitTexture = (choice: number | undefined, tile: boolean, slot?: number) => fighterPortrait(choice ?? Character.rifleman, tile ? "Tile" : "Card", slot);
const nameText = (choice: number | undefined) => fighterName(choice ?? Character.rifleman);

function art(parent: framehandle, name: string, texture: string, x: number, y: number, width: number, height: number): framehandle {
  const frame = createBackdrop(name, parent, 0);
  BlzFrameSetTexture(frame, texture, 0, true);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetEnable(frame, false);
  return frame;
}

function label(parent: framehandle, name: string, x: number, y: number, width: number, height: number, size: number): framehandle {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetFont(frame, MENU_FONT, size, 0);
  BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
  BlzFrameSetEnable(frame, false);
  return frame;
}


function hotspot(parent: framehandle, x: number, y: number, width: number, height: number): framehandle {
  const frame = BlzCreateFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetAlpha(frame, 0);
  return frame;
}


const characterOfTile = (tile: RosterTile): number => PLAYABLE_CHARACTERS[tile] ?? Character.rifleman;
function tileOfCharacter(character: number): RosterTile {
  for (let tile = 0; tile < PLAYABLE_CHARACTERS.length; tile++) if (PLAYABLE_CHARACTERS[tile] === character) return tile;
  return 0;
}

const decodeTile = (data: string): RosterTile | undefined => {
  const tile = S2I(data);
  return I2S(tile) === data && tile >= 0 && tile < PLAYABLE_CHARACTERS.length ? tile : undefined;
};
const decodeSlot = (data: string): number | undefined => (data === "0" ? 0 : data === "1" ? 1 : data === "2" ? 2 : data === "3" ? 3 : undefined);

export class SelectionPanel {
  private readonly tiles: framehandle[][] = [];
  private readonly root: framehandle;
  private readonly backdrop: framehandle;
  private readonly confirm: framehandle;
  private readonly cards: readonly CardFrames[];
  private readonly clicks: ButtonClicks<SelectionButton>;
  private readonly syncTriggers: readonly trigger[];
  private readonly drag = selectionDrag();
  private readonly hand: framehandle;
  private cursorHidden = false;

  private readonly chips: RosterChip[] = PARTICIPANT_SLOTS.map(() => ({ choice: 0, placed: false }));
  private readonly roster: Roster = { grid: rosterGrid(PLAYABLE_CHARACTERS.length), selectable: 0, chips: this.chips };

  private game: Readonly<MatchState> | undefined;
  private settingsOpen = false;

  private movesOpen = false;
  private movesCharacter: number = Character.rifleman;
  private shownMoves = -1;
  private readonly movesFrames: readonly framehandle[];
  private readonly movesTitle: framehandle;
  private readonly movesBody: framehandle;
  private readonly delayLine: framehandle;
  private shownDelay = "";

  private readonly modeLabel: framehandle;
  private shownMode = "";
  private readonly stockValue: framehandle;
  private readonly timeValue: framehandle;
  private readonly endlessToggle: framehandle;
  private readonly rematchToggle: framehandle;
  private readonly itemsToggle: framehandle;
  private readonly ultimatesToggle: framehandle;
  private readonly itemToggles: readonly framehandle[];
  private readonly trainingToggle: framehandle;
  private readonly hitAreasToggle: framehandle;
  private readonly speedToggle: framehandle;

  private readonly partnerValues: readonly framehandle[];

  private readonly matchRuleFrames: readonly framehandle[];
  private readonly trainingFrames: readonly framehandle[];

  private readonly classicFrames: readonly framehandle[];
  private readonly classicTierValue: framehandle;
  private readonly classicRoute: framehandle;

  private readonly steps: readonly framehandle[];

  private shownRules: string | undefined;
  private readonly help: framehandle;
  private readonly helpText: framehandle;
  private shownHelp: string | undefined;
  private cpuSlot: number | undefined;
  private cpuFocus: 0 | 1 | 2 = 0;
  private menuFocus: MenuFocus | undefined;
  private readonly cpuRoot: framehandle;
  private readonly cpuTitle: framehandle;
  private readonly cpuValues: readonly framehandle[];
  private readonly cpuPreview: framehandle;
  private readonly cpuPrompt: framehandle;
  private readonly cpuDone: framehandle;
  private readonly cpuSteps: framehandle[] = [];
  private menuPrompt = "";
  private readonly tutorial: TutorialMenuFrames;

  private tutorialOpen = false;
  private tutorialOffered = false;

  private seen: boolean | undefined;

  constructor(
    private actions: SelectionActions,
    readonly participantId: number,
    private readonly controls: MenuControls,
  ) {
    const suffix = I2S(participantId);
    this.clicks = new ButtonClicks(`ui.selection.${suffix}.click`, (button, clicker) => this.click(button, clicker));
    const root = BlzCreateFrameByType("FRAME", `MeleeSelectRoot${suffix}`, gameUi(), "", 0);
    this.root = root;
    this.backdrop = createBackdrop(`MeleeSelectBackdrop${suffix}`, consoleUi(), 400 + participantId);
    BlzFrameSetTexture(this.backdrop, "war3mapImported\\SelectionBackdrop.tga", 0, false);
    coverScreen(this.backdrop);
    BlzFrameSetText(label(root, `MeleeGameTitle${suffix}`, f32(0.055), f32(0.589), f32(0.285), f32(0.029), f32(0.024)), "Smashcraft");
    art(root, `MeleeModeArt${suffix}`, "war3mapImported\\SelectionAction.tga", f32(0.05), f32(0.555), f32(0.295), f32(0.032));
    const grid = this.roster.grid;
    const scale = f32(grid.scale);
    for (let choice = 0; choice < grid.count; choice++) {
      const { left, top } = cellRect(grid, choice);
      const x = f32(left);
      const y = f32(top);
      const name = `${suffix}_${I2S(choice)}`;
      const tileFrame = art(root, `MeleeTile${name}`, "war3mapImported\\SelectionTileFrame.tga", x, y, f32(grid.cellWidth), f32(grid.cellHeight));
      const portrait = tilePortrait(scale);
      const inset = (TILE_PORTRAIT_SLOT * scale - portrait) / 2;
      const tilePortraitFrame = art(root, `MeleeTilePortrait${name}`, portraitTexture(PLAYABLE_CHARACTERS[choice], true), x + f32(0.0125) * scale + inset, y - f32(0.013) * scale - inset, portrait, portrait);
      const tileName = label(root, `MeleeTileName${name}`, x + f32(0.004) * scale, y - f32(0.108) * scale, f32(0.103) * scale, f32(0.018) * scale, f32(0.0078) * scale);
      BlzFrameSetText(tileName, nameText(PLAYABLE_CHARACTERS[choice]));
      this.tiles.push([tileFrame, tilePortraitFrame, tileName]);
    }
    this.cards = PARTICIPANT_SLOTS.map((slot) => {
      const x = cardX(slot);
      const name = `${suffix}_${I2S(slot)}`;
      const card = art(root, `MeleeCard${name}`, "war3mapImported\\SelectionCardGray.tga", x, f32(0.275), f32(0.16), f32(0.22));
      const tag = label(root, `MeleeTag${name}`, x + f32(0.014), f32(0.267), f32(0.132), f32(0.019), f32(0.01));
      const mode = this.clicks.add(hotspot(root, x + f32(0.014), f32(0.27), f32(0.132), f32(0.027)), { kind: "mode", slot });
      BlzFrameSetLevel(mode, 1);
      BlzFrameSetLevel(tag, 2);
      const portrait = art(root, `MeleePortrait${name}`, portraitTexture(Character.demonHunter, false, slot), x + f32(0.029), f32(0.245), f32(0.102), f32(0.102));
      const name_ = label(root, `MeleeName${name}`, x + f32(0.008), f32(0.102), f32(0.144), f32(0.019), f32(0.011));
      const status = label(root, `MeleeStatus${name}`, x + f32(0.014), f32(0.077), f32(0.132), f32(0.014), f32(0.011));
      const chip = art(root, `MeleeChip${name}`, `war3mapImported\\SelectionChipP${I2S(slot + 1)}.tga`, x + f32(0.06), f32(0.2), f32(0.06), f32(0.06));
      BlzFrameSetLevel(chip, 10);
      const box = cpuSettingsBox(slot);
      const settings = BlzCreateFrame("ScriptDialogButton", root, 0, 0);
      placeTopLeft(settings, box.x, box.y);
      BlzFrameSetSize(settings, box.width, box.height);
      BlzFrameSetText(settings, "Opponent settings");
      this.clicks.add(settings, { kind: "cpuSettings", slot });
      const summary = label(root, `MeleeCpuSummary${name}`, x + f32(0.004), f32(0.139), f32(0.152), f32(0.031), f32(0.009));
      return { card, tag, mode, portrait, name: name_, status, chip, summary, settings };
    });
    this.hand = art(root, `MeleeHand${suffix}`, "war3mapImported\\SelectionHandPinch.tga", 0.0, 0.0, HAND_SIZE, HAND_SIZE);
    BlzFrameSetLevel(this.hand, 20);
    BlzFrameSetVisible(this.hand, false);
    art(root, `MeleeConfirmArt${suffix}`, "war3mapImported\\SelectionAction.tga", f32(0.071), f32(0.043), f32(0.235), f32(0.037));
    this.confirm = label(root, `MeleeConfirmLabel${suffix}`, f32(0.079), f32(0.039), f32(0.219), f32(0.028), f32(0.011));
    this.clicks.add(hotspot(root, f32(0.071), f32(0.043), f32(0.235), f32(0.037)), { kind: "start" });
    art(root, `MeleeSettingsArt${suffix}`, "war3mapImported\\SelectionAction.tga", f32(0.51), f32(0.043), f32(0.235), f32(0.037));
    const settingsLabel = label(root, `MeleeSettingsLabel${suffix}`, f32(0.518), f32(0.039), f32(0.219), f32(0.028), f32(0.011));
    BlzFrameSetText(settingsLabel, "Controls (F1)");
    this.delayLine = label(root, `MeleeDelayLine${suffix}`, f32(0.36), f32(0.6), f32(0.42), f32(0.03), f32(0.010));
    BlzFrameSetTextAlignment(this.delayLine, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_RIGHT);
    this.clicks.add(hotspot(root, f32(0.51), f32(0.043), f32(0.235), f32(0.037)), { kind: "settings" });
    art(root, `MeleeMovesArt${suffix}`, "war3mapImported\\SelectionAction.tga", f32(0.318), f32(0.043), f32(0.18), f32(0.037));
    BlzFrameSetText(label(root, `MeleeMovesLabel${suffix}`, f32(0.324), f32(0.039), f32(0.168), f32(0.028), f32(0.011)), "Moves");
    this.clicks.add(hotspot(root, f32(0.318), f32(0.043), f32(0.18), f32(0.037)), { kind: "moves" });
    const page = (frame: framehandle, x: number, y: number, width: number, height: number) => {
      placeTopLeft(frame, x, y);
      BlzFrameSetSize(frame, width, height);
      BlzFrameSetVisible(frame, false);
      return frame;
    };
    const at = (frame: framehandle, box: TextBox) => page(frame, box.left, box.top, box.width, box.height);
    this.movesTitle = at(createText(`MeleeMovesTitle${suffix}`, gameUi(), 470 + participantId), MOVES_TITLE_BOX);
    BlzFrameSetFont(this.movesTitle, MENU_FONT, f32(0.016), 0);
    BlzFrameSetTextAlignment(this.movesTitle, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
    this.movesBody = at(createText(`MeleeMovesBody${suffix}`, gameUi(), 474 + participantId), MOVES_BODY_BOX);
    BlzFrameSetFont(this.movesBody, MENU_FONT, f32(0.012), 0);
    BlzFrameSetTextAlignment(this.movesBody, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
    const pageButton = (name: string, x: number, width: number, text: string, target: SelectionButton) => {
      const frame = page(BlzCreateFrameByType("GLUETEXTBUTTON", name, gameUi(), "ScriptDialogButton", 0), x, MOVES_BUTTON_TOP, width, MOVES_BUTTON_HEIGHT);
      BlzFrameSetText(frame, text);
      return this.clicks.add(frame, target);
    };
    const height = BlzGetLocalClientHeight();
    const titleBox = selectionTitleBox(height <= 0 ? f32(4.0 / 3.0) : I2R(BlzGetLocalClientWidth()) / I2R(height));
    this.modeLabel = page(createText(`MeleeModeLabel${suffix}`, gameUi(), 478 + participantId), titleBox.left, titleBox.top, titleBox.width, titleBox.height);
    BlzFrameSetFont(this.modeLabel, MENU_FONT, f32(0.022), 0);
    BlzFrameSetTextAlignment(this.modeLabel, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.modeLabel, false);
    this.movesFrames = [
      this.movesTitle, this.movesBody,
      pageButton(`MeleeMovesPrevious${suffix}`, f32(0.2), f32(0.1), "<", { kind: "movesStep", direction: -1 }),
      pageButton(`MeleeMovesBack${suffix}`, f32(0.33), f32(0.14), "Back", { kind: "movesBack" }),
      pageButton(`MeleeMovesNext${suffix}`, f32(0.5), f32(0.1), ">", { kind: "movesStep", direction: 1 }),
    ];

    const cpu = createOpponentSettings(gameUi(), participantId);
    if (cpu === undefined) throw new Error("the Opponent settings frames did not load");
    this.cpuRoot = cpu.root;
    this.cpuTitle = cpu.title;
    const cpuButton = (frame: framehandle, button: SelectionButton) => {
      if (button.kind === "cpuStep") this.cpuSteps.push(frame);
      return this.clicks.add(frame, button);
    };
    cpuButton(cpu.close, { kind: "cpuClose" });
    cpuButton(cpu.opponentPrevious, { kind: "cpuStep", row: 0, direction: -1 });
    cpuButton(cpu.opponentNext, { kind: "cpuStep", row: 0, direction: 1 });
    cpuButton(cpu.difficultyPrevious, { kind: "cpuStep", row: 1, direction: -1 });
    cpuButton(cpu.difficultyNext, { kind: "cpuStep", row: 1, direction: 1 });
    this.cpuValues = [cpu.opponentValue, cpu.difficultyValue];
    this.cpuPreview = cpu.preview;
    this.cpuDone = cpuButton(cpu.done, { kind: "cpuClose" });
    this.cpuPrompt = cpu.prompt;
    BlzFrameSetVisible(this.cpuRoot, false);
    const ruleButton = (box: RuleBox, target: RuleButton, text: string) => {
      const frame = BlzCreateFrame("ScriptDialogButton", root, 0, 0);
      placeTopLeft(frame, box.x, box.y);
      BlzFrameSetSize(frame, box.width, box.height);
      BlzFrameSetText(frame, text);
      return this.clicks.add(frame, target);
    };
    const { fewerStocks, moreStocks, lessTime, moreTime, endless, automaticRematch } = RULE_BUTTONS;
    this.steps = [
      ruleButton(fewerStocks, { kind: "stocks", direction: -1 }, "−"),
      ruleButton(moreStocks, { kind: "stocks", direction: 1 }, "+"),
      ruleButton(lessTime, { kind: "time", direction: -1 }, "−"),
      ruleButton(moreTime, { kind: "time", direction: 1 }, "+"),
    ];
    const valueX = fewerStocks.x + fewerStocks.width;
    const valueWidth = moreStocks.x - valueX;
    this.stockValue = label(root, `MeleeRulesStocks${suffix}`, valueX, fewerStocks.y, valueWidth, RULE_HEIGHT, f32(0.011));
    this.timeValue = label(root, `MeleeRulesTime${suffix}`, lessTime.x + lessTime.width, lessTime.y, moreTime.x - lessTime.x - lessTime.width, RULE_HEIGHT, f32(0.011));
    this.endlessToggle = ruleButton(endless, { kind: "endless" }, "");
    this.rematchToggle = ruleButton(automaticRematch, { kind: "automaticRematch" }, "");
    this.itemsToggle = ruleButton(RULE_BUTTONS.items, { kind: "items" }, "");
    this.ultimatesToggle = ruleButton(RULE_BUTTONS.ultimates, { kind: "ultimates" }, "");
    this.itemToggles = [
      ruleButton(RULE_BUTTONS.itemSpeed, { kind: "itemKind", item: ItemKind.speed }, ""),
      ruleButton(RULE_BUTTONS.itemHeavy, { kind: "itemKind", item: ItemKind.heavy }, ""),
    ];
    this.trainingToggle = ruleButton(RULE_BUTTONS.training, { kind: "training" }, "");
    this.hitAreasToggle = ruleButton(RULE_BUTTONS.hitAreas, { kind: "hitAreas" }, "");
    this.speedToggle = ruleButton(RULE_BUTTONS.speed, { kind: "speed" }, "");
    const partnerRows: readonly (readonly [TrainingSetting, RuleBox, RuleBox])[] = [
      ["behaviour", RULE_BUTTONS.lessBehaviour, RULE_BUTTONS.moreBehaviour],
      ["escape", RULE_BUTTONS.lessEscape, RULE_BUTTONS.moreEscape],
      ["tech", RULE_BUTTONS.lessTech, RULE_BUTTONS.moreTech],
      ["damage", RULE_BUTTONS.lessDamage, RULE_BUTTONS.moreDamage],
    ];
    const partnerFrames: framehandle[] = [this.hitAreasToggle, this.speedToggle];
    this.partnerValues = partnerRows.map(([setting, less, more]) => {
      partnerFrames.push(ruleButton(less, { kind: "partner", setting, direction: -1 }, "−"), ruleButton(more, { kind: "partner", setting, direction: 1 }, "+"));
      const value = label(root, `MeleeTraining${setting}${suffix}`, less.x + less.width, less.y, more.x - less.x - less.width, RULE_HEIGHT, f32(0.009));
      partnerFrames.push(value);
      return value;
    });
    this.tutorial = createTutorialMenu(gameUi(), root, suffix, (frame, target) => this.clicks.add(frame, target));
    partnerFrames.push(this.tutorial.open);
    this.trainingFrames = partnerFrames;
    const { easierClassic, harderClassic } = RULE_BUTTONS;
    this.classicTierValue = label(root, `MeleeClassicTier${suffix}`, easierClassic.x + easierClassic.width, easierClassic.y, harderClassic.x - easierClassic.x - easierClassic.width, RULE_HEIGHT, f32(0.011));
    this.classicRoute = label(root, `MeleeClassicRoute${suffix}`, f32(0.38), f32(0.553), f32(0.37), f32(0.034), f32(0.0085));
    this.classicFrames = [
      ruleButton(easierClassic, { kind: "classicTier", direction: -1 }, "−"),
      ruleButton(harderClassic, { kind: "classicTier", direction: 1 }, "+"),
      this.classicTierValue, this.classicRoute,
    ];
    this.matchRuleFrames = [...this.steps, this.stockValue, this.timeValue, this.endlessToggle, this.rematchToggle, this.itemsToggle, this.ultimatesToggle];
    this.help = createBackdrop(`MeleeRuleHelp${suffix}`, root, 0);
    BlzFrameSetTexture(this.help, "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp", 0, true);
    BlzFrameSetSize(this.help, RULE_HELP_WIDTH, RULE_HELP_HEIGHT);
    BlzFrameSetLevel(this.help, 20);
    BlzFrameSetEnable(this.help, false);
    this.helpText = createText(`MeleeRuleHelpText${suffix}`, this.help, 0);
    BlzFrameSetPoint(this.helpText, FRAMEPOINT_TOPLEFT, this.help, FRAMEPOINT_TOPLEFT, f32(0.008), f32(-0.006));
    BlzFrameSetPoint(this.helpText, FRAMEPOINT_BOTTOMRIGHT, this.help, FRAMEPOINT_BOTTOMRIGHT, f32(-0.008), f32(0.006));
    BlzFrameSetFont(this.helpText, MENU_FONT, f32(0.0095), 0);
    BlzFrameSetTextAlignment(this.helpText, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.helpText, false);
    BlzFrameSetVisible(this.help, false);
    const owner = [participantId];
    this.syncTriggers = [
      createSyncTrigger(`ui.selection.${suffix}.drop`, "fighter-drop", owner, (_, data) => this.acceptDrop(data)),
      createSyncTrigger(`ui.selection.${suffix}.cpuDrop`, "cpu-fighter-drop", owner, (_, data) => this.acceptCpuDrop(data)),
      createSyncTrigger(`ui.selection.${suffix}.recall`, "fighter-recall", owner, (_, data) => this.acceptRecall(data)),
    ];
    BlzFrameSetVisible(root, false);
    BlzFrameSetVisible(this.backdrop, false);
  }

  bindActions(actions: SelectionActions): void {
    this.actions = actions;
    bindPrototype(this.clicks, ButtonClicks.prototype);
    this.clicks.bindHandler((button, clicker) => this.click(button, clicker));
    const suffix = I2S(this.participantId);
    bindSyncHandler(`ui.selection.${suffix}.drop`, (_, data) => this.acceptDrop(data));
    bindSyncHandler(`ui.selection.${suffix}.cpuDrop`, (_, data) => this.acceptCpuDrop(data));
    bindSyncHandler(`ui.selection.${suffix}.recall`, (_, data) => this.acceptRecall(data));
  }

  destroy(): void {
    if (this.ownsLocalClient()) this.showHand(false, 0.0, 0.0);
    this.clicks.destroy();
    for (const trigger of this.syncTriggers) DestroyTrigger(trigger);
    for (const frame of this.movesFrames) BlzDestroyFrame(frame);
    BlzDestroyFrame(this.modeLabel);
    BlzDestroyFrame(this.tutorial.root);
    if (this.cpuRoot !== undefined) BlzDestroyFrame(this.cpuRoot);
    BlzDestroyFrame(this.root);
    BlzDestroyFrame(this.backdrop);
  }

  private click(button: SelectionButton, clicker: player): void {
    if (clicker !== Player(this.participantId)) return;
    if (this.cpuSlot !== undefined && button.kind !== "cpuStep" && button.kind !== "cpuClose") return;
    if (button.kind === "mode") this.actions.cycleMode(this.participantId, button.slot);
    else if (button.kind === "start") this.actions.start(this.participantId);
    else if (button.kind === "settings") this.actions.openSettings(this.participantId);
    else if (button.kind === "moves") this.openMoves();
    else if (button.kind === "movesBack") this.movesOpen = false;
    else if (button.kind === "movesStep") this.movesCharacter = nextSelectableCharacter(this.movesCharacter, button.direction);
    else if (button.kind === "stocks") this.actions.changeStocks(this.participantId, button.direction);
    else if (button.kind === "time") this.actions.changeTime(this.participantId, button.direction);
    else if (button.kind === "endless") this.actions.toggleEndless(this.participantId);
    else if (button.kind === "items") this.actions.toggleItems(this.participantId);
    else if (button.kind === "ultimates") this.actions.toggleUltimates(this.participantId);
    else if (button.kind === "itemKind") this.actions.toggleItemKind(this.participantId, button.item);
    else if (button.kind === "training") this.actions.cycleMatchMode(this.participantId);
    else if (button.kind === "classicTier") this.actions.stepClassicTier(this.participantId, button.direction);
    else if (button.kind === "partner") this.actions.stepTraining(this.participantId, button.setting, button.direction);
    else if (button.kind === "hitAreas") this.actions.toggleHitAreas(this.participantId);
    else if (button.kind === "speed") this.actions.stepSpeed(this.participantId);
    else if (button.kind === "cpuSettings") this.openCpuSettings(button.slot);
    else if (button.kind === "cpuStep") this.stepCpu(button.row, button.direction);
    else if (button.kind === "cpuClose") this.closeCpuSettings();
    else if (button.kind === "tutorialOpen") this.tutorialOpen = true;
    else if (button.kind === "tutorialStep") this.actions.stepTutorial(this.participantId, button.direction);
    else if (button.kind === "tutorialStart" || button.kind === "tutorialClose") {
      this.tutorialOpen = false;
      if (this.ownsLocalClient()) this.markSeen();
      if (button.kind === "tutorialStart") this.actions.startTutorial(this.participantId);
      else this.actions.closeTutorial(this.participantId);
    }
    else this.actions.toggleAutomaticRematch(this.participantId);
  }


  private choosing(): Readonly<MatchState> | undefined {
    const { game } = this;
    return game === undefined || game.phase !== Phase.characterMenu || this.settingsOpen || !humanActive(game, this.participantId) ? undefined : game;
  }

  private openCpuSettings(slot: number): void {
    const game = this.choosing();
    if (game === undefined || !fighterActive(game, slot) || humanFighterActive(game, slot)) return;
    this.cpuSlot = slot;
    this.cpuFocus = 0;
    this.menuFocus = { kind: "settings", slot };
    clearSelectionDrag(this.drag);
  }

  private closeCpuSettings(): void {
    this.cpuSlot = undefined;
    if (this.ownsLocalClient()) BlzFrameSetFocus(this.cpuDone, false);
  }

  private stepCpu(row: 0 | 1, direction: -1 | 1): void {
    const { game, cpuSlot } = this;
    if (game === undefined || cpuSlot === undefined || !canChooseComputer(game, this.participantId, cpuSlot)) return;
    this.cpuFocus = row;
    if (row === 0) this.actions.changeCpuOpponent(this.participantId, cpuSlot, direction);
    else this.actions.changeCpuTier(this.participantId, cpuSlot, direction);
  }


  consumeStart(): boolean {
    if (this.cpuSlot === undefined) return false;
    this.closeCpuSettings();
    return true;
  }

  cpuSettingsOpen(): boolean {
    return this.cpuSlot !== undefined;
  }


  hasCpuSettingsFrames(): boolean {
    return this.cpuRoot !== undefined && this.tutorial !== undefined;
  }


  menuAction(action: Action): boolean {
    const game = this.choosing();
    if (game === undefined) return false;
    const { cpuSlot } = this;
    if (cpuSlot !== undefined) {
      if (action === Action.special) this.closeCpuSettings();
      else if (action === Action.moveUp || action === Action.moveDown) {
        const next = floorMod(this.cpuFocus + (action === Action.moveUp ? -1 : 1), 3);
        this.cpuFocus = next === 0 ? 0 : next === 1 ? 1 : 2;
      }
      else if (action === Action.moveLeft || action === Action.moveRight) {
        if (this.cpuFocus !== 2) this.stepCpu(this.cpuFocus, action === Action.moveLeft ? -1 : 1);
      } else if (action === Action.attack) {
        if (this.cpuFocus === 2) this.closeCpuSettings();
        else this.cpuFocus = this.cpuFocus === 0 ? 1 : 2;
      }
      return true;
    }
    const focus: MenuFocus[] = [];
    if (humanFighterActive(game, this.participantId)) focus.push({ kind: "fighter", slot: this.participantId });
    for (const slot of PARTICIPANT_SLOTS) if (fighterActive(game, slot) && !humanFighterActive(game, slot)) {
      focus.push({ kind: "fighter", slot }, { kind: "settings", slot });
    }
    if (focus.length === 0) return false;
    let index = focus.findIndex(item => item.kind === this.menuFocus?.kind && item.slot === this.menuFocus.slot);
    if (index < 0) index = 0;
    if (action === Action.moveUp || action === Action.moveDown) {
      this.menuFocus = focus[floorMod(index + (action === Action.moveUp ? -1 : 1), focus.length)];
      return true;
    }
    const target = focus[index];
    if (target === undefined) return false;
    if (target.kind === "settings") {
      if (action === Action.attack) this.openCpuSettings(target.slot);
      return action === Action.attack || action === Action.moveLeft || action === Action.moveRight;
    }
    if (action === Action.moveLeft || action === Action.moveRight) {
      const choice = nextMatchCharacter(game, characterFor(game, target.slot), action === Action.moveLeft ? -1 : 1);
      if (target.slot === this.participantId) this.actions.selectChoice(this.participantId, choice);
      else this.actions.selectCpuChoice(this.participantId, target.slot, choice);
      return true;
    }
    if (action === Action.attack && this.menuFocus !== undefined) {
      const choice = characterFor(game, target.slot) ?? Character.rifleman;
      if (target.slot === this.participantId) this.actions.selectChoice(this.participantId, choice);
      else this.actions.selectCpuChoice(this.participantId, target.slot, choice);
      return true;
    }
    return false;
  }

  menuBindings(bindings: Readonly<KeyBindings>): void {
    const name = (action: Action) => keyLabel(keyFor(bindings, action, 0));
    this.menuPrompt = this.controls === "journal" ? "Move: Stick or D-pad · Choose: A · Back: X"
      : `Move: ${name(Action.moveLeft)}/${name(Action.moveRight)} + ${name(Action.moveUp)}/${name(Action.moveDown)}   Choose: ${name(Action.attack)}   Back: ${name(Action.special)}`;
  }

  private showCpuSettings(game: Readonly<MatchState>, slot: number): void {
    const opponent = game.cpuOpponents[slot] ?? CPU_OPPONENT_DEFAULT;
    const tier = game.cpuTiers[slot] ?? CPU_TIER_DEFAULT;
    BlzFrameSetText(this.cpuTitle, `CPU ${slot + 1} — Opponent settings`);
    for (let row = 0; row < this.cpuValues.length; row++) {
      const frame = this.cpuValues[row];
      if (frame !== undefined) BlzFrameSetText(frame, `${this.cpuFocus === row ? "> " : ""}${titleCase(row === 0 ? opponent : tier)}${this.cpuFocus === row ? " <" : ""}`);
    }
    const copy = opponent === "random" ? "A different opponent each match." : `${CPU_OPPONENT_COPY[opponent].description}\n${CPU_OPPONENT_COPY[opponent].tags}\n\n${CPU_OPPONENT_COPY[opponent].previews[tier]}`;
    const permission = canChooseComputer(game, this.participantId, slot) ? "" : "\n\nOnly the slot owner or first player can change this opponent.";
    for (const button of this.cpuSteps) BlzFrameSetEnable(button, permission === "");
    BlzFrameSetText(this.cpuPreview, copy + permission);
    BlzFrameSetText(this.cpuDone, this.cpuFocus === 2 ? "> Done <" : "Done");
    BlzFrameSetText(this.cpuPrompt, this.menuPrompt);
  }

  private acceptDrop(data: string): void {
    const tile = decodeTile(data);
    if (this.choosing() !== undefined && tile !== undefined) this.actions.selectChoice(this.participantId, characterOfTile(tile));
  }


  private acceptCpuDrop(data: string): void {
    const game = this.choosing();
    const placement = decodeCpuPlacement(data, PLAYABLE_CHARACTERS.length);
    if (game !== undefined && placement !== undefined && canChooseComputer(game, this.participantId, placement.slot)) this.actions.selectCpuChoice(this.participantId, placement.slot, characterOfTile(placement.tile));
  }

  private acceptRecall(data: string): void {
    const chip = decodeSlot(data);
    if (this.choosing() !== undefined && chip !== undefined) this.actions.recallChoice(this.participantId, chip);
  }

  private showHand(shown: boolean, x: number, y: number): void {
    BlzFrameSetVisible(this.hand, shown);
    if (shown) placeTopLeft(this.hand, handLeft(x), handTop(y));
    if (shown === this.cursorHidden) return;
    this.cursorHidden = shown;
    BlzEnableCursor(!shown);
  }

  private ownsLocalClient(): boolean {
    return GetLocalPlayer() === Player(this.participantId);
  }

  private sendPlacement({ slot, tile }: Placement): void {
    const game = this.choosing();
    if (game === undefined) return;
    if (slot === this.participantId && humanFighterActive(game, slot)) BlzSendSyncData("fighter-drop", I2S(tile));
    else if (canChooseComputer(game, this.participantId, slot)) BlzSendSyncData("cpu-fighter-drop", `${I2S(slot)}${I2S(tile)}`);
  }


  hoveredTile(): number | undefined {
    return this.drag.hover;
  }


  placeHovered(): void {
    if (!this.ownsLocalClient()) return;
    const placement = placeHovered(this.drag);
    if (placement !== undefined) this.sendPlacement(placement);
  }


  recallHeld(): void {
    const { held } = this.drag;
    if (this.ownsLocalClient() && this.choosing() !== undefined && held !== undefined) BlzSendSyncData("fighter-recall", I2S(held));
  }

  private isSeen(): boolean {
    this.seen ??= tutorialSeen();
    return this.seen;
  }

  private markSeen(): void {
    if (this.isSeen()) return;
    this.seen = true;
    markTutorialSeen();
  }


  showDelay(text: string): void {
    if (text === this.shownDelay) return;
    this.shownDelay = text;
    BlzFrameSetText(this.delayLine, text);
  }

  update(game: Readonly<MatchState>, settingsOpen: boolean): void {
    this.game = game;
    this.settingsOpen = settingsOpen;
    if (this.choosing() === undefined) this.cpuSlot = undefined;
    if (!this.ownsLocalClient()) return;
    const { participantId, drag } = this;
    const visible = this.choosing() !== undefined;
    const cpuOpen = visible && this.cpuSlot !== undefined;

    if (game.phase === Phase.match) this.markSeen();
    if (visible && !this.tutorialOffered) {
      this.tutorialOffered = true;
      if (!this.isSeen()) this.tutorialOpen = true;
    }
    BlzFrameSetVisible(this.tutorial.root, visible && this.tutorialOpen && !cpuOpen && !this.movesOpen);
    BlzFrameSetVisible(this.cpuRoot, cpuOpen);
    BlzFrameSetVisible(this.root, visible);
    BlzFrameSetVisible(this.backdrop, visible);
    for (const frame of this.movesFrames) BlzFrameSetVisible(frame, visible && this.movesOpen);
    BlzFrameSetVisible(this.modeLabel, visible);
    const mode = this.movesOpen ? MOVES_HEADER : selectionModeLabel(game);
    if (mode !== this.shownMode) {
      this.shownMode = mode;
      BlzFrameSetText(this.modeLabel, mode);
    }
    if (!visible || cpuOpen || this.movesOpen) this.hideHelp();
    if (!visible) {
      this.showHand(false, 0.0, 0.0);
      clearSelectionDrag(drag);
      return;
    }
    if (cpuOpen && this.cpuSlot !== undefined) {
      this.showHand(false, 0.0, 0.0);
      BlzFrameSetVisible(this.root, false);
      clearSelectionDrag(drag);
      this.showCpuSettings(game, this.cpuSlot);
      return;
    }
    if (this.movesOpen) {
      this.showHand(false, 0.0, 0.0);
      BlzFrameSetVisible(this.root, false);
      clearSelectionDrag(drag);
      this.showMoves();
      return;
    }
    for (let tile = 0; tile < this.tiles.length; tile++) {
      for (const frame of this.tiles[tile] ?? []) BlzFrameSetVisible(frame, selectableMatchCharacter(game, characterOfTile(tile)));
    }
    if (drag.held === undefined && humanFighterActive(game, participantId)) drag.held = participantId;
    let x = 0.0;
    let y = 0.0;
    let pinching = false;
    const width = I2R(BlzGetLocalClientWidth());
    const height = I2R(BlzGetLocalClientHeight());
    if (width > 0 && height > 0) {
      x = pointerX(I2R(BlzGetMouseScreenPosX()), width, height);
      y = pointerY(I2R(BlzGetMouseScreenPosY()), height);
      let selectable = 0;
      for (const slot of PARTICIPANT_SLOTS) {
        const chip = this.chips[slot];
        if (chip !== undefined) {
          chip.choice = tileOfCharacter(characterFor(game, slot) ?? Character.rifleman);
          chip.placed = characterReady(game, slot);
        }
        if ((slot === participantId && humanFighterActive(game, slot)) || canChooseComputer(game, participantId, slot)) selectable |= 1 << slot;
      }
      this.roster.selectable = selectable;
      const placement = updateSelectionDrag(drag, this.roster, BlzIsMouseButtonPressed(MOUSE_BUTTON_TYPE_LEFT), x, y);
      if (placement !== undefined) this.sendPlacement(placement);
    }
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      const frames = this.cards[slot];
      if (frames === undefined) continue;
      const active = fighterActive(game, slot);
      const ready = characterReady(game, slot);
      const human = humanFighterActive(game, slot);
      const choice = characterFor(game, slot);
      BlzFrameSetTexture(frames.card, `war3mapImported\\SelectionCard${active ? slotColor(slot).name : "Gray"}.tga`, 0, true);
      const focused = this.menuFocus?.kind === "fighter" && this.menuFocus.slot === slot;
      BlzFrameSetText(frames.tag, active ? `${focused ? "> " : ""}${human ? "Player" : "CPU"}${focused ? " <" : ""}` : "Empty");
      BlzFrameSetEnable(frames.mode, canCycleSlotMode(game, participantId, slot));
      BlzFrameSetVisible(frames.portrait, active && ready);
      BlzFrameSetVisible(frames.name, active && ready);
      BlzFrameSetText(frames.status, human && !humanPresent(game, slot) ? "No player" : active && !ready ? "Choose fighter" : `P${I2S(slot + 1)}`);
      if (ready) {
        BlzFrameSetTexture(frames.portrait, portraitTexture(choice, false, slot), 0, true);
        BlzFrameSetText(frames.name, nameText(choice));
      }
      const computer = active && !human;
      const preview = cardPortrait(computer);
      placeTopLeft(frames.portrait, cardX(slot) + (f32(0.16) - preview.size) / 2, preview.top);
      BlzFrameSetSize(frames.portrait, preview.size, preview.size);
      BlzFrameSetVisible(frames.summary, computer);
      BlzFrameSetVisible(frames.settings, computer);
      if (computer) {
        BlzFrameSetVisible(frames.status, false);
        BlzFrameSetText(frames.summary, cpuCardSummary(game, slot));
        BlzFrameSetText(frames.settings, this.menuFocus?.kind === "settings" && this.menuFocus.slot === slot ? "> Opponent settings <" : "Opponent settings");
      } else BlzFrameSetVisible(frames.status, true);
      BlzFrameSetVisible(frames.chip, active);
      BlzFrameSetTexture(frames.chip, `war3mapImported\\SelectionChip${human ? `P${I2S(slot + 1)}` : "CPU"}.tga`, 0, true);
      const carried = drag.dragging === slot || (!ready && drag.held === slot && drag.hover !== undefined);
      if (carried && active) pinching = true;
      const chipChoice = tileOfCharacter(choice ?? Character.rifleman);
      const size = ready ? f32(0.048) * this.roster.grid.scale : f32(0.06);
      BlzFrameSetSize(frames.chip, size, size);
      placeTopLeft(
        frames.chip,
        carried ? carriedChipLeft(x, size) : ready ? chipX(this.roster.grid, slot, chipChoice) : cardX(slot) + f32(0.06),
        carried ? carriedChipTop(y, size) : ready ? chipY(this.roster.grid, slot, chipChoice) : f32(0.2),
      );
    }
    this.showHand(pinching && width > 0 && height > 0 && !settingsOpen && !this.tutorialOpen, x, y);
    BlzFrameSetText(this.confirm, this.confirmText(game));
    this.showRules(game);
    this.showHelp(game, x, y);
  }

  private showHelp(game: Readonly<MatchState>, x: number, y: number): void {
    const name = this.drag.dragging === undefined ? hoveredRule(visibleRuleGroups(game), x, y) : undefined;
    const text = name === undefined ? "" : ruleHelp(name, game);
    if (text === this.shownHelp) return;
    this.shownHelp = text;
    BlzFrameSetVisible(this.help, name !== undefined);
    if (name === undefined) return;
    const box = RULE_BUTTONS[name];
    placeTopLeft(this.help, Math.min(box.x, f32(f32(0.8) - RULE_HELP_WIDTH - f32(0.01))), f32(box.y - box.height - f32(0.003)));
    BlzFrameSetText(this.helpText, text);
  }


  private hideHelp(): void {
    if (this.shownHelp === "") return;
    this.shownHelp = "";
    BlzFrameSetVisible(this.help, false);
  }

  private openMoves(): void {
    const game = this.game;
    this.movesCharacter = (game === undefined ? undefined : characterFor(game, this.participantId)) ?? Character.rifleman;
    this.movesOpen = true;
  }

  private showMoves(): void {
    if (this.shownMoves === this.movesCharacter) return;
    this.shownMoves = this.movesCharacter;

    const { title, lines } = movesPage(this.movesCharacter, this.game?.ultimatesOff !== true);
    BlzFrameSetText(this.movesTitle, title);
    BlzFrameSetText(this.movesBody, lines.join("\n\n"));
  }

  private showRules(game: Readonly<MatchState>): void {
    const { stockCount, timeLimitMinutes, endless, automaticRematch, training, trainer, items, classic, classicTier, lore, loreBattle: battle } = game;
    const clears = loreClears();
    const fighter = characterFor(game, this.participantId) ?? Character.rifleman;
    const rules = `${lore ? "1" : "0"} ${I2S(battle)} ${I2S(clears.count())} ${classic ? "1" : "0"} ${I2S(classicTier)} ${I2S(fighter)} ${I2S(stockCount)} ${I2S(timeLimitMinutes)} ${endless ? "1" : "0"} ${automaticRematch ? "1" : "0"} ${training ? "1" : "0"} ${I2S(trainer.behaviour)} ${I2S(trainer.escape)} ${I2S(trainer.tech)} ${I2S(trainer.damage)} ${trainer.showHitAreas ? "1" : "0"} ${I2S(trainer.speed)} ${items.on ? "1" : "0"} ${game.ultimatesOff ? "1" : "0"} ${I2S(items.enabledMask)} ${I2S(trainer.lesson)}`;
    if (rules === this.shownRules) return;
    this.shownRules = rules;
    BlzFrameSetText(this.stockValue, stockSetting(stockCount));
    BlzFrameSetText(this.timeValue, timeSetting(timeLimitMinutes));
    BlzFrameSetText(this.endlessToggle, endlessSetting(endless));
    BlzFrameSetText(this.rematchToggle, automaticRematchSetting(automaticRematch));
    for (const step of this.steps) BlzFrameSetEnable(step, !endless);
    BlzFrameSetText(this.itemsToggle, itemsSetting(items.on));
    BlzFrameSetText(this.ultimatesToggle, ultimatesSetting(!game.ultimatesOff));
    for (let index = 0; index < this.itemToggles.length; index++) {
      const frame = this.itemToggles[index];
      if (frame === undefined) continue;
      const kind = index === 0 ? ItemKind.speed : ItemKind.heavy;
      BlzFrameSetText(frame, itemKindSetting(kind, (items.enabledMask & itemBit(kind)) !== 0));
      BlzFrameSetVisible(frame, items.on && !training && !classic && !lore);
    }
    BlzFrameSetText(this.trainingToggle, modeSetting(game));
    const chosen = loreBattle(battle);
    BlzFrameSetText(this.classicTierValue, lore ? loreBattleSetting(battle, chosen !== undefined && clears.has(chosen.id)) : classicTierSetting(classicTier));
    BlzFrameSetText(this.classicRoute, lore ? loreBattleSummary(battle, clears.count()) : classicRouteSummary(fighter));
    showTutorialLesson(this.tutorial, trainer.lesson);
    BlzFrameSetText(this.hitAreasToggle, hitAreasSetting(trainer.showHitAreas));
    BlzFrameSetText(this.speedToggle, trainingSpeedSetting(trainer.speed));
    const [behaviour, escape, tech, damage] = this.partnerValues;
    if (behaviour !== undefined) BlzFrameSetText(behaviour, partnerBehaviourSetting(trainer.behaviour));
    if (escape !== undefined) BlzFrameSetText(escape, partnerEscapeSetting(trainer.escape));
    if (tech !== undefined) BlzFrameSetText(tech, partnerTechSetting(trainer.tech));
    if (damage !== undefined) BlzFrameSetText(damage, partnerDamageSetting(trainer.damage));
    for (const frame of this.matchRuleFrames) BlzFrameSetVisible(frame, !training && !classic && !lore);
    for (const frame of this.itemToggles) BlzFrameSetVisible(frame, items.on && !training && !classic && !lore);
    for (const frame of this.trainingFrames) BlzFrameSetVisible(frame, training);
    for (const frame of this.classicFrames) BlzFrameSetVisible(frame, classic || lore);
  }

  private confirmText(game: Readonly<MatchState>): string {
    const journal = this.controls === "journal";
    if (hasUnassignedHuman(game)) return "Choose CPU or Empty";
    if (allCharactersReady(game)) return journal ? "Press Start" : "Start (Y)";
    if (fighterMask(game) === 0) return "Add a fighter";
    return journal ? "Select [A]" : "Place your chip";
  }
}
