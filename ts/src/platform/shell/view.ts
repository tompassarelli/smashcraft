// What each client shows: fighter units, stage decks, status text, the HUD
// and the camera. Everything here is presentation; with predicted
// presentation, persistent visuals follow the speculative match and event
// effects, audio, results and HUD follow the confirmed one.
import { STAGE_DECK_MODEL, STAGE_MAIN_DECK_MODEL } from "../../game/assets/stageAssetInfo";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import type { PacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { Phase, remainingSeconds, timedMatch } from "../../game/match/rules";
import { ARENA_CAMERA, FLOOR_HEIGHT, arenaFraming } from "../../game/presentation/arenaCamera";
import { DamagePose, damagePose } from "../../game/presentation/damagePose";
import type { FighterPose } from "../../game/presentation/fighterPose";
import { type MapBuild, journalIngress } from "../../game/shell/build";
import { MOMENT_SAVED_MESSAGE, type StartControl, fighterLabel, matchHelp, resultNotice, waitingMessage } from "../../game/shell/messages";
import { isIntangible } from "../../game/sim/conditions";
import { type Roster, fighterAt, isActive } from "../../game/sim/roster";
import { surfaceCount, surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "../../game/sim/stage";
import { localParticipantSlot, traceParticipant } from "./diagnostics";
import { placeFighterBody, renderDizzy } from "./fighterBody";
import { type ShellState, type StatusFrames, activeRollback, localSlot, playsOnKeyboard } from "./state";
import { pauseEffects, views } from "./ui";
import { drawStageScenery } from "./stageScenery";

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
    help: frameText("MeleeHelp", f32(0.06), f32(0.54), f32(0.58), f32(0.055), f32(0.01)),
    notice: frameText("MeleeNotice", f32(0.26), f32(0.47), f32(0.42), f32(0.07), f32(0.019)),
    developer: build.devConsole ? frameText("MeleeDeveloper", f32(0.06), f32(0.012), f32(0.72), f32(0.01), f32(0.007)) : undefined,
  };
}

function clearStageDecks(s: ShellState): void {
  for (const deck of s.stageDecks) {
    BlzSetSpecialEffectScale(deck, 0.0);
    DestroyEffect(deck);
  }
  s.stageDecks.length = 0;
}

/** One deck model per surface of the chosen stage: the main deck's own, drawn from its collision, and a slab for each raised deck. */
export function drawStage(s: ShellState): void {
  clearStageDecks(s);
  drawStageScenery(s);
  const { origin } = s;
  const stage = s.game.stageChoice;
  for (let index = 0; index < surfaceCount(stage); index++) {
    const left = surfaceLeft(stage, index);
    const right = surfaceRight(stage, index);
    const pass = surfacePass(stage, index);
    const x = origin.x + (left + right) / 2;
    const deck = AddSpecialEffect(index === 0 ? STAGE_MAIN_DECK_MODEL : STAGE_DECK_MODEL, x, origin.y);
    BlzSetSpecialEffectPosition(deck, x, origin.y, origin.z + surfaceZ(stage, index));
    // The slab's walking plane spans [-50, 50] at z = 0; the body stays below it.
    if (index > 0) BlzSetSpecialEffectMatrixScale(deck, (right - left) / 100, pass ? f32(0.65) : 1.0, pass ? f32(0.45) : 1.0);
    s.stageDecks.push(deck);
  }
}

