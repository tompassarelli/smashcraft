import { f32 } from "wisp/src/sim/f32";
import { ARENA_CAMERA, WORLD_BOUNDS } from "../../game/presentation/arenaCamera";
import { copyMatchCamera, createMatchCamera, limitCamera, type MatchCamera } from "../../game/sim/matchCamera";
import { stageBounds } from "../../game/sim/stageBounds";
import { surfaceLeft, surfaceRight, surfaceZ } from "../../game/sim/stage";
import { Phase, stageClock } from "../../game/match/rules";
import type { ShellState } from "./state";

export interface PauseCamera {
  readonly saved: MatchCamera;
  readonly aspect: number;
  tilt: number;
  hideHud: boolean;
  using: boolean;
  readonly held: boolean[];
}

export const PAUSE_CAMERA_KEYS = [0x49, 0x4a, 0x4b, 0x4c, 0xbb, 0xbd, 0x6b, 0x6d, 0x4f, 0x50, 0x48];
export const pauseCameraKey = (key: number): boolean => PAUSE_CAMERA_KEYS.includes(key);
export const pauseHudHidden = (s: Readonly<ShellState>): boolean => (s.build.devConsole && s.promoHudHidden === true) || (s.session.paused && s.pauseCamera?.hideHud === true);

export function beginPauseCamera(s: ShellState, aspect: number): void {
  if (s.pauseCamera !== undefined) return;
  const saved = createMatchCamera();
  copyMatchCamera(saved, s.camera);
  s.pauseCamera = { saved, aspect, tilt: 0.0, hideHud: false, using: false, held: [] };
}

/** Only the local player's pause keys reach this state; no combat sampler reads it. */
export function cameraKey(s: ShellState, key: number, down: boolean): boolean {
  if (!pauseCameraKey(key) || !s.session.paused || s.game.phase !== Phase.match) return false;
  const camera = s.pauseCamera;
  if (camera === undefined) return true;
  if (down && !camera.held[key]) {
    camera.using = true;
    if (key === 0x48) camera.hideHud = !camera.hideHud;
    else {
      camera.held[key] = true;
      advancePauseCamera(s, camera.aspect);
    }
  }
  camera.held[key] = down;
  return true;
}

/** A camera gesture stays hidden until a menu key is used, even after its release. */
export function returnPauseMenu(s: ShellState): void {
  if (s.pauseCamera !== undefined) s.pauseCamera.using = false;
}

export function advancePauseCamera(s: ShellState, aspect: number): void {
  const camera = s.pauseCamera;
  if (camera === undefined) return;
  const held = (key: number): number => camera.held[key] ? 1 : 0;
  const x = held(0x4c) - held(0x4a);
  const z = held(0x49) - held(0x4b);
  const zoom = held(0xbd) + held(0x6d) - held(0xbb) - held(0x6b);
  const tilt = held(0x4f) - held(0x50);
  if (x === 0 && z === 0 && zoom === 0 && tilt === 0) return;
  s.camera.x = f32(s.camera.x + x * 12.0);
  s.camera.z = f32(s.camera.z + z * 12.0);
  s.camera.distance = Math.max(498.0, f32(s.camera.distance + zoom * 24.0));
  camera.tilt = Math.min(15.0, Math.max(-25.0, f32(camera.tilt + tilt * 0.5)));
  const bounds = stageBounds(s.game.stageChoice);
  limitCamera(s.camera, bounds.camera, aspect, bounds.blast.bottom);
  const stageFrame = stageClock(s.game);
  const deck = surfaceZ(s.game.stageChoice, 0, stageFrame);
  const angle = (10.0 - camera.tilt) * Math.PI / 180.0;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const reach = f32(s.camera.distance * s.camera.tangent);
  const pitch = f32(s.camera.tangent * sine);
  const above = f32(reach / f32(cosine + pitch));
  const below = f32(reach / f32(cosine - pitch));
  s.camera.z = Math.min(f32(f32(deck + below) - 24.0), Math.max(f32(f32(deck - above) + 24.0), s.camera.z));
  const depth = f32(s.camera.distance - f32(f32(deck - s.camera.z) * sine));
  const width = f32(f32(depth * s.camera.tangent) * aspect);
  const left = surfaceLeft(s.game.stageChoice, 0, stageFrame);
  const right = surfaceRight(s.game.stageChoice, 0, stageFrame);
  s.camera.x = Math.min(f32(f32(right + width) - 24.0), Math.max(f32(f32(left - width) + 24.0), s.camera.x));
  s.camera.x = Math.min(WORLD_BOUNDS.right - s.origin.x, Math.max(WORLD_BOUNDS.left - s.origin.x, s.camera.x));
}

export const pauseCameraAngle = (s: Readonly<ShellState>): number => ARENA_CAMERA.angleOfAttack + (s.pauseCamera?.tilt ?? 0.0);

/** The controller types into the focused journal box; these local letters never enter its records. */
export function servicePauseCameraControls(s: ShellState): void {
  if (!s.session.paused || s.game.phase !== Phase.match) return;
  const controls = s.rollback?.journal?.editbox?.takePauseControls() ?? "";
  for (let index = 0; index < controls.length; index++) {
    const key = controls.charAt(index);
    const code = key === "=" ? 0xbb : key === "-" ? 0xbd : key.toUpperCase().charCodeAt(0);
    if (pauseCameraKey(code)) {
      cameraKey(s, code, true);
      cameraKey(s, code, false);
    } else returnPauseMenu(s);
  }
}
