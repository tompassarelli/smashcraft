



import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";


export type MenuControls = "journal" | "keyboard";

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

interface Button<T> {
  readonly id: number;
  readonly frame: framehandle;
  readonly target: T;
}





export class ButtonClicks<T> {
  private readonly trigger = CreateTrigger();
  private readonly buttons: Button<T>[] = [];

  constructor(private readonly name: string, handle: (target: T, clicker: player) => void) {
    TriggerAddAction(this.trigger, trampoline(name));
    this.bindHandler(handle);
  }

  bindHandler(handle: (target: T, clicker: player) => void): void {
    on(this.name, () => {
      const id = GetHandleId(BlzGetTriggerFrame());
      const clicker = GetTriggerPlayer();
      for (const button of this.buttons) {
        if (button.id !== id) continue;
        releaseFocus(button.frame, clicker);
        handle(button.target, clicker);
        return;
      }
    });
  }

  add(frame: framehandle, target: T): framehandle {
    BlzTriggerRegisterFrameEvent(this.trigger, frame, FRAMEEVENT_CONTROL_CLICK);
    this.buttons.push({ id: GetHandleId(frame), frame, target });
    return frame;
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