/** The unit's view of a confirmed frame: visibility, clip, rate, position and tint. */
export function renderFighter(s: ShellState, slot: ParticipantSlot, pose: Readonly<FighterPose>, wasOut: boolean): void {
  const participant = s.participants[slot];
  const { body } = participant;
  if (body === undefined || !isActive(s.world, slot)) return;
  const fighter = fighterAt(s.world, slot);
  renderDizzy(body, fighter, s.game.phase === Phase.match, s.origin);
  if (wasOut && !fighter.status.out) ShowUnit(body.unit, true);
  else if (!wasOut && fighter.status.out) {
    ShowUnit(body.unit, false);
    if (fighter.status.stocks > 0) announce(s, `${fighterLabel(s.game, slot)} ${s.game.endless ? "was knocked out" : "lost a stock"}!`);
  }
  const { pooled } = participant;
  if (pooled) ShowUnit(body.unit, false);
  if (body.renderedSelection !== pose.selectionSerial) {
    if (!pooled) {
      if (pose.clipIndex !== undefined) SetUnitAnimationByIndex(body.unit, pose.clipIndex);
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
  placeFighterBody(body, fighter, s.origin);
  if (fighter.status.frozenFrames > 0) SetUnitVertexColor(body.unit, 155, 210, 255, 255);
  else {
    const shielded = fighter.shield.raised;
    SetUnitVertexColor(body.unit, shielded ? 100 : 255, shielded ? 160 : 255, 255, isIntangible(fighter) ? 140 : 255);
  }
}

/** Freezes or resumes the units, effects and projectiles. */
export function pauseMatchPresentation(s: ShellState, paused: boolean): void {
  for (const slot of PARTICIPANT_SLOTS) {
    const { body } = s.participants[slot];
    if (body === undefined || !isActive(s.world, slot)) continue;
    if (paused) SetUnitTimeScale(body.unit, 0.0);
    else if (!fighterAt(s.world, slot).status.out) renderFighter(s, slot, s.runtime.poses[slot], false);
  }
  pauseEffects(s, paused);
}

interface PresentedMatch {
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
    return { world: speculative.world, runtime: speculative.runtime, playing: speculative.game.phase === Phase.match };
  }
  return { world: s.world, runtime: s.runtime, playing: confirmedPlaying };
}

/** Runs once per callback, after confirmed catch-up and any replay. */
export function renderPersistentPresentation(s: ShellState): void {
  const { world, runtime, playing } = presentedMatch(s);
  const ui = views(s);
  ui.combat.present(runtime.impacts, s.runtime.impacts, playing);
  for (const slot of PARTICIPANT_SLOTS) {
    const fighter = isActive(world, slot) ? fighterAt(world, slot) : undefined;
    const renderers = ui.fighters[slot];
    if (renderers?.pool !== undefined) {
      if (fighter !== undefined) renderers.pool.present(fighter, runtime.poses[slot]);
      else renderers.pool.hide();
    }
    const live = playing ? fighter : undefined;
    ui.special.presentStatic(runtime.specials, live, slot);
    ui.special.presentSummons(runtime.summons, live, slot);
    if (live !== undefined) ui.frost.present(live, slot);
    else ui.frost.hideSlot(slot);
    renderers?.shield.present(fighter, playing);
    renderers?.projectiles.present(fighter, playing, s.session.paused);
  }
}

/** Frames the live fighters of the presented match from the side. */
export function lockArenaCamera(s: ShellState): void {
  const { world } = presentedMatch(s);
  let left = 0.0;
  let right = 0.0;
  let bottom = 0.0;
  let top = 0.0;
  let live = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(s.world, slot) || s.participants[slot].body === undefined || !isActive(world, slot)) continue;
    const { motion, status } = fighterAt(world, slot);
    if (status.out) continue;
    left = live === 0 ? motion.x : Math.min(left, motion.x);
    right = live === 0 ? motion.x : Math.max(right, motion.x);
    bottom = live === 0 ? motion.z : Math.min(bottom, motion.z);
    top = live === 0 ? motion.z : Math.max(top, motion.z);
    live++;
  }
  const { x: centerX, y: centerY } = s.origin;
  const framing = arenaFraming(left, right, bottom, top);
  const targetX = centerX + framing.x;
  SetCameraBounds(targetX, centerY, targetX, centerY, targetX, centerY, targetX, centerY);
  SetCameraField(CAMERA_FIELD_ROTATION, ARENA_CAMERA.rotation, 0.0);
  SetCameraField(CAMERA_FIELD_ANGLE_OF_ATTACK, ARENA_CAMERA.angleOfAttack, 0.0);
  SetCameraField(CAMERA_FIELD_TARGET_DISTANCE, framing.distance, 0.0);
  SetCameraField(CAMERA_FIELD_ZOFFSET, FLOOR_HEIGHT + framing.z, 0.0);
  SetCameraField(CAMERA_FIELD_ROLL, 0.0, 0.0);
  SetCameraField(CAMERA_FIELD_FIELD_OF_VIEW, ARENA_CAMERA.fieldOfView, 0.0);
  SetCameraField(CAMERA_FIELD_FARZ, ARENA_CAMERA.farZ, 0.0);
  SetCameraPosition(targetX, centerY);
}

/** HUD, panels, help, notice and the developer line, for the local player. */
export function renderUi(s: ShellState): void {
  const { game } = s;
  const ui = views(s);
  const selecting = game.phase === Phase.characterMenu || game.phase === Phase.stageMenu;
  const local = localParticipantSlot(s);
  const localFighter = local !== undefined && s.participants[local].body !== undefined && isActive(s.world, local) ? fighterAt(s.world, local) : undefined;
  const showMatch = !selecting && !(local !== undefined && ui.settings[local].isOpen());
  for (const slot of PARTICIPANT_SLOTS) {
    if (s.participants[slot].body !== undefined && isActive(s.world, slot)) {
      const fighter = fighterAt(s.world, slot);
      ui.huds[slot].update(showMatch, fighter.character, fighter.status.damage, s.game.endless ? 0 : fighter.status.stocks);
    } else ui.huds[slot].update(false, 0, 0.0, 0);
    ui.selections[slot].update(game, ui.settings[slot].isOpen());
    ui.settings[slot].update();
  }
  ui.clock.update(showMatch && timedMatch(game), remainingSeconds(game));
  const { help, notice, developer } = s.frames;
  BlzFrameSetVisible(help, showMatch);
  BlzFrameSetVisible(notice, showMatch);
  if (developer !== undefined) BlzFrameSetVisible(developer, showMatch);
  if (!selecting) {
    BlzFrameSetText(help, matchHelp(game, s.session.paused, startControl(s), localFighter, game.phase === Phase.match));
    const waiting = game.phase === Phase.match ? activeRollback(s)?.waitingFor ?? 0 : 0;
    BlzFrameSetText(notice, waiting !== 0 ? waitingMessage(waiting)
      : localFighter?.attack.smashCharging === true ? "Charging smash: release Attack to strike."
      : s.moment.notice > 0 ? MOMENT_SAVED_MESSAGE : resultNotice(game, s.status.seconds > 0 ? s.status.text : ""));
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
