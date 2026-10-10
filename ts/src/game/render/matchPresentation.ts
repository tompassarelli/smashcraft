


import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS } from "../input/participants";
import { Phase, type MatchState } from "../match/rules";
import type { Character } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";
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
import { MENU_FONT, PANEL_TEXTURE } from "../ui/hudLayout";
import { hideEffect, type WorldOrigin } from "./effects";
import { SoundBank, SoundKind } from "./soundBank";
import { resultFighterPlacement } from "../presentation/arenaCamera";
import { type FighterOriginalClip, originalClip, originalClipNamed } from "../assets/fighterOriginalClipInfo";


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

interface VictoryPose {
  readonly character: Character;
  model: effect | undefined;
  readonly winnerClip: FighterOriginalClip;
  readonly idleClip: FighterOriginalClip;
}

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
  private readonly help: framehandle;
  private readonly title: framehandle;
  private readonly lines: readonly framehandle[];
  private readonly poses: (VictoryPose | undefined)[] = [];
  private pending: ResultsView | undefined;
  private delay = 0;

  posing: number | undefined;
  resultFrames = 0;
  private resultStage = 0;
  private resultView: ResultsView | undefined;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    SetSoundDuration(this.hoverSound, GetSoundFileDuration(cueSound(MatchCue.hover)));
    SetSoundVolume(this.hoverSound, 70);
    for (const path of presentationSoundPaths(SELECTABLE_CHARACTERS, STAGE_CATALOG.map(stage => stage.id))) Preload(path);
    this.sounds.prepare(SoundKind.interfaceFile, interfaceSoundPaths(SELECTABLE_CHARACTERS));
    const parent = gameUi();
    this.panel = createBackdrop("MatchResultsPanel", parent, 0);
    BlzFrameSetTexture(this.panel, "ReplaceableTextures\\TeamColor\\TeamColor20.blp", 0, true);
    BlzFrameSetVertexColor(this.panel, -13619144);

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
      BlzFrameSetFont(line, MENU_FONT, f32(0.009), 0);
      BlzFrameSetTextAlignment(line, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
      lines.push(line);
    }
    this.lines = lines;
    this.help = createText("MatchResultsHelp", this.panel, 0);
    BlzFrameSetSize(this.help, f32(0.33), f32(0.06));
    BlzFrameSetFont(this.help, MENU_FONT, f32(0.009), 0);
    BlzFrameSetTextAlignment(this.help, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.help, false);
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
    if (game.phase === Phase.stageMenu && this.menu.phase === Phase.characterMenu) {
      for (const slot of PARTICIPANT_SLOTS) {
        const voice = this.voices[slot];
        if (voice !== undefined) StopSound(voice, false, false);
        this.voices[slot] = undefined;
      }
    }
    menuFrameCues(this.menu, game, hover, this.menuCues);
    const { hover: hovered, confirm, fighters } = this.menuCues;
    if (hovered) this.cue(MatchCue.hover);
    if (confirm || fighters.length > 0) this.cue(MatchCue.confirm);
    for (const slot of fighters) this.voice(slot, readyVoice(game.characterChoices[slot]));
  }


  beginMatch(stageMusic: string, game: Readonly<MatchState>, world: Readonly<Roster>): void {
    this.hideResults();
    this.preparePoses(world);
    this.resultStage = game.stageChoice;
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
    this.resultView = view;
    this.resultFrames = 0;
    this.delay = delay;
    this.placeResultPoses();
  }


  tick(): boolean {
    if (this.resultView !== undefined) {
      this.resultFrames++;
      this.placeResultPoses();
    }
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
    const { winner } = view;
    BlzFrameSetText(this.title, winner === undefined ? "No contest" : "Results");
    BlzFrameSetSize(this.panel, f32(0.36), f32(f32(0.115) + view.rows.length * f32(0.04)));
    BlzFrameSetPoint(this.help, FRAMEPOINT_TOPLEFT, this.panel, FRAMEPOINT_TOPLEFT, f32(0.018), f32(-0.045) - view.rows.length * f32(0.04));
    for (let index = 0; index < this.lines.length; index++) {
      const row = view.rows[index];
      BlzFrameSetText(at(this.lines, index), row === undefined ? "" : row.winner ? `|cffffcc00${row.text}|r` : `|cffeeeeee${row.text}|r`);
    }
    BlzFrameSetVisible(this.panel, true);
    this.music = undefined;
    StopMusic(true);
    const theme = victoryMusic(winner);
    if (theme !== undefined) PlayThematicMusic(theme);
    if (winner === undefined) return;
    this.cue(MatchCue.cheer);
    this.playFile(warcryVoice(winner));
    this.posing = view.rows[0]?.slot;
  }

  showResultHelp(text: string): void {
    BlzFrameSetText(this.help, text.replace(". Press", ".\nPress"));
  }

  preparePoses(world: Readonly<Roster>): void {
    this.releasePoses();
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      const character = fighterAt(world, slot).character;
      const winnerIndex = originalClipNamed(character, victoryAnimation(character));
      const idleIndex = originalClipNamed(character, "stand") ?? originalClipNamed(character, "stand -1")
        ?? originalClipNamed(character, "stand - 1") ?? originalClipNamed(character, "stand 1");
      const winnerClip = winnerIndex === undefined ? undefined : originalClip(character, winnerIndex);
      const idleClip = idleIndex === undefined ? undefined : originalClip(character, idleIndex);
      if (winnerClip === undefined || idleClip === undefined) continue;
      this.poses[slot] = { character, model: undefined, winnerClip, idleClip };
    }
  }

  private placeResultPoses(): void {
    const view = this.resultView;
    if (view === undefined) return;
    for (const [index, row] of view.rows.entries()) {
      const pose = this.poses[row.slot];
      if (pose === undefined) continue;
      const winning = row.slot === view.winnerSlot;
      const clip = winning ? pose.winnerClip : pose.idleClip;
      if (pose.model === undefined) {
        pose.model = AddSpecialEffect(clip.modelPath, this.origin.x, this.origin.y);
        hideEffect(pose.model, this.origin);
        BlzSetSpecialEffectColorByPlayer(pose.model, Player(row.slot));
        BlzSetSpecialEffectAnimationBlendTime(pose.model, 0.0);
        BlzSetSpecialEffectAnimation(pose.model, "Stand");
        BlzSetSpecialEffectTimeScale(pose.model, 0.0);
      }
      const model = pose.model;
      const placement = resultFighterPlacement(this.resultStage, index, view.rows.length);
      BlzSetSpecialEffectPosition(model, this.origin.x + placement.x, this.origin.y, this.origin.z + placement.z);
      BlzSetSpecialEffectYaw(model, FACING_CAMERA);
      BlzSetSpecialEffectScale(model, characterModelScale(pose.character));
      const duration = clip.endSeconds - clip.startSeconds;
      const start = winning ? duration / 4.0 : 0.0;
      const cycle = winning ? duration / 2.0 : duration;
      let seconds = I2R(this.resultFrames) / 60.0;
      if (cycle <= 0.0) seconds = 0.0;
      else seconds -= I2R(R2I(seconds / cycle)) * cycle;
      BlzSetSpecialEffectTime(model, (clip.timeline === true ? clip.startSeconds : 0.0) + start + seconds);
    }
  }

  resultsShown(): boolean {
    return this.resultView !== undefined && this.pending === undefined;
  }

  hideResults(): void {
    this.pending = undefined;
    this.resultView = undefined;
    this.resultFrames = 0;
    this.posing = undefined;
    BlzFrameSetVisible(this.panel, false);
    this.releasePoses();
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


  private releasePoses(): void {
    for (const slot of PARTICIPANT_SLOTS) {
      const pose = this.poses[slot];
      if (pose?.model !== undefined) {
        hideEffect(pose.model, this.origin);
        DestroyEffect(pose.model);
      }
      this.poses[slot] = undefined;
    }
  }

  enterMenus(): void {
    this.hideResults();
    this.playMusic(MENU_MUSIC);
  }
}
