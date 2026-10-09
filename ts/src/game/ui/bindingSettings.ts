



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


export type BindingLoadResult = { kind: "loaded"; encoded: string } | { kind: "empty" } | { kind: "unavailable" };






export interface BindingPersistence {
  load(owner: number, complete: (result: BindingLoadResult) => void): void;
  save(owner: number, encoded: string): void;
}


interface BindingCapture {
  readonly action: Action;
  readonly slot: KeySlot;
}

export interface BindingSettings {
  readonly owner: number;
  readonly persistence: BindingPersistence;
  bindings: KeyBindings;

  ready: boolean;
  capture: BindingCapture | undefined;

  revision: number;

  message: string;
}

export function createBindingSettings(owner: number, persistence: BindingPersistence): BindingSettings {
  return { owner, persistence, bindings: presetBindings("standard"), ready: false, capture: undefined, revision: 0, message: "Loading controls..." };
}


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
