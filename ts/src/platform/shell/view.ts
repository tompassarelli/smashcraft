
import { itemBodyTint } from "../../game/presentation/itemLook";
import { MATCH_HELP_BOX, MATCH_NOTICE_BOX } from "../../game/ui/hudLayout";
import { CryDecision, createCryGate, cryStandIn, gateCry } from "../../game/presentation/hurtVoice";
import { deckModel, slabScale } from "../../game/presentation/stagePreload";
import { type PlatformPart, platformParts } from "../../game/presentation/stockPlatforms";
import { stageEdgeLight, STAGE_EDGE_LIGHT_MODEL } from "../../game/presentation/stageEdgeLights";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../../game/sim/codes";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../../game/input/participants";
import type { FighterAgency } from "../../game/presentation/fighterAgency";
import type { FrameControls } from "../../game/match/controls";
import type { PacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { type MatchState, Phase, remainingSeconds, stageClock, timedMatch } from "../../game/match/rules";
import { fighterOffscreen, fitFighterFrames } from "../../game/presentation/fighterFraming";
import { ARENA_CAMERA, FLOOR_HEIGHT, cameraFieldOfView, cameraPoint, extremeCamera, localCamera } from "../../game/presentation/arenaCamera";

import { beginPauseCamera, advancePauseCamera, pauseCameraAngle, pauseHudHidden } from "./pauseCamera";
import { type MatchCamera, copyMatchCamera } from "../../game/sim/matchCamera";

import { advanceMatchCamera } from "../../game/sim/matchCamera";
import { stageBounds } from "../../game/sim/stageBounds";
import { damageTint } from "../../game/presentation/hitPresentation";
import { DamagePose, damagePose } from "../../game/presentation/damagePose";
import { hideEffect } from "../../game/render/effects";
import { FRAME_SECONDS, type FighterPose } from "../../game/presentation/fighterPose";
import { CANNON_MODEL, HYDRA_CREST_MODEL, HYDRA_RING_MODEL, PLATFORM_CUE_FRAMES, WIND_STREAK_COUNT, WIND_STREAK_MODEL, framesUntilPlatformMoves, hydraWarningX, hydraStrikeZ, lavaLook, windStreak } from "../../game/presentation/stageHazards";
import { escapeMeterView, readEscapeMeter } from "../../game/presentation/escapeMeter";
import { lavaPiece } from "../../game/presentation/stageScenery";
import { hasLava, lavaSide } from "../../game/sim/lava";
import type { Fighter } from "../../game/sim/fighter";
import { journalIngress } from "../../game/shell/build";
import { type StartControl, matchHelp, resultNotice, waitingMessage } from "../../game/shell/messages";
import { isIntangible } from "../../game/sim/conditions";
import { type Roster, fighterAt, isActive } from "../../game/sim/roster";
import { surfaceCount, surfaceLeft, surfaceMoves, surfaceRight, surfaceZ } from "../../game/sim/stage";
import { CANNON_Z, SEA_SURFACE_Z, cannonAim, cannonOn, cannonX, hasTide, hasWind } from "../../game/sim/stageHazards";
import { localParticipantSlot, traceParticipant } from "./diagnostics";
import { placeFighterBody, renderDizzy } from "./fighterBody";
import { type ShellState, type StatusFrames, activeRollback, localSlot, playsOnKeyboard } from "./state";
import { type UiObjects, pauseEffects, views } from "./ui";
import { loreClears } from "../../game/classic/loreClears";
import { drawStageScenery } from "./stageScenery";
import { probeCamera, probeWaiting } from "./responseProbe";
import { clockSeconds } from "./trace";

declare const os: { readonly clock?: (this: void) => number } | undefined;


const RESUME_PRESENTATION_SECONDS = f32(1.0 / 30.0);

export function resumePresentationHeld(s: Readonly<ShellState>): boolean {
  return s.resumePresentationUntil !== undefined;
}


export function serviceResumePresentation(s: ShellState): void {
  if (s.resumePresentationUntil === undefined) return;
  if (s.game.phase === Phase.match && typeof os === "object" && typeof os.clock === "function" && os.clock() < s.resumePresentationUntil) return;
  s.resumePresentationUntil = undefined;
  setMatchPresentationPaused(s, s.session.paused);
}


export const LASTING = 3600.0;

export function setStatus(s: ShellState, text: string, seconds: number): void {
  s.status.text = text;
  s.status.seconds = seconds;
}


export function announce(s: ShellState, text: string): void {
  setStatus(s, text, 2.0);
}

export const startControl = (s: Readonly<ShellState>): StartControl =>
  (journalIngress(s.build) === "editbox" && !playsOnKeyboard(s.rollback?.journal, localSlot()) ? "Start" : "Y");

function frameText(name: string, x: number, y: number, width: number, height: number, size: number): framehandle {
  const frame = BlzCreateFrameByType("TEXT", name, BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0), "", 0);
  BlzFrameSetAbsPoint(frame, FRAMEPOINT_TOPLEFT, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetFont(frame, "Fonts\\FRIZQT__.TTF", size, 0);
  BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
  return frame;
}

export function createStatusFrames(): StatusFrames {
  return {
    help: frameText("MeleeHelp", MATCH_HELP_BOX.left, MATCH_HELP_BOX.top, MATCH_HELP_BOX.width, MATCH_HELP_BOX.height, f32(0.01)),
    notice: frameText("MeleeNotice", MATCH_NOTICE_BOX.left, MATCH_NOTICE_BOX.top, MATCH_NOTICE_BOX.width, MATCH_NOTICE_BOX.height, f32(0.019)),
  };
}

function clearStageDecks(s: ShellState): void {
  for (const effect of s.stageHydra ?? []) {
    hideEffect(effect, s.origin);
    DestroyEffect(effect);
  }
  s.stageHydra = [];
  for (const effect of s.stageWind) {
    hideEffect(effect, s.origin);
    DestroyEffect(effect);
  }
  s.stageWind.length = 0;
  if (s.stageCannon !== undefined) {
    hideEffect(s.stageCannon, s.origin);
    DestroyEffect(s.stageCannon);
    s.stageCannon = undefined;
  }
  if (s.stageLava !== undefined) {
    hideEffect(s.stageLava, s.origin);
    DestroyEffect(s.stageLava);
    s.stageLava = undefined;
  }
  for (const deck of s.stageDecks) {
    hideEffect(deck, s.origin);
    DestroyEffect(deck);
  }
  s.stageDecks.length = 0;
  for (const part of s.stageDeckParts) {
    hideEffect(part, s.origin);
    DestroyEffect(part);
  }
  s.stageDeckParts.length = 0;
}

function placePart(deck: effect, part: Readonly<PlatformPart>, x: number, y: number, z: number): void {
  BlzSetSpecialEffectPosition(deck, x + part.x, y + part.y, z + part.z);
  BlzSetSpecialEffectMatrixScale(deck, part.scale[0], part.scale[1], part.scale[2]);
  BlzSetSpecialEffectYaw(deck, part.yaw * (Math.PI / 180.0));
}


export function drawStage(s: ShellState): void {
  clearStageDecks(s);
  drawStageScenery(s);
  const { origin } = s;
  const stage = s.game.stageChoice;
  const stageFrame = stageClock(s.game);
  for (let index = 0; index < surfaceCount(stage); index++) {
    const left = surfaceLeft(stage, index, stageFrame);
    const right = surfaceRight(stage, index, stageFrame);
    const x = origin.x + (left + right) / 2;
    const deck = AddSpecialEffect(deckModel(stage, index), x, origin.y);
    const z = origin.z + surfaceZ(stage, index, stageFrame);
    BlzSetSpecialEffectPosition(deck, x, origin.y, z);
    const parts = platformParts(stage, index);
    if (parts.length > 0) {

      for (const [order, part] of parts.entries()) {
        const effect = order === 0 ? deck : AddSpecialEffect(part.model, x, origin.y);
        placePart(effect, part, x, origin.y, z);
        if (order > 0) s.stageDeckParts.push(effect);
      }
      s.stageDecks.push(deck);
      continue;
    }
    const scale = slabScale(stage, index, right - left);
    if (scale !== undefined) BlzSetSpecialEffectMatrixScale(deck, scale[0], scale[1], scale[2]);
    s.stageDecks.push(deck);
  }
  if (cannonOn(stage, stageFrame)) {
    s.stageCannon = AddSpecialEffect(CANNON_MODEL, origin.x + cannonX(stageFrame), origin.y);
    BlzSetSpecialEffectPosition(s.stageCannon, origin.x + cannonX(stageFrame), origin.y, origin.z + CANNON_Z);
    BlzSetSpecialEffectScale(s.stageCannon, 1.5);
  }
  for (let index = 0; index < 6; index++) {
    const light = stageEdgeLight(stage, index, stageFrame);
    if (light === undefined) break;
    const effect = AddSpecialEffect(STAGE_EDGE_LIGHT_MODEL, origin.x + light.x, origin.y + light.y);
    BlzSetSpecialEffectPosition(effect, origin.x + light.x, origin.y + light.y, origin.z + light.z);
    BlzSetSpecialEffectScale(effect, 0.75);
    BlzSetSpecialEffectColor(effect, 96, 255, 64);
    BlzPlaySpecialEffect(effect, ANIM_TYPE_STAND);
    s.stageDeckParts.push(effect);
  }
  if (hasLava(stage)) {
    const piece = lavaPiece(lavaSide(stageFrame));
    s.stageLava = AddSpecialEffect(piece.model, origin.x + piece.x, origin.y + piece.y);
    BlzSetSpecialEffectPosition(s.stageLava, origin.x + piece.x, origin.y + piece.y, origin.z + piece.z);
    if (piece.matrixScale !== undefined) BlzSetSpecialEffectMatrixScale(s.stageLava, piece.matrixScale[0], piece.matrixScale[1], piece.matrixScale[2]);
    BlzPlaySpecialEffect(s.stageLava, ANIM_TYPE_STAND);
    presentLava(s, stage, stageFrame);
  }
  s.drawnStage = stage;
  if (hasTide(stage)) {
    for (const _slot of PARTICIPANT_SLOTS) {
      for (const model of [HYDRA_RING_MODEL, HYDRA_CREST_MODEL]) {
        const effect = AddSpecialEffect(model, origin.x, origin.y);
        hideEffect(effect, origin);
        s.stageHydra?.push(effect);
      }
    }
  }
  if (hasWind(stage)) {
    for (let index = 0; index < WIND_STREAK_COUNT; index++) {
      const effect = AddSpecialEffect(WIND_STREAK_MODEL, origin.x, origin.y);
      hideEffect(effect, origin);
      s.stageWind.push(effect);
    }
  }
  presentWind(s, stage, stageFrame);
}

function presentWind(s: ShellState, stage: number, frame: number): void {
  for (const [index, effect] of s.stageWind.entries()) {
    const streak = windStreak(stage, frame, index);
    if (streak === undefined) {
      hideEffect(effect, s.origin);
      continue;
    }
    BlzSetSpecialEffectScale(effect, 2.0);
    BlzSetSpecialEffectPosition(effect, s.origin.x + streak.x, s.origin.y, s.origin.z + streak.z);
    BlzSetSpecialEffectYaw(effect, streak.direction > 0 ? 0.0 : Math.PI);
  }
}


function presentLava(s: ShellState, stage: number, frame: number): void {
  const lava = s.stageLava;
  if (lava === undefined || !hasLava(stage)) return;
  const piece = lavaPiece(lavaSide(frame));
  BlzSetSpecialEffectPosition(lava, s.origin.x + piece.x, s.origin.y + piece.y, s.origin.z + piece.z);
  const look = lavaLook(stage, frame);
  BlzSetSpecialEffectAlpha(lava, look.alpha);
  BlzSetSpecialEffectColor(lava, look.red, look.green, look.blue);
}


export function renderFighter(s: ShellState, slot: ParticipantSlot, pose: Readonly<FighterPose>, wasOut: boolean): void {
  if (resumePresentationHeld(s)) return;
  const participant = s.participants[slot];
  const { body } = participant;
  if (body === undefined || !isActive(s.world, slot)) return;
  const fighter = fighterAt(s.world, slot);
  renderDizzy(body, fighter, s.game.phase === Phase.match, s.origin);
  if (wasOut && !fighter.status.out) ShowUnit(body.unit, true);
  else if (!wasOut && fighter.status.out) {
    ShowUnit(body.unit, false);
  }
  const { pooled } = participant;
  ShowUnit(body.unit, !pooled && !fighter.status.out);
  if (body.renderedSelection !== pose.selectionSerial) {
    if (!pooled) {

      const cry = gateCry(body.cry ??= createCryGate(), s.runtime.simulationFrame, fighter, pose.clipIndex, pose.clipName);
      const standIn = cry === CryDecision.standIn ? cryStandIn(fighter.character) : undefined;
      if (standIn !== undefined) SetUnitAnimationByIndex(body.unit, standIn);
      else if (cry === CryDecision.keep) {

      } else if (pose.clipIndex !== undefined) SetUnitAnimationByIndex(body.unit, pose.clipIndex);
      else SetUnitAnimation(body.unit, pose.clipName);
    }
    body.renderedSelection = pose.selectionSerial;
    const reaction = damagePose(fighter);
    if (reaction !== DamagePose.none) {
      const { launch, motion } = fighter;
      traceParticipant(s, slot, `damage pose ${reaction} hitlag ${launch.hitlag} hitstun ${launch.hitstun} x ${R2S(motion.x)} z ${R2S(motion.z)} launch ${R2S(launch.knockbackX)}:${R2S(launch.knockbackZ)}`);
    }
  }
  if (!pooled) SetUnitTimeScale(body.unit, pose.rate);
  if (fighter.status.out) return;
  placeFighterBody(body, fighter, s.origin, s.game.stageChoice);
  const tint = damageTint(fighter);
  const frozen = fighter.status.frozenFrames > 0;
  const item = fighter.shield.raised ? undefined : itemBodyTint(fighter);
  const red = frozen ? 155 : tint?.red ?? (fighter.shield.raised ? 100 : item?.red ?? 255);
  const green = frozen ? 210 : tint?.green ?? (fighter.shield.raised ? 160 : item?.green ?? 255);
  const blue = frozen ? 255 : tint?.blue ?? item?.blue ?? 255;
  const alpha = !frozen && tint === undefined && isIntangible(fighter) ? 140 : 255;
  SetUnitVertexColor(body.unit, red, green, blue, alpha);
}


export function pauseMatchPresentation(s: ShellState, paused: boolean): void {
  s.resumePresentationUntil = undefined;
  if (paused && s.game.phase === Phase.match) {
    const height = BlzGetLocalClientHeight();
    beginPauseCamera(s, height > 0 ? I2R(BlzGetLocalClientWidth()) / I2R(height) : 16.0 / 9.0);
  } else if (s.pauseCamera !== undefined) {
    const saved = s.pauseCamera;
    copyMatchCamera(s.camera, saved.saved);
    s.pauseCamera = undefined;
    applyArenaCamera(s, s.camera, saved.aspect, ARENA_CAMERA.angleOfAttack, 0.0);
    renderUi(s);
  }
  if (!paused && s.build.inputProfile !== "native-driver" && s.game.phase === Phase.match && typeof os === "object" && typeof os.clock === "function") {
    s.resumePresentationUntil = os.clock() + RESUME_PRESENTATION_SECONDS;
    return;
  }
  setMatchPresentationPaused(s, paused);
}

function setMatchPresentationPaused(s: ShellState, paused: boolean): void {
  for (const slot of PARTICIPANT_SLOTS) {
    const { body } = s.participants[slot];
    if (body === undefined || !isActive(s.world, slot)) continue;
    if (paused) SetUnitTimeScale(body.unit, 0.0);
    else if (!fighterAt(s.world, slot).status.out) renderFighter(s, slot, s.runtime.poses[slot], false);
  }
  pauseEffects(s, paused);
}

interface PresentedMatch {
  readonly game: MatchState;
  readonly world: Roster;
  readonly runtime: PacingAndPresentation;
  readonly playing: boolean;
}


function presentedMatch(s: ShellState): PresentedMatch {
  const rollback = activeRollback(s);
  const confirmedPlaying = s.game.phase === Phase.match;
  if (s.build.presentation === "pool-predicted" && rollback !== undefined && confirmedPlaying) {
    const { speculative } = rollback;
    return { game: speculative.game, world: speculative.world, runtime: speculative.runtime, playing: speculative.game.phase === Phase.match };
  }
  return { game: s.game, world: s.world, runtime: s.runtime, playing: confirmedPlaying };
}


const agencyMarks: Slots<FighterAgency> = ["act", "act", "act", "act"];
const FORECAST_STEPS_PER_CALLBACK = 8;







function markAgency(ui: UiObjects, world: Readonly<Roster>, stage: number, matchFrame: number, controls: Readonly<FrameControls>): void {
  let stalest = -1;
  let stalestAge = -1;
  let budget = FORECAST_STEPS_PER_CALLBACK;
  for (const slot of PARTICIPANT_SLOTS) {
    const forecast = ui.fighters[slot]?.agency.forecast;
    if (forecast === undefined || !isActive(world, slot)) continue;
    const immediate = forecast.immediate(world, slot, stage, matchFrame);
    if (immediate !== undefined) {
      forecast.cancel();
      agencyMarks[slot] = immediate;
      continue;
    }
    if (forecast.pendingFor(world, slot)) continue;
    const age = forecast.reuseAge(world, slot, matchFrame);
    if (age === undefined) forecast.begin(world, slot, stage, matchFrame, controls.commands[slot].graceFrames);
    else {
      forecast.cancel();
      agencyMarks[slot] = forecast.reused(world, slot);
      if (age > stalestAge) {
        stalest = slot;
        stalestAge = age;
      }
    }
  }
  for (const slot of PARTICIPANT_SLOTS) {
    const forecast = ui.fighters[slot]?.agency.forecast;
    if (forecast === undefined || !isActive(world, slot) || forecast.finished()) continue;
    budget -= forecast.advance(budget);
    if (forecast.finished()) agencyMarks[slot] = forecast.result();
  }
  const forecast = stalest < 0 || budget <= 0 ? undefined : at(ui.fighters, stalest)?.agency.forecast;
  if (forecast === undefined || stalestAge <= 0) return;
  forecast.begin(world, stalest, stage, matchFrame, at(controls.commands, stalest).graceFrames);
  forecast.advance(budget);
  if (forecast.finished()) agencyMarks[stalest] = forecast.result();
}


export function renderPersistentPresentation(s: ShellState): void {
  if (resumePresentationHeld(s)) return;
  const now = clockSeconds(s.trace);
  for (const slot of PARTICIPANT_SLOTS) {
    views(s).fighters[slot]?.cues?.confirm(isActive(s.world, slot) ? fighterAt(s.world, slot) : undefined, s.game.phase === Phase.match, now);
  }
  const { game, world, runtime, playing } = presentedMatch(s);
  const stage = game.stageChoice;
  const matchFrame = stageClock(game);

  const drawn = s.drawnStage;
  const beforePlatform = framesUntilPlatformMoves(drawn, matchFrame);
  for (let index = 0; index < s.stageDeckParts.length; index++) {
    const light = stageEdgeLight(drawn, index, matchFrame);
    if (light === undefined) break;
    BlzSetSpecialEffectPosition(at(s.stageDeckParts, index), s.origin.x + light.x, s.origin.y + light.y, s.origin.z + light.z);
  }
  for (let index = 1; index < s.stageDecks.length; index++) {
    if (!surfaceMoves(drawn, index)) continue;
    const x = s.origin.x + (surfaceLeft(drawn, index, matchFrame) + surfaceRight(drawn, index, matchFrame)) / 2;
    BlzSetSpecialEffectPosition(at(s.stageDecks, index), x, s.origin.y, s.origin.z + surfaceZ(drawn, index, matchFrame));
    const warns = beforePlatform !== undefined && beforePlatform <= PLATFORM_CUE_FRAMES;
    BlzSetSpecialEffectColor(at(s.stageDecks, index), 255, warns ? 170 : 255, warns ? 40 : 255);
  }
  if (s.stageCannon !== undefined && cannonOn(drawn, matchFrame)) {
    BlzSetSpecialEffectPosition(s.stageCannon, s.origin.x + cannonX(matchFrame), s.origin.y, s.origin.z + CANNON_Z);
    BlzSetSpecialEffectPitch(s.stageCannon, cannonAim(matchFrame));
    let firing = false;
    for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot) && fighterAt(world, slot).cannon.firing !== undefined) firing = true;
    BlzSetSpecialEffectColor(s.stageCannon, 255, firing ? 70 : 255, firing ? 40 : 255);
  }
  presentLava(s, drawn, matchFrame);
  presentWind(s, drawn, matchFrame);
  for (const slot of PARTICIPANT_SLOTS) {
    const ring = s.stageHydra?.[slot * 2];
    const crest = s.stageHydra?.[slot * 2 + 1];
    if (ring === undefined || crest === undefined) continue;
    const water = playing && isActive(world, slot) ? fighterAt(world, slot).water : undefined;
    const strikeZ = water === undefined ? undefined : hydraStrikeZ(drawn, water, game.matchFrame);
    const x = water === undefined ? undefined : strikeZ === undefined ? hydraWarningX(drawn, water) : water.hydraX;
    if (x === undefined) {
      hideEffect(ring, s.origin);
      hideEffect(crest, s.origin);
      continue;
    }
    BlzSetSpecialEffectScale(ring, strikeZ === undefined ? 0.75 : 1.0);
    BlzSetSpecialEffectColor(ring, 48, 72, 64);
    BlzSetSpecialEffectPosition(ring, s.origin.x + x, s.origin.y, s.origin.z + SEA_SURFACE_Z + 8.0);
    BlzSetSpecialEffectScale(crest, strikeZ === undefined ? 0.75 : 1.0);
    BlzSetSpecialEffectYaw(crest, Math.PI / 2.0);
    BlzSetSpecialEffectPosition(crest, s.origin.x + x, s.origin.y + 40.0, s.origin.z + (strikeZ ?? SEA_SURFACE_Z - 60.0));
    BlzSetSpecialEffectTimeScale(crest, 0.0);
  }
  const ui = views(s);
  if (playing) markAgency(ui, world, stage, matchFrame, s.controls);
  ui.classic?.present(game);
  ui.combat.present(runtime.impacts, runtime.simulationFrame, s.runtime.impacts, playing);
  for (const slot of PARTICIPANT_SLOTS) {
    const fighter = isActive(world, slot) ? fighterAt(world, slot) : undefined;
    const renderers = ui.fighters[slot];
    if (renderers?.pool !== undefined) {
      if (fighter !== undefined && ui.match.posing !== slot) renderers.pool.present(fighter, runtime.poses[slot], stage, runtime.simulationFrame);
      else renderers.pool.hide();
    }
    const live = playing ? fighter : undefined;
    renderers?.flash.present(ui.match.posing === slot ? undefined : live, runtime.poses[slot], stage, runtime.simulationFrame, game.camera);
    if (renderers !== undefined) renderers.agency.present(live, live === undefined ? "act" : agencyMarks[slot]);
    ui.special.presentStatic(runtime.specials, live, slot);
    ui.special.presentSummons(runtime.summons, live, slot);
    if (live !== undefined) ui.frost.present(live, slot);
    else ui.frost.hideSlot(slot);
    if (live !== undefined) ui.elements.present(live, slot);
    else ui.elements.hideSlot(slot);
    if (live !== undefined) ui.placed.present(live, slot);
    else ui.placed.hideSlot(slot);
    renderers?.shield.present(fighter, playing);
    renderers?.projectiles.present(fighter, playing, s.session.paused);
    renderers?.cues?.present(fighter, playing, s.session.paused);
    renderers?.hitAreas?.present(live);
  }
}


