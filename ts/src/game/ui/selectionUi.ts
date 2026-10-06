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
import { automaticRematchSetting, endlessSetting, stockSetting, timeSetting } from "../shell/messages";
import { Character } from "../sim/codes";
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
}

type RuleButton = { kind: "stocks"; direction: -1 | 1 } | { kind: "time"; direction: -1 | 1 } | { kind: "endless" } | { kind: "automaticRematch" };
type SelectionButton = { kind: "mode"; slot: number } | { kind: "start" } | { kind: "settings" } | RuleButton;

/** A rules button's top-left corner and size in Warcraft's UI coordinates. */
interface RuleBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const STEP_WIDTH = f32(0.03);
const RULE_HEIGHT = f32(0.027);
const stepBox = (x: number, y: number): RuleBox => ({ x, y, width: STEP_WIDTH, height: RULE_HEIGHT });
const toggleBox = (y: number): RuleBox => ({ x: f32(0.03), y, width: f32(0.22), height: RULE_HEIGHT });

/**
 * The match rules beside the roster, which every player sees and any player
 * changes. The native capture journey clicks their centers
 * (smashcraft:ts/scripts/integrity/journey.ts).
 */
export const RULE_BUTTONS = {
  fewerStocks: stepBox(f32(0.03), f32(0.428)),
  moreStocks: stepBox(f32(0.22), f32(0.428)),
  lessTime: stepBox(f32(0.03), f32(0.394)),
  moreTime: stepBox(f32(0.22), f32(0.394)),
  endless: toggleBox(f32(0.36)),
  automaticRematch: toggleBox(f32(0.326)),
} as const;

/** One participant slot's card along the bottom of the panel. */
interface CardFrames {
  readonly card: framehandle;
  readonly tag: framehandle;
  readonly mode: framehandle;
  readonly portrait: framehandle;
  readonly name: framehandle;
  readonly status: framehandle;
  readonly chip: framehandle;
}

const CARD_COLORS = ["Red", "Blue", "Yellow", "Green"] as const;

function fighterArt(choice: number | undefined): string {
  return choice === Character.demonHunter ? "DemonHunter" : choice === Character.archer ? "Archer" : "Rifleman";
}

const nameTexture = (choice: number | undefined) => `war3mapImported\\${fighterArt(choice)}Name.tga`;
const portraitTexture = (choice: number | undefined, tile: boolean) => `war3mapImported\\${fighterArt(choice)}${tile ? "Tile" : "Portrait"}.tga`;

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

