


import { multiplyFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { AttackStyle, Character } from "./codes";
import { attackDurationFramesForGrounding, attackStartupFrames } from "./moves";
import type { Roster } from "./roster";
import type { FighterMoves } from "./heroMoves";
import type { AuthoredSpecial, FighterSpecials } from "./heroSpecials";
import { FIGHTER_ULTIMATES } from "./ultimates";
import { heroBody } from "./heroes/heroBodies";
import { heroDefinition } from "./heroes/registry";
import { originalFighterMoves } from "./originalMoves";

export const WORLD_UNITS_PER_MELEE_UNIT = 6.0;


export function melee(units: number): number {
  return multiplyFloat32(units, WORLD_UNITS_PER_MELEE_UNIT);
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


export interface SurfaceRecoveryPhysics {
  readonly passiveWallSpeed: number;
  readonly wallJumpHorizontalSpeed: number;
  readonly wallJumpVerticalSpeed: number;
  readonly passiveCeilingSpeed: number;
  readonly wallJumpMinimumApproach: number;
  readonly canWallJump: boolean;
}


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


export interface ShieldGeometry {
  readonly centerX: number;
  readonly centerZ: number;
  readonly radius: number;
}


interface TechTiming {
  readonly ceilingImpulseFrame: number;
  readonly ceilingAnimationEndFrame: number;
  readonly wallAnimationEndFrame: number;
  readonly wallJumpAnimationEndFrame: number;
}

interface ShieldBreakTiming {
  readonly landFrames: number;
  readonly standFrames: number;
}


export interface FighterTuning {
  moves?: FighterMoves | undefined;

  specials?: FighterSpecials | undefined;
  ultimate?: AuthoredSpecial | undefined;
  physics: FighterPhysics;
  surface: SurfaceRecoveryPhysics;
  ground: GroundMovementRules;
  dashGrab: DashGrabRules;
  shield: ShieldGeometry;
  tech: TechTiming;
  shieldBreak: ShieldBreakTiming;
}

export const GROUND_TRACTION = melee(0.07999999821186066);
const INITIAL_DASH_SPEED = melee(1.899999976158142);


const GROUND_ACCELERATION_MULTIPLIER = 0.10000000149011612;
const GROUND_ACCELERATION_BASE = 0.019999999552965164;
const GROUND_SPEED_CAP = melee(3.0);
/** ftCo_DatAttrs +0x078 air_max_horizontal_velocity: 3.0 for every Melee fighter but Falco (retail-roster.json). */
const AIR_MAX_HORIZONTAL_VELOCITY = melee(3.0);

const ORIGINAL_ACCELERATION = {
  walkAccelerationMultiplier: GROUND_ACCELERATION_MULTIPLIER,
  walkAccelerationBase: GROUND_ACCELERATION_BASE,
  groundAccelerationMultiplier: GROUND_ACCELERATION_MULTIPLIER,
  groundAccelerationBase: GROUND_ACCELERATION_BASE,
  groundSpeedCap: GROUND_SPEED_CAP,
} as const;


type OriginalFighter = "reference" | "rifleman" | "demonHunter";


export const AUTHORED_PHYSICS: { readonly [name in OriginalFighter]: FighterPhysics } = {
  reference: {
    weight: 62.0,
    gravity: melee(0.23000000417232513),
    terminalSpeed: melee(2.799999952316284),
    fastFallSpeed: melee(3.4000000953674316),
    airAcceleration: melee(f32(0.019999999552965164 + 0.05999999865889549)),
    airSpeed: melee(0.8299999833106995),
    airFriction: melee(0.019999999552965164),
    airCap: AIR_MAX_HORIZONTAL_VELOCITY,
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
    airCap: AIR_MAX_HORIZONTAL_VELOCITY,
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
    jumpHorizontalCap: melee(1.7000000476837158),
    aerialJumpHorizontalSpeed: 0.0,
    shieldBreakSpeed: 24.0,
    ...ORIGINAL_ACCELERATION,
  },
};

export function authoredPhysics(character: Character): FighterPhysics {
  switch (character) {
    case Character.rifleman:
      return AUTHORED_PHYSICS.rifleman;
    case Character.demonHunter:
      return AUTHORED_PHYSICS.demonHunter;
    default:
      return heroPhysics(character);
  }
}


const REFERENCE_WEIGHT = 75.0;
/** What a hero's 1.00 air multiplier means: Ultimate's median air speed (#190; smashcraft:docs/gameplay-design.md, "Air drift and jump momentum"). */
const REFERENCE_AIR_SPEED = melee(1.0);

const heroPhysicsRecords: (FighterPhysics | undefined)[] = [];





/** Melee's roster spread in Melee units a frame (smashcraft:docs/design/melee/movement.md, "Ground movement"). */
const MELEE_WALK_SPEED_SPREAD: readonly [number, number] = [melee(0.6499999761581421), melee(1.600000023841858)];
const MELEE_DASH_SPEED_SPREAD: readonly [number, number] = [melee(1.0), melee(2.0)];
const MELEE_RUN_SPEED_SPREAD: readonly [number, number] = [melee(1.100000023841858), melee(2.299999952316284)];
const MELEE_DASH_RUN_FRAME_SPREAD: readonly [number, number] = [8, 19];

const meleeSpread = (value: number, spread: readonly [number, number]): number => Math.max(spread[0], Math.min(spread[1], value));

function heroPhysics(character: Character): FighterPhysics {
  const cached = heroPhysicsRecords[character];
  if (cached !== undefined) return cached;
  const reference = AUTHORED_PHYSICS.reference;
  const body = heroBody(character);
  if (body === undefined) return reference;
  const physics: FighterPhysics = {
    ...reference,
    weight: f32(REFERENCE_WEIGHT * body.weight),
    dashSpeed: meleeSpread(body.dashSpeed ?? f32(reference.dashSpeed * body.run), MELEE_DASH_SPEED_SPREAD),
    runSpeed: meleeSpread(body.runSpeed ?? f32(reference.runSpeed * body.run), MELEE_RUN_SPEED_SPREAD),
    walkSpeed: meleeSpread(f32(reference.walkSpeed * body.run), MELEE_WALK_SPEED_SPREAD),
    airSpeed: f32(REFERENCE_AIR_SPEED * body.air),
  };
  heroPhysicsRecords[character] = physics;
  return physics;
}

// Wall recovery impulses retain NTSC GALE01 revision 2 ftCo_DatAttrs +0x100/+0x104/+0x108/+0x10C/+0x148 values.








const AUTHORED_SURFACE_RECOVERY: { readonly [name in OriginalFighter]: SurfaceRecoveryPhysics } = {
  reference: {
    passiveWallSpeed: melee(0.5),
    wallJumpHorizontalSpeed: melee(1.399999976158142),
    wallJumpVerticalSpeed: melee(3.299999952316284),
    passiveCeilingSpeed: melee(0.699999988079071),
    wallJumpMinimumApproach: melee(0.5),
    canWallJump: true,
  },
  rifleman: {
    passiveWallSpeed: melee(0.5),
    wallJumpHorizontalSpeed: melee(1.2999999523162842),
    wallJumpVerticalSpeed: melee(3.5999999046325684),
    passiveCeilingSpeed: melee(0.699999988079071),
    wallJumpMinimumApproach: melee(0.5),
    canWallJump: true,
  },
  demonHunter: {
    passiveWallSpeed: melee(0.5),
    wallJumpHorizontalSpeed: melee(1.399999976158142),
    wallJumpVerticalSpeed: melee(3.0999999046325684),
    passiveCeilingSpeed: melee(2.0),
    wallJumpMinimumApproach: melee(0.5),
    canWallJump: true,
  },
};

function authoredSurfaceRecovery(character: Character): SurfaceRecoveryPhysics {
  switch (character) {
    case Character.rifleman:
      return AUTHORED_SURFACE_RECOVERY.rifleman;
    case Character.demonHunter:
      return AUTHORED_SURFACE_RECOVERY.demonHunter;
    default:
      return AUTHORED_SURFACE_RECOVERY.reference;
  }
}




export const INITIAL_DASH_FRAMES = 13;


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


const AUTHORED_DASH_GRAB_RULES: DashGrabRules = {
  startupFrames: attackStartupFrames(AttackStyle.grab),
  activeFrames: 3,
  totalFrames: attackDurationFramesForGrounding(AttackStyle.grab, true),
};

export const NTSC_FOX_DASH_GRAB_RULES: DashGrabRules = { startupFrames: 10, activeFrames: 2, totalFrames: 40 };
export const NTSC_CAPTAIN_FALCON_DASH_GRAB_RULES: DashGrabRules = { startupFrames: 9, activeFrames: 2, totalFrames: 40 };

const AUTHORED_SHIELD_GEOMETRY: ShieldGeometry = { centerX: 0.0, centerZ: 45.0, radius: 60.0 };
const heroShieldRecords: (ShieldGeometry | undefined)[] = [];

export const AUTHORED_TECH_TIMING: TechTiming = {
  ceilingImpulseFrame: 14,
  ceilingAnimationEndFrame: 26,
  wallAnimationEndFrame: 26,
  wallJumpAnimationEndFrame: 40,
};
/** Illidan's ceiling tech is Captain Falcon's: its impulse event comes on frame 11 (retail-ceiling-tech-events.json). */
const CAPTAIN_FALCON_TECH_TIMING: TechTiming = { ...AUTHORED_TECH_TIMING, ceilingImpulseFrame: 11 };

export const SHIELD_BREAK_LAND_FRAMES = 12;
export const SHIELD_BREAK_STAND_FRAMES = 30;
export const AUTHORED_SHIELD_BREAK_TIMING: ShieldBreakTiming = { landFrames: SHIELD_BREAK_LAND_FRAMES, standFrames: SHIELD_BREAK_STAND_FRAMES };






export function applyAuthoredTuning(world: Roster): void {
  // By slot: in Lua a roster's empty slot is a nil that would end a for-of over its fighters.
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const fighter = world.fighters[slot];
    if (fighter !== undefined) fighter.tuning = authoredTuning(fighter.character);
  }
}






function heroShieldGeometry(character: Character): ShieldGeometry {
  const cached = heroShieldRecords[character];
  if (cached !== undefined) return cached;
  const scale = heroBody(character)?.shield;
  if (scale === undefined) return AUTHORED_SHIELD_GEOMETRY;
  const geometry = { centerX: 0.0, centerZ: f32(AUTHORED_SHIELD_GEOMETRY.centerZ * scale), radius: f32(AUTHORED_SHIELD_GEOMETRY.radius * scale) };
  heroShieldRecords[character] = geometry;
  return geometry;
}

const heroGroundRecords: (GroundMovementRules | undefined)[] = [];

function heroGroundRules(character: Character): GroundMovementRules {
  const cached = heroGroundRecords[character];
  if (cached !== undefined) return cached;
  const frame = heroBody(character)?.dashRunFrame;
  if (frame === undefined) return AUTHORED_GROUND_MOVEMENT_RULES;
  const rules = { ...AUTHORED_GROUND_MOVEMENT_RULES, dashRunEnableFrame: meleeSpread(frame, MELEE_DASH_RUN_FRAME_SPREAD) };
  heroGroundRecords[character] = rules;
  return rules;
}

export function authoredTuning(character: Character): FighterTuning {
  const hero = heroDefinition(character);
  return {
    moves: hero?.moves ?? originalFighterMoves(character),
    specials: hero?.specials,
    ultimate: FIGHTER_ULTIMATES[character],
    physics: authoredPhysics(character),
    surface: authoredSurfaceRecovery(character),
    ground: heroGroundRules(character),
    dashGrab: AUTHORED_DASH_GRAB_RULES,
    shield: heroShieldGeometry(character),
    tech: character === Character.demonHunter ? CAPTAIN_FALCON_TECH_TIMING : AUTHORED_TECH_TIMING,
    shieldBreak: AUTHORED_SHIELD_BREAK_TIMING,
  };
}
