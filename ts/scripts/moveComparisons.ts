// Fixed offline contact-state comparison fixtures over production simulation.
import { AttackPhase, AttackStyle, Character } from "../src/game/sim/codes";
import { type Fighter, createFighter, SHIELD_MAX } from "../src/game/sim/fighter";
import { beginFighterAttack, resolveAttacks } from "../src/game/sim/attacks";
import { attackPhase, canAttack } from "../src/game/sim/conditions";
import { beginDamageContacts, finishDamageContacts } from "../src/game/sim/contacts";
import { advanceFighterMotion } from "../src/game/sim/step";
import { regenerateShield } from "../src/game/sim/shield";
import { attackStartupFrames } from "../src/game/sim/moves";
import { createRoster, neutralControls, type Controls, type Roster } from "../src/game/sim/roster";

const HORIZON = 96;
const json = (value: unknown): string => JSON.stringify(value);
const styleFor = (category: number): AttackStyle => category === 0 ? AttackStyle.forwardSmash : category === 1 ? AttackStyle.forwardTilt : AttackStyle.neutralAir;
const categoryName = (category: number): string => category === 0 ? "smash" : category === 1 ? "normal" : "late-aerial";

interface ContactResult {
  connected: boolean; contactFrame: number; attackerReady: number; defenderReady: number; attackerLanding: number; shieldstun: number; hitstun: number;
  attackerHitlag: number; defenderHitlag: number; percentDamage: number; shieldDamage: number; separationAtAttackerReady: number;
  verticalAtAttackerReady: number; separationAtDefenderReady: number; verticalAtDefenderReady: number; defenderWeight: number;
}

class Rig {
  readonly world: Roster;
  readonly attacker: Fighter;
  readonly defender: Fighter;
  readonly attackInput: Controls = neutralControls();
  readonly defendInput: Controls = neutralControls();
  readonly connected: boolean;
  readonly contactFrame: number;
  readonly initialShieldstun: number;
  readonly initialHitstun: number;
  readonly attackerHitlag: number;
  readonly defenderHitlag: number;
  readonly percentDamage: number;
  readonly shieldDamage: number;

  constructor(character: Character, category: number, spacing: number, percent: number, shielding: boolean, mutant = false) {
    this.attacker = createFighter(character, 0, 1);
    this.defender = createFighter(Character.rifleman, spacing, -1);
    this.world = createRoster(3, [this.attacker, this.defender]);
    this.defender.status.damage = percent;
    this.defender.shield.raised = shielding;
    this.defender.shield.heldFrames = 20;
    const style = styleFor(category);
    this.attacker.motion.grounded = ! (style >= AttackStyle.neutralAir && style <= AttackStyle.downAir);
    this.attacker.motion.surface = this.attacker.motion.grounded ? 0 : undefined;
    this.attacker.motion.z = this.attacker.motion.grounded ? 0 : 20;
    this.attacker.motion.vz = this.attacker.motion.grounded ? 0 : -2;
    beginFighterAttack(this.world, 0, style, false);
    this.contactFrame = category === 2 ? 20 : attackStartupFrames(style);
    this.attacker.attack.frame = this.contactFrame;
    this.attacker.attack.cooldown = this.attacker.attack.duration - this.contactFrame;
    resolveAttacks(this.world);
    this.connected = this.defender.hits.lastAttacker === 0;
    this.initialShieldstun = this.defender.shield.stun;
    this.initialHitstun = this.defender.launch.hitstun;
    this.attackerHitlag = this.attacker.launch.hitlag;
    this.defenderHitlag = this.defender.launch.hitlag;
    this.percentDamage = this.defender.status.damage - percent;
    this.shieldDamage = SHIELD_MAX - this.defender.shield.energy;
    if (mutant && this.connected) {
      this.attacker.attack.cooldown = 1;
      this.attacker.attack.duration = this.attacker.attack.frame + 1;
    }
  }

  motion(): void {
    advanceFighterMotion(this.world, 0, 0, 0, this.attackInput, 0);
    advanceFighterMotion(this.world, 1, 0, 0, this.defendInput, 0);
  }

  contacts(): void {
    beginDamageContacts();
    resolveAttacks(this.world);
    regenerateShield(this.attacker);
    regenerateShield(this.defender);
    finishDamageContacts(this.world);
  }
}

