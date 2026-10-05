// Actor-owned tuning, in world units per simulation frame. Character identity
// selects moves and presentation; these records travel with each fighter so
// reference rigs can substitute retail values without retuning the roster.
import { f32 } from "../../sim/f32";
import { AttackStyle, Character } from "./codes";
import { attackDurationFramesForGrounding, attackStartupFrames } from "./moves";

export const WORLD_UNITS_PER_MELEE_UNIT = 6.0;

/** A Melee-unit tuning value in world units, rounded as the game rounds it. */
export function melee(units: number): number {
  return f32(units * WORLD_UNITS_PER_MELEE_UNIT);
}

export interface FighterPhysics {
  readonly weight: number;
  readonly gravity: number;
  readonly terminalSpeed: number;
  readonly fastFallSpeed: number;
  readonly airAcceleration: number;
  readonly airSpeed: number;
  readonly airFriction: number;
  readonly airCap: number;
  readonly traction: number;
  readonly dashSpeed: number;
  readonly runSpeed: number;
  readonly walkSpeed: number;
  /** Frames, an integer. */
  readonly jumpSquatFrames: number;
  readonly fullJumpSpeed: number;
  readonly shortJumpSpeed: number;
  readonly aerialJumpSpeed: number;
  readonly jumpMomentum: number;
  readonly jumpHorizontalSpeed: number;
  readonly jumpHorizontalCap: number;
  readonly aerialJumpHorizontalSpeed: number;
  readonly shieldBreakSpeed: number;
  readonly walkAccelerationMultiplier: number;
  readonly walkAccelerationBase: number;
  readonly groundAccelerationMultiplier: number;
  readonly groundAccelerationBase: number;
  readonly groundSpeedCap: number;
}

/** Wall and ceiling tech motion; kept apart so the retail rig can supply it without retuning playables. */
export interface SurfaceRecoveryPhysics {
  readonly passiveWallSpeed: number;
  readonly wallJumpHorizontalSpeed: number;
  readonly wallJumpVerticalSpeed: number;
  readonly passiveCeilingSpeed: number;
  readonly wallJumpMinimumApproach: number;
  readonly canWallJump: boolean;
}

/** Actor command timing for dash, run, turn-run and run-brake animations, in frames. */
export interface GroundMovementRules {
  readonly dashRunEnableFrame: number;
  readonly turnRunFacingCommandFrame: number;
  readonly turnRunAnimationEndFrame: number;
  readonly runBrakeTurnCommandEndFrame: number;
  readonly runBrakeAnimationEndFrame: number;
  readonly runBrakeMaximumFrames: number;
}

export interface DashGrabRules {
  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly totalFrames: number;
}

/** The authored shield circle, facing-relative. */
export interface ShieldGeometry {
  readonly centerX: number;
  readonly centerZ: number;
  readonly radius: number;
}

/** Surface tech animation timing; NTSC Fox/Falco push off on frame 14, Captain Falcon on 11. */
export interface TechTiming {
  readonly ceilingImpulseFrame: number;
  readonly ceilingAnimationEndFrame: number;
  readonly wallAnimationEndFrame: number;
  readonly wallJumpAnimationEndFrame: number;
}

export interface ShieldBreakTiming {
  readonly landFrames: number;
  readonly standFrames: number;
}

/** Every tuning record a fighter carries; each is replaced whole, never edited in place. */
export interface FighterTuning {
  physics: FighterPhysics;
  surface: SurfaceRecoveryPhysics;
  ground: GroundMovementRules;
  dashGrab: DashGrabRules;
  shield: ShieldGeometry;
  tech: TechTiming;
  shieldBreak: ShieldBreakTiming;
}

export const GROUND_TRACTION = melee(0.07999999821186066);
export const INITIAL_DASH_SPEED = melee(1.899999976158142);
// Shared ground acceleration defaults for original Smashcraft fighters. The
// Falco reference rig supplies its separately sourced values in tests only.
const GROUND_ACCELERATION_MULTIPLIER = 0.10000000149011612;
const GROUND_ACCELERATION_BASE = 0.019999999552965164;
const GROUND_SPEED_CAP = melee(3.0);

