

import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../../game/input/participants";
import { CombatEffects } from "../../game/render/combatEffects";
import { FighterPoolPresentation } from "../../game/render/fighterPool";
import { AgencyMarker } from "../../game/render/agencyMarker";
import { FighterAgencyForecast } from "../../game/presentation/fighterAgency";
import { FrostEffects } from "../../game/render/frostEffects";
import { ElementEffects } from "../../game/render/elementEffects";
import { SpecialCueEffects } from "../../game/render/specialCueEffects";
import { PlacedObjectEffects } from "../../game/render/placedObjectEffects";
import { MatchPresentation } from "../../game/render/matchPresentation";
import { modelSoundPresentation } from "../../game/render/modelSoundPresentation";
import type { ModelSoundSink } from "../../game/render/modelSounds";
import { ProjectilePresentation } from "../../game/render/projectilePresentation";
import { ShieldPresentation } from "../../game/render/shieldPresentation";
import { SpecialEffects } from "../../game/render/specialEffects";
import type { Character } from "../../game/sim/codes";
import { isActive } from "../../game/sim/roster";
import type { MenuControls } from "../../game/ui/frames";
import { FighterHud, MatchClock, plateManaSlot } from "../../game/ui/matchHud";
import { TrainingReadout } from "../../game/ui/trainingReadout";
import { HitAreaPresentation } from "../../game/render/hitAreaPresentation";
import { EscapeMeter } from "../../game/ui/escapeMeter";
import { OffscreenBubble } from "../../game/ui/offscreenBubble";
import { ManaBar } from "../../game/ui/manaBar";
import { MANA_BAR_HEIGHT_PX } from "../../game/ui/plateLayout";
import { unitsForPixels } from "../../game/ui/portraitFrames";
import { gameUi } from "../../game/ui/frames";
import { type SelectionActions, SelectionPanel } from "../../game/ui/selectionUi";
import { type SettingsActions, SettingsPanel } from "../../game/ui/settingsUi";
import { type StageActions, StagePanel } from "../../game/ui/stageUi";
import type { ShellState } from "./state";
import { bindPrototype } from "../rebind";
import { ItemPresentation } from "../../game/render/itemPresentation";
import { MeterDropPresentation } from "../../game/render/meterDropPresentation";
import { BodyFlash } from "../../game/render/bodyFlash";
import { ClassicPresentation } from "../../game/render/classicPresentation";
import { PauseMenu } from "../../game/ui/pauseMenu";


interface FighterRenderers {
  readonly character: Character;
  readonly shield: ShieldPresentation;
  readonly projectiles: ProjectilePresentation;

  readonly cues?: SpecialCueEffects | undefined;
  readonly pool: FighterPoolPresentation | undefined;
  readonly agency: AgencyMarker;
  readonly flash: BodyFlash;

  readonly hitAreas: HitAreaPresentation | undefined;
}

export interface UiObjects {
  pause: PauseMenu;
  items: ItemPresentation;
  drops: MeterDropPresentation;
  readonly clock: MatchClock;
  readonly training: TrainingReadout;
  readonly huds: Slots<FighterHud>;
  readonly bubbles: Slots<OffscreenBubble>;
  readonly escapeMeters: Slots<EscapeMeter>;

  manaBars: Slots<ManaBars>;
  readonly selections: Slots<SelectionPanel>;
  readonly settings: Slots<SettingsPanel>;
  readonly stage: StagePanel;
  readonly combat: CombatEffects;
  readonly frost: FrostEffects;
  readonly placed: PlacedObjectEffects;
  readonly special: SpecialEffects;
  readonly fighters: Slots<FighterRenderers | undefined>;
  sounds: ModelSoundSink;

  match: MatchPresentation;

  elements: ElementEffects;

  classic?: ClassicPresentation;
}


export interface PanelActions {
  readonly selection: SelectionActions;
  readonly stage: StageActions;
  readonly settings: SettingsActions;
}

export function views(s: Readonly<ShellState>): UiObjects {
  const { ui } = s;
  if (ui === undefined) throw new Error("shell UI used before it was created");
  return ui;
}

const each = <T>(create: (slot: ParticipantSlot) => T): Slots<T> => [create(0), create(1), create(2), create(3)];

