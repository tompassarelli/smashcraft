


import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import type { MatchState } from "../match/rules";
import type { Character } from "../sim/codes";
import type { Roster } from "../sim/roster";
import { characterModelScale } from "../presentation/modelScale";
import { MatchCue, MENU_MUSIC, cueSound, interfaceSoundPaths, presentationSoundPaths, readyVoice, victoryAnimation, victoryMusic, warcryVoice } from "../presentation/matchAudio";
import {
  type ResultsView, clearMatchTally, confirmedFrameCues, createCueObservation, createMatchTally, createMenuCues, createMenuObservation,
  menuFrameCues, observeForCues,
} from "../presentation/matchCues";
import { mainDeckZAt } from "../sim/stage";
import { confirmedItemCues, createItemCueObservation, observeItemCues } from "../presentation/itemLook";
import { confirmedDropCues, createDropCueObservation, observeDropCues } from "../presentation/dropLook";
import { meterDropPoint } from "../match/meterDrops";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { coverScreen, createBackdrop, createText, gameUi } from "../ui/frames";
import { MENU_FONT } from "../ui/hudLayout";
import type { WorldOrigin } from "./effects";
import { SoundBank, SoundKind } from "./soundBank";
import { fighterModel } from "./combatEffects";
import { type FighterOriginalClip, originalClip, originalClipNamed } from "../assets/fighterOriginalClipInfo";

const PANEL_TEXTURE = "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp";

export const RESULTS_DELAY_FRAMES = 90;

const FACING_CAMERA = f32(-1.5707963705062866);

const createItemSounds = (): sound[] => [MatchCue.lastStock, MatchCue.itemSpawn, MatchCue.confirm].map(cue => {
    const path = cueSound(cue);
    const sound = CreateSound(path, false, true, true, 10, 10, "DefaultEAXON");
    SetSoundDuration(sound, GetSoundFileDuration(path));
    SetSoundVolume(sound, 127);
    SetSoundDistances(sound, 1500.0, 10000.0);
    SetSoundDistanceCutoff(sound, 10000.0);
    return sound;
  });

const createDropSounds = (): sound[] => [MatchCue.itemSpawn, MatchCue.meterReady, MatchCue.confirm].map(cue => {
    const path = cueSound(cue);
    const sound = CreateSound(path, false, true, true, 10, 10, "DefaultEAXON");
    SetSoundDuration(sound, GetSoundFileDuration(path));
    SetSoundVolume(sound, 127);
    SetSoundDistances(sound, 1500.0, 10000.0);
    SetSoundDistanceCutoff(sound, 10000.0);
    return sound;
  });

export class MatchPresentation {

  itemObservation = createItemCueObservation();
  dropObservation = createDropCueObservation();
  readonly observation = createCueObservation();
  readonly tally = createMatchTally();
  private readonly cues: MatchCue[] = [];
  private itemSounds = createItemSounds();
  private dropSounds = createDropSounds();
  private readonly menu = createMenuObservation();
  private readonly menuCues = createMenuCues();
  // Hover differs by client; create its handle at shared startup on every client.
  private readonly hoverSound = CreateSound(cueSound(MatchCue.hover), false, false, false, 10, 10, "DefaultEAXON");
  private music: string | undefined;
  private readonly voices: (sound | undefined)[] = [];
  private readonly sounds = new SoundBank();
  private readonly panel: framehandle;
  private readonly title: framehandle;
  private readonly lines: readonly framehandle[];
  private victory: effect | undefined;
  private shown = false;
  private pending: ResultsView | undefined;
  private delay = 0;

  posing: number | undefined;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    SetSoundDuration(this.hoverSound, GetSoundFileDuration(cueSound(MatchCue.hover)));
    SetSoundVolume(this.hoverSound, 70);
    for (const path of presentationSoundPaths(SELECTABLE_CHARACTERS, STAGE_CATALOG.map(stage => stage.id))) Preload(path);
    this.sounds.prepare(SoundKind.interfaceFile, interfaceSoundPaths(SELECTABLE_CHARACTERS));
    const parent = gameUi();
    this.panel = createBackdrop("MatchResultsPanel", parent, 0);
    BlzFrameSetTexture(this.panel, PANEL_TEXTURE, 0, true);

    BlzFrameSetAbsPoint(this.panel, FRAMEPOINT_TOPRIGHT, f32(0.79), f32(0.52));
    BlzFrameSetSize(this.panel, f32(0.36), f32(0.05) + PARTICIPANT_CAPACITY * f32(0.04));
    BlzFrameSetEnable(this.panel, false);
    this.title = createText("MatchResultsTitle", this.panel, 0);
    BlzFrameSetPoint(this.title, FRAMEPOINT_TOP, this.panel, FRAMEPOINT_TOP, 0.0, f32(-0.012));
    BlzFrameSetSize(this.title, f32(0.33), f32(0.03));
    BlzFrameSetFont(this.title, MENU_FONT, f32(0.016), 0);
    BlzFrameSetTextAlignment(this.title, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_CENTER);
    const lines: framehandle[] = [];
    for (let index = 0; index < PARTICIPANT_CAPACITY; index++) {
      const line = createText(`MatchResultsLine${I2S(index)}`, this.panel, 0);
      BlzFrameSetPoint(line, FRAMEPOINT_TOPLEFT, this.panel, FRAMEPOINT_TOPLEFT, f32(0.018), f32(-0.045) - index * f32(0.04));
      BlzFrameSetSize(line, f32(0.33), f32(0.036));
      BlzFrameSetFont(line, MENU_FONT, f32(0.01), 0);
      BlzFrameSetTextAlignment(line, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
      lines.push(line);
    }
    this.lines = lines;
    BlzFrameSetVisible(this.panel, false);
  }