const ORIGINAL_ACCELERATION = {
  walkAccelerationMultiplier: GROUND_ACCELERATION_MULTIPLIER,
  walkAccelerationBase: GROUND_ACCELERATION_BASE,
  groundAccelerationMultiplier: GROUND_ACCELERATION_MULTIPLIER,
  groundAccelerationBase: GROUND_ACCELERATION_BASE,
  groundSpeedCap: GROUND_SPEED_CAP,
} as const;

/** Defaults for the original roster, never a reference-character selector. */
export const AUTHORED_PHYSICS: { readonly [name in keyof typeof Character]: FighterPhysics } = {
  archer: {
    weight: 75.0,
    gravity: melee(0.23000000417232513),
    terminalSpeed: melee(2.799999952316284),
    fastFallSpeed: melee(3.4000000953674316),
    airAcceleration: melee(f32(0.019999999552965164 + 0.05999999865889549)),
    airSpeed: melee(0.8299999833106995),
    airFriction: melee(0.019999999552965164),
    airCap: melee(3.0),
    traction: GROUND_TRACTION,
    dashSpeed: INITIAL_DASH_SPEED,
    runSpeed: melee(2.200000047683716),
    walkSpeed: melee(1.600000023841858),
    jumpSquatFrames: 3,
    fullJumpSpeed: melee(3.680000066757202),
    shortJumpSpeed: melee(2.0999999046325684),
    aerialJumpSpeed: f32(melee(3.680000066757202) * 1.2000000476837158),
    jumpMomentum: 0.8299999833106995,
    jumpHorizontalSpeed: melee(0.7200000286102295),
    jumpHorizontalCap: melee(1.7000000476837158),
    aerialJumpHorizontalSpeed: melee(0.8999999761581421),
    shieldBreakSpeed: melee(3.299999952316284),
    ...ORIGINAL_ACCELERATION,
  },
  rifleman: {
    weight: 80.0,
    gravity: melee(0.17000000178813934),
    terminalSpeed: melee(3.0999999046325684),
    fastFallSpeed: melee(3.5),
    airAcceleration: melee(f32(0.019999999552965164 + 0.05000000074505806)),
    airSpeed: melee(0.8299999833106995),
    airFriction: melee(0.019999999552965164),
    airCap: melee(4.0),
    traction: GROUND_TRACTION,
    dashSpeed: INITIAL_DASH_SPEED,
    runSpeed: melee(1.5),
    walkSpeed: melee(1.399999976158142),
    jumpSquatFrames: 5,
    fullJumpSpeed: melee(4.099999904632568),
    shortJumpSpeed: melee(1.899999976158142),
    aerialJumpSpeed: f32(melee(4.099999904632568) * 0.9399999976158142),
    jumpMomentum: 1.0,
    jumpHorizontalSpeed: melee(0.699999988079071),
    jumpHorizontalCap: melee(1.7000000476837158),
    aerialJumpHorizontalSpeed: melee(0.9399999976158142),
    shieldBreakSpeed: melee(3.299999952316284),
    ...ORIGINAL_ACCELERATION,
  },
  demonHunter: {
    weight: 80.0,
    gravity: melee(0.1899999976158142),
    terminalSpeed: melee(3.0),
    fastFallSpeed: melee(3.450000047683716),
    airAcceleration: melee(0.07500000298023224),
    airSpeed: melee(0.8799999952316284),
    airFriction: melee(0.019999999552965164),
    airCap: melee(0.8799999952316284),
    traction: GROUND_TRACTION,
    dashSpeed: INITIAL_DASH_SPEED,
    runSpeed: melee(1.850000023841858),
    walkSpeed: melee(1.5499999523162842),
    jumpSquatFrames: 4,
    fullJumpSpeed: 24.200000762939453,
    shortJumpSpeed: 13.199999809265137,
    aerialJumpSpeed: 25.5,
    jumpMomentum: 1.0,
    jumpHorizontalSpeed: 0.0,
    jumpHorizontalCap: 0.0,
    aerialJumpHorizontalSpeed: 0.0,
    shieldBreakSpeed: 24.0,
    ...ORIGINAL_ACCELERATION,
  },
};

export function authoredPhysics(character: Character): FighterPhysics {
  switch (character) {
    case Character.archer:
      return AUTHORED_PHYSICS.archer;
    case Character.rifleman:
      return AUTHORED_PHYSICS.rifleman;
    case Character.demonHunter:
      return AUTHORED_PHYSICS.demonHunter;
  }
}

