// The match's local sound and show: announcer cues, music, selection voices
// and the results screen with the winner's victory pose. Every client plays
// the same confirmed events; nothing here reaches the simulation.
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import type { MatchState } from "../match/rules";
import type { Character } from "../sim/codes";
import type { Roster } from "../sim/roster";
import { characterModelScale } from "../presentation/modelScale";
import { MatchCue, MENU_MUSIC, cueSound, presentationSoundPaths, readyVoice, victoryAnimation, victoryMusic, warcryVoice } from "../presentation/matchAudio";
import {
  type ResultsView, clearMatchTally, confirmedFrameCues, createCueObservation, createMatchTally, createMenuCues, createMenuObservation,
  menuFrameCues, observeForCues,
} from "../presentation/matchCues";
import { mainDeckZAt } from "../sim/stage";
import { confirmedItemCues, createItemCueObservation, observeItemCues } from "../presentation/itemLook";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { coverScreen, createBackdrop, createText, gameUi } from "../ui/frames";
import { MENU_FONT } from "../ui/hudLayout";
import type { WorldOrigin } from "./effects";
import { fighterModel } from "./combatEffects";

const PANEL_TEXTURE = "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp";
/** Frames between "GAME!" and the results screen, as Smash holds on the final hit. */
export const RESULTS_DELAY_FRAMES = 90;
/** Facing the arena camera, which looks along +y. */
const FACING_CAMERA = f32(-1.5707963705062866);

function playFile(path: string, volume = 127): sound {
  const cue = CreateSound(path, false, false, false, 10, 10, "DefaultEAXON");
  SetSoundDuration(cue, GetSoundFileDuration(path));
  SetSoundVolume(cue, volume);
  StartSound(cue);
  KillSoundWhenDone(cue);
  return cue;
}

const createItemSounds = (): sound[] => [MatchCue.lastStock, MatchCue.go, MatchCue.confirm].map(cue => {
    const path = cueSound(cue);
    const sound = CreateSound(path, false, true, true, 10, 10, "DefaultEAXON");
    SetSoundDuration(sound, GetSoundFileDuration(path));
    SetSoundVolume(sound, 127);
    SetSoundDistances(sound, 1500.0, 10000.0);
    SetSoundDistanceCutoff(sound, 10000.0);
    return sound;
  });

export class MatchPresentation {
  /** Confirmed state before the frame being presented, and the knockouts so far. */
  itemObservation = createItemCueObservation();
  readonly observation = createCueObservation();
  readonly tally = createMatchTally();
  private readonly cues: MatchCue[] = [];
  private itemSounds = createItemSounds();
  private readonly menu = createMenuObservation();
  private readonly menuCues = createMenuCues();
  // Hover differs by client; the handle is created by every client at shared startup.
  private readonly hoverSound = CreateSound(cueSound(MatchCue.hover), false, false, false, 10, 10, "DefaultEAXON");
  private music: string | undefined;
  private readonly voices: (sound | undefined)[] = [];
  private readonly panel: framehandle;
  private readonly title: framehandle;
  private readonly lines: readonly framehandle[];
  private victory: effect | undefined;
  private shown = false;
  private pending: ResultsView | undefined;
  private delay = 0;
  /** The fighter slot the results screen shows posing; its match body hides meanwhile. */
  posing: number | undefined;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    SetSoundDuration(this.hoverSound, GetSoundFileDuration(cueSound(MatchCue.hover)));
    SetSoundVolume(this.hoverSound, 70);
    for (const path of presentationSoundPaths(SELECTABLE_CHARACTERS, STAGE_CATALOG.map(stage => stage.id))) Preload(path);
    const parent = gameUi();
    this.panel = createBackdrop("MatchResultsPanel", parent, 0);
    BlzFrameSetTexture(this.panel, PANEL_TEXTURE, 0, true);
    // Beside the arena's centre, so the winner's pose stays in view (native, #123).
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

  cue(cue: MatchCue): void {
    if (cue === MatchCue.hover) {
      StopSound(this.hoverSound, false, false);
      StartSound(this.hoverSound);
      return;
    }
    playFile(cueSound(cue));
  }