const meter = escapeMeterView();

function applyArenaCamera(s: ShellState, framing: Readonly<MatchCamera>, aspect: number, angle: number, duration: number): void {
  const { x: centerX, y: centerY } = s.origin;
  const targetX = centerX + framing.x;
  if (duration > 0.0) {

    const bounds = stageBounds(s.game.stageChoice).camera;
    const left = centerX + bounds.left;
    const right = centerX + bounds.right;
    SetCameraBounds(left, centerY, right, centerY, left, centerY, right, centerY);
  } else SetCameraBounds(targetX, centerY, targetX, centerY, targetX, centerY, targetX, centerY);
  SetCameraField(CAMERA_FIELD_ROTATION, ARENA_CAMERA.rotation, 0.0);
  SetCameraField(CAMERA_FIELD_ANGLE_OF_ATTACK, angle, 0.0);
  SetCameraField(CAMERA_FIELD_TARGET_DISTANCE, framing.distance, duration);
  SetCameraField(CAMERA_FIELD_ZOFFSET, FLOOR_HEIGHT + framing.z, duration);
  SetCameraField(CAMERA_FIELD_ROLL, 0.0, 0.0);
  SetCameraField(CAMERA_FIELD_FIELD_OF_VIEW, cameraFieldOfView(framing, aspect), duration);
  SetCameraField(CAMERA_FIELD_FARZ, ARENA_CAMERA.farZ, 0.0);
  if (duration > 0.0) PanCameraToTimed(targetX, centerY, duration);
  else SetCameraPosition(targetX, centerY);
}


