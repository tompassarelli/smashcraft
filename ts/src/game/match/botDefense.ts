



import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { attackStartupFrames, characterAttackActiveFrames, RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_FRAMES, RIFLEMAN_BLASTER_GROUND_SHOT_FRAME } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_MANA_BURN_HEIGHT, DEMONHUNTER_MANA_BURN_LIFETIME, DEMONHUNTER_MANA_BURN_SPEED, DEMONHUNTER_MANA_BURN_STARTUP } from "../sim/specials";
import { SpecialSlot } from "../sim/heroSpecials";
import { runningHeroSpecial } from "../sim/heroSpecialRules";
import { BLASTER_AIR_SHOT_HEIGHT, BLASTER_PROJECTILE_HEIGHT, BLASTER_PROJECTILE_LIFETIME, BLASTER_PROJECTILE_RADIUS, BLASTER_PROJECTILE_SPAWN_OFFSET, BLASTER_PROJECTILE_SPEED, } from "../sim/projectiles";
import { hurtCapsule } from "../physics/contactGeometry";
import { deckUnder, heightAhead, safeAt } from "./botFooting";
import { heroStanceLater, heroStanceSlot } from "./botHeroKit";
import { moveReaches } from "./botMoves";
import { botChance, botChoice } from "./botRandom";
import { defenseOption, gameplanOf } from "./botGameplan";
import type { DefenseOption } from "../sim/gameplan";
import { type CpuSkill, FULL_SKILL } from "./cpuSkill";


const SHIELD_RESERVE = 20.0;

const STRIKE_LOOKAHEAD = 12;

const SHOT_SIGHT = 260.0;

const PUSHBACK_ROOM = 60.0;

const PERCEIVED_FULL_SKILL: CpuSkill = { ...FULL_SKILL, reactionFrames: 0 };

const Response = { none: 0, shield: 1, spotDodge: 2, roll: 3, stance: 5, jump: 6, retreat: 7, wait: 8 } as const;
type Response = (typeof Response)[keyof typeof Response];


function strikeComing(f: Readonly<Fighter>, target: Readonly<Fighter>, reaction: number, observationAge: number): number | undefined {
  const style = target.attack.style;
  if (style === undefined || style === AttackStyle.shot || style === AttackStyle.grab) return undefined;
  const startup = attackStartupFrames(style, target.tuning.moves);
  if (target.attack.frame < reaction) return undefined;
  const frame = target.attack.frame + observationAge;
  if (frame >= startup + characterAttackActiveFrames(target.character, style, target.tuning.moves)) return undefined;
  const frames = Math.max(0, startup - frame);
  if (frames > STRIKE_LOOKAHEAD) return undefined;
  const predictedX = f32(target.motion.x + f32(target.motion.deltaX * observationAge));
  const predictedZ = f32(target.motion.z + f32(target.motion.deltaZ * observationAge));
  const x = f32(f32(f.motion.x - predictedX) + f32(f32(f.motion.deltaX - target.motion.deltaX) * frames));
  const z = f32(f32(f.motion.z - predictedZ) + f32(f32(f.motion.deltaZ - target.motion.deltaZ) * frames));
  return moveReaches(target.character, style, f, f32(x * target.facing), z, target.tuning.moves) ? frames : undefined;
}


const threat = { serial: 0, arrival: -1.0 };

interface ShotWindup {
  readonly spawnFrame: number;
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly life: number;
  readonly radius: number;
}

const BLASTER_GROUND: ShotWindup = { spawnFrame: RIFLEMAN_BLASTER_GROUND_SHOT_FRAME, offsetX: BLASTER_PROJECTILE_SPAWN_OFFSET, offsetZ: BLASTER_PROJECTILE_HEIGHT, velocityX: BLASTER_PROJECTILE_SPEED, velocityZ: 0.0, life: BLASTER_PROJECTILE_LIFETIME, radius: BLASTER_PROJECTILE_RADIUS };
const BLASTER_AIR: ShotWindup = { ...BLASTER_GROUND, spawnFrame: RIFLEMAN_BLASTER_AIR_SHOT_FRAME, offsetZ: BLASTER_AIR_SHOT_HEIGHT };
const MANA_BURN: ShotWindup = { ...BLASTER_GROUND, spawnFrame: DEMONHUNTER_MANA_BURN_STARTUP, offsetZ: DEMONHUNTER_MANA_BURN_HEIGHT, velocityX: DEMONHUNTER_MANA_BURN_SPEED, life: DEMONHUNTER_MANA_BURN_LIFETIME };


