import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { ITEM_HEIGHT } from "../match/centreItem";
import { type MatchState, Phase } from "../match/rules";
import { cameraPoint } from "../presentation/arenaCamera";
import { centreItemText, itemName, itemSeconds, nextItemText } from "../presentation/itemLook";
import { ItemKind } from "../sim/codes";
import type { MatchCamera } from "../sim/matchCamera";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { mainDeckZ } from "../sim/stage";
import { createText, consoleUi } from "../ui/frames";
import { MENU_FONT } from "../ui/hudLayout";
import { hideEffect, STOCK_MODELS, type WorldOrigin } from "./effects";

function label(name: string, width: number): framehandle {
  const frame = createText(name, consoleUi(), 0);
  BlzFrameSetSize(frame, width, f32(0.04));
  BlzFrameSetFont(frame, MENU_FONT, f32(0.011), 1);
  BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
  BlzFrameSetEnable(frame, false);
  BlzFrameSetVisible(frame, false);
  return frame;
}

export class ItemPresentation {
  private readonly centre = label("CentreItem", f32(0.28));
  private readonly clock = label("NextItem", f32(0.15));
  private readonly buffs = PARTICIPANT_SLOTS.map(slot => label(`ItemBuff${slot}`, f32(0.16)));
  private readonly pickup: effect;
  private shownKind: number = ItemKind.none;
  private shownStage = -1;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.pickup = AddSpecialEffect(STOCK_MODELS.immolationTarget, origin.x, origin.y);
    hideEffect(this.pickup, origin);
    BlzFrameSetAbsPoint(this.clock, FRAMEPOINT_CENTER, f32(0.69), f32(0.53));
  }

  private project(frame: framehandle, text: string, camera: Readonly<MatchCamera>, aspect: number, x: number, z: number): void {
    const point = cameraPoint(camera, aspect, x, z);
    const visible = text !== "" && point.column >= 0.0 && point.column <= 1.0 && point.row >= 0.0 && point.row <= 1.0;
    BlzFrameSetVisible(frame, visible);
    if (!visible) return;
    BlzFrameSetAbsPoint(frame, FRAMEPOINT_CENTER, f32(0.4) + (point.column - 0.5) * aspect * f32(0.6), (1.0 - point.row) * f32(0.6));
    BlzFrameSetText(frame, text);
  }

  present(game: Readonly<MatchState>, world: Readonly<Roster>, camera: Readonly<MatchCamera>, aspect: number): void {
    const playing = game.phase === Phase.match;
    const { items, matchFrame } = game;
    const z = mainDeckZ(game.stageChoice);
    this.project(this.centre, playing ? centreItemText(items, matchFrame) : "", camera, aspect, 0.0, z + 90.0);
    const kind = playing ? items.kind : ItemKind.none;
    if (kind !== ItemKind.none && (kind !== this.shownKind || game.stageChoice !== this.shownStage)) {
      BlzSetSpecialEffectPosition(this.pickup, this.origin.x, this.origin.y, this.origin.z + z + ITEM_HEIGHT);
      BlzSetSpecialEffectScale(this.pickup, 0.5);
      BlzSetSpecialEffectColor(this.pickup, items.kind === ItemKind.speed ? 80 : 220, items.kind === ItemKind.heavy ? 160 : 255, items.kind === ItemKind.speed ? 100 : 255);
    } else if (kind === ItemKind.none && this.shownKind !== ItemKind.none) hideEffect(this.pickup, this.origin);
    this.shownKind = kind;
    this.shownStage = game.stageChoice;
    for (const slot of PARTICIPANT_SLOTS) {
      const f = isActive(world, slot) ? fighterAt(world, slot) : undefined;
      const text = playing && f !== undefined && !f.status.out && f.status.buffFrames > 0 ? `${itemName(f.status.buff)} ${itemSeconds(f.status.buffFrames)}s` : "";
      this.project(at(this.buffs, slot), text, camera, aspect, f?.motion.x ?? 0.0, (f?.motion.z ?? 0.0) + 170.0);
    }
  }

  hud(game: Readonly<MatchState>, visible: boolean): void {
    const text = nextItemText(game.items, game.matchFrame);
    BlzFrameSetVisible(this.clock, visible && game.phase === Phase.match && text !== "");
    BlzFrameSetText(this.clock, text);
  }
}