export function lockArenaCamera(s: ShellState): void {
  if (resumePresentationHeld(s)) return;
  const { world, game } = presentedMatch(s);

  if (!game.camera.initialized) advanceMatchCamera(s.camera, world, game.stageChoice);
  const height = BlzGetLocalClientHeight();
  const aspect = height > 0 ? I2R(BlzGetLocalClientWidth()) / I2R(height) : 16.0 / 9.0;
  if (s.session.paused && s.pauseCamera !== undefined) advancePauseCamera(s, aspect);
  else localCamera(s.camera, game.camera.initialized ? game.camera : s.camera, game.stageChoice, aspect);
  if (s.viewExtreme !== undefined) extremeCamera(s.camera, game.stageChoice, aspect, s.viewExtreme);
  if (!s.session.paused || s.pauseCamera === undefined) fitFighterFrames(s.camera, world, game.stageChoice, aspect);
  const { x: centerX, y: centerY } = s.origin;
  const framing = s.camera;
  if (game.phase === Phase.match && game.run.active && game.run.boss.kind !== 0 && !s.session.paused) {

    framing.x = 0.0;
    framing.z = 160.0;
    framing.distance = 1450.0;
    framing.tangent = 0.2679491937160492;
  }
  probeCamera(s.probe, game.camera, framing, centerX, FLOOR_HEIGHT);
  const duration = s.cameraTween === true && game.phase === Phase.match && !s.session.paused ? FRAME_SECONDS : 0.0;
  applyArenaCamera(s, framing, aspect, pauseCameraAngle(s), duration);
  if (s.build.analogPadDiagnostic === true) {

    SetCameraBounds(centerX, centerY, centerX, centerY, centerX, centerY, centerX, centerY);
    SetCameraField(CAMERA_FIELD_ANGLE_OF_ATTACK, 270.0, 0.0);
    SetCameraField(CAMERA_FIELD_TARGET_DISTANCE, 3200.0, 0.0);
    SetCameraField(CAMERA_FIELD_ZOFFSET, 0.0, 0.0);
    SetCameraField(CAMERA_FIELD_FIELD_OF_VIEW, 70.0, 0.0);
    SetCameraPosition(centerX, centerY);
  }
  views(s).items.present(game, world);
  views(s).drops.present(game);
  for (const slot of PARTICIPANT_SLOTS) {
    const fighter = isActive(world, slot) ? fighterAt(world, slot) : undefined;
    const point = cameraPoint(framing, aspect, fighter?.motion.x ?? 0.0, (fighter?.motion.z ?? 0.0) + 60.0);
    const outside = fighter !== undefined && fighterOffscreen(framing, aspect, fighter.character, fighter.motion.x, fighter.motion.z);
    views(s).bubbles[slot].update(!pauseHudHidden(s) && game.phase === Phase.match && fighter !== undefined && !fighter.status.out && outside, fighter?.character ?? Character.rifleman, point.column, point.row, aspect);
    readEscapeMeter(world, slot, meter);
    if (game.phase !== Phase.match || pauseHudHidden(s)) meter.shown = false;
    const meterPoint = cameraPoint(framing, aspect, meter.x, meter.z);
    views(s).escapeMeters[slot].update(meter, meterPoint.column, meterPoint.row, aspect);
  }
}


