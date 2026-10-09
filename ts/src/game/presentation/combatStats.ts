



import { PARTICIPANT_SLOTS, type Slots, isParticipantSlot } from "../input/participants";
import { DownState, LedgeState, SurfaceContact } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";


export interface CombatObservation {
  readonly damage: Slots<number>;
  readonly hits: Slots<number>;

  readonly free: Slots<boolean>;
  readonly down: Slots<number>;
  readonly ledge: Slots<number>;
  readonly surfaceContacts: Slots<number>;
}

export function createCombatObservation(): CombatObservation {
  return { damage: [0, 0, 0, 0], hits: [0, 0, 0, 0], free: [true, true, true, true], down: [0, 0, 0, 0], ledge: [0, 0, 0, 0], surfaceContacts: [0, 0, 0, 0] };
}


export interface CombatTally {

  readonly dealt: Slots<number>;

  readonly openings: Slots<number>;

  readonly techs: Slots<number>;

  readonly missedTechs: Slots<number>;
  readonly ledgeGrabs: Slots<number>;
}

export function createCombatTally(): CombatTally {
  return { dealt: [0, 0, 0, 0], openings: [0, 0, 0, 0], techs: [0, 0, 0, 0], missedTechs: [0, 0, 0, 0], ledgeGrabs: [0, 0, 0, 0] };
}

export function clearCombatTally(tally: CombatTally): void {
  tally.dealt.fill(0);
  tally.openings.fill(0);
  tally.techs.fill(0);
  tally.missedTechs.fill(0);
  tally.ledgeGrabs.fill(0);
}

export function observeCombat(observation: CombatObservation, world: Readonly<Roster>): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    observation.damage[slot] = fighter.status.damage;
    observation.hits[slot] = fighter.visuals.hit;
    observation.free[slot] = fighter.launch.hitstun === 0 && fighter.launch.hitlag === 0;
    observation.down[slot] = fighter.down.state;
    observation.ledge[slot] = fighter.ledge.state;
    observation.surfaceContacts[slot] = fighter.surfaceRecovery.contactSerial;
  }
}

const floorTech = (state: number) => state === DownState.tech || state === DownState.techRoll;


export function tallyCombat(before: Readonly<CombatObservation>, world: Readonly<Roster>, tally: CombatTally): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    const attacker = fighter.hits.lastAttacker;
    const credited = attacker !== undefined && attacker !== slot && isParticipantSlot(attacker);
    const added = fighter.status.damage - (before.damage[slot] ?? 0);
    if (credited && added > 0) tally.dealt[attacker] += added;
    if (credited && fighter.visuals.hit !== before.hits[slot] && before.free[slot] && fighter.launch.hitstun > 0) tally.openings[attacker]++;
    const down = fighter.down.state;
    if (down !== before.down[slot]) {
      if (floorTech(down) && !floorTech(before.down[slot] ?? 0)) tally.techs[slot]++;
      else if (down === DownState.bound) tally.missedTechs[slot]++;
    }
    const contact = fighter.surfaceRecovery.contactKind;
    if (fighter.surfaceRecovery.contactSerial !== before.surfaceContacts[slot] && (contact === SurfaceContact.techWall || contact === SurfaceContact.techCeiling)) tally.techs[slot]++;
    if (fighter.ledge.state === LedgeState.hang && before.ledge[slot] === LedgeState.none) tally.ledgeGrabs[slot]++;
  }
}
