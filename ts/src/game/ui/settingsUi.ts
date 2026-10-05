// One participant's controls screen. Every client builds all four and tracks
// whether each is open from synchronized events; only the owner's client draws
// its own. Escape and captured keys arrive through the shell's key handling.
import { f32 } from "../../sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { ACTION_COUNT, type Action } from "../input/actions";
import { ACTION_LABELS, type KeySlot, encodeBindings, keyFor, keyLabel } from "../input/keyBindings";
import {
  type BindingSettings,
  applyBindingPreset,
  beginBindingCapture,
  cancelBindingCapture,
  saveBindingSettings,
} from "./bindingSettings";
import { ButtonClicks, createText, gameUi, placeTopLeft } from "./frames";

export interface SettingsActions {
  closeSettings(participantId: number): void;
}

type SettingsButton = { kind: "standard" } | { kind: "custom" } | { kind: "save" } | { kind: "close" } | { kind: "key"; action: Action; slot: KeySlot };

interface ActionRow {
  readonly action: Action;
  readonly label: framehandle;
  readonly keys: readonly [framehandle, framehandle];
}

const KEY_SLOTS = [0, 1] as const;

export class SettingsPanel {
  private readonly title: framehandle;
  private readonly help: framehandle;
  private readonly status: framehandle;
  private readonly buttons: readonly framehandle[];
  private readonly rows: readonly ActionRow[];
  /** Every frame the screen owns, for showing, hiding and destroying them together. */
  private readonly all: framehandle[];
  private readonly clicks: ButtonClicks<SettingsButton>;
  private open = false;
  private lastSignature = "";

  constructor(
    private readonly settings: BindingSettings,
    private actions: SettingsActions,
    readonly participantId: number,
  ) {
    const suffix = I2S(participantId);
    const offset = participantId * 100;
    this.clicks = new ButtonClicks(`ui.settings.${suffix}.click`, (button, clicker) => this.click(button, clicker));
    const text = (name: string, context: number, x: number, y: number, width: number, height: number): framehandle => {
      const frame = createText(name, gameUi(), context);
      placeTopLeft(frame, x, y);
      BlzFrameSetSize(frame, width, height);
      return frame;
    };
    const button = (name: string, context: number, x: number, y: number, width: number, label: string, target: SettingsButton): framehandle => {
      const frame = BlzCreateFrameByType("GLUETEXTBUTTON", name, gameUi(), "ScriptDialogButton", context);
      placeTopLeft(frame, x, y);
      BlzFrameSetSize(frame, width, f32(0.032));
      BlzFrameSetText(frame, label);
      return this.clicks.add(frame, target);
    };
    this.title = text(`MeleeSettingsTitle${suffix}`, 410 + offset, f32(0.17), f32(0.575), f32(0.48), f32(0.035));
    BlzFrameSetText(this.title, "CONTROLS");
    this.help = text(`MeleeSettingsHelp${suffix}`, 411 + offset, f32(0.17), f32(0.542), f32(0.48), f32(0.032));
    BlzFrameSetText(this.help, "Choose a preset, then click a key and press its replacement.");
    this.status = text(`MeleeSettingsStatus${suffix}`, 412 + offset, f32(0.17), f32(0.105), f32(0.48), f32(0.03));
    this.buttons = [
      button(`MeleeSettingsQwerty${suffix}`, 420 + offset, f32(0.17), f32(0.065), f32(0.105), "QWERTY", { kind: "standard" }),
      button(`MeleeSettingsCustom${suffix}`, 421 + offset, f32(0.28), f32(0.065), f32(0.105), "Custom", { kind: "custom" }),
      button(`MeleeSettingsSave${suffix}`, 422 + offset, f32(0.39), f32(0.065), f32(0.105), "Save", { kind: "save" }),
      button(`MeleeSettingsClose${suffix}`, 424 + offset, 0.5, f32(0.065), f32(0.105), "Back", { kind: "close" }),
    ];
    const rows: ActionRow[] = [];
    for (let index = 0; index < ACTION_COUNT; index++) {
      const action = index as Action;
      const y = f32(0.505) - action * f32(0.025);
      const label = text(`MeleeSettingsAction${suffix}${I2S(action)}`, 430 + offset + action, f32(0.18), y, f32(0.22), f32(0.025));
      const key = (slot: KeySlot, x: number): framehandle => {
        const keyIndex = action * 2 + slot;
        const frame = button(`MeleeSettingsKey${suffix}${I2S(keyIndex)}`, 460 + offset + keyIndex, x, y, f32(0.095), "—", { kind: "key", action, slot });
        BlzFrameSetSize(frame, f32(0.095), f32(0.024));
        return frame;
      };
      rows.push({ action, label, keys: [key(0, f32(0.41)), key(1, f32(0.52))] });
    }
    this.rows = rows;
    this.all = [this.title, this.help, this.status, ...this.buttons];
    for (const row of rows) this.all.push(row.label, ...row.keys);
    this.setVisible(false);
  }

  bindActions(actions: SettingsActions): void {
    this.actions = actions;
    bindPrototype(this.clicks, ButtonClicks.prototype);
    this.clicks.bindHandler((button, clicker) => this.click(button, clicker));
  }

  destroy(): void {
    this.clicks.destroy();
    for (const frame of this.all) BlzDestroyFrame(frame);
  }

  private setVisible(visible: boolean): void {
    for (const frame of this.all) BlzFrameSetVisible(frame, visible);
  }

  private click(button: SettingsButton, clicker: player): void {
    if (clicker !== Player(this.participantId)) return;
    const { settings } = this;
    if (button.kind === "standard") applyBindingPreset(settings, "standard");
    else if (button.kind === "custom") applyBindingPreset(settings, "custom");
    else if (button.kind === "save") saveBindingSettings(settings);
    else if (button.kind === "close") this.close();
    else beginBindingCapture(settings, button.action, button.slot);
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Opens the screen once the bindings have loaded; from a synchronized event. */
  show(): void {
    if (!this.settings.ready) return;
    this.open = true;
    this.lastSignature = "";
    this.update();
  }

  /** From a synchronized event: the Back button or the owner's Escape key. */
  close(): void {
    this.open = false;
    cancelBindingCapture(this.settings);
    this.setVisible(false);
    this.actions.closeSettings(this.participantId);
  }

  /** Every rendered frame on every client; redraws the owner's open screen when its content changed. */
  update(): void {
    if (GetLocalPlayer() !== Player(this.participantId) || !this.open) return;
    const { settings } = this;
    const { capture } = settings;
    const signature = `${encodeBindings(settings.bindings)}${settings.message}${capture === undefined ? "0" : "1"}${settings.ready ? "1" : "0"}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.setVisible(true);
    BlzFrameSetText(this.status, settings.message);
    BlzFrameSetText(this.help, capture === undefined ? "Click a binding to change it. Each action accepts two keys." : "Press an unassigned key. Escape cancels.");
    for (const { action, label, keys } of this.rows) {
      BlzFrameSetText(label, ACTION_LABELS[action]);
      for (const slot of KEY_SLOTS) {
        const capturing = capture?.action === action && capture.slot === slot;
        BlzFrameSetText(keys[slot], `${capturing ? "> " : ""}${keyLabel(keyFor(settings.bindings, action, slot))}`);
      }
    }
  }
}
