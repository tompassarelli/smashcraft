



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
import { AUTO_DELAY, type DelayChoice, MAX_FIXED_DELAY } from "../netcode/delayPolicy";


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
  delay: DelayChoice;

  ready: boolean;
  capture: BindingCapture | undefined;

  revision: number;

  message: string;
}

export function createBindingSettings(owner: number, persistence: BindingPersistence): BindingSettings {
  return { owner, persistence, bindings: presetBindings("standard"), delay: AUTO_DELAY, ready: false, capture: undefined, revision: 0, message: "Loading controls..." };
}


const DELAY_MARK = "D";
const DELAY_CODES = "012345678";

export function encodeSettings(settings: Readonly<BindingSettings>): string {
  return `${encodeBindings(settings.bindings)}${DELAY_MARK}${settings.delay === AUTO_DELAY ? "A" : DELAY_CODES.charAt(settings.delay)}`;
}

export function decodeDelay(encoded: string): { readonly bindings: string; readonly delay: DelayChoice } {
  const at = encoded.length - 2;
  if (at < 0 || encoded.charAt(at) !== DELAY_MARK) return { bindings: encoded, delay: AUTO_DELAY };
  const code = encoded.charAt(at + 1);
  const fixed = DELAY_CODES.indexOf(code);
  return { bindings: encoded.slice(0, at), delay: fixed >= 0 && fixed <= MAX_FIXED_DELAY ? fixed : AUTO_DELAY };
}

export function chooseDelay(settings: BindingSettings, delay: DelayChoice): void {
  if (!settings.ready) return;
  settings.delay = delay;
  settings.revision++;
  settings.message = delay === AUTO_DELAY ? "Delay set to Auto. Save to keep it." : `Delay set to ${delay} frames. Save to keep it.`;
}

export function initializeBindingSettings(settings: BindingSettings): void {
  settings.bindings = presetBindings("standard");
  settings.delay = AUTO_DELAY;
  settings.persistence.load(settings.owner, (result) => {
    const stored = result.kind === "loaded" ? decodeDelay(result.encoded) : undefined;
    const saved = stored === undefined ? undefined : decodeBindings(stored.bindings);
    if (stored !== undefined && saved !== undefined) settings.delay = stored.delay;
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
  settings.delay = AUTO_DELAY;
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
  settings.persistence.save(settings.owner, encodeSettings(settings));
  settings.message = "Controls saved for next time.";
}

export function cancelBindingCapture(settings: BindingSettings): void {
  settings.capture = undefined;
}
