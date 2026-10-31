import { f32 } from "wisp/src/sim/f32";
import { Character, HeroStatusGroup, HeroStatusKind } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroRegion, type StrikeCapsule } from "../../sim/heroMoves";
import { frames, FollowUpInput, type AuthoredSpecial, type FighterSpecials, type SpecialHeldOrb, type SpecialProjectile, type SpecialSteeredShot } from "../../sim/specials/schema";
import type { AppliedStatus } from "../../sim/appliedStatus";
import { kaelCastBody, kaelHit } from "./moves";

const AIR_LANDING_LAG = 30;

export const PYROBLAST_STARTUP_FRAMES = 21;
export const PYROBLAST_STEER_FRAMES = 80;
export const PYROBLAST_COAST_FRAMES = 14;
export const PYROBLAST_MISS_RECOVERY = 46;
export const PYROBLAST_HIT_RECOVERY = 21;
export const PYROBLAST_SPEED = 7.5;
export const PYROBLAST: SpecialProjectile = {
  model: "Abilities\\Weapons\\RedDragonBreath\\RedDragonMissile.mdx",
  spawnFrame: PYROBLAST_STARTUP_FRAMES, offsetX: 52.0, offsetZ: 60.0, velocityX: PYROBLAST_SPEED, velocityZ: 0.0,
  life: PYROBLAST_STEER_FRAMES + PYROBLAST_COAST_FRAMES, radius: 22.0, effect: { ...kaelHit(13.0, 40, 70.0, 25.0), strong: true },
  reflectable: true, limit: 1, steered: true,
};
export const PYROBLAST_STEER: SpecialSteeredShot = {
  frame: PYROBLAST_STARTUP_FRAMES, turnCos: 0.9945219159126282, turnSin: 0.10452846437692642,
  coast: PYROBLAST_COAST_FRAMES, fallSpeed: 1.5, hitRecovery: PYROBLAST_HIT_RECOVERY,
  selfHit: { armedAfter: 16, radius: 44.0, bodyZ: 40.0 },
};
export const PYROBLAST_SELF_LAUNCH_FRAMES = 36;
export const PYROBLAST_SELF_LAUNCH_SPEED = 11.0;
export const PYROBLAST_SELF_LAUNCH: AuthoredSpecial = {
  endFrame: PYROBLAST_SELF_LAUNCH_FRAMES, helpless: true, intangible: frames(1, PYROBLAST_SELF_LAUNCH_FRAMES / 2),
  hurt: kaelCastBody(1, PYROBLAST_SELF_LAUNCH_FRAMES, 44.0, 64.0),
  motion: [{ ...frames(1, PYROBLAST_SELF_LAUNCH_FRAMES), velocityX: 0.0, velocityZ: 0.0, aimedSpeed: PYROBLAST_SELF_LAUNCH_SPEED, freeAim: true }],
};
const pyroblast: AuthoredSpecial = {
  endFrame: PYROBLAST_STARTUP_FRAMES + PYROBLAST_MISS_RECOVERY, hurt: kaelCastBody(6, PYROBLAST_STARTUP_FRAMES + 8, 44.0, 64.0),
  projectiles: [PYROBLAST], steersShot: PYROBLAST_STEER,
  followUps: [{ window: frames(0, 0), special: PYROBLAST_SELF_LAUNCH, input: FollowUpInput.guard }],
};

// FlameStrike1.mdx draws its column only in birth, fading in by 1.05 s and out by 5.1 s; the pillar plays that stretch across its burst and burn frames.
export const FLAME_STRIKE_BURST_FRAMES = 6;
export const FLAME_STRIKE_BURN_FRAMES = 30;
export const FLAME_STRIKE_COLUMN_SECONDS = { from: f32(1.05), to: f32(5.1) } as const;
export const FLAME_STRIKE_COLUMN_RATE = (FLAME_STRIKE_COLUMN_SECONDS.to - FLAME_STRIKE_COLUMN_SECONDS.from) / ((FLAME_STRIKE_BURST_FRAMES + FLAME_STRIKE_BURN_FRAMES) / 60);
const FLAME_STRIKE_BURN_SEEK = FLAME_STRIKE_COLUMN_SECONDS.from + FLAME_STRIKE_COLUMN_RATE * FLAME_STRIKE_BURST_FRAMES / 60;
export const FLAME_STRIKE_BURN: SpecialProjectile = {
  model: "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx", modelRadius: 155.0, modelOffsetZ: -50.0,
  modelAnimation: { sequence: "birth", warningSeconds: FLAME_STRIKE_BURN_SEEK, activeSeconds: FLAME_STRIKE_BURN_SEEK, rate: FLAME_STRIKE_COLUMN_RATE },
  spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: FLAME_STRIKE_BURN_FRAMES, radius: 45.0, effect: kaelHit(2.0, 80, 0.0, 0.0), burn: { every: 8 }, reflectable: false, limit: 1,
};
export const FLAME_STRIKE_BURST: SpecialProjectile = {
  model: "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx", modelRadius: 155.0, modelOffsetZ: -50.0,
  modelAnimation: { sequence: "birth", warningSeconds: FLAME_STRIKE_COLUMN_SECONDS.from, activeSeconds: FLAME_STRIKE_COLUMN_SECONDS.from, rate: FLAME_STRIKE_COLUMN_RATE },
  spawnFrame: 0, offsetX: 0.0, offsetZ: 50.0, velocityX: 0.0, velocityZ: 0.0,
  life: FLAME_STRIKE_BURST_FRAMES, radius: 45.0, effect: kaelHit(11.0, 80, 80.0, 30.0), expiresInto: FLAME_STRIKE_BURN, reflectable: false, limit: 1,
};
export const FLAME_STRIKE_RELEASE_FRAME = 16;
export const FLAME_STRIKE_ORB_FRAMES = 50;
export const FLAME_STRIKE_ORB: SpecialProjectile = {
  model: "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx",
  spawnFrame: FLAME_STRIKE_RELEASE_FRAME, offsetX: 52.0, offsetZ: 60.0, velocityX: 5.0, velocityZ: 0.0,
  life: FLAME_STRIKE_ORB_FRAMES, radius: 30.0, effect: kaelHit(0.0, 80), burstInto: FLAME_STRIKE_BURST, burstsOnStage: true,
  reflectable: false, limit: 1, steered: true,
};
export const FLAME_STRIKE_STEER: SpecialHeldOrb = { frame: FLAME_STRIKE_ORB.spawnFrame, acceleration: 0.375, maxSpeed: 12.0, climbSpeed: 5.0, erupts: FLAME_STRIKE_BURST };
const flameStrike = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: FLAME_STRIKE_RELEASE_FRAME + 28, cooldownFrames: 72, landingLag, hurt: kaelCastBody(4, FLAME_STRIKE_RELEASE_FRAME + 18, 40.0, 66.0), projectiles: [FLAME_STRIKE_ORB], heldOrb: FLAME_STRIKE_STEER, replacesLive: true,
});

