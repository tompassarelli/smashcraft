// What each client shows: fighter units, stage decks, status text, the HUD
// and the camera. Everything here is presentation; with predicted
// presentation, persistent visuals follow the speculative match and event
// effects, audio, results and HUD follow the confirmed one.
import { archerMounted } from "../../game/presentation/hippogryphPose";
import { MATCH_HELP_BOX, MATCH_NOTICE_BOX } from "../../game/ui/hudLayout";
import { CryDecision, createCryGate, cryStandIn, gateCry } from "../../game/presentation/hurtVoice";
import { deckModel, slabScale } from "../../game/presentation/stagePreload";
import { type PlatformPart, platformParts } from "../../game/presentation/stockPlatforms";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import type { PacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { type MatchState, Phase, remainingSeconds, stageClock, timedMatch } from "../../game/match/rules";
import { ARENA_CAMERA, FLOOR_HEIGHT, cameraFieldOfView, cameraPoint, extremeCamera, localCamera } from "../../game/presentation/arenaCamera";

import { advanceMatchCamera } from "../../game/sim/matchCamera";
import { stageBounds } from "../../game/sim/stageBounds";
import { damageTint } from "../../game/presentation/hitPresentation";
import { DamagePose, damagePose } from "../../game/presentation/damagePose";
import { hideEffect } from "../../game/render/effects";
import { FRAME_SECONDS, type FighterPose } from "../../game/presentation/fighterPose";
import { CANNON_MODEL, PLATFORM_CUE_FRAMES, framesUntilPlatformMoves, lavaLook } from "../../game/presentation/stageHazards";
import { escapeMeterView, readEscapeMeter } from "../../game/presentation/escapeMeter";
import { lavaPiece } from "../../game/presentation/stageScenery";
import { hasLava, lavaSide } from "../../game/sim/lava";
import type { Fighter } from "../../game/sim/fighter";
import { type MapBuild, journalIngress } from "../../game/shell/build";
import { type StartControl, matchHelp, resultNotice } from "../../game/shell/messages";
import { isIntangible } from "../../game/sim/conditions";
import { type Roster, fighterAt, isActive } from "../../game/sim/roster";
import { surfaceCount, surfaceLeft, surfaceMoves, surfaceRight, surfaceZ } from "../../game/sim/stage";
import { CANNON_Z, cannonAim, cannonOn, cannonX } from "../../game/sim/stageHazards";
import { localParticipantSlot, traceParticipant } from "./diagnostics";
import { placeFighterBody, renderDizzy } from "./fighterBody";
import { type ShellState, type StatusFrames, activeRollback, localSlot, playsOnKeyboard } from "./state";
import { pauseEffects, views } from "./ui";
import { loreClears } from "../../game/classic/loreClears";
import { drawStageScenery } from "./stageScenery";
import { probeCamera, probeWaiting } from "./responseProbe";

declare const os: { readonly clock?: (this: void) => number } | undefined;

/** Two 60 Hz display intervals; callback counts cannot identify a real draw. */
const RESUME_PRESENTATION_SECONDS = f32(1.0 / 30.0);

export function resumePresentationHeld(s: Readonly<ShellState>): boolean {
  return s.resumePresentationUntil !== undefined;
}

/** Presentation alone waits for the local clock; input and match frames keep running. */
export function serviceResumePresentation(s: ShellState): void {
  if (s.resumePresentationUntil === undefined) return;
  if (s.game.phase === Phase.match && typeof os === "object" && typeof os.clock === "function" && os.clock() < s.resumePresentationUntil) return;
  s.resumePresentationUntil = undefined;
  setMatchPresentationPaused(s, s.session.paused);
}

/** Text that waits for the players stays this long. */
export const LASTING = 3600.0;

export function setStatus(s: ShellState, text: string, seconds: number): void {
  s.status.text = text;
  s.status.seconds = seconds;
}

/** A two-second announcement. */
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

export function createStatusFrames(build: Readonly<MapBuild>): StatusFrames {
  return {
    help: frameText("MeleeHelp", MATCH_HELP_BOX.left, MATCH_HELP_BOX.top, MATCH_HELP_BOX.width, MATCH_HELP_BOX.height, f32(0.01)),
    notice: frameText("MeleeNotice", MATCH_NOTICE_BOX.left, MATCH_NOTICE_BOX.top, MATCH_NOTICE_BOX.width, MATCH_NOTICE_BOX.height, f32(0.019)),
    developer: build.devConsole ? frameText("MeleeDeveloper", f32(0.06), f32(0.012), f32(0.72), f32(0.01), f32(0.007)) : undefined,
  };
}

function clearStageDecks(s: ShellState): void {
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

/** One deck model per surface of the chosen stage: the main deck's own, drawn from its collision, and a slab for each raised deck. */
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
      // Stock platforms: the first part stands in for the slab and the rest dress it.
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
  if (hasLava(stage)) {
    const piece = lavaPiece(lavaSide(stageFrame));
    s.stageLava = AddSpecialEffect(piece.model, origin.x + piece.x, origin.y + piece.y);
    BlzSetSpecialEffectPosition(s.stageLava, origin.x + piece.x, origin.y + piece.y, origin.z + piece.z);
    if (piece.matrixScale !== undefined) BlzSetSpecialEffectMatrixScale(s.stageLava, piece.matrixScale[0], piece.matrixScale[1], piece.matrixScale[2]);
    BlzPlaySpecialEffect(s.stageLava, ANIM_TYPE_STAND);
    presentLava(s, stage, stageFrame);
  }
  s.drawnStage = stage;
}

/** Blackrock's lava on its frame's side: hidden while calm, a growing glow through the warning, then full lava. */
function presentLava(s: ShellState, stage: number, frame: number): void {
  const lava = s.stageLava;
  if (lava === undefined || !hasLava(stage)) return;
  const piece = lavaPiece(lavaSide(frame));
  BlzSetSpecialEffectPosition(lava, s.origin.x + piece.x, s.origin.y + piece.y, s.origin.z + piece.z);
  const look = lavaLook(stage, frame);
  BlzSetSpecialEffectAlpha(lava, look.alpha);
  BlzSetSpecialEffectColor(lava, look.red, look.green, look.blue);
}

/** The unit's view of a confirmed frame: visibility, clip, rate, position and tint. */
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
  ShowUnit(body.unit, !pooled && !fighter.status.out && !archerMounted(fighter));
  if (body.renderedSelection !== pose.selectionSerial) {
    if (!pooled) {
      // Starting a hero's Death sequence plays its death cry: only strong hits and knockouts may.
      const cry = gateCry(body.cry ??= createCryGate(), s.runtime.simulationFrame, fighter, pose.clipIndex, pose.clipName);
      const standIn = cry === CryDecision.standIn ? cryStandIn(fighter.character) : undefined;
      if (standIn !== undefined) SetUnitAnimationByIndex(body.unit, standIn);
      else if (cry === CryDecision.keep) {
        // The cry clip already showing carries on.
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
  if (fighter.status.frozenFrames > 0) SetUnitVertexColor(body.unit, 155, 210, 255, 255);
  else if (damageTint(fighter) !== undefined) {
    const tint = damageTint(fighter);
    if (tint !== undefined) SetUnitVertexColor(body.unit, tint.red, tint.green, tint.blue, 255);
  } else {
    const shielded = fighter.shield.raised;
    SetUnitVertexColor(body.unit, shielded ? 100 : 255, shielded ? 160 : 255, 255, isIntangible(fighter) ? 140 : 255);
  }
}

/** Freezes or resumes the units, effects and projectiles. */
export function pauseMatchPresentation(s: ShellState, paused: boolean): void {
  s.resumePresentationUntil = undefined;
  if (!paused && s.game.phase === Phase.match && typeof os === "object" && typeof os.clock === "function") {
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

/** The match persistent visuals show: the speculative one while predicted presentation runs. */
function presentedMatch(s: ShellState): PresentedMatch {
  const rollback = activeRollback(s);
  const confirmedPlaying = s.game.phase === Phase.match;
  if (s.build.presentation === "pool-predicted" && rollback !== undefined && confirmedPlaying) {
    const { speculative } = rollback;
    return { game: speculative.game, world: speculative.world, runtime: speculative.runtime, playing: speculative.game.phase === Phase.match };
  }
  return { game: s.game, world: s.world, runtime: s.runtime, playing: confirmedPlaying };
}

/** Runs once per callback, after confirmed catch-up and any replay. */
export function renderPersistentPresentation(s: ShellState): void {
  if (resumePresentationHeld(s)) return;
  const { game, world, runtime, playing } = presentedMatch(s);
  const stage = game.stageChoice;
  const matchFrame = stageClock(game);
  // The decks drawn are the drawn stage's: the stage menu changes the choice before the match draws it.
  const drawn = s.drawnStage;
  const beforePlatform = framesUntilPlatformMoves(drawn, matchFrame);
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
  const ui = views(s);
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
    renderers?.flash.present(ui.match.posing === slot ? undefined : live, runtime.poses[slot], stage, runtime.simulationFrame);
    if (renderers !== undefined) {
      const agency = live === undefined ? "act" : renderers.agency.forecast.classify(world, slot, stage, matchFrame, s.controls.commands[slot].graceFrames);
      renderers.agency.present(live, agency);
    }
    ui.special.presentHippogryph(live, slot, runtime.simulationFrame);
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

// Preallocated scratch for each slot's escape meter.
const meter = escapeMeterView();

/** Frames the live fighters of the presented match from the side. */
export function lockArenaCamera(s: ShellState): void {
  if (resumePresentationHeld(s)) return;
  const { world, game } = presentedMatch(s);
  // Menus have no simulation camera yet; this temporary view never enters replay state.
  if (!game.camera.initialized) advanceMatchCamera(s.camera, world, game.stageChoice);
  const height = BlzGetLocalClientHeight();
  const aspect = height > 0 ? I2R(BlzGetLocalClientWidth()) / I2R(height) : 16.0 / 9.0;
  localCamera(s.camera, game.camera.initialized ? game.camera : s.camera, game.stageChoice, aspect);
  if (s.viewExtreme !== undefined) extremeCamera(s.camera, game.stageChoice, aspect, s.viewExtreme);
  const { x: centerX, y: centerY } = s.origin;
  const framing = s.camera;
  probeCamera(s.probe, game.camera, framing, centerX, FLOOR_HEIGHT);
  const targetX = centerX + framing.x;
  const duration = s.cameraTween === true && game.phase === Phase.match && !s.session.paused ? FRAME_SECONDS : 0.0;
  if (duration > 0.0) {
    // A bound at the new target would snap the pan before its timed movement.
    const bounds = stageBounds(game.stageChoice).camera;
    const left = centerX + bounds.left;
    const right = centerX + bounds.right;
    SetCameraBounds(left, centerY, right, centerY, left, centerY, right, centerY);
  } else SetCameraBounds(targetX, centerY, targetX, centerY, targetX, centerY, targetX, centerY);
  SetCameraField(CAMERA_FIELD_ROTATION, ARENA_CAMERA.rotation, 0.0);
  SetCameraField(CAMERA_FIELD_ANGLE_OF_ATTACK, ARENA_CAMERA.angleOfAttack, 0.0);
  SetCameraField(CAMERA_FIELD_TARGET_DISTANCE, framing.distance, duration);
  SetCameraField(CAMERA_FIELD_ZOFFSET, FLOOR_HEIGHT + framing.z, duration);
  SetCameraField(CAMERA_FIELD_ROLL, 0.0, 0.0);
  SetCameraField(CAMERA_FIELD_FIELD_OF_VIEW, cameraFieldOfView(framing, aspect), duration);
  SetCameraField(CAMERA_FIELD_FARZ, ARENA_CAMERA.farZ, 0.0);
  if (duration > 0.0) PanCameraToTimed(targetX, centerY, duration);
  else SetCameraPosition(targetX, centerY);
  if (s.build.analogPadDiagnostic === true) {
    // Calibration stays valid throughout both candidate ingress measurements.
    SetCameraBounds(centerX, centerY, centerX, centerY, centerX, centerY, centerX, centerY);
    SetCameraField(CAMERA_FIELD_ANGLE_OF_ATTACK, 270.0, 0.0);
    SetCameraField(CAMERA_FIELD_TARGET_DISTANCE, 3200.0, 0.0);
    SetCameraField(CAMERA_FIELD_ZOFFSET, 0.0, 0.0);
    SetCameraField(CAMERA_FIELD_FIELD_OF_VIEW, 70.0, 0.0);
    SetCameraPosition(centerX, centerY);
  }
  views(s).items.present(game, world);
  for (const slot of PARTICIPANT_SLOTS) {
    const fighter = isActive(world, slot) ? fighterAt(world, slot) : undefined;
    const point = cameraPoint(framing, aspect, fighter?.motion.x ?? 0.0, (fighter?.motion.z ?? 0.0) + 60.0);
    const outside = point.column < 0.0 || point.column > 1.0 || point.row < 0.0 || point.row > 1.0;
    views(s).bubbles[slot].update(game.phase === Phase.match && fighter !== undefined && !fighter.status.out && outside, fighter?.character ?? 0, point.column, point.row, aspect);
    readEscapeMeter(world, slot, meter);
    if (game.phase !== Phase.match) meter.shown = false;
    const meterPoint = cameraPoint(framing, aspect, meter.x, meter.z);
    views(s).escapeMeters[slot].update(meter, meterPoint.column, meterPoint.row, aspect);
  }
}

/** HUD, panels, help, notice and the developer line, for the local player. */
export function renderUi(s: ShellState): void {
  if (resumePresentationHeld(s)) return;
  const { game } = s;
  const ui = views(s);
  const selecting = game.phase === Phase.characterMenu || game.phase === Phase.stageMenu;
  const menu = s.pauseMenu ??= { choice: 0, shown: false, title: false };
  const paused = game.phase === Phase.match && s.session.paused;
  if (paused && !menu.shown) menu.choice = 0;
  menu.shown = paused;
  ui.pause.update(paused, menu.choice, menu.title, game.training, s.trainingHints === true);
  const local = localParticipantSlot(s);
  const localFighter = local !== undefined && s.participants[local].body !== undefined && isActive(s.world, local) ? fighterAt(s.world, local) : undefined;
  const showMatch = !selecting && !(local !== undefined && ui.settings[local].isOpen());
  for (const slot of PARTICIPANT_SLOTS) {
    if (s.participants[slot].body !== undefined && isActive(s.world, slot)) {
      const fighter = fighterAt(s.world, slot);
      ui.huds[slot].update(showMatch, fighter.character, fighter.status.damage, s.game.endless ? 0 : fighter.status.stocks);
      ui.manaBars[slot].hud.update(showMatch, fighter.mana.points, fighter.visuals.manaDenied, fighter.visuals.manaDrained);
    } else {
      ui.huds[slot].update(false, 0, 0.0, 0);
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
  const { help, notice, developer } = s.frames;
  const teaching = game.phase === Phase.match && game.training && s.trainingHints === true && !paused;
  BlzFrameSetVisible(help, showMatch && (game.phase === Phase.result || teaching));
  BlzFrameSetVisible(notice, showMatch && game.phase === Phase.result);
  if (developer !== undefined) BlzFrameSetVisible(developer, false);
  if (!selecting) {
    BlzFrameSetText(help, matchHelp(game, s.session.paused, startControl(s), localFighter, game.phase === Phase.match));
    const waiting = game.phase === Phase.match ? activeRollback(s)?.waitingFor ?? 0 : 0;
    probeWaiting(s.probe, waiting, localSlot());
    BlzFrameSetText(notice, game.phase === Phase.result ? resultNotice(game, s.status.text) : "");
  }
  ui.stage.update(game);
  if (developer === undefined || local === undefined || localFighter === undefined) return;
  const participant = s.participants[local];
  const rollback = activeRollback(s);
  const f = localFighter;
  BlzFrameSetText(developer, `Developer test: ${s.build.id} | player=${local + 1} | phase=${game.phase} | x=${R2I(f.motion.x)} z=${R2I(f.motion.z)}`
    + ` | input=${participant.lastInputAction ?? -1} mode=${rollback !== undefined ? `${s.build.inputProfile} ${s.build.presentation}` : "callback"}`
    + ` normal=${participant.lastNormalStyle ?? -1} move=${f.attack.style ?? -1} attack-frame=${f.attack.frame} simulation=${s.runtime.simulationFrame}`
    + ` predicted=${rollback !== undefined ? rollback.schedule.speculativeFrame() : s.runtime.simulationFrame} serial=${f.attack.serial}`
    + ` down=${f.down.state}:${f.down.frame} DI=${f.launch.diSerial}:${R2I(f.launch.diAngleDegrees)} S=${f.launch.sdiSerial} A=${f.launch.asdiSerial} | Ctrl+R restart`);
}