function shotFromWindup(f: Readonly<Fighter>, target: Readonly<Fighter>, shot: Readonly<ShotWindup>, stage: number, observationAge: number, endsOnLanding = false): boolean {
  const untilSeenSpawn = shot.spawnFrame - target.special.frame;
  if (untilSeenSpawn <= 0 || shot.velocityX === 0.0) return false;
  if (endsOnLanding && !target.motion.grounded) {
    const deck = deckUnder(stage, 0, target.motion.x, target.motion.z);
    if (deck !== undefined && heightAhead(target, untilSeenSpawn, stage, 0) <= deck) return false;
  }
  const age = Math.max(0, observationAge - Math.max(0, target.launch.hitlag - 1));
  const untilSpawn = Math.max(0, untilSeenSpawn - age);
  const flown = Math.max(0, age - untilSeenSpawn);
  const vx = f32(shot.velocityX * target.facing);
  const direction = vx < 0 ? -1 : 1;
  const launchX = f32(f32(target.motion.x + f32(target.motion.deltaX * untilSeenSpawn)) + f32(target.facing * shot.offsetX));
  const x = f32(launchX + f32(vx * flown));
  const ahead = f32(f32(f.motion.x - x) * direction);
  const body = hurtCapsule(f.character);
  const reach = f32(shot.radius + body.radius);
  if (ahead < f32(-reach)) return false;
  const ownSpeed = f32(f.motion.vx * direction);
  const closingSpeed = f32(Math.abs(vx) - ownSpeed);
  if (closingSpeed <= 0.0) return false;
  const gapAtLaunch = f32(f32(ahead + f32(ownSpeed * untilSpawn)) - reach);
  const flight = Math.max(0.0, f32(gapAtLaunch / closingSpeed));
  const arrival = f32(untilSpawn + flight);
  if (arrival > STRIKE_LOOKAHEAD || f32(flown + flight) >= shot.life) return false;
  const launchZ = f32(heightAhead(target, untilSeenSpawn, stage, 0) + shot.offsetZ);
  const z = f32(launchZ + f32(shot.velocityZ * f32(flown + flight)));
  if (z < f32(f32(f.motion.z + body.z1) - reach) || z > f32(f32(f.motion.z + body.z2) + reach)) return false;
  threat.serial = target.attack.serial + 1;
  threat.arrival = arrival;
  return true;
}

function specialShotComing(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, reaction: number, observationAge: number): boolean {
  if (target.special.frame < reaction) return false;
  switch (target.special.action) {
    case SpecialAction.riflemanBlaster:
      return shotFromWindup(f, target, target.special.duration === RIFLEMAN_BLASTER_GROUND_FRAMES ? BLASTER_GROUND : BLASTER_AIR, stage, observationAge, true);
    case SpecialAction.demonHunterManaBurn:
      return shotFromWindup(f, target, MANA_BURN, stage, observationAge);
  }
  const move = runningHeroSpecial(target);
  if (move?.projectiles === undefined) return false;
  for (const shot of move.projectiles) {
    if (shotFromWindup(f, target, shot, stage, observationAge, move.landingLag !== undefined)) return true;
  }
  return false;
}


