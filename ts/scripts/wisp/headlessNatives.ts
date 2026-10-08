import type { IntentionalNoops } from "wisp/src/headless/client";

declare const SetCameraPosition: (x: number, y: number) => void;

/** Assumptions shared by the Bun journey and emitted-Lua journey. */
export const SMASHCRAFT_NOOPS: IntentionalNoops = {
  BlzFrameSetFont: "quick-match checks frame text and points; font rasterization is not part of its verdict",
  BlzFrameSetTextAlignment: "quick-match checks frame text and points; glyph alignment is not part of its verdict",
  BlzFrameSetScale: "quick-match checks declared frame positions; Warcraft frame scaling is not part of its verdict",
  GetPlayableMapRect: "stage initialization only uses this rectangle to obtain the declared zero-centered map origin",
  GetRectCenter: "stage initialization uses the declared zero-centered map origin supplied by location getters",
  RemoveLocation: "the temporary stage-center location holds no state after initialization",
  BlzHideOriginFrames: "the headless UI contains only map-created frames; Warcraft's origin UI is not rendered",
  BlzEnableSelections: "the journey drives the map's scripted fighter controls and never Warcraft selection",
  EnableUserControl: "the journey drives scripted input without an operating-system window",
  SetPlayerColor: "the map gives each participant player its own slot's colour, so an effect's recorded player is its colour",
  FogEnable: "visibility is decided by the map's stage and effect state; terrain fog of war is not simulated",
  FogMaskEnable: "visibility is decided by the map's stage and effect state; terrain fog mask is not simulated",
  BlzSetSpecialEffectAnimationBlendTime: "quick-match records selected clips and times without Warcraft animation blending",
  GetSoundFileDuration: "cue presence and start frames are inspected; audio decoding and duration are not simulated",
  SetSoundDistances: "item cue starts and world positions are inspected; engine audio attenuation is not simulated",
  SetSoundDistanceCutoff: "item cue starts and world positions are inspected; engine audio attenuation is not simulated",
  SetSoundDuration: "cue presence and start frames are inspected; audio completion is not simulated",
  SetSkyModel: "the sky is scenery outside quick-match's gameplay and scene assertions",
  SetDayNightModels: "quick-match uses map scene state without Warcraft's day-night lighting",
  SetTerrainFogEx: "quick-match does not assert engine terrain fog appearance",
  BlzSetMinShadowCastingPointLightCount: "quick-match does not assert engine point-light shadows",
  CameraSetSmoothingFactor: "headless captures the camera target directly without engine interpolation",
  SetTimeOfDay: "the map's deterministic frame clock drives gameplay; engine lighting time is unused",
  SetTimeOfDayScale: "the map's deterministic frame clock drives gameplay; engine lighting time is unused",
  BlzSetUnitName: "fighter labels come from map frames; engine unit hover names are not inspected",
  SetUnitBlendTime: "quick-match records body clips without Warcraft animation blending",
  BlzSetUnitRealField: "this map only sets engine selection scale; scripted fighter hit regions do not use it",
  SetUnitInvulnerable: "the map's fighting simulation owns damage; Warcraft unit damage is not used",
  SetUnitPathing: "the map's fighting simulation owns motion and collision; Warcraft pathing is not used",
  UnitAddAbility: "Crow Form and Locust only configure engine fighter-body presentation; combat is scripted",
  UnitRemoveAbility: "removing Crow Form only configures engine fighter-body presentation; combat is scripted",
  PauseUnit: "the map moves and animates paused fighter bodies through native setters; unit AI is not used",
  SetCameraBounds: "scripted camera positions define headless captures; engine scrolling bounds are unused",
  TriggerRegisterPlayerEvent: "quick-match has fixed connected clients and no player-leave event",
  EndThematicMusic: "quick-match inspects explicit sound cues; background music playback is not simulated",
  StopMusic: "quick-match inspects explicit sound cues; background music playback is not simulated",
  ClearMapMusic: "quick-match inspects explicit sound cues; background music playlists are not simulated",
  PlayMusic: "quick-match inspects explicit sound cues; background music playback is not simulated",
  SetCineFilterTexture: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterBlendMode: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterTexMapFlags: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterStartUV: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterEndUV: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterStartColor: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterEndColor: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  SetCineFilterDuration: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
  DisplayCineFilter: "the KO flash's screen filter is local presentation; headless checks do not render the screen",
};

export const smashcraftNativeBehavior = () => ({
  // Headless frames retain the requested target; only native capture measures the transition.
  PanCameraToTimed: (x: number, y: number) => SetCameraPosition(x, y),
  // Smashcraft's authored stage origin is (0, 0, 0).
  GetLocationX: () => 0,
  GetLocationY: () => 0,
  GetLocationZ: () => 0,
  // Journey key events provide input; there is no physical mouse in either runtime.
  BlzGetMouseScreenPosX: () => 0,
  BlzGetMouseScreenPosY: () => 0,
  BlzIsMouseButtonPressed: () => false,
});