export interface ManaBars {
  readonly hud: ManaBar;
}

const createManaBars = (slot: ParticipantSlot): ManaBars => ({

  hud: new ManaBar("Hud", slot, gameUi(), 1300 + slot * 20, unitsForPixels(MANA_BAR_HEIGHT_PX), 0.0),
});

function menuControls(s: Readonly<ShellState>): MenuControls {
  return s.build.input.kind === "journal" && s.build.input.ingress === "editbox" ? "journal" : "keyboard";
}

// Create shared panels, HUD plates and effect pools in the same order on every client.
export function createUi(s: ShellState, actions: PanelActions): UiObjects {
  const controls = menuControls(s);
  let combat: CombatEffects;
  const ui: UiObjects = {
    pause: new PauseMenu(),
    items: new ItemPresentation(s.origin),
    drops: new MeterDropPresentation(s.origin),
    clock: new MatchClock(),
    training: new TrainingReadout(),
    huds: each(slot => new FighterHud(slot, 4)),
    bubbles: each(slot => new OffscreenBubble(slot)),
    escapeMeters: each(slot => new EscapeMeter(slot)),
    manaBars: each(createManaBars),
    stage: new StagePanel(actions.stage, controls),
    selections: each(slot => new SelectionPanel(actions.selection, slot, controls)),
    settings: each(slot => new SettingsPanel(s.participants[slot].bindings, actions.settings, slot)),
    combat: combat = new CombatEffects(s.origin),
    frost: new FrostEffects(s.origin),
    placed: new PlacedObjectEffects(s.origin),
    special: new SpecialEffects(s.origin),
    fighters: [undefined, undefined, undefined, undefined],
    sounds: modelSoundPresentation(s.origin, combat.sounds),
    match: new MatchPresentation(s.origin),
    elements: new ElementEffects(s.origin),
    classic: new ClassicPresentation(s.origin),
  };
  s.ui = ui;
  return ui;
}

function endFighterRenderers(renderers: FighterRenderers | undefined): void {
  renderers?.shield.destroy();
  renderers?.projectiles.destroy();
  renderers?.cues?.destroy();
  renderers?.pool?.destroy();
  renderers?.agency.destroy();
  renderers?.flash.destroy();
  renderers?.hitAreas?.destroy();
}





export function beginFighterRenderers(s: ShellState, slot: ParticipantSlot, character: Character, pooled: boolean): boolean {
  const ui = views(s);
  endFighterRenderers(ui.fighters[slot]);
  const pool = pooled ? new FighterPoolPresentation(character, slot, s.origin) : undefined;
  ui.fighters[slot] = { character, shield: new ShieldPresentation(slot, s.origin), projectiles: new ProjectilePresentation(character, s.origin), cues: new SpecialCueEffects(character, s.origin), pool, agency: new AgencyMarker(s.origin), flash: new BodyFlash(character, s.origin),
    hitAreas: s.game.training && s.game.trainer.showHitAreas ? new HitAreaPresentation(s.origin) : undefined,
  };
  return pool?.admitted() === true;
}

export function endFighter(s: ShellState, slot: ParticipantSlot): void {
  const ui = views(s);
  endFighterRenderers(ui.fighters[slot]);
  ui.fighters[slot] = undefined;
}


export function layoutHuds(s: ShellState): void {
  const ui = views(s);
  const active = PARTICIPANT_SLOTS.filter(slot => isActive(s.world, slot));
  active.forEach((slot, position) => {
    ui.huds[slot].layout(position, active.length);
    const { left, centerY, width } = plateManaSlot(position, active.length);
    ui.manaBars[slot].hud.place(left, centerY, width);
  });
}


