import { type MatchState, Phase } from "../match/rules";
import { DROP_HEIGHT, dropTelegraphFrames, meterDropPoint } from "../match/meterDrops";
import { DEFINITIVE_DROP_ORB_SCALE, DROP_ORB_SCALE, dropMarkerAlpha, dropMarkerScale } from "../presentation/dropLook";
import { definitiveCues } from "./specialCueEffects";
import { hideEffect, STOCK_MODELS, type WorldOrigin } from "./effects";

export class MeterDropPresentation {
  private readonly marker: effect;
  private readonly orb: effect;
  private markerShown = false;
  private orbPoint = -1;
  private orbStage = -1;
  private readonly definitive = definitiveCues();

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.marker = AddSpecialEffect(this.definitive ? STOCK_MODELS.definitiveDropMarker : STOCK_MODELS.massTeleportTarget, origin.x, origin.y);
    this.orb = AddSpecialEffect(this.definitive ? STOCK_MODELS.definitiveDropOrb : STOCK_MODELS.frostWyrmMissile, origin.x, origin.y);
    hideEffect(this.marker, origin);
    hideEffect(this.orb, origin);
  }

  present(game: Readonly<MatchState>): void {
    const playing = game.phase === Phase.match;
    const { drops } = game;
    const left = playing ? dropTelegraphFrames(drops, game.matchFrame) : undefined;
    if (left !== undefined) {
      const point = meterDropPoint(game.stageChoice, drops.nextPoint);
      BlzSetSpecialEffectPosition(this.marker, this.origin.x + point.x, this.origin.y, this.origin.z + point.z);
      BlzSetSpecialEffectScale(this.marker, dropMarkerScale(left, this.definitive));
      BlzSetSpecialEffectAlpha(this.marker, dropMarkerAlpha(left));
      this.markerShown = true;
    } else if (this.markerShown) {
      hideEffect(this.marker, this.origin);
      this.markerShown = false;
    }
    const live = playing ? drops.point : -1;
    if (live >= 0 && (live !== this.orbPoint || game.stageChoice !== this.orbStage)) {
      const point = meterDropPoint(game.stageChoice, live);
      BlzSetSpecialEffectPosition(this.orb, this.origin.x + point.x, this.origin.y, this.origin.z + point.z + DROP_HEIGHT);
      BlzSetSpecialEffectScale(this.orb, this.definitive ? DEFINITIVE_DROP_ORB_SCALE : DROP_ORB_SCALE);
    } else if (live < 0 && this.orbPoint >= 0) hideEffect(this.orb, this.origin);
    this.orbPoint = live;
    this.orbStage = game.stageChoice;
  }
}