function findThreat(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, reaction: number, observationAge: number): boolean {
  const strikeFrames = strikeComing(f, target, reaction, observationAge);
  if (strikeFrames !== undefined) {
    threat.serial = target.attack.serial;
    threat.arrival = strikeFrames;
    return true;
  }
  const { x, z } = f.motion;
  for (const projectile of target.projectiles) {
    if (projectile.life <= observationAge) continue;
    const predictedX = f32(projectile.x + f32(projectile.velocityX * observationAge));
    const predictedZ = f32(projectile.z + f32(projectile.velocityZ * observationAge));
    const ahead = f32(f32(x - predictedX) * projectile.direction);
    const speed = Math.abs(projectile.velocityX);

    if (ahead < 0 || ahead > f32(SHOT_SIGHT - f32(speed * reaction)) || Math.abs(f32(f32(z + 45.0) - predictedZ)) > 80) continue;
    threat.serial = projectile.serial;

    const closingSpeed = f32(speed - f32(f.motion.vx * projectile.direction));
    threat.arrival = closingSpeed > 0 ? f32(ahead / closingSpeed) : -1.0;
    return true;
  }
  if (specialShotComing(f, target, stage, reaction, observationAge)) return true;
  threat.arrival = -1.0;
  const immolating = target.special.action === SpecialAction.demonHunterImmolate && target.special.frame >= reaction && target.special.frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE;
  if (immolating && Math.abs(f32(x - target.motion.x)) <= 160 && Math.abs(f32(z - target.motion.z)) <= 170) {
    threat.serial = target.attack.serial;
    return true;
  }
  const { bear } = target;
  if (bear.life > 0 && Math.abs(f32(x - bear.x)) <= 110 && Math.abs(f32(z - bear.z)) <= 100) {
    threat.serial = bear.hitSerial;
    return true;
  }
  return false;
}


function plannedResponse(f: Readonly<Fighter>, planned: DefenseOption, cornered: boolean): Response {
  switch (planned) {
    case "stance":
      if (threat.arrival >= 0 && heroStanceSlot(f, Math.floor(threat.arrival)) !== undefined) return Response.stance;

      if (threat.arrival >= 0 && heroStanceLater(f, Math.floor(threat.arrival))) return Response.wait;
      return cornered ? Response.spotDodge : Response.shield;
    case "shield":
    case "roll":
      return cornered ? Response.spotDodge : planned === "roll" ? Response.roll : Response.shield;
    case "spotDodge":
      return Response.spotDodge;
    case "jump":
      return Response.jump;
    case "retreat":
      return cornered ? Response.spotDodge : Response.retreat;
  }
}

function respond(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill): Response {
  const choice = botChoice(threat.serial, f.visuals.hit * 5 + f.character, 10);
  const away = f.motion.x < target.motion.x ? -1 : 1;

  const cornered = !safeAt(stage, f32(f.motion.x + f32(away * PUSHBACK_ROOM)), 0.0);
  if (choice >= skill.defendTenths) return Response.none;
  const gameplan = gameplanOf(f.character, skill.basicMoves);
  const planned = gameplan === undefined ? undefined : defenseOption(gameplan, botChoice, threat.serial, f.visuals.hit * 7 + f.character);
  if (planned !== undefined) return plannedResponse(f, planned, cornered);

  if (choice >= 4 && threat.arrival >= 0 && heroStanceSlot(f, Math.floor(threat.arrival)) !== undefined) return Response.stance;
  if (choice === 5) return cornered ? Response.spotDodge : Response.roll;
  if (choice === 4 || cornered) return Response.spotDodge;
  return Response.shield;
}






export function chooseDefense(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, input: Controls, skill: CpuSkill = PERCEIVED_FULL_SKILL, observationAge = 0): boolean {
  if (!f.motion.grounded || target.status.out) return false;
  if (!findThreat(f, target, stage, skill.reactionFrames, observationAge)) return false;
  if (f.shield.raised) {
    input.shield = f.shield.energy > SHIELD_RESERVE;
    return input.shield;
  }
  if (!canAttack(f) || f.shield.energy <= SHIELD_RESERVE) return false;
  const away = f.motion.x < target.motion.x ? -1 : 1;
  switch (respond(f, target, stage, skill)) {
    case Response.none:
      return false;
    case Response.stance: {
      const slot = heroStanceSlot(f, Math.floor(threat.arrival));
      input.specialPressed = true;
      input.specialX = slot === SpecialSlot.side ? f.facing : 0;
      input.specialZ = slot === SpecialSlot.down ? -1 : 0;
      input.verticalDirection = input.specialZ;
      return true;
    }
    case Response.roll:
      input.shield = true;
      input.groundDodgePressed = true;
      input.groundDodgeDirection = away;
      return true;
    case Response.spotDodge:
      input.shield = true;
      input.groundDodgePressed = true;
      input.groundDodgeDirection = 0;
      return true;
    case Response.shield:
      input.shield = true;
      return true;
    case Response.jump:
      input.jumpPressed = true;
      input.jumpHeld = true;
      return true;
    case Response.retreat:
      input.direction = away;
      return true;
    case Response.wait:
      return true;
  }
}
