// Foreign animation boundary diagnostic: one visible model per interrupted
// pose, switching to a constant pain target without touching gameplay state.
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { ARENA_CAMERA, FLOOR_HEIGHT } from "../game/presentation/arenaCamera";
import { facingYaw } from "../game/render/effects";
import { DAMAGE_BLEND_PROBE_MODELS } from "./damageBlendProbeModels";

interface Case {
  readonly model: effect;
  readonly sourceSeconds: number;
  readonly clock: number;
}

function report(frame: number, phase: string): void {
  PreloadGenClear();
  PreloadGenStart();
  Preload(`DAMAGE_BLEND_PROBE frame=${frame} phase=${phase} blendSeconds=0.05`);
  Preload("left-to-right: ready-frozen, ready-running, tilt-frozen, tilt-running; upper row faces right, lower row faces left");
  PreloadGenEnd("smashcraft-damage-blend-probe.txt");
}

export function start(this: void): void {
  const cases: Case[] = [];
  for (const facing of [1, -1]) {
    for (let donor = 0; donor < DAMAGE_BLEND_PROBE_MODELS.length; donor++) {
      const source = DAMAGE_BLEND_PROBE_MODELS[donor];
      if (source === undefined) throw new Error("Damage probe donor missing");
      for (const clock of [0, 1]) {
        const x = -240.0 + donor * 320.0 + clock * 160.0;
        const model = AddSpecialEffect(source.path, x, 0.0);
        BlzSetSpecialEffectPosition(model, x, 0.0, FLOOR_HEIGHT + (facing > 0 ? 100.0 : -100.0));
        BlzSetSpecialEffectYaw(model, facingYaw(facing));
        BlzSetSpecialEffectScale(model, 1.0);
        cases.push({ model, sourceSeconds: source.sourceSeconds, clock });
      }
    }
  }
  SetCameraField(CAMERA_FIELD_ROTATION, ARENA_CAMERA.rotation, 0.0);
  SetCameraField(CAMERA_FIELD_ANGLE_OF_ATTACK, ARENA_CAMERA.angleOfAttack, 0.0);
  SetCameraField(CAMERA_FIELD_TARGET_DISTANCE, 1450.0, 0.0);
  SetCameraField(CAMERA_FIELD_ZOFFSET, FLOOR_HEIGHT + 50.0, 0.0);
  SetCameraField(CAMERA_FIELD_FIELD_OF_VIEW, 70.0, 0.0);
  SetCameraField(CAMERA_FIELD_FARZ, ARENA_CAMERA.farZ, 0.0);
  SetCameraPosition(0.0, 0.0);
  let frame = 0;
  TimerStart(CreateTimer(), f32(1.0 / 60.0), true, () => {
    const phase = floorMod(frame, 180);
    if (phase === 0) {
      for (const entry of cases) {
        BlzSetSpecialEffectAnimationBlendTime(entry.model, 0.0);
        BlzSetSpecialEffectTimeScale(entry.model, 0.0);
        BlzSetSpecialEffectAnimation(entry.model, "Stand");
        BlzSetSpecialEffectTime(entry.model, entry.sourceSeconds);
      }
      report(frame, "interrupted");
    } else if (phase === 60) {
      for (const entry of cases) {
        BlzSetSpecialEffectAnimationBlendTime(entry.model, f32(0.05));
        BlzSetSpecialEffectAnimation(entry.model, "Stand Hit");
        BlzSetSpecialEffectTimeScale(entry.model, entry.clock);
      }
      report(frame, "blend-start");
    } else if (phase === 66) {
      for (const entry of cases) BlzSetSpecialEffectTimeScale(entry.model, 0.0);
      report(frame, "held-pain");
    }
    frame++;
  });
}