export const NO_SURFACE_RECOVERY_PHYSICS: SurfaceRecoveryPhysics = {
  passiveWallSpeed: 0.0,
  wallJumpHorizontalSpeed: 0.0,
  wallJumpVerticalSpeed: 0.0,
  passiveCeilingSpeed: 0.0,
  wallJumpMinimumApproach: 0.0,
  canWallJump: false,
};

// The original roster keeps authored movement timing. NTSC reference fixtures
// inject their own actor-owned command timeline; the encoded event is not a
// universal character constant.
export const INITIAL_DASH_FRAMES = 10;

/** Smashcraft's authored approximation of the run timeline, not a retail-derived value. */
export const AUTHORED_GROUND_MOVEMENT_RULES: GroundMovementRules = {
  dashRunEnableFrame: INITIAL_DASH_FRAMES + 1,
  turnRunFacingCommandFrame: 9,
  turnRunAnimationEndFrame: 20,
  runBrakeTurnCommandEndFrame: 15,
  runBrakeAnimationEndFrame: 0,
  runBrakeMaximumFrames: 0,
};

export const NTSC_FOX_GROUND_MOVEMENT_RULES: GroundMovementRules = {
  dashRunEnableFrame: 12,
  turnRunFacingCommandFrame: 9,
  turnRunAnimationEndFrame: 20,
  runBrakeTurnCommandEndFrame: 15,
  runBrakeAnimationEndFrame: 18,
  runBrakeMaximumFrames: 30,
};
export const NTSC_FALCO_GROUND_MOVEMENT_RULES: GroundMovementRules = NTSC_FOX_GROUND_MOVEMENT_RULES;
export const NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES: GroundMovementRules = {
  dashRunEnableFrame: 16,
  turnRunFacingCommandFrame: 9,
  turnRunAnimationEndFrame: 22,
  runBrakeTurnCommandEndFrame: 15,
  runBrakeAnimationEndFrame: 28,
  runBrakeMaximumFrames: 30,
};

/** The authored roster dash grabs with its ordinary grab timing; test rigs override it. */
export const AUTHORED_DASH_GRAB_RULES: DashGrabRules = {
  startupFrames: attackStartupFrames(AttackStyle.grab),
  activeFrames: 1,
  totalFrames: attackDurationFramesForGrounding(AttackStyle.grab, true),
};

export const NTSC_FOX_DASH_GRAB_RULES: DashGrabRules = { startupFrames: 10, activeFrames: 2, totalFrames: 40 };
export const NTSC_FALCO_DASH_GRAB_RULES: DashGrabRules = NTSC_FOX_DASH_GRAB_RULES;
export const NTSC_CAPTAIN_FALCON_DASH_GRAB_RULES: DashGrabRules = { startupFrames: 9, activeFrames: 2, totalFrames: 40 };

export const AUTHORED_SHIELD_GEOMETRY: ShieldGeometry = { centerX: 0.0, centerZ: 45.0, radius: 60.0 };

export const AUTHORED_TECH_TIMING: TechTiming = {
  ceilingImpulseFrame: 14,
  ceilingAnimationEndFrame: 26,
  wallAnimationEndFrame: 26,
  wallJumpAnimationEndFrame: 40,
};

export const SHIELD_BREAK_LAND_FRAMES = 12;
export const SHIELD_BREAK_STAND_FRAMES = 30;
export const AUTHORED_SHIELD_BREAK_TIMING: ShieldBreakTiming = { landFrames: SHIELD_BREAK_LAND_FRAMES, standFrames: SHIELD_BREAK_STAND_FRAMES };

export function authoredTuning(character: Character): FighterTuning {
  return {
    physics: authoredPhysics(character),
    surface: NO_SURFACE_RECOVERY_PHYSICS,
    ground: AUTHORED_GROUND_MOVEMENT_RULES,
    dashGrab: AUTHORED_DASH_GRAB_RULES,
    shield: AUTHORED_SHIELD_GEOMETRY,
    tech: AUTHORED_TECH_TIMING,
    shieldBreak: AUTHORED_SHIELD_BREAK_TIMING,
  };
}