export function compareContact(character: Character, category: number, spacing: number, percent: number, shielding: boolean, mutant = false): ContactResult {
  const rig = new Rig(character, category, spacing, percent, shielding, mutant);
  const result: ContactResult = { connected: rig.connected, contactFrame: rig.contactFrame, attackerReady: -1, defenderReady: -1, attackerLanding: -1,
    shieldstun: rig.initialShieldstun, hitstun: rig.initialHitstun, attackerHitlag: rig.attackerHitlag, defenderHitlag: rig.defenderHitlag,
    percentDamage: rig.percentDamage, shieldDamage: rig.shieldDamage, separationAtAttackerReady: 0, verticalAtAttackerReady: 0,
    separationAtDefenderReady: 0, verticalAtDefenderReady: 0, defenderWeight: rig.defender.tuning.physics.weight };
  for (let tick = 0; tick <= HORIZON; tick++) {
    if (tick > 0) { rig.motion(); rig.contacts(); }
    if (result.attackerLanding < 0 && rig.attacker.motion.grounded) result.attackerLanding = tick;
    if (result.attackerReady < 0 && canAttack(rig.attacker)) {
      result.attackerReady = tick; result.separationAtAttackerReady = rig.defender.motion.x - rig.attacker.motion.x;
      result.verticalAtAttackerReady = rig.defender.motion.z - rig.attacker.motion.z;
    }
    if (result.defenderReady < 0 && canAttack(rig.defender)) {
      result.defenderReady = tick; result.separationAtDefenderReady = rig.defender.motion.x - rig.attacker.motion.x;
      result.verticalAtDefenderReady = rig.defender.motion.z - rig.attacker.motion.z;
    }
  }
  return result;
}

export function categoryTradeoffViolation(smash: ContactResult, normal: ContactResult): boolean {
  return smash.connected && normal.connected && smash.attackerReady >= 0 && normal.attackerReady >= 0 && smash.defenderReady >= 0 && normal.defenderReady >= 0
    && smash.shieldDamage > normal.shieldDamage && smash.attackerReady <= normal.attackerReady && smash.defenderReady >= normal.defenderReady;
}

interface FollowupResult {
  scheduledStart: number; actualStart: number; actualStyle: number; firstActive: number; firstContact: number; opponentReady: number;
  separationAtStart: number; verticalAtStart: number; separationAtFirstActive: number; verticalAtFirstActive: number;
  timingAllows: boolean; reachesBeforeAction: boolean;
}

export function compareFollowup(character: Character, category: number, spacing: number, percent: number, shielding: boolean, candidateStyle: AttackStyle,
  delay: number, approach: boolean, baseline: ContactResult): FollowupResult {
  const result: FollowupResult = { scheduledStart: -1, actualStart: -1, actualStyle: -1, firstActive: -1, firstContact: -1, opponentReady: -1,
    separationAtStart: 0, verticalAtStart: 0, separationAtFirstActive: 0, verticalAtFirstActive: 0, timingAllows: false, reachesBeforeAction: false };
  const ready = shielding ? baseline.defenderReady : baseline.attackerReady;
  result.opponentReady = shielding ? baseline.attackerReady : baseline.defenderReady;
  if (!baseline.connected || ready < 0) return result;
  const rig = new Rig(character, category, spacing, percent, shielding);
  const actor = shielding ? rig.defender : rig.attacker;
  const target = shielding ? rig.attacker : rig.defender;
  const controls = shielding ? rig.defendInput : rig.attackInput;
  result.scheduledStart = ready + delay;
  let serial = -1;
  for (let tick = 1; tick <= HORIZON; tick++) {
    controls.direction = approach && tick >= ready && tick < result.scheduledStart ? target.motion.x > actor.motion.x ? 1 : -1 : 0;
    rig.motion();
    if (tick === result.scheduledStart) {
      result.separationAtStart = target.motion.x - actor.motion.x;
      result.verticalAtStart = target.motion.z - actor.motion.z;
      const priorSerial = actor.attack.serial;
      actor.facing = target.motion.x >= actor.motion.x ? 1 : -1;
      beginFighterAttack(rig.world, shielding ? 1 : 0, candidateStyle, false);
      if (actor.attack.serial !== priorSerial) { serial = actor.attack.serial; result.actualStart = tick; result.actualStyle = actor.attack.style ?? -1; }
    }
    if (serial >= 0 && actor.attack.serial === serial && attackPhase(actor) === AttackPhase.active && result.firstActive < 0) {
      result.firstActive = tick; result.separationAtFirstActive = target.motion.x - actor.motion.x;
      result.verticalAtFirstActive = target.motion.z - actor.motion.z;
      result.timingAllows = result.opponentReady >= 0 && tick < result.opponentReady;
    }
    rig.contacts();
    if (serial >= 0 && target.hits.lastAttacker === (shielding ? 1 : 0) && target.hits.lastAttackSerial === serial && result.firstContact < 0) {
      result.firstContact = tick; result.reachesBeforeAction = result.opponentReady >= 0 && tick < result.opponentReady;
    }
  }
  return result;
}