  /** Loops `path` as the music, unless it already plays. */
  playMusic(path: string): void {
    if (this.music === path) return;
    this.music = path;
    EndThematicMusic();
    StopMusic(false);
    ClearMapMusic();
    PlayMusic(path);
  }

  /** A fighter's voice line for its slot; a newer line cuts off the slot's last one. */
  voice(slot: number, path: string): void {
    const previous = this.voices[slot];
    if (previous !== undefined) StopSound(previous, false, false);
    this.voices[slot] = playFile(path);
  }

  /** The menus' sounds for this local frame; `hover` is this client's pointer tile. */
  presentMenus(game: Readonly<MatchState>, hover: number | undefined): void {
    menuFrameCues(this.menu, game, hover, this.menuCues);
    const { hover: hovered, confirm, fighters } = this.menuCues;
    if (hovered) this.cue(MatchCue.hover);
    if (confirm || fighters.length > 0) this.cue(MatchCue.confirm);
    for (const slot of fighters) this.voice(slot, readyVoice(game.characterChoices[slot]));
  }

  /** The stage's theme as its match begins, with a fresh tally. */
  beginMatch(stageMusic: string, game: Readonly<MatchState>, world: Readonly<Roster>): void {
    this.hideResults();
    clearMatchTally(this.tally);
    observeForCues(this.observation, game, world);
    this.itemSounds ??= createItemSounds();
    observeItemCues(this.itemObservation ??= createItemCueObservation(), game.items, game.matchFrame);
    this.playMusic(stageMusic);
  }

  /** Captures the confirmed state a frame starts from. */
  observe(game: Readonly<MatchState>, world: Readonly<Roster>): void {
    observeForCues(this.observation, game, world);
    this.itemSounds ??= createItemSounds();
    observeItemCues(this.itemObservation ??= createItemCueObservation(), game.items, game.matchFrame);
  }

  /** Plays the cues of the confirmed frame that just ran, calling out the ones with words; returns them. */
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
    for (const cue of this.cues) {
      this.cue(cue);
    }
    return this.cues;
  }

  /** The match ended: the results screen follows after `delay` local frames. */
  beginResults(view: ResultsView, delay: number): void {
    this.pending = view;
    this.delay = delay;
  }

  /** One local frame; true on the frame the results screen appears. */
  tick(): boolean {
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
    playFile(warcryVoice(winner));
    this.posing = view.rows[0]?.slot;
    // The last hit can leave the winner behind the panel; pose beside the current camera centre.
    this.victory = this.pose(winner, view.winnerSlot, GetCameraTargetPositionX() - this.origin.x - 240.0, 0.0);
  }

  private pose(winner: Character, slot: number | undefined, x: number, z: number): effect {
    // Handle creation must use shared coordinates; only placement follows the local camera.
    const model = AddSpecialEffect(fighterModel(winner), this.origin.x, this.origin.y);
    BlzSetSpecialEffectX(model, this.origin.x + x);
    // An effect has no owner: without this the pose keeps the default colour, not the winner's.
    if (slot !== undefined) BlzSetSpecialEffectColorByPlayer(model, Player(slot));
    BlzSetSpecialEffectZ(model, this.origin.z + z);
    BlzSetSpecialEffectScale(model, characterModelScale(winner));
    BlzSetSpecialEffectYaw(model, FACING_CAMERA);
    BlzSetSpecialEffectAnimation(model, victoryAnimation(winner));
    return model;
  }

  /** Ends the results screen and its pose, as the next match or the menus begin. */
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
    }
  }

  /** The stage-loading screen; created when first shown, on every client in the same synchronized step. */
  private loadingFrames: { readonly cover: framehandle; readonly art: framehandle; readonly name: framehandle } | undefined;

  /** Covers the screen with the chosen stage's art and name while every client draws it. */
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
    // Stage pictures are square (smashcraft:docs/design/stage-select.md).
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

  /** Fighter selection: menu music, no results. */
  enterMenus(): void {
    this.hideResults();
    this.playMusic(MENU_MUSIC);
  }
}
