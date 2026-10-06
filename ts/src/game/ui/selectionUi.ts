import { LEVEL_ROW_HEIGHT, RULE_BUTTONS, RULE_HEIGHT, type RuleBox, type TrainingSetting, cpuLevelBox } from "./ruleButtons";
// The character panel of one participant. Every client builds all four panels;
// only the owner's client shows its own and reads its pointer, and a placed or
// recalled chip crosses a player sync event before the game sees it. Beside the
// roster each panel shows the match rules, which any player changes with a
// synchronized click.
import { f32 } from "wisp/src/sim/f32";
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
  chipX,
  chipY,
  clearSelectionDrag,
  placeHovered,
  selectionDrag,
  updateSelectionDrag,
} from "../menu/selectionDrag";
import { cellRect, rosterGrid } from "../menu/selectionGrid";
import { SELECTABLE_CHARACTERS, fighterName, fighterPortrait, nextSelectableCharacter } from "../sim/heroes/registry";
import {
  automaticRematchSetting, cpuLevelSetting, movesPage, endlessSetting, hitAreasSetting, partnerBehaviourSetting, partnerDamageSetting, partnerEscapeSetting,
  partnerTechSetting, stockSetting, timeSetting, trainingSetting, trainingSpeedSetting,
} from "../shell/messages";
import { Character } from "../sim/codes";
import { CARD_PORTRAIT, TILE_PORTRAIT_SLOT, tilePortrait } from "./portraitFrames";
import { ButtonClicks, MENU_FONT, type MenuControls, bindSyncHandler, consoleUi, coverScreen, createBackdrop, createSyncTrigger, createText, gameUi, placeTopLeft } from "./frames";

/** What a participant's panel asks the game to do; each call comes from a synchronized event. */
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
  toggleTraining(participantId: number): void;
  stepTraining(participantId: number, setting: TrainingSetting, direction: -1 | 1): void;
  toggleHitAreas(participantId: number): void;
  stepSpeed(participantId: number): void;
  changeCpuLevel(actorId: number, cpuSlot: number, direction: -1 | 1): void;
}

type RuleButton = { kind: "stocks"; direction: -1 | 1 } | { kind: "time"; direction: -1 | 1 } | { kind: "endless" } | { kind: "automaticRematch" }
  | { kind: "training" } | { kind: "partner"; setting: TrainingSetting; direction: -1 | 1 } | { kind: "hitAreas" } | { kind: "speed" };
type SelectionButton = { kind: "mode"; slot: number } | { kind: "level"; slot: number; direction: -1 | 1 } | { kind: "start" } | { kind: "settings" } | RuleButton
  | { kind: "moves" } | { kind: "movesBack" } | { kind: "movesStep"; direction: -1 | 1 };

/** One participant slot's card along the bottom of the panel. */
interface CardFrames {
  readonly card: framehandle;
  readonly tag: framehandle;
  readonly mode: framehandle;
  readonly portrait: framehandle;
  readonly name: framehandle;
  readonly status: framehandle;
  readonly chip: framehandle;
  /** A computer's level, between the buttons that lower and raise it. */
  readonly level: framehandle;
  readonly lower: framehandle;
  readonly raise: framehandle;
}

const CARD_COLORS = ["Red", "Blue", "Yellow", "Green"] as const;

const portraitTexture = (choice: number | undefined, tile: boolean) => fighterPortrait(choice ?? Character.archer, tile ? "Tile" : "Card");
const nameText = (choice: number | undefined) => fighterName(choice ?? Character.archer).toUpperCase();

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

/** An invisible dialog button over art that shows what it does. */
function hotspot(parent: framehandle, x: number, y: number, width: number, height: number): framehandle {
  const frame = BlzCreateFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetAlpha(frame, 0);
  return frame;
}

/** Roster tiles are positions in the selectable fighters; a fighter chosen by tile is that character. */
const characterOfTile = (tile: RosterTile): number => SELECTABLE_CHARACTERS[tile] ?? Character.archer;
function tileOfCharacter(character: number): RosterTile {
  for (let tile = 0; tile < SELECTABLE_CHARACTERS.length; tile++) if (SELECTABLE_CHARACTERS[tile] === character) return tile;
  return 0;
}

