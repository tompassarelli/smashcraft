// The menus, HUD and renderers the shell drives. They are objects that keep
// the code they were created with, so a hot reload destroys and recreates
// them; the bindings and match they show live in the shell's state.
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../../game/input/participants";
import { CombatEffects } from "../../game/render/combatEffects";
import { FighterPoolPresentation } from "../../game/render/fighterPool";
import { FrostEffects } from "../../game/render/frostEffects";
import { modelSoundPresentation } from "../../game/render/modelSoundPresentation";
import type { ModelSoundSink } from "../../game/render/modelSounds";
import { ProjectilePresentation } from "../../game/render/projectilePresentation";
import { ShieldPresentation } from "../../game/render/shieldPresentation";
import { SpecialEffects } from "../../game/render/specialEffects";
import type { Character } from "../../game/sim/codes";
import { fighterAt, isActive } from "../../game/sim/roster";
import type { MenuControls } from "../../game/ui/frames";
import { FighterHud, MatchClock } from "../../game/ui/matchHud";
import { type SelectionActions, SelectionPanel } from "../../game/ui/selectionUi";
import { type SettingsActions, SettingsPanel } from "../../game/ui/settingsUi";
import { type StageActions, StagePanel } from "../../game/ui/stageUi";
import type { ShellState } from "./state";

/** A fighter's renderers for one match; the pool only in pooled presentation. */
export interface FighterRenderers {
  readonly character: Character;
  readonly shield: ShieldPresentation;
  readonly projectiles: ProjectilePresentation;
  readonly pool: FighterPoolPresentation | undefined;
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
  readonly sounds: ModelSoundSink;
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
}

function destroyUi(ui: UiObjects): void {
  ui.clock.destroy();
  for (const slot of PARTICIPANT_SLOTS) {
    ui.huds[slot].destroy();
    ui.selections[slot].destroy();
    ui.settings[slot].destroy();
    endFighterRenderers(ui.fighters[slot]);
  }
  ui.stage.destroy();
  ui.combat.destroy();
  ui.frost.destroy();
  ui.special.destroy();
}

/**
 * Creates a fighter's shield and projectile renderers, and its pooled clip
 * models when pooled; true when the pool admitted the character.
 */
export function beginFighterRenderers(s: ShellState, slot: ParticipantSlot, character: Character, pooled: boolean): boolean {
  const ui = views(s);
  endFighterRenderers(ui.fighters[slot]);
  const pool = pooled ? new FighterPoolPresentation(character, slot, s.origin) : undefined;
  ui.fighters[slot] = { character, shield: new ShieldPresentation(slot, s.origin), projectiles: new ProjectilePresentation(character, s.origin), pool };
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

/** After a hot reload: the new code's objects replace the old, showing the same match. */
export function recreateUi(s: ShellState, actions: PanelActions): void {
  const old = s.ui;
  if (old === undefined) return;
  const open = PARTICIPANT_SLOTS.filter(slot => old.settings[slot].isOpen());
  destroyUi(old);
  const ui = createUi(s, actions);
  layoutHuds(s);
  for (const slot of open) ui.settings[slot].show();
  for (const slot of PARTICIPANT_SLOTS) {
    const renderers = old.fighters[slot];
    if (renderers === undefined || !isActive(s.world, slot)) continue;
    beginFighterRenderers(s, slot, fighterAt(s.world, slot).character, renderers.pool !== undefined);
  }
  if (s.session.paused) {
    ui.combat.setPaused(true);
    ui.special.setPaused(true);
    for (const slot of PARTICIPANT_SLOTS) ui.fighters[slot]?.projectiles.setPaused(true);
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