export function recreateUi(s: ShellState, actions: PanelActions): void {
  const ui = s.ui;
  if (ui === undefined) return;
  if (ui.pause === undefined) ui.pause = new PauseMenu();
  else bindPrototype(ui.pause, PauseMenu.prototype);
  const retainedItems: { readonly items?: ItemPresentation } = ui;
  if (retainedItems.items === undefined) ui.items = new ItemPresentation(s.origin);
  else bindPrototype(ui.items, ItemPresentation.prototype);
  const retainedDrops: { readonly drops?: MeterDropPresentation } = ui;
  if (retainedDrops.drops === undefined) ui.drops = new MeterDropPresentation(s.origin);
  else bindPrototype(ui.drops, MeterDropPresentation.prototype);
  bindPrototype(ui.clock, MatchClock.prototype);
  bindPrototype(ui.training, TrainingReadout.prototype);
  for (const slot of PARTICIPANT_SLOTS) {
    bindPrototype(ui.huds[slot], FighterHud.prototype);
    bindPrototype(ui.bubbles[slot], OffscreenBubble.prototype);
    bindPrototype(ui.escapeMeters[slot], EscapeMeter.prototype);
    bindPrototype(ui.selections[slot], SelectionPanel.prototype);
    if (!ui.selections[slot].hasCpuSettingsFrames()) {
      ui.selections[slot].destroy();
      ui.selections[slot] = new SelectionPanel(actions.selection, slot, menuControls(s));
    } else ui.selections[slot].bindActions(actions.selection);
    bindPrototype(ui.settings[slot], SettingsPanel.prototype);
    ui.settings[slot].bindActions(actions.settings);
  }
  bindPrototype(ui.stage, StagePanel.prototype);
  ui.stage.bindActions(actions.stage);
  bindPrototype(ui.combat, CombatEffects.prototype);
  bindPrototype(ui.frost, FrostEffects.prototype);
  bindPrototype(ui.placed, PlacedObjectEffects.prototype);
  ui.placed.bindNestedCode();
  bindPrototype(ui.special, SpecialEffects.prototype);
  ui.special.bindNestedCode();
  ui.sounds = modelSoundPresentation(s.origin, ui.combat.sounds);
  const retainedBars: { readonly manaBars?: Slots<ManaBars> } = ui;
  if (retainedBars.manaBars === undefined) ui.manaBars = each(createManaBars);
  else for (const slot of PARTICIPANT_SLOTS) {
    bindPrototype(ui.manaBars[slot].hud, ManaBar.prototype);
  }

  const retained: { readonly match?: MatchPresentation } = ui;
  if (retained.match === undefined) ui.match = new MatchPresentation(s.origin);
  else bindPrototype(ui.match, MatchPresentation.prototype);

  const retainedElements: { readonly elements?: { readonly drains?: readonly effect[] } } = ui;
  if (retainedElements.elements === undefined) ui.elements = new ElementEffects(s.origin);
  else if (retainedElements.elements.drains === undefined) {
    ui.elements.destroy();
    ui.elements = new ElementEffects(s.origin);
  } else bindPrototype(ui.elements, ElementEffects.prototype);
  if (ui.classic === undefined) ui.classic = new ClassicPresentation(s.origin);
  else bindPrototype(ui.classic, ClassicPresentation.prototype);
  for (const slot of PARTICIPANT_SLOTS) {
    const renderers = ui.fighters[slot];
    if (renderers === undefined) continue;
    bindPrototype(renderers.shield, ShieldPresentation.prototype);
    bindPrototype(renderers.projectiles, ProjectilePresentation.prototype);
    if (renderers.cues !== undefined) bindPrototype(renderers.cues, SpecialCueEffects.prototype);
    if (renderers.pool !== undefined) bindPrototype(renderers.pool, FighterPoolPresentation.prototype);
    bindPrototype(renderers.agency, AgencyMarker.prototype);
    bindPrototype(renderers.flash, BodyFlash.prototype);
    bindPrototype(renderers.agency.forecast, FighterAgencyForecast.prototype);
    if (renderers.hitAreas !== undefined) bindPrototype(renderers.hitAreas, HitAreaPresentation.prototype);
  }
}

export function settingsOpen(s: Readonly<ShellState>, slot: ParticipantSlot): boolean {
  return views(s).settings[slot].isOpen();
}


export function clearMatchEffects(s: ShellState): void {
  const ui = views(s);
  ui.frost.clear();
  ui.placed.clear();
  ui.elements.clear();
  ui.special.clear();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.projectiles.clear();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.cues?.clear();
  ui.classic?.endMatch();
}

export function pauseEffects(s: ShellState, paused: boolean): void {
  const ui = views(s);
  ui.combat.setPaused(paused);
  ui.special.setPaused(paused);
  ui.elements.setPaused(paused);
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.projectiles.setPaused(paused);
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.cues?.setPaused(paused);
}