  private playFile(path: string): sound | undefined {
    return this.sounds.play(SoundKind.interfaceFile, path, 127);
  }

  cue(cue: MatchCue): void {
    if (cue === MatchCue.hover) {
      StopSound(this.hoverSound, false, false);
      StartSound(this.hoverSound);
      return;
    }
    this.playFile(cueSound(cue));
  }


  playMusic(path: string): void {
    if (this.music === path) return;
    this.music = path;
    EndThematicMusic();
    StopMusic(false);
    ClearMapMusic();
    PlayMusic(path);
  }


  voice(slot: number, path: string): void {
    const previous = this.voices[slot];
    if (previous !== undefined) StopSound(previous, false, false);
    this.voices[slot] = this.playFile(path);
  }


  presentMenus(game: Readonly<MatchState>, hover: number | undefined): void {
    menuFrameCues(this.menu, game, hover, this.menuCues);
    const { hover: hovered, confirm, fighters } = this.menuCues;
    if (hovered) this.cue(MatchCue.hover);
    if (confirm || fighters.length > 0) this.cue(MatchCue.confirm);
    for (const slot of fighters) this.voice(slot, readyVoice(game.characterChoices[slot]));
  }


  beginMatch(stageMusic: string, game: Readonly<MatchState>, world: Readonly<Roster>): void {
    this.hideResults();
    clearMatchTally(this.tally);
    observeForCues(this.observation, game, world);
    this.itemSounds ??= createItemSounds();
    observeItemCues(this.itemObservation ??= createItemCueObservation(), game.items, game.matchFrame);
    this.dropSounds ??= createDropSounds();
    observeDropCues(this.dropObservation ??= createDropCueObservation(), game.drops, game.matchFrame);
    this.playMusic(stageMusic);
  }


  observe(game: Readonly<MatchState>, world: Readonly<Roster>): void {
    observeForCues(this.observation, game, world);
    this.itemSounds ??= createItemSounds();
    observeItemCues(this.itemObservation ??= createItemCueObservation(), game.items, game.matchFrame);
    this.dropSounds ??= createDropSounds();
    observeDropCues(this.dropObservation ??= createDropCueObservation(), game.drops, game.matchFrame);
  }


  presentConfirmed(game: Readonly<MatchState>, world: Readonly<Roster>): readonly MatchCue[] {
    confirmedFrameCues(this.observation, game, world, this.tally, this.cues);
    const itemCues = confirmedItemCues(this.itemObservation, game.items, game.matchFrame);
    for (let index = 0; index < this.itemSounds.length; index++) {
      if ((itemCues & (1 << index)) === 0) continue;
      const sound = at(this.itemSounds, index);
      StopSound(sound, false, false);
      SetSoundPosition(sound, this.origin.x, this.origin.y, this.origin.z + mainDeckZAt(game.stageChoice, 0.0));
      StartSound(sound);
    }
    const dropCues = confirmedDropCues(this.dropObservation, game.drops, game.matchFrame);
    for (let index = 0; index < this.dropSounds.length; index++) {
      if ((dropCues & (1 << index)) === 0) continue;
      const sound = at(this.dropSounds, index);
      const point = meterDropPoint(game.stageChoice, Math.max(0, index === 0 ? game.drops.nextPoint : game.drops.point));
      StopSound(sound, false, false);
      SetSoundPosition(sound, this.origin.x + point.x, this.origin.y, this.origin.z + point.z);
      StartSound(sound);
    }
    for (const cue of this.cues) {
      this.cue(cue);
    }
    return this.cues;
  }


  beginResults(view: ResultsView, delay: number): void {
    this.pending = view;
    this.delay = delay;
  }


  tick(): boolean {
    this.playVictory();
    if (this.pending === undefined) return false;
    if (this.delay > 0) {
      this.delay--;
      return false;
    }
    const view = this.pending;
    this.pending = undefined;
    this.showResults(view);
    return true;
  }