export function renderUi(s: ShellState): void {
  if (resumePresentationHeld(s)) return;
  const { game } = s;
  const ui = views(s);
  const selecting = game.phase === Phase.characterMenu || game.phase === Phase.stageMenu;
  const menu = s.pauseMenu ??= { choice: 0, shown: false, title: false };
  const paused = game.phase === Phase.match && s.session.paused;
  if (paused && !menu.shown) menu.choice = 0;
  menu.shown = paused;
  ui.pause.update(paused && s.pauseCamera?.using !== true, menu.choice, menu.title, game.training, s.trainingHints === true);
  const local = localParticipantSlot(s);
  const localFighter = local !== undefined && s.participants[local].body !== undefined && isActive(s.world, local) ? fighterAt(s.world, local) : undefined;
  const showMatch = !pauseHudHidden(s) && !selecting && !(local !== undefined && ui.settings[local].isOpen());
  for (const slot of PARTICIPANT_SLOTS) {
    if (s.participants[slot].body !== undefined && isActive(s.world, slot)) {
      const fighter = fighterAt(s.world, slot);
      ui.huds[slot].update(showMatch, fighter.character, fighter.status.damage, s.game.endless ? 0 : fighter.status.stocks);
      ui.manaBars[slot].hud.update(showMatch, fighter.mana.points, fighter.visuals.manaDenied, fighter.visuals.manaDrained);
    } else {
      ui.huds[slot].update(false, Character.rifleman, 0.0, 0);
      ui.manaBars[slot].hud.update(false, 0, 0, 0);
    }
    ui.selections[slot].menuBindings(s.participants[slot].bindings.bindings);
    ui.selections[slot].update(game, menu.title || ui.settings[slot].isOpen());
    ui.settings[slot].update();
  }
  ui.clock.update(showMatch && timedMatch(game), remainingSeconds(game));
  ui.training.update(showMatch && game.training && game.phase === Phase.match, game.trainer);
  ui.classic?.updateCard(game);
  const cleared = game.lore && game.phase === Phase.result && game.run.active && game.run.cleared ? game.run.current : undefined;
  if (cleared !== undefined && localSlot() === game.run.player) loreClears().mark(cleared.id);
  const { help, notice } = s.frames;
  const teaching = game.phase === Phase.match && game.training && s.trainingHints === true && !paused;
  BlzFrameSetVisible(help, showMatch && (game.phase === Phase.result || teaching));
  const waiting = game.phase === Phase.match ? activeRollback(s)?.waitingFor ?? 0 : 0;
  BlzFrameSetVisible(notice, showMatch && (game.phase === Phase.result || waiting !== 0));
  if (!selecting) {
    BlzFrameSetText(help, matchHelp(game, s.session.paused, startControl(s), localFighter, game.phase === Phase.match));
    probeWaiting(s.probe, waiting, localSlot());
    BlzFrameSetText(notice, game.phase === Phase.result ? resultNotice(game, s.status.text) : waiting !== 0 ? waitingMessage(waiting) : "");
  }
  ui.stage.update(game);
}
