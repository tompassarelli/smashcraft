// A stage-select card (smashcraft:docs/design/stage-select.md): the stage's
// square picture, a coal panel beside it holding the stage's layout silhouette,
// and optionally a name banner along the bottom. Local presentation only.
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { stageInfo } from "../menu/stageCatalog";
import { STAGE_SILHOUETTES, SILHOUETTE_PIECES } from "../menu/stageSilhouettes";
import { createBackdrop, createText, placeTopLeft } from "./frames";
import { MENU_FONT } from "./hudLayout";

const COAL = "ReplaceableTextures\\TeamColor\\TeamColor20.blp";
const SNOW = "ReplaceableTextures\\TeamColor\\TeamColor21.blp";

export class StageCard {
  private readonly picture: framehandle;
  private readonly pieces: framehandle[] = [];
  private readonly name: framehandle | undefined;
  private readonly boxLeft: number;
  private readonly boxTop: number;
  private readonly boxWidth: number;

  constructor(parent: framehandle, id: string, left: number, top: number, width: number, height: number, banner: boolean) {
    const panel = createBackdrop(`${id}Panel`, parent, 0);
    BlzFrameSetTexture(panel, COAL, 0, true);
    placeTopLeft(panel, left, top);
    BlzFrameSetSize(panel, width, height);
    BlzFrameSetEnable(panel, false);
    this.picture = createBackdrop(`${id}Picture`, parent, 0);
    placeTopLeft(this.picture, left, top);
    BlzFrameSetSize(this.picture, height, height);
    BlzFrameSetEnable(this.picture, false);
    const side = width - height;
    this.boxWidth = f32(side * f32(0.84));
    this.boxLeft = f32(left + height + side * f32(0.08));
    this.boxTop = f32(top - height * f32(0.14));
    for (let index = 0; index < SILHOUETTE_PIECES; index++) {
      const piece = createBackdrop(`${id}Piece${I2S(index)}`, parent, index);
      BlzFrameSetTexture(piece, SNOW, 0, true);
      BlzFrameSetAlpha(piece, 230);
      BlzFrameSetEnable(piece, false);
      this.pieces.push(piece);
    }
    if (banner) {
      const strip = createBackdrop(`${id}Banner`, parent, 0);
      BlzFrameSetTexture(strip, COAL, 0, true);
      BlzFrameSetAlpha(strip, 210);
      placeTopLeft(strip, left, f32(top - height * f32(0.78)));
      BlzFrameSetSize(strip, width, f32(height * f32(0.22)));
      BlzFrameSetEnable(strip, false);
      const name = createText(`${id}Name`, parent, 0);
      placeTopLeft(name, f32(left + height * f32(0.06)), f32(top - height * f32(0.78)));
      BlzFrameSetSize(name, f32(width - height * f32(0.08)), f32(height * f32(0.22)));
      BlzFrameSetFont(name, MENU_FONT, f32(height * f32(0.13)), 0);
      BlzFrameSetTextAlignment(name, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
      BlzFrameSetEnable(name, false);
      this.name = name;
    }
  }

  show(choice: number): void {
    const stage = stageInfo(choice);
    BlzFrameSetTexture(this.picture, stage.texture, 0, true);
    if (this.name !== undefined) BlzFrameSetText(this.name, stage.name);
    const pieces = STAGE_SILHOUETTES[choice] ?? [];
    for (let index = 0; index < SILHOUETTE_PIECES; index++) {
      const frame = at(this.pieces, index);
      const piece = pieces[index];
      BlzFrameSetVisible(frame, piece !== undefined);
      if (piece === undefined) continue;
      placeTopLeft(frame, f32(this.boxLeft + piece[0] * this.boxWidth), f32(this.boxTop - piece[1] * this.boxWidth));
      BlzFrameSetSize(frame, f32(piece[2] * this.boxWidth), f32(piece[3] * this.boxWidth));
    }
  }
}