  private showResults(view: ResultsView): void {
    this.hideResults();
    const { winner } = view;
    BlzFrameSetText(this.title, winner === undefined ? "No contest" : "Results");
    for (let index = 0; index < this.lines.length; index++) {
      const row = view.rows[index];
      BlzFrameSetText(at(this.lines, index), row === undefined ? "" : row.winner ? `|cffffcc00${row.text}|r` : row.text);
    }
    BlzFrameSetVisible(this.panel, true);
    this.shown = true;
    this.music = undefined;
    StopMusic(true);
    const theme = victoryMusic(winner);
    if (theme !== undefined) PlayThematicMusic(theme);
    if (winner === undefined) return;
    this.cue(MatchCue.cheer);
    this.playFile(warcryVoice(winner));
    this.posing = view.rows[0]?.slot;

    this.victory = this.pose(winner, view.winnerSlot, GetCameraTargetPositionX() - this.origin.x - 240.0, 0.0);
  }

  /** The winner's victory clip on its match body, when it plays from a timeline; otherwise undefined. */
  private victoryClip: FighterOriginalClip | undefined;
  private victoryFrames = 0;

  private pose(winner: Character, slot: number | undefined, x: number, z: number): effect {
    const index = originalClipNamed(winner, victoryAnimation(winner));
    const clip = index === undefined ? undefined : originalClip(winner, index);
    this.victoryClip = clip?.timeline === true ? clip : undefined;
    this.victoryFrames = 0;
    // Create handles at shared coordinates before placing them with a local camera.
    const model = AddSpecialEffect(this.victoryClip?.modelPath ?? fighterModel(winner), this.origin.x, this.origin.y);
    BlzSetSpecialEffectX(model, this.origin.x + x);

    if (slot !== undefined) BlzSetSpecialEffectColorByPlayer(model, Player(slot));
    BlzSetSpecialEffectZ(model, this.origin.z + z);
    BlzSetSpecialEffectScale(model, characterModelScale(winner));
    BlzSetSpecialEffectYaw(model, FACING_CAMERA);
    if (this.victoryClip === undefined) BlzSetSpecialEffectAnimation(model, victoryAnimation(winner));
    else {
      BlzSetSpecialEffectAnimationBlendTime(model, 0.0);
      BlzSetSpecialEffectAnimation(model, "Stand");
      BlzSetSpecialEffectTimeScale(model, 0.0);
      BlzSetSpecialEffectTime(model, this.victoryClip.startSeconds);
    }
    return model;
  }


  private playVictory(): void {
    const clip = this.victoryClip;
    if (clip === undefined || this.victory === undefined) return;
    this.victoryFrames++;
    const duration = clip.endSeconds - clip.startSeconds;
    let seconds = I2R(this.victoryFrames) / 60.0;
    if (duration <= 0.0) seconds = 0.0;
    else seconds -= I2R(R2I(seconds / duration)) * duration;
    BlzSetSpecialEffectTime(this.victory, clip.startSeconds + seconds);
  }

  hideResults(): void {
    this.pending = undefined;
    this.posing = undefined;
    if (!this.shown) return;
    this.shown = false;
    BlzFrameSetVisible(this.panel, false);
    if (this.victory !== undefined) {
      BlzSetSpecialEffectScale(this.victory, 0.0);
      DestroyEffect(this.victory);
      this.victory = undefined;
      this.victoryClip = undefined;
    }
  }


  private loadingFrames: { readonly cover: framehandle; readonly art: framehandle; readonly name: framehandle } | undefined;


  showLoading(name: string, texture: string): void {
    const parent = gameUi();
    const frames = (this.loadingFrames ??= {
      cover: createBackdrop("StageLoadingCover", parent, 0),
      art: createBackdrop("StageLoadingArt", parent, 0),
      name: createText("StageLoadingName", parent, 0),
    });
    BlzFrameSetTexture(frames.cover, PANEL_TEXTURE, 0, true);
    coverScreen(frames.cover);
    BlzFrameSetLevel(frames.cover, 8);
    BlzFrameSetTexture(frames.art, texture, 0, true);
    BlzFrameSetAbsPoint(frames.art, FRAMEPOINT_CENTER, f32(0.4), f32(0.35));

    BlzFrameSetSize(frames.art, f32(0.18), f32(0.18));
    BlzFrameSetLevel(frames.art, 9);
    BlzFrameSetAbsPoint(frames.name, FRAMEPOINT_TOP, f32(0.4), f32(0.24));
    BlzFrameSetSize(frames.name, f32(0.4), f32(0.06));
    BlzFrameSetFont(frames.name, MENU_FONT, f32(0.02), 0);
    BlzFrameSetTextAlignment(frames.name, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_CENTER);
    BlzFrameSetLevel(frames.name, 9);
    BlzFrameSetText(frames.name, `${name}\n|cffbbbbbbGetting the arena ready…|r`);
    for (const frame of [frames.cover, frames.art, frames.name]) {
      BlzFrameSetEnable(frame, false);
      BlzFrameSetVisible(frame, true);
    }
  }

  hideLoading(): void {
    const frames = this.loadingFrames;
    if (frames === undefined) return;
    for (const frame of [frames.cover, frames.art, frames.name]) BlzFrameSetVisible(frame, false);
  }


  enterMenus(): void {
    this.hideResults();
    this.playMusic(MENU_MUSIC);
  }
}
