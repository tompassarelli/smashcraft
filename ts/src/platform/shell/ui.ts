// The menus, HUD and renderers the shell drives. A hot reload keeps their
// native handles and mutable state, and binds their objects to the new code.
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../../game/input/participants";
import { CombatEffects } from "../../game/render/combatEffects";
import { FighterPoolPresentation } from "../../game/render/fighterPool";
import { AgencyMarker } from "../../game/render/agencyMarker";
import { FighterAgencyForecast } from "../../game/presentation/fighterAgency";
import { FrostEffects } from "../../game/render/frostEffects";
import { modelSoundPresentation } from "../../game/render/modelSoundPresentation";
import type { ModelSoundSink } from "../../game/render/modelSounds";
import { ProjectilePresentation } from "../../game/render/projectilePresentation";
import { ShieldPresentation } from "../../game/render/shieldPresentation";
import { SpecialEffects } from "../../game/render/specialEffects";
import type { Character } from "../../game/sim/codes";
import { isActive } from "../../game/sim/roster";
import type { MenuControls } from "../../game/ui/frames";
import { FighterHud, MatchClock } from "../../game/ui/matchHud";
import { type SelectionActions, SelectionPanel } from "../../game/ui/selectionUi";
import { type SettingsActions, SettingsPanel } from "../../game/ui/settingsUi";
import { type StageActions, StagePanel } from "../../game/ui/stageUi";
import type { ShellState } from "./state";
import { bindPrototype } from "../rebind";

/** A fighter's renderers for one match; the pool only in pooled presentation. */
interface FighterRenderers {
  readonly character: Character;
  readonly shield: ShieldPresentation;
  readonly projectiles: ProjectilePresentation;
  readonly pool: FighterPoolPresentation | undefined;
  readonly agency: AgencyMarker;
}

export interface UiObjects {
  readonly clock: MatchClock;
  readonly huds: Slots<FighterHud>;
  readonly selections: Slots<SelectionPanel>;
  readonly settings: Slots<SettingsPanel>;
  readonly stage: StagePanel;
  readonly combat: CombatEffects;
  readonly frost: FrostEffects;
  readonly special: SpecialEffects;
  readonly fighters: Slots<FighterRenderers | undefined>;
  sounds: ModelSoundSink;
}

/** What the panels ask the game to do; menus.ts implements them over the shell. */
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

function menuControls(s: Readonly<ShellState>): MenuControls {
  return s.build.input.kind === "journal" && s.build.input.ingress === "editbox" ? "journal" : "keyboard";
}

/** Creates every shared panel, HUD plate and effect pool, on every client in the same order. */
export function createUi(s: ShellState, actions: PanelActions): UiObjects {
  const controls = menuControls(s);
  const ui: UiObjects = {
    clock: new MatchClock(),
    huds: each(slot => new FighterHud(slot, 4)),
    stage: new StagePanel(actions.stage, controls),
    selections: each(slot => new SelectionPanel(actions.selection, slot, controls)),
    settings: each(slot => new SettingsPanel(s.participants[slot].bindings, actions.settings, slot)),
    combat: new CombatEffects(s.origin),
    frost: new FrostEffects(s.origin),
    special: new SpecialEffects(s.origin),
    fighters: [undefined, undefined, undefined, undefined],
    sounds: modelSoundPresentation(s.origin),
  };
  s.ui = ui;
  return ui;
}

function endFighterRenderers(renderers: FighterRenderers | undefined): void {
  renderers?.shield.destroy();
  renderers?.projectiles.destroy();
  renderers?.pool?.destroy();
  renderers?.agency.destroy();
}

/**
 * Creates a fighter's shield and projectile renderers, and its pooled clip
 * models when pooled; true when the pool admitted the character.
 */
export function beginFighterRenderers(s: ShellState, slot: ParticipantSlot, character: Character, pooled: boolean): boolean {
  const ui = views(s);
  endFighterRenderers(ui.fighters[slot]);
  const pool = pooled ? new FighterPoolPresentation(character, slot, s.origin) : undefined;
  ui.fighters[slot] = { character, shield: new ShieldPresentation(slot, s.origin), projectiles: new ProjectilePresentation(character, s.origin), pool, agency: new AgencyMarker(s.origin) };
  return pool?.admitted() === true;
}

export function endFighter(s: ShellState, slot: ParticipantSlot): void {
  const ui = views(s);
  endFighterRenderers(ui.fighters[slot]);
  ui.fighters[slot] = undefined;
}

/** Places each active fighter's HUD plate along the bottom of the screen. */
export function layoutHuds(s: ShellState): void {
  const ui = views(s);
  const active = PARTICIPANT_SLOTS.filter(slot => isActive(s.world, slot));
  active.forEach((slot, position) => ui.huds[slot].layout(position, active.length));
}

/** Rebind retained UI and renderer handles to this bundle's methods and actions. */
export function recreateUi(s: ShellState, actions: PanelActions): void {
  const ui = s.ui;
  if (ui === undefined) return;
  bindPrototype(ui.clock, MatchClock.prototype);
  for (const slot of PARTICIPANT_SLOTS) {
    bindPrototype(ui.huds[slot], FighterHud.prototype);
    bindPrototype(ui.selections[slot], SelectionPanel.prototype);
    ui.selections[slot].bindActions(actions.selection);
    bindPrototype(ui.settings[slot], SettingsPanel.prototype);
    ui.settings[slot].bindActions(actions.settings);
  }
  bindPrototype(ui.stage, StagePanel.prototype);
  ui.stage.bindActions(actions.stage);
  bindPrototype(ui.combat, CombatEffects.prototype);
  bindPrototype(ui.frost, FrostEffects.prototype);
  bindPrototype(ui.special, SpecialEffects.prototype);
  ui.special.bindNestedCode();
  ui.sounds = modelSoundPresentation(s.origin);
  for (const slot of PARTICIPANT_SLOTS) {
    const renderers = ui.fighters[slot];
    if (renderers === undefined) continue;
    bindPrototype(renderers.shield, ShieldPresentation.prototype);
    bindPrototype(renderers.projectiles, ProjectilePresentation.prototype);
    if (renderers.pool !== undefined) bindPrototype(renderers.pool, FighterPoolPresentation.prototype);
    bindPrototype(renderers.agency, AgencyMarker.prototype);
    bindPrototype(renderers.agency.forecast, FighterAgencyForecast.prototype);
  }
}

export function settingsOpen(s: Readonly<ShellState>, slot: ParticipantSlot): boolean {
  return views(s).settings[slot].isOpen();
}

/** Ends frost and special effects and every projectile, as at a result or a departure. */
export function clearMatchEffects(s: ShellState): void {
  const ui = views(s);
  ui.frost.clear();
  ui.special.clear();
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.projectiles.clear();
}

export function pauseEffects(s: ShellState, paused: boolean): void {
  const ui = views(s);
  ui.combat.setPaused(paused);
  ui.special.setPaused(paused);
  for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.projectiles.setPaused(paused);
}