export const BANISH_FRAMES = 60;
export const BANISH: AppliedStatus = { kind: HeroStatusKind.banish, frames: BANISH_FRAMES, group: HeroStatusGroup.silence, immunityFrames: 240 };
export const BANISH_DELAY_FRAMES = 20;
export const BANISH_BEAM_FRAMES = 6;
export const BANISH_WHIFF_RECOVERY = 30;
const BODY = hurtCapsule(Character.kaelthas);
export const BANISH_BODY_LENGTH = f32(BODY.z2 - BODY.z1);
export const BANISH_BEAM_REACH = f32(3.0 * BANISH_BODY_LENGTH);
const BEAM_HAND_X = 30.0;
export const BANISH_BEAM: StrikeCapsule = { x1: BEAM_HAND_X, z1: 62.0, x2: f32(BEAM_HAND_X + BANISH_BEAM_REACH), z2: 62.0, radius: 12.0 };
const BEAM_LAST_FRAME = BANISH_DELAY_FRAMES + BANISH_BEAM_FRAMES - 1;
const banish = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: BEAM_LAST_FRAME + BANISH_WHIFF_RECOVERY, landingLag, hurt: kaelCastBody(8, BEAM_LAST_FRAME, 46.0, 62.0),
  regions: [heroRegion(BANISH_DELAY_FRAMES, BEAM_LAST_FRAME, BANISH_BEAM, kaelHit(0.0, 35, 0.0, 30.0))], strikeStatus: BANISH,
});

export const PHOENIX_STARTUP_FRAMES = 12;
export const PHOENIX_BURN_FRAMES = 40;
export const PHOENIX_EGG_FALL_SPEED = 24.0;
export const PHOENIX_EGG_HATCH_FRAMES = 30;
const PHOENIX_TURN_COS = 0.9961947202682495;
const PHOENIX_TURN_SIN = 0.08715574443340302;
const PHOENIX_FLIGHT = frames(PHOENIX_STARTUP_FRAMES + 1, PHOENIX_STARTUP_FRAMES + PHOENIX_BURN_FRAMES);
const BIRD: StrikeCapsule = { x1: -24.0, z1: 55.0, x2: 24.0, z2: 55.0, radius: 32.0 };
const phoenix: AuthoredSpecial = {
  endFrame: PHOENIX_STARTUP_FRAMES + PHOENIX_BURN_FRAMES, aimFrames: PHOENIX_STARTUP_FRAMES, oncePerAirtime: true, helpless: true, landingLag: 18,
  motion: [
    { ...frames(1, PHOENIX_STARTUP_FRAMES), velocityX: 0.0, velocityZ: 0.0 },
    { ...PHOENIX_FLIGHT, velocityX: 0.0, velocityZ: 0.0,
      steer: { launchSpeed: 9.0, speed: 14.5, acceleration: 0.5, turnCos: PHOENIX_TURN_COS, turnSin: PHOENIX_TURN_SIN } },
  ],
  regions: [heroRegion(PHOENIX_FLIGHT.first, PHOENIX_FLIGHT.last, BIRD, kaelHit(4.0, 55, 30.0, 30.0))],
  egg: { window: PHOENIX_FLIGHT, fallSpeed: PHOENIX_EGG_FALL_SPEED, hatchFrames: PHOENIX_EGG_HATCH_FRAMES },
};

export const KAELTHAS_SPECIALS: FighterSpecials = {
  neutral: { name: "Pyroblast", description: "A slow, heavy fireball he steers with the stick for longer than most while he stands rooted; special or shield lets it go. Steered back into him it launches him along its flight. It hits hard and cracks shields, but a miss leaves him open. One at a time.",
    ground: pyroblast },
  side: { name: "Flame Strike", description: "Hold to send a fire orb forward that gathers speed and climbs or sinks with the stick; release, touch or timeout erupts the pillar of fire where it is, and the pillar lingers and burns. One at a time.",
    ground: flameStrike(undefined), air: flameStrike(AIR_LANDING_LAG) },
  up: { name: "Phoenix", description: "Rise as a phoenix and steer the flight while its flames burn down; then helpless. Struck in flight, he falls as an egg and hatches on landing.",
    ground: phoenix },
  down: { name: "Banish", description: "A green beam from his outstretched hand: whoever it touches turns ethereal, untouchable by attacks and grabs but unable to attack, grab or shield, and takes more damage from every spell.",
    ground: banish(undefined), air: banish(22) },
};
