// Frames and events shared by the menus and the HUD. Every client creates the
// same frames and triggers in the same order; only visibility, text and cursor
// art differ per client, and a choice reaches the game through a synchronized
// event (a frame click or player sync data).
import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";

/** The controls a build's menus accept, which their help text names. */
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

/** Sizes a backdrop to this client's whole screen, whatever its aspect ratio. */
export function coverScreen(frame: framehandle): void {
  const height = BlzGetLocalClientHeight();
  const width = height <= 0 ? f32(0.8) : (I2R(BlzGetLocalClientWidth()) / I2R(height)) * f32(0.6);
  BlzFrameSetSize(frame, width, f32(0.6));
  BlzFrameSetAbsPoint(frame, FRAMEPOINT_BOTTOM, f32(0.4), 0.0);
}

/** Gives the clicking player's keyboard back to the game: a focused button would swallow hotkeys. */
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

/**
 * One trigger receiving a panel's button clicks through a dispatch trampoline.
 * Clicks are synchronized: the handler runs on every client with the clicker.
 */
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

/** A trigger, run through a dispatch trampoline, for the data these players send with a sync prefix. */
export function createSyncTrigger(name: string, prefix: string, senders: readonly number[], handle: (sender: number, data: string) => void): trigger {
  const trigger = CreateTrigger();
  for (const sender of senders) BlzTriggerRegisterPlayerSyncEvent(trigger, Player(sender), prefix, false);
  TriggerAddAction(trigger, trampoline(name));
  bindSyncHandler(name, handle);
  return trigger;
}

/** Replace the code behind a retained trigger without creating or destroying it. */
export function bindSyncHandler(name: string, handle: (sender: number, data: string) => void): void {
  on(name, () => handle(GetPlayerId(GetTriggerPlayer()), BlzGetTriggerSyncData()));
}