export function followupVerdict(result: FollowupResult, shielding: boolean, approach: boolean): string {
  if (result.actualStart < 0) return "ground-normal-unavailable";
  if (result.opponentReady < 0) return "opponent-recovery-unobserved";
  if (result.reachesBeforeAction) return shielding ? "bounded-punish" : "bounded-true-link";
  if (result.timingAllows) return "timing-window-but-reach-miss";
  if (result.firstContact >= 0) return approach ? "chase-after-actionable" : "escapable-pressure";
  return "no-contact";
}

function key(character: number, category: number, spacing: number, percent: number, shielding: boolean): object {
  return { character, defenderCharacter: Character.rifleman, category: categoryName(category), move: category === 0 ? "forward-smash" : category === 1 ? "forward-tilt" : "neutral-air", style: styleFor(category), spacing, percent, shielding };
}

export function exportComparisons(): string[] {
  const rows: string[] = [];
  rows.push(json({ kind: "context", schema: 1, roster: ["Archer", "Rifleman", "Demon Hunter"], defender: "Rifleman with production weight", horizon: HORIZON, timeOrigin: "contact checkpoint, zero-based ticks; -1 means unobserved or unavailable", grounding: "smash/normal grounded; late neutral aerial at attack frame 20, z20, vz-2", facing: [1, -1], stage: 0, charge: 0, shield: "full digital shield held before checkpoint, released afterwards; no powershield", DI: "neutral, no SDI or ASDI displacement", actionable: "canAttack for a normal action; not a universal earliest escape oracle", optionPolicy: "jab or forward tilt attempted at normal-ready + delay 0..12; optional approach only during delay; target otherwise neutral", limits: ["contact-state experiment, not complete approach safety", "strictly earlier contact required; same-tick response is not certified", "bounded true links exclude DI/SDI/escape-policy variation", "no read or human reaction likelihood inferred", "no reference-character equivalence", "no native or balance acceptance"] }));
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) for (const spacing of [60, 140]) {
    const normal = compareContact(character, 1, spacing, 0, true);
    const smash = compareContact(character, 0, spacing, 0, true);
    const mutant = compareContact(character, 0, spacing, 0, true, true);
    rows.push(json({ kind: "category-rule", character, defenderCharacter: Character.rifleman, spacing, percent: 0, shielding: true, rule: "greater shield damage requires later attacker recovery or earlier defender response", productionViolation: categoryTradeoffViolation(smash, normal), mutantViolation: categoryTradeoffViolation(mutant, normal), normalAttackerReady: normal.attackerReady, smashAttackerReady: smash.attackerReady, mutantAttackerReady: mutant.attackerReady, normalDefenderReady: normal.defenderReady, smashDefenderReady: smash.defenderReady, normalShieldDamage: normal.shieldDamage, smashShieldDamage: smash.shieldDamage, mutation: "after contact, only fixture attacker cooldown and remaining attack duration become one tick" }));
    for (let category = 0; category < 3; category++) for (const [percent, shielding] of [[0, true], [0, false], [60, false]] as const) {
      const result = compareContact(character, category, spacing, percent, shielding);
      const identity = key(character, category, spacing, percent, shielding);
      rows.push(json({ kind: "contact", ...identity, ...result }));
      if (!result.connected) continue;
      for (const candidateStyle of [AttackStyle.jab, AttackStyle.forwardTilt]) for (let delay = 0; delay <= 12; delay++) for (const approach of [false, true]) {
        const follow = compareFollowup(character, category, spacing, percent, shielding, candidateStyle, delay, approach, result);
        rows.push(json({ kind: "option", ...identity, role: shielding ? "punish" : "followup", candidateStyle, delay, approach,
          ...follow, verdict: followupVerdict(follow, shielding, approach) }));
      }
    }
  }
  return rows;
}
