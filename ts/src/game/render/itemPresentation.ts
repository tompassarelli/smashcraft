import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { ITEM_HEIGHT } from "../match/centreItem";
import { type MatchState, Phase } from "../match/rules";
import { ItemKind } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { mainDeckZAt } from "../sim/stage";
import { hideEffect, parkOnce, STOCK_MODELS, type ParkedFlags, type WorldOrigin } from "./effects";

export class ItemPresentation {
  private readonly pickup: effect;
  private readonly buffs: readonly effect[];
  private parked: ParkedFlags | undefined;
  private shownKind: number = ItemKind.none;
  private shownStage = -1;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.pickup = AddSpecialEffect(STOCK_MODELS.immolationTarget, origin.x, origin.y);
    this.buffs = PARTICIPANT_SLOTS.map(() => AddSpecialEffect(STOCK_MODELS.immolationTarget, origin.x, origin.y));
    hideEffect(this.pickup, origin);
    this.buffs.forEach((buff, slot) => parkOnce(buff, origin, (this.parked ??= []), slot));
  }

  private tint(effect: effect, kind: number): void {
    BlzSetSpecialEffectColor(effect, kind === ItemKind.speed ? 80 : 220, kind === ItemKind.heavy ? 160 : 255, kind === ItemKind.speed ? 100 : 255);
  }

  present(game: Readonly<MatchState>, world: Readonly<Roster>): void {
    const playing = game.phase === Phase.match;
    const { items } = game;
    const z = mainDeckZAt(game.stageChoice, 0.0);
    const kind = playing ? items.kind : ItemKind.none;
    if (kind !== ItemKind.none && (kind !== this.shownKind || game.stageChoice !== this.shownStage)) {
      BlzSetSpecialEffectPosition(this.pickup, this.origin.x, this.origin.y, this.origin.z + z + ITEM_HEIGHT);
      BlzSetSpecialEffectScale(this.pickup, 0.5);
      this.tint(this.pickup, kind);
    } else if (kind === ItemKind.none && this.shownKind !== ItemKind.none) hideEffect(this.pickup, this.origin);
    this.shownKind = kind;
    this.shownStage = game.stageChoice;
    const parked = (this.parked ??= []);
    for (const slot of PARTICIPANT_SLOTS) {
      const fighter = playing && isActive(world, slot) ? fighterAt(world, slot) : undefined;
      const cue = this.buffs[slot];
      if (cue === undefined) continue;
      if (fighter === undefined || fighter.status.out || fighter.status.buffFrames <= 0) parkOnce(cue, this.origin, parked, slot);
      else {
        parked[slot] = false;
        BlzSetSpecialEffectPosition(cue, this.origin.x + fighter.motion.x, this.origin.y, this.origin.z + fighter.motion.z + 35.0);
        BlzSetSpecialEffectScale(cue, f32(0.4));
        this.tint(cue, fighter.status.buff);
      }
    }
  }
}
