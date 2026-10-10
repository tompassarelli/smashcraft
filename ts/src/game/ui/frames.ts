



import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";


export type MenuControls = "journal" | "keyboard";

declare global {
  var __smashcraftPlainFrameText: Map<framehandle, string> | undefined;
}

export function gameUi(): framehandle {
  return BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0);
}

export function consoleUi(): framehandle {
  return BlzGetFrameByName("ConsoleUIBackdrop", 0);
}

export function createBackdrop(name: string, owner: framehandle, context: number): framehandle {
  return BlzCreateFrameByType("BACKDROP", name, owner, "", context);
}

export function createText(name: string, owner: framehandle, context: number): framehandle {
  return BlzCreateFrameByType("TEXT", name, owner, "", context);
}

export function placeTopLeft(frame: framehandle, x: number, y: number): void {
  BlzFrameSetAbsPoint(frame, FRAMEPOINT_TOPLEFT, x, y);
}


export function coverScreen(frame: framehandle): void {
  const height = BlzGetLocalClientHeight();
  const width = height <= 0 ? f32(0.8) : (I2R(BlzGetLocalClientWidth()) / I2R(height)) * f32(0.6);
  BlzFrameSetSize(frame, width, f32(0.6));
  BlzFrameSetAbsPoint(frame, FRAMEPOINT_BOTTOM, f32(0.4), 0.0);
}


function releaseFocus(frame: framehandle, clicker: player): void {
  if (GetLocalPlayer() !== clicker) return;
  const enabled = BlzFrameGetEnable(frame);
  BlzFrameSetEnable(frame, !enabled);
  BlzFrameSetEnable(frame, enabled);
  BlzFrameSetFocus(frame, false);
}

export function setFrameText(frame: framehandle, text: string): void {
  if (globalThis.__smashcraftPlainFrameText === undefined) globalThis.__smashcraftPlainFrameText = new Map();
  globalThis.__smashcraftPlainFrameText.set(frame, text);
  BlzFrameSetText(frame, text);
}

export function highlightText(frame: framehandle, highlighted: boolean): void {
  const plain = globalThis.__smashcraftPlainFrameText?.get(frame) ?? "";
  const colored = highlighted && plain !== "" ? `|cffffcc00${plain}|r` : plain;
  BlzFrameSetText(frame, colored);
}

interface Button<T> {
  readonly id: number;
  readonly frame: framehandle;
  readonly target: T;
}





export class ButtonClicks<T> {
  private readonly trigger = CreateTrigger();
  private readonly buttons: Button<T>[] = [];
  private hovered: Button<T> | undefined;
  private hover: ((target: T | undefined, clicker: player) => void) | undefined;

  constructor(private readonly name: string, handle: (target: T, clicker: player) => void, hover?: (target: T | undefined, clicker: player) => void) {
    this.hover = hover;
    TriggerAddAction(this.trigger, trampoline(name));
    this.bindHandler(handle);
  }

  bindHandler(handle: (target: T, clicker: player) => void, hover = this.hover): void {
    this.hover = hover;
    on(this.name, () => {
      const id = GetHandleId(BlzGetTriggerFrame());
      const clicker = GetTriggerPlayer();
      for (const button of this.buttons) {
        if (button.id !== id) continue;
        const event = BlzGetTriggerFrameEvent();
        if (event !== FRAMEEVENT_CONTROL_CLICK) {
          if (GetLocalPlayer() !== clicker) return;
          if (this.hovered !== undefined) highlightText(this.hovered.frame, false);
          this.hovered = event === FRAMEEVENT_MOUSE_ENTER ? button : undefined;
          this.refreshHover();
          this.hover?.(this.hovered?.target, clicker);
          return;
        }
        releaseFocus(button.frame, clicker);
        handle(button.target, clicker);
        return;
      }
    });
  }

  add(frame: framehandle, target: T, text?: string): framehandle {
    if (text !== undefined) setFrameText(frame, text);
    BlzTriggerRegisterFrameEvent(this.trigger, frame, FRAMEEVENT_CONTROL_CLICK);
    BlzTriggerRegisterFrameEvent(this.trigger, frame, FRAMEEVENT_MOUSE_ENTER);
    BlzTriggerRegisterFrameEvent(this.trigger, frame, FRAMEEVENT_MOUSE_LEAVE);
    this.buttons.push({ id: GetHandleId(frame), frame, target });
    return frame;
  }

  refreshHover(): void {
    if (this.hovered !== undefined) highlightText(this.hovered.frame, true);
  }

  destroy(): void {
    DestroyTrigger(this.trigger);
  }
}


export function createSyncTrigger(name: string, prefix: string, senders: readonly number[], handle: (sender: number, data: string) => void): trigger {
  const trigger = CreateTrigger();
  for (const sender of senders) BlzTriggerRegisterPlayerSyncEvent(trigger, Player(sender), prefix, false);
  TriggerAddAction(trigger, trampoline(name));
  bindSyncHandler(name, handle);
  return trigger;
}


export function bindSyncHandler(name: string, handle: (sender: number, data: string) => void): void {
  on(name, () => handle(GetPlayerId(GetTriggerPlayer()), BlzGetTriggerSyncData()));
}
