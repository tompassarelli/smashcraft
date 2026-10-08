// Classic's presentation (#284): the boss's stock model scaled up over the
// stage, its strikes' warnings and hits drawn with stock spell art, and the
// ending card. Effects are created when a boss match starts and destroyed when
// it ends, both synchronized; presenting only moves, shows and hides them.
import { f32 } from "wisp/src/sim/f32";
import { BossPhase, bossClock, bossDefinition, bossMoment, bossPosition, zoneCenter, type BossDefinition, type BossMoment } from "../classic/bosses";
import { classicEnding } from "../classic/classicText";
import { BossKind } from "../classic/runState";
import { type MatchState, Phase } from "../match/rules";
import { fighterPortrait } from "../sim/heroes/registry";
import { createBackdrop, createText, gameUi, placeTopLeft } from "../ui/frames";
import { MENU_FONT } from "../ui/hudLayout";
import { type ParkedFlags, type WorldOrigin, parkOnce } from "./effects";

/** Strike art per zone; no strike has more zones than this. */
const ZONE_EFFECTS = 4;
const QUARTER_TURN = f32(1.5707963);
const PANEL_TEXTURE = "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp";

const moment: BossMoment = { strike: -1, index: 0, phase: BossPhase.opening, frame: 0 };

export class ClassicPresentation {
  private boss: BossDefinition | undefined;
  private body: effect | undefined;
  private tells: effect[] = [];
  private hits: effect[] = [];
  private readonly parked: ParkedFlags = [];
  private lastStrike = -1;
  private lastPhase: BossPhase = BossPhase.opening;
  private readonly card: framehandle;
  private readonly portrait: framehandle;
  private readonly speaker: framehandle;
  private readonly lines: framehandle;
  private readonly results: framehandle;
  private cardText = "";

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.card = createBackdrop("ClassicEndingCard", gameUi(), 893);
    BlzFrameSetTexture(this.card, PANEL_TEXTURE, 0, true);
    placeTopLeft(this.card, f32(0.15), f32(0.47));
    BlzFrameSetSize(this.card, f32(0.5), f32(0.2));
    BlzFrameSetEnable(this.card, false);
    this.portrait = createBackdrop("ClassicEndingPortrait", this.card, 894);
    placeTopLeft(this.portrait, f32(0.165), f32(0.455));
    BlzFrameSetSize(this.portrait, f32(0.12), f32(0.17));
    BlzFrameSetEnable(this.portrait, false);
    const text = (name: string, context: number, top: number, height: number, size: number): framehandle => {
      const frame = createText(name, this.card, context);
      placeTopLeft(frame, f32(0.3), top);
      BlzFrameSetSize(frame, f32(0.335), height);
      BlzFrameSetFont(frame, MENU_FONT, size, 0);
      BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
      BlzFrameSetEnable(frame, false);
      return frame;
    };
    this.speaker = text("ClassicEndingSpeaker", 895, f32(0.455), f32(0.022), f32(0.015));
    this.lines = text("ClassicEndingLines", 896, f32(0.43), f32(0.1), f32(0.011));
    this.results = text("ClassicEndingResults", 897, f32(0.32), f32(0.04), f32(0.0095));
    BlzFrameSetVisible(this.card, false);
  }

  /** At a match start: a boss match's model and strike art. */
  beginMatch(game: Readonly<MatchState>): void {
    this.endMatch();
    const boss = game.run.active ? bossDefinition(game.run.boss.kind) : undefined;
    if (boss === undefined) return;
    this.boss = boss;
    const { x, y, z } = this.origin;
    this.body = AddSpecialEffect(boss.model, x, y + boss.depth);
    BlzSetSpecialEffectScale(this.body, boss.scale);
    BlzSetSpecialEffectColor(this.body, boss.tint[0], boss.tint[1], boss.tint[2]);
    BlzSetSpecialEffectYaw(this.body, -QUARTER_TURN);
    for (let index = 0; index < ZONE_EFFECTS; index++) {
      this.tells.push(AddSpecialEffect(boss.tellArt, x, y));
      this.hits.push(AddSpecialEffect(boss.hitArt, x, y));
    }
    for (let index = 0; index < ZONE_EFFECTS * 2; index++) this.parked[index] = false;
    this.lastStrike = -1;
    this.lastPhase = BossPhase.opening;
    BlzSetSpecialEffectPosition(this.body, x, y + boss.depth, z + boss.standZ);
  }

  /** When the match ends: the boss and its art go. */
  endMatch(): void {
    if (this.body !== undefined) DestroyEffect(this.body);
    for (const art of this.tells) DestroyEffect(art);
    for (const art of this.hits) DestroyEffect(art);
    this.body = undefined;
    this.tells = [];
    this.hits = [];
    this.boss = undefined;
  }

  /** Every rendered frame of the presented match. */
  present(game: Readonly<MatchState>): void {
    const { boss, body } = this;
    if (boss === undefined || body === undefined || game.phase !== Phase.match || game.run.boss.kind === BossKind.none) return;
    const clock = bossClock(game.matchFrame, game.startHold);
    const { origin } = this;
    // The body follows the strike's hover sideways only; its height stays where its drawn box fits the view.
    BlzSetSpecialEffectPosition(body, origin.x + bossPosition(boss, clock).x, origin.y + boss.depth, origin.z + boss.standZ);
    const flash = game.run.boss.flash > 0;
    BlzSetSpecialEffectColor(body, flash ? 255 : boss.tint[0], flash ? 90 : boss.tint[1], flash ? 90 : boss.tint[2]);
    const now = bossMoment(boss, clock, moment);
    const strike = boss.strikes[now.index];
    if (now.strike !== this.lastStrike || now.phase !== this.lastPhase) {
      if (now.phase === BossPhase.tell) BlzPlaySpecialEffect(body, ANIM_TYPE_SPELL);
      else if (now.phase === BossPhase.active) BlzPlaySpecialEffect(body, ANIM_TYPE_ATTACK);
      else if (now.phase === BossPhase.rest) BlzPlaySpecialEffect(body, ANIM_TYPE_STAND);
      this.lastStrike = now.strike;
      this.lastPhase = now.phase;
    }
    for (let index = 0; index < ZONE_EFFECTS; index++) {
      const zone = strike?.zones[index];
      const tell = this.tells[index];
      const hit = this.hits[index];
      if (tell === undefined || hit === undefined) continue;
      const showTell = zone !== undefined && now.strike >= 0 && now.phase === BossPhase.tell;
      const showHit = zone !== undefined && now.strike >= 0 && now.phase === BossPhase.active;
      if (showTell && strike !== undefined && zone !== undefined) {
        this.parked[index] = false;
        BlzSetSpecialEffectScale(tell, f32(zone.halfWidth / 90.0));
        BlzSetSpecialEffectPosition(tell, origin.x + zoneCenter(strike, zone, game.run.boss.aimX), origin.y, origin.z + Math.max(0.0, zone.bottom));
      } else parkOnce(tell, origin, this.parked, index);
      if (showHit && strike !== undefined && zone !== undefined) {
        this.parked[ZONE_EFFECTS + index] = false;
        BlzSetSpecialEffectScale(hit, f32(zone.halfWidth / 70.0));
        BlzSetSpecialEffectPosition(hit, origin.x + zoneCenter(strike, zone, game.run.boss.aimX), origin.y, origin.z + Math.max(0.0, zone.bottom));
      } else parkOnce(hit, origin, this.parked, ZONE_EFFECTS + index);
    }
  }

  /** The ending card over a cleared run's result. */
  updateCard(game: Readonly<MatchState>): void {
    const shown = game.phase === Phase.result && game.run.active && game.run.cleared && !game.lore;
    BlzFrameSetVisible(this.card, shown);
    if (!shown) return;
    const ending = classicEnding(game);
    const text = `${ending.speaker}|${ending.lines.join("\n")}|${ending.results}`;
    if (text === this.cardText) return;
    this.cardText = text;
    BlzFrameSetTexture(this.portrait, fighterPortrait(game.run.fighter, "Card", game.run.player), 0, true);
    BlzFrameSetText(this.speaker, `|cffffcc00${ending.speaker}|r`);
    BlzFrameSetText(this.lines, ending.lines.join("\n\n"));
    BlzFrameSetText(this.results, ending.results);
  }

  destroy(): void {
    this.endMatch();
    BlzDestroyFrame(this.card);
  }
}
