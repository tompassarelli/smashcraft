// One participant's key bindings and the state of the controls screen that
// edits them. The record is synchronized: every client holds one per
// participant and changes it only from synchronized events (frame clicks, key
// events, a completed load). Persistence is the shell's boundary.
import type { Action } from "../input/actions";
import {
  ACTION_LABELS,
  type BindingPreset,
  type KeyBindings,
  type KeySlot,
  decodeBindings,
  encodeBindings,
  presetBindings,
  rebind,
} from "../input/keyBindings";

/** What reading a player's saved bindings produced, delivered to every client. */
export type BindingLoadResult = { kind: "loaded"; encoded: string } | { kind: "empty" } | { kind: "unavailable" };

/**
 * The player-file boundary the shell provides. `load` reads the owner's file
 * and synchronizes the result, calling `complete` on every client; `save`
 * writes the encoded bindings to the owner's file.
 */
export interface BindingPersistence {
  load(owner: number, complete: (result: BindingLoadResult) => void): void;
  save(owner: number, encoded: string): void;
}

/** The key slot waiting for its next key press. */
interface BindingCapture {
  readonly action: Action;
  readonly slot: KeySlot;
}

export interface BindingSettings {
  readonly owner: number;
  readonly persistence: BindingPersistence;
  bindings: KeyBindings;
  /** False until the saved bindings have loaded. */
  ready: boolean;
  capture: BindingCapture | undefined;
  /** Counts changes to `bindings`, so input state can follow them. */
  revision: number;
  /** What the controls screen tells the player. */
  message: string;
}

export function createBindingSettings(owner: number, persistence: BindingPersistence): BindingSettings {
  return { owner, persistence, bindings: presetBindings("standard"), ready: false, capture: undefined, revision: 0, message: "Loading controls..." };
}

/** Loads a human participant's saved bindings; the standard preset stands until the load completes. */
export function initializeBindingSettings(settings: BindingSettings): void {
  settings.bindings = presetBindings("standard");
  settings.persistence.load(settings.owner, (result) => {
    const saved = result.kind === "loaded" ? decodeBindings(result.encoded) : undefined;
    if (saved !== undefined) {
      settings.bindings = saved;
      settings.message = "Saved controls loaded.";
    } else {
      settings.bindings = presetBindings("standard");
      settings.message = result.kind === "loaded" ? "Saved controls were invalid; using QWERTY defaults." : "QWERTY controls ready.";
    }
    settings.revision++;
    settings.ready = true;
  });
}

/** A participant without a player file, such as a computer, uses the standard preset at once. */
export function useDefaultBindings(settings: BindingSettings): void {
  settings.bindings = presetBindings("standard");
  settings.ready = true;
  settings.revision++;
}

export function applyBindingPreset(settings: BindingSettings, preset: BindingPreset): void {
  if (!settings.ready) return;
  settings.bindings = presetBindings(preset);
  settings.revision++;
  settings.capture = undefined;
  settings.message = preset === "custom" ? "Custom controls selected." : "QWERTY controls selected.";
}

export function beginBindingCapture(settings: BindingSettings, action: Action, slot: KeySlot): void {
  if (!settings.ready) return;
  settings.capture = { action, slot };
  settings.message = `Press a key for ${ACTION_LABELS[action]}.`;
}

/** Offers a pressed key to a waiting capture; true when the capture consumed it, accepted or not. */
export function captureBinding(settings: BindingSettings, key: number): boolean {
  const { capture } = settings;
  if (capture === undefined) return false;
  if (rebind(settings.bindings, capture.action, capture.slot, key)) {
    settings.capture = undefined;
    settings.revision++;
    settings.message = "Binding updated.";
  } else {
    settings.message = "That key is reserved or already assigned. Press another key.";
  }
  return true;
}

export function saveBindingSettings(settings: BindingSettings): void {
  if (!settings.ready) return;
  settings.capture = undefined;
  settings.persistence.save(settings.owner, encodeBindings(settings.bindings));
  settings.message = "Controls saved for next time.";
}

export function cancelBindingCapture(settings: BindingSettings): void {
  settings.capture = undefined;
}