const decodeTile = (data: string): RosterTile | undefined => (data === "0" ? 0 : data === "1" ? 1 : data === "2" ? 2 : undefined);
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
  private readonly roster: Roster = { selectable: 0, chips: this.chips };
  /** The match the panel last showed; synchronized events check choices against it. */
  private game: Readonly<MatchState> | undefined;
  private settingsOpen = false;
  private readonly stockValue: framehandle;
  private readonly timeValue: framehandle;
  private readonly endlessToggle: framehandle;
  private readonly rematchToggle: framehandle;
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
    for (let choice = 0; choice < 3; choice++) {
      const x = f32(0.26) + choice * f32(0.18);
      const name = `${suffix}_${I2S(choice)}`;
      art(root, `MeleeTile${name}`, "war3mapImported\\SelectionTileFrame.tga", x, f32(0.424), f32(0.112), f32(0.132));
      art(root, `MeleeTilePortrait${name}`, portraitTexture(choice, true), x + f32(0.0125), f32(0.411), f32(0.087), f32(0.087));
      art(root, `MeleeTileName${name}`, nameTexture(choice), x + f32(0.004), f32(0.316), f32(0.103), f32(0.018));
    }
    this.cards = PARTICIPANT_SLOTS.map((slot) => {
      const x = cardX(slot);
      const name = `${suffix}_${I2S(slot)}`;
      const card = art(root, `MeleeCard${name}`, "war3mapImported\\SelectionCardGray.tga", x, f32(0.275), f32(0.16), f32(0.2));
      const tag = label(root, `MeleeTag${name}`, x + f32(0.014), f32(0.267), f32(0.132), f32(0.019), f32(0.01));
      const mode = this.clicks.add(hotspot(root, x + f32(0.014), f32(0.27), f32(0.132), f32(0.027)), { kind: "mode", slot });
      BlzFrameSetLevel(mode, 1);
      BlzFrameSetLevel(tag, 2);
      const portrait = art(root, `MeleePortrait${name}`, portraitTexture(Character.archer, false), x + f32(0.019), f32(0.245), f32(0.122), f32(0.122));
      const fighterName = art(root, `MeleeName${name}`, nameTexture(Character.archer), x + f32(0.008), f32(0.116), f32(0.144), f32(0.02));
      const status = label(root, `MeleeStatus${name}`, x + f32(0.014), f32(0.093), f32(0.132), f32(0.014), f32(0.011));
      const chip = art(root, `MeleeChip${name}`, `war3mapImported\\SelectionChipP${I2S(slot + 1)}.tga`, x + f32(0.06), f32(0.2), f32(0.04), f32(0.04));
      BlzFrameSetLevel(chip, 10);
      return { card, tag, mode, portrait, name: fighterName, status, chip };
    });
    art(root, `MeleeConfirmArt${suffix}`, "war3mapImported\\SelectionAction.tga", f32(0.071), f32(0.043), f32(0.235), f32(0.037));
    this.confirm = label(root, `MeleeConfirmLabel${suffix}`, f32(0.079), f32(0.039), f32(0.219), f32(0.028), f32(0.011));
    this.clicks.add(hotspot(root, f32(0.071), f32(0.043), f32(0.235), f32(0.037)), { kind: "start" });
    art(root, `MeleeSettingsArt${suffix}`, "war3mapImported\\SelectionAction.tga", f32(0.51), f32(0.043), f32(0.235), f32(0.037));
    const settingsLabel = label(root, `MeleeSettingsLabel${suffix}`, f32(0.518), f32(0.039), f32(0.219), f32(0.028), f32(0.011));
    BlzFrameSetText(settingsLabel, "CONTROLS  [F1]");
    this.clicks.add(hotspot(root, f32(0.51), f32(0.043), f32(0.235), f32(0.037)), { kind: "settings" });
    const caption = label(root, `MeleeRulesCaption${suffix}`, f32(0.03), f32(0.452), f32(0.22), f32(0.02), f32(0.011));
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
    BlzDestroyFrame(this.root);
    BlzDestroyFrame(this.backdrop);
  }

  private click(button: SelectionButton, clicker: player): void {
    if (clicker !== Player(this.participantId)) return;
    if (button.kind === "mode") this.actions.cycleMode(this.participantId, button.slot);
    else if (button.kind === "start") this.actions.start(this.participantId);
    else if (button.kind === "settings") this.actions.openSettings(this.participantId);
    else if (button.kind === "stocks") this.actions.changeStocks(this.participantId, button.direction);
    else if (button.kind === "time") this.actions.changeTime(this.participantId, button.direction);
    else if (button.kind === "endless") this.actions.toggleEndless(this.participantId);
    else this.actions.toggleAutomaticRematch(this.participantId);
  }

  /** The game the panel may take choices for now, or undefined while it isn't choosing. */
  private choosing(): Readonly<MatchState> | undefined {
    const { game } = this;
    return game === undefined || game.phase !== Phase.characterMenu || this.settingsOpen || !humanActive(game, this.participantId) ? undefined : game;
  }

  private acceptDrop(data: string): void {
    const tile = decodeTile(data);
    if (this.choosing() !== undefined && tile !== undefined) this.actions.selectChoice(this.participantId, tile);
  }

  /** Data is the computer's slot digit, then the tile digit. */
  private acceptCpuDrop(data: string): void {
    const game = this.choosing();
    if (game === undefined || data.length !== 2) return;
    const cpu = decodeSlot(data.charAt(0));
    const tile = decodeTile(data.charAt(1));
    if (cpu !== undefined && tile !== undefined && canChooseComputer(game, this.participantId, cpu)) this.actions.selectCpuChoice(this.participantId, cpu, tile);
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
    if (!visible) {
      clearSelectionDrag(drag);
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
          chip.choice = characterFor(game, slot) ?? Character.archer;
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
        BlzFrameSetTexture(frames.name, nameTexture(choice), 0, true);
      }
      BlzFrameSetVisible(frames.chip, active);
      BlzFrameSetTexture(frames.chip, `war3mapImported\\SelectionChip${human ? `P${I2S(slot + 1)}` : "CPU"}.tga`, 0, true);
      const carried = drag.dragging === slot || (!ready && drag.held === slot && drag.hover !== undefined);
      const chipChoice = choice ?? Character.archer;
      placeTopLeft(
        frames.chip,
        carried ? x - f32(0.02) : ready ? chipX(slot, chipChoice) : cardX(slot) + f32(0.06),
        carried ? y + f32(0.02) : ready ? chipY(slot) : f32(0.2),
      );
    }
    BlzFrameSetText(this.confirm, this.confirmText(game));
    this.showRules(game);
  }

  private showRules(game: Readonly<MatchState>): void {
    const { stockCount, timeLimitMinutes, endless, automaticRematch } = game;
    const rules = `${I2S(stockCount)} ${I2S(timeLimitMinutes)} ${endless ? "1" : "0"} ${automaticRematch ? "1" : "0"}`;
    if (rules === this.shownRules) return;
    this.shownRules = rules;
    BlzFrameSetText(this.stockValue, stockSetting(stockCount));
    BlzFrameSetText(this.timeValue, timeSetting(timeLimitMinutes));
    BlzFrameSetText(this.endlessToggle, endlessSetting(endless));
    BlzFrameSetText(this.rematchToggle, automaticRematchSetting(automaticRematch));
    for (const step of this.steps) BlzFrameSetEnable(step, !endless);
  }

  private confirmText(game: Readonly<MatchState>): string {
    const journal = this.controls === "journal";
    if (hasUnassignedHuman(game)) return "Choose CPU or EMPTY";
    if (allCharactersReady(game)) return journal ? "Press Start" : "Start [Y]";
    if (fighterMask(game) === 0) return "Add a fighter";
    return journal ? "Select [A]" : "Place your chip";
  }
}