const decodeTile = (data: string): RosterTile | undefined => {
  const tile = S2I(data);
  return I2S(tile) === data && tile >= 0 && tile < SELECTABLE_CHARACTERS.length ? tile : undefined;
};
const decodeSlot = (data: string): number | undefined => (data === "0" ? 0 : data === "1" ? 1 : data === "2" ? 2 : data === "3" ? 3 : undefined);

export class SelectionPanel {
  private readonly root: framehandle;
  private readonly backdrop: framehandle;
  private readonly confirm: framehandle;
  private readonly cards: readonly CardFrames[];
  private readonly clicks: ButtonClicks<SelectionButton>;
  private readonly syncTriggers: readonly trigger[];
  private readonly drag = selectionDrag();
  // Preallocated: the owner's client reads the pointer every rendered frame.
  private readonly chips: RosterChip[] = PARTICIPANT_SLOTS.map(() => ({ choice: 0, placed: false }));
  private readonly roster: Roster = { grid: rosterGrid(SELECTABLE_CHARACTERS.length), selectable: 0, chips: this.chips };
  /** The match the panel last showed; synchronized events check choices against it. */
  private game: Readonly<MatchState> | undefined;
  private settingsOpen = false;
  /** The Moves page: presentation only, opened and paged by the owner's clicks; the fighter it shows. */
  private movesOpen = false;
  private movesCharacter: number = Character.archer;
  private shownMoves = -1;
  private readonly movesFrames: readonly framehandle[];
  private readonly movesTitle: framehandle;
  private readonly movesBody: framehandle;
  private readonly stockValue: framehandle;
  private readonly timeValue: framehandle;
  private readonly endlessToggle: framehandle;
  private readonly rematchToggle: framehandle;
  private readonly trainingToggle: framehandle;
  private readonly hitAreasToggle: framehandle;
  private readonly speedToggle: framehandle;
  /** Each partner choice's value between its two steps. */
  private readonly partnerValues: readonly framehandle[];
  /** The match rules training has no use for, and the partner choices that replace them. */
  private readonly matchRuleFrames: readonly framehandle[];
  private readonly trainingFrames: readonly framehandle[];
  /** The stock and time buttons, which endless play leaves unused. */
  private readonly steps: readonly framehandle[];
  /** The rules the panel last showed. */
  private shownRules: string | undefined;

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
    const grid = this.roster.grid;
    const scale = f32(grid.scale);
    for (let choice = 0; choice < grid.count; choice++) {
      const { left, top } = cellRect(grid, choice);
      const x = f32(left);
      const y = f32(top);
      const name = `${suffix}_${I2S(choice)}`;
      art(root, `MeleeTile${name}`, "war3mapImported\\SelectionTileFrame.tga", x, y, f32(grid.cellWidth), f32(grid.cellHeight));
      const portrait = tilePortrait(scale);
      const inset = (TILE_PORTRAIT_SLOT * scale - portrait) / 2;
      art(root, `MeleeTilePortrait${name}`, portraitTexture(SELECTABLE_CHARACTERS[choice], true), x + f32(0.0125) * scale + inset, y - f32(0.013) * scale - inset, portrait, portrait);
      BlzFrameSetText(label(root, `MeleeTileName${name}`, x + f32(0.004) * scale, y - f32(0.108) * scale, f32(0.103) * scale, f32(0.018) * scale, f32(0.011) * scale), nameText(SELECTABLE_CHARACTERS[choice]));
    }
    this.cards = PARTICIPANT_SLOTS.map((slot) => {
      const x = cardX(slot);
      const name = `${suffix}_${I2S(slot)}`;
      const card = art(root, `MeleeCard${name}`, "war3mapImported\\SelectionCardGray.tga", x, f32(0.275), f32(0.16), f32(0.2));
      const tag = label(root, `MeleeTag${name}`, x + f32(0.014), f32(0.267), f32(0.132), f32(0.019), f32(0.01));
      const mode = this.clicks.add(hotspot(root, x + f32(0.014), f32(0.27), f32(0.132), f32(0.027)), { kind: "mode", slot });
      BlzFrameSetLevel(mode, 1);
      BlzFrameSetLevel(tag, 2);
      const portrait = art(root, `MeleePortrait${name}`, portraitTexture(Character.archer, false), x + (f32(0.16) - CARD_PORTRAIT) / 2, f32(0.245), CARD_PORTRAIT, CARD_PORTRAIT);
      const name_ = label(root, `MeleeName${name}`, x + f32(0.008), f32(0.116), f32(0.144), f32(0.02), f32(0.014));
      const status = label(root, `MeleeStatus${name}`, x + f32(0.014), f32(0.093), f32(0.132), f32(0.014), f32(0.011));
      const chip = art(root, `MeleeChip${name}`, `war3mapImported\\SelectionChipP${I2S(slot + 1)}.tga`, x + f32(0.06), f32(0.2), f32(0.04), f32(0.04));
      BlzFrameSetLevel(chip, 10);
      const levelButton = (direction: -1 | 1) => {
        const box = cpuLevelBox(slot, direction);
        const frame = BlzCreateFrame("ScriptDialogButton", root, 0, 0);
        placeTopLeft(frame, box.x, box.y);
        BlzFrameSetSize(frame, box.width, box.height);
        BlzFrameSetText(frame, direction < 0 ? "−" : "+");
        return this.clicks.add(frame, { kind: "level", slot, direction });
      };
      const lower = levelButton(-1);
      const raise = levelButton(1);
      const lowerBox = cpuLevelBox(slot, -1);
      const levelX = lowerBox.x + lowerBox.width;
      const level = label(root, `MeleeLevel${name}`, levelX, lowerBox.y, cpuLevelBox(slot, 1).x - levelX, LEVEL_ROW_HEIGHT, f32(0.011));
      return { card, tag, mode, portrait, name: name_, status, chip, level, lower, raise };
    });
    art(root, `MeleeConfirmArt${suffix}`, "war3mapImported\\SelectionAction.tga", f32(0.071), f32(0.043), f32(0.235), f32(0.037));
    this.confirm = label(root, `MeleeConfirmLabel${suffix}`, f32(0.079), f32(0.039), f32(0.219), f32(0.028), f32(0.011));
    this.clicks.add(hotspot(root, f32(0.071), f32(0.043), f32(0.235), f32(0.037)), { kind: "start" });
    art(root, `MeleeSettingsArt${suffix}`, "war3mapImported\\SelectionAction.tga", f32(0.51), f32(0.043), f32(0.235), f32(0.037));
    const settingsLabel = label(root, `MeleeSettingsLabel${suffix}`, f32(0.518), f32(0.039), f32(0.219), f32(0.028), f32(0.011));
    BlzFrameSetText(settingsLabel, "CONTROLS  [F1]");
    this.clicks.add(hotspot(root, f32(0.51), f32(0.043), f32(0.235), f32(0.037)), { kind: "settings" });
    art(root, `MeleeMovesArt${suffix}`, "war3mapImported\\SelectionAction.tga", f32(0.318), f32(0.043), f32(0.18), f32(0.037));
    BlzFrameSetText(label(root, `MeleeMovesLabel${suffix}`, f32(0.324), f32(0.039), f32(0.168), f32(0.028), f32(0.011)), "MOVES");
    this.clicks.add(hotspot(root, f32(0.318), f32(0.043), f32(0.18), f32(0.037)), { kind: "moves" });
    const page = (frame: framehandle, x: number, y: number, width: number, height: number) => {
      placeTopLeft(frame, x, y);
      BlzFrameSetSize(frame, width, height);
      BlzFrameSetVisible(frame, false);
      return frame;
    };
    this.movesTitle = page(createText(`MeleeMovesTitle${suffix}`, gameUi(), 470 + participantId), f32(0.12), f32(0.56), f32(0.56), f32(0.035));
    BlzFrameSetFont(this.movesTitle, MENU_FONT, f32(0.016), 0);
    BlzFrameSetTextAlignment(this.movesTitle, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
    this.movesBody = page(createText(`MeleeMovesBody${suffix}`, gameUi(), 474 + participantId), f32(0.12), f32(0.51), f32(0.56), f32(0.4));
    BlzFrameSetFont(this.movesBody, MENU_FONT, f32(0.012), 0);
    BlzFrameSetTextAlignment(this.movesBody, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
    const pageButton = (name: string, x: number, width: number, text: string, target: SelectionButton) => {
      const frame = page(BlzCreateFrameByType("GLUETEXTBUTTON", name, gameUi(), "ScriptDialogButton", 0), x, f32(0.075), width, f32(0.032));
      BlzFrameSetText(frame, text);
      return this.clicks.add(frame, target);
    };
    this.movesFrames = [
      this.movesTitle, this.movesBody,
      pageButton(`MeleeMovesPrevious${suffix}`, f32(0.2), f32(0.1), "<", { kind: "movesStep", direction: -1 }),
      pageButton(`MeleeMovesBack${suffix}`, f32(0.33), f32(0.14), "Back", { kind: "movesBack" }),
      pageButton(`MeleeMovesNext${suffix}`, f32(0.5), f32(0.1), ">", { kind: "movesStep", direction: 1 }),
    ];
    const caption = label(root, `MeleeRulesCaption${suffix}`, f32(0.03), f32(0.566), f32(0.22), f32(0.02), f32(0.011));
    BlzFrameSetText(caption, "MATCH RULES");
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
    this.timeValue = label(root, `MeleeRulesTime${suffix}`, valueX, lessTime.y, valueWidth, RULE_HEIGHT, f32(0.011));
    this.endlessToggle = ruleButton(endless, { kind: "endless" }, "");
    this.rematchToggle = ruleButton(automaticRematch, { kind: "automaticRematch" }, "");
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
      const value = label(root, `MeleeTraining${setting}${suffix}`, valueX, less.y, valueWidth, RULE_HEIGHT, f32(0.011));
      partnerFrames.push(value);
      return value;
    });
    this.trainingFrames = partnerFrames;
    this.matchRuleFrames = [...this.steps, this.stockValue, this.timeValue, this.endlessToggle, this.rematchToggle];
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
    this.clicks.destroy();
    for (const trigger of this.syncTriggers) DestroyTrigger(trigger);
    for (const frame of this.movesFrames) BlzDestroyFrame(frame);
    BlzDestroyFrame(this.root);
    BlzDestroyFrame(this.backdrop);
  }

  private click(button: SelectionButton, clicker: player): void {
    if (clicker !== Player(this.participantId)) return;
    if (button.kind === "mode") this.actions.cycleMode(this.participantId, button.slot);
    else if (button.kind === "start") this.actions.start(this.participantId);
    else if (button.kind === "settings") this.actions.openSettings(this.participantId);
    else if (button.kind === "moves") this.openMoves();
    else if (button.kind === "movesBack") this.movesOpen = false;
    else if (button.kind === "movesStep") this.movesCharacter = nextSelectableCharacter(this.movesCharacter, button.direction);
    else if (button.kind === "stocks") this.actions.changeStocks(this.participantId, button.direction);
    else if (button.kind === "time") this.actions.changeTime(this.participantId, button.direction);
    else if (button.kind === "endless") this.actions.toggleEndless(this.participantId);
    else if (button.kind === "training") this.actions.toggleTraining(this.participantId);
    else if (button.kind === "partner") this.actions.stepTraining(this.participantId, button.setting, button.direction);
    else if (button.kind === "hitAreas") this.actions.toggleHitAreas(this.participantId);
    else if (button.kind === "speed") this.actions.stepSpeed(this.participantId);
    else if (button.kind === "level") this.actions.changeCpuLevel(this.participantId, button.slot, button.direction);
    else this.actions.toggleAutomaticRematch(this.participantId);
  }

  /** The game the panel may take choices for now, or undefined while it isn't choosing. */
  private choosing(): Readonly<MatchState> | undefined {
    const { game } = this;
    return game === undefined || game.phase !== Phase.characterMenu || this.settingsOpen || !humanActive(game, this.participantId) ? undefined : game;
  }

  private acceptDrop(data: string): void {
    const tile = decodeTile(data);
    if (this.choosing() !== undefined && tile !== undefined) this.actions.selectChoice(this.participantId, characterOfTile(tile));
  }

  /** Data is the computer's slot digit, then the tile digit. */
  private acceptCpuDrop(data: string): void {
    const game = this.choosing();
    if (game === undefined || data.length !== 2) return;
    const cpu = decodeSlot(data.charAt(0));
    const tile = decodeTile(data.charAt(1));
    if (cpu !== undefined && tile !== undefined && canChooseComputer(game, this.participantId, cpu)) this.actions.selectCpuChoice(this.participantId, cpu, characterOfTile(tile));
  }

  private acceptRecall(data: string): void {
    const chip = decodeSlot(data);
    if (this.choosing() !== undefined && chip !== undefined) this.actions.recallChoice(this.participantId, chip);
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

  /** The roster tile under this client's pointer, for the hover sound. */
  hoveredTile(): number | undefined {
    return this.drag.hover;
  }

  /** The attack key: places the held chip on the hovered tile. */
  placeHovered(): void {
    if (!this.ownsLocalClient()) return;
    const placement = placeHovered(this.drag);
    if (placement !== undefined) this.sendPlacement(placement);
  }

  /** Sends the held chip back to its card. */
  recallHeld(): void {
    const { held } = this.drag;
    if (this.ownsLocalClient() && this.choosing() !== undefined && held !== undefined) BlzSendSyncData("fighter-recall", I2S(held));
  }

  /** Every rendered frame on every client, for every panel; only the owner's client draws. */
  update(game: Readonly<MatchState>, settingsOpen: boolean): void {
    this.game = game;
    this.settingsOpen = settingsOpen;
    if (!this.ownsLocalClient()) return;
    const { participantId, drag } = this;
    const visible = this.choosing() !== undefined;
    BlzFrameSetVisible(this.root, visible);
    BlzFrameSetVisible(this.backdrop, visible);
    for (const frame of this.movesFrames) BlzFrameSetVisible(frame, visible && this.movesOpen);
    if (!visible) {
      clearSelectionDrag(drag);
      return;
    }
    if (this.movesOpen) {
      BlzFrameSetVisible(this.root, false);
      clearSelectionDrag(drag);
      this.showMoves();
      return;
    }
    if (drag.held === undefined && humanFighterActive(game, participantId)) drag.held = participantId;
    let x = 0.0;
    let y = 0.0;
    const width = I2R(BlzGetLocalClientWidth());
    const height = I2R(BlzGetLocalClientHeight());
    if (width > 0 && height > 0) {
      x = pointerX(I2R(BlzGetMouseScreenPosX()), width, height);
      y = pointerY(I2R(BlzGetMouseScreenPosY()), height);
      let selectable = 0;
      for (const slot of PARTICIPANT_SLOTS) {
        const chip = this.chips[slot];
        if (chip !== undefined) {
          chip.choice = tileOfCharacter(characterFor(game, slot) ?? Character.archer);
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
      BlzFrameSetTexture(frames.card, `war3mapImported\\SelectionCard${active ? CARD_COLORS[slot] ?? "Gray" : "Gray"}.tga`, 0, true);
      BlzFrameSetText(frames.tag, active ? (human ? "HMN" : "CPU") : "EMPTY");
      BlzFrameSetEnable(frames.mode, canCycleSlotMode(game, participantId, slot));
      BlzFrameSetVisible(frames.portrait, active && ready);
      BlzFrameSetVisible(frames.name, active && ready);
      BlzFrameSetText(frames.status, human && !humanPresent(game, slot) ? "No player" : active && !ready ? "Choose fighter" : `P${I2S(slot + 1)}`);
      if (ready) {
        BlzFrameSetTexture(frames.portrait, portraitTexture(choice, false), 0, true);
        BlzFrameSetText(frames.name, nameText(choice));
      }
      const computer = active && !human;
      BlzFrameSetVisible(frames.level, computer);
      BlzFrameSetVisible(frames.lower, computer);
      BlzFrameSetVisible(frames.raise, computer);
      if (computer) {
        BlzFrameSetText(frames.level, cpuLevelSetting(game.cpuLevels[slot] ?? 0));
        const choosing = canChooseComputer(game, participantId, slot);
        BlzFrameSetEnable(frames.lower, choosing);
        BlzFrameSetEnable(frames.raise, choosing);
      }
      BlzFrameSetVisible(frames.chip, active);
      BlzFrameSetTexture(frames.chip, `war3mapImported\\SelectionChip${human ? `P${I2S(slot + 1)}` : "CPU"}.tga`, 0, true);
      const carried = drag.dragging === slot || (!ready && drag.held === slot && drag.hover !== undefined);
      const chipChoice = tileOfCharacter(choice ?? Character.archer);
      placeTopLeft(
        frames.chip,
        carried ? x - f32(0.02) : ready ? chipX(this.roster.grid, slot, chipChoice) : cardX(slot) + f32(0.06),
        carried ? y + f32(0.02) : ready ? chipY(this.roster.grid, slot, chipChoice) : f32(0.2),
      );
    }
    BlzFrameSetText(this.confirm, this.confirmText(game));
    this.showRules(game);
  }

  /** Opens on the owner's chosen fighter. */
  private openMoves(): void {
    const game = this.game;
    this.movesCharacter = (game === undefined ? undefined : characterFor(game, this.participantId)) ?? Character.archer;
    this.movesOpen = true;
  }

  private showMoves(): void {
    if (this.shownMoves === this.movesCharacter) return;
    this.shownMoves = this.movesCharacter;
    // Ultimates have no match rule yet, so the page leaves them out.
    const { title, lines } = movesPage(this.movesCharacter, false);
    BlzFrameSetText(this.movesTitle, title);
    BlzFrameSetText(this.movesBody, lines.join("\n\n"));
  }

  private showRules(game: Readonly<MatchState>): void {
    const { stockCount, timeLimitMinutes, endless, automaticRematch, training, trainer } = game;
    const rules = `${I2S(stockCount)} ${I2S(timeLimitMinutes)} ${endless ? "1" : "0"} ${automaticRematch ? "1" : "0"} ${training ? "1" : "0"} ${I2S(trainer.behaviour)} ${I2S(trainer.escape)} ${I2S(trainer.tech)} ${I2S(trainer.damage)} ${trainer.showHitAreas ? "1" : "0"} ${I2S(trainer.speed)}`;
    if (rules === this.shownRules) return;
    this.shownRules = rules;
    BlzFrameSetText(this.stockValue, stockSetting(stockCount));
    BlzFrameSetText(this.timeValue, timeSetting(timeLimitMinutes));
    BlzFrameSetText(this.endlessToggle, endlessSetting(endless));
    BlzFrameSetText(this.rematchToggle, automaticRematchSetting(automaticRematch));
    for (const step of this.steps) BlzFrameSetEnable(step, !endless);
    BlzFrameSetText(this.trainingToggle, trainingSetting(training));
    BlzFrameSetText(this.hitAreasToggle, hitAreasSetting(trainer.showHitAreas));
    BlzFrameSetText(this.speedToggle, trainingSpeedSetting(trainer.speed));
    const [behaviour, escape, tech, damage] = this.partnerValues;
    if (behaviour !== undefined) BlzFrameSetText(behaviour, partnerBehaviourSetting(trainer.behaviour));
    if (escape !== undefined) BlzFrameSetText(escape, partnerEscapeSetting(trainer.escape));
    if (tech !== undefined) BlzFrameSetText(tech, partnerTechSetting(trainer.tech));
    if (damage !== undefined) BlzFrameSetText(damage, partnerDamageSetting(trainer.damage));
    for (const frame of this.matchRuleFrames) BlzFrameSetVisible(frame, !training);
    for (const frame of this.trainingFrames) BlzFrameSetVisible(frame, training);
  }

  private confirmText(game: Readonly<MatchState>): string {
    const journal = this.controls === "journal";
    if (hasUnassignedHuman(game)) return "Choose CPU or EMPTY";
    if (allCharactersReady(game)) return journal ? "Press Start" : "Start [Y]";
    if (fighterMask(game) === 0) return "Add a fighter";
    return journal ? "Select [A]" : "Place your chip";
  }
}
